// Client-side "Ask the dashboard": BM25 lexical retrieval + intent parsing, optionally fused with
// transformers.js sentence embeddings (all-MiniLM-L6-v2) loaded lazily from a CDN. No API keys.
import type { Inv, Cat, HabKey } from '../data'
const STOP = new Set('a an the of and or for to in on at by with from is are be was were this that these those it its as into how what which who whose do does did can could should would about over under than then there their our your my me we you i not no yes most more less best data investigation investigations experiment experiments study studies nasa'.split(' '))
const SYN: Record<string, string[]> = {
  smoke: ['smoke', 'aerosol', 'particle', 'soot', 'detector', 'detection'], detect: ['detection', 'detector', 'smoke', 'sensor'],
  extinguish: ['suppression', 'suppressant', 'extinction', 'extinguish', 'nitrogen', 'co2', 'helium'], suppress: ['suppression', 'suppressant', 'extinction', 'extinguish'],
  fabric: ['fabric', 'cotton', 'sibal', 'nomex', 'textile'], cloth: ['fabric', 'cotton', 'nomex'], plastic: ['pmma', 'plastic', 'polymer', 'kapton', 'teflon', 'silicone'],
  droplet: ['droplet', 'liquid', 'fuel', 'heptane', 'methanol'], liquid: ['droplet', 'liquid', 'heptane', 'methanol', 'dodecane'],
  oxygen: ['oxygen', 'o2', 'enriched', 'elevated'], moon: ['lunar', 'moon', 'exploration', 'reduced', 'pressure', 'elevated', 'oxygen'], lunar: ['lunar', 'moon', 'exploration', 'elevated', 'oxygen'],
  mars: ['mars', 'exploration', 'partial', 'gravity'], spread: ['spread', 'growth', 'flame', 'flammability'], model: ['model', 'modeling', 'simulation', 'cfd', 'validation', 'predictive'],
  material: ['material', 'materials', 'selection', 'flammability', 'screening'], ventilation: ['flow', 'airflow', 'ventilation', 'quiescent', 'velocity'], airflow: ['flow', 'airflow', 'velocity', 'ventilation'],
  cool: ['cool', 'low-temperature', 'warm'], large: ['large', 'scale', 'saffire', 'cygnus'], suit: ['suit', 'oxygen', 'enriched', 'high'],
}
export const tok = (s: string) => s.toLowerCase().replace(/[^a-z0-9.%\- ]/g, ' ').split(/\s+/).map(t => t.replace(/^[-.]+|[-.]+$/g, '')).filter(t => t.length > 1 && !STOP.has(t))
export function docText(i: Inv) {
  return [i.acronym, i.acronym, i.title, i.family, i.phase, i.subResearchArea, i.keywords.join(' '), i.si.summary, i.si.summary, i.si.findings.join(' '), i.si.fuels.join(' '), i.si.geometry,
    i.si.o2, i.si.pressure, i.si.flow, i.si.hardware, i.si.sensors.join(' '), i.si.variables.join(' '), i.si.earth.join(' '),
    Object.values(i.categories).map(c => c.rationale).join(' '), i.psi.objective, i.psi.impacts].join(' ')
}
export interface Index { docs: string[][]; df: Map<string, number>; avgdl: number; ids: string[] }
export function buildIndex(invs: Inv[]): Index {
  const docs = invs.map(i => tok(docText(i))); const df = new Map<string, number>()
  docs.forEach(d => new Set(d).forEach(t => df.set(t, (df.get(t) || 0) + 1)))
  return { docs, df, avgdl: docs.reduce((a, d) => a + d.length, 0) / docs.length, ids: invs.map(i => i.id) }
}
function bm25(ix: Index, q: string[], k1 = 1.4, b = 0.75) {
  const N = ix.docs.length
  return ix.docs.map(d => {
    const tf = new Map<string, number>(); d.forEach(t => tf.set(t, (tf.get(t) || 0) + 1))
    let s = 0; const hits: string[] = []
    for (const t of new Set(q)) {
      const f = tf.get(t) || 0; if (!f) continue; hits.push(t)
      const n = ix.df.get(t) || 0; const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.length / ix.avgdl))
    }
    return { s, hits }
  })
}
export interface Intent { cats: Cat[]; habs: HabKey[]; o2?: number; psi?: number; phase?: string }
export function parseIntent(q: string): Intent {
  const l = q.toLowerCase(); const cats: Cat[] = []; const habs: HabKey[] = []
  if (/smoke|detect|sensor|alarm|aerosol/.test(l)) cats.push('detection')
  if (/suppress|extingu|put out|nitrogen|co2|halon|mist|fight/.test(l)) cats.push('suppression')
  if (/prevent|material|flammab|select|screen|ignit/.test(l)) cats.push('prevention')
  if (/model|predict|simulat|cfd|valid/.test(l)) cats.push('modeling')
  if (/moon|lunar|artemis/.test(l)) habs.push('lunar')
  if (/mars|martian/.test(l)) habs.push('mars')
  if (/rover/.test(l)) habs.push('rover')
  if (/\biss\b|space station/.test(l)) habs.push('iss')
  if (/spacecraft|capsule|cabin|orion|vehicle/.test(l)) habs.push('spacecraft')
  const o = l.match(/(\d+(?:\.\d+)?)\s*%\s*(?:o2|oxygen)?/); const p = l.match(/(\d+(?:\.\d+)?)\s*psi/)
  const phase = /fabric|solid|pmma|plastic|cloth|cotton/.test(l) ? 'Solid' : /droplet|liquid/.test(l) ? 'Liquid' : /gas|burner|methane|ethylene/.test(l) ? 'Gas' : undefined
  return { cats, habs, o2: o ? +o[1] / 100 : undefined, psi: p ? +p[1] : undefined, phase }
}
export interface Hit { inv: Inv; score: number; lex: number; sem: number | null; reasons: string[] }
export function rank(invs: Inv[], ix: Index, q: string, sem?: number[] | null): Hit[] {
  const raw = tok(q); const qx = raw.flatMap(t => [t, ...(SYN[t] || []), ...(t.endsWith('s') ? [t.slice(0, -1)] : [])])
  const lex = bm25(ix, qx); const maxL = Math.max(1e-9, ...lex.map(x => x.s)); const it = parseIntent(q)
  return invs.map((inv, k) => {
    const reasons: string[] = []; const l = lex[k].s / maxL
    if (lex[k].hits.length) reasons.push(`matches “${lex[k].hits.slice(0, 5).join('”, “')}”`)
    let boost = 0
    for (const c of it.cats) { boost += inv.categories[c].score / 10 * 0.35; reasons.push(`${c} relevance ${inv.categories[c].score}/10 — ${inv.categories[c].rationale}`) }
    for (const h of it.habs) { boost += inv.habitats[h].score / 100 * 0.35; reasons.push(`${h} habitat score ${inv.habitats[h].score}/100`) }
    if (it.phase && inv.phase.startsWith(it.phase)) { boost += 0.15; reasons.push(`fuel phase: ${inv.phase}`) }
    if (it.o2 != null && inv.ranges.o2_frac) {
      const [a, b] = inv.ranges.o2_frac; const d = it.o2 < a ? a - it.o2 : it.o2 > b ? it.o2 - b : 0
      boost += 0.3 * Math.exp(-d / 0.05); reasons.push(d === 0 ? `tested O₂ range ${Math.round(a * 100)}–${Math.round(b * 100)}% covers ${Math.round(it.o2 * 100)}%` : `nearest tested O₂ is ${Math.round(d * 100)} pts away`)
    }
    if (it.psi != null && inv.ranges.p_atm) {
      const [a, b] = inv.ranges.p_atm.map(x => x * 14.696); const d = it.psi < a ? a - it.psi : it.psi > b ? it.psi - b : 0
      boost += 0.2 * Math.exp(-d / 2); reasons.push(d === 0 ? `tested pressures ${a.toFixed(1)}–${b.toFixed(1)} psia cover ${it.psi} psia` : `nearest tested pressure ${d.toFixed(1)} psia away`)
    }
    const s = sem ? sem[k] : null
    const score = (sem ? 0.45 * l + 0.55 * Math.max(0, (s! - 0.1) / 0.6) : l) + boost + inv.fireSafetyIndex / 1000
    if (s != null) reasons.push(`semantic similarity ${(s * 100).toFixed(0)}%`)
    return { inv, score, lex: l, sem: s, reasons }
  }).sort((a, b) => b.score - a.score)
}
// ---- optional semantic layer (transformers.js) ----
let embedder: any = null; let docVecs: number[][] | null = null
export async function enableSemantic(invs: Inv[], onStatus: (s: string) => void) {
  onStatus('Loading transformers.js + MiniLM model (~25 MB, cached after first load)…')
  // @ts-ignore - runtime CDN import
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2')
  mod.env.allowLocalModels = false
  embedder = await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  onStatus('Embedding 24 investigations in your browser…')
  docVecs = []
  for (const i of invs) { const o = await embedder(`${i.acronym}. ${i.title}. ${i.si.summary} ${i.si.findings.join(' ')} ${i.si.fuels.join(', ')}`, { pooling: 'mean', normalize: true }); docVecs.push(Array.from(o.data as Float32Array)) }
  onStatus('Semantic mode on — hybrid BM25 + embedding ranking.')
}
export async function semScores(q: string): Promise<number[] | null> {
  if (!embedder || !docVecs) return null
  const o = await embedder(q, { pooling: 'mean', normalize: true }); const v = Array.from(o.data as Float32Array)
  return docVecs.map(d => d.reduce((a, x, k) => a + x * v[k], 0))
}
