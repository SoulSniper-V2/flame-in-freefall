import { Fragment, useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Printer, RotateCcw, ChevronDown, Download, BookOpen } from 'lucide-react'
import { type DB, type HabKey, type Weights, type Pt, fmtP, fmtG, CATS, CAT_LABEL, DEFAULT_WEIGHTS, HABS, HAB_SLUG, SLUG_HAB, PSIA, STATUS_LABEL, phaseOf, scoreAt } from '@/data'
import { EnvelopeChart, envelopeStats } from '@/components/Envelope'
import { Meter } from '@/components/Dither'
import { caveats } from '@/si/scenario'
import { TAKE } from '@/content'
import { useModels, gpPredict, ensPredict, cfigImpute, inRange, type Models } from '@/ml'
import { cn } from '@/lib/utils'
import { useLit, useEarthVsOrbit } from '@/components/Headline'
import { omosStats } from '@/margin'
import { SIInterpretation, SIBadge } from '@/components/SI'
import { LitTable, litNear, fmtGrav } from '@/components/LitEvidence'

type Atm = { o2: number; p_atm: number; g: number }
const PART_COLOR = { safety: 'var(--foreground)', atmosphere: 'var(--primary)', gravity: 'var(--signal)', realism: 'var(--muted-foreground)' } as const
const PART_LABEL = { safety: 'Fire-safety index', atmosphere: 'Atmosphere match', gravity: 'Gravity coverage', realism: 'Material realism' } as const

const CUSTOM_DEFAULT: Atm = { o2: 0.3, p_atm: 10.2 / PSIA, g: 0.166 }
const numQ = (q: URLSearchParams, k: string) => { const v = q.get(k); return v != null && v.trim() !== '' && Number.isFinite(+v) ? +v : null }
function customFromQuery(q: URLSearchParams): Atm {
  const o2 = numQ(q, 'o2'), p = numQ(q, 'p'), g = numQ(q, 'g')
  return { o2: o2 != null ? o2 / 100 : CUSTOM_DEFAULT.o2, p_atm: p != null ? p / PSIA : CUSTOM_DEFAULT.p_atm, g: g ?? CUSTOM_DEFAULT.g }
}
const customQuery = (a: Atm): Record<string, string> => ({ o2: (a.o2 * 100).toFixed(1), p: (a.p_atm * PSIA).toFixed(1), g: String(a.g) })
const sgn = (x: number) => `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(1)}`
function saveText(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function rankAll(db: DB, atm: Atm, w: Weights) {
  return db.invs.map(inv => ({ inv, ...scoreAt(db, inv, atm, w) })).sort((a, b) => b.score - a.score)
}

export function readouts(m: Models, atm: Atm) {
  const xf = [atm.o2, atm.p_atm, 0, 0, 1, 3]
  const k = gpPredict(m.flex_k, xf); const kIss = gpPredict(m.flex_k, [0.21, 1, 0, 0, 1, 3])
  const ext = ensPredict(m.flex_ext, xf)
  const med = (d: number) => { const v = m.cfig_ign.train.map(r => r[d] * m.cfig_ign.sd[d] + m.cfig_ign.mu[d]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] }
  const xg = cfigImpute(m.cfig_ign, [atm.o2, atm.p_atm, 0, med(3), med(4)])
  const ign = ensPredict(m.cfig_ign, xg)
  return {
    k, kIss, ext, ign,
    kOut: inRange(m.flex_k.train_ranges, m.flex_k.features, xf).filter(f => f === 'xO2' || f === 'P_atm'),
    extOut: inRange(m.metrics.flex_ext.ranges, m.flex_ext.features, xf).filter(f => f === 'xO2' || f === 'P_atm'),
    ignOut: inRange(m.metrics.cfig_ign.ranges, m.cfig_ign.features, xg).filter(f => f === 'xO2' || f === 'P_atm'),
  }
}

const F = { xO2: 'oxygen', P_atm: 'pressure' } as Record<string, string>

export default function Brief({ db }: { db: DB }) {
  const { hab: slug = 'lunar-base' } = useParams(); const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const hk: HabKey | 'custom' = slug === 'custom' ? 'custom' : SLUG_HAB[slug] ?? 'lunar'
  const H = db.meta.habitats
  const preset: Atm = hk === 'custom' ? CUSTOM_DEFAULT : { o2: H[hk].o2, p_atm: H[hk].p_atm, g: H[hk].g }
  const [atm, setAtm] = useState<Atm>(() => hk === 'custom' ? customFromQuery(params) : preset)
  useEffect(() => { if (hk !== 'custom') setAtm({ o2: H[hk].o2, p_atm: H[hk].p_atm, g: H[hk].g }) }, [hk])
  useEffect(() => { if (hk === 'custom') setParams(customQuery(atm), { replace: true }) }, [atm, hk])
  const [w, setW] = useState<Weights>(DEFAULT_WEIGHTS); const [open, setOpen] = useState<string | null>(null); const [all, setAll] = useState(false)
  const models = useModels(); const lit = useLit(); const evo = useEarthVsOrbit(lit); const thin = evo ? omosStats(evo, 'thin') : null
  const ranked = useMemo(() => rankAll(db, atm, w), [db, atm, w])
  const base = useMemo(() => rankAll(db, atm, DEFAULT_WEIGHTS), [db, atm])
  const baseRank = useMemo(() => Object.fromEntries(base.map((r, i) => [r.inv.id, i + 1])), [base])
  const stability = useMemo(() => {
    const top = new Set(ranked.slice(0, 5).map(r => r.inv.id)); let kept = 0, trials = 0
    for (const key of Object.keys(w) as (keyof Weights)[]) for (const d of [-10, 10]) {
      const w2 = { ...w, [key]: Math.max(0, w[key] + d) }; const t2 = rankAll(db, atm, w2).slice(0, 5); kept += t2.filter(r => top.has(r.inv.id)).length; trials += 5
    }
    return kept / trials
  }, [db, atm, w, ranked])
  const ro = useMemo(() => models ? readouts(models, atm) : null, [models, atm])
  const st = useMemo(() => envelopeStats(db), [db])
  const label = hk === 'custom' ? 'Custom atmosphere' : H[hk].label
  const o2p = atm.o2 * 100, ps = atm.p_atm * PSIA
  const measured = ranked.filter(r => r.nearest && r.nearest.kind !== 'target' && r.nearest.p_atm != null)
    .map(r => ({ r, d: Math.hypot((r.nearest!.o2! - atm.o2) / 0.1, (r.nearest!.p_atm! - atm.p_atm) / 0.3) })).sort((a, b) => a.d - b.d)[0]
  const cav = caveats({ o2: o2p, psia: ps, g: atm.g, flow: 0, mat: 'Solid', focus: 'all' })
  const setCustom = (patch: Partial<Atm>) => {
    const next = { ...atm, ...patch }; setAtm(next)
    if (hk !== 'custom') nav(`/brief/custom?${new URLSearchParams(customQuery(next))}`, { replace: true })
  }
  const hazard = useMemo(() => {
    const rec = db.points.filter(p => p.status === 'recorded' && p.o2 != null && p.p_atm != null)
      .map(p => { const dO = p.o2! * 100 - atm.o2 * 100, dP = p.p_atm! * PSIA - atm.p_atm * PSIA; return { p, dO, dP, d: Math.hypot(dO / 2, dP / 1.5) } })
    const warn: string[] = []
    if (atm.g > 0 && atm.g < 1) warn.push('No partial-gravity combustion data in PSI. LUCI flew at simulated 1/6 g (New Shepard, 2025; results in NASA reports); FM² is planned')
    if (atm.o2 > 0.222) warn.push('No solid-material test in PSI above 22.2% O₂. Saffire IV–VI burned solids at up to 26.2% outside PSI; none reached 30%')
    const near = rec.filter(r => Math.abs(r.dO) <= 2 + 1e-9 && Math.abs(r.dP) <= 1.5 + 1e-9)
    if (near.length) {
      const accs = [...new Set(near.map(r => db.byId[r.p.acc]?.acronym ?? r.p.acc))]
      return { ok: true, head: `Interpolation · ${near.length} recorded flight conditions within ±2 pts O₂ and ±1.5 psia (${accs.join(', ')})`, warn }
    }
    const best = rec.reduce<(typeof rec)[number] | null>((b, r) => (!b || r.d < b.d ? r : b), null)
    const head = best
      ? `Extrapolation hazard · nearest recorded flight condition: ${db.byId[best.p.acc]?.acronym ?? best.p.acc} ${(best.p.o2! * 100).toFixed(1)}% O₂ at ${(best.p.p_atm! * PSIA).toFixed(1)} psia (${sgn(best.dO)} pts O₂, ${sgn(best.dP)} psia away)`
      : 'Extrapolation hazard · no recorded flight condition in the table'
    return { ok: false, head, warn }
  }, [db, atm])

  const exportMD = () => {
    const top = ranked.slice(0, 10)
    const a3 = ranked.slice(0, 3).map(r => r.inv.acronym)
    const bl: string[] = [
      `The best-matched evidence is ${a3[0]}, then ${a3.slice(1).join(' and ')}.${measured ? ` The closest condition actually tested is ${measured.r.inv.acronym}’s ${(measured.r.nearest!.o2! * 100).toFixed(1)}% O₂ at ${(measured.r.nearest!.p_atm! * PSIA).toFixed(1)} psia${measured.d < 0.35 ? ', essentially this atmosphere.' : measured.d < 1 ? ', close but not identical.' : ', well away from this atmosphere.'}` : ''}`,
      atm.o2 > st.solidMax + 0.002
        ? `No ISS solid-material test in PSI reached ${o2p.toFixed(0)}% O₂: PSI solid-fuel tables stop at ${(st.solidMax * 100).toFixed(1)}%. Material screening for this habitat needs new flight data or validated models.`
        : 'PSI holds ISS solid-material tests at this oxygen level (BASS-II, Saffire), so material-flammability evidence applies directly here.',
    ]
    if (ro) bl.push(`A 3 mm heptane droplet here is predicted to burn at ${ro.k.mean.toFixed(2)} ± ${(1.96 * ro.k.sd).toFixed(2)} mm²/s (${ro.k.mean > ro.kIss.mean ? `${((ro.k.mean / ro.kIss.mean - 1) * 100).toFixed(0)}% faster` : `${((1 - ro.k.mean / ro.kIss.mean) * 100).toFixed(0)}% slower`} than in ISS air), with a ${fmtP(ro.ext.p)} chance the flame goes out before the fuel is gone. Hot gas-flame ignition: ${fmtP(ro.ign.p)}.${ro.kOut.length ? ` Extrapolated: ${ro.kOut.map(f => F[f]).join(' or ')}.` : ' Inside the tested FLEX range.'}`)
    bl.push(atm.g > 0 && atm.g < 1
      ? `PSI holds no partial-gravity combustion data. Microgravity results bound ${fmtG(atm.g).split(' (')[0]} from below and 1-g results from above; E-FIELD Flames used electric fields to mimic buoyancy.`
      : atm.g === 0 ? 'Gravity matches the flight data: every ISS investigation here ran in microgravity.'
      : 'At 1 g, ground flammability tests (NASA-STD-6001) apply, but BASS-II found microgravity flames can survive where 1-g screening says they will not.')
    const lines = [
      `# ${label}`, '',
      `${o2p.toFixed(1)}% O₂ · ${ps.toFixed(1)} psia · ${fmtG(atm.g)}`, '',
      `> ${hazard.head}`, ...hazard.warn.map(w => `> ${w}`), '',
      '## Bottom line', '',
      ...bl.map((t, i) => `${i + 1}. ${t}`), '',
      '## Ranked evidence (top 10)', '',
      '| Rank | Acronym | Score | Nearest tested condition | PSI link |', '|---|---|---|---|---|',
      ...top.map((r, i) => `| ${i + 1} | ${r.inv.acronym} | ${r.score.toFixed(0)} | ${r.nearest?.o2 != null ? `${(r.nearest.o2 * 100).toFixed(1)}% O₂${r.nearest.p_atm != null ? ` · ${(r.nearest.p_atm * PSIA).toFixed(1)} psia` : ' · p n/a'}` : 'no tabulated condition'} | ${r.inv.sourceUrl} |`), '',
      `Generated from NASA PSI data on ${new Date().toISOString().slice(0, 10)}.`,
    ]
    saveText(`flame-in-freefall_brief_${slug}.md`, lines.join('\n') + '\n', 'text/markdown')
  }
  const exportBib = () => {
    const bib = ranked.slice(0, 10).map(({ inv }) => {
      const f = [`  title = {${inv.title}}`, `  author = {${inv.pis.join(' and ')}}`, '  howpublished = {NASA Physical Sciences Informatics}']
      if (inv.doi) f.push(`  doi = {${inv.doi}}`)
      f.push(`  url = {${inv.sourceUrl}}`, `  note = {${inv.acronym}}`)
      return `@misc{${inv.id.replace(/-/g, '')},\n${f.join(',\n')}\n}`
    }).join('\n\n')
    saveText(`flame-in-freefall_${slug}.bib`, bib + '\n', 'application/x-bibtex')
  }

  return <>
    <section className="border-b">
      <div className="wrap py-10 md:py-14">
        <div className="no-print mb-8 flex flex-wrap gap-2">
          {[...HABS, 'custom' as const].map(h => <Link key={h} to={`/brief/${h === 'custom' ? 'custom' : HAB_SLUG[h]}`} className={cn('rounded-full border px-3.5 py-1.5 text-[13px] transition-colors', hk === h ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:border-foreground hover:text-foreground')}>{h === 'custom' ? 'Custom' : H[h].label}</Link>)}
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><div className="eyebrow mb-4">Habitat fire-safety brief</div>
            <h1 className="display text-[36px] md:text-[44px]">{label}</h1>
            <div className="num mt-4 text-[15px]">{o2p.toFixed(1)}% O₂ · {ps.toFixed(1)} psia · {fmtG(atm.g)}</div>
            {hk !== 'custom' && <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground">{H[hk].note}</p>}</div>
          <div className="no-print flex flex-wrap gap-2">
            <button onClick={exportMD} className="btn btn-ghost"><Download size={15} /> Markdown</button>
            <button onClick={exportBib} className="btn btn-ghost"><BookOpen size={15} /> BibTeX</button>
            <button onClick={() => window.print()} className="btn btn-ghost"><Printer size={15} /> Print or save as PDF</button>
          </div>
        </div>
      </div>
    </section>

    <div className="wrap grid gap-10 py-10 lg:grid-cols-[300px_1fr]">
      {/* controls */}
      <aside className="no-print space-y-8 lg:sticky lg:top-20 lg:self-start">
        <div>
          <div className="eyebrow mb-4">Atmosphere</div>
          <Slider label="Oxygen" value={o2p} min={15} max={100} step={0.5} fmt={v => `${v.toFixed(1)}%`} onChange={v => setCustom({ o2: v / 100 })} />
          <Slider label="Pressure" value={ps} min={3} max={20} step={0.1} fmt={v => `${v.toFixed(1)} psia`} onChange={v => setCustom({ p_atm: v / PSIA })} />
          <div className="mt-4"><div className="mb-2 text-[13px]">Gravity</div><div className="grid grid-cols-4 gap-1">{[[0, 'μg'], [0.166, 'Moon'], [0.38, 'Mars'], [1, 'Earth']].map(([g, l]) =>
            <button key={l} onClick={() => setCustom({ g: g as number })} className={cn('rounded border py-1.5 text-[12px] transition-colors', atm.g === g ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground')}>{l}</button>)}</div></div>
        </div>
        <div>
          <div className="mb-4 flex items-center justify-between"><div className="eyebrow">Score weights</div><button onClick={() => setW(DEFAULT_WEIGHTS)} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><RotateCcw size={12} /> Reset</button></div>
          {(Object.keys(w) as (keyof Weights)[]).map(k => <Slider key={k} label={PART_LABEL[k]} swatch={PART_COLOR[k]} value={w[k]} min={0} max={100} step={1} fmt={v => `${v.toFixed(0)}`} onChange={v => setW({ ...w, [k]: v })} />)}
          <p className="mt-3 text-[12.5px] text-muted-foreground">Weights are normalised to 100%. Top-5 stability under ±10-point changes to any one weight: <span className="num text-foreground">{(stability * 100).toFixed(0)}%</span>.</p>
        </div>
      </aside>

      <div className="min-w-0 space-y-14">
        {/* bottom line */}
        <section>
          <div className="panel mb-6 space-y-1.5 p-4 text-[14px]" style={{ borderLeft: `3px solid ${hazard.ok ? 'var(--ok)' : 'var(--signal)'}` }}>
            <div>{hazard.head}</div>
            {hazard.warn.map(w => <div key={w} className="text-[13px] text-signal">{w}</div>)}
          </div>
          {hk !== 'custom' && <SIInterpretation kind="habitats" id={hk} className="mb-8" />}
          <h2 className="display mb-5 text-[32px]">Bottom line</h2>
          <ol className="space-y-4 text-[15.5px] leading-relaxed">
            <li className="flex gap-4"><span className="num text-muted-foreground">01</span><span>Best evidence: <Link className="link font-medium" to={`/inv/${ranked[0].inv.id}`}>{ranked[0].inv.acronym}</Link>, then {ranked.slice(1, 3).map((r, i) => <Fragment key={r.inv.id}>{i ? ' and ' : ''}<Link className="link" to={`/inv/${r.inv.id}`}>{r.inv.acronym}</Link></Fragment>)}. {measured ? <>Closest tested: {measured.r.inv.acronym}, {(measured.r.nearest!.o2! * 100).toFixed(1)}% O₂ · {(measured.r.nearest!.p_atm! * PSIA).toFixed(1)} psia{measured.d < 0.35 ? ' (this atmosphere).' : measured.d < 1 ? ' (close).' : ' (far from this air).'}</> : null}</span></li>
            <li className="flex gap-4"><span className="num text-muted-foreground">02</span><span>{atm.o2 > st.solidMax + 0.002
              ? <>No ISS solid-material test in PSI reaches {o2p.toFixed(0)}% O₂ (they stop at {(st.solidMax * 100).toFixed(1)}%). Nearest proxy: <Link className="link" to="/inv/PSI-20">ACME BRE</Link>, a gas burner emulating PMMA at 34% O₂.</>
              : <>ISS solid-material tests exist at this oxygen level (BASS-II, Saffire).</>}
              {thin && <> Re-test thin materials rated <span className="num">{o2p.toFixed(1)}–{(o2p - thin.worst).toFixed(1)}%</span> at 1 g. <Link className="link" to="/margin">Check a material</Link></>}</span></li>
            {ro && <li className="flex gap-4"><span className="num text-muted-foreground">03</span><span>Predicted droplet burning rate: <span className="num">{ro.k.mean.toFixed(2)} ± {(1.96 * ro.k.sd).toFixed(2)}</span> mm²/s ({ro.k.mean > ro.kIss.mean ? `${((ro.k.mean / ro.kIss.mean - 1) * 100).toFixed(0)}% faster` : `${((1 - ro.k.mean / ro.kIss.mean) * 100).toFixed(0)}% slower`} than ISS air), <span className="num">{fmtP(ro.ext.p)}</span> extinction chance.{ro.kOut.length ? <> Extrapolated: FLEX did not cover this {ro.kOut.map(f => F[f]).join(' or ')}.</> : ''}</span></li>}
            <li className="flex gap-4"><span className="num text-muted-foreground">{ro ? '04' : '03'}</span><span>{atm.g > 0 && atm.g < 1 ? <>PSI has no partial-gravity combustion data. LUCI (outside PSI) burned fabric and PMMA at 0.167 g; see below.</> : atm.g === 0 ? <>Gravity matches the flight data: every ISS investigation here ran in microgravity.</> : <>At 1 g, ground flammability tests (NASA-STD-6001) apply, but <Link className="link" to="/inv/PSI-25">BASS-II</Link> found microgravity flames can survive where 1-g screening says they will not.</>}</span></li>
          </ol>
        </section>

        {/* readouts */}
        {ro && <section>
          <div className="mb-5 flex items-end justify-between gap-4"><h2 className="display text-[32px]">Model readout at this atmosphere</h2><Link to="/lab" className="link no-print text-[13px] text-muted-foreground">Open the model lab</Link></div>
          <div className="grid gap-4 md:grid-cols-3">
            <Readout t="Droplet burning rate" v={`${ro.k.mean.toFixed(2)}`} u="mm²/s" s={`95% interval ${(ro.k.mean - 1.96 * ro.k.sd).toFixed(2)}–${(ro.k.mean + 1.96 * ro.k.sd).toFixed(2)} · ISS air ${ro.kIss.mean.toFixed(2)}`} out={ro.kOut} src="Gaussian process · FLEX" />
            <Readout t="Flame extinguishes before burnout" v={fmtP(ro.ext.p)} s={`8-net ensemble spread ±${(ro.ext.sd * 100).toFixed(0)} pts`} out={ro.extOut} src="Deep ensemble · FLEX" />
            <Readout t="Gas flame ignites hot" v={fmtP(ro.ign.p)} s={`spread across 150 trees ±${(ro.ign.sd * 100).toFixed(0)} pts · median CFI-G fuel flow`} out={ro.ignOut} src="Random forest · ACME CFI-G" />
          </div>
        </section>}

        {lit && (() => { const L = litNear(lit, o2p, atm.g); const luci = L.partial.filter(r => r.investigation === 'LUCI'); return <section>
          <div className="mb-2 flex flex-wrap items-center gap-3"><h2 className="display text-[32px]">What the literature measured</h2><SIBadge>SI-extracted · quote-verified</SIBadge></div>
          <p className="mb-5 text-[14px] text-muted-foreground">Open a row for its verbatim quote.</p>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="panel p-5"><div className="num text-[30px] leading-none">{L.partial.length}</div><div className="mt-2 text-[13px] text-muted-foreground">records at partial gravity</div></div>
            <div className="panel p-5"><div className="num text-[30px] leading-none">{luci.length}</div><div className="mt-2 text-[13px] text-muted-foreground">from LUCI, flown at {fmtGrav(luci[0]?.gravity_g ?? 0.167)}</div></div>
            <div className="panel p-5"><div className="num text-[30px] leading-none">{L.above}</div><div className="mt-2 text-[13px] text-muted-foreground">microgravity records at ≥{o2p.toFixed(0)}% O₂</div></div>
          </div>
          <h3 className="mb-3 text-[17px] font-medium">Partial gravity, nearest {fmtGrav(atm.g)} first</h3>
          <LitTable rows={L.partial} lit={lit} max={4} />
          <h3 className="mb-3 mt-8 text-[17px] font-medium">Within 4 points of {o2p.toFixed(1)}% O₂</h3>
          {L.near.length ? <LitTable rows={L.near} lit={lit} max={4} /> : <p className="text-[14px] text-muted-foreground">No verified record within 4 points of this oxygen level.</p>}
        </section> })()}

        {/* ranked evidence */}
        <section>
          <h2 className="display mb-2 text-[32px]">Ranked evidence</h2>
          <p className="mb-5 text-[14px] text-muted-foreground">Open a row to see why it ranks where it does. Δ shows movement against the default weights.</p>
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>#</th><th>Investigation</th><th className="w-[180px]">Score</th><th>Nearest tested condition</th><th>Δ</th><th /></tr></thead>
            <tbody>{ranked.slice(0, all ? undefined : 6).map((r, i) => { const d = baseRank[r.inv.id] - (i + 1); const isOpen = open === r.inv.id; return <Fragment key={r.inv.id}>
              <tr className="row-link" onClick={() => setOpen(isOpen ? null : r.inv.id)}>
                <td className="num text-muted-foreground">{i + 1}</td>
                <td><div className="font-medium">{r.inv.acronym}</div><div className="text-[12.5px] text-muted-foreground">{r.inv.phase}</div></td>
                <td><div className="flex items-center gap-3"><span className="num w-8">{r.score.toFixed(0)}</span><div className="flex h-2 flex-1 overflow-hidden rounded-[2px] bg-muted">{(Object.keys(r.parts) as (keyof typeof r.parts)[]).map(k => <div key={k} style={{ width: `${r.parts[k]}%`, background: PART_COLOR[k] }} />)}</div></div></td>
                <td className="num text-[12.5px]">{r.nearest ? <>{(r.nearest.o2! * 100).toFixed(1)}% O₂{r.nearest.p_atm != null ? ` · ${(r.nearest.p_atm * PSIA).toFixed(1)} psia` : ' · p n/a'}{r.nearest.kind === 'target' ? ' (target)' : ''}</> : <span className="text-muted-foreground">no tabulated condition</span>}</td>
                <td className={cn('num text-[12.5px]', d > 0 ? 'text-ok' : d < 0 ? 'text-signal' : 'text-muted-foreground')}>{d > 0 ? `+${d}` : d < 0 ? d : '·'}</td>
                <td><ChevronDown size={15} className={cn('text-muted-foreground transition-transform', isOpen && 'rotate-180')} /></td>
              </tr>
              {isOpen && <tr><td /><td colSpan={5} className="bg-muted/40">
                <div className="grid gap-6 py-2 md:grid-cols-[1.2fr_1fr]">
                  <div><p className="text-[14px]">{r.inv.si.summary}</p><Link to={`/inv/${r.inv.id}`} className="link mt-3 inline-block text-[13px]">Full record for {r.inv.acronym}</Link>
                    {r.nearest && <NearestProv p={r.nearest} />}</div>
                  <dl className="space-y-2 text-[13px]">{(Object.keys(r.parts) as (keyof typeof r.parts)[]).map(k => <div key={k} className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full" style={{ background: PART_COLOR[k] }} />{PART_LABEL[k]}</dt>
                    <dd className="num">{k === 'safety' ? `${r.inv.fireSafetyIndex}/100` : k === 'atmosphere' ? r.atm.toFixed(2) : k === 'gravity' ? r.grav.toFixed(2) : r.inv.realism.toFixed(2)} → +{r.parts[k].toFixed(1)}</dd></div>)}</dl>
                </div></td></tr>}
            </Fragment> })}</tbody>
          </table></div>
          {!all && <button onClick={() => setAll(true)} className="btn btn-ghost no-print mt-4">Show all {ranked.length} investigations</button>}
        </section>

        {/* envelope */}
        <section>
          <h2 className="display mb-5 text-[32px]">This atmosphere against every tested condition</h2>
          <div className="panel p-3 md:p-5"><EnvelopeChart db={db} focus={hk === 'custom' ? null : hk} custom={hk === 'custom' ? { o2: o2p, psia: ps } : null} height={480} onPick={acc => nav(`/inv/${acc}`)} /></div>
        </section>

        {/* defense layers */}
        <section>
          <h2 className="display mb-6 text-[32px]">Defense layers</h2>
          <div className="grid gap-4 md:grid-cols-2">{CATS.map(c => { const best = [...ranked].sort((a, b) => (b.inv.categories[c].score * 10 + b.score) - (a.inv.categories[c].score * 10 + a.score)).slice(0, 3); return <div key={c} className="panel p-6">
            <div className="eyebrow">{CAT_LABEL[c]}</div><h3 className="mt-2 text-[18px] font-medium leading-snug">{TAKE[c].h}</h3>
            <ul className="mt-4 space-y-3 text-[14px] text-muted-foreground">{TAKE[c].pts.slice(0, 1).map(([a, t], k) => <li key={k}>{t} <Link className="link text-foreground" to={`/inv/${a}`}>{db.byId[a]?.acronym}</Link></li>)}</ul>
            <div className="mt-5 border-t pt-4 text-[12.5px] text-muted-foreground">Strongest here: {best.map((b, k) => <Fragment key={b.inv.id}>{k ? ', ' : ''}<Link className="link text-foreground" to={`/inv/${b.inv.id}`}>{b.inv.acronym}</Link> ({b.inv.categories[c].score}/10)</Fragment>)}</div>
          </div> })}</div>
        </section>

        <section>
          <h2 className="display mb-5 text-[32px]">Caveats</h2>
          <ul className="space-y-3 text-[14.5px] text-muted-foreground">{cav.slice(0, 3).map((c, i) => <li key={i} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />{c}</li>)}
            {ranked.filter(r => phaseOf(r.inv) === 'other').length > 0 && <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />Ground and computational investigations (PSI-60, 62, 115, 117, 142) carry no flight conditions of their own; they rank on their modeling and analysis value.</li>}
          </ul>
        </section>
      </div>
    </div>
  </>
}

function NearestProv({ p }: { p: Pt }) {
  const s = p.src
  return <div className="num mt-4 space-y-0.5 text-[12px] text-muted-foreground">
    <div>{`Nearest tested condition · ${STATUS_LABEL[p.status ?? ''] ?? 'status not recorded'}`}</div>
    {s && <>
      <div>{`${s.table}, line ${s.line}`}</div>
      {s.cells.o2 && <div>{`"${s.cells.o2[0]}" = "${s.cells.o2[1]}"`}</div>}
      {s.cells.p && <div>{`"${s.cells.p[0]}" = "${s.cells.p[1]}"`}</div>}
    </>}
    <div>{`→ ${p.o2 != null ? `${(p.o2 * 100).toFixed(1)}% O₂` : 'O₂ n/a'} · ${p.p_atm != null ? `${(p.p_atm * PSIA).toFixed(1)} psia` : 'p n/a'}`}</div>
  </div>
}

function Slider({ label, value, min, max, step, fmt, onChange, swatch }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; swatch?: string }) {
  return <label className="mt-4 block first:mt-0">
    <div className="mb-1.5 flex items-center justify-between text-[13px]"><span className="flex items-center gap-2">{swatch && <span className="inline-block h-2 w-2 rounded-full" style={{ background: swatch }} />}{label}</span><span className="num text-muted-foreground">{fmt(value)}</span></div>
    <input type="range" className="w-full" value={value} min={min} max={max} step={step} onChange={e => onChange(+e.target.value)} />
  </label>
}

function Readout({ t, v, u, s, out, src }: { t: string; v: string; u?: string; s: string; out: string[]; src: string }) {
  return <div className="panel flex flex-col p-5">
    <div className="text-[14px] font-medium">{t}</div>
    <div className="mt-5 flex items-baseline gap-2"><span className="num text-[38px] leading-none">{v}</span>{u && <span className="text-[13px] text-muted-foreground">{u}</span>}</div>
    <div className="num mt-3 text-[11.5px] text-muted-foreground">{s}</div>
    <div className="mt-auto flex flex-wrap gap-2 pt-5"><span className="chip">{src}</span>{out.length ? <span className="chip" style={{ color: 'var(--signal)', borderColor: 'var(--signal)' }}>extrapolating: {out.map(f => F[f]).join(', ')}</span> : <span className="chip" style={{ color: 'var(--ok)', borderColor: 'var(--ok)' }}>inside tested range</span>}</div>
  </div>
}
