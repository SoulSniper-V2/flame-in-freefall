import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { useLit } from '@/components/Headline'
import { cn } from '@/lib/utils'

type Lit = NonNullable<ReturnType<typeof useLit>>
export type LitRec = Lit['records'][number] & { investigation?: string | null; o2_pct?: number | null }

const Q: Record<string, string> = {
  flame_spread_rate: 'Flame spread', flammability_limit: 'Flammability limit', extinction_o2: 'Extinction O₂', extinction_flow: 'Extinction flow',
  flame_length: 'Flame length', flame_width: 'Flame width', ignition_time: 'Ignition time', ignition_energy: 'Ignition energy', burning_rate: 'Burning rate',
  heat_flux: 'Heat flux', smoke_particle_size: 'Smoke particle size', other: 'Other',
}
const BASIS: Record<string, string> = { measured: 'measured', estimate: 'estimate', model: 'model', cited: 'cited' }
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
export const fmtGrav = (g: number | null) => g == null ? '·' : g === 0 ? 'µg' : g === 1 ? '1 g' : `${+g.toFixed(3)} g`

/** Verified literature records as a compact table; each row opens to its verbatim quote and source. */
export function LitTable({ rows, lit, max = 12 }: { rows: LitRec[]; lit: Lit; max?: number }) {
  const [open, setOpen] = useState<number | null>(null); const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, max)
  return <>
    <div className="overflow-x-auto"><table className="tbl">
      <thead><tr><th>Quantity</th><th>Value</th><th>Material</th><th>Gravity</th><th>O₂</th><th>Basis</th><th>Source</th></tr></thead>
      <tbody>{shown.map((r, i) => { const p = lit.papers[r.paper]; const isOpen = open === i; return [
        <tr key={i} className="row-link" onClick={() => setOpen(isOpen ? null : i)}>
          <td className="text-[13px]">{Q[r.quantity] ?? r.quantity}</td>
          <td className="num whitespace-nowrap text-[13px]">{r.value} {r.unit}</td>
          <td className="text-[13px]">{r.material ?? '·'}</td>
          <td className="num text-[12.5px]">{fmtGrav(r.gravity_g)}</td>
          <td className="num text-[12.5px]">{r.o2_pct != null ? `${r.o2_pct}%` : '·'}</td>
          <td className={cn('text-[12.5px]', r.basis === 'measured' ? 'text-foreground' : 'text-signal')}>{BASIS[r.basis] ?? r.basis}</td>
          <td className="num text-[12px] text-muted-foreground">{p?.year ?? ''} · {r.paper}</td>
        </tr>,
        isOpen && <tr key={`${i}q`}><td colSpan={7} className="bg-muted/40">
          <blockquote className="border-l-2 border-primary py-1 pl-3 text-[13.5px]">“{clean(r.quote)}”</blockquote>
          {p && <a className="link mt-2 inline-flex items-center gap-1 text-[12.5px]" href={p.url} target="_blank" rel="noreferrer">{p.title} <ExternalLink size={11} /></a>}
        </td></tr>,
      ] })}</tbody>
    </table></div>
    {!all && rows.length > max && <button onClick={() => setAll(true)} className="btn btn-ghost no-print mt-3">Show all {rows.length}</button>}
  </>
}

/** Literature records relevant to an atmosphere: partial-gravity tests first, then the closest oxygen levels. */
export function litNear(lit: Lit, o2pct: number, g: number) {
  const recs = lit.records as LitRec[]
  const partial = recs.filter(r => r.gravity_g != null && r.gravity_g > 0 && r.gravity_g < 1)
    .sort((a, b) => Math.abs(a.gravity_g! - g) - Math.abs(b.gravity_g! - g))
  const near = recs.filter(r => r.o2_pct != null && Math.abs(r.o2_pct - o2pct) <= 4 && r.quantity !== 'other' && !(r.gravity_g! > 0 && r.gravity_g! < 1))
    .sort((a, b) => (Math.abs(a.o2_pct! - o2pct) - Math.abs(b.o2_pct! - o2pct)) || ((a.basis === 'measured' ? 0 : 1) - (b.basis === 'measured' ? 0 : 1)))
  const above = recs.filter(r => r.o2_pct != null && r.o2_pct >= o2pct - 0.5 && r.gravity_g === 0).length
  return { partial, near, above }
}

/** Literature records for a PSI investigation, matched exactly on the investigation name the extractor recorded. */
const normInv = (s: string) => s.toLowerCase().replace(/^acme\s+/, '').replace(/\s*\(.*\)\s*/g, '').trim()
export function litFor(lit: Lit, acronym: string) {
  const keys = new Set(acronym.split('/').map(normInv))
  return (lit.records as LitRec[]).filter(r => r.investigation && r.investigation.split('/').some(part => keys.has(normInv(part))))
}

/** Questions about Earth-test conservatism or the oxygen margin. */
export const MARGIN_Q = /6001|conservativ|margin|screening|earth test|1-?g test|upward[- ]burn|derat|flammability limit|limiting oxygen/i
const STOP = new Set('the a an of in on at to and or for is are how what does do with by from vs than at about which when where why this that it be can flame flames fire fires burn burns burning work matter design nasa they them'.split(' '))
/** Rank verified literature records for a free-text question: term overlap on material, quantity, investigation and quote,
 *  plus closeness to a named oxygen level and gravity. Returns records with the terms that matched. */
export function litQuery(lit: Lit, q: string, o2pct: number | null, g: number | null) {
  const terms = q.toLowerCase().replace(/[^a-z0-9.%\s-]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t) && !/^\d/.test(t)).map(t => t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t)
  const words = q.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean).map(w => w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  const bigrams = words.slice(1).map((w, i) => `${words[i]} ${w}`).filter(b => b.split(' ').some(w => !STOP.has(w)) && b.split(' ').every(w => w.length > 2))
  const out: { r: LitRec; s: number }[] = []
  for (const r of lit.records as LitRec[]) {
    const hay = `${r.material ?? ''} ${Q[r.quantity] ?? r.quantity} ${r.investigation ?? ''} ${clean(r.quote)}`.toLowerCase()
    let s = 0; for (const t of terms) if (hay.includes(t)) s += (r.material ?? '').toLowerCase().includes(t) || (Q[r.quantity] ?? '').toLowerCase().includes(t) ? 2 : 1
    if (o2pct != null && r.o2_pct != null) s += Math.max(0, 2 - Math.abs(r.o2_pct - o2pct) / 2)
    if (g != null && r.gravity_g != null) s += g > 0 && g < 1 ? (r.gravity_g > 0 && r.gravity_g < 1 ? 3 : 0) : r.gravity_g === g ? 0.5 : 0
    for (const bg of bigrams) if (hay.includes(bg)) s += 2
    if (/suppress|extinguish/i.test(q) && /extinction|extinguish/.test(`${r.quantity} ${hay}`)) s += 1
    if (MARGIN_Q.test(q) && (r.quantity === 'flammability_limit' || r.quantity === 'extinction_o2') && (r.gravity_g === 0 || r.gravity_g === 1)) s += 2
    if (r.basis === 'measured') s += 0.25
    if (s >= 2) out.push({ r, s })
  }
  return out.sort((a, b) => b.s - a.s).map(x => x.r)
}
