import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type DB, HABS, HAB_SLUG } from '@/data'
import { PageHead, Loading } from '@/components/Shell'
import { HeadlineChart, useEarthVsOrbit, useLit } from '@/components/Headline'
import { envelopeStats } from '@/components/Envelope'
import { FillPattern } from '@/lib/dither'
import { REPORTED, check, clsOf, looCheck, omosStats, VERDICT, type Cls } from '@/margin'
import { cn } from '@/lib/utils'
import { useBass2, BassTwoChart, BassTwoTable, BassTwoFlags } from '@/components/BassTwo'

const NTRS = (id: string) => `https://ntrs.nasa.gov/citations/${id}`

export default function Margin({ db }: { db: DB }) {
  const lit = useLit(); const rows = useEarthVsOrbit(lit); const b2 = useBass2(); const st = useMemo(() => envelopeStats(db), [db])
  const H = db.meta.habitats
  const [mat, setMat] = useState<string>('custom'); const [limit, setLimit] = useState(31); const [cls, setCls] = useState<Cls>('thin')
  const [hab, setHab] = useState<string>('lunar')
  const [qs] = useSearchParams(); const focus = qs.get('focus')
  useEffect(() => { if (focus && b2 && rows) requestAnimationFrame(() => document.getElementById(focus)?.scrollIntoView({ block: 'start' })) }, [focus, b2, rows])
  if (!rows || !lit) return <Loading what="the verified literature" />
  const thin = omosStats(rows, 'thin'), thick = omosStats(rows, 'thick'), S = cls === 'thin' ? thin : thick
  const habO2 = H[hab as keyof typeof H].o2 * 100
  const c = check(limit, habO2, S); const loo = looCheck(rows)
  const pick = (k: string) => { setMat(k); const r = rows.find(x => x.key === k); if (r) { setLimit(+r.g1.toFixed(2)); setCls(clsOf(k)) } }
  const measured = rows.find(r => r.key === mat)

  return <>
    <PageHead eyebrow="Oxygen margin of safety" title="Oxygen margin of safety">
      How much lower oxygen a material burns at in microgravity than in NASA’s 1-g test, and which materials that flags for re-test.
    </PageHead>
    <div className="wrap space-y-20 py-14">
      <section>
        <h2 className="display mb-2 text-[32px]">Check a material</h2>
        <p className="mb-6 text-[14.5px] text-muted-foreground">Enter your material’s NASA-STD-6001 Test 1 limit and pick a habitat. The verdict uses the largest microgravity loss measured so far.</p>
        <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
          <div className="space-y-6">
            <div><div className="mb-2 text-[13px]">Material</div><div className="flex flex-wrap gap-1.5">{[...rows.map(r => [r.key, r.label]), ['custom', 'Your material']].map(([k, l]) => <button key={k} onClick={() => k === 'custom' ? setMat('custom') : pick(k)} className={cn('rounded border px-2.5 py-1.5 text-[12.5px]', mat === k ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground')}>{l}</button>)}</div></div>
            <div><div className="mb-2 flex justify-between text-[13px]"><span>1-g limiting oxygen (Test 1)</span><span className="num">{limit.toFixed(1)}%</span></div>
              <input type="range" min={12} max={45} step={0.1} value={limit} onChange={e => { setLimit(+e.target.value); setMat('custom') }} className="w-full accent-[var(--primary)]" aria-label="1-g limiting oxygen" /></div>
            <div><div className="mb-2 text-[13px]">Class</div><div className="grid grid-cols-2 gap-1">{(['thin', 'thick'] as Cls[]).map(k => <button key={k} onClick={() => { setCls(k); setMat('custom') }} className={cn('rounded border py-1.5 text-[12.5px]', cls === k ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground')}>{k === 'thin' ? 'Thin film or fabric' : 'Thick solid'}</button>)}</div></div>
            <div><div className="mb-2 text-[13px]">Habitat</div><div className="flex flex-wrap gap-1.5">{HABS.map(h => <button key={h} onClick={() => setHab(h)} className={cn('rounded border px-2.5 py-1.5 text-[12.5px]', hab === h ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground')}>{H[h].label} · {(H[h].o2 * 100).toFixed(0)}%</button>)}</div></div>
          </div>
          <div className="panel p-6">
            <div className={cn('text-[22px] font-medium leading-snug', VERDICT[c.verdict].tone)}>{VERDICT[c.verdict].h}</div>
            <MarginLine limit={limit} habO2={habO2} orbitMean={c.orbitMean} orbitWorst={c.orbitWorst} measured={measured?.ug} habLabel={H[hab as keyof typeof H].label} />
            <dl className="mt-4 grid grid-cols-2 gap-6 border-t pt-5 sm:grid-cols-4">
              <div><dt className="text-[12px] text-muted-foreground">Margin at 1 g</dt><dd className="num text-[22px]">{c.margin1g > 0 ? '+' : ''}{c.margin1g.toFixed(1)}</dd></div>
              <div><dt className="text-[12px] text-muted-foreground">Expected 0 g limit</dt><dd className="num text-[22px]">{c.orbitMean.toFixed(1)}%</dd></div>
              <div><dt className="text-[12px] text-muted-foreground">Worst case so far</dt><dd className="num text-[22px]">{c.orbitWorst.toFixed(1)}%</dd></div>
              <div><dt className="text-[12px] text-muted-foreground">Margin in 0 g, worst</dt><dd className={cn('num text-[22px]', c.marginOrbit <= 0 && 'text-signal')}>{c.marginOrbit > 0 ? '+' : ''}{c.marginOrbit.toFixed(1)}</dd></div>
            </dl>
            <p className="mt-5 text-[12.5px] text-muted-foreground">Based on {S.n} {cls} materials (margin {S.worst.toFixed(1)} to {S.best > 0 ? '+' : ''}{S.best.toFixed(1)}). Flags materials for testing; does not rate them.</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="display mb-2 text-[32px]">The margin, recomputed</h2>
        <p className="mb-6 text-[14.5px] text-muted-foreground">Mean 0-g limit minus mean 1-g limit (NASA/TM-2008-215260, Eq. 1). Negative = burns at lower oxygen in microgravity.</p>
        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="panel p-4 md:p-6"><HeadlineChart rows={rows} lit={lit} solidMax={st.solidMax * 100} /></div>
          <div className="space-y-4">
            <div className="panel p-6"><div className="eyebrow mb-3">Consistency check</div>
              <div className="flex items-baseline gap-6"><div><div className="num text-[40px] leading-none">{thin.mean.toFixed(2)}</div><div className="mt-2 text-[12.5px] text-muted-foreground">our mean, {thin.n} thin materials</div></div>
                <div><div className="num text-[40px] leading-none text-muted-foreground">−2.6</div><div className="mt-2 text-[12.5px] text-muted-foreground">NASA’s published mean</div></div></div>
              <p className="mt-4 text-[13px] text-muted-foreground">Matches NASA’s published −2.6 (<a className="link" href={NTRS('20130000677')} target="_blank" rel="noreferrer">NTRS 20130000677</a>). A consistency check, not a replication: the thin materials come from one report.</p></div>
            <div className="panel p-6"><div className="eyebrow mb-3">Per material</div>
              <table className="tbl text-[13px]"><thead><tr><th>Material</th><th>1 g</th><th>0 g</th><th>Margin</th></tr></thead>
                <tbody>{rows.map(r => <tr key={r.key}><td>{r.label}</td><td className="num">{r.g1.toFixed(2)}</td><td className="num">{r.ug.toFixed(2)}</td><td className={cn('num', r.omos < -0.5 ? 'text-signal' : '')}>{r.omos > 0 ? '+' : ''}{r.omos.toFixed(2)}</td></tr>)}
                  {REPORTED.filter(x => x.cls === 'thick').map(x => <tr key={x.label} className="text-muted-foreground"><td>{x.label}</td><td>·</td><td>·</td><td className="num">{x.omos.toFixed(1)}*</td></tr>)}</tbody></table>
              <p className="mt-3 text-[12px] text-muted-foreground">% O₂. *Reported by NASA, not recomputed; the check uses these for thick fuels.</p></div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="display mb-2 text-[32px]">Re-test bands</h2>
        <p className="mb-6 text-[14.5px] text-muted-foreground">Thin materials rated in this band pass on Earth but may burn in microgravity.</p>
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Habitat</th><th>Design O₂</th><th>Re-test if the 1-g limit is between</th><th /></tr></thead>
          <tbody>{HABS.map(h => { const o = H[h].o2 * 100; return <tr key={h}><td>{H[h].label}</td><td className="num">{o.toFixed(0)}%</td><td className="num">{o.toFixed(1)}% and {(o - thin.worst).toFixed(1)}%</td><td><Link className="link text-[13px]" to={`/brief/${HAB_SLUG[h]}`}>Brief</Link></td></tr> })}</tbody></table></div>
        
      </section>

      <section>
        <h2 className="display mb-2 text-[32px]">Does the de-rating hold for a material it has not seen?</h2>
        <p className="mb-6 text-[14.5px] text-muted-foreground">Each material held out and predicted from the other two.</p>
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Held out</th><th>Measured 0 g limit</th><th>Predicted, mean loss</th><th>Predicted, worst loss</th><th>Worst case conservative?</th></tr></thead>
          <tbody>{loo.map(r => <tr key={r.label}><td>{r.label}</td><td className="num">{r.measured.toFixed(2)}%</td><td className="num">{r.predMean.toFixed(2)}%</td><td className="num">{r.predWorst.toFixed(2)}%</td><td className={r.conservative ? 'text-ok' : 'text-signal'}>{r.conservative ? 'yes' : `no, by ${(r.predWorst - r.measured).toFixed(1)} points`}</td></tr>)}</tbody></table></div>
        <p className="mt-4 text-[13px] text-muted-foreground">Mylar lost more than predicted: three materials cannot bound the loss.</p>
      </section>

      {b2 && <section id="bass2" className="scroll-mt-20">
        <div className="eyebrow mb-3">New data · solid materials on the ISS</div>
        <h2 className="display mb-2 text-[32px]">What actually burned on the Space Station</h2>
        <p className="mb-6 text-[14.5px] text-muted-foreground">PSI lists {b2.n_tests} BASS-II tests without outcomes. We restored them from NASA’s report (<a className="link" href={NTRS('20210011385')} target="_blank" rel="noreferrer">NASA/TM-20210011385</a>).</p>
        <dl className="mb-8 grid max-w-4xl grid-cols-2 gap-6 border-t pt-5 sm:grid-cols-4">
          <div><dt className="num text-[30px]">{b2.rows.filter(r => r.obs).length}</dt><dd className="text-[12.5px] text-muted-foreground">test outcomes restored from the report</dd></div>
          <div><dt className="num text-[30px]">{b2.model.n}</dt><dd className="text-[12.5px] text-muted-foreground">decidable (sustained or went out) for 5 materials</dd></div>
          <div><dt className="num text-[30px]">{b2.model.n_out}</dt><dd className="text-[12.5px] text-muted-foreground">of those went out: the cases that carry the model</dd></div>
          <div><dt className="num text-[30px]">{b2.model.loo_brier.toFixed(3)}</dt><dd className="text-[12.5px] text-muted-foreground">held-out Brier score vs {b2.model.baseline_brier.toFixed(3)} for the base rate ({Math.round(b2.model.brier_skill * 100)}% skill)</dd></div>
        </dl>
        <div className="panel p-4 md:p-6"><BassTwoChart d={b2} /></div>
        <div className="mt-8"><BassTwoTable d={b2} /></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 text-[14px] text-muted-foreground">
            <p><b className="font-medium text-foreground">PMMA rods</b> burned down to <span className="num text-foreground">14.8%</span> O₂; 50% burn point <span className="num text-foreground">{b2.model.o2_50.rod.est.toFixed(1)}%</span>, below the 16% 1-g blowoff limit.</p>
            <p><b className="font-medium text-foreground">Nomex III</b> never burned, even at 22.2%, matching NASA’s 22% limit. Slab (all burned) and Nomex have no 50% point.</p>
            <p>Labels written by SI from NASA’s observations, cross-checked against an independent paper. Accuracy {Math.round(b2.model.loo_acc * 100)}% vs {Math.round(b2.model.always_burn_acc * 100)}% always-burn, so we report Brier. No flow term. <Link className="link" to="/method">Details</Link></p>
          </div>
          <BassTwoFlags d={b2} />
        </div>
      </section>}
    </div>
  </>
}

function MarginLine({ limit, habO2, orbitMean, orbitWorst, measured, habLabel }: { limit: number; habO2: number; orbitMean: number; orbitWorst: number; measured?: number; habLabel: string }) {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640
  const W = narrow ? 400 : 760, Hh = 150, L = 16, R = 16, X0 = narrow ? 12 : 10, X1 = narrow ? 42 : 46, x = (v: number) => L + (Math.min(X1, Math.max(X0, v)) - X0) / (X1 - X0) * (W - L - R), y = 78
  return <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-5 h-auto w-full" role="img" aria-label={`1-g limit ${limit.toFixed(1)}% O2, estimated 0 g limit ${orbitWorst.toFixed(1)} to ${orbitMean.toFixed(1)}%, habitat ${habO2.toFixed(0)}%`}>
    <defs><FillPattern id="ml-band" fill="hatched" color="--primary" cell={3} /></defs>
    {(narrow ? [15, 20, 25, 30, 35, 40] : [10, 15, 20, 25, 30, 35, 40, 45]).map(v => <g key={v}><line x1={x(v)} x2={x(v)} y1={30} y2={y + 30} stroke="var(--border)" /><text x={x(v)} y={Hh - 14} textAnchor="middle" fontSize={12} className="num" fill="var(--muted-foreground)">{v}%</text></g>)}
    <rect x={x(orbitWorst)} y={y - 12} width={Math.max(2, x(orbitMean) - x(orbitWorst))} height={24} fill="url(#ml-band)" stroke="var(--primary)" />
    <line x1={x(orbitMean)} x2={x(limit)} y1={y} y2={y} stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={2} />
    <circle cx={x(limit)} cy={y} r={7} fill="var(--surface)" stroke="var(--foreground)" strokeWidth={2} />
    <text x={x(limit)} y={y - 20} textAnchor="middle" fontSize={12} fill="var(--foreground)">1 g test</text>
    <text x={(x(orbitWorst) + x(orbitMean)) / 2} y={y + 32} textAnchor="middle" fontSize={12} fill="var(--primary)">in 0 g</text>
    {measured != null && <g><circle cx={x(measured)} cy={y} r={5} fill="var(--primary)" /><text x={x(measured)} y={y - 20} textAnchor="middle" fontSize={11} fill="var(--primary)">measured</text></g>}
    <line x1={x(habO2)} x2={x(habO2)} y1={18} y2={y + 30} stroke="var(--signal)" strokeWidth={2} strokeDasharray="5 4" />
    <text x={x(habO2) + 6} y={22} fontSize={12} fill="var(--signal)" fontWeight={500}>{habLabel} {habO2.toFixed(0)}%</text>
  </svg>
}
