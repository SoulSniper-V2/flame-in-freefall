import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { type DB, type Pt, PSIA, phaseOf } from '@/data'

export const BANDS = [
  { k: 'earth', label: 'Earth-normal', sub: '19–23.5% O₂ · 13–16 psia', test: (o: number, p: number | null) => p != null && o >= 0.19 && o <= 0.235 && p * PSIA >= 13 && p * PSIA <= 16 },
  { k: 'explor', label: 'Exploration', sub: '26–40% O₂ · 7–10.6 psia', test: (o: number, p: number | null) => p != null && o >= 0.26 && o <= 0.4 && p * PSIA >= 7 && p * PSIA <= 10.6 },
  { k: 'lowp', label: 'Low pressure', sub: 'below 7 psia', test: (_o: number, p: number | null) => p != null && p * PSIA < 7 },
  { k: 'hio2', label: 'Oxygen-rich', sub: 'above 40% O₂', test: (o: number, p: number | null) => p != null && o > 0.4 },
  { k: 'nop', label: 'Pressure not recorded', sub: 'O₂ only', test: (_o: number, p: number | null) => p == null },
] as const
const ROWS = [['solid', 'Solid materials'], ['liquid', 'Liquid droplets'], ['gas', 'Gaseous flames']] as const

export function gapMatrix(db: DB) {
  const pts = db.points.filter(p => p.o2 != null && p.kind !== 'target')
  return ROWS.map(([ph, label]) => ({ ph, label, cells: BANDS.map(b => { const hit = pts.filter(p => phaseOf(db.byId[p.acc]) === ph && b.test(p.o2!, p.p_atm)); return { n: hit.length, invs: [...new Set(hit.map(p => db.byId[p.acc]?.acronym))] } }) }))
}

export function downloadCSV(name: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export function conditionsCSV(db: DB) {
  const rows: (string | number | null)[][] = [['psi_id', 'investigation', 'test', 'fuel', 'o2_fraction', 'pressure_atm', 'pressure_psia', 'status', 'nasa_table', 'csv_line', 'o2_column', 'o2_cell_verbatim', 'pressure_column', 'pressure_cell_verbatim', 'pressure_unit']]
  db.points.forEach((p: Pt) => rows.push([p.acc, db.byId[p.acc]?.acronym ?? '', p.test, p.fuel, p.o2, p.p_atm, p.p_atm != null ? +(p.p_atm * PSIA).toFixed(3) : null, p.status ?? p.kind, p.src?.table ?? '', p.src?.line ?? '', p.src?.cells.o2?.[0] ?? '', p.src?.cells.o2?.[1] ?? '', p.src?.cells.p?.[0] ?? '', p.src?.cells.p?.[1] ?? '', p.src?.punit ?? '']))
  downloadCSV('flame-in-freefall_psi_conditions_with_provenance.csv', rows)
}

export function GapMatrix({ db }: { db: DB }) {
  const m = useMemo(() => gapMatrix(db), [db]); const max = Math.max(...m.flatMap(r => r.cells.map(c => c.n)))
  const csv = () => downloadCSV('flame-in-freefall_evidence_gap_matrix.csv', [['fuel_phase', ...BANDS.map(b => `${b.label} (${b.sub})`)], ...m.map(r => [r.label, ...r.cells.map(c => c.n)])])
  return <div>
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-[13px]">
      <thead><tr><th className="w-[150px]" />{BANDS.map(b => <th key={b.k} className="px-1 pb-3 text-left align-bottom font-normal"><div className="font-medium">{b.label}</div><div className="num text-[11px] text-muted-foreground">{b.sub}</div></th>)}</tr></thead>
      <tbody>{m.map(r => <tr key={r.ph}><th className="py-1 pr-3 text-left font-medium">{r.label}</th>{r.cells.map((c, i) => <td key={i} className="p-1">
        <div className={`flex h-[64px] flex-col justify-between rounded-[3px] p-2.5 ${c.n ? '' : 'border border-dashed border-signal/60'}`} title={c.invs.join(', ')}
          style={c.n ? { background: `color-mix(in oklab, var(--primary) ${Math.round(8 + 32 * Math.log1p(c.n) / Math.log1p(max))}%, transparent)` } : undefined}>
            <span className={`num text-[20px] leading-none ${c.n ? '' : 'text-signal'}`}>{c.n}</span>
            <span className="truncate text-[11px] text-muted-foreground">{c.invs.join(', ') || 'none tested'}</span>
        </div></td>)}</tr>)}</tbody>
    </table></div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={csv} className="btn btn-ghost h-9 text-[13px]"><Download size={14} /> Gap matrix CSV</button>
      <button onClick={() => conditionsCSV(db)} className="btn btn-ghost h-9 text-[13px]"><Download size={14} /> All {db.points.length.toLocaleString()} conditions with NASA source cells</button>
    </div>
  </div>
}
