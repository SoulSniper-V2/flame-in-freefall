#!/usr/bin/env python3
"""Measure flame area and leading-edge motion in BASS-II (PSI-25) videos.

For each test in data/vision/bass2_index.csv (one chosen video per test):
  1. download the mp4 through the PSI presigned-URL endpoint into a fresh scratch dir
  2. sample frames at 4 fps (sequential decode, V channel of HSV kept at <=480 px wide)
  3. background = median of the ~1 s before ignition (fallback: 10th percentile over clip)
  4. flame mask = (V > max(60, 0.5 * frame p99.5)) & (V - background > 40), OSD band excluded,
     morphological open/close, components below 5% of the largest dropped
  5. per frame: area, bbox, centroid; burn period = frames with area >= 150 px;
     PCA of centroid track gives the spread axis; leading edge = extreme mask pixel
     along that axis; Theil-Sen slope of edge vs time = edge speed (R^2 reported)
  6. delete the mp4 (always, in a finally block), write QA contact sheet

Outputs:
  data/vision/bass2_flames.csv   one row per table test (conditions + metrics + quality)
  data/vision/bass2_tracks.json  per test: t, area, edge at 4 fps (native px)
  data/vision/qa/<test>.jpg      6-frame contact sheet with mask contours

Per-test results are cached under <scratch>/vision_cache so a run can be resumed.

Usage:
  python3 pipeline/vision/measure_flames.py --tests B1,B2,B3
  python3 pipeline/vision/measure_flames.py --all
  python3 pipeline/vision/measure_flames.py --assemble      (rebuild outputs from cache)
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from scipy.stats import theilslopes

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "data/vision/bass2_index.csv"
OUT_CSV = ROOT / "data/vision/bass2_flames.csv"
OUT_JSON = ROOT / "data/vision/bass2_tracks.json"
QA_DIR = ROOT / "data/vision/qa"
DEFAULT_SCRATCH = Path(os.environ.get("FIF_SCRATCH", "/tmp/flame-in-freefall"))
PSI_ID = "PSI-25"
API_DOWNLOAD = f"https://psi.nasa.gov/geode-py/ws/studies/{PSI_ID}/download"

# ---- method constants -------------------------------------------------------
SAMPLE_FPS = 4.0          # analysis rate
WORK_W = 480              # frames wider than this are downscaled for analysis
IGN_NATIVE_PX = 150.0     # ignition / burning threshold, native-resolution pixels
THR_MIN = 60.0            # V threshold floor
THR_FRAC = 0.35           # V threshold = max(THR_MIN, THR_FRAC * p99.5); 0.5 lost dim red halos (tuned)
DIFF_MIN = 40.0           # V must exceed background by this much
RED_MIN = 15              # red dominance R - G (flame is red/orange; grey hardware is not)
RED_NEAR_K = 7            # bright pixel must lie within ~3 px of a red-dominant pixel
OSD_FRAC = 0.22           # top fraction of rows excluded (burned-in OSD text)
CC_MIN_WORK = 4           # minimum component size, working px
CC_KEEP_FRAC = 0.05       # keep components >= 5% of the largest
PRE_IGN_SAMPLES = 4       # ~1 s at 4 fps for the pre-ignition background
FIT_MAX_POINTS = 500      # Theil-Sen subsample cap
BIG_FRAC = 0.10           # "flame covers >10% of frame" = glare / saturation
BIG_FRAC_LIMIT = 0.05     # if > 5% of frames are like that, mask unreliable
QA_MAX_BYTES = 250_000

K3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
K5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
KRED = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (RED_NEAR_K, RED_NEAR_K))


def log(msg: str) -> None:
    print(time.strftime("%H:%M:%S"), msg, flush=True)


# ---- download ---------------------------------------------------------------
def presigned_url(name: str, version: str) -> str:
    cmd = ["curl", "-sG", "--max-time", "60", API_DOWNLOAD,
           "--data-urlencode", f"file={name}",
           "--data-urlencode", f"version={version}",
           "--data-urlencode", "redirect=false"]
    url = subprocess.run(cmd, capture_output=True, text=True, check=False).stdout.strip()
    if not url.startswith("https://"):
        raise RuntimeError(f"no presigned url: {url[:120]}")
    return url


def download(name: str, version: str, dest: Path) -> None:
    url = presigned_url(name, version)
    cmd = ["curl", "-sL", "--max-time", "1200", "-o", str(dest), "-w", "%{http_code}", url]
    code = subprocess.run(cmd, capture_output=True, text=True, check=False).stdout.strip()
    if code != "200" or not dest.exists() or dest.stat().st_size == 0:
        raise RuntimeError(f"download failed http={code}")


# ---- segmentation -----------------------------------------------------------
def segment(v: np.ndarray, bg: np.ndarray, roi: np.ndarray, r: np.ndarray):
    """Return boolean flame mask for one frame: V (brightness), r (red dominance R-G, uint8)."""
    thr = max(THR_MIN, THR_FRAC * float(np.percentile(v[roi], 99.5)))
    red_near = cv2.dilate((r >= RED_MIN).astype(np.uint8), KRED) > 0
    m = ((v > thr) & ((v.astype(np.float32) - bg) > DIFF_MIN) & roi & red_near).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, K3)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, K5)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n <= 1:
        return np.zeros(m.shape, bool)
    areas = stats[1:, cv2.CC_STAT_AREA]
    keep_min = max(CC_MIN_WORK, CC_KEEP_FRAC * areas.max())
    keep = np.where(areas >= keep_min)[0] + 1
    return np.isin(lab, keep)


def decode_sampled(path: Path):
    """Sequentially decode, keep V channel of every 4 fps sample, plus 6 colour contact frames."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError("unreadable_video")
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or not np.isfinite(fps) or fps < 1 or fps > 240:
        fps = 29.97
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    nf = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if W <= 0 or H <= 0:
        cap.release()
        raise RuntimeError("unreadable_video (no frame size)")
    scale = min(1.0, WORK_W / W)
    Ww, Wh = int(round(W * scale)), int(round(H * scale))

    contact_ks = set()
    if nf > 0:
        n_est = max(int(nf / fps * SAMPLE_FPS), 1)
        contact_ks = set(np.linspace(0, n_est - 1, 6).round().astype(int).tolist())

    V, RG, sidx, contacts = [], [], [], {}
    idx, k, next_idx = 0, 0, 0
    while True:
        if idx == next_idx:
            ok, fr = cap.read()
            if not ok:
                break
            v = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)[:, :, 2]          # HSV value
            rg = np.clip(fr[:, :, 2].astype(np.int16) - fr[:, :, 1].astype(np.int16), 0, 255).astype(np.uint8)
            if scale < 1:
                v = cv2.resize(v, (Ww, Wh), interpolation=cv2.INTER_AREA)
                rg = cv2.resize(rg, (Ww, Wh), interpolation=cv2.INTER_AREA)
            V.append(v)
            RG.append(rg)
            sidx.append(idx)
            if k in contact_ks:
                col = fr if scale == 1 else cv2.resize(fr, (Ww, Wh), interpolation=cv2.INTER_AREA)
                contacts[k] = col.copy()
            k += 1
            next_idx = int(round(k * fps / SAMPLE_FPS))
            idx += 1
        else:
            if not cap.grab():
                break
            idx += 1
    cap.release()
    if len(V) < 2:
        raise RuntimeError("too_few_frames")
    meta = dict(fps=float(fps), width=W, height=H, nframes_meta=nf, scale=scale,
                work_w=Ww, work_h=Wh)
    return np.stack(V), np.stack(RG), np.asarray(sidx) / fps, contacts, meta


def pass_masks(V, RG, bg, roi):
    """Area (work px), centroid, bbox per frame."""
    T = V.shape[0]
    A = np.zeros(T)
    cx = np.full(T, np.nan)
    cy = np.full(T, np.nan)
    bb = np.full((T, 4), np.nan)
    for i in range(T):
        m = segment(V[i], bg, roi, RG[i])
        n = int(m.sum())
        A[i] = n
        if n:
            ys, xs = np.nonzero(m)
            cx[i], cy[i] = xs.mean(), ys.mean()
            bb[i] = (xs.min(), ys.min(), xs.max(), ys.max())
    return A, cx, cy, bb


def leading_edge(V, RG, bg, roi, idxs, ux, uy):
    E = np.full(V.shape[0], np.nan)
    for i in idxs:
        m = segment(V[i], bg, roi, RG[i])
        if m.any():
            ys, xs = np.nonzero(m)
            E[i] = float((xs * ux + ys * uy).max())
    return E


def theil_r2(t, y):
    ok = np.isfinite(t) & np.isfinite(y)
    t, y = t[ok], y[ok]
    if len(t) < 3 or np.ptp(t) == 0:
        return float("nan"), float("nan"), float("nan")
    if len(t) > FIT_MAX_POINTS:
        sel = np.linspace(0, len(t) - 1, FIT_MAX_POINTS).round().astype(int)
        slope, intercept, _, _ = theilslopes(y[sel], t[sel])
    else:
        slope, intercept, _, _ = theilslopes(y, t)
    res = y - (slope * t + intercept)
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1.0 - float((res ** 2).sum()) / ss_tot if ss_tot > 0 else float("nan")
    return float(slope), float(intercept), r2


def analyze(V, RG, t, contacts, meta):
    """Full per-video analysis. Returns (metrics dict, track dict, qa payload)."""
    T = V.shape[0]
    scale = meta["scale"]
    Wh, Ww = V.shape[1:]
    W_nat, H_nat = meta["width"], meta["height"]
    notes = []

    roi = np.ones((Wh, Ww), bool)
    roi[: int(round(OSD_FRAC * Wh)), :] = False

    # pass 1: background = 10th percentile over the clip, to locate ignition
    step = max(1, T // 200)
    bg10 = np.percentile(V[::step], 10, axis=0).astype(np.float32)
    A0, _, _, _ = pass_masks(V, RG, bg10, roi)
    A0n = A0 / scale ** 2
    ign0 = np.where(A0n >= IGN_NATIVE_PX)[0]
    if ign0.size and ign0[0] >= PRE_IGN_SAMPLES:
        k0 = int(ign0[0])
        bg = np.median(V[k0 - PRE_IGN_SAMPLES:k0], axis=0).astype(np.float32)
        bg_method = "pre_ignition_median_1s"
    elif ign0.size and ign0[0] >= 2:
        bg = np.median(V[: int(ign0[0])], axis=0).astype(np.float32)
        bg_method = "pre_ignition_median_short"
        notes.append("short_pre_ignition_window")
    else:
        bg = bg10
        bg_method = "p10_over_clip"
        if ign0.size and ign0[0] < 2:
            notes.append("flame_present_at_clip_start")

    # pass 2: final areas, centroids, bboxes
    A, cx, cy, bb = pass_masks(V, RG, bg, roi)
    An = A / scale ** 2
    burn = np.where(An >= IGN_NATIVE_PX)[0]

    m = {
        "bg_method": bg_method,
        "frame_w": W_nat, "frame_h": H_nat,
        "source_fps": round(meta["fps"], 3),
        "video_duration_s": round(meta["nframes_meta"] / meta["fps"], 2) if meta["nframes_meta"] else None,
        "n_sampled_frames": T,
        "ign_threshold_px": IGN_NATIVE_PX,
        "peak_area_px": round(float(An.max()), 1),
        "peak_area_frac_frame": float(An.max() / (W_nat * H_nat)),
    }
    track = {"t": t, "area": An, "edge": np.full(T, np.nan)}

    if burn.size == 0:
        m.update(ignition_s=None, burn_duration_s=0.0, median_area_px=None,
                 edge_speed_px_s=None, edge_speed_r2=None, end_mode="no_flame",
                 axis_ratio=None, axis_dx=None, axis_dy=None, extinguished_in_fov=False,
                 fit_points=0, frac_frames_over_10pct=0.0)
        m["quality"] = "bad"
        m["quality_reason"] = "; ".join(["no_flame_detected (peak < 150 px)"] + notes)
        return m, track, dict(contacts=contacts, bg=bg, roi=roi, scale=scale, A=An, t=t, V=V, RG=RG)

    ign_k, last_k = int(burn[0]), int(burn[-1])
    pts = np.c_[cx[burn], cy[burn]]
    mu = pts.mean(axis=0)
    if len(burn) >= 3:
        cov = np.cov((pts - mu).T)
        evals, evecs = np.linalg.eigh(cov)
        u = evecs[:, int(np.argmax(evals))]
        ratio = float(evals.max() / max(evals.min(), 1e-9))
        proj = (pts - mu) @ u
        if np.ptp(proj) > 0 and np.ptp(t[burn]) > 0 and np.corrcoef(t[burn], proj)[0, 1] < 0:
            u = -u
    else:
        u, ratio = np.array([1.0, 0.0]), float("nan")
        notes.append("too_few_burn_frames_for_axis")
    if ratio == ratio and ratio < 3.0:
        notes.append(f"weak_spread_axis (eigen ratio {ratio:.1f})")

    # pass 3: leading edge along the axis, over the window with any mask
    window = np.arange(ign_k, last_k + 1)
    E = leading_edge(V, RG, bg, roi, window, float(u[0]), float(u[1]))
    E = E / scale  # work px -> native px
    track["edge"][window] = E[window]
    slope, intercept, r2 = theil_r2(t[burn], E[burn])

    end_frames = burn[-4:]
    ex, ey = float(np.nanmean(cx[end_frames])) / scale, float(np.nanmean(cy[end_frames])) / scale
    inside = (0.1 * W_nat <= ex <= 0.9 * W_nat) and (0.1 * H_nat <= ey <= 0.9 * H_nat)
    if last_k >= T - 4:
        end_mode = "still_burning_at_clip_end"
        notes.append("still_burning_at_clip_end")
    elif inside:
        end_mode = "extinguished_in_fov"
    else:
        end_mode = "left_fov_or_edge"

    big = float(np.mean(An > BIG_FRAC * W_nat * H_nat))
    burn_dur = float(t[last_k] - t[ign_k])
    m.update(
        ignition_s=round(float(t[ign_k]), 2),
        burn_duration_s=round(burn_dur, 2),
        median_area_px=round(float(np.median(An[burn])), 1),
        edge_speed_px_s=None if not np.isfinite(slope) else round(slope, 3),
        edge_speed_r2=None if not np.isfinite(r2) else round(r2, 4),
        edge_fit_intercept_px=None if not np.isfinite(intercept) else round(intercept, 2),
        end_mode=end_mode,
        extinguished_in_fov=bool(end_mode == "extinguished_in_fov"),
        axis_ratio=None if ratio != ratio else round(ratio, 2),
        axis_dx=round(float(u[0]), 3), axis_dy=round(float(u[1]), 3),
        fit_points=int(np.isfinite(E[burn]).sum()),
        frac_frames_over_10pct=round(big, 4),
        last_centroid_x=round(ex, 1), last_centroid_y=round(ey, 1),
    )

    # quality gating
    reasons = list(notes)
    quality = "ok"
    if big > BIG_FRAC_LIMIT:
        quality = "bad"
        reasons.insert(0, f"mask_unreliable: >10% of frame lit in {big*100:.1f}% of frames (glare/saturation)")
    if burn_dur < 1.0:
        quality = "bad" if quality == "bad" else "marginal"
        reasons.append("burn_under_1s")
    if burn_dur < 3.0:
        reasons.append("burn_under_3s")
        if quality == "ok":
            quality = "marginal"
    if r2 == r2 and r2 < 0.5:
        reasons.append(f"low_edge_fit_r2 ({r2:.2f})")
        if quality == "ok":
            quality = "marginal"
    if ratio == ratio and ratio < 3.0 and quality == "ok":
        quality = "marginal"
    if "still_burning_at_clip_end" in notes:
        if quality == "ok":
            quality = "marginal"
    m["quality"] = quality
    m["quality_reason"] = "; ".join(reasons)
    return m, track, dict(contacts=contacts, bg=bg, roi=roi, scale=scale, A=An, t=t, V=V, RG=RG)


# ---- QA contact sheet -------------------------------------------------------
def contact_sheet(test: str, qa: dict, out_path: Path) -> None:
    contacts, bg, roi, scale = qa["contacts"], qa["bg"], qa["roi"], qa["scale"]
    V, RG, A, t = qa["V"], qa["RG"], qa["A"], qa["t"]
    ks = sorted(contacts)[:6]
    panels = []
    for k in ks:
        mask = segment(V[k], bg, roi, RG[k])
        img = contacts[k].copy()
        cnts, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(img, cnts, -1, (0, 255, 0), 1)
        roi_row = int(round(OSD_FRAC * img.shape[0]))
        cv2.line(img, (0, roi_row), (img.shape[1] - 1, roi_row), (255, 200, 0), 1)
        label = f"t={t[k]:.1f}s A={A[k]:.0f}px"
        cv2.putText(img, label, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 3, cv2.LINE_AA)
        cv2.putText(img, label, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
        panels.append(img)
    if not panels:
        return
    h, w = panels[0].shape[:2]
    while len(panels) < 6:
        panels.append(np.zeros((h, w, 3), np.uint8))
    rows = [np.hstack(panels[i:i + 3]) for i in (0, 3)]
    sheet = np.vstack(rows)
    sheet = cv2.copyMakeBorder(sheet, 2, 2, 2, 2, cv2.BORDER_CONSTANT, value=(40, 40, 40))
    for q in (85, 75, 65, 55, 45):
        ok, buf = cv2.imencode(".jpg", sheet, [cv2.IMWRITE_JPEG_QUALITY, q])
        if ok and len(buf) <= QA_MAX_BYTES:
            break
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(buf.tobytes())


# ---- per-test driver --------------------------------------------------------
def process_test(row: dict, scratch: Path) -> dict:
    test = row["test_id"]
    name, version = row["video_file"], row["video_version"]
    t0 = time.time()
    res = {"test_id": test}
    work_root = scratch / "work"
    work_root.mkdir(parents=True, exist_ok=True)
    workdir = Path(tempfile.mkdtemp(prefix=f"{test}_", dir=work_root))
    video = workdir / "video.mp4"
    try:
        download(name, version, video)
        mb = video.stat().st_size / 1e6
        m, track, qa = analyze(*decode_sampled(video))
        res.update(m)
        res["video_downloaded_mb"] = round(mb, 2)
        res["status"] = "processed"
        res["error"] = ""
        contact_sheet(test, qa, QA_DIR / f"{test}.jpg")
        res["_track"] = {
            "t": [round(float(x), 2) for x in track["t"]],
            "area": [None if not np.isfinite(x) else int(round(x)) for x in track["area"]],
            "edge": [None if not np.isfinite(x) else round(float(x), 1) for x in track["edge"]],
        }
    except Exception as e:  # noqa: BLE001
        msg = str(e).split("\n")[0][:200]
        status = "download_failed" if msg.startswith(("download", "no presigned")) else "error"
        res.update(status=status, error=msg, quality="bad", quality_reason=msg)
        res["_track"] = None
        log(f"  {test} ERROR: {msg}\n{traceback.format_exc()[-800:]}")
    finally:
        if video.exists():
            video.unlink()
        shutil.rmtree(workdir, ignore_errors=True)
    res["process_seconds"] = round(time.time() - t0, 1)
    return res


def cache_path(scratch: Path, test: str) -> Path:
    d = scratch / "vision_cache"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{test}.json"


def load_index() -> pd.DataFrame:
    return pd.read_csv(INDEX, dtype=str, keep_default_na=False)


def assemble(scratch: Path) -> None:
    idx = load_index()
    rows, tracks = [], {}
    for _, r in idx.iterrows():
        base = r.to_dict()
        cp = cache_path(scratch, r["test_id"])
        if cp.exists():
            c = json.loads(cp.read_text())
            tr = c.pop("_track", None)
            base.update(c)
            if tr is not None and c.get("status") == "processed":
                tracks[r["test_id"]] = dict(
                    tr, sample_fps=SAMPLE_FPS, width=c.get("frame_w"), height=c.get("frame_h"),
                    quality=c.get("quality"), video_file=r["video_file"])
        else:
            if r["video_status"] != "selected":
                base.update(status="no_video", quality="bad", quality_reason="no_video_in_record")
            else:
                base.update(status="not_run", quality="", quality_reason="")
        rows.append(base)
    out = pd.DataFrame(rows)
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT_CSV, index=False)
    OUT_JSON.write_text(json.dumps(tracks, separators=(",", ":")))
    done = sum(1 for r in rows if r.get("status") == "processed")
    log(f"wrote {OUT_CSV} ({len(rows)} rows; processed={done}) and {OUT_JSON} ({len(tracks)} tracks)")


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--tests", help="comma-separated test ids, e.g. B1,B2,B3")
    g.add_argument("--all", action="store_true")
    g.add_argument("--assemble", action="store_true", help="only rebuild outputs from cache")
    ap.add_argument("--scratch", default=os.environ.get("PSI_SCRATCH", str(DEFAULT_SCRATCH)))
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    scratch = Path(args.scratch)
    QA_DIR.mkdir(parents=True, exist_ok=True)

    if not args.assemble:
        idx = load_index()
        sel = idx[idx.video_status == "selected"]
        if args.tests:
            want = [t.strip() for t in args.tests.split(",") if t.strip()]
            sel = sel[sel.test_id.isin(want)]
        if args.limit:
            sel = sel.head(args.limit)
        log(f"processing {len(sel)} tests")
        for i, (_, r) in enumerate(sel.iterrows(), 1):
            log(f"[{i}/{len(sel)}] {r['test_id']}  {r['video_file']}  ({int(r['video_size_bytes'])/1e6:.1f} MB)")
            res = process_test(r.to_dict(), scratch)
            cache_path(scratch, r["test_id"]).write_text(json.dumps(res, default=float))
            log(f"  -> {res.get('status')} quality={res.get('quality')} peak={res.get('peak_area_px')} "
                f"ign={res.get('ignition_s')} burn={res.get('burn_duration_s')} "
                f"speed={res.get('edge_speed_px_s')} r2={res.get('edge_speed_r2')} "
                f"reason={res.get('quality_reason', '')[:160]} ({res.get('process_seconds')}s)")
    assemble(scratch)
    return 0


if __name__ == "__main__":
    sys.exit(main())
