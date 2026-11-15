import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const B = import.meta.env.BASE_URL
interface Cite { id: string; text: string; src: string }
interface Sentence { text: string; cites: Cite[] }
interface Interp { habitats: Record<string, Sentence[]>; investigations: Record<string, Sentence[]> }
let P: Promise<Interp> | null = null
const sub = (t: string) => t.replace(/\bO2\b/g, 'O₂').replace(/\bCO2\b/g, 'CO₂')
export function useInterp() { const [d, set] = useState<Interp | null>(null); useEffect(() => { (P ??= fetch(`${B}data/interpretations.json`).then(r => r.json())).then(set).catch(() => {}) }, []); return d }

/** Small label marking content written by SI, with how it was checked. */
export function SIBadge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-[3px] bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-medium text-primary', className)}>{children}</span>
}

/** SI-written interpretation; every number was machine-checked against the cited facts (si/verify_interp.py). */
export function SIInterpretation({ kind, id, className }: { kind: 'habitats' | 'investigations'; id: string; className?: string }) {
  const d = useInterp(); const [open, setOpen] = useState<number | null>(null)
  const s = d?.[kind]?.[id]; if (!s?.length) return null
  let n = 0
  return <div className={cn('panel p-5 md:p-6', className)}>
    <div className="mb-3 flex flex-wrap items-center gap-2"><SIBadge>SI interpretation</SIBadge><span className="text-[12px] text-muted-foreground">Written by SI from the facts below; every number is machine-checked against them.</span></div>
    <p className="text-[15.5px] leading-relaxed">{s.map((x, i) => <span key={i}>{sub(x.text)}{x.cites.map(c => { n += 1; const k = n; return <button key={c.id} onClick={() => setOpen(open === k ? null : k)} className={cn('num mx-0.5 align-super text-[10.5px] text-primary hover:underline', open === k && 'underline')} aria-label={`Fact ${c.id}`}>[{c.id}]</button> })}{' '}</span>)}</p>
    {open != null && (() => { let m = 0; for (const x of s) for (const c of x.cites) { m += 1; if (m === open) return <div className="mt-3 border-l-2 border-primary pl-3 text-[13px] text-muted-foreground"><span className="num text-foreground">{c.id}</span> {sub(c.text)} <span className="whitespace-nowrap">· {c.src}</span></div> } return null })()}
  </div>
}

/** How SI powers the dashboard, mapped to the challenge's verbs. Counts are live. */
export function SIStrip({ nInv, nLit, nPapers, nOutcomes }: { nInv: number; nLit: number; nPapers: number; nOutcomes: number }) {
  const d = useInterp(); const nInterp = d ? Object.values(d.habitats).length + Object.values(d.investigations).length : null
  const items: [string, string, string][] = [
    ['Summarizes', `${nInv} PSI records`, 'fuels, conditions and findings, team-reviewed'],
    ['Ranks', `${nInv * 4} scores`, 'prevention, detection, suppression, modeling'],
    ['Mines', `${nLit} measurements`, `from ${nPapers} NASA reports, quote-verified`],
    ['Interprets', nInterp != null ? `${nInterp} briefs` : '…', 'every number machine-checked'],
    ['Predicts', `${nOutcomes} ISS outcomes`, 'held-out validation'],
  ]
  return <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-5">{items.map(([v, n, d2]) => <div key={v} className="bg-background p-5">
    <div className="text-[13px] font-medium text-muted-foreground">{v}</div>
    <div className="num mt-1.5 text-[20px] font-medium tracking-[-0.01em]">{n}</div>
    <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{d2}</p></div>)}</div>
}
