import { useEffect, useState } from 'react'
export type Cat = 'prevention' | 'detection' | 'suppression' | 'modeling'
export const CATS: Cat[] = ['prevention', 'detection', 'suppression', 'modeling']
export type HabKey = 'spacecraft' | 'iss' | 'lunar' | 'mars' | 'rover'
export const HABS: HabKey[] = ['lunar', 'rover', 'mars', 'iss', 'spacecraft']
export interface Inv {
  id: string; acronym: string; title: string; family: string; phase: string; projectType: string; subResearchArea: string; platform: string
  startDate: string; endDate: string; doi: string; pis: string[]; keywords: string[]; hardwarePSI: string; hardwareLink: string
  psi: { objective: string; approach: string; hypothesis: string; impacts: string }
  publications: { title: string; doi: string; authors: string }[]
  files: { count: number; totalBytes: number; folders: string[] } | null; tables: string[]; tableRows: number
  si: { fuels: string[]; geometry: string; o2: string; pressure: string; flow: string; gravity: string; hardware: string; sensors: string[]; variables: string[]; findings: string[]; summary: string; earth: string[]; related: string[] }
  ranges: { o2_frac?: [number, number] | null; p_atm?: [number, number] | null; flow_cms?: [number, number] | null; n_points?: number; kinds?: string[] }
  categories: Record<Cat, { score: number; rationale: string }>
  habitats: Record<HabKey, { score: number; atmMatch: number; gravityMatch: number; rationale: string }>
  fireSafetyIndex: number; realism: number; thumb: string | null; sourceUrl: string; doiUrl: string | null; apiUrl: string
}
export interface Pt { acc: string; test: string; o2: number | null; p_atm: number | null; flow_cms?: number | null; fuel: string; kind: string; status?: 'recorded' | 'o2_only' | 'matrix' | 'target' | 'approx'; note?: string; src?: { table: string; line: number; cells: { o2?: [string, string]; p?: [string, string] }; punit?: string } }
export const STATUS_LABEL: Record<string, string> = { recorded: 'recorded in table', o2_only: 'O₂ recorded, pressure not', matrix: 'test-matrix level', target: 'target named in objectives', approx: 'approximate, from text' }
export interface Hab { label: string; o2: number; p_atm: number; g: number; note: string }
export interface Meta { generated: string; habitats: Record<HabKey, Hab>; categoryWeights: Record<Cat, number>; excluded: Record<string, string>; count: number; testPoints: number; tableRows: number }
export interface DB { invs: Inv[]; points: Pt[]; meta: Meta; byId: Record<string, Inv> }
const B = import.meta.env.BASE_URL
let cache: Promise<DB> | null = null
export function loadDB(): Promise<DB> {
  if (!cache) cache = Promise.all([`${B}data/investigations.json`, `${B}data/conditions.json`, `${B}data/meta.json`].map(u => fetch(u).then(r => r.json())))
    .then(([invs, c, meta]) => ({ invs, points: c.points, meta, byId: Object.fromEntries((invs as Inv[]).map(i => [i.id, i])) }))
  return cache
}
export function useDB() { const [db, set] = useState<DB | null>(null); useEffect(() => { loadDB().then(set) }, []); return db }
export const asset = (p: string) => `${B}${p}`
export const PSIA = 14.696
export const fmtRange = (r: [number, number] | null | undefined, f: (x: number) => string) => !r ? 'not tabulated' : r[0] === r[1] ? f(r[0]) : `${f(r[0])}–${f(r[1])}`
export const pct = (x: number) => `${+(x * 100).toFixed(1)}%`
export const psia = (x: number) => `${(x * PSIA).toFixed(1)} psia`
export const CAT_LABEL: Record<Cat, string> = { prevention: 'Prevention', detection: 'Detection', suppression: 'Suppression', modeling: 'Modeling' }
export const HAB_SLUG: Record<HabKey, string> = { lunar: 'lunar-base', rover: 'pressurized-rover', mars: 'mars-base', iss: 'iss', spacecraft: 'spacecraft-cabin' }
export const SLUG_HAB: Record<string, HabKey> = Object.fromEntries(Object.entries(HAB_SLUG).map(([k, v]) => [v, k as HabKey]))
export const phaseOf = (inv: Inv | undefined): 'solid' | 'liquid' | 'gas' | 'other' => {
  if (!inv) return 'other'
  const p = inv.phase.toLowerCase()
  if (p.startsWith('solid')) return 'solid'
  if (p.startsWith('liquid')) return 'liquid'
  if (p.startsWith('gas')) return 'gas'
  return 'other'
}
/** Transparent habitat-relevance score, recomputable in the browser with user weights. */
export interface Weights { safety: number; atmosphere: number; gravity: number; realism: number }
export const DEFAULT_WEIGHTS: Weights = { safety: 50, atmosphere: 25, gravity: 10, realism: 15 }
export function habitatScore(inv: Inv, h: HabKey, w: Weights) {
  const hs = inv.habitats[h]; return combine(inv, hs.atmMatch, hs.gravityMatch, w)
}
function combine(inv: Inv, atm: number, grav: number, w: Weights) {
  const tot = w.safety + w.atmosphere + w.gravity + w.realism || 1
  const parts = { safety: (w.safety / tot) * inv.fireSafetyIndex, atmosphere: (w.atmosphere / tot) * 100 * atm, gravity: (w.gravity / tot) * 100 * grav, realism: (w.realism / tot) * 100 * inv.realism }
  return { score: parts.safety + parts.atmosphere + parts.gravity + parts.realism, parts }
}
/** Same atmosphere-match rule as pipeline/build_dataset.py: exp(-distance) to the nearest tabulated point,
 *  distance in units of 10 O2 points and 0.3 atm; O2-only points count at 60%. */
export function atmMatch(db: DB, acc: string, o2: number, p_atm: number) {
  let best: number | null = null, nearest: Pt | null = null
  for (const q of db.points) {
    if (q.acc !== acc || q.o2 == null) continue
    const m = q.p_atm != null ? Math.exp(-Math.hypot((q.o2 - o2) / 0.1, (q.p_atm - p_atm) / 0.3)) : 0.6 * Math.exp(-Math.abs(q.o2 - o2) / 0.1)
    if (best == null || m > best) { best = m; nearest = q }
  }
  return { match: best ?? 0.25, nearest }
}
export function gravMatch(inv: Inv, g: number) {
  const micro = /Microgravity/.test(inv.si.gravity)
  return g === 0 ? (micro ? 1 : 0.5) : (micro ? 0.65 : 0.5) + (inv.id === 'PSI-22' ? 0.15 : 0)
}
export function scoreAt(db: DB, inv: Inv, atm: { o2: number; p_atm: number; g: number }, w: Weights) {
  const a = atmMatch(db, inv.id, atm.o2, atm.p_atm); const g = gravMatch(inv, atm.g)
  return { ...combine(inv, a.match, g, w), nearest: a.nearest, atm: a.match, grav: g }
}
export const fmtP = (p: number) => p >= 0.995 ? '>99%' : p <= 0.005 ? '<1%' : `${(p * 100).toFixed(0)}%`
export const fmtG = (g: number) => g === 0 ? 'microgravity' : Math.abs(g - 0.166) < 0.01 ? '⅙ g (Moon)' : Math.abs(g - 0.38) < 0.01 ? '0.38 g (Mars)' : `${g} g`
