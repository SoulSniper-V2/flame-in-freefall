"""P(sustained flame | O2, material) from BASS-II ISS tests: logistic regression with a shared O2 slope and a per-material
offset (O2 centred at 18% and scaled x3 so the slope is lightly penalised; L2, C=3), 1,000 test-level bootstrap resamples for intervals. Reports O2 at 50% burn probability (O2_50) per material."""
import json, os, numpy as np
from sklearn.linear_model import LogisticRegression
R = os.path.join(os.path.dirname(__file__), '..', '..'); P = os.path.join(R, 'web/public/data/bass2.json')
B = json.load(open(P))
CL = ['film', 'slab', 'rod', 'sibal', 'nomex']
rs = [x for x in B['rows'] if x['sustained'] is not None and x['o2'] and x['cls'] in CL]
X0 = np.array([[(x['o2'] - 18.0) * 3.0] + [1.0 if x['cls'] == c else 0.0 for c in CL] for x in rs]); y = np.array([x['sustained'] for x in rs])
def fit(X, y):
    m = LogisticRegression(C=3.0, fit_intercept=False, max_iter=5000); m.fit(X, y); w = m.coef_[0]; return w
def o50(w): return {c: float(18.0 - w[1 + k] / (w[0] * 3.0)) for k, c in enumerate(CL)}
w = fit(X0, y); base = o50(w)
rng = np.random.default_rng(0); bs = {c: [] for c in CL}
for _ in range(1000):
    idx = rng.integers(0, len(y), len(y))
    if len(set(y[idx])) < 2: continue
    ww = fit(X0[idx], y[idx])
    if ww[0] <= 0: continue
    present = {rs[j]['cls'] for j in idx}  # a class absent from the resample has no data behind its offset
    for c, v in o50(ww).items():
        if c in present: bs[c].append(v)
# leave-one-test-out accuracy and Brier
from sklearn.metrics import brier_score_loss
pr = []
for i in range(len(y)):
    m = np.ones(len(y), bool); m[i] = False; ww = fit(X0[m], y[m]); pr.append(1 / (1 + np.exp(-X0[i] @ ww)))
pr = np.array(pr); base_rate = y.mean()
res = {'n': int(len(y)), 'slope_per_pt': float(w[0] * 3.0), 'loo_brier': float(brier_score_loss(y, pr)), 'baseline_brier': float(brier_score_loss(y, np.full(len(y), base_rate))),
       'loo_acc': float(((pr > 0.5) == y).mean()), 'always_burn_acc': float(max(base_rate, 1 - base_rate)), 'n_out': int((y == 0).sum()),
       'brier_skill': float(1 - brier_score_loss(y, pr) / brier_score_loss(y, np.full(len(y), base_rate))), 'o2_50': {}}
for c in CL:
    v = np.array(bs[c]); n = sum(1 for x in rs if x['cls'] == c)
    res['o2_50'][c] = {'est': round(base[c], 2), 'lo': round(float(np.percentile(v, 5)), 2), 'hi': round(float(np.percentile(v, 95)), 2), 'n': n,
                       'burn': sum(1 for x in rs if x['cls'] == c and x['sustained'] == 1)}
    # a 50% point is only identified when the material both burned and went out; otherwise it comes from the shared slope and the penalty
    res['o2_50'][c]['identified'] = 0 < res['o2_50'][c]['burn'] < n
B['model'] = res; json.dump(B, open(P, 'w'), ensure_ascii=False)
print(json.dumps(res, indent=1))
