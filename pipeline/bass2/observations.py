"""Pull each test's observation text (rightmost column of Appendix A) and its O2/CO2 readings from the report rows."""
import re, json, os
D = os.path.dirname(__file__)
rows = json.load(open(os.path.join(D, 'rows_raw.json')))
NUM6 = re.compile(r'(\d{1,2}\.\d{1,2})\s+(\d{1,2}\.\d{1,2})\s+(\d{1,2}\.\d{1,2})\s+(\d{1,2}\.\d{1,2})\s+(\d?\.\d+|---|NA)\s+(\d?\.\d+|---|NA)\s+(\d+|---|NA)\s+(\d+|---|NA)\s{2,}')
out = []
def num(x):
    try: return float(x)
    except Exception: return None
for r in rows:
    rec = {k: r[k] for k in ('table', 'as_run', 'test', 'sample', 'line')}
    starts = [m.start() for l in r['lines'] for m in [re.search(r'[A-Za-z(]{2,}', l[700:])] if m]
    col = 700 + min(starts) if starts else None
    rec['obs'] = re.sub(r'\s+', ' ', ' '.join(l[col - 1:].strip() for l in r['lines'] if len(l) > col - 1)).strip() if col else None
    # O2 readings: the four O2 values sit just left of CO2 (values < 1) in the first line
    nums = re.findall(r'(?<=\s)(\d{1,2}\.\d{1,2}|-{3,}|none)(?=\s)', r['lines'][0][560:col or None])
    o2 = [num(x) for x in nums[:4]]
    rec.update(o2_cal_i=o2[0] if o2 else None, o2_cal_f=o2[1] if len(o2) > 1 else None)
    out.append(rec)
ok = sum(1 for o in out if o['obs']); print('with obs', ok, 'of', len(out))
json.dump(out, open(os.path.join(D, 'observations.json'), 'w'), indent=1, ensure_ascii=False)
for o in out[:6] + [x for x in out if not x['obs']][:5]: print(o['test'], o.get('o2_cal_i'), o.get('o2_cal_f'), '|', (o['obs'] or 'NONE')[:200])
