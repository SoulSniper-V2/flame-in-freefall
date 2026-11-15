"""Firewall for SI-written interpretations. A sentence ships only if:
  1. it cites at least one fact id that exists for its item;
  2. every number in it appears in the cited facts (same value; % and sign forms tolerated);
  3. it uses none of the overclaim words; it is at most 45 words.
Writes web/public/data/interpretations.json (passing sentences + the cited facts) and si/interp_rejected.json."""
import json, os, re, sys
R = os.path.join(os.path.dirname(__file__), '..')
facts = {'habitats': json.load(open(f'{R}/si/facts/habitats.json')), 'investigations': json.load(open(f'{R}/si/facts/investigations.json'))}
draft = json.load(open(f'{R}/si/interpretations.json'))
BAN = re.compile(r'\b(guarantee\w*|certif\w*|proves?|proven|definitely|always|never|safe to use|revolutionary|unprecedented|first ever|all materials)\b', re.I)
NUM = re.compile(r'(?<![\w.])[-−]?\d+(?:,\d{3})*(?:\.\d+)?')
def nums(s): return [float(x.replace('−', '-').replace(',', '')) for x in NUM.findall(s)]
def ok_num(v, pool): return any(abs(abs(v) - abs(p)) < 1e-9 for p in pool)
out, rej = {'habitats': {}, 'investigations': {}}, []
for kind in ('habitats', 'investigations'):
    for key, item in draft.get(kind, {}).items():
        F = {f['id']: f for f in facts[kind].get(key, {}).get('facts', [])}
        keep = []
        for s in item.get('sentences', []):
            t, cites = s.get('text', '').strip(), s.get('cites', [])
            why = None
            if not cites or any(c not in F for c in cites): why = f'bad citation {cites}'
            elif BAN.search(t): why = f'overclaim word: {BAN.search(t).group(0)}'
            elif len(t.split()) > 45: why = 'too long'
            else:
                pool = [n for c in cites for n in nums(F[c]['text'])]
                bad = [v for v in nums(t) if not ok_num(v, pool)]
                if bad: why = f'numbers not in cited facts: {bad}'
            if why: rej.append({'kind': kind, 'key': key, 'text': t, 'why': why})
            else: keep.append({'text': t, 'cites': [{'id': c, 'text': F[c]['text'], 'src': F[c]['src']} for c in cites]})
        if keep: out[kind][key] = keep
json.dump(out, open(f'{R}/web/public/data/interpretations.json', 'w'), indent=1, ensure_ascii=False)
json.dump(rej, open(f'{R}/si/interp_rejected.json', 'w'), indent=1, ensure_ascii=False)
n = sum(len(v) for k in out for v in out[k].values())
print(f'kept {n} sentences, rejected {len(rej)}')
for r in rej: print(' REJECT', r['kind'], r['key'], '|', r['why'], '|', r['text'][:100])
