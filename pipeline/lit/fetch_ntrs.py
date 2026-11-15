#!/usr/bin/env python3
"""Fetch open-access NASA Technical Reports Server (NTRS) papers on microgravity / spacecraft fire safety
and convert them to text. Output: data/literature/{pdf,txt}/<ntrs-id>.*, data/literature/catalog.json"""
import json, os, subprocess, time, urllib.parse, urllib.request
ROOT = os.path.join(os.path.dirname(__file__), '..', '..'); D = os.path.join(ROOT, 'data', 'literature')
QUERIES = ["Saffire flame spread", "Spacecraft Fire Experiment flammability", "Burning and Suppression of Solids BASS", "BASS-II flame spread",
  "microgravity flame spread PMMA oxygen", "microgravity flame spread thin fuel opposed flow", "concurrent flame spread microgravity",
  "flammability limit microgravity flow velocity oxygen", "limiting oxygen concentration microgravity solid", "ACME burning rate emulator",
  "exploration atmosphere flammability elevated oxygen reduced pressure", "NASA-STD-6001 upward flame propagation microgravity",
  "spacecraft fire safety material flammability", "SoFIE solid fuel ignition extinction", "microgravity smoldering", "FLEX droplet extinction",
  "Mir fire oxygen candle", "microgravity smoke detection SAME", "cool flame droplet microgravity", "low pressure flammability oxygen enriched"]
UA = {'User-Agent': 'flame-in-freefall-research/1.0'}
def get(url, timeout=60):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()
catalog = {}
for q in QUERIES:
    try: res = json.loads(get('https://ntrs.nasa.gov/api/citations/search?' + urllib.parse.urlencode({'q': q, 'page.size': 15})))
    except Exception as e: print('search fail', q, e); continue
    for r in res.get('results', []):
        pdfs = [d['links']['pdf'] for d in r.get('downloads', []) if d.get('links', {}).get('pdf')]
        if not pdfs or str(r['id']) in catalog: continue
        catalog[str(r['id'])] = {'id': str(r['id']), 'title': r.get('title'), 'year': (r.get('publications') or [{}])[0].get('publicationDate', '')[:4] or str(r.get('distributionDate', ''))[:4],
            'authors': [a.get('meta', {}).get('author', {}).get('name') for a in r.get('authorAffiliations', [])][:8], 'pdf': 'https://ntrs.nasa.gov' + pdfs[0],
            'url': f"https://ntrs.nasa.gov/citations/{r['id']}", 'query': q, 'type': r.get('stiType')}
    time.sleep(0.3)
print(len(catalog), 'candidate papers')
ok = 0
for cid, c in catalog.items():
    pdf = os.path.join(D, 'pdf', f'{cid}.pdf'); txt = os.path.join(D, 'txt', f'{cid}.txt')
    try:
        if not os.path.exists(pdf):
            b = get(c['pdf'], 120)
            if len(b) > 40e6 or not b.startswith(b'%PDF'): c['skip'] = 'not pdf or too large'; continue
            open(pdf, 'wb').write(b)
        if not os.path.exists(txt): subprocess.run(['pdftotext', '-layout', pdf, txt], check=True, timeout=120)
        c['chars'] = os.path.getsize(txt); ok += 1
    except Exception as e: c['skip'] = str(e)[:120]
json.dump(catalog, open(os.path.join(D, 'catalog.json'), 'w'), indent=1)
print(ok, 'papers with text')
