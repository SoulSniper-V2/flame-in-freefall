import { useId, useMemo, useState } from 'react'
import { FillPattern } from '@/lib/dither'
import { type DB, type HabKey, PSIA, phaseOf } from '@/data'

const PH_COLOR = { solid: 'var(--signal)', liquid: 'var(--primary)', gas: 'var(--muted-foreground)', other: 'var(--muted-foreground)' } as const
export const PH_LABEL = { solid: 'Solid materials', liquid: 'Liquid droplets', gas: 'Gaseous flames', other: 'Other' } as const

export function envelopeStats(db: DB) {
  const pts = db.points.filter(p => p.o2 != null)
  const solid = pts.filter(p => phaseOf(db.byId[p.acc]) === 'solid')
  const solidMax = Math.max(...solid.map(p => p.o2!))
  const explor = pts.filter(p => p.o2! >= 0.26 && p.p_atm != null && p.p_atm * PSIA <= 10.6 && p.p_atm * PSIA >= 7)
  const explorSolid = explor.filter(p => phaseOf(db.byId[p.acc]) === 'solid')
  const explorReal = explor.filter(p => p.kind !== 'target')
  return { n: pts.length, withP: pts.filter(p => p.p_atm != null).length, solidN: solid.length, solidMax, explor: explor.length, explorSolid: explorSolid.length, explorReal: explorReal.length, explorBy: [...new Set(explor.map(p => db.byId[p.acc]?.acronym))] }
}

export function EnvelopeChart({ db, focus, custom, height = 460, onPick }: { db: DB; focus?: HabKey | null; custom?: { o2: number; psia: number } | null; height?: number; onPick?: (acc: string) => void }) {
  const W = 1000, H = height, m = { l: 56, r: 24, t: 20, b: 64 }
  const X0 = 10, X1 = 90, Y0 = 3.5, Y1 = 52
  const x = (o2pct: number) => m.l + ((Math.min(X1, o2pct) - X0) / (X1 - X0)) * (W - m.l - m.r)
  const y = (ps: number) => H - m.b - ((Math.log(Math.min(Y1, Math.max(Y0, ps))) - Math.log(Y0)) / (Math.log(Y1) - Math.log(Y0))) * (H - m.t - m.b)
  const hid = useId().replace(/:/g, ''); const [hover, setHover] = useState<string | null>(null)
  const pts = useMemo(() => db.points.filter(p => p.o2 != null).map(p => ({ ...p, ph: phaseOf(db.byId[p.acc]) })), [db])
  const habs = db.meta.habitats
  const marks: { k: string; label: string; o2: number; ps: number; dx?: number; dy?: number; anchor?: 'start' | 'end' }[] = [
    { k: 'iss', label: 'ISS / Earth cabin', o2: habs.iss.o2 * 100, ps: habs.iss.p_atm * PSIA },
    { k: 'lunar', label: 'Lunar & Mars base', o2: habs.lunar.o2 * 100, ps: habs.lunar.p_atm * PSIA, dx: -12, dy: -12, anchor: 'end' },
    { k: 'rover', label: 'Pressurized rover', o2: habs.rover.o2 * 100, ps: habs.rover.p_atm * PSIA, dx: 14, dy: 4, anchor: 'start' },
  ]
  const focusMark = focus === 'mars' ? 'lunar' : focus === 'spacecraft' ? 'iss' : focus
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label={`Scatter of ${pts.length} tested oxygen and pressure conditions from NASA PSI tables, with crewed-habitat atmospheres marked. Solid-material tests stop at 22% oxygen.`}>
      <defs>
        <FillPattern id={`${hid}-band`} fill="hatched" color="--signal" cell={3} />
        <FillPattern id={`${hid}-gap`} fill="gradient" color="--signal" cell={3} level={0.35} />
      </defs>
      {/* grid */}
      {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <g key={v}><line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} stroke="var(--border)" strokeWidth={1} /><text x={x(v)} y={H - m.b + 18} textAnchor="middle" className="num" fontSize={11} fill="var(--muted-foreground)">{v}%</text></g>)}
      {[4, 6, 8, 10, 15, 20, 30, 50].map(v => <g key={v}><line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} /><text x={m.l - 10} y={y(v) + 4} textAnchor="end" className="num" fontSize={11} fill="var(--muted-foreground)">{v}</text></g>)}
      <text x={(m.l + W - m.r) / 2} y={H - 18} textAnchor="middle" className="eyebrow" fontSize={11.5} fill="var(--muted-foreground)">Oxygen mole fraction</text>
      <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="var(--muted-foreground)">Pressure (psia)</text>
      {/* exploration atmosphere band */}
      <rect x={x(26)} y={y(10.6)} width={x(40) - x(26)} height={y(7) - y(10.6)} fill={`url(#${hid}-band)`} opacity={0.9} />
      <rect x={x(26)} y={y(10.6)} width={x(40) - x(26)} height={y(7) - y(10.6)} fill="none" stroke="var(--signal)" strokeWidth={1.25} />
      <text x={x(26)} y={y(7) + 16} fontSize={11.5} fill="var(--signal)" fontWeight={500}>Exploration atmospheres</text>
      <text x={x(26)} y={y(7) + 30} fontSize={11} fill="var(--muted-foreground)">26–40% O₂ at 7–10.6 psia</text>
      {/* solid ceiling */}
      <line x1={x(22.2)} x2={x(22.2)} y1={m.t} y2={H - m.b} stroke="var(--signal)" strokeDasharray="3 4" strokeWidth={1.25} />
      <text x={x(22.2) + 6} y={m.t + 12} fontSize={11} fill="var(--signal)">solid-material tests stop at 22.2% O₂</text>
      {/* points */}
      {pts.map((p, i) => p.p_atm == null
        ? <line key={i} x1={x(p.o2! * 100)} x2={x(p.o2! * 100)} y1={H - m.b + 30} y2={H - m.b + 38} stroke={PH_COLOR[p.ph]} strokeWidth={1} opacity={0.6} />
        : <circle key={i} cx={x(p.o2! * 100)} cy={y(p.p_atm * PSIA)} r={hover === p.acc ? 4 : p.kind === 'target' ? 5 : 2.6}
            fill={p.kind === 'target' ? 'none' : PH_COLOR[p.ph]} stroke={p.kind === 'target' ? PH_COLOR[p.ph] : 'none'} strokeWidth={1.5}
            opacity={hover && hover !== p.acc ? 0.15 : 0.8} onMouseEnter={() => setHover(p.acc)} onMouseLeave={() => setHover(null)} onClick={() => onPick?.(p.acc)} style={{ cursor: onPick ? 'pointer' : 'default', transition: 'opacity .15s' }}>
            <title>{`${db.byId[p.acc]?.acronym ?? p.acc} · ${p.test} · ${(p.o2! * 100).toFixed(1)}% O₂ · ${(p.p_atm * PSIA).toFixed(1)} psia · ${p.fuel}${p.kind === 'target' ? ' (target atmosphere from objectives)' : ''}`}</title>
          </circle>)}
      <text x={m.l} y={H - m.b + 50} fontSize={11.5} fill="var(--muted-foreground)">ticks: O₂ tabulated, pressure not (BASS-II, Saffire)</text>
      {/* habitat marks */}
      {marks.map(h => { const on = focusMark === h.k; return <g key={h.k} opacity={focus && !on ? 0.45 : 1}>
        <line x1={x(h.o2) - 9} x2={x(h.o2) + 9} y1={y(h.ps)} y2={y(h.ps)} stroke="var(--foreground)" strokeWidth={on ? 2 : 1.25} />
        <line x1={x(h.o2)} x2={x(h.o2)} y1={y(h.ps) - 9} y2={y(h.ps) + 9} stroke="var(--foreground)" strokeWidth={on ? 2 : 1.25} />
        <circle cx={x(h.o2)} cy={y(h.ps)} r={on ? 7 : 5} fill="none" stroke="var(--foreground)" strokeWidth={on ? 2 : 1.25} />
        <text x={x(h.o2) + (h.dx ?? 12)} y={y(h.ps) + (h.dy ?? -8)} textAnchor={h.anchor ?? 'start'} paintOrder="stroke" stroke="var(--surface)" strokeWidth={4} fontSize={12} fontWeight={on ? 600 : 500} fill="var(--foreground)">{h.label}</text>
      </g> })}
      {/* spacesuit, off the oxygen scale */}
      <g><line x1={x(90) - 30} x2={x(90) - 4} y1={y(4.3)} y2={y(4.3)} stroke="var(--foreground)" strokeWidth={1.25} markerEnd="" /><path d={`M ${x(90) - 4} ${y(4.3) - 4} L ${x(90) + 2} ${y(4.3)} L ${x(90) - 4} ${y(4.3) + 4}`} fill="var(--foreground)" />
        <text x={x(90) - 34} y={y(4.3) - 8} textAnchor="end" fontSize={11.5} fill="var(--foreground)">Spacesuit · 100% O₂ · 4.3 psia</text></g>
      {custom && <g><circle cx={x(custom.o2)} cy={y(custom.psia)} r={8} fill="none" stroke="var(--primary)" strokeWidth={2.25} /><circle cx={x(custom.o2)} cy={y(custom.psia)} r={2.5} fill="var(--primary)" />
        <text x={x(custom.o2) + 12} y={y(custom.psia) + 18} fontSize={12} fontWeight={600} fill="var(--primary)">your atmosphere</text></g>}
    </svg>
  )
}

export function EnvelopeLegend() {
  return <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
    {(['solid', 'liquid', 'gas'] as const).map(k => <span key={k} className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PH_COLOR[k] }} />{PH_LABEL[k]}</span>)}
    <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px]" style={{ borderColor: 'var(--signal)' }} />Target atmosphere named in objectives</span>
  </div>
}
