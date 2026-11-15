import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { type DB, CATS, CAT_LABEL, HABS, HAB_SLUG, PSIA, STATUS_LABEL, fmtRange } from '@/data'
import { Meter } from '@/components/Dither'
import { AsciiPhoto } from '@/components/AsciiPhoto'
import { SIInterpretation, SIBadge } from '@/components/SI'

/** Real flight photographs from NASA reports, where we have one for the investigation. */
const PHOTO: Record<string, { file: string; ntrs: string; alt: string; aspect: string }> = {
  'PSI-26': { file: 'bass-flame.png', ntrs: '20140011099', alt: 'A BASS flame on a solid sample aboard the ISS', aspect: 'aspect-[1.2]' },
  'PSI-25': { file: 'bass2-flame.png', ntrs: '20160000593', alt: 'A BASS-II flame over a solid rod aboard the ISS', aspect: 'aspect-[1.6]' },
}
import { useLit } from '@/components/Headline'
import { LitTable, litFor } from '@/components/LitEvidence'

export default function Detail({ db }: { db: DB }) {
  const { id = '' } = useParams(); const inv = db.byId[id]
  const pts = useMemo(() => db.points.filter(p => p.acc === id), [db, id])
  const lit = useLit(); const litRows = useMemo(() => lit && db.byId[id] ? litFor(lit, db.byId[id].acronym) : [], [lit, db, id])
  if (!inv) return <div className="wrap py-24"><p>No investigation {id}. <Link className="link" to="/investigations">See all investigations</Link></p></div>
  const H = db.meta.habitats
  const facts: [string, string][] = [
    ['Fuels', inv.si.fuels.join(', ') || 'not stated'], ['Geometry', inv.si.geometry], ['Oxygen', inv.si.o2], ['Pressure', inv.si.pressure], ['Airflow', inv.si.flow], ['Gravity', inv.si.gravity],
    ['Hardware', inv.si.hardware], ['Sensors', inv.si.sensors.join(', ')], ['Platform', inv.platform], ['Dates', `${inv.startDate} to ${inv.endDate}`], ['Investigators', inv.pis.join(', ')],
  ]
  return <>
    <section className="border-b">
      <div className="wrap py-10 md:py-14">
        <Link to="/investigations" className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> All investigations</Link>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div><div className="eyebrow mb-4">{inv.id} · {inv.family} · {inv.phase}</div>
            <h1 className="display text-[36px] md:text-[44px]">{inv.acronym}</h1>
            <p className="mt-3 text-[17px] text-muted-foreground">{inv.title}</p>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed">{inv.si.summary}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-[13px]">
              <a className="btn btn-ghost h-9" href={inv.sourceUrl} target="_blank" rel="noreferrer">PSI record <ExternalLink size={13} /></a>
              {inv.doiUrl && <a className="btn btn-ghost h-9" href={inv.doiUrl} target="_blank" rel="noreferrer">Dataset DOI <ExternalLink size={13} /></a>}
              <a className="btn btn-ghost h-9" href={inv.apiUrl} target="_blank" rel="noreferrer">Raw JSON <ExternalLink size={13} /></a>
            </div>
          </div>
          {PHOTO[inv.id] && <figure><div className="overflow-hidden rounded-md bg-[#0a0a0b] p-3"><AsciiPhoto src={`${import.meta.env.BASE_URL}img/${PHOTO[inv.id].file}`} alt={PHOTO[inv.id].alt} cell={11} className={PHOTO[inv.id].aspect + ' w-full'} /></div>
            <figcaption className="mt-2 text-[12.5px] text-muted-foreground">{PHOTO[inv.id].alt}. <a className="link" href={`https://ntrs.nasa.gov/citations/${PHOTO[inv.id].ntrs}`} target="_blank" rel="noreferrer">NASA, NTRS {PHOTO[inv.id].ntrs}</a>, rendered as text.</figcaption></figure>}
        </div>
      </div>
    </section>
    <div className="wrap grid gap-12 py-12 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-12">
        <SIInterpretation kind="investigations" id={inv.id} />
        <section><div className="mb-5 flex flex-wrap items-center gap-3"><h2 className="display text-[30px]">Key findings</h2><SIBadge>SI extraction · team-reviewed</SIBadge></div>
          <ol className="space-y-4">{inv.si.findings.map((f, i) => <li key={i} className="grid grid-cols-[28px_1fr] gap-3 text-[15.5px] leading-relaxed"><span className="num pt-0.5 text-[12.5px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>{f}</li>)}</ol></section>
        <section><div className="mb-5 flex flex-wrap items-center gap-3"><h2 className="display text-[30px]">Structured extraction</h2><SIBadge>SI extraction · team-reviewed</SIBadge></div>
          <dl className="divide-y border-y">{facts.map(([k, v]) => <div key={k} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="text-[13px] text-muted-foreground">{k}</dt><dd className="text-[14.5px]">{v || 'unknown'}</dd></div>)}</dl>
          <p className="mt-3 text-[12.5px] text-muted-foreground">Fields not stated in the PSI record are marked unknown rather than guessed.</p></section>
        {pts.length > 0 && <section><h2 className="display mb-2 text-[30px]">Tabulated conditions</h2>
          <p className="mb-5 text-[14px] text-muted-foreground">{pts.length} points parsed from {inv.tables.length} experiment table{inv.tables.length === 1 ? '' : 's'} ({inv.tableRows} rows). O₂ {fmtRange(inv.ranges.o2_frac, x => `${+(x * 100).toFixed(1)}%`)}, pressure {fmtRange(inv.ranges.p_atm, x => `${(x * PSIA).toFixed(1)} psia`)}.</p>
          <div className="max-h-[360px] overflow-auto rounded-md border"><table className="tbl"><thead className="sticky top-0 bg-background"><tr><th>Test</th><th>O₂</th><th>Pressure</th><th>Fuel</th><th>Status</th><th>NASA source</th><th>Verbatim cells</th></tr></thead>
            <tbody className="num text-[12.5px]">{pts.slice(0, 400).map((p, i) => <tr key={i}><td>{p.test}</td><td>{p.o2 != null ? `${(p.o2 * 100).toFixed(1)}%` : '·'}</td><td className="whitespace-nowrap">{p.p_atm != null ? `${(p.p_atm * PSIA).toFixed(2)} psia` : '·'}</td><td className="font-sans">{p.fuel}</td><td className="font-sans text-muted-foreground">{STATUS_LABEL[p.status ?? p.kind] ?? p.kind}</td><td className="num text-muted-foreground">{p.src ? `${p.src.table.replace(/^PSI-\d+_Experimental_table_/, '')}:${p.src.line}` : '·'}</td><td className="font-sans text-[11.5px] text-muted-foreground">{p.src && (p.src.cells.o2 || p.src.cells.p) ? [p.src.cells.o2, p.src.cells.p].filter((c): c is [string, string] => !!c).map(([col, cell], j) => <div key={j}>{col} = {cell}</div>) : '·'}</td></tr>)}</tbody></table></div></section>}
        {lit && litRows.length > 0 && <section><div className="mb-2 flex flex-wrap items-center gap-3"><h2 className="display text-[30px]">Measurements in NASA reports</h2><SIBadge>SI-extracted · quote-verified</SIBadge></div>
          <p className="mb-5 text-[14px] text-muted-foreground">{litRows.length} verified records from {new Set(litRows.map(r => r.paper)).size} reports name {inv.acronym}. Open a row for its verbatim quote.</p>
          <LitTable rows={litRows} lit={lit} max={10} /></section>}
        <section><h2 className="display mb-5 text-[30px]">From the PSI record</h2>
          <div className="space-y-6">{(['objective', 'approach', 'hypothesis', 'impacts'] as const).filter(k => inv.psi[k]).map(k => <div key={k}><div className="eyebrow mb-2">{k}</div><div className="prose-psi whitespace-pre-line text-[14.5px] leading-relaxed text-muted-foreground">{inv.psi[k]}</div></div>)}</div></section>
        {inv.publications.length > 0 && <section><h2 className="display mb-5 text-[30px]">Publications</h2>
          <ul className="divide-y border-y">{inv.publications.map((p, i) => <li key={i} className="py-3 text-[14px]">{p.doi ? <a className="link" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.title}</a> : p.title}<div className="mt-1 text-[12.5px] text-muted-foreground">{p.authors}</div></li>)}</ul></section>}
      </div>
      <aside className="space-y-10 lg:sticky lg:top-20 lg:self-start">
        <div><div className="eyebrow mb-4">Fire-safety relevance</div>
          <div className="mb-5 flex items-baseline gap-2"><span className="num text-[40px] leading-none">{inv.fireSafetyIndex}</span><span className="text-[13px] text-muted-foreground">/ 100 index</span></div>
          <div className="space-y-4">{CATS.map(c => <div key={c}><div className="mb-1.5 flex justify-between text-[13px]"><span>{CAT_LABEL[c]}</span><span className="num">{inv.categories[c].score}/10</span></div><Meter value={inv.categories[c].score} max={10} label={`${CAT_LABEL[c]} score`} /><p className="mt-1.5 text-[12.5px] text-muted-foreground">{inv.categories[c].rationale}</p></div>)}</div></div>
        <div><div className="eyebrow mb-4">Habitat scores</div>
          <ul className="space-y-3">{HABS.map(h => <li key={h}><Link to={`/brief/${HAB_SLUG[h]}`} className="group block"><div className="mb-1.5 flex justify-between text-[13px]"><span className="group-hover:underline">{H[h].label}</span><span className="num">{inv.habitats[h].score}</span></div><Meter value={inv.habitats[h].score} tone="ink" label={`${H[h].label} score`} /></Link></li>)}</ul></div>
        {inv.si.earth.length > 0 && <div><div className="eyebrow mb-3">On Earth</div><ul className="space-y-2 text-[13.5px] text-muted-foreground">{inv.si.earth.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      </aside>
    </div>
  </>
}
