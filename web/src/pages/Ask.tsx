import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { type DB, PSIA, CAT_LABEL, fmtP } from '@/data'
import { PageHead } from '@/components/Shell'
import { buildIndex, rank, parseIntent, tok } from '@/si/search'
import { useModels } from '@/ml'
import { readouts } from '@/pages/Brief'
import { cn } from '@/lib/utils'
import { useLit, useEarthVsOrbit } from '@/components/Headline'
import { LitTable, litQuery, MARGIN_Q } from '@/components/LitEvidence'
import { omosStats } from '@/margin'
import { EnvelopeChart } from '@/components/Envelope'

interface Chunk { id: string; a: string; field: string; text: string }
interface Rag { chunks: Chunk[]; emb: Int8Array; dim: number; scale: number }
const B = import.meta.env.BASE_URL
let ragP: Promise<Rag> | null = null
const loadRag = () => ragP ??= fetch(`${B}data/rag_chunks.json`).then(r => r.json()).then(d => ({ chunks: d.chunks, dim: d.dim, scale: d.scale, emb: new Int8Array(Uint8Array.from(atob(d.emb), c => c.charCodeAt(0)).buffer) }))
let embedder: any = null
async function getEmbedder(status: (s: string) => void) {
  if (embedder) return embedder
  status('Downloading MiniLM sentence model (about 25 MB, cached after the first time)')
  // @ts-ignore runtime CDN import
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1')
  mod.env.allowLocalModels = false
  embedder = await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })
  status('')
  return embedder
}

const EXAMPLES = ['Is NASA-STD-6001 conservative in microgravity?', 'How do fabrics burn at 30% oxygen and 10.2 psi?', 'Does turning off ventilation put out a fire?', 'Smoke detector design for a lunar base', 'Which suppressants work on droplet flames?', 'What are cool flames and why do they matter?']
const FIELD_LABEL: Record<string, string> = { summary: 'summary', finding: 'finding', conditions: 'test conditions', objective: 'PSI objective', approach: 'PSI approach', hypothesis: 'PSI hypothesis', impacts: 'PSI research impacts' }

function bm25Chunks(chunks: Chunk[], q: string[]) {
  const docs = chunks.map(c => tok(`${c.a} ${c.text}`)); const N = docs.length; const avg = docs.reduce((a, d) => a + d.length, 0) / N
  const df = new Map<string, number>(); docs.forEach(d => new Set(d).forEach(t => df.set(t, (df.get(t) || 0) + 1)))
  return docs.map(d => { let s = 0; for (const t of new Set(q)) { const f = d.filter(x => x === t).length; if (!f) continue; const n = df.get(t) || 0; s += Math.log(1 + (N - n + 0.5) / (n + 0.5)) * (f * 2.4) / (f + 1.4 * (0.25 + 0.75 * d.length / avg)) } return s })
}

export default function Ask({ db }: { db: DB }) {
  const nav = useNavigate(); const [sp, setSp] = useSearchParams(); const q = sp.get('q') ?? EXAMPLES[1]
  const [draft, setDraft] = useState(q); const [rag, setRag] = useState<Rag | null>(null)
  const [semantic, setSemantic] = useState(false); const [status, setStatus] = useState(''); const [qv, setQv] = useState<number[] | null>(null)
  const models = useModels(); const lit = useLit(); const ix = useMemo(() => buildIndex(db.invs), [db]); const input = useRef<HTMLInputElement>(null)
  useEffect(() => { loadRag().then(setRag) }, [])
  useEffect(() => { setDraft(q) }, [q])
  useEffect(() => {
    if (!semantic || !q) { setQv(null); return }
    let live = true; getEmbedder(setStatus).then(async e => { const o = await e(q, { pooling: 'mean', normalize: true }); if (live) setQv(Array.from(o.data as Float32Array)) }).catch(() => { setStatus('Semantic model could not load here; keyword retrieval is still on.'); setSemantic(false) })
    return () => { live = false }
  }, [semantic, q])

  const res = useMemo(() => {
    if (!q || !rag) return null
    const raw = tok(q); const lex = bm25Chunks(rag.chunks, raw); const maxL = Math.max(1e-9, ...lex)
    let sem: number[] | null = null
    if (qv) { sem = rag.chunks.map((_, r) => { let s = 0; const o = r * rag.dim; for (let k = 0; k < rag.dim; k++) s += rag.emb[o + k] * rag.scale * qv[k]; return s }) }
    const scored = rag.chunks.map((c, i) => ({ c, s: sem ? 0.35 * lex[i] / maxL + 0.65 * Math.max(0, (sem[i] - 0.15) / 0.55) : lex[i] / maxL, lex: lex[i] })).filter(x => x.s > (sem ? 0.05 : 0.22))
    const meta = (f: string) => f === 'conditions' ? 0.6 : 1
    scored.sort((a, b) => b.s * meta(b.c.field) - a.s * meta(a.c.field))
    const per = new Map<string, number>(); const passages = scored.filter(x => { const n = per.get(x.c.id) || 0; if (n >= 2 || x.c.field.endsWith('rationale')) return false; per.set(x.c.id, n + 1); return true }).slice(0, 7)
    const invSem = sem ? db.invs.map(inv => Math.max(0, ...rag.chunks.map((c, i) => c.id === inv.id ? sem![i] : 0))) : null
    const hits = rank(db.invs, ix, q, invSem).slice(0, 6)
    return { passages, hits, intent: parseIntent(q) }
  }, [q, rag, qv, db, ix])
  // the atmosphere the question is about: named numbers win, else the named habitat's design air
  const atm = useMemo(() => {
    if (!res) return null; const h = res.intent.habs[0] ? db.meta.habitats[res.intent.habs[0]] : null
    const o2 = res.intent.o2 ?? h?.o2; const p = res.intent.psi != null ? res.intent.psi / PSIA : h?.p_atm
    if (o2 == null && p == null) return null
    return { o2: o2 ?? 0.21, p_atm: p ?? 1, g: h?.g ?? 0, from: res.intent.o2 != null || res.intent.psi != null ? 'question' : h!.label }
  }, [res, db])
  const ro = useMemo(() => models && atm ? readouts(models, atm) : null, [models, atm])
  const litHits = useMemo(() => lit && res ? litQuery(lit, q, atm ? atm.o2 * 100 : null, atm ? atm.g : null) : [], [lit, res, q, atm])
  const go = (s: string) => { setSp(s ? { q: s } : {}); setDraft(s) }
  const evo = useEarthVsOrbit(lit)
  const direct = useMemo(() => {
    if (!q || !evo || !MARGIN_Q.test(q)) return null
    const thin = omosStats(evo, 'thin'), thick = omosStats(evo, 'thick'); const w = evo.find(r => r.omos === thin.worst)!
    return { thin, thick, w }
  }, [q, evo])

  return <>
    <PageHead eyebrow="Ask the evidence" title="Ask the evidence">
      Answers are quotes from {rag ? rag.chunks.length : 400} NASA passages, retrieved in your browser. Nothing is generated.
    </PageHead>
    <div className="wrap py-10">
      <form onSubmit={e => { e.preventDefault(); go(draft.trim()) }} className="flex max-w-3xl items-center gap-2 rounded-md border bg-surface p-1.5 focus-within:border-foreground">
        <Search size={17} className="ml-2.5 shrink-0 text-muted-foreground" />
        <input ref={input} value={draft} onChange={e => setDraft(e.target.value)} placeholder="e.g. how do fabrics burn at 30% oxygen and 10.2 psi?" className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[15.5px] outline-none placeholder:text-muted-foreground" aria-label="Question" />
        <button className="btn btn-primary h-10">Ask <ArrowRight size={15} /></button>
      </form>
      <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-2">
        {EXAMPLES.map(e => <button key={e} onClick={() => go(e)} className={cn('chip transition-colors hover:border-foreground hover:text-foreground', q === e && 'border-foreground text-foreground')}>{e}</button>)}
      </div>
      <label className="mt-5 inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-muted-foreground">
        <input type="checkbox" checked={semantic} onChange={e => setSemantic(e.target.checked)} className="accent-[var(--primary)]" />
        Semantic matching (MiniLM sentence embeddings, runs locally){status && <span className="text-foreground">· {status}</span>}
      </label>

      {direct && <section className="panel mt-12 max-w-4xl border-l-2 border-l-[var(--signal)] p-6">
        <div className="eyebrow mb-3">Computed answer · NASA’s oxygen margin of safety, from verified records</div>
        <p className="text-[19px] leading-snug">Not always. In NASA’s microgravity tests, thin films and fabrics burned at up to <span className="num text-signal">{Math.abs(direct.thin.worst).toFixed(1)}</span> points lower oxygen than the 1-g limit ({direct.w.label}); the thin-material mean, <span className="num">{direct.thin.mean.toFixed(1)}</span>, matches the value NASA published. For PMMA rods NASA reports up to <span className="num">{Math.abs(direct.thick.worst).toFixed(1)}</span> points.</p>
        <p className="mt-3 text-[14px] text-muted-foreground">So a thin material rated at 1 g between 30% and {(30 - direct.thin.worst).toFixed(1)}% O₂ passes the Earth test for Moon-base air but should be re-tested in microgravity.</p>
        <Link to="/margin" className="btn btn-primary mt-5">Check a material <ArrowRight size={15} /></Link>
      </section>}
      {res && lit && <section className="mt-12">
        <h2 className="display mb-2 text-[32px]">Measured in NASA reports</h2>
        <p className="mb-5 text-[14px] text-muted-foreground">{litHits.length ? <>{`${litHits.length} of ${lit.records.length} verified records match`}{atm ? `, ranked by closeness to ${(atm.o2 * 100).toFixed(0)}% O₂${atm.g > 0 && atm.g < 1 ? ' and partial gravity' : ''}` : ''}. Open a row for its verbatim quote.</> : `None of the ${lit.records.length} verified records match these words. Try a material, a fuel or a quantity such as flame spread or extinction.`}</p>
        {litHits.length > 0 && <LitTable rows={litHits} lit={lit} max={8} />}
      </section>}
      {res && <div className="mt-14 grid gap-12 lg:grid-cols-[1.35fr_1fr]">
        <section>
          <div className="mb-5 flex flex-wrap items-center gap-2"><span className="eyebrow mr-2">Read as</span>
            {res.intent.habs.map(h => <span key={h} className="chip">{db.meta.habitats[h].label}</span>)}
            {res.intent.cats.map(c => <span key={c} className="chip">{CAT_LABEL[c]}</span>)}
            {res.intent.o2 != null && <span className="chip">{(res.intent.o2 * 100).toFixed(0)}% O₂</span>}
            {res.intent.psi != null && <span className="chip">{res.intent.psi} psia</span>}
            {res.intent.phase && <span className="chip">{res.intent.phase} fuel</span>}
            {!res.intent.habs.length && !res.intent.cats.length && res.intent.o2 == null && res.intent.psi == null && !res.intent.phase && <span className="chip">keywords only</span>}
          </div>
          <h2 className="display mb-6 text-[32px]">What the PSI records say</h2>
          {res.passages.length ? <ol className="space-y-6">{res.passages.map((p, i) => <li key={i} className="grid grid-cols-[28px_1fr] gap-3">
            <span className="num pt-0.5 text-[12.5px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
            <div><blockquote className="text-[15.5px] leading-relaxed">{p.c.text}</blockquote>
              <div className="mt-2 flex flex-wrap items-center gap-2"><Link to={`/inv/${p.c.id}`} className="chip transition-colors hover:border-foreground hover:text-foreground">{p.c.a} · {p.c.id}</Link><span className="text-[12px] text-muted-foreground">{FIELD_LABEL[p.c.field] ?? p.c.field}</span></div></div>
          </li>)}</ol> : <p className="text-muted-foreground">No passage matches those words. Try naming a material, a fuel or a habitat, or turn on semantic matching.</p>}
        </section>
        <aside className="space-y-10">
          {atm && res.intent.phase === 'Solid' && <div><div className="eyebrow mb-4">Model readout · {(atm.o2 * 100).toFixed(0)}% O₂ · {(atm.p_atm * PSIA).toFixed(1)} psia</div>
            <div className="panel border-l-2 border-l-[var(--signal)] p-4 text-[14px]">The predictive models are trained on droplet and gas flames, so none of them covers solid fuels or fabrics. Use the oxygen-margin check and the verified measurements instead.
              <Link to="/margin" className="link mt-2 block text-[13px]">Check a material’s 1-g rating</Link></div></div>}
          {ro && atm && res.intent.phase !== 'Solid' && <div><div className="eyebrow mb-4">Model readout · {(atm.o2 * 100).toFixed(0)}% O₂ · {(atm.p_atm * PSIA).toFixed(1)} psia{atm.from !== 'question' ? ` · ${atm.from} air` : ''}</div>
            <div className="panel divide-y text-[14px]">
              <div className="flex justify-between gap-4 p-4"><span>Droplet burning rate (heptane, 3 mm)</span><span className="num">{ro.k.mean.toFixed(2)} ± {(1.96 * ro.k.sd).toFixed(2)}</span></div>
              <div className="flex justify-between gap-4 p-4"><span>Droplet flame extinguishes early</span><span className="num">{fmtP(ro.ext.p)}</span></div>
              <div className="flex justify-between gap-4 p-4"><span>Gas flame ignites hot</span><span className="num">{fmtP(ro.ign.p)}</span></div>
              {(ro.kOut.length > 0 || ro.ignOut.length > 0) && <div className="p-4 text-[12.5px] text-signal">Outside some tested ranges: treat as extrapolation.</div>}
            </div><Link to="/lab" className="link mt-3 inline-block text-[13px] text-muted-foreground">Open the model lab</Link></div>}
          <div><div className="eyebrow mb-4">Investigations, ranked for this question</div>
            <ol className="divide-y border-y">{res.hits.map((h, i) => <li key={h.inv.id}><Link to={`/inv/${h.inv.id}`} className="group block py-3.5">
              <div className="flex items-baseline justify-between gap-3"><span className="font-medium"><span className="num mr-2.5 text-muted-foreground">{i + 1}</span>{h.inv.acronym}</span><span className="text-[12px] text-muted-foreground">{h.inv.phase}</span></div>
              <div className="mt-1 line-clamp-2 pl-6 text-[13px] text-muted-foreground">{h.reasons.slice(0, 2).join(' · ')}</div>
            </Link></li>)}</ol></div>
          {res.intent.habs[0] && <Link to={`/brief/${{ lunar: 'lunar-base', rover: 'pressurized-rover', mars: 'mars-base', iss: 'iss', spacecraft: 'spacecraft-cabin' }[res.intent.habs[0]]}`} className="btn btn-ghost">Open the {db.meta.habitats[res.intent.habs[0]].label.toLowerCase()} brief <ArrowRight size={15} /></Link>}
        </aside>
      </div>}
      {res && atm && <section className="mt-14">
        <h2 className="display mb-5 text-[32px]">{(atm.o2 * 100).toFixed(0)}% O₂ at {(atm.p_atm * PSIA).toFixed(1)} psia against every tested condition</h2>
        <div className="panel p-3 md:p-5"><EnvelopeChart db={db} focus={atm.from === 'question' ? null : res.intent.habs[0]} custom={atm.from === 'question' ? { o2: atm.o2 * 100, psia: atm.p_atm * PSIA } : null} height={420} onPick={acc => nav(`/inv/${acc}`)} /></div>
      </section>}
      {res && <p className="num mt-10 border-t pt-4 text-[12px] text-muted-foreground">Ran: {semantic && qv ? 'semantic + ' : ''}keyword retrieval over {rag?.chunks.length} PSI passages · {lit ? `literature query over ${lit.records.length} verified records` : 'literature loading'}{atm ? ` · GP, ensemble and random forest at ${(atm.o2 * 100).toFixed(0)}% O₂, ${(atm.p_atm * PSIA).toFixed(1)} psia · plotted against ${db.points.filter(p => p.o2 != null).length} conditions` : ''}. No text is generated.</p>}
    </div>
  </>
}
