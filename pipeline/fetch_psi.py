#!/usr/bin/env python3
"""Fetch NASA PSI combustion investigation metadata + experimental tables.

Uses the public JSON API behind https://psi.nasa.gov/physci/repo/search :
  GET /geode-py/ws/repo/search?term=...&type=investigation&size=N
  GET /geode-py/ws/repo/investigations/{accession}
  GET /geode-py/ws/studies/{accession}/download?file=...&version=...&redirect=false  -> presigned S3 URL
"""
import json, os, time, urllib.parse, requests
BASE = "https://psi.nasa.gov/geode-py/ws"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
os.makedirs(os.path.join(OUT, "tables"), exist_ok=True)
S = requests.Session(); S.headers["User-Agent"] = "flame-in-freefall-spaceapps2026"

def search(params):
    r = S.get(f"{BASE}/repo/search", params={**params, "size": 500}, timeout=60); r.raise_for_status()
    return r.json()["hits"]["hits"]

hits = {}
for p in [{"type": "investigation", "ffield": "Research Area", "fvalue": "Combustion Science"},
          {"term": "combustion", "type": "investigation"},
          {"term": "flame", "type": "investigation"},
          {"term": "fire", "type": "investigation"}]:
    for h in search(p):
        s = h["_source"]
        # keep combustion-science or explicitly combustion/fire-related records
        txt = json.dumps(s).lower()
        if s.get("Research Area", "").lower() == "combustion science" or "combustion" in txt:
            hits[s["Accession"]] = s
print("investigations:", len(hits))
json.dump(hits, open(os.path.join(OUT, "search_index.json"), "w"), indent=1)

details = {}
for acc in sorted(hits, key=lambda a: int(a.split("-")[1])):
    r = S.get(f"{BASE}/repo/investigations/{acc}", timeout=60)
    if r.status_code != 200:
        print("detail fail", acc, r.status_code); continue
    d = r.json()
    # drop huge file listings, keep a compact file summary
    files = d.pop("added", []) or []
    d.pop("removed", None)
    d["fileSummary"] = {"count": len(files), "totalBytes": d.get("totalFileSize"),
                        "folders": sorted({f.get("remote_path", "").split("/")[4] for f in files if f.get("remote_path", "").count("/") > 4})}
    tables = []
    for t in d.get("experimentalTable") or []:
        fn = t.get("file_name"); ver = t.get("version", 1)
        try:
            u = S.get(f"{BASE}/studies/{acc}/download", params={"file": fn, "version": ver, "redirect": "false"}, timeout=60).text.strip()
            c = S.get(u, timeout=120)
            if c.status_code == 200 and len(c.content) < 5_000_000:
                local = os.path.join("tables", fn.replace(" ", "_"))
                open(os.path.join(OUT, local), "wb").write(c.content)
                tables.append({"file_name": fn, "local": local, "bytes": len(c.content)})
        except Exception as e:
            print("table fail", acc, fn, e)
    d["experimentalTableFiles"] = tables
    details[acc] = d
    print(acc, d.get("investigationAcronym"), "| tables:", len(tables), "| files:", len(files))
    time.sleep(0.3)
json.dump(details, open(os.path.join(OUT, "investigations_detail.json"), "w"), indent=1, default=str)
