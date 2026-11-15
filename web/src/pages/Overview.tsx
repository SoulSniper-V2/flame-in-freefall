import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { type DB, HABS, HAB_SLUG, PSIA, DEFAULT_WEIGHTS, habitatScore } from '@/data'
import { SIStrip } from '@/components/SI'
import { EnvelopeChart, EnvelopeLegend, envelopeStats } from '@/components/Envelope'
import { GapMatrix } from '@/components/GapMatrix'
import { Parity, useCV } from '@/components/Parity'
import { Meter, DitherHeatmap } from '@/components/Dither'
import { useModels, recommend, gpPredict } from '@/ml'
import { HeadlineChart, useEarthVsOrbit, useLit, thinMeanOmos } from '@/components/Headline'
import { useBass2 } from '@/components/BassTwo'

function HeroFlame() {
  const B = import.meta.env.BASE_URL
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const cls = 'block aspect-[1.6] w-full object-cover'
  return reduce ? <img src={`${B}img/bass2-flame.jpg`} alt="A BASS-II flame spreading over a solid sample aboard the ISS, with the camera's telemetry overlay" className={cls} />
    : <video src={`${B}img/bass2-flame.mp4`} poster={`${B}img/bass2-flame.jpg`} autoPlay muted loop playsInline aria-label="A BASS-II flame igniting and spreading over a solid sample aboard the ISS, raw NASA camera footage" className={cls} />
}

function Finding({ n, kicker, title, children, aside }: { n: string; kicker: string; title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return <div className="mb-10 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
    <div><div className="eyebrow mb-3">{kicker}</div><h2 className="display text-[32px] md:text-[40px]">{title}</h2>{children}</div>
    {aside}
  </div>
}
const Stat = ({ v, l, tone }: { v: ReactNode; l: string; tone?: string }) => <div><div className={`num text-[30px] leading-none ${tone ?? ''}`}>{v}</div><p className="mt-2 text-[13px] leading-snug text-muted-foreground">{l}</p></div>

export default function Overview({ db }: { db: DB }) {
  const st = useMemo(() => envelopeStats(db), [db]); const nav = useNavigate(); const models = useModels(); const cv = useCV()
  const top = useMemo(() => Object.fromEntries(HABS.map(h => [h, db.invs.map(i => ({ inv: i, ...habitatScore(i, h, DEFAULT_WEIGHTS) })).sort((a, b) => b.score - a.score).slice(0, 3)])), [db])
  const H = db.meta.habitats; const m = models?.metrics
  const rec = useMemo(() => {
    if (!models) return null
    const cands = recommend(models.flex_k, [H.lunar, H.rover], { heptane: 1, D0: 3, xCO2: 0, xHe: 0 })
    const best = [...cands].sort((a, b) => b.value - a.value)[0]
    const cols = 26, rows = 31; const grid = new Float32Array(cols * rows); const max = Math.max(...cands.map(c => c.value)), min = Math.min(...cands.map(c => c.value))
    cands.forEach((c, k) => { const ci = Math.floor(k / rows), ri = k % rows; grid[(rows - 1 - ri) * cols + ci] = (c.value - min) / (max - min) })
    return { best, grid, cols, rows, iss: gpPredict(models.flex_k, [0.21, 1, 0, 0, 1, 3]) }
  }, [models, H])
  const ood = m?.flex_k.ood?.[0]; const lit = useLit(); const b2 = useBass2(); const evo = useEarthVsOrbit(lit); const worst = evo?.[0]

  return <>
    <section className="relative border-b">
      <div className="wrap grid items-center gap-10 py-10 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <h1 className="display text-[42px] sm:text-[52px] xl:text-[60px]">Passes on Earth.<br />Burns in freefall.</h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted-foreground">Materials that pass NASA’s 1-g fire test can still burn in microgravity. This dashboard shows how much margin is lost, and what that means for Moon-base air.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/margin" className="btn btn-primary">Check a material <ArrowRight size={15} /></Link>
            <Link to="/brief/lunar-base" className="btn btn-ghost">Lunar base brief</Link>
          </div>
          <dl className="mt-9 grid max-w-xl grid-cols-1 gap-x-8 gap-y-5 border-t pt-6 sm:grid-cols-3">
            <Stat v={worst ? `${worst.omos.toFixed(1)}` : '…'} tone="text-signal" l="O₂ points of margin lost in microgravity (worst case)" />
            <Stat v={worst ? `30–${(30 - worst.omos).toFixed(1)}` : '…'} tone="text-signal" l="% O₂ Earth ratings to re-test for a Moon base" /><Stat v={`${(st.solidMax * 100).toFixed(1)}%`} l="highest O₂ in any ISS solid test in PSI" />
          </dl>
        </div>
        <figure className="relative w-full justify-self-center overflow-hidden rounded-md bg-[#0a0a0b]">
          <HeroFlame />
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-[12px] text-white/60">BASS-II, ISS, 20 Feb 2014 · raw NASA camera footage (PSI-25)</figcaption>
        </figure>
      </div>
    </section>

    <section className="border-b"><div className="wrap py-10">
      <div className="eyebrow mb-4">New from this project</div>
      <div className="grid gap-px overflow-hidden rounded-[10px] border bg-border md:grid-cols-3">{([
        [`${b2 ? b2.rows.filter(r => r.obs).length : 124}`, 'ISS fire-test outcomes restored', 'PSI lists 129 BASS-II tests without results. We recovered them from NASA’s report.', '/margin?focus=bass2'],
        [`${st.explorSolid}`, 'solid-material tests at Moon-base air', `Every PSI condition mapped. Solid tests stop at ${(st.solidMax * 100).toFixed(1)}% O₂.`, '/investigations'],
        [`${lit?.n_unique ?? 708}`, 'quote-verified measurements', `Mined by SI from ${lit ? Object.keys(lit.papers).length : 84} NASA reports. Each one quotes its source verbatim.`, '/atlas'],
      ] as const).map(([v, t, d, to]) => <Link key={t} to={to} className="group bg-background p-6 transition-colors hover:bg-surface">
        <div className="flex items-baseline gap-3"><span className="num text-[34px] font-semibold leading-none tracking-[-0.02em]">{v}</span><span className="text-[14px] font-medium">{t}</span></div>
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">{d}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground group-hover:text-foreground">Open <ArrowRight size={12} /></span>
      </Link>)}</div>
    </div></section>

    <section className="border-b"><div className="wrap py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6"><div><h2 className="display text-[30px] md:text-[36px]">Best evidence for each habitat</h2>
        <p className="mt-2 max-w-2xl text-[13.5px] text-muted-foreground">ACME BRE leads every habitat. It has the highest fire-safety score in PSI, and its gas burner, built to emulate burning solids, ran from ISS air up to 34% O₂ at reduced pressure.</p></div>
        <Link to="/method" className="link text-[13px] text-muted-foreground">How {db.invs.length} investigations are scored</Link></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{HABS.map(h => <Link key={h} to={`/brief/${HAB_SLUG[h]}`} className="panel card-link group flex flex-col p-5">
        <div className="font-medium">{H[h].label}</div>
        <div className="num mt-1 text-[12px] text-muted-foreground">{(H[h].o2 * 100).toFixed(0)}% O₂ · {(H[h].p_atm * PSIA).toFixed(1)} psia · {H[h].g === 0 ? 'μg' : H[h].g < 0.2 ? '⅙ g' : `${H[h].g} g`}</div>
        <ol className="mt-5 flex-1 space-y-3.5">{top[h].map((r, k) => <li key={r.inv.id}><div className="flex items-baseline justify-between gap-2 text-[13.5px]"><span><span className="num mr-2 text-muted-foreground">{k + 1}</span>{r.inv.acronym}</span><span className="num text-[12px]">{r.score.toFixed(0)}</span></div><Meter value={r.score} className="mt-1.5" label={`${r.inv.acronym} score`} /></li>)}</ol>
        <div className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">Open brief <ArrowRight size={13} /></div>
      </Link>)}</div>
    </div></section>

    <section className="border-b"><div className="wrap py-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><h2 className="display text-[30px]">What SI does here</h2><Link to="/method" className="link text-[13px] text-muted-foreground">How each step is checked</Link></div>
      <SIStrip nInv={db.invs.length} nLit={lit?.n_unique ?? 708} nPapers={lit ? Object.keys(lit.papers).length : 84} nOutcomes={m ? m.flex_k.n + m.flex_ext.n + m.cfig_ign.n : 794} />
    </div></section>

    <section className="border-b"><div className="wrap py-16">
      <Finding n="01" kicker="Earth vs microgravity" title={<>Thin materials burn at lower oxygen in microgravity.</>}
        aside={<div className="max-w-md text-[14.5px] text-muted-foreground"><p>Mean loss {evo ? thinMeanOmos(evo).toFixed(1).replace('-', '−') : '…'} O₂ points, matching NASA’s published −2.6. <Link to="/margin" className="link text-foreground">Check a material</Link></p></div>} />
      <div className="panel p-4 md:p-6">{evo && lit ? <HeadlineChart rows={evo} lit={lit} solidMax={st.solidMax * 100} /> : <div className="aspect-[3/1]" />}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-foreground" />1 g (Earth test)</span><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Microgravity</span><span>Hover for sources · <Link className="link" to="/atlas">all {lit?.n_unique ?? ''} measurements</Link></span></div></div>
    </div></section>

    <section className="border-b"><div className="wrap py-16">
      <Finding n="02" kicker="Evidence gap" title={<>No ISS solid-material test in PSI reaches Moon-base air.</>}
        aside={<div className="grid grid-cols-3 gap-6 border-t pt-6"><Stat v={`${(st.solidMax * 100).toFixed(1)}%`} l="highest O₂ in a solid test" /><Stat v="30%" l="Moon-base design O₂" /><Stat v={st.explorSolid} tone="text-signal" l="solid flames tested near that air" /></div>} />
      <div className="panel p-3 md:p-6"><EnvelopeChart db={db} onPick={acc => nav(`/inv/${acc}`)} /><div className="mt-2 px-2"><EnvelopeLegend /></div></div>
      <div className="mt-6 panel p-4 md:p-6"><div className="eyebrow mb-5">Tested conditions by fuel and atmosphere</div><GapMatrix db={db} /></div>
      <p className="mt-5 text-[13px] text-muted-foreground">Closest flight test outside PSI: Saffire, 26.2% O₂ (<a className="link" href="https://ntrs.nasa.gov/citations/20210011521" target="_blank" rel="noreferrer">NTRS 20210011521</a>).</p>
    </div></section>

    <section className="border-b"><div className="wrap py-16">
      <Finding n="03" kicker="Prediction" title={<>The model predicts high-oxygen flights it never saw.</>}
        aside={ood && <div className="grid grid-cols-3 gap-6 border-t pt-6"><Stat v={ood.mae.toFixed(3)} l={`error on ${ood.n_test} unseen >25% O₂ flights`} /><Stat v={ood.naive_mae.toFixed(3)} tone="text-muted-foreground" l="naive baseline error" /><Stat v={`${(ood.coverage95 * 100).toFixed(0)}%`} tone="text-ok" l="inside the model’s 95% interval" /></div>} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="panel p-4 md:p-6">{cv ? <Parity rows={cv.flex_k} /> : <div className="aspect-square" />}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />≤25% O₂</span><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-signal" />&gt;25% O₂</span><span>Test day held out · bars: 95% interval</span></div></div>
        {m && <div className="panel flex flex-col p-6">
          <table className="tbl"><thead><tr><th>Model · NASA data</th><th className="text-right">Held-out</th><th className="text-right">Baseline</th></tr></thead><tbody className="num">
            <tr><td className="font-sans">Burning rate · FLEX, {m.flex_k.n} rows</td><td className="text-right">R² {m.flex_k.r2.toFixed(2)}</td><td className="text-right text-muted-foreground">MAE {m.flex_k.mae.toFixed(3)} vs {m.flex_k.baseline_mae.toFixed(3)}</td></tr>
            <tr><td className="font-sans">Extinction · FLEX, {m.flex_ext.n} tests</td><td className="text-right">AUC {m.flex_ext.auc.toFixed(2)}</td><td className="text-right text-muted-foreground">{m.flex_ext.logreg_auc.toFixed(2)} logistic</td></tr>
            <tr><td className="font-sans">Hot ignition · CFI-G, {m.cfig_ign.n} tests</td><td className="text-right">Brier {m.cfig_ign.brier.toFixed(3)}</td><td className="text-right text-muted-foreground">{m.cfig_ign.logreg_brier.toFixed(3)} logistic</td></tr>
          </tbody></table>
          <Link to="/lab" className="link mt-auto pt-6 text-[13px]">All three models in the lab</Link>
        </div>}
      </div>
    </div></section>

    <section className="border-b"><div className="wrap grid gap-10 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
      <div><div className="eyebrow mb-3">What to fly next</div>
        <h2 className="display text-[32px] md:text-[40px]">Two experiments that would close the gap.</h2>
        <div className="mt-8 border-t pt-5"><div className="text-[13px] font-medium text-muted-foreground">1 · Solids, the gap itself</div>
          <div className="mt-1.5 text-[19px] font-medium">Thin fabrics and films at 30–34% O₂, in partial gravity</div>
          <p className="mt-1.5 max-w-md text-[13.5px] text-muted-foreground">No PSI solid test exists there. SoFIE, LUCI and FM² are the flights that can add it. <Link to="/margin" className="link">Re-test bands</Link></p></div>
        {rec && <><div className="mt-7 border-t pt-5 text-[13px] font-medium text-muted-foreground">2 · Droplets, chosen by the model</div><div className="num mt-1.5 text-[30px]">{(rec.best.o2 * 100).toFixed(0)}% O₂ · {(rec.best.p * PSIA).toFixed(1)} psia</div>
          <dl className="mt-4 grid max-w-md grid-cols-2 gap-6"><Stat v={`±${(1.96 * rec.best.sd).toFixed(2)}`} l="mm²/s uncertainty today" /><Stat v={`${(rec.best.sd / rec.iss.epistemic).toFixed(1)}×`} l="the uncertainty at ISS air" /></dl>
          <Link to="/lab?model=next" className="btn btn-ghost mt-8">Open the recommender <ArrowRight size={15} /></Link></>}
      </div>
      <div className="panel p-4">{rec && <div className="relative">
        <DitherHeatmap values={rec.grid} cols={rec.cols} rows={rec.rows} className="aspect-[4/3] w-full" label="Expected information value of a new droplet test across oxygen and pressure" />
        <div className="pointer-events-none absolute" style={{ left: `${((rec.best.o2 - 0.15) / 0.25) * 100}%`, top: `${(1 - (rec.best.p - 0.45) / 0.75) * 100}%` }}><div className="h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-signal bg-background/40" /></div>
      </div>}<div className="num mt-3 flex justify-between text-[11.5px] text-muted-foreground"><span>15% O₂</span><span>darker = more to learn</span><span>40% O₂</span></div></div>
    </div></section>

    <section><div className="wrap py-16">
      <div className="grid gap-12 lg:grid-cols-2">
        <div><div className="eyebrow mb-5">Why it matters</div>
          <ul className="divide-y border-y">{[['1967', 'Apollo 1', 'Pure-oxygen cabin fire during a ground test; three crew lost.', 'https://sma.nasa.gov/sma-disciplines/accllp/apollo-1'], ['1997', 'Mir', 'Oxygen-generator fire with six crew aboard; smoke filled the station.', 'https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/'], ['Artemis', 'Lunar habitats', 'Planned at ≥30% O₂ and ≤10.2 psi, outside most flight data.', 'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/']].map(([y, t, d, u]) =>
            <li key={t}><a href={u} target="_blank" rel="noreferrer" className="group grid grid-cols-[72px_1fr_auto] gap-4 py-4"><span className="num text-[13px] text-muted-foreground">{y}</span><span><span className="font-medium">{t}</span><span className="block text-[14px] text-muted-foreground">{d}</span></span><ArrowUpRight size={15} className="text-muted-foreground group-hover:text-foreground" /></a></li>)}</ul></div>
        <div><div className="eyebrow mb-5">Back on Earth</div>
          <ul className="divide-y border-y">{[['Detection', 'Shuttle-era incipient fire detector, adapted to tell smoke from dust in mines.', 'https://spinoff.nasa.gov/node/9407'], ['Breathing air', 'Lighter 30-minute firefighter air packs developed with NASA Johnson.', 'https://spinoff.nasa.gov/node/9582'], ['Protective gear', 'Apollo fire-resistant materials applied to firefighter turnout gear.', 'https://spinoff.nasa.gov/node/9918']].map(([t, d, u]) =>
            <li key={t}><a href={u} target="_blank" rel="noreferrer" className="group grid grid-cols-[110px_1fr_auto] gap-4 py-4"><span className="font-medium">{t}</span><span className="text-[14px] text-muted-foreground">{d}</span><ArrowUpRight size={15} className="text-muted-foreground group-hover:text-foreground" /></a></li>)}</ul>
          </div>
      </div>
    </div></section>
  </>
}
