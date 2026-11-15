#!/usr/bin/env python3
"""Verified literature measurements -> web/public/data/literature.json (unique records, compact)."""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..'); D = os.path.join(ROOT, 'data', 'literature')
m = json.load(open(os.path.join(D, 'measurements.json')))
recs = [r for r in m['kept'] if not r.get('duplicate_of')]
K = ['paper', 'investigation', 'platform', 'gravity_g', 'material', 'thickness_mm', 'geometry', 'flow_mode', 'flow_cm_s', 'o2_pct', 'pressure_kpa', 'quantity', 'value', 'unit', 'outcome', 'basis', 'quote']
papers = {}
for r in recs:
    s = r.get('source') or {}; papers.setdefault(r['paper'], {'title': s.get('title'), 'year': s.get('year'), 'url': s.get('url'), 'authors': (s.get('authors') or [])[:4]})
out = {'generated_from': 'NASA NTRS open-access reports and PSI-attached documents; every quote machine-verified against the paper text',
       'n_kept': m['n_kept'], 'n_rejected': m['n_rejected'], 'n_unique': len(recs), 'papers': papers, 'records': [{k: r.get(k) for k in K} for r in recs]}
json.dump(out, open(os.path.join(ROOT, 'web', 'public', 'data', 'literature.json'), 'w'), separators=(',', ':'))
print(len(recs), 'records from', len(papers), 'papers')
