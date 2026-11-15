import { useEffect, useMemo, useState } from 'react'
import { FillPattern } from '@/lib/dither'
const B = import.meta.env.BASE_URL

interface Rec { paper: string; material: string | null; gravity_g: number | null; quantity: string; value: number; unit: string | null; outcome: string | null; basis: string; pressure_kpa: number | null; flow_cm_s: number | null; quote: string }
export interface Lit { records: Rec[]; papers: Record<string, { title: string; year: string; url: string }>; n_unique: number }
let litP: Promise<Lit> | null = null
export function useLit() { const [d, set] = useState<Lit | null>(null); useEffect(() => { (litP ??= fetch(`${B}data/literature.json`).then(r => r.json())).then(set) }, []); return d }

const norm = (m: string) => m.toLowerCase().replace(/\(.*?\)/g, '').replace(/\d+(\.\d+)?\s*(mil|mm|cm|micron).*/, '').replace(/\bcast\b|\brod\b|\bg\b$/g, '').trim()
const LABEL: Record<string, string> = { 'mylar': 'Mylar film', 'ultem 1000': 'Ultem film', 'nomex ht90-40': 'Nomex fabric', 'pmma': 'PMMA rod' }
const o2 = (r: Rec) => { const u = (r.unit || '').toLowerCase(); if (!/o2|oxygen/.test(u)) return null; return r.value <= 1 ? r.value * 100 : r.value }
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }

/** Earth (1 g) vs orbit (µg) limiting oxygen for the same material, from the verified literature database. */
/** NASA's oxygen margin of safety (Olson, Ruff & Miller, NASA/TM-2008-215260, Eq. 1):
 *  OMOS = mean of the 0g limits - mean of the 1g limits, computed within each paper that reports both,
 *  then averaged across papers. Negative = the material burns at lower oxygen in microgravity than in the 1-g test. */
export function earthVsOrbit(lit: Lit) {
  const by: Record<string, Record<string, { ug: number[]; g1: number[] }>> = {}; const quote: Record<string, string> = {}
  for (const r of lit.records) {
    if (!['flammability_limit', 'extinction_o2'].includes(r.quantity) || !['measured', 'estimate'].includes(r.basis)) continue
    if (r.outcome === 'no ignition' || (r.pressure_kpa ?? 0) > 150) continue
    const v = o2(r); if (v == null || (r.gravity_g !== 0 && r.gravity_g !== 1)) continue
    const k = norm(r.material || ''); if (!LABEL[k]) continue
    const e = ((by[k] ??= {})[r.paper] ??= { ug: [], g1: [] })
    if (r.gravity_g === 0) { e.ug.push(v); quote[k] ??= r.quote } else e.g1.push(v)
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  return Object.entries(by).map(([k, papers]) => {
    const both = Object.entries(papers).filter(([, e]) => e.ug.length && e.g1.length)
    if (!both.length) return null
    const ug = mean(both.map(([, e]) => mean(e.ug))), g1 = mean(both.map(([, e]) => mean(e.g1)))
    return { key: k, label: LABEL[k], ug, g1, omos: ug - g1, papers: both.map(([p]) => p), quote: quote[k] ?? '' }
  }).filter((r): r is NonNullable<typeof r> => r != null).sort((a, b) => a.omos - b.omos)
}
/** Mean OMOS over the thin materials (films and fabrics); NASA reported 2.6 points (Urban et al., IAC-12, NTRS 20130000677). */
export const thinMeanOmos = (rows: ReturnType<typeof earthVsOrbit>) => { const t = rows.filter(r => r.key !== 'pmma'); return t.reduce((s, r) => s + r.omos, 0) / t.length }
export function useEarthVsOrbit(lit: Lit | null) { return useMemo(() => lit ? earthVsOrbit(lit) : null, [lit]) }

export function HeadlineChart({ rows, lit, solidMax }: { rows: NonNullable<ReturnType<typeof useEarthVsOrbit>>; lit: Lit; solidMax: number }) {
  const W = 1000, rh = 64, top = 46, H = top + rows.length * rh + 54, L = 170, R = 30, X0 = 12, X1 = 34
  const x = (v: number) => L + ((v - X0) / (X1 - X0)) * (W - L - R)
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Limiting oxygen concentration measured on Earth versus in microgravity for the same materials, against the oxygen levels planned for lunar habitats">
    <defs><FillPattern id="hl-untested" fill="hatched" color="--signal" cell={3} /></defs>
    <rect x={x(solidMax)} y={top - 14} width={x(X1) - x(solidMax)} height={H - top - 30} fill="url(#hl-untested)" opacity={0.35} />
    {[12, 16, 20, 24, 28, 32].map(v => <g key={v}><line x1={x(v)} x2={x(v)} y1={top - 14} y2={H - 44} stroke="var(--border)" /><text x={x(v)} y={H - 24} textAnchor="middle" fontSize={12} className="num" fill="var(--muted-foreground)">{v}%</text></g>)}
    <line x1={x(solidMax)} x2={x(solidMax)} y1={top - 30} y2={H - 44} stroke="var(--signal)" strokeWidth={1.5} />
    <text x={x(solidMax) + 8} y={top - 20} fontSize={12.5} fill="var(--signal)" fontWeight={500}>PSI’s ISS solid-material tests stop at {solidMax.toFixed(1)}% O₂</text>
    <line x1={x(30)} x2={x(30)} y1={top - 14} y2={H - 44} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="5 4" />
    <text x={x(30) - 8} y={H - 50} textAnchor="end" fontSize={12} fill="var(--foreground)">Moon base ≥30%</text>
    {rows.map((r, i) => { const y = top + i * rh + rh / 2; const d = r.omos; const lower = d < -0.3; return <g key={r.key}>
      <text x={0} y={y - 3} fontSize={15} fill="var(--foreground)" fontWeight={500}>{r.label}</text>
      <text x={0} y={y + 15} fontSize={12} className="num" fill={lower ? 'var(--signal)' : 'var(--muted-foreground)'}>{d > 0 ? '+' : ''}{d.toFixed(1)} pts in 0 g</text>
      {r.key === 'pmma' && <text x={0} y={y + 30} fontSize={11.5} className="num" fill="var(--signal)">NASA: −2.4 vs 1-g blowoff</text>}
      <line x1={x(Math.min(r.ug, r.g1))} x2={x(Math.max(r.ug, r.g1))} y1={y} y2={y} stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={2} />
      <circle cx={x(r.g1)} cy={y} r={7} fill="var(--surface)" stroke="var(--foreground)" strokeWidth={2} />
      <circle cx={x(r.ug)} cy={y} r={7} fill="var(--primary)" />
      <text x={x(r.g1) + (r.g1 >= r.ug ? 13 : -13)} y={y + 4} textAnchor={r.g1 >= r.ug ? 'start' : 'end'} fontSize={12} className="num" fill="var(--muted-foreground)">{r.g1.toFixed(1)}</text>
      <text x={x(r.ug) + (r.ug > r.g1 ? 13 : -13)} y={y + 4} textAnchor={r.ug > r.g1 ? 'start' : 'end'} fontSize={12} className="num" fill="var(--primary)">{r.ug.toFixed(1)}</text>
      <title>{`${r.label}: ${r.ug.toFixed(1)}% O₂ in microgravity vs ${r.g1.toFixed(1)}% at 1 g. Sources: ${r.papers.map(p => lit.papers[p]?.title ?? p).join('; ')}`}</title>
    </g> })}
  </svg>
}
