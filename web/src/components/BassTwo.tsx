import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

const B = import.meta.env.BASE_URL
interface Row { test: string; material: string; cls: string; o2: number | null; o2_final: number | null; air0: number | null; sustained: 0 | 1 | null; note: string | null; obs: string | null; report_line: number | null; psi_line: number }
interface Q { est: number; lo: number; hi: number; n: number; burn: number }
export interface Bass2 { n_tests: number; n_labelled: number; rows: Row[]; psi_flags: { test: string; line: number; issue: string }[]; crosscheck: { paper: string; tests: string[]; agrees: boolean }
  model: { n: number; n_out: number; loo_brier: number; baseline_brier: number; brier_skill: number; loo_acc: number; always_burn_acc: number; o2_50: Record<string, Q & { identified: boolean }> } }
let P: Promise<Bass2> | null = null
export function useBass2() { const [d, set] = useState<Bass2 | null>(null); useEffect(() => { (P ??= fetch(`${B}data/bass2.json`).then(r => r.json())).then(set).catch(() => {}) }, []); return d }

const ORDER: [string, string, { at: number; label: string } | null][] = [
  ['rod', 'PMMA rod, 6–13 mm', { at: 16, label: '1-g blowoff 16%' }],
  ['sibal', 'SIBAL cotton-fiberglass', null],
  ['film', 'PMMA film, 0.1–0.4 mm', null],
  ['slab', 'PMMA slab, 1–5 mm', null],
  ['nomex', 'Nomex III fabric', { at: 22, label: '0-g limit 22% (NASA)' }],
]
const hash = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997; return h / 997 }

/** BASS-II ISS tests with outcomes restored from NASA/TM-20210011385, and the burn-probability model. */
export function BassTwoChart({ d }: { d: Bass2 }) {
  const [sel, setSel] = useState<Row | null>(null)
  const W = 920, rowH = 74, top = 36, left = 210, right = 24, H = top + ORDER.length * rowH + 40
  const X0 = 12.5, X1 = 24; const x = (v: number) => left + (Math.min(X1, Math.max(X0, v)) - X0) / (X1 - X0) * (W - left - right)
  const rows = useMemo(() => d.rows.filter(r => r.sustained != null && r.o2 != null), [d])
  return <div>
    <div className="-mx-1 overflow-x-auto px-1"><svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[720px]" role="img" aria-label="BASS-II ISS tests by material and oxygen: which sustained a flame, with the model's 50 percent burn oxygen and its 90 percent interval">
      {[13, 15, 17, 19, 21, 23].map(v => <g key={v}><line x1={x(v)} x2={x(v)} y1={top - 10} y2={H - 34} stroke="var(--border)" /><text x={x(v)} y={H - 14} textAnchor="middle" fontSize={12} className="num" fill="var(--muted-foreground)">{v}%</text></g>)}
      <line x1={x(21)} x2={x(21)} y1={top - 18} y2={H - 34} stroke="var(--foreground)" strokeDasharray="4 4" />
      <text x={x(21) - 6} y={top - 20} textAnchor="end" fontSize={11.5} fill="var(--foreground)">ISS air 21%</text>
      <text x={W - right} y={top - 20} textAnchor="end" fontSize={11.5} fill="var(--signal)">Moon base 30% →</text>
      {ORDER.map(([k, label, ref], i) => {
        const y = top + i * rowH + rowH / 2; const q = d.model.o2_50[k]; const rs = rows.filter(r => r.cls === k)
        return <g key={k}>
          <text x={0} y={y - 4} fontSize={14} fontWeight={500} fill="var(--foreground)">{label}</text>
          <text x={0} y={y + 14} fontSize={11.5} className="num" fill="var(--muted-foreground)">{rs.filter(r => r.sustained === 1).length} burned · {rs.filter(r => r.sustained === 0).length} went out</text>
          {q?.identified && <><rect x={x(q.lo)} y={y - 22} width={Math.max(2, x(q.hi) - x(q.lo))} height={44} fill="var(--primary)" opacity={0.1} />
            <line x1={x(q.est)} x2={x(q.est)} y1={y - 24} y2={y + 24} stroke="var(--primary)" strokeWidth={2} /></>}
          {ref && <g><path d={`M${x(ref.at)} ${y - 30} l5 7 l-5 7 l-5 -7 Z`} fill="var(--signal)" /><text x={ref.at > 20 ? x(ref.at) - 8 : x(ref.at) + 8} y={y - 18} textAnchor={ref.at > 20 ? 'end' : 'start'} fontSize={11} fill="var(--signal)">{ref.label}</text></g>}
          {rs.map(r => { const cy = y + (hash(r.test) - 0.5) * 30; const on = sel?.test === r.test
            return <circle key={r.test} cx={x(r.o2!)} cy={cy} r={on ? 7 : 5} fill={r.sustained ? 'var(--foreground)' : 'var(--background)'} stroke={r.sustained ? 'var(--foreground)' : 'var(--signal)'} strokeWidth={1.8} opacity={on ? 1 : 0.8}
              className="cursor-pointer" onClick={() => setSel(on ? null : r)}><title>{`${r.test} · ${r.o2}% O₂ · ${r.sustained ? 'sustained a flame' : 'went out'}`}</title></circle> })}
        </g>
      })}
    </svg></div>
    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-muted-foreground">
      <span><span className="mr-1.5 inline-block size-2.5 rounded-full bg-foreground align-middle" />sustained a flame</span>
      <span><span className="mr-1.5 inline-block size-2.5 rounded-full border-2 border-[var(--signal)] align-middle" />went out</span>
      <span><span className="mr-1.5 inline-block h-3 w-0.5 bg-[var(--primary)] align-middle" />model: 50% chance of a sustained flame, band = 90% interval (shown only where a material both burned and went out)</span>
      <span>Click a test for NASA’s note</span>
    </div>
    {sel && <div className="mt-4 border-l-2 border-primary pl-4 text-[14px]"><span className="num">{sel.test}</span> · {sel.material} · <span className="num">{sel.o2}% O₂</span>{sel.air0 != null && <> · first flow <span className="num">{sel.air0} cm/s</span></>} · {sel.sustained ? 'sustained a flame' : 'went out'}{sel.note && ` (${sel.note})`}
      <p className="mt-1 text-muted-foreground">“{sel.obs}” <span className="whitespace-nowrap">· NASA/TM-20210011385, App. A · PSI table line {sel.psi_line}</span></p></div>}
  </div>
}

export function BassTwoTable({ d }: { d: Bass2 }) {
  return <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Material</th><th>Tests</th><th>Lowest O₂ that burned</th><th>Highest O₂ that went out</th><th>Model 50% burn O₂ (90% interval)</th></tr></thead>
    <tbody>{ORDER.map(([k, label]) => { const rs = d.rows.filter(r => r.cls === k && r.sustained != null && r.o2 != null); const yes = rs.filter(r => r.sustained === 1), no = rs.filter(r => r.sustained === 0); const q = d.model.o2_50[k]
      const lo = yes.length ? yes.reduce((a, b) => (b.o2! < a.o2! ? b : a)) : null, hi = no.length ? no.reduce((a, b) => (b.o2! > a.o2! ? b : a)) : null
      return <tr key={k}><td>{label}</td><td className="num">{rs.length}</td><td className="num">{lo ? `${lo.o2}% (${lo.test})` : '—'}</td><td className="num">{hi ? `${hi.o2}% (${hi.test})` : 'none went out'}</td>
        <td className={cn('num', !q?.identified && 'text-muted-foreground')}>{q?.identified ? `${q.est.toFixed(1)}% (${q.lo.toFixed(1)}–${q.hi.toFixed(1)})` : !no.length ? `not identified · below ${lo?.o2}%` : !yes.length ? `not identified · above ${hi?.o2}%` : '—'}</td></tr> })}</tbody></table></div>
}

export function BassTwoFlags({ d }: { d: Bass2 }) {
  return <div className="panel p-5 text-[14px]"><div className="eyebrow mb-3">Data note · {d.psi_flags.length} values to check</div>
    <p className="text-muted-foreground">These five calibrated final-O₂ values cannot be chamber readings; the raw readings are missing in NASA’s report too. Not used.</p>
    <ul className="mt-3 grid gap-1 sm:grid-cols-2">{d.psi_flags.map(f => <li key={f.test} className="num text-[13px]">{f.test} · PSI CSV line {f.line} · {f.issue.split(';')[0]}</li>)}</ul>
    <a className="btn btn-ghost mt-4" href={`${B}data/bass2_outcomes.csv`} download><Download size={14} /> BASS-II outcomes CSV (129 tests)</a></div>
}
