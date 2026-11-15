#!/usr/bin/env python3
"""Merge PSI raw metadata + parsed tables + SI extractions -> web/public/data/*.json, and compute habitat scores."""
import json, math, os, sys, datetime, requests
ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "si"))
from extractions import X, EXCLUDED
raw = json.load(open(os.path.join(ROOT, "data/raw/investigations_detail.json")))
idx = json.load(open(os.path.join(ROOT, "data/raw/search_index.json")))
cond = json.load(open(os.path.join(ROOT, "data/processed/conditions.json")))
OUT = os.path.join(ROOT, "web/public/data"); os.makedirs(OUT, exist_ok=True)
TH = os.path.join(ROOT, "web/public/thumbs"); os.makedirs(TH, exist_ok=True)

PSI_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{}"  # human-facing record page
# Habitat atmospheres (sources: challenge brief; BRE objective text for 8.2 psia/34%)
HABITATS = {
  "spacecraft": {"label": "Spacecraft cabin", "o2": 0.21, "p_atm": 1.0, "g": 0.0, "note": "Nominal 21% O2 / 14.7 psia cabin (exploration vehicles may adopt 8.2 psia / 34%)."},
  "iss": {"label": "ISS", "o2": 0.21, "p_atm": 1.0, "g": 0.0, "note": "21% O2 at 14.7 psia, microgravity."},
  "lunar": {"label": "Lunar base", "o2": 0.30, "p_atm": 10.2 / 14.696, "g": 0.166, "note": "~30% O2 at 10.2 psia (challenge brief), 1/6 g."},
  "mars": {"label": "Mars base", "o2": 0.30, "p_atm": 10.2 / 14.696, "g": 0.38, "note": "Assumed same exploration atmosphere as lunar base (no NASA Mars habitat standard in sources), 0.38 g."},
  "rover": {"label": "Pressurized rover", "o2": 0.34, "p_atm": 8.2 / 14.696, "g": 0.166, "note": "8.2 psia / 34% O2 exploration atmosphere named in ACME BRE objectives; within the brief's '30%+ at <=10.2 psi'."},
}
CATW = {"prevention": 0.35, "suppression": 0.25, "detection": 0.2, "modeling": 0.2}

def atm_match(acc, o2h, ph):
    pts = [p for p in cond["points"] if p["acc"] == acc]
    best, nearest, mode = None, None, None
    for p in pts:
        if p["o2"] is None: continue
        if p["p_atm"] is not None:
            d = math.hypot((p["o2"] - o2h) / 0.10, (p["p_atm"] - ph) / 0.30); m = math.exp(-d)
        else:
            d = abs(p["o2"] - o2h) / 0.10; m = 0.6 * math.exp(-d)
        if best is None or m > best: best, nearest = m, p
    return (round(best, 3) if best is not None else 0.25), nearest

out = []
for acc, e in X.items():
    r = raw[acc]; s = idx.get(acc, {})
    thumb = None
    try:
        im = requests.get(f"https://psi.nasa.gov/geode-py/ws/investigations/{acc}/image", timeout=30)
        if im.status_code == 200 and im.headers.get("content-type", "").startswith("image"):
            ext = "png" if "png" in im.headers["content-type"] else "jpg"
            open(os.path.join(TH, f"{acc}.{ext}"), "wb").write(im.content); thumb = f"thumbs/{acc}.{ext}"
    except Exception: pass
    cats = {k: {"score": v[0], "rationale": v[1]} for k, v in e["cat"].items()}
    core = sum(CATW[k] * cats[k]["score"] for k in CATW) / 10  # 0..1
    peak = max(c["score"] for c in cats.values()) / 10
    fs = 0.6 * core + 0.4 * peak
    hab = {}
    micro = "Microgravity" in e["gravity"]; efield = acc == "PSI-22"
    for hk, h in HABITATS.items():
        am, near = atm_match(acc, h["o2"], h["p_atm"])
        if h["g"] == 0: gm = 1.0 if micro else 0.5
        else: gm = (0.65 if micro else 0.5) + (0.15 if efield else 0)
        score = round(100 * (0.5 * fs + 0.25 * am + 0.1 * gm + 0.15 * e["realism"]))
        parts = []
        if near:
            parts.append(f"nearest tested point {near['o2']*100:.1f}% O2" + (f" @ {near['p_atm']*14.696:.1f} psia" if near['p_atm'] else " (pressure not tabulated)"))
        else: parts.append("no tabulated O2/pressure conditions in PSI")
        parts.append("microgravity data" + ("" if h["g"] == 0 else f" bounds {h['g']} g only from one side") if micro else "ground/computational study")
        hab[hk] = {"score": score, "atmMatch": am, "gravityMatch": gm, "rationale": f"{e['habitatNote']} Basis: " + "; ".join(parts) + "."}
    rec = {
      "id": acc, "acronym": e["short"], "title": r.get("title"), "family": e["family"], "phase": e["phase"],
      "projectType": r.get("projectType"), "subResearchArea": r.get("subResearchArea"), "platform": r.get("flightProgram") or s.get("Flight Platform") or "",
      "startDate": r.get("investigationStartDate"), "endDate": r.get("investigationEndDate"), "doi": r.get("doi"),
      "pis": [f"{c.get('firstName','')} {c.get('lastName','')}".strip() for c in r.get("contacts", [])],
      "keywords": [k.strip() for k in (s.get("Keywords") or "").split("   ") if k.strip()],
      "hardwarePSI": r.get("experimentHardware"), "hardwareLink": r.get("experimentHardwareLink"),
      "psi": {"objective": r.get("objective"), "approach": r.get("approach"), "hypothesis": r.get("hypothesis"), "impacts": r.get("researchImpacts")},
      "publications": [{"title": p.get("title"), "doi": p.get("doi"), "authors": p.get("authorList")} for p in r.get("publications", [])][:60],
      "files": r.get("fileSummary"), "tables": [t["file_name"] for t in r.get("experimentalTableFiles", [])],
      "tableRows": cond["tableRowCounts"].get(acc, 0),
      "si": {k: e[k] for k in ["fuels", "geometry", "o2", "pressure", "flow", "gravity", "hardware", "sensors", "variables", "findings", "summary", "earth", "related"]},
      "ranges": cond["ranges"].get(acc, {}),
      "categories": cats, "habitats": hab, "fireSafetyIndex": round(100 * fs), "realism": e["realism"],
      "thumb": thumb, "sourceUrl": f"https://psi.nasa.gov/physci/repo/data/investigations/{acc}", "doiUrl": f"https://doi.org/{r.get('doi')}" if r.get("doi") else None,
      "apiUrl": f"https://psi.nasa.gov/geode-py/ws/repo/investigations/{acc}",
    }
    out.append(rec)
out.sort(key=lambda x: -x["fireSafetyIndex"])
json.dump(out, open(os.path.join(OUT, "investigations.json"), "w"), indent=1)
json.dump({"points": cond["points"]}, open(os.path.join(OUT, "conditions.json"), "w"))
json.dump({"generated": datetime.datetime.now(datetime.UTC).isoformat(), "habitats": HABITATS, "categoryWeights": CATW,
           "excluded": EXCLUDED, "count": len(out), "testPoints": len(cond["points"]),
           "tableRows": sum(cond["tableRowCounts"].get(a, 0) for a in X)}, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
print("wrote", len(out))
for o in out: print(o["id"], o["acronym"], o["fireSafetyIndex"], {k: v["score"] for k, v in o["habitats"].items()})
