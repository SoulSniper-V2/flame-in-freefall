#!/usr/bin/env python3
"""Parse PSI 'Experimental table' CSVs into per-test condition points and numeric ranges.
Only values present in the PSI tables are used. Pressures converted to atm (1 atm = 14.696 psia = 101.325 kPa)."""
import csv, json, os, re, io
RAW = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "tables")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
os.makedirs(OUT, exist_ok=True)

def rows(name):
    p = os.path.join(RAW, name)
    txt = open(p, encoding="utf-8-sig", errors="replace").read()
    r = list(csv.reader(io.StringIO(txt)))
    hdr = [h.strip() for h in r[0]]
    out = []
    for i, row in enumerate(r[1:], start=2):  # CSV line number (header is line 1)
        if any(c.strip() for c in row):
            d = dict(zip(hdr, [c.strip() for c in row])); d["_line"] = i; d["_file"] = name; out.append(d)
    return out

def src(r, o2col=None, pcol=None, punit=None):
    """Provenance: table file, CSV line, and the verbatim NASA cells behind each converted value."""
    cells = {}
    if o2col: cells["o2"] = [o2col, r.get(o2col, "")]
    if pcol: cells["p"] = [pcol, r.get(pcol, "")]
    return {"table": r["_file"], "line": r["_line"], "cells": cells, **({"punit": punit} if punit else {})}

def num(x):
    try: return float(str(x).replace("~", "").strip())
    except: return None

points = []  # {acc, test, o2 (fraction), p_atm, flow_cms, fuel, kind}
def add(acc, test, o2, p, fuel, kind="measured", flow=None, note=None, prov=None):
    if o2 is None and p is None and flow is None: return
    status = kind if kind != "measured" else ("recorded" if p is not None else "o2_only")
    points.append({"acc": acc, "test": test, "o2": None if o2 is None else round(o2, 4),
                   "p_atm": None if p is None else round(p, 4), "flow_cms": flow, "fuel": fuel, "kind": kind, "status": status,
                   **({"note": note} if note else {}), **({"src": prov} if prov else {})})

# FLEX (PSI-69): pressure mmHg, O2 mole fraction
for r in rows("PSI-69_Experimental_table_FLEX.csv"):
    p = num(r.get("Ambient pressure; mmHg")); o = num(r.get("O initial ambient composition; mole fraction"))
    add("PSI-69", r.get("FLEX Identifier"), o, p / 760 if p else None, r.get("Fuel"), prov=src(r, "O initial ambient composition; mole fraction", "Ambient pressure; mmHg", "mmHg"))
# CFI (PSI-39)
for r in rows("PSI-39_Experimental_table_CFI.csv"):
    m = re.search(r"([\d.]+)\s*atm", r.get("Pressure", "")); o = num(r.get("Oxygen"))
    add("PSI-39", r.get("Flex Number"), o, float(m.group(1)) if m else None, r.get("Fuel"), prov=src(r, "Oxygen", "Pressure", "atm"))
# Flame Design (PSI-10)
for r in rows("PSI-10_Experimental_table_Flame_Design_Inverse_Flame.csv"):
    add("PSI-10", r.get("Test"), num(r.get("XO2")), num(r.get("pmean (atm)")), "C2H4 (inverse flame)", prov=src(r, "XO2", "pmean (atm)", "atm"))
for r in rows("PSI-10_Experimental_table_Flame_Design_Normal_Flame.csv"):
    add("PSI-10", r.get("Test"), num(r.get("XO2 (init)")), num(r.get("pmean (atm)")), r.get("Fuel") + " (normal flame)", prov=src(r, "XO2 (init)", "pmean (atm)", "atm"))
# CFI-G (PSI-159) pressures in bar
for r in rows("PSI-159_Experimental_table_CFI-G_Inverse_Flames.csv"):
    p = num(r.get("approx p (bar)"))
    add("PSI-159", r.get("Test"), num(r.get("XO2")), p / 1.01325 if p else None, (r.get("Fuel") or "") + " (inverse)", prov=src(r, "XO2", "approx p (bar)", "bar"))
for r in rows("PSI-159_Experimental_table_CFI-G_Normal_Flames.csv"):
    p = num(r.get("approx p (bar)"))
    add("PSI-159", r.get("Test"), num(r.get("XO2 before test")), p / 1.01325 if p else None, (r.get("Fuel") or "") + " (normal)", prov=src(r, "XO2 before test", "approx p (bar)", "bar"))
# BASS-II (PSI-25): O2 % only (pressure not tabulated)
for r in rows("PSI-25_Experimental_table_BASS-II.csv"):
    o = num(r.get("Calibrated  initial O2 % by vol"))
    add("PSI-25", r.get("Test #"), o / 100 if o else None, None, r.get("Fuel Sample Material"), prov=src(r, "Calibrated  initial O2 % by vol"))
# FLEX-2 (PSI-68): test-matrix envelope (table lists O2 set and pressure set)
for o in [0.17, 0.21, 0.25, 0.30]:
    for p in [0.5, 1.0, 1.5, 2.0, 3.0]:
        add("PSI-68", f"matrix O2={o} P={p}", o, p, "n-alkane / alcohol droplets", kind="matrix")
# ACME BRE (PSI-20): O2 levels from table; pressures not in table -> use objective-stated target atmospheres
for o, psia in [(0.21, 14.7), (0.265, 10.2), (0.34, 8.2)]:
    add("PSI-20", f"target {o*100:g}% @ {psia} psia", o, psia / 14.696, "C2H4/CH4 porous burner", kind="target",
        note="Human-spacecraft atmospheres named in the BRE objectives; table lists O2 levels 21-40% but not pressures.")
bre_o2 = set()
for r in rows("PSI-20_Experimental_table_ACME_BRE.csv"):
    for t in re.split(r"[;]", r.get("Oxygen Conc (percent)", "")):
        v = num(t.replace("%", ""))
        if v and v < 100: bre_o2.add(v)
# s-Flame (PSI-23): ~21% and ~30% O2 at ~1 atm
for o in [0.21, 0.30]:
    add("PSI-23", f"~{o*100:g}% O2 ~1 atm", o, 1.0, "H2/CH4/C2H4 spherical burner", kind="approx")
# Saffire I/II: O2 % (pressure not tabulated)
for r in rows("PSI-98_Experimental_table_SAFFIRE-1.csv"):
    m = re.findall(r"[\d.]+", r.get("Percent O2", "") or "")
    if m: add("PSI-98", r.get("Sample Number"), float(m[0]) / 100, None, r.get("Material"), flow=num(r.get("Air Flow (cm/s)")), prov=src(r, "Percent O2"))
for r in rows("PSI-99_Experimental_table_SAFFIRE-2.csv"):
    m = re.findall(r"[\d.]+", r.get("Percent O2 (Note 1)", "") or "")
    if m and r.get("Sample Number", "").startswith("2-"):
        add("PSI-99", r.get("Sample Number"), float(m[0]) / 100, None, r.get("Material") or "", flow=20.0, prov=src(r, "Percent O2 (Note 1)"))

def rng(vals):
    v = [x for x in vals if x is not None]
    return [round(min(v), 4), round(max(v), 4)] if v else None

ranges = {}
for acc in sorted({p["acc"] for p in points}):
    pts = [p for p in points if p["acc"] == acc]
    ranges[acc] = {"o2_frac": rng([p["o2"] for p in pts]), "p_atm": rng([p["p_atm"] for p in pts]), "n_points": len(pts),
                   "kinds": sorted({p["kind"] for p in pts})}
ranges["PSI-20"]["o2_frac"] = [min(bre_o2) / 100, max(bre_o2) / 100]
# flows from tables
def flows(name, col, acc):
    v = [num(re.sub(r"[^\d.]", "", r.get(col, "") or "")) for r in rows(name)]
    v = [x for x in v if x]
    ranges.setdefault(acc, {})["flow_cms"] = rng(v)
flows("PSI-107_Experimental_table_Spice.csv", "Air Rate (cm/s)", "PSI-107")
flows("PSI-101_Experimental_table_SAME-R.csv", "Inlet velocity (cm/s)", "PSI-101")
flows("PSI-102_Experimental_table_SAME.csv", "Air Flow (cm/s)", "PSI-102")
flows("PSI-98_Experimental_table_SAFFIRE-1.csv", "Air Flow (cm/s)", "PSI-98")
flows("PSI-99_Experimental_table_SAFFIRE-2.csv", "Air Flow (cm/s)", "PSI-99")
flows("PSI-100_Experimental_table_SAFFIRE-3.csv", "Air Flow", "PSI-100")
# test counts per table
counts = {}
for f in os.listdir(RAW):
    acc = "-".join(f.split("_")[0].split("-")[:2])
    counts[acc] = counts.get(acc, 0) + len(rows(f))
json.dump({"points": points, "ranges": ranges, "tableRowCounts": counts}, open(os.path.join(OUT, "conditions.json"), "w"), indent=1)
print(len(points), "points"); print(json.dumps(ranges, indent=0))
