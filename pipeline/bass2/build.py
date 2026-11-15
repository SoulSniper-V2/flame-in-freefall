"""Join PSI's BASS-II table (conditions) with the report's Appendix A observations (outcomes); flag impossible PSI cells;
compute microgravity flammability brackets per material class. Writes web/public/data/bass2.json and a CSV."""
import csv, json, os, re, sys
D = os.path.dirname(__file__); R = os.path.join(D, '..', '..'); sys.path.insert(0, D)
from labels import LAB, NOTE
obs = {x['test']: x for x in json.load(open(os.path.join(D, 'observations.json')))}
psi = list(csv.DictReader(open(os.path.join(R, 'data/raw/tables/PSI-25_Experimental_table_BASS-II.csv'), errors='ignore', encoding='utf-8-sig')))
def f(x):
    try: return float(str(x).strip())
    except Exception: return None
def cls(m):
    m = m.lower()
    if 'nomex' in m: return 'nomex'
    if 'sibal' in m: return 'sibal'
    if 'wax' in m or 'candle' in m: return 'wax'
    if 'spher' in m: return 'sphere'
    if 'rod' in m: return 'rod'
    t = re.search(r'(\d+(?:\.\d+)?)\s*(mm|micron)', m)
    if t:
        mm = float(t.group(1)) / (1000 if t.group(2) == 'micron' else 1)
        return 'film' if mm <= 0.45 else 'slab'
    return 'film' if 'film' in m else 'other'
LBL = {'film': 'PMMA film, 0.1–0.4 mm', 'slab': 'PMMA slab, 1–5 mm', 'rod': 'PMMA rod, 6–13 mm', 'sibal': 'SIBAL cotton-fiberglass fabric', 'nomex': 'Nomex III fabric', 'wax': 'Wax candle', 'sphere': 'PMMA spherical section'}
rows = []; flags = []
for i, r in enumerate(psi):
    t = r['Test #'].strip(); m = r['Fuel Sample Material'].strip(); o = obs.get(t)
    o2i, o2f = f(r['Calibrated  initial O2 % by vol ']), f(r['Calibrated final O2 % by vol'])
    air = re.findall(r'\d+(?:\.\d+)?', r['Air display'] or ''); u0 = float(air[0]) if air else None
    bad = []
    if o2f is not None and (o2f < 10 or o2f > 30): bad.append(f'calibrated final O2 {o2f}% (initial {o2i}%); same value in report App. A, raw post-burn reading missing')
    if bad: flags.append({'test': t, 'line': i + 2, 'issue': '; '.join(bad)})
    rows.append({'test': t, 'material': m, 'cls': cls(m), 'o2': o2i, 'o2_final': o2f, 'air0': u0, 'sustained': LAB.get(t), 'note': NOTE.get(t),
                 'obs': o['obs'] if o else None, 'report_line': o['line'] if o else None, 'psi_line': i + 2})
# brackets: lowest O2 with a sustained flame, highest O2 without one
br = {}
for c in LBL:
    rs = [x for x in rows if x['cls'] == c and x['sustained'] is not None and x['o2'] is not None]
    if not rs: continue
    yes = [x for x in rs if x['sustained'] == 1]; no = [x for x in rs if x['sustained'] == 0]
    lo = min(yes, key=lambda x: x['o2']) if yes else None; hi = max(no, key=lambda x: x['o2']) if no else None
    br[c] = {'label': LBL[c], 'n': len(rs), 'n_burn': len(yes), 'n_out': len(no),
             'lowest_burn': {'o2': lo['o2'], 'test': lo['test']} if lo else None, 'highest_out': {'o2': hi['o2'], 'test': hi['test']} if hi else None}
out = {'source': {'conditions': 'PSI-25 BASS-II experimental table (psi.nasa.gov)', 'outcomes': 'NASA/TM-20210011385 Appendix A (NTRS 20210011385)'},
       'n_tests': len(rows), 'n_labelled': sum(1 for x in rows if x['sustained'] is not None), 'rows': rows, 'brackets': br, 'psi_flags': flags,
       'crosscheck': {'paper': '20150008962', 'tests': ['T9', 'T10', 'T12'], 'agrees': all(LAB[t] == 0 for t in ('T9', 'T10', 'T12'))}}
json.dump(out, open(os.path.join(R, 'web/public/data/bass2.json'), 'w'), ensure_ascii=False)
with open(os.path.join(R, 'web/public/data/bass2_outcomes.csv'), 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['test', 'material', 'class', 'o2_initial_pct', 'o2_final_pct', 'air_first_cm_s', 'sustained', 'note', 'observation_NASA_TM-20210011385', 'psi_csv_line'])
    for x in rows: w.writerow([x['test'], x['material'], x['cls'], x['o2'], x['o2_final'], x['air0'], x['sustained'], x['note'] or '', x['obs'] or '', x['psi_line']])
print('tests', out['n_tests'], 'labelled', out['n_labelled'], 'flags', len(flags)); print(json.dumps(br, indent=0, ensure_ascii=False)[:1800]); print(flags)
