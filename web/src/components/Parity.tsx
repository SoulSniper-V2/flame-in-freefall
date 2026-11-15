import { useEffect, useState } from 'react'
const B = import.meta.env.BASE_URL
export interface CVRow { x: number[]; y: number; pred: number; sd: number; day: string }
let cvP: Promise<any> | null = null
export function useCV() { const [d, set] = useState<any>(null); useEffect(() => { (cvP ??= fetch(`${B}models/cv.json`).then(r => r.json())).then(set) }, []); return d as { flex_k: CVRow[]; flex_ext: any[]; cfig_ign: any[] } | null }

/** Held-out prediction vs NASA measurement for the burning-rate GP, with 95% intervals. */
export function Parity({ rows, size = 420, compact = false }: { rows: CVRow[]; size?: number; compact?: boolean }) {
  const pad = compact ? 28 : 56, W = size, H = size, lo = 0, hi = 1.1
  const sx = (v: number) => pad + ((v - lo) / (hi - lo)) * (W - pad - 10), sy = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - pad - 10)
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Held-out predicted versus measured FLEX burning-rate constant">
    {ticks.map(t => <g key={t}><line x1={sx(t)} x2={sx(t)} y1={sy(lo)} y2={sy(hi)} stroke="var(--border)" /><line x1={sx(lo)} x2={sx(hi)} y1={sy(t)} y2={sy(t)} stroke="var(--border)" />
      {!compact && <><text x={sx(t)} y={H - pad + 16} fontSize={11.5} textAnchor="middle" fill="var(--muted-foreground)" className="num">{t}</text><text x={pad - 8} y={sy(t) + 3.5} fontSize={11.5} textAnchor="end" fill="var(--muted-foreground)" className="num">{t}</text></>}</g>)}
    <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} stroke="var(--foreground)" strokeDasharray="4 4" strokeWidth={1} />
    {rows.map((r, i) => { const hiO2 = r.x[0] > 0.25; return <g key={i} opacity={0.8}>
      {!compact && <line x1={sx(r.y)} x2={sx(r.y)} y1={sy(r.pred - 1.96 * r.sd)} y2={sy(r.pred + 1.96 * r.sd)} stroke={hiO2 ? 'var(--signal)' : 'var(--primary)'} strokeOpacity={0.25} />}
      <circle cx={sx(r.y)} cy={sy(r.pred)} r={hiO2 ? 3.4 : 2.4} fill={hiO2 ? 'var(--signal)' : 'var(--primary)'} /></g> })}
    {!compact && <><text x={(W + pad) / 2} y={H - 6} fontSize={11.5} textAnchor="middle" fill="var(--muted-foreground)">Measured on ISS (mm²/s)</text>
      <text transform={`translate(14 ${(H - pad) / 2}) rotate(-90)`} fontSize={11.5} textAnchor="middle" fill="var(--muted-foreground)">Predicted, test day held out</text></>}
  </svg>
}
