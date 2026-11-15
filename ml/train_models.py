#!/usr/bin/env python3
"""Train flammability surrogates on MEASURED outcomes in NASA PSI experimental tables.

Models (all microgravity, ISS):
  1. flex_k    : Gaussian-process regression of FLEX droplet burning-rate constant K (mm^2/s)
                 from O2 mole fraction, pressure, CO2 and He diluent fractions, fuel, initial droplet diameter.
  2. flex_ext  : deep-ensemble MLP classifier: P(flame extinguishes before the droplet burns out)
                 (FLEX 'Test end' = Extinction vs Completion; 'Disruption' runs excluded as censored).
  3. cfig_ign  : deep-ensemble MLP classifier: P(hot ignition) of ACME CFI-G spherical diffusion flames
                 from O2 mole fraction, pressure, fuel carbon number, normal/inverse configuration, fuel fraction.
Validation: grouped K-fold by test day (no same-day leakage). Exports plain-JSON weights for the browser.
"""
import json, os, re, numpy as np, pandas as pd
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel, ConstantKernel as C
from sklearn.neural_network import MLPClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import r2_score, mean_absolute_error, roc_auc_score, brier_score_loss, accuracy_score
ROOT = os.path.join(os.path.dirname(__file__), '..'); T = os.path.join(ROOT, 'data/raw/tables')
OUT = os.path.join(ROOT, 'web/public/models'); os.makedirs(OUT, exist_ok=True); os.makedirs(os.path.join(ROOT, 'web/tests'), exist_ok=True)
rng = np.random.default_rng(7); np.random.seed(7)
num = lambda s: pd.to_numeric(s, errors='coerce')
report = {}
cv_out = {}  # held-out predictions for parity plots in the browser
REF = {}     # reference predictions of the exported models (browser parity tests)

def ece(y, p, bins=10):
    e = 0; idx = np.minimum((p * bins).astype(int), bins - 1)
    for b in range(bins):
        m = idx == b
        if m.any(): e += m.mean() * abs(y[m].mean() - p[m].mean())
    return float(e)

def reliability(y, p, bins=5):
    out = []; idx = np.minimum((p * bins).astype(int), bins - 1)
    for b in range(bins):
        m = idx == b
        if m.sum(): out.append({"bin": [b / bins, (b + 1) / bins], "n": int(m.sum()), "pred": float(p[m].mean()), "obs": float(y[m].mean())})
    return out

# ---------------- FLEX ----------------
f = pd.read_csv(os.path.join(T, 'PSI-69_Experimental_table_FLEX.csv'), encoding='latin1')
f['P_atm'] = num(f['Ambient pressure; mmHg']) / 760
f['xO2'] = num(f['O initial ambient composition; mole fraction']); f['xCO2'] = num(f['CO initial ambient composition; mole fraction'])
f['xHe'] = num(f['He initial ambient composition; mole fraction']); f['D0'] = num(f['Droplet initial diameter; mm'])
f['K'] = num(f['Burning rate; mm']); f['heptane'] = (f['Fuel'].str.strip() == 'Heptane').astype(float)
f['day'] = f['Test Date'].astype(str)
f = f[(f.P_atm > 0.2) & f.D0.notna() & f.xO2.notna()]
FEAT_F = ['xO2', 'P_atm', 'xCO2', 'xHe', 'heptane', 'D0']

def gp_fit(X, y):
    k = C(1.0, (1e-2, 1e2)) * RBF(length_scale=np.ones(X.shape[1]), length_scale_bounds=(1e-2, 1e3)) + WhiteKernel(0.1, (1e-4, 1))
    return GaussianProcessRegressor(kernel=k, normalize_y=False, n_restarts_optimizer=3, random_state=0).fit(X, y)

fk = f[f.K.notna()].copy(); X = fk[FEAT_F].values; y = fk.K.values; groups = fk.day.values
mu, sd = X.mean(0), X.std(0) + 1e-9; ym, ys = y.mean(), y.std()
gkf = GroupKFold(n_splits=5); pred = np.zeros_like(y); psd = np.zeros_like(y)
for tr, te in gkf.split(X, y, groups):
    m, s = X[tr].mean(0), X[tr].std(0) + 1e-9; a, b = y[tr].mean(), y[tr].std()
    g = gp_fit((X[tr] - m) / s, (y[tr] - a) / b); p, q = g.predict((X[te] - m) / s, return_std=True)
    pred[te] = p * b + a; psd[te] = q * b
cv_out['flex_k'] = [{"x": [round(float(v), 4) for v in X[i]], "y": float(y[i]), "pred": round(float(pred[i]), 4), "sd": round(float(psd[i]), 4), "day": str(groups[i])} for i in range(len(y))]
base = np.full_like(y, y.mean())
cov = float(np.mean(np.abs(y - pred) <= 1.96 * psd))
report['flex_k'] = {"n": int(len(y)), "target": "FLEX droplet burning-rate constant K (mm^2/s; PSI column 'Burning rate; mm')",
  "cv": "5-fold GroupKFold by test date", "r2": float(r2_score(y, pred)), "mae": float(mean_absolute_error(y, pred)), "rmse": float(np.sqrt(np.mean((y - pred) ** 2))),
  "baseline_mae": float(mean_absolute_error(y, base)), "coverage95": cov, "y_range": [float(y.min()), float(y.max())]}
# out-of-distribution benchmark: does the model hold up where the data thin out (Moon-base-like air)?
def ood(mask_test, label):
    tr, te = np.where(~mask_test)[0], np.where(mask_test)[0]
    m, s = X[tr].mean(0), X[tr].std(0) + 1e-9; a, b = y[tr].mean(), y[tr].std()
    g2 = gp_fit((X[tr] - m) / s, (y[tr] - a) / b); p2, q2 = g2.predict((X[te] - m) / s, return_std=True); p2 = p2 * b + a; q2 = q2 * b
    return {"split": label, "n_test": int(len(te)), "mae": float(mean_absolute_error(y[te], p2)), "naive_mae": float(mean_absolute_error(y[te], np.full(len(te), y[tr].mean()))), "coverage95": float(np.mean(np.abs(y[te] - p2) <= 1.96 * q2))}
report['flex_k']['ood'] = [ood(fk.xO2.values > 0.25, 'train on O2 <= 25%, test on O2 > 25%'), ood(fk.P_atm.values < 0.9, 'train on >= 0.9 atm, test on lower pressure'), ood(fk.xHe.values > 0, 'train without helium, test on helium mixtures')]
g = gp_fit((X - mu) / sd, (y - ym) / ys)
kp = g.kernel_.get_params(); amp = float(kp['k1__k1__constant_value']); ls = kp['k1__k2__length_scale'].tolist(); noise = float(kp['k2__noise_level'])
Xn = (X - mu) / sd; L = np.linalg.cholesky(g.kernel_(Xn) + 1e-8 * np.eye(len(Xn)))
json.dump({"type": "gp", "features": FEAT_F, "mu": mu.tolist(), "sd": sd.tolist(), "ym": ym, "ys": ys, "amp": amp, "ls": ls, "noise": noise,
  "X": np.round(Xn, 5).tolist(), "alpha": np.round(g.alpha_, 7).tolist(), "L": [np.round(L[i, :i + 1], 7).tolist() for i in range(len(Xn))],
  "train_ranges": {k: [float(fk[k].min()), float(fk[k].max())] for k in FEAT_F}, "metrics": report['flex_k']}, open(os.path.join(OUT, 'flex_k_gp.json'), 'w'))
report['flex_k']['kernel'] = str(g.kernel_)
REF_X = [[0.21, 1.0, 0, 0, 1, 3.0], [0.30, 0.694, 0, 0, 1, 3.0], [0.34, 0.558, 0, 0, 0, 2.0], [0.15, 2.0, 0.2, 0, 1, 4.0]]
pm, ps_ = g.predict((np.array(REF_X) - mu) / sd, return_std=True)
REF['flex_k'] = [{"x": x, "mean": float(a * ys + ym), "sd": float(b * ys)} for x, a, b in zip(REF_X, pm, ps_)]

# -------- deep ensemble classifier helper --------
def ens_fit(X, y, members=8, hidden=(16, 16), alpha=3e-2):
    nets = []
    for i in range(members):
        idx = rng.integers(0, len(X), len(X))
        while len(np.unique(y[idx])) < 2: idx = rng.integers(0, len(X), len(X))
        nets.append(MLPClassifier(hidden_layer_sizes=hidden, alpha=alpha, max_iter=3000, random_state=i, learning_rate_init=3e-3).fit(X[idx], y[idx]))
    return nets
def ens_pred(nets, X):
    P = np.stack([n.predict_proba(X)[:, 1] for n in nets]); return P.mean(0), P.std(0)
def ens_export(nets): return [{"W": [w.tolist() for w in n.coefs_], "b": [b.tolist() for b in n.intercepts_]} for n in nets]
def rf_fit(X, y): return RandomForestClassifier(150, min_samples_leaf=8, random_state=0).fit(X, y)
def rf_export(m):
    out = []
    for est in m.estimators_:
        t = est.tree_; v = t.value[:, 0, :]; pr = (v[:, 1] / v.sum(1)).round(4)
        out.append({"f": t.feature.tolist(), "t": [round(float(x), 5) for x in t.threshold], "l": t.children_left.tolist(), "r": t.children_right.tolist(), "p": pr.tolist()})
    return out
def cls_eval(name, X, y, groups, feats, target, extra, kind='mlp'):
    gkf = GroupKFold(n_splits=5); p = np.zeros(len(y)); pl = np.zeros(len(y))
    for tr, te in gkf.split(X, y, groups):
        m, s = X[tr].mean(0), X[tr].std(0) + 1e-9
        if kind == 'rf': p[te] = rf_fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
        else: nets = ens_fit((X[tr] - m) / s, y[tr]); p[te] = ens_pred(nets, (X[te] - m) / s)[0]
        lr = LogisticRegression(max_iter=2000).fit((X[tr] - m) / s, y[tr]); pl[te] = lr.predict_proba((X[te] - m) / s)[:, 1]
    r = {"n": int(len(y)), "positives": int(y.sum()), "target": target, "cv": "5-fold GroupKFold by test day",
         "auc": float(roc_auc_score(y, p)), "brier": float(brier_score_loss(y, p)), "accuracy": float(accuracy_score(y, p > 0.5)), "ece": ece(y, p),
         "baseline_brier": float(brier_score_loss(y, np.full(len(y), y.mean()))), "logreg_auc": float(roc_auc_score(y, pl)), "logreg_brier": float(brier_score_loss(y, pl)),
         "reliability": reliability(y, p), **extra}
    cv_out[name] = [{"x": [round(float(v), 4) for v in X[i]], "y": int(y[i]), "p": round(float(p[i]), 4), "pl": round(float(pl[i]), 4)} for i in range(len(y))]
    mu, sd = X.mean(0), X.std(0) + 1e-9
    if kind == 'rf':
        rf = rf_fit(X, y); r["model"] = "Random forest, 150 trees, min 8 samples per leaf (chosen from logistic, polynomial logistic, MLP, gradient boosting and random forest by grouped-CV Brier score)"
        REF[name] = [{"x": X[i].tolist(), "p": float(rf.predict_proba(X[i:i + 1])[0, 1])} for i in (0, len(X) // 2, len(X) - 1)]
        json.dump({"type": "rf", "features": feats, "mu": mu.tolist(), "sd": sd.tolist(), "trees": rf_export(rf), "train": np.round((X - mu) / sd, 4).tolist(), "metrics": r}, open(os.path.join(OUT, f'{name}.json'), 'w'), separators=(',', ':'))
    else:
        nets = ens_fit((X - mu) / sd, y); r["model"] = "Deep ensemble: 8 bootstrap MLPs (16-16 ReLU)"
        REF[name] = [{"x": X[i].tolist(), "p": float(ens_pred(nets, ((X[i:i + 1] - mu) / sd))[0][0])} for i in (0, len(X) // 2, len(X) - 1)]
        json.dump({"type": "mlp_ensemble", "features": feats, "mu": mu.tolist(), "sd": sd.tolist(), "nets": ens_export(nets),
               "train": np.round((X - mu) / sd, 4).tolist(), "metrics": r}, open(os.path.join(OUT, f'{name}.json'), 'w'))
    report[name] = r

fe = f[f['Test end'].isin(['Extinction', 'Completion'])].copy()
cls_eval('flex_ext', fe[FEAT_F].values.astype(float), (fe['Test end'] == 'Extinction').astype(int).values, fe.day.values, FEAT_F,
         "P(flame extinguishes before droplet burnout) — FLEX 'Test end' Extinction vs Completion", {"excluded_disruption": int((f['Test end'] == 'Disruption').sum())})

# ---------------- CFI-G ----------------
gi = pd.read_csv(os.path.join(T, 'PSI-159_Experimental_table_CFI-G_Inverse_Flames.csv'), encoding='latin1')
gn = pd.read_csv(os.path.join(T, 'PSI-159_Experimental_table_CFI-G_Normal_Flames.csv'), encoding='latin1')
gi = gi.assign(xO2=num(gi['XO2']), P_atm=num(gi['approx p (bar)']) / 1.01325, inverse=1.0, xf=num(gi['Xf  before test']), mdot=num(gi['HC burnrate (mg/s)']), Tad=num(gi['Tad (K)']), Zst=num(gi['Zst']))
gn = gn.assign(xO2=num(gn[' XO2 before test']), P_atm=num(gn['approx p (bar)']) / 1.01325, inverse=0.0, xf=num(gn['Xf']), mdot=num(gn['mHC (mg/s)']), Tad=num(gn['Tad (K)']), Zst=num(gn['Zst']))
g = pd.concat([gi, gn], ignore_index=True)
cn = {'ethane': 2, 'propane': 3, 'butane': 4}
g['carbon'] = g['Fuel'].fillna('').astype(str).str.lower().map(lambda s: next((v for k, v in cn.items() if k in s), np.nan))
g['ign'] = g['Hot ignition'].fillna('').astype(str).str.strip().str.lower().map({'yes': 1, 'flash': 1, 'no': 0})
g['day'] = g['Flame Type'].astype(str).str.lower() + '-' + g['Day'].astype(str)
FEAT_G = ['xO2', 'P_atm', 'inverse', 'xf', 'mdot', 'Tad', 'Zst']  # Tad, Zst: PSI-tabulated physics features (adiabatic flame temp., stoichiometric mixture fraction)
g = g[g.ign.notna()].dropna(subset=FEAT_G)
cls_eval('cfig_ign', g[FEAT_G].values.astype(float), g.ign.astype(int).values, g.day.values, FEAT_G,
         "P(hot ignition) of ACME CFI-G spherical diffusion flames (Yes/flash vs No)", {"ranges": {k: [float(g[k].min()), float(g[k].max())] for k in FEAT_G}}, kind='rf')
report['flex_ext']['ranges'] = {k: [float(fe[k].min()), float(fe[k].max())] for k in FEAT_F}
json.dump(report, open(os.path.join(OUT, 'metrics.json'), 'w'), indent=1)
json.dump(cv_out, open(os.path.join(OUT, 'cv.json'), 'w'), separators=(',', ':'))
json.dump(REF, open(os.path.join(ROOT, 'web/tests/reference.json'), 'w'), indent=1)
json.dump(report, open(os.path.join(ROOT, 'ml/metrics.json'), 'w'), indent=1)
for k, v in report.items(): print(k, {a: (round(b, 3) if isinstance(b, float) else b) for a, b in v.items() if a not in ('reliability', 'ranges', 'kernel')})
print(report['flex_k']['kernel'])
