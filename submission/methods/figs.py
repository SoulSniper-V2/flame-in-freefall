"""Figures for the technical report. All values are read from the shipped data files."""
import json, os, io, contextlib, runpy
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
R = os.path.join(os.path.dirname(__file__), '..', '..'); O = os.path.join(os.path.dirname(__file__), 'fig')
with contextlib.redirect_stdout(io.StringIO()): F = runpy.run_path(os.path.join(R, 'si/facts.py'))
INK, MUTE, ACC, SIG, OK, BG = '#16150f', '#8a877c', '#2f4fd1', '#c4561f', '#2e7d4f', '#ffffff'
plt.rcParams.update({'font.family': 'Helvetica', 'font.size': 9, 'axes.edgecolor': INK, 'axes.labelcolor': INK, 'xtick.color': INK, 'ytick.color': INK,
                     'axes.spines.top': False, 'axes.spines.right': False, 'figure.dpi': 200, 'pdf.fonttype': 42, 'savefig.bbox': 'tight', 'savefig.facecolor': BG, 'axes.facecolor': BG})
# Fig 1: OMOS dumbbell
om = F['omos']; LBL = {'mylar': 'Mylar film', 'ultem 1000': 'Ultem film', 'nomex ht90-40': 'Nomex fabric', 'pmma': 'PMMA, thick'}
keys = ['mylar', 'ultem 1000', 'nomex ht90-40', 'pmma']
fig, ax = plt.subplots(figsize=(6.4, 2.6))
for i, k in enumerate(keys):
    v = om[k]; y = len(keys) - 1 - i
    ax.plot([v['ug'], v['g1']], [y, y], color=MUTE, lw=1.5, zorder=1)
    ax.scatter([v['g1']], [y], s=46, facecolor=BG, edgecolor=INK, lw=1.4, zorder=2, label='1 g limit' if i == 0 else None)
    ax.scatter([v['ug']], [y], s=46, color=ACC, zorder=3, label='0 g limit' if i == 0 else None)
    ax.text(max(v['g1'], v['ug']) + 0.5, y, f"{v['omos']:+.2f}", va='center', color=SIG if v['omos'] < -0.5 else INK, fontsize=9)
ax.set_yticks(range(len(keys))); ax.set_yticklabels([LBL[k] for k in reversed(keys)])
ax.set_xlabel(r'Limiting oxygen concentration (% $\mathregular{O_2}$)'); ax.set_xlim(12, 29)
ax.axvline(F['solid_max'], color=SIG, ls=':', lw=1); ax.text(F['solid_max'] + 0.15, 3.35, 'PSI ISS solid tables stop', color=SIG, fontsize=7.5)
ax.legend(frameon=False, loc='lower right', fontsize=8); fig.savefig(f'{O}/f1-omos.pdf'); plt.close(fig)
# Fig 2: evidence envelope
PSIA = 14.696; cond = F['cond']; SOLID = F['SOLID']
fig, ax = plt.subplots(figsize=(6.4, 3.4))
pts = [p for p in cond if p.get('o2') is not None and p.get('p_atm')]
ns = [p for p in pts if p['acc'] not in SOLID]; so = [p for p in cond if p.get('o2') is not None and p['acc'] in SOLID]
ax.scatter([p['o2'] * 100 for p in ns], [p['p_atm'] * PSIA for p in ns], s=7, color=MUTE, alpha=.55, lw=0, label='Droplet and gas flames')
ax.scatter([p['o2'] * 100 for p in so], [p['p_atm'] * PSIA if p.get('p_atm') else 1.5 for p in so], s=60, marker='|', color=ACC, lw=1.4, zorder=4, label='Solid materials, ISS (%d; pressure untabulated plotted at bottom)' % len(so))
ax.add_patch(plt.Rectangle((26, 7), 14, 3.6, fill=False, ls='--', ec=SIG, lw=1))
ax.text(26.3, 5.6, 'exploration band: 26–40%, 7–10.6 psia', color=SIG, fontsize=7.5)
for h, H in F['meta']['habitats'].items():
    if h in ('iss', 'mars'): continue
    ax.scatter([H['o2'] * 100], [H['p_atm'] * PSIA], marker='x', s=40, color=INK, lw=1.4)
    ax.annotate('Lunar and Mars base' if h == 'lunar' else H['label'], (H['o2'] * 100, H['p_atm'] * PSIA), xytext=(5, 4), textcoords='offset points', fontsize=7.5)
ax.set_xlabel('Oxygen (% by volume)'); ax.set_ylabel('Pressure (psia)'); ax.set_xlim(10, 50); ax.set_ylim(0, 25)
ax.legend(frameon=False, fontsize=8, loc='upper right'); fig.savefig(f'{O}/f2-envelope.pdf'); plt.close(fig)
# Fig 3: negative result (physics transfer)
ph = json.load(open(os.path.join(R, 'ml/physics_spread.json')))['regimes']['1g']['rows']
fig, ax = plt.subplots(figsize=(4.2, 3.2)); C = {'N2': INK, 'He': SIG, 'Ar': ACC, 'CO2': OK}
for d in C:
    r = [x for x in ph if x['dil'] == d]
    ax.scatter([x['meas'] for x in r], [x['pred'] for x in r], s=22, color=C[d], label=d + (' (fit)' if d == 'N2' else ' (held out)'))
ax.plot([0, 9], [0, 9], color=MUTE, lw=1, ls='--'); ax.set_xlabel('Measured spread rate (cm/s)'); ax.set_ylabel('Predicted (cm/s)')
ax.legend(frameon=False, fontsize=7.5); fig.savefig(f'{O}/f3-physics.pdf'); plt.close(fig)
print('ok')
# Fig 4: BASS-II restored outcomes and burn model
b2 = json.load(open(os.path.join(R, 'web/public/data/bass2.json')))
ORD = [('rod', 'PMMA rod'), ('sibal', 'SIBAL fabric'), ('film', 'PMMA film'), ('slab', 'PMMA slab'), ('nomex', 'Nomex III')]
fig, ax = plt.subplots(figsize=(6.4, 3.0))
for i, (k, lab) in enumerate(ORD):
    y = len(ORD) - 1 - i; q = b2['model']['o2_50'][k]
    if q.get('identified'):
        ax.add_patch(plt.Rectangle((q['lo'], y - 0.32), q['hi'] - q['lo'], 0.64, color=ACC, alpha=0.12, lw=0))
        ax.plot([q['est']] * 2, [y - 0.34, y + 0.34], color=ACC, lw=1.6)
    for r in b2['rows']:
        if r['cls'] != k or r['sustained'] is None or r['o2'] is None: continue
        jit = (sum(map(ord, r['test'])) % 17 - 8) / 30
        ax.scatter([r['o2']], [y + jit], s=14, facecolor=INK if r['sustained'] else BG, edgecolor=INK if r['sustained'] else SIG, lw=1, zorder=3)
ax.scatter([16], [len(ORD) - 1 + 0.42], marker='D', s=22, color=SIG, zorder=4); ax.text(16.15, len(ORD) - 1 + 0.36, '1-g blowoff 16%', color=SIG, fontsize=7)
ax.set_yticks(range(len(ORD))); ax.set_yticklabels([l for _, l in reversed(ORD)]); ax.set_xlim(12.5, 23); ax.set_ylim(-0.6, len(ORD) - 0.3)
ax.set_xlabel(r'Initial oxygen (% $\mathregular{O_2}$), ISS BASS-II tests')
fig.savefig(f'{O}/f4-bass2.pdf'); plt.close(fig)
print('f4 ok')
