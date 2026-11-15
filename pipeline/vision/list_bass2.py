"""List BASS-II (PSI-25) mp4 videos and build one-video-per-test index.

Writes data/vision/bass2_index.csv (one row per table test, with the chosen
video and the experimental conditions joined on Test #).

Selection rule (one video per test):
  tier 0  plain main-camera name (no suffix tokens)
  tier 1  other main-camera variants (Part-N, LOS portion, first/second ignition
          attempt, shifted, lab/over-the-shoulder style names)
  tier 2  2ND_VIEW (second camera)
  excluded: Still_Sequence, thumbnails / post-burn pictures / camera-monitor
  captures, VLC screen recordings, and files under 500 KB.
Within the best tier the smallest file is chosen (per the project spec).
"""
import csv
import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RECORD_URL = "https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-25"
TABLE = ROOT / "data/raw/tables/PSI-25_Experimental_table_BASS-II.csv"
OUT = ROOT / "data/vision/bass2_index.csv"
UA = {"User-Agent": "Mozilla/5.0"}
THUMB_MAX_BYTES = 500_000

TEST_RE = re.compile(r"TEST[\s_\-]*([A-Za-z]{1,2}\d{1,2}[a-z]?)(?![0-9])", re.I)
SAMPLE_RE = re.compile(r"SAMPLE[\s_\-]*(\d+)", re.I)
EXCLUDE_TOKENS = ("still", "thumb", "post-burn", "post_burn", "picture", "monitor", "vlc-record")
TIER2_TOKENS = ("2nd_view",)
FIRST_NUM = re.compile(r"\d+(?:\.\d+)?")


def norm_test(raw: str) -> str:
    """'b16' / 'TESTB16' style -> 'B16'; trailing lowercase suffix kept ('O3a')."""
    raw = raw.strip()
    head, tail = raw[0].upper(), raw[1:]
    if tail and tail[-1].isalpha():
        return head + tail[:-1] + tail[-1].lower()
    return head + tail


def fetch_record() -> dict:
    req = urllib.request.Request(RECORD_URL, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def classify(name: str, size: float):
    low = name.lower()
    if any(tok in low for tok in EXCLUDE_TOKENS) or (size or 0) < THUMB_MAX_BYTES:
        return None
    if any(tok in low for tok in TIER2_TOKENS):
        return 2
    tail = low.split("test", 1)[-1] if "test" in low else low
    if re.search(r"(part|los|ignition|shifted|_\d\.mp4$|lab|over-the-shoulder|rack)", tail):
        return 1
    return 0


def parse_name(name: str):
    m = TEST_RE.search(name)
    test = norm_test(m.group(1)) if m else ""
    s = SAMPLE_RE.search(name)
    sample = s.group(1) if s else ""
    return test, sample


def first_num(x):
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    m = FIRST_NUM.search(str(x))
    return float(m.group(0)) if m else None


def load_table() -> pd.DataFrame:
    df = pd.read_csv(TABLE, encoding="utf-8-sig", dtype=str)
    df.columns = [re.sub(r"\s+", " ", c).strip() for c in df.columns]
    df["Test #"] = df["Test #"].str.strip()
    return df


def col(df, startswith):
    for c in df.columns:
        if c.lower().startswith(startswith.lower()):
            return c
    raise KeyError(startswith)


def main() -> int:
    rec = fetch_record()
    mp4 = [x for x in rec["added"] if x["file_name"].lower().endswith(".mp4")]
    print(f"mp4 entries in added: {len(mp4)}")

    by_test = defaultdict(list)
    unmatched = []
    for x in mp4:
        name = x["file_name"]
        test, sample = parse_name(name)
        tier = classify(name, float(x["file_size"] or 0))
        rec_row = dict(file_name=name, file_size=int(float(x["file_size"] or 0)),
                       version=x["version"], sample_from_name=sample, tier=tier)
        if not test:
            unmatched.append(name)
            continue
        if tier is None:
            continue
        by_test[test].append(rec_row)
    print(f"mp4 with no test token: {len(unmatched)}; test ids with usable candidates: {len(by_test)}")

    df = load_table()
    c = {k: col(df, k) for k in [
        "PI", "Date", "GMT", "Sample #", "Fuel Sample", "Flow restrictor", "Fan display",
        "Air display", "Radiometer", "Total Frames", "Calibrated initial", "Calibrated final",
        "Initial CO2", "Final CO2", "Initial CO (", "Final CO (",
    ]}
    rows = []
    for _, r in df.iterrows():
        t = r["Test #"]
        cands = by_test.get(t, [])
        cands.sort(key=lambda d: (d["tier"], d["file_size"]))
        best = cands[0] if cands else None
        sample_tab = str(r[c["Sample #"]]).strip()
        sample_num = re.match(r"\d+", sample_tab)
        out = {
            "test_id": t,
            "sample_id": sample_num.group(0) if sample_num else sample_tab,
            "sample_raw_table": sample_tab,
            "pi": r[c["PI"]],
            "date": r[c["Date"]],
            "gmt": r[c["GMT"]],
            "fuel_sample_material": re.sub(r"\s+", " ", str(r[c["Fuel Sample"]])).strip(),
            "flow_restrictor": r[c["Flow restrictor"]],
            "fan_display_raw": str(r[c["Fan display"]]).strip(),
            "fan_display_init": first_num(r[c["Fan display"]]),
            "air_display_raw": str(r[c["Air display"]]).strip(),
            "air_display_init": first_num(r[c["Air display"]]),
            "radiometer_gain_raw": r[c["Radiometer"]],
            "total_frames_shot": r[c["Total Frames"]],
            "o2_init_pct": first_num(r[c["Calibrated initial"]]),
            "o2_final_pct": first_num(r[c["Calibrated final"]]),
            "co2_init_pct": first_num(r[c["Initial CO2"]]),
            "co2_final_pct": first_num(r[c["Final CO2"]]),
            "co_init_ppm": first_num(r[c["Initial CO ("]]),
            "co_final_ppm": first_num(r[c["Final CO ("]]),
            "video_file": best["file_name"] if best else "",
            "video_size_bytes": best["file_size"] if best else "",
            "video_version": best["version"] if best else "",
            "video_tier": best["tier"] if best else "",
            "video_sample_from_name": best["sample_from_name"] if best else "",
            "video_status": "selected" if best else "no_video",
            "n_candidates": len(cands),
            "other_candidates": " | ".join(d["file_name"] for d in cands[1:]),
        }
        rows.append(out)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    n_sel = sum(r["video_status"] == "selected" for r in rows)
    print(f"wrote {OUT} ({len(rows)} tests, {n_sel} with a selected video, "
          f"{len(rows) - n_sel} without)")
    tiers = pd.Series([r["video_tier"] for r in rows if r["video_status"] == "selected"]).value_counts()
    print("selected tier counts:", tiers.to_dict())
    return 0


if __name__ == "__main__":
    sys.exit(main())
