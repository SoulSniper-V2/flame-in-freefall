import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { PageHead, Loading } from '@/components/Shell'
import { downloadCSV } from '@/components/GapMatrix'
import { cn } from '@/lib/utils'

// ---------- types ----------
interface Paper { title: string; year: string | number; url: string; authors: string[] }
interface Rec {
  paper: string; investigation: string | null; platform: string | null; gravity_g: number | null; material: string | null
  thickness_mm: number | null; geometry: string | null; flow_mode: string | null; flow_cm_s: number | null; o2_pct: number | null
  pressure_kpa: number | null; quantity: string; value: number; unit: string | null; outcome: string | null; basis: string | null; quote: string
}
interface Lit { n_kept: number; n_rejected: number; n_unique: number; papers: Record<string, Paper>; records: Rec[] }
type G = 'ug' | 'p' | '1g'
interface Pt { g: G; gv: number; v: number; r: Rec }
interface TipState { r: Rec; p: Paper | undefined; head: string; x: number; y: number }

// ---------- helpers ----------
const LIMIT_Q = new Set(['flammability_limit', 'extinction_o2'])
const gclass = (g: number | null): G | null => g == null ? null : g === 0 ? 'ug' : g === 1 ? '1g' : g > 0 && g < 1 ? 'p' : null
const GCOL: Record<G, string> = { '1g': 'var(--foreground)', ug: 'var(--primary)', p: 'var(--signal)' }
const GLABEL: Record<G, string> = { ug: 'µg', p: 'partial g', '1g': '1 g' }
const gLabel = (g: number) => g === 0 ? 'µg' : g === 1 ? '1 g' : `${+g.toFixed(2)} g`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const NICE: Record<string, string> = { 'pmma': 'PMMA', 'cast pmma': 'PMMA, cast', 'cast pmma rod': 'PMMA rod, cast', 'ultem 1000': 'Ultem 1000 film', 'nomex ht90-40': 'Nomex HT90-40 fabric', 'mylar g': 'Mylar film', 'polyurethane foam': 'Polyurethane foam', 'polyphenolic foam': 'Polyphenolic foam', 'cellulose': 'Cellulose (paper)' }
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const hash01 = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const log10 = Math.log10

/** Mole-fraction O2 limits become percent; only O2 limit quantities with measured or estimated basis count. */
function o2Limit(r: Rec): number | null {
  const u = r.unit ?? ''
  if (!LIMIT_Q.has(r.quantity) || !/O2/.test(u)) return null
  if (r.outcome === 'burned' || r.outcome === 'no ignition' || (r.pressure_kpa != null && r.pressure_kpa > 150)) return null // test outcomes and high-pressure tests are not ambient limits
  if (r.basis !== 'measured' && r.basis !== 'estimate') return null
  return /mole fraction/.test(u) ? r.value * 100 : r.value
}
/** Material group: lowercase, parenthetical and thickness removed. */
const matKey = (m: string | null) => m ? m.replace(/\([^)]*\)/g, '').replace(/\b\d+(\.\d+)?\s*(mm|cm|mil)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase() : ''
/** Flow in cm/s: flow_cm_s when present, else an extinction_flow value in cm/s or m/s. */
function flowOf(r: Rec): number | null {
  if (r.flow_cm_s != null) return r.flow_cm_s
  if (r.quantity === 'extinction_flow' && r.unit === 'cm/s') return r.value
  if (r.quantity === 'extinction_flow' && r.unit === 'm/s') return r.value * 100
  return null
}
/** Flame spread normalised to mm/s. */
function spreadMM(r: Rec): number | null {
  if (r.quantity !== 'flame_spread_rate') return null
  if (r.unit === 'mm/s') return r.value
  if (r.unit === 'cm/s') return r.value * 10
  if (r.unit === 'microns/s') return r.value / 1000
  return null
}
const conds = (r: Rec) => [
  r.o2_pct != null && `O₂ ${r.o2_pct}%`, r.pressure_kpa != null && `${r.pressure_kpa} kPa`, flowOf(r) != null && `flow ${flowOf(r)} cm/s`,
  r.gravity_g != null && gLabel(r.gravity_g), r.outcome, r.basis,
].filter(Boolean).join(' · ')

function useTip() {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TipState | null>(null)
  const show = (r: Rec, p: Paper | undefined, head: string, e: MouseEvent) => {
    const b = box.current?.getBoundingClientRect(); if (!b) return
    setTip({ r, p, head, x: e.clientX - b.left, y: e.clientY - b.top })
  }
  return { box, tip, show, hide: () => setTip(null) }
}

function Tooltip({ t, w }: { t: TipState; w: number }) {
  const flip = t.x > w * 0.55
  return <div className="pointer-events-none absolute z-10 w-[300px] rounded border bg-surface p-3 text-[12.5px] leading-snug shadow-sm" style={{ left: flip ? t.x - 314 : t.x + 14, top: t.y + 14 }}>
    <div className="eyebrow mb-2 text-[10px]">{t.head}</div>
    <div className="num text-[15px]">{t.r.value} {t.r.unit}</div>
    <div className="num mt-1 text-[11.5px] text-muted-foreground">{conds(t.r)}</div>
    <blockquote className="line-clamp-6 mt-2 border-l-2 pl-2.5 italic text-muted-foreground">“{clean(t.r.quote)}”</blockquote>
    {t.p && <div className="mt-2 text-[11.5px] text-muted-foreground">{t.p.title} · {t.p.year}</div>}
  </div>
}

function Section({ n, title, dek, children }: { n: string; title: string; dek?: string; children: ReactNode }) {
  return <section className="border-b"><div className="wrap py-16">
    <div className="mb-8 grid gap-4 md:grid-cols-[1fr_1fr] md:items-end">
      <div><h2 className="display text-[36px] md:text-[46px]">{title}</h2></div>
      {dek && <p className="max-w-md text-[15px] text-muted-foreground">{dek}</p>}
    </div>
    {children}
  </div></section>
}

const GKEY_LABEL: Record<G, string> = { '1g': '1 g (Earth)', ug: 'Microgravity', p: 'Partial gravity' }
const Legend = () => <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
  {(['1g', 'ug', 'p'] as G[]).map(g => <span key={g} className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GCOL[g] }} />{GKEY_LABEL[g]}</span>)}
</div>

// ---------- 2. dumbbell ----------
const HAB_REF = [{ v: 21, l: 'ISS' }, { v: 30, l: 'lunar base' }, { v: 34, l: 'rover' }]

function Dumbbell({ rows, papers }: { rows: { name: string; pts: Pt[] }[]; papers: Record<string, Paper> }) {
  const tip = useTip()
  const L = 250, R = 960, top = 40, rowH = 58
  const X = (v: number) => L + ((v - 10) / 30) * (R - L)
  const H = top + rows.length * rowH + 44
  return <div>
    <div ref={tip.box} className="relative">
      <svg viewBox={`0 0 1000 ${H}`} className="h-auto w-full select-none" role="img" aria-label={`Oxygen limits for ${rows.length} materials measured both at 1 g and in microgravity, from 10 to 40 percent oxygen`}>
        {[10, 15, 20, 25, 30, 35, 40].map(v => <g key={v}><line x1={X(v)} x2={X(v)} y1={top - 6} y2={H - 36} stroke="var(--border)" strokeWidth={1} /><text x={X(v)} y={H - 18} textAnchor="middle" className="num" fontSize={11} fill="var(--muted-foreground)">{v}%</text></g>)}
        {HAB_REF.map(h => <g key={h.v}><line x1={X(h.v)} x2={X(h.v)} y1={top - 6} y2={H - 36} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1} /><text x={X(h.v) - 5} y={top - 12} textAnchor="end" className="num" fontSize={11} fill="var(--muted-foreground)">{h.v}% {h.l}</text></g>)}
        {rows.map((e, i) => {
          const cy = top + i * rowH + rowH / 2
          const vs = e.pts.map(p => p.v); const lo = Math.min(...vs), hi = Math.max(...vs)
          return <g key={e.name}>
            <text x={0} y={cy + 4} fontSize={14} fill="var(--foreground)">{NICE[e.name] ?? cap(e.name)}</text>
            <text x={0} y={cy + 19} className="num" fontSize={11.5} fill="var(--muted-foreground)">{e.pts.length} limits</text>
            <line x1={X(lo)} x2={X(hi)} y1={cy} y2={cy} stroke="var(--muted-foreground)" strokeWidth={1.5} opacity={0.6} />
            {e.pts.map((p, k) => <circle key={k} cx={X(p.v)} cy={cy} r={p.g === 'p' ? 4 : 5.5} fill={GCOL[p.g]} stroke="var(--background)" strokeWidth={1}
              onMouseEnter={ev => tip.show(p.r, papers[p.r.paper], `${NICE[e.name] ?? cap(e.name)} · ${GLABEL[p.g]}`, ev)} onMouseLeave={tip.hide} />)}
            {e.pts.filter(p => p.g === 'p').map((p, k) => <text key={`g${k}`} x={X(p.v)} y={cy - 9} textAnchor="middle" className="num" fontSize={10} fill="var(--signal)">{gLabel(p.gv)}</text>)}
          </g>
        })}
      </svg>
      {tip.tip && <Tooltip t={tip.tip} w={tip.box.current?.clientWidth ?? 1000} />}
    </div>
    <Legend />
  </div>
}

// ---------- 3. flammability map ----------
function FlameMap({ pts, papers, offscale }: { pts: { r: Rec; o2: number; flow: number; burned: boolean }[]; papers: Record<string, Paper>; offscale: number }) {
  const tip = useTip()
  const W = 1000, H = 500, l = 64, rr = 20, t = 16, b = 50, PW = W - l - rr, PH = H - t - b
  const LX = (o: number) => l + ((o - 10) / 45) * PW
  const LY = (v: number) => t + PH - ((log10(v) + 1) / 3) * PH
  return <div>
    <div ref={tip.box} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label={`${pts.length} oxygen and airflow conditions, burned or extinguished, coloured by gravity`}>
        {[10, 20, 30, 40, 50].map(v => <g key={v}><line x1={LX(v)} x2={LX(v)} y1={t} y2={H - b} stroke="var(--border)" /><text x={LX(v)} y={H - b + 18} textAnchor="middle" className="num" fontSize={11} fill="var(--muted-foreground)">{v}%</text></g>)}
        {[0.1, 0.3, 1, 3, 10, 30, 100].map(v => <g key={v}><line x1={l} x2={W - rr} y1={LY(v)} y2={LY(v)} stroke="var(--border)" strokeWidth={v === 0.1 || v === 1 || v === 10 || v === 100 ? 1 : 0.5} /><text x={l - 10} y={LY(v) + 4} textAnchor="end" className="num" fontSize={11} fill="var(--muted-foreground)">{v}</text></g>)}
        <text x={(l + W - rr) / 2} y={H - 14} textAnchor="middle" className="eyebrow" fontSize={11.5} fill="var(--muted-foreground)">Oxygen (% O₂)</text>
        <text transform={`translate(16 ${(t + H - b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="var(--muted-foreground)">Airflow (cm/s, log)</text>
        {HAB_REF.map(h => <g key={h.v}><line x1={LX(h.v)} x2={LX(h.v)} y1={t} y2={H - b} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1} opacity={0.6} /><text x={LX(h.v) - 5} y={t + 12} textAnchor="end" className="num" fontSize={11.5} fill="var(--muted-foreground)">{h.v}% {h.l}</text></g>)}
        {pts.map(({ r, o2, flow, burned }, i) => {
          const g = gclass(r.gravity_g); const c = g ? GCOL[g] : 'var(--muted-foreground)'
          const cx = LX(o2), cy = LY(flow)
          const head = `${r.material ?? 'material not stated'} · ${g ? GLABEL[g] : 'gravity not stated'} · ${burned ? 'burned' : 'extinguished'}`
          return <g key={i} onMouseEnter={ev => tip.show(r, papers[r.paper], head, ev)} onMouseLeave={tip.hide} style={{ cursor: 'default' }}>
            {burned
              ? <circle cx={cx} cy={cy} r={4.2} fill={c} opacity={0.85} />
              : <g><circle cx={cx} cy={cy} r={4.2} fill="var(--surface)" stroke={c} strokeWidth={1.4} /><path d={`M ${cx - 2.4} ${cy - 2.4} L ${cx + 2.4} ${cy + 2.4} M ${cx + 2.4} ${cy - 2.4} L ${cx - 2.4} ${cy + 2.4}`} stroke={c} strokeWidth={1.2} /></g>}
          </g>
        })}
      </svg>
      {tip.tip && <Tooltip t={tip.tip} w={tip.box.current?.clientWidth ?? 1000} />}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground" />Burned</span>
      <span className="inline-flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="4.6" fill="none" stroke="var(--foreground)" strokeWidth="1.4" /><path d="M4 4 L8 8 M8 4 L4 8" stroke="var(--foreground)" strokeWidth="1.2" /></svg>Extinguished, or an extinction flow</span>
      <Legend />
      <span className="num text-[11.5px]">{offscale} points outside the axes not drawn</span>
    </div>
  </div>
}

// ---------- 4. flame spread strip plot ----------
const SPREAD_ROWS: { g: G; label: string }[] = [{ g: 'ug', label: 'Microgravity' }, { g: 'p', label: 'Partial gravity' }, { g: '1g', label: '1 g' }]
const fmtMM = (v: number) => `${+v.toPrecision(2)} mm/s`

function SpreadStrip({ pts, papers, offscale }: { pts: Record<G, Pt[]>; papers: Record<string, Paper>; offscale: number }) {
  const tip = useTip()
  const W = 1000, L = 210, R = 960, top = 14, band = 92
  const H = top + band * SPREAD_ROWS.length + 44
  const X = (v: number) => L + ((log10(v) + 2) / 4) * (R - L)
  return <div>
    <div ref={tip.box} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label="Flame spread rates in mm per second on a log scale, by gravity level">
        {[-2, -1, 0, 1, 2].map(e => <g key={e}><line x1={X(10 ** e)} x2={X(10 ** e)} y1={top} y2={H - 40} stroke="var(--border)" /><text x={X(10 ** e)} y={H - 20} textAnchor="middle" className="num" fontSize={11} fill="var(--muted-foreground)">{10 ** e}</text></g>)}
        <text x={(L + R) / 2} y={H - 2} textAnchor="middle" className="eyebrow" fontSize={11.5} fill="var(--muted-foreground)">Flame spread rate (mm/s, log)</text>
        {SPREAD_ROWS.map((row, ri) => {
          const list = pts[row.g]; const cy = top + ri * band + band / 2
          const med = list.length ? median(list.map(p => p.v)) : null
          return <g key={row.g}>
            <line x1={L} x2={R} y1={top + ri * band} y2={top + ri * band} stroke="var(--border)" />
            <text x={0} y={cy - 4} fontSize={14} fill="var(--foreground)">{row.label}</text>
            <text x={0} y={cy + 14} className="num" fontSize={11.5} fill="var(--muted-foreground)">n = {list.length}{med != null ? ` · median ${fmtMM(med)}` : ''}</text>
            {list.map((p, k) => <circle key={k} cx={X(p.v)} cy={cy + (hash01(k * 3 + ri) - 0.5) * 50} r={4} fill={GCOL[row.g]} opacity={0.7} stroke="var(--background)" strokeWidth={0.5}
              onMouseEnter={ev => tip.show(p.r, papers[p.r.paper], `${row.label} · ${p.r.material ?? 'material not stated'}`, ev)} onMouseLeave={tip.hide} />)}
            {med != null && <line x1={X(med)} x2={X(med)} y1={cy - 30} y2={cy + 30} stroke="var(--foreground)" strokeWidth={2} />}
          </g>
        })}
      </svg>
      {tip.tip && <Tooltip t={tip.tip} w={tip.box.current?.clientWidth ?? 1000} />}
    </div>
    <div className="mt-3 num text-[11.5px] text-muted-foreground">Dark tick: median per row · cm/s × 10 and µm/s ÷ 1000 normalised to mm/s · {offscale} records off the 0.01–100 mm/s axis not drawn</div>
  </div>
}

// ---------- 5. explorer ----------
const GOPTS: { v: 'all' | G; label: string }[] = [{ v: 'all', label: 'all gravity' }, { v: 'ug', label: 'µg' }, { v: 'p', label: 'partial' }, { v: '1g', label: '1 g' }]
const PAGE = 60

function Explorer({ records, papers }: { records: Rec[]; papers: Record<string, Paper> }) {
  const [quantity, setQuantity] = useState('all'); const [grav, setGrav] = useState<'all' | G>('all'); const [basis, setBasis] = useState('all')
  const [text, setText] = useState(''); const [showAll, setShowAll] = useState(false); const [open, setOpen] = useState<number | null>(null)
  const quantities = useMemo(() => [...new Set(records.map(r => r.quantity))].sort(), [records])
  const bases = useMemo(() => [...new Set(records.map(r => r.basis).filter((b): b is string => !!b))].sort(), [records])
  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase()
    return records.map((r, i) => ({ r, i })).filter(({ r }) => (quantity === 'all' || r.quantity === quantity) && (grav === 'all' || gclass(r.gravity_g) === grav)
      && (basis === 'all' || r.basis === basis) && (!q || `${r.material ?? ''} ${r.quote} ${papers[r.paper]?.title ?? ''}`.toLowerCase().includes(q)))
  }, [records, papers, quantity, grav, basis, text])
  const shown = showAll ? filtered : filtered.slice(0, PAGE)
  const sel = 'h-10 rounded-md border bg-surface px-3 text-[14px] outline-none focus:border-foreground'
  const csv = () => downloadCSV('flame-in-freefall_literature_filtered.csv', [
    ['paper_id', 'title', 'year', 'authors', 'source_url', 'quantity', 'value', 'unit', 'material', 'gravity_g', 'o2_pct', 'pressure_kpa', 'flow_cm_s', 'basis', 'outcome', 'investigation', 'platform', 'quote'],
    ...filtered.map(({ r }) => { const p = papers[r.paper]; return [r.paper, p?.title, p?.year, p?.authors.join('; '), p?.url, r.quantity, r.value, r.unit, r.material, r.gravity_g, r.o2_pct, r.pressure_kpa, flowOf(r), r.basis, r.outcome, r.investigation, r.platform, r.quote] }),
  ])
  const toggle = (i: number) => setOpen(open === i ? null : i)
  const onKey = (e: KeyboardEvent, i: number) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i) } }
  return <div>
    <div className="mb-5 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1.6fr]">
      <select value={quantity} onChange={e => setQuantity(e.target.value)} className={sel} aria-label="Quantity">
        <option value="all">all quantities</option>{quantities.map(q => <option key={q} value={q}>{q.replace(/_/g, ' ')}</option>)}
      </select>
      <select value={grav} onChange={e => setGrav(e.target.value as 'all' | G)} className={sel} aria-label="Gravity">{GOPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select>
      <select value={basis} onChange={e => setBasis(e.target.value)} className={sel} aria-label="Basis">
        <option value="all">all bases</option>{bases.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Search material, quote or title" className="h-10 rounded-md border bg-surface px-3 text-[14px] outline-none focus:border-foreground" aria-label="Search" />
    </div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="num text-[13px] text-muted-foreground">{filtered.length.toLocaleString()} of {records.length} records{!showAll && filtered.length > PAGE ? ` · first ${PAGE} shown` : ''}</div>
      <button onClick={csv} disabled={!filtered.length} className="btn btn-ghost h-9 text-[13px] disabled:opacity-40"><Download size={14} /> CSV of {filtered.length.toLocaleString()} rows with quotes</button>
    </div>
    <div className="panel overflow-x-auto">
      <table className="tbl min-w-[1000px]">
        <thead><tr><th>Material</th><th>Quantity</th><th>Value</th><th>O₂</th><th>Pressure</th><th>Flow</th><th>g</th><th>Basis</th><th>Source</th></tr></thead>
        <tbody className="num">
          {shown.map(({ r, i }) => { const p = papers[r.paper]; const g = gclass(r.gravity_g); return <Fragment key={i}>
            <tr className="row-link" tabIndex={0} aria-expanded={open === i} onClick={() => toggle(i)} onKeyDown={e => onKey(e, i)}>
              <td className="font-sans">{r.material ?? <span className="text-muted-foreground">not stated</span>}</td>
              <td className="font-sans">{r.quantity.replace(/_/g, ' ')}</td>
              <td>{r.value} <span className="text-muted-foreground">{r.unit}</span></td>
              <td>{r.o2_pct != null ? `${r.o2_pct}%` : '—'}</td>
              <td>{r.pressure_kpa != null ? `${r.pressure_kpa} kPa` : '—'}</td>
              <td>{r.flow_cm_s != null ? `${r.flow_cm_s} cm/s` : '—'}</td>
              <td className={cn(g === 'p' && 'text-signal')}>{r.gravity_g != null ? (g === 'ug' ? 'µg' : g === '1g' ? '1' : gLabel(r.gravity_g)) : '—'}</td>
              <td className="font-sans">{r.basis ?? '—'}</td>
              <td className="font-sans">
                <a href={p?.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} className="link block max-w-[280px] truncate">{p?.title}</a>
                <span className="text-[11.5px] text-muted-foreground">{p?.year}</span>
              </td>
            </tr>
            {open === i && <tr><td colSpan={9} className="bg-surface">
              <blockquote className="max-w-4xl border-l-2 border-foreground py-1 pl-5 font-serif text-[18px] italic leading-relaxed">“{clean(r.quote)}”</blockquote>
              <div className="mt-4 grid gap-1 text-[12.5px] text-muted-foreground font-sans">
                <div>{p?.title} · {p?.year}</div>
                <div>{p?.authors.join(', ')}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {r.investigation && <span>investigation: {r.investigation}</span>}{r.platform && <span>platform: {r.platform}</span>}{r.geometry && <span>geometry: {r.geometry}</span>}{r.flow_mode && <span>flow: {r.flow_mode}</span>}{r.outcome && <span>outcome: {r.outcome}</span>}
                </div>
                <a href={p?.url} target="_blank" rel="noreferrer" className="link w-fit text-foreground">{p?.url}</a>
              </div>
            </td></tr>}
          </Fragment> })}
        </tbody>
      </table>
    </div>
    {!showAll && filtered.length > PAGE && <button onClick={() => setShowAll(true)} className="btn btn-ghost mt-4 h-9 text-[13px]">Show all {filtered.length.toLocaleString()}</button>}
    {filtered.length === 0 && <p className="mt-6 text-muted-foreground">No records match these filters.</p>}
  </div>
}

// ---------- page ----------
function Body({ data }: { data: Lit }) {
  const papers = data.papers
  const paperCount = Object.keys(papers).length

  const limitRows = useMemo(() => {
    const m = new Map<string, { name: string; pts: Pt[] }>()
    for (const r of data.records) {
      const v = o2Limit(r); const g = gclass(r.gravity_g); const k = matKey(r.material)
      if (v == null || g == null || !k) continue
      const e = m.get(k) ?? { name: k, pts: [] }
      e.pts.push({ g, gv: r.gravity_g as number, v, r }); m.set(k, e)
    }
    return [...m.values()].filter(e => e.pts.some(p => p.g === 'ug') && e.pts.some(p => p.g === '1g'))
      .sort((a, b) => Math.min(...a.pts.map(p => p.v)) - Math.min(...b.pts.map(p => p.v)))
  }, [data])
  const lowerCount = limitRows.filter(e => median(e.pts.filter(p => p.g === 'ug').map(p => p.v)) < median(e.pts.filter(p => p.g === '1g').map(p => p.v))).length
  const limitN = limitRows.reduce((s, e) => s + e.pts.length, 0)

  const flame = useMemo(() => {
    const pts: { r: Rec; o2: number; flow: number; burned: boolean }[] = []; let offscale = 0
    for (const r of data.records) {
      const flow = flowOf(r)
      if (r.o2_pct == null || flow == null || flow <= 0) continue
      if (!(r.outcome === 'burned' || r.outcome === 'extinguished' || r.quantity === 'extinction_flow')) continue
      if (r.o2_pct < 10 || r.o2_pct > 55 || flow < 0.1 || flow > 100) { offscale++; continue }
      pts.push({ r, o2: r.o2_pct, flow, burned: r.outcome === 'burned' })
    }
    return { pts, offscale }
  }, [data])

  const spread = useMemo(() => {
    const by: Record<G, Pt[]> = { ug: [], p: [], '1g': [] }; let offscale = 0
    for (const r of data.records) {
      const v = spreadMM(r); const g = gclass(r.gravity_g)
      if (v == null || g == null || v <= 0) continue
      if (v < 0.01 || v > 100) { offscale++; continue }
      by[g].push({ g, gv: r.gravity_g as number, v, r })
    }
    return { by, offscale }
  }, [data])

  return <>
    <PageHead eyebrow="Literature atlas" title={<>{data.n_unique} measurements from {paperCount} NASA reports</>}>
      Each kept only if its quote appears verbatim in the report. {data.n_rejected} rejected.
    </PageHead>

    <Section n="01" title="Earth tests vs microgravity" dek={`Oxygen limits reported at 1 g and in microgravity for the same material. ${limitN} limits across ${limitRows.length} materials.`}>
      <div className="panel p-3 md:p-6">
        {limitRows.length ? <Dumbbell rows={limitRows} papers={papers} /> : <p className="text-muted-foreground">No material has both a 1-g and a microgravity oxygen limit.</p>}
      </div>
      <p className="mt-5 text-[15px]">In <span className="num text-foreground">{lowerCount}</span> of <span className="num">{limitRows.length}</span> materials the microgravity limit is lower than the 1-g limit, comparing per-material medians.</p>
    </Section>

    <Section n="02" title="Flammability map" dek={`Burned and extinguished conditions with both oxygen and airflow recorded. ${flame.pts.length} conditions.`}>
      <div className="panel p-3 md:p-6"><FlameMap pts={flame.pts} papers={papers} offscale={flame.offscale} /></div>
    </Section>

    <Section n="03" title="Flame spread rates by gravity" dek="Every recorded flame spread rate, normalised to mm/s. Note the spread of values within each gravity level.">
      <div className="panel p-3 md:p-6"><SpreadStrip pts={spread.by} papers={papers} offscale={spread.offscale} /></div>
    </Section>

    <Section n="04" title="Explorer" dek="Filter every record, then open a row for its verbatim quote and source.">
      <Explorer records={data.records} papers={papers} />
    </Section>
  </>
}

export default function Atlas() {
  const [data, setData] = useState<Lit | null>(null); const [failed, setFailed] = useState(false)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/literature.json`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() }).then(setData).catch(() => setFailed(true))
  }, [])
  if (failed) return <div className="wrap py-24"><div className="eyebrow">Could not load literature.json</div></div>
  if (!data) return <Loading what="NASA literature records" />
  return <Body data={data} />
}
