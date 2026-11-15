import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type DB, PSIA, fmtP } from '@/data'
import { PageHead, Loading } from '@/components/Shell'
import { DitherHeatmap } from '@/components/Dither'
import { Parity, useCV } from '@/components/Parity'
import { useModels, gpPredict, ensPredict, cfigImpute, recommend, inRange, type Models } from '@/ml'
import { cn } from '@/lib/utils'

type Key = 'flex_ext' | 'flex_k' | 'cfig_ign' | 'next'
const TABS: [Key, string][] = [['flex_ext', 'Droplet extinction'], ['flex_k', 'Droplet burning rate'], ['cfig_ign', 'Gas-flame ignition'], ['next', 'Next experiment']]
const COLS = 44, ROWS = 30

interface Ctl { o2: number; psia: number; co2: number; he: number; heptane: number; d0: number; inverse: number; xf: number; mdot: number }
const DEF: Ctl = { o2: 30, psia: 10.2, co2: 0, he: 0, heptane: 1, d0: 3, inverse: 0, xf: 0.2, mdot: 1 }

function predictor(m: Models, key: Key, c: Ctl) {
  if (key === 'flex_k') return (o2: number, p: number) => { const g = gpPredict(m.flex_k, [o2, p, c.co2, c.he, c.heptane, c.d0]); return { v: g.mean, u: g.sd } }
  if (key === 'flex_ext') return (o2: number, p: number) => { const e = ensPredict(m.flex_ext, [o2, p, c.co2, c.he, c.heptane, c.d0]); return { v: e.p, u: e.sd } }
  return (o2: number, p: number) => { const e = ensPredict(m.cfig_ign, cfigImpute(m.cfig_ign, [o2, p, c.inverse, c.xf, c.mdot])); return { v: e.p, u: e.sd } }
}

export default function Lab({ db }: { db: DB }) {
  const [sp, setSp] = useSearchParams(); const key = (sp.get('model') as Key) || 'flex_ext'
  const models = useModels(); const [c, setC] = useState<Ctl>(DEF)
  if (!models) return <Loading what="models" />
  return <>
    <PageHead eyebrow="Model lab" title="Model lab">
      Models trained on outcomes NASA measured, validated with whole test days held out.
    </PageHead>
    <div className="wrap">
      <div className="no-print sticky top-14 z-30 -mx-1 flex gap-1 overflow-x-auto border-b bg-background/90 py-3 backdrop-blur-md">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setSp({ model: k })} className={cn('whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] transition-colors', key === k ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:border-foreground hover:text-foreground')}>{l}</button>)}
      </div>
      {key === 'next' ? <Next db={db} m={models} /> : <ModelView m={models} k={key} c={c} setC={setC} db={db} />}
    </div>
  </>
}

function ModelView({ m, k, c, setC, db }: { m: Models; k: Exclude<Key, 'next'>; c: Ctl; setC: (c: Ctl) => void; db: DB }) {
  const cv = useCV(); const isG = k === 'cfig_ign'; const met = m.metrics[k]
  const X = isG ? [0.1, 0.9] : [0.1, 0.45]; const Y = isG ? [5, 50] : [5, 46] // psia
  const f = useMemo(() => predictor(m, k, c), [m, k, c])
  const grid = useMemo(() => {
    const v = new Float32Array(COLS * ROWS); let lo = Infinity, hi = -Infinity; const raw: number[] = []
    for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { const o2 = X[0] + (q / (COLS - 1)) * (X[1] - X[0]); const ps = Y[1] - (r / (ROWS - 1)) * (Y[1] - Y[0]); const y = f(o2, ps / PSIA).v; raw.push(y); lo = Math.min(lo, y); hi = Math.max(hi, y) }
    raw.forEach((y, i) => { v[i] = k === 'flex_k' ? (y - lo) / (hi - lo || 1) : y })
    return { v, lo, hi }
  }, [f, k])
  const here = f(c.o2 / 100, c.psia / PSIA)
  const model = isG ? m.cfig_ign : m.flex_ext
  const train = (k === 'flex_k' ? m.flex_k.X : model.train).map(r => ({ o2: r[0] * (k === 'flex_k' ? m.flex_k.sd[0] : model.sd[0]) + (k === 'flex_k' ? m.flex_k.mu[0] : model.mu[0]), p: r[1] * (k === 'flex_k' ? m.flex_k.sd[1] : model.sd[1]) + (k === 'flex_k' ? m.flex_k.mu[1] : model.mu[1]) }))
  const ranges = k === 'flex_k' ? m.flex_k.train_ranges : met.ranges
  const out = inRange(ranges, ['xO2', 'P_atm'], [c.o2 / 100, c.psia / PSIA])
  const px = (o2: number) => ((o2 - X[0]) / (X[1] - X[0])) * 100, py = (ps: number) => (1 - (ps - Y[0]) / (Y[1] - Y[0])) * 100
  const H = db.meta.habitats
  const desc = {
    flex_ext: { q: 'Will a burning fuel droplet go out before the fuel is gone?', t: met.target, ink: 'darker = more likely to extinguish' },
    flex_k: { q: 'How fast does a droplet burn?', t: met.target, ink: `darker = faster burning (${grid.lo.toFixed(2)}–${grid.hi.toFixed(2)} mm²/s)` },
    cfig_ign: { q: 'Does a spherical gas flame ignite hot, or only flash?', t: met.target, ink: 'darker = more likely to ignite hot' },
  }[k]
  const set = (p: Partial<Ctl>) => setC({ ...c, ...p })

  return <div className="grid gap-10 py-10 lg:grid-cols-[300px_1fr]">
    <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
      <div><div className="eyebrow mb-3">Question</div><p className="text-[17px] font-medium leading-snug">{desc.q}</p></div>
      <div className="space-y-4">
        <S label="Oxygen" v={c.o2} min={isG ? 12 : 12} max={isG ? 85 : 40} step={0.5} fmt={v => `${v.toFixed(1)}%`} on={v => set({ o2: v })} />
        <S label="Pressure" v={c.psia} min={6} max={45} step={0.1} fmt={v => `${v.toFixed(1)} psia`} on={v => set({ psia: v })} />
        {!isG ? <>
          <S label="CO₂ diluent" v={c.co2} min={0} max={0.6} step={0.01} fmt={v => `${(v * 100).toFixed(0)}%`} on={v => set({ co2: v })} />
          <S label="Helium diluent" v={c.he} min={0} max={0.45} step={0.01} fmt={v => `${(v * 100).toFixed(0)}%`} on={v => set({ he: v })} />
          <S label="Initial droplet diameter" v={c.d0} min={1.1} max={4.6} step={0.1} fmt={v => `${v.toFixed(1)} mm`} on={v => set({ d0: v })} />
          <div><div className="mb-2 text-[13px]">Fuel</div><div className="grid grid-cols-2 gap-1">{[[1, 'Heptane'], [0, 'Methanol']].map(([v, l]) => <button key={l} onClick={() => set({ heptane: v as number })} className={cn('rounded border py-1.5 text-[12.5px]', c.heptane === v ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground')}>{l}</button>)}</div></div>
        </> : <>
          <S label="Fuel mole fraction in feed" v={c.xf} min={0.02} max={1} step={0.01} fmt={v => v.toFixed(2)} on={v => set({ xf: v })} />
          <S label="Fuel flow" v={c.mdot} min={0.1} max={3.2} step={0.05} fmt={v => `${v.toFixed(2)} mg/s`} on={v => set({ mdot: v })} />
          <div><div className="mb-2 text-[13px]">Configuration</div><div className="grid grid-cols-2 gap-1">{[[0, 'Normal'], [1, 'Inverse']].map(([v, l]) => <button key={l} onClick={() => set({ inverse: v as number })} className={cn('rounded border py-1.5 text-[12.5px]', c.inverse === v ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground')}>{l}</button>)}</div></div>
        </>}
        <div className="flex flex-wrap gap-1.5 pt-1">{[['Lunar base', H.lunar], ['Rover', H.rover], ['ISS', H.iss]].map(([l, h]: any) => <button key={l} onClick={() => set({ o2: h.o2 * 100, psia: h.p_atm * PSIA })} className="chip transition-colors hover:border-foreground hover:text-foreground">{l}</button>)}</div>
      </div>
    </aside>

    <div className="min-w-0 space-y-10">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="panel p-6"><div className="eyebrow">Prediction at {c.o2.toFixed(1)}% O₂ · {c.psia.toFixed(1)} psia</div>
          <div className="mt-5 flex items-baseline gap-2"><span className="num text-[54px] leading-none">{k === 'flex_k' ? here.v.toFixed(2) : fmtP(here.v)}</span>{k === 'flex_k' && <span className="text-muted-foreground">mm²/s</span>}</div>
          <div className="num mt-3 text-[12.5px] text-muted-foreground">{k === 'flex_k' ? `95% interval ${(here.v - 1.96 * here.u).toFixed(2)}–${(here.v + 1.96 * here.u).toFixed(2)} mm²/s` : `spread across ${k === "cfig_ign" ? "150 trees" : "8 networks"} ±${(here.u * 100).toFixed(0)} pts`}</div>
          <div className="mt-5">{out.length ? <span className="chip" style={{ color: 'var(--signal)', borderColor: 'var(--signal)' }}>outside tested {out.map(o => o === 'xO2' ? 'oxygen' : 'pressure').join(' and ')}: extrapolation</span> : <span className="chip" style={{ color: 'var(--ok)', borderColor: 'var(--ok)' }}>inside the tested range</span>}</div>
        </div>
        <div className="panel p-6"><div className="eyebrow">Held-out validation · {met.cv}</div>
          <table className="mt-3 w-full text-[13.5px]"><tbody className="num">
            {(k === 'flex_k' ? [['R²', met.r2.toFixed(3), '0'], ['MAE (mm²/s)', met.mae.toFixed(3), met.baseline_mae.toFixed(3)], ['95% interval coverage', `${(met.coverage95 * 100).toFixed(1)}%`, '95% ideal'], ['Training rows', met.n, '']]
              : [['ROC AUC', met.auc.toFixed(3), `${met.logreg_auc.toFixed(3)} logistic`], ['Brier score', met.brier.toFixed(3), `${met.baseline_brier.toFixed(3)} base rate`], ['Accuracy', `${(met.accuracy * 100).toFixed(1)}%`, `${(Math.max(met.positives, met.n - met.positives) / met.n * 100).toFixed(1)}% majority`], ['Calibration error', met.ece.toFixed(3), ''], ['Training rows', `${met.n} (${met.positives} positive)`, '']]).map(([a, b, c2]) =>
              <tr key={a as string} className="border-b last:border-0"><td className="py-2 font-sans text-muted-foreground">{a}</td><td className="py-2 text-right">{b}</td><td className="py-2 pl-4 text-right text-[11.5px] text-muted-foreground">{c2 && `vs ${c2}`}</td></tr>)}
          </tbody></table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><h2 className="display text-[30px]">Response across oxygen and pressure</h2><span className="text-[12.5px] text-muted-foreground">{desc.ink} · dots: flown tests · other inputs held at the sliders</span></div>
        <div className="panel p-4">
          <div className="relative">
            <DitherHeatmap values={grid.v} cols={COLS} rows={ROWS} className="aspect-[16/9] w-full" label={`${desc.q} predicted across oxygen and pressure`} />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {train.map((t, i) => <circle key={i} cx={px(t.o2)} cy={py(t.p * PSIA)} r={0.45} fill="var(--signal)" vectorEffect="non-scaling-stroke" />)}
            </svg>
            {[['Lunar', H.lunar], ['Rover', H.rover], ['ISS', H.iss]].map(([l, h]: any) => <div key={l} className="pointer-events-none absolute" style={{ left: `${px(h.o2)}%`, top: `${py(h.p_atm * PSIA)}%` }}><div className="-translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-foreground" /><span className="absolute left-3 top-[-9px] whitespace-nowrap rounded bg-background/85 px-1 text-[11px]">{l}</span></div>)}
            <div className="pointer-events-none absolute" style={{ left: `${px(c.o2 / 100)}%`, top: `${py(c.psia)}%` }}><div className="-translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-[2.5px] border-primary" /></div>
          </div>
          <div className="num mt-2 flex justify-between text-[11.5px] text-muted-foreground"><span>{X[0] * 100}% O₂</span><span>pressure {Y[0]}–{Y[1]} psia, bottom to top</span><span>{X[1] * 100}% O₂</span></div>
        </div>
      </div>

      {k === 'flex_k' && <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="panel p-4">{cv && <Parity rows={cv.flex_k} />}</div>
        <div><h2 className="display text-[30px]">Out-of-distribution tests</h2>
          <table className="tbl mt-4"><thead><tr><th>Split</th><th>MAE</th><th>Naive</th><th>95% coverage</th></tr></thead>
            <tbody className="num">{m.metrics.flex_k.ood?.map((o: any) => <tr key={o.split}><td className="font-sans">{o.split} (n={o.n_test})</td><td className="text-right">{o.mae.toFixed(3)}</td><td className="text-right text-muted-foreground">{o.naive_mae.toFixed(3)}</td><td className="text-right">{(o.coverage95 * 100).toFixed(0)}%</td></tr>)}</tbody></table>
        </div>
      </div>}

      {k !== 'flex_k' && <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-center">
        <div><h2 className="display text-[30px]">Calibration</h2><p className="mt-3 text-[14.5px] text-muted-foreground">When the model says 80%, does it happen about 80% of the time? Bars compare mean predicted probability with the observed rate in held-out tests; most tests sit in the top bin because {(met.positives / met.n * 100).toFixed(0)}% of outcomes are positive.</p></div>
        <Reliability bins={met.reliability} />
      </div>}

      <div className="panel p-6 text-[14px] text-muted-foreground">
        <div className="eyebrow mb-3">What this model is and is not</div>
        <p><span className="text-foreground">Target:</span> {desc.t}. {k === 'cfig_ign' ? 'Adiabatic flame temperature and stoichiometric mixture fraction are PSI-tabulated inputs; for a new condition they are filled in from the 5 nearest measured CFI-G tests.' : k === 'flex_ext' ? `${met.excluded_disruption} runs ending in droplet disruption were excluded as censored.` : 'Kernel learned by marginal likelihood: ' + met.kernel + '.'}</p>
        <p className="mt-2">It describes ISS microgravity tests of {k === 'cfig_ign' ? 'gaseous fuels' : 'single fuel droplets'}. It says nothing directly about burning fabrics or plastics, and nothing about partial gravity. Use it to compare atmospheres and to choose what to test next, not to certify anything. <Link className="link text-foreground" to="/method">Training code and data lineage</Link>.</p>
      </div>
    </div>
  </div>
}

function Next({ db, m }: { db: DB; m: Models }) {
  const [fuel, setFuel] = useState(1); const [d0, setD0] = useState(3)
  const H = db.meta.habitats
  const cands = useMemo(() => recommend(m.flex_k, [H.lunar, H.rover], { heptane: fuel, D0: d0, xCO2: 0, xHe: 0 }), [m, fuel, d0, H])
  const rows = 31, cols = 26; const max = Math.max(...cands.map(c => c.value)), min = Math.min(...cands.map(c => c.value))
  const grid = useMemo(() => { const g = new Float32Array(cols * rows); cands.forEach((c, k) => { const ci = Math.floor(k / rows), ri = k % rows; g[(rows - 1 - ri) * cols + ci] = (c.value - min) / (max - min) }); return g }, [cands, max])
  const picks = useMemo(() => { const s = [...cands].sort((a, b) => b.value - a.value); const out: typeof s = []; for (const c of s) { if (out.every(o => Math.hypot((o.o2 - c.o2) / 0.04, (o.p - c.p) / 0.12) > 1.2)) out.push(c); if (out.length === 4) break } return out }, [cands])
  const iss = gpPredict(m.flex_k, [0.21, 1, 0, 0, fuel, d0])
  const px = (o2: number) => ((o2 - 0.15) / 0.25) * 100, py = (p: number) => (1 - (p - 0.45) / 0.75) * 100
  return <div className="grid gap-10 py-10 lg:grid-cols-[300px_1fr]">
    <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
      <div><div className="eyebrow mb-3">Question</div><p className="text-[17px] font-medium leading-snug">If NASA could fly one more droplet test, which atmosphere would teach the burning-rate model the most about Moon-base air?</p></div>
      <div><div className="mb-2 text-[13px]">Fuel</div><div className="grid grid-cols-2 gap-1">{[[1, 'Heptane'], [0, 'Methanol']].map(([v, l]) => <button key={l} onClick={() => setFuel(v as number)} className={cn('rounded border py-1.5 text-[12.5px]', fuel === v ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground')}>{l}</button>)}</div></div>
      <S label="Initial droplet diameter" v={d0} min={1.1} max={4.6} step={0.1} fmt={v => `${v.toFixed(1)} mm`} on={setD0} />
      <p className="text-[13px] text-muted-foreground">Value = Gaussian-process epistemic uncertainty × (0.15 + closeness to the lunar-base or rover atmosphere). This is a standard active-learning acquisition rule; it ranks where data would shrink the model’s ignorance about habitat air fastest.</p>
    </aside>
    <div className="min-w-0 space-y-8">
      <div className="panel p-4"><div className="relative">
        <DitherHeatmap values={grid} cols={cols} rows={rows} className="aspect-[16/10] w-full" label="Value of a new test across oxygen and pressure" />
        {picks.map((p, i) => <div key={i} className="pointer-events-none absolute" style={{ left: `${px(p.o2)}%`, top: `${py(p.p)}%` }}><div className="-translate-x-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full border-2 border-foreground bg-background text-[11px] font-semibold">{i + 1}</div></div>)}
        {[['Lunar', H.lunar], ['Rover', H.rover]].map(([l, h]: any) => <div key={l} className="pointer-events-none absolute" style={{ left: `${px(h.o2)}%`, top: `${py(h.p_atm)}%` }}><div className="-translate-x-1/2 -translate-y-1/2 h-3 w-3 rotate-45 border-2 border-signal" /><span className="absolute left-3 top-[-9px] whitespace-nowrap rounded bg-background/85 px-1 text-[11px] text-signal">{l}</span></div>)}
      </div><div className="num mt-2 flex justify-between text-[11.5px] text-muted-foreground"><span>15% O₂</span><span>darker = more to learn · pressure 6.6–17.6 psia, bottom to top</span><span>40% O₂</span></div></div>
      <table className="tbl"><thead><tr><th>#</th><th>Proposed test</th><th>Predicted K</th><th>Uncertainty (±95%)</th><th>Near</th><th>Nearest flown test</th></tr></thead>
        <tbody className="num">{picks.map((p, i) => <tr key={i}><td>{i + 1}</td><td className="font-sans">{fuel ? 'Heptane' : 'Methanol'} {d0.toFixed(1)} mm · {(p.o2 * 100).toFixed(0)}% O₂ · {(p.p * PSIA).toFixed(1)} psia</td><td>{p.mean.toFixed(2)} mm²/s</td><td>±{(1.96 * p.sd).toFixed(2)} <span className="text-muted-foreground">({(p.sd / iss.epistemic).toFixed(1)}× ISS air)</span></td><td className="font-sans">{p.relevance > 0.3 ? p.hab : '·'}</td><td>{(p.nearest[0] * 100).toFixed(0)}% O₂ · {(p.nearest[1] * PSIA).toFixed(1)} psia</td></tr>)}</tbody></table>
      <p className="text-[14px] text-muted-foreground">Why droplets? FLEX holds the densest set of measured outcomes in PSI ({m.metrics.flex_k.n} burning-rate rows). The same recipe applies to solid materials once flight data at elevated oxygen exist; today the envelope chart shows that none do.</p>
    </div>
  </div>
}

function Reliability({ bins }: { bins: { bin: [number, number]; n: number; pred: number; obs: number }[] }) {
  const W = 360, H = 220, pad = 30
  const x = (v: number) => pad + v * (W - pad - 10), y = (v: number) => H - pad - v * (H - pad - 10)
  return <div className="panel p-4"><svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Reliability diagram">
    <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--border)" strokeDasharray="3 3" />
    {[0, 0.5, 1].map(v => <g key={v}><text x={x(v)} y={H - 10} fontSize={10} textAnchor="middle" fill="var(--muted-foreground)" className="num">{v}</text><text x={pad - 6} y={y(v) + 3} fontSize={10} textAnchor="end" fill="var(--muted-foreground)" className="num">{v}</text></g>)}
    {bins.map((b, i) => <g key={i}><rect x={x(b.bin[0]) + 3} width={x(b.bin[1]) - x(b.bin[0]) - 6} y={y(b.obs)} height={y(0) - y(b.obs)} fill="var(--primary)" opacity={0.85} />
      <circle cx={x(b.pred)} cy={y(b.pred)} r={3} fill="var(--foreground)" /><text x={(x(b.bin[0]) + x(b.bin[1])) / 2} y={y(b.obs) - 5} fontSize={9.5} textAnchor="middle" fill="var(--muted-foreground)" className="num">n={b.n}</text></g>)}
  </svg><div className="mt-1 text-[11.5px] text-muted-foreground">bars: observed rate · dots: mean prediction · x: predicted probability</div></div>
}

function S({ label, v, min, max, step, fmt, on }: { label: string; v: number; min: number; max: number; step: number; fmt: (v: number) => string; on: (v: number) => void }) {
  return <label className="block"><div className="mb-1.5 flex justify-between text-[13px]"><span>{label}</span><span className="num text-muted-foreground">{fmt(v)}</span></div><input type="range" className="w-full" value={v} min={min} max={max} step={step} onChange={e => on(+e.target.value)} /></label>
}
