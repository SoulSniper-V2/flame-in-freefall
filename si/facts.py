"""Build numbered fact sheets for the SI interpretation layer. Every fact is computed from the shipped data
(web/public/data/*.json) and carries its source. The SI writer may only use these facts; si/verify_interp.py
rejects any sentence whose numbers are not in the cited facts. Output: si/facts/{habitats,investigations}.json"""
import json, os, re, statistics as stx
R = os.path.join(os.path.dirname(__file__), '..'); D = os.path.join(R, 'web/public/data')
inv = json.load(open(f'{D}/investigations.json')); meta = json.load(open(f'{D}/meta.json'))
cond = json.load(open(f'{D}/conditions.json'))['points']; lit = json.load(open(f'{D}/literature.json'))
PSIA = 14.696
by_id = {i['id']: i for i in inv}
SOLID = {i['id'] for i in inv if str(i['phase']).lower().startswith('solid')}
solid_max = max(p['o2'] for p in cond if p['acc'] in SOLID and p.get('o2') is not None) * 100
band = [p for p in cond if p.get('o2') is not None and p['o2'] >= 0.26 and p.get('p_atm') and 7 <= p['p_atm'] * PSIA <= 10.6]
band_solid = sum(1 for p in band if p['acc'] in SOLID)

def o2v(r):
    u = (r.get('unit') or '').lower()
    if not re.search('o2|oxygen', u): return None
    return r['value'] * 100 if r['value'] <= 1 else r['value']
def norm(m): return re.sub(r'\d+(\.\d+)?\s*(mil|mm|cm|micron).*', '', re.sub(r'\(.*?\)', '', (m or '').lower())).replace('cast', '').replace(' rod', '').strip().removesuffix(' g').strip()
LABEL = {'mylar': 'Mylar film', 'ultem 1000': 'Ultem film', 'nomex ht90-40': 'Nomex fabric', 'pmma': 'thick PMMA'}
omos = {}
for k in LABEL:
    papers = {}
    for r in lit['records']:
        if r['quantity'] not in ('flammability_limit', 'extinction_o2') or r['basis'] not in ('measured', 'estimate'): continue
        if r.get('outcome') == 'no ignition' or (r.get('pressure_kpa') or 0) > 150 or r.get('gravity_g') not in (0, 1): continue
        if norm(r.get('material')) != k or o2v(r) is None: continue
        e = papers.setdefault(r['paper'], {'ug': [], 'g1': []}); (e['ug'] if r['gravity_g'] == 0 else e['g1']).append(o2v(r))
    both = [(p, e) for p, e in papers.items() if e['ug'] and e['g1']]
    if both:
        ug = stx.mean(stx.mean(e['ug']) for _, e in both); g1 = stx.mean(stx.mean(e['g1']) for _, e in both)
        omos[k] = {'ug': round(ug, 2), 'g1': round(g1, 2), 'omos': round(ug - g1, 2), 'papers': [p for p, _ in both]}
thin = [v['omos'] for k, v in omos.items() if k != 'pmma']; thin_mean = round(stx.mean(thin), 2); thin_worst = min(thin)

def fact(fid, text, src): return {'id': fid, 'text': text, 'src': src}

hab_out = {}
for h, H in meta['habitats'].items():
    o2 = H['o2'] * 100; ps = H['p_atm'] * PSIA; g = H['g']
    ranked = sorted(inv, key=lambda i: -i["habitats"][h]["score"])[:2]
    meas = [p for p in cond if p.get('o2') is not None and p.get('p_atm') and p.get('status') == 'recorded']
    near = min(meas, key=lambda p: ((p['o2'] - H['o2']) / 0.1) ** 2 + ((p['p_atm'] - H['p_atm']) / 0.3) ** 2)
    partial = [r for r in lit['records'] if r.get('gravity_g') not in (None, 0, 1) and 0 < r['gravity_g'] < 1]
    luci = [r for r in partial if r.get('investigation') == 'LUCI']
    near_lit = [r for r in lit['records'] if r.get('o2_pct') is not None and abs(r['o2_pct'] - o2) <= 4 and r['quantity'] != 'other']
    F = [
        fact('H1', f"Design atmosphere: {o2:.0f}% O2 at {ps:.1f} psia and {g} g.", 'challenge brief / meta.json'),
        fact('H2', f"PSI's ISS solid-material test tables stop at {solid_max:.1f}% O2.", 'conditions.json'),
        fact('H3', f"In the 26-40% O2, 7-10.6 psia exploration band PSI holds {len(band)} conditions, {band_solid} of them solid-material flames.", 'conditions.json'),
        fact('H4', "Top-ranked investigations for this habitat: " + ', '.join("%s (%d/100)" % (i['acronym'], i['habitats'][h]['score']) for i in ranked) + ".", 'investigations.json habitat scores'),
        fact('H5', f"Closest condition measured in orbit: {by_id[near['acc']]['acronym']} at {near['o2']*100:.1f}% O2 and {near['p_atm']*PSIA:.1f} psia.", f"{near['src']['table']} line {near['src']['line']}" if near.get('src') else 'conditions.json'),
        fact('H6', f"Oxygen margin of safety (NASA Eq. 1) for thin materials: mean {thin_mean} points, largest loss {thin_worst} points (Mylar).", 'literature.json, NASA/TM-2008-215260'),
        fact('H7', f"A thin material rated at 1 g between {o2:.1f}% and {o2 - thin_worst:.1f}% O2 passes the 1-g test for this air but could burn in reduced gravity at the largest loss measured.", 'derived from H1 and H6'),
        fact('H8', f"The verified literature holds {len(near_lit)} records within 4 points of {o2:.0f}% O2 and {len(partial)} records at partial gravity, {len(luci)} of them from LUCI at 0.167 g.", 'literature.json'),
        fact('H9', "PSI holds no partial-gravity combustion data.", 'challenge brief'),
    ]
    hab_out[h] = {'label': H['label'], 'facts': F}

inv_out = {}
for i in inv:
    pts = [p for p in cond if p['acc'] == i['id'] and p.get('o2') is not None]
    lr = [r for r in lit['records'] if r.get('investigation') and any(part.strip().lower().removeprefix('acme ').split(' (')[0] in {a.strip().lower().removeprefix('acme ') for a in i['acronym'].split('/')} for part in r['investigation'].split('/'))]
    top = sorted(lr, key=lambda r: (r['basis'] != 'measured', r['quantity'] == 'other'))[:3]
    best_h = max(meta['habitats'], key=lambda h: i['habitats'][h]['score'])
    F = [
        fact('I1', f"{i['acronym']} ({i['id']}): {i['title']}; platform {i['platform']}; {i['startDate']} to {i['endDate']}.", 'PSI record'),
        fact('I2', f"PSI summary: {i['si']['summary']}", 'PSI record (SI extraction, team-reviewed)'),
        fact('I3', f"Fuels: {', '.join(i['si']['fuels']) or 'not stated'}; oxygen: {i['si']['o2']}; pressure: {i['si']['pressure']}; flow: {i['si']['flow']}.", 'PSI record'),
        fact('I4', f"{len(pts)} tabulated conditions with O2" + (f", O2 from {min(p['o2'] for p in pts)*100:.1f}% to {max(p['o2'] for p in pts)*100:.1f}%." if pts else '.'), 'conditions.json'),
        fact('I5', f"Fire-safety index {i['fireSafetyIndex']}/100; prevention {i['categories']['prevention']['score']}/10, detection {i['categories']['detection']['score']}/10, suppression {i['categories']['suppression']['score']}/10, modeling {i['categories']['modeling']['score']}/10.", 'investigations.json'),
        fact('I6', f"Highest habitat score: {meta['habitats'][best_h]['label']} {i['habitats'][best_h]['score']}/100; lunar base {i['habitats']['lunar']['score']}/100.", 'investigations.json'),
        fact('I7', f"{len(lr)} verified literature records name {i['acronym']}.", 'literature.json'),
    ] + [fact('L%d' % (k + 1), "%s %s %s for %s at gravity %s (%s); quote: \"%s\"" % (r['quantity'].replace('_', ' '), r['value'], r.get('unit') or '', r.get('material') or 'unnamed fuel', r.get('gravity_g'), r['basis'], re.sub(r'\s+', ' ', r['quote'])[:220]), 'NTRS ' + r['paper']) for k, r in enumerate(top)] + [
        fact('G1', f"PSI's ISS solid-material test tables stop at {solid_max:.1f}% O2; the challenge's Moon-base air is 30% O2 or more.", 'conditions.json; challenge brief'),
    ]
    inv_out[i['id']] = {'label': i['acronym'], 'facts': F}

os.makedirs(os.path.join(R, 'si/facts'), exist_ok=True)
json.dump(hab_out, open(os.path.join(R, 'si/facts/habitats.json'), 'w'), indent=1, ensure_ascii=False)
json.dump(inv_out, open(os.path.join(R, 'si/facts/investigations.json'), 'w'), indent=1, ensure_ascii=False)
print('habitats', len(hab_out), 'investigations', len(inv_out), 'thin mean', thin_mean, 'solid max', round(solid_max, 1), 'band', len(band), band_solid)
