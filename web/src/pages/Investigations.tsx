import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { type DB, type Inv, CATS, CAT_LABEL, fmtRange, PSIA, phaseOf } from '@/data'
import { PageHead } from '@/components/Shell'
import { Meter } from '@/components/Dither'
import { cn } from '@/lib/utils'

type SortKey = 'acronym' | 'phase' | 'o2' | 'p' | 'rows' | 'fsi' | 'prevention' | 'detection' | 'suppression' | 'modeling'
const val = (i: Inv, k: SortKey): number | string => k === 'acronym' ? i.acronym : k === 'phase' ? i.phase : k === 'o2' ? i.ranges.o2_frac?.[1] ?? -1 : k === 'p' ? i.ranges.p_atm?.[0] ?? 99 : k === 'rows' ? i.tableRows : k === 'fsi' ? i.fireSafetyIndex : i.categories[k].score

export default function Investigations({ db }: { db: DB }) {
  const [q, setQ] = useState(''); const [ph, setPh] = useState<'all' | 'solid' | 'liquid' | 'gas' | 'other'>('all')
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: 'fsi', d: -1 }); const nav = useNavigate()
  const rows = useMemo(() => db.invs.filter(i => (ph === 'all' || phaseOf(i) === ph) && (!q || `${i.acronym} ${i.title} ${i.si.fuels.join(' ')} ${i.keywords.join(' ')} ${i.pis.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => { const x = val(a, sort.k), y = val(b, sort.k); return (x < y ? -1 : x > y ? 1 : 0) * sort.d }), [db, q, ph, sort])
  const H = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => <th className={className}><button onClick={() => setSort(s => ({ k, d: s.k === k ? (-s.d as 1 | -1) : k === 'acronym' || k === 'phase' ? 1 : -1 }))} className="inline-flex items-center gap-1 hover:text-foreground">{children}{sort.k === k && (sort.d === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th>
  return <>
    <PageHead eyebrow="Investigations" title="All PSI combustion investigations">
      {db.meta.count} records and {db.meta.tableRows.toLocaleString()} table rows from NASA’s PSI API.
    </PageHead>
    <div className="wrap py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by name, fuel, keyword or PI" className="h-10 w-full max-w-sm rounded-md border bg-surface px-3 text-[14px] outline-none focus:border-foreground" aria-label="Filter investigations" />
        <div className="flex flex-wrap gap-1">{(['all', 'solid', 'liquid', 'gas', 'other'] as const).map(p => <button key={p} onClick={() => setPh(p)} className={cn('rounded-full border px-3 py-1.5 text-[12.5px] capitalize transition-colors', ph === p ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:border-foreground')}>{p === 'other' ? 'ground & computational' : p}</button>)}</div>
        <span className="num ml-auto text-[12.5px] text-muted-foreground">{rows.length} shown</span>
      </div>
      <div className="overflow-x-auto"><table className="tbl">
        <thead><tr><H k="acronym">Investigation</H><H k="phase">Fuel phase</H><H k="o2">O₂ tested</H><H k="p">Pressure tested</H><H k="rows">Table rows</H><H k="fsi" className="w-[150px]">Fire-safety index</H>{CATS.map(c => <H key={c} k={c}>{CAT_LABEL[c].slice(0, 4)}.</H>)}</tr></thead>
        <tbody>{rows.map(i => <tr key={i.id} className="row-link" onClick={() => nav(`/inv/${i.id}`)}>
          <td><div className="font-medium">{i.acronym}</div><div className="max-w-[340px] text-[12.5px] text-muted-foreground">{i.title}</div></td>
          <td className="text-[13px]">{i.phase}</td>
          <td className="num text-[12.5px]">{fmtRange(i.ranges.o2_frac, x => `${+(x * 100).toFixed(1)}%`)}</td>
          <td className="num text-[12.5px]">{fmtRange(i.ranges.p_atm, x => (x * PSIA).toFixed(1))}{i.ranges.p_atm ? ' psia' : ''}</td>
          <td className="num text-[12.5px]">{i.tableRows || '·'}</td>
          <td><div className="flex items-center gap-2"><span className="num w-7 text-[12.5px]">{i.fireSafetyIndex}</span><Meter value={i.fireSafetyIndex} label={`${i.acronym} fire-safety index`} /></div></td>
          {CATS.map(c => <td key={c} className="num text-[12.5px]">{i.categories[c].score}</td>)}
        </tr>)}</tbody>
      </table></div>
    </div>
  </>
}
