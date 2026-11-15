#!/usr/bin/env python3
"""Collect PDF documents attached to NASA PSI combustion investigation records.

For each investigation record (GET .../geode-py/ws/repo/investigations/{PSI-ID}):
  1. select `added` entries whose file_name ends in .pdf
  2. skip files > 25 MB and stop once the total PDF cap (1.5 GB) would be exceeded
  3. download via the presigned-URL endpoint:
       GET .../geode-py/ws/studies/{PSI-ID}/download?file=...&version=...&redirect=false
     then fetch the returned S3 URL
  4. data/literature/pdf/psi_<PSI-ID>_<n>.pdf   (n = position in the record's `added` list)
  5. pdftotext -layout -> data/literature/txt/psi_<PSI-ID>_<n>.txt
  6. text under 2000 chars is treated as scanned/image-only: the PDF and text are
     removed and the skip is recorded (likely scanned images)

Outputs:
  data/literature/catalog_psi.json   usable documents only (catalog schema)
  data/literature/psi_fetch_log.json per-document status and skip reason (all attempts)

Re-running is safe: documents already recorded as ok or skipped are not refetched.
"""
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
LIT = ROOT / "data" / "literature"
PDF_DIR = LIT / "pdf"
TXT_DIR = LIT / "txt"
CATALOG = LIT / "catalog_psi.json"
LOG = LIT / "psi_fetch_log.json"

RECORD_URL = "https://psi.nasa.gov/geode-py/ws/repo/investigations/{pid}"
DOWNLOAD_URL = "https://psi.nasa.gov/geode-py/ws/studies/{pid}/download"
INVESTIGATION_PAGE = "https://psi.nasa.gov/physci/repo/data/investigations/{pid}"

INVESTIGATIONS = [
    "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-10", "PSI-159", "PSI-25", "PSI-26",
    "PSI-98", "PSI-99", "PSI-100", "PSI-102", "PSI-101", "PSI-47", "PSI-69", "PSI-68",
    "PSI-39", "PSI-107", "PSI-106", "PSI-60", "PSI-62", "PSI-115", "PSI-117", "PSI-142",
]

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = int(1.5e9)
MIN_CHARS = 2000
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko)"

SESSION = requests.Session()
SESSION.headers["User-Agent"] = UA


def pdftotext_bin():
    return shutil.which("pdftotext") or "/opt/homebrew/bin/pdftotext"


def load_log():
    if LOG.exists():
        return json.loads(LOG.read_text(encoding="utf-8"))
    return {}


def save_log(log):
    LOG.write_text(json.dumps(log, indent=1, ensure_ascii=False), encoding="utf-8")


def fetch_record(pid):
    r = SESSION.get(RECORD_URL.format(pid=pid), timeout=60)
    r.raise_for_status()
    return r.json()


def presigned_url(pid, file_name, version):
    r = SESSION.get(
        DOWNLOAD_URL.format(pid=pid),
        params={"file": file_name, "version": version, "redirect": "false"},
        timeout=60,
    )
    r.raise_for_status()
    url = r.text.strip()
    if not url.startswith("http"):
        raise RuntimeError(f"no presigned URL returned: {url[:120]}")
    return url


def download(url, dest):
    """Stream to dest; abort if the body exceeds the per-file limit. Returns bytes written."""
    written = 0
    with SESSION.get(url, stream=True, timeout=180) as r:
        r.raise_for_status()
        with open(dest, "wb") as fh:
            for chunk in r.iter_content(chunk_size=1 << 20):
                written += len(chunk)
                if written > MAX_FILE_BYTES:
                    raise OverflowError("body exceeds 25 MB")
                fh.write(chunk)
    return written


def to_text(pdf_path, txt_path):
    """Run pdftotext -layout; return the text (stripped length is what gets checked)."""
    subprocess.run(
        [pdftotext_bin(), "-layout", str(pdf_path), str(txt_path)],
        check=True, capture_output=True, timeout=600,
    )
    return txt_path.read_text(encoding="utf-8", errors="replace")


def process_one(pid, idx, entry, log, total_bytes):
    """Return the updated total_bytes after handling one document."""
    key = f"psi_{pid}_{idx}"
    file_name = entry["file_name"]
    size = entry.get("file_size") or 0
    pdf_path = PDF_DIR / f"{key}.pdf"
    txt_path = TXT_DIR / f"{key}.txt"

    prev = log.get(key)
    if prev and prev.get("status") in ("ok", "skipped"):
        return total_bytes  # already handled in an earlier run

    base = {"investigation": pid, "file_name": file_name, "index": idx,
            "record_bytes": size, "version": entry.get("version", 1)}

    if size > MAX_FILE_BYTES:
        log[key] = {**base, "status": "skipped", "reason": f"size {size/1e6:.1f} MB > 25 MB"}
        print(f"  {key}: skip, {size/1e6:.1f} MB > 25 MB", flush=True)
        return total_bytes

    if total_bytes + size > MAX_TOTAL_BYTES:
        # not recorded: retried on the next run if cap room appears
        print(f"  {key}: deferred, total cap 1.5 GB would be exceeded", flush=True)
        return total_bytes

    try:
        url = presigned_url(pid, file_name, entry.get("version", 1))
        nbytes = download(url, pdf_path)
    except OverflowError:
        pdf_path.unlink(missing_ok=True)
        log[key] = {**base, "status": "skipped", "reason": "body > 25 MB"}
        print(f"  {key}: skip, body > 25 MB", flush=True)
        return total_bytes
    except Exception as e:  # network or endpoint error: leave unrecorded so it retries
        pdf_path.unlink(missing_ok=True)
        print(f"  {key}: download error: {e}", flush=True)
        log[key] = {**base, "status": "error", "reason": f"download: {e}"}
        return total_bytes

    if nbytes > MAX_FILE_BYTES:
        pdf_path.unlink(missing_ok=True)
        log[key] = {**base, "status": "skipped", "reason": f"size {nbytes/1e6:.1f} MB > 25 MB"}
        return total_bytes

    if total_bytes + nbytes > MAX_TOTAL_BYTES:
        pdf_path.unlink(missing_ok=True)
        print(f"  {key}: deferred, total cap 1.5 GB would be exceeded", flush=True)
        return total_bytes

    try:
        text = to_text(pdf_path, txt_path)
    except Exception as e:
        pdf_path.unlink(missing_ok=True)
        txt_path.unlink(missing_ok=True)
        log[key] = {**base, "status": "error", "reason": f"pdftotext: {e}", "bytes": nbytes}
        print(f"  {key}: pdftotext error: {e}", flush=True)
        return total_bytes

    chars = len(text.strip())
    if chars < MIN_CHARS:
        pdf_path.unlink(missing_ok=True)
        txt_path.unlink(missing_ok=True)
        log[key] = {**base, "status": "skipped", "reason": f"text {chars} chars < 2000 (likely scanned images)",
                    "chars": chars, "bytes": nbytes}
        print(f"  {key}: skip, {chars} chars (likely scanned)", flush=True)
        return total_bytes

    log[key] = {**base, "status": "ok", "chars": chars, "bytes": nbytes}
    print(f"  {key}: ok, {chars} chars, {nbytes/1e6:.2f} MB", flush=True)
    return total_bytes + nbytes


def main():
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    TXT_DIR.mkdir(parents=True, exist_ok=True)
    log = load_log()
    records = {}

    for pid in INVESTIGATIONS:
        try:
            records[pid] = fetch_record(pid)
        except Exception as e:
            print(f"{pid}: record fetch failed: {e}", file=sys.stderr, flush=True)
            records[pid] = None
        time.sleep(0.2)

    total_bytes = sum(v.get("bytes", 0) for v in log.values() if v.get("status") == "ok")
    for pid in INVESTIGATIONS:
        rec = records.get(pid)
        if rec is None:
            continue
        added = rec.get("added") or []
        print(f"{pid} ({rec.get('investigationAcronym') or ''}): {len(added)} added entries", flush=True)
        for idx, entry in enumerate(added):
            fn = str(entry.get("file_name") or "")
            if not fn.lower().endswith(".pdf"):
                continue
            total_bytes = process_one(pid, idx, entry, log, total_bytes)
            save_log(log)
            time.sleep(0.2)

    catalog = {}
    for key, v in sorted(log.items()):
        if v.get("status") != "ok":
            continue
        catalog[key] = {
            "id": key,
            "title": os.path.splitext(v["file_name"])[0],
            "year": None,
            "url": INVESTIGATION_PAGE.format(pid=v["investigation"]),
            "authors": [],
            "investigation": v["investigation"],
            "file_name": v["file_name"],
            "chars": v["chars"],
        }
    CATALOG.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    save_log(log)
    print(f"\nusable: {len(catalog)}  total PDF MB kept: {total_bytes/1e6:.1f}", flush=True)
    print(f"catalog: {CATALOG}\nlog: {LOG}", flush=True)


if __name__ == "__main__":
    main()
