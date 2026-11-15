"""Physics model for thin-solid flame spread vs oxygen and diluent (de Ris 1969 thin-fuel theory plus a
critical flame temperature), fitted on nitrogen data only and tested on four other diluents.

Data: Olson, Stouffer & Grady via Friedman, NASA/TM-1999-209285 (NTRS 19990063738), Table 2: thin cellulose
sheet spread rate (cm/s) and flammability limit (% O2) in N2, He, Ar, CO2 and SF6 mixtures, at 1 g and in
quiescent microgravity. Values below are transcribed from that table and match web/public/data/literature.json.

Model: V = C * lam(Tm) * (Tf - T*) / (Tv - Tinf), Tm = (Tf + Tv) / 2
  Tf  = adiabatic stoichiometric flame temperature of cellulose in the O2/diluent mixture (Cantera, equilibrium,
        NASA thermo; SF6 held inert)
  lam = mixture thermal conductivity of the oxidizer (Wassiljewa / Mason-Saxena)
  T*  = critical flame temperature below which the flame cannot spread (sets the flammability limit)
de Ris has T* = Tv; letting T* float is the standard extinction extension. C and T* are fitted on N2 alone.
"""
import json, math, os
import numpy as np, cantera as ct
from scipy.optimize import least_squares

R = os.path.join(os.path.dirname(__file__), '..')
T0, TV = 298.15, 618.0          # ambient, cellulose pyrolysis temperature (K)
DH_CELL = -963.0e3              # J/mol, cellulose C6H10O5 unit, standard enthalpy of formation (solid)

SPREAD = {  # (gravity, diluent): {O2 %: cm/s}
    ('1g', 'N2'): {20: .9, 25: 1.3, 30: 1.7, 35: 2.2, 40: 3.0}, ('1g', 'He'): {20: 1.8, 25: 2.7, 30: 3.5, 35: 4.3, 40: 5.0},
    ('1g', 'Ar'): {20: 1.9, 25: 3.0, 30: 4.1}, ('1g', 'CO2'): {25: .5, 30: 1.2, 35: 1.7, 40: 1.9, 45: 2.3}, ('1g', 'SF6'): {40: .45, 45: .95},
    ('ug', 'N2'): {20: .6, 25: .9, 30: 1.1, 35: 1.4, 40: 2.0}, ('ug', 'He'): {25: 1.7, 30: 2.1, 35: 2.4, 40: 2.5},
    ('ug', 'Ar'): {20: 1.3, 25: 2.0, 30: 2.6}, ('ug', 'CO2'): {25: .75, 30: 1.3, 35: 1.7, 40: 1.9, 45: 2.0}, ('ug', 'SF6'): {30: .35, 35: .6, 40: 1.0, 45: 1.5},
}
LIMIT = {'1g': {'N2': 16, 'He': 16.5, 'Ar': 11.5, 'CO2': 24, 'SF6': 38}, 'ug': {'N2': 17, 'He': 21, 'Ar': 13, 'CO2': 21, 'SF6': 29}}
DIL = ['N2', 'He', 'Ar', 'CO2', 'SF6']

# --- flame temperature -------------------------------------------------------------------------------------
_all = {s.name: s for s in ct.Species.list_from_file('nasa_gas.yaml')}
SPEC = ['O2', 'N2', 'He', 'Ar', 'CO2', 'H2O', 'CO', 'H2', 'OH', 'H', 'O', 'NO', 'SF6']
GAS = ct.Solution(thermo='ideal-gas', species=[_all[n] for n in SPEC])

def h_mol(sp, T=T0):
    GAS.TPX = T, ct.one_atm, {sp: 1}; return GAS.enthalpy_mole / 1000  # J/mol

def t_flame(x_o2, dil, p_atm=1.0):
    """Stoichiometric C6H10O5 + 6 O2 (+ diluent carried with the O2) -> equilibrium products, adiabatic."""
    n_dil = 6 * (1 - x_o2) / x_o2
    H_J = DH_CELL + 6 * h_mol('O2') + n_dil * h_mol(dil)            # J, for 1 mol cellulose
    X = {'CO2': 6.0, 'H2O': 5.0, dil: n_dil}
    GAS.TPX = 2000, p_atm * ct.one_atm, X
    mass_kg = (6 * 44.0095 + 5 * 18.0153 + n_dil * GAS.molecular_weights[GAS.species_index(dil)]) / 1000
    GAS.HP = H_J / mass_kg, p_atm * ct.one_atm
    GAS.equilibrate('HP')
    return GAS.T

# --- oxidizer thermal conductivity (W/m/K) -----------------------------------------------------------------
K300 = {'O2': .0266, 'N2': .0259, 'He': .155, 'Ar': .0177, 'CO2': .0166, 'SF6': .0130}
KN = {'O2': .80, 'N2': .76, 'He': .69, 'Ar': .73, 'CO2': 1.05, 'SF6': .95}
MU300 = {'O2': 20.7, 'N2': 17.9, 'He': 19.9, 'Ar': 22.7, 'CO2': 15.0, 'SF6': 15.3}
MW = {'O2': 32.0, 'N2': 28.01, 'He': 4.003, 'Ar': 39.95, 'CO2': 44.01, 'SF6': 146.06}

def lam_mix(x_o2, dil, T):
    xs = {'O2': x_o2, dil: 1 - x_o2}; k = {s: K300[s] * (T / 300) ** KN[s] for s in xs}
    out = 0.0
    for i in xs:
        den = 0.0
        for j in xs:
            phi = (1 + (MU300[i] / MU300[j]) ** .5 * (MW[j] / MW[i]) ** .25) ** 2 / (8 * (1 + MW[i] / MW[j])) ** .5
            den += xs[j] * phi
        out += xs[i] * k[i] / den
    return out

def features(x_o2, dil, p_atm=1.0):
    tf = t_flame(x_o2, dil, p_atm); return tf, lam_mix(x_o2, dil, (tf + TV) / 2)

def predict(theta, x_o2, dil, p_atm=1.0):
    C, Tc = theta; tf, lam = features(x_o2, dil, p_atm)
    return max(0.0, C * lam * (tf - Tc) / (TV - T0))

def limit(theta, dil, p_atm=1.0):
    """O2 fraction where Tf drops to T* (bisection)."""
    lo, hi = 0.05, 0.6
    if t_flame(hi, dil, p_atm) < theta[1]: return None
    for _ in range(40):
        m = (lo + hi) / 2
        if t_flame(m, dil, p_atm) > theta[1]: hi = m
        else: lo = m
    return hi * 100

def fit(g, dils=('N2',)):
    pts = [(o / 100, d, v) for d in dils for o, v in SPREAD[(g, d)].items()]
    feats = [(features(x, d), v) for x, d, v in pts]
    def res(th):  # log error on spread + limit error on N2
        r = [math.log(max(1e-3, th[0] * lam * (tf - th[1]) / (TV - T0))) - math.log(v) for (tf, lam), v in feats]
        return r
    sol = least_squares(res, x0=[30.0, 1500.0], bounds=([1e-3, 600], [1e5, 2600]))
    return sol.x

if __name__ == '__main__':
    out = {'source': 'NASA/TM-1999-209285 Table 2 (NTRS 19990063738), Olson, Stouffer & Grady diluent tests', 'regimes': {}}
    for g in ['1g', 'ug']:
        th = fit(g)
        rows, lims = [], []
        for d in DIL:
            for o, v in SPREAD[(g, d)].items():
                p = predict(th, o / 100, d); rows.append({'dil': d, 'o2': o, 'meas': v, 'pred': round(p, 3), 'train': d == 'N2', 'tf': round(t_flame(o / 100, d))})
            lims.append({'dil': d, 'meas': LIMIT[g][d], 'pred': None if limit(th, d) is None else round(limit(th, d), 1), 'train': False})
        test = [r for r in rows if not r['train']]
        ape = [abs(r['pred'] - r['meas']) / r['meas'] for r in test]
        # baseline: N2 spread curve applied to every diluent (ignores diluent physics)
        n2 = SPREAD[(g, 'N2')]; base = lambda o: float(np.interp(o, sorted(n2), [n2[k] for k in sorted(n2)]))
        bape = [abs(base(r['o2']) - r['meas']) / r['meas'] for r in test]
        rank_ok = None
        out['regimes'][g] = {'C': th[0], 'T_crit': th[1], 'rows': rows, 'limits': lims,
                             'test_mape': float(np.median(ape)), 'baseline_mape': float(np.median(bape)), 'n_test': len(test)}
        print(g, 'C=%.2f T*=%.0f K' % tuple(th), 'median APE test %.0f%% vs N2-curve baseline %.0f%% (n=%d)' % (100 * np.median(ape), 100 * np.median(bape), len(test)))
        for r in rows: print('  ', r)
        for l in lims: print('   limit', l)
    json.dump(out, open(os.path.join(R, 'ml/physics_spread.json'), 'w'), indent=1)
