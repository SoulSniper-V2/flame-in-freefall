#!/usr/bin/env python3
"""Verification firewall for AI-extracted literature measurements.
A record is kept only if (1) its quote occurs in the paper text (whitespace/hyphenation-normalised, or >=92% of a
same-length window by token match), and (2) its numeric value appears in the quote. Output: data/literature/measurements.json"""
import json, os, re, glob, difflib
from collections import Counter
ROOT = os.path.join(os.path.dirname(__file__), '..', '..'); D = os.path.join(ROOT, 'data', 'literature')
norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'-\s*\n\s*', '', s.replace('–', '-').replace('−', '-').replace('ﬁ', 'fi').replace('ﬂ', 'fl'))).strip().lower()
cat = json.load(open(os.path.join(D, 'catalog.json')))
if os.path.exists(os.path.join(D, 'catalog_psi.json')): cat.update(json.load(open(os.path.join(D, 'catalog_psi.json'))))
def nums(s): return {float(x) for x in re.findall(r'(?<![\w.])-?\d+(?:\.\d+)?', s.replace(',', ''))}
kept, rejected = [], []
for fp in sorted(glob.glob(os.path.join(D, 'extracted', '*.json'))):
    pid = os.path.basename(fp)[:-5]; tp = os.path.join(D, 'txt', f'{pid}.txt')
    if not os.path.exists(tp): continue
    text = norm(open(tp, errors='ignore').read()); toks = text.split(' ')
    try: recs = json.load(open(fp))
    except Exception as e: print('bad json', fp, e); continue
    for r in recs:
        q = norm(str(r.get('quote', ''))); why = None
        if len(q) < 15: why = 'quote too short'
        elif q not in text:
            qt = q.split(' '); n = len(qt); best = 0
            anchors = [i for i, t in enumerate(toks) if t == qt[0]][:400] or range(0, max(1, len(toks) - n), max(1, n // 2))
            for i in anchors:
                best = max(best, difflib.SequenceMatcher(None, qt, toks[i:i + n]).ratio())
                if best >= 0.92: break
            if best < 0.92: why = f'quote not found (best {best:.2f})'
        try: v = float(r.get('value'))
        except Exception: why = why or 'value not numeric'; v = None
        if v is not None and not why and not any(abs(v - x) <= 1e-6 * max(1, abs(v)) or abs(abs(v) - abs(x)) < 1e-9 for x in nums(q)): why = 'value not in quote'
        r['paper'] = pid; r['source'] = {k: cat.get(pid, {}).get(k) for k in ('title', 'year', 'url', 'authors')}
        (rejected if why else kept).append({**r, **({'reject': why} if why else {})})
# basis: infer for records extracted before the field existed
for r in kept:
    if not r.get('basis'):
        q = str(r.get('quote', '')).lower(); pl = str(r.get('platform') or '').lower()
        r['basis'] = 'model' if ('model' in pl or 'simulat' in pl) else 'estimate' if re.search(r'estimat|extrapolat|predict|\bwill\s+(not\s+)?be\b', q) else 'measured'
        r['basis_inferred'] = True
# duplicates: the same value for the same quantity/material/conditions reported in several papers (paper + slides, proceedings)
seen = {}
for r in kept:
    k = (str(r.get('material', '')).lower()[:12], r.get('quantity'), round(float(r['value']), 4), r.get('o2_pct'), r.get('flow_cm_s'), r.get('gravity_g'))
    if k in seen and seen[k] != r['paper']: r['duplicate_of'] = seen[k]
    else: seen.setdefault(k, r['paper'])
uniq = [r for r in kept if not r.get('duplicate_of')]
print('unique', len(uniq), 'basis', Counter(r['basis'] for r in uniq))
json.dump({'kept': kept, 'n_kept': len(kept), 'n_rejected': len(rejected)}, open(os.path.join(D, 'measurements.json'), 'w'), indent=1)
json.dump(rejected, open(os.path.join(D, 'rejected.json'), 'w'), indent=1)
print('kept', len(kept), 'rejected', len(rejected)); print(Counter(r['quantity'] for r in kept).most_common(12)); print(Counter(r['reject'].split(' (')[0] for r in rejected))
