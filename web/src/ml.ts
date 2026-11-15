// In-browser inference for the surrogates trained by ml/train_models.py on measured PSI outcomes.
// GP: exact posterior mean + predictive std from the exported Cholesky factor.
// MLP ensemble: sklearn MLPClassifier (ReLU hidden, logistic output); mean and spread across members.
import { useEffect, useState } from 'react'
const B = import.meta.env.BASE_URL

export interface GPModel { type: 'gp'; features: string[]; mu: number[]; sd: number[]; ym: number; ys: number; amp: number; ls: number[]; noise: number; X: number[][]; alpha: number[]; L: number[][]; train_ranges: Record<string, [number, number]>; metrics: any }
export interface Net { W: number[][][]; b: number[][] }
export interface Tree { f: number[]; t: number[]; l: number[]; r: number[]; p: number[] }
export interface EnsModel { type: 'mlp_ensemble' | 'rf'; features: string[]; mu: number[]; sd: number[]; nets?: Net[]; trees?: Tree[]; train: number[][]; metrics: any }
export interface Models { flex_k: GPModel; flex_ext: EnsModel; cfig_ign: EnsModel; metrics: any }

let cache: Promise<Models> | null = null
export function loadModels() {
  if (!cache) cache = Promise.all(['flex_k_gp', 'flex_ext', 'cfig_ign', 'metrics'].map(n => fetch(`${B}models/${n}.json`).then(r => r.json())))
    .then(([flex_k, flex_ext, cfig_ign, metrics]) => ({ flex_k, flex_ext, cfig_ign, metrics }))
  return cache
}
export function useModels() { const [m, set] = useState<Models | null>(null); useEffect(() => { loadModels().then(set) }, []); return m }

const norm = (x: number[], mu: number[], sd: number[]) => x.map((v, i) => (v - mu[i]) / sd[i])

export function gpPredict(m: GPModel, x: number[]) {
  const z = norm(x, m.mu, m.sd); const n = m.X.length; const k = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const xi = m.X[i]; let s = 0
    for (let d = 0; d < z.length; d++) { const t = (z[d] - xi[d]) / m.ls[d]; s += t * t }
    k[i] = m.amp * Math.exp(-0.5 * s)
  }
  let mean = 0; for (let i = 0; i < n; i++) mean += k[i] * m.alpha[i]
  // forward solve L v = k
  const v = new Float64Array(n)
  for (let i = 0; i < n; i++) { const Li = m.L[i]; let s = k[i]; for (let j = 0; j < i; j++) s -= Li[j] * v[j]; v[i] = s / Li[i] }
  let vv = 0; for (let i = 0; i < n; i++) vv += v[i] * v[i]
  const varN = Math.max(1e-12, m.amp + m.noise - vv)
  const epiN = Math.max(1e-12, m.amp - vv)
  return { mean: mean * m.ys + m.ym, sd: Math.sqrt(varN) * m.ys, epistemic: Math.sqrt(epiN) * m.ys }
}

function mlp(net: Net, z: number[]) {
  let h = z
  for (let l = 0; l < net.W.length; l++) {
    const W = net.W[l], b = net.b[l], out = new Array(b.length).fill(0)
    for (let j = 0; j < b.length; j++) { let s = b[j]; for (let i = 0; i < h.length; i++) s += h[i] * W[i][j]; out[j] = l < net.W.length - 1 ? Math.max(0, s) : s }
    h = out
  }
  return 1 / (1 + Math.exp(-h[0]))
}
function tree(t: Tree, x: number[]) { let n = 0; while (t.l[n] !== -1) n = x[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n]; return t.p[n] }
export function ensPredict(m: EnsModel, x: number[]) {
  const z = norm(x, m.mu, m.sd); const ps = m.type === 'rf' ? m.trees!.map(t => tree(t, x)) : m.nets!.map(n => mlp(n, z))
  const mean = ps.reduce((a, b) => a + b, 0) / ps.length
  const sd = Math.sqrt(ps.reduce((a, b) => a + (b - mean) ** 2, 0) / ps.length)
  // distance (in standardised units) to the nearest training point: an honest "how far from data" signal
  let dmin = Infinity; for (const t of m.train) { let s = 0; for (let d = 0; d < z.length; d++) s += (z[d] - t[d]) ** 2; if (s < dmin) dmin = s }
  return { p: mean, sd, members: ps, dist: Math.sqrt(dmin) }
}
export function nearestTrain(m: { train?: number[][]; X?: number[][]; mu: number[]; sd: number[] }, x: number[], dims?: number[]) {
  const z = norm(x, m.mu, m.sd); const rows = (m.train ?? m.X)!; let best = -1, dmin = Infinity
  rows.forEach((t, i) => { let s = 0; (dims ?? z.map((_, d) => d)).forEach(d => { s += (z[d] - t[d]) ** 2 }); if (s < dmin) { dmin = s; best = i } })
  return { index: best, dist: Math.sqrt(dmin), x: rows[best].map((v, d) => v * m.sd[d] + m.mu[d]) }
}
/** CFI-G needs adiabatic flame temperature and stoichiometric mixture fraction; impute both from the
 *  5 nearest measured CFI-G tests in (O2, pressure, configuration, fuel fraction, burn rate). */
export function cfigImpute(m: EnsModel, base: number[]) {
  const z = norm([...base, 0, 0], m.mu, m.sd).slice(0, 5)
  const d = m.train.map((t, i) => ({ i, s: t.slice(0, 5).reduce((a, v, k) => a + (v - z[k]) ** 2, 0) })).sort((a, b) => a.s - b.s).slice(0, 5)
  const avg = (k: number) => d.reduce((a, r) => a + m.train[r.i][k], 0) / d.length * m.sd[k] + m.mu[k]
  return [...base, avg(5), avg(6)]
}
export const inRange = (r: Record<string, [number, number]>, feats: string[], x: number[]) => feats.filter((f, i) => r[f] && (x[i] < r[f][0] - 1e-9 || x[i] > r[f][1] + 1e-9))

/** Next-experiment recommender: where would one more FLEX-style droplet test teach the burning-rate
 *  model the most, weighted by how close that condition is to a crewed-habitat atmosphere? */
export interface Candidate { o2: number; p: number; sd: number; mean: number; relevance: number; value: number; hab: string; nearest: number[]; nearestDist: number }
export function recommend(m: GPModel, habs: { label: string; o2: number; p_atm: number }[], opts: { heptane: number; D0: number; xCO2: number; xHe: number }) {
  const out: Candidate[] = []
  for (let i = 0; i <= 25; i++) for (let j = 0; j <= 30; j++) {
    const o2 = 0.15 + i * 0.01, p = 0.45 + j * 0.025
    const x = [o2, p, opts.xCO2, opts.xHe, opts.heptane, opts.D0]; const g = gpPredict(m, x)
    let rel = 0, hab = ''
    for (const h of habs) { const r = Math.exp(-(((o2 - h.o2) / 0.04) ** 2 + ((p - h.p_atm) / 0.12) ** 2) / 2); if (r > rel) { rel = r; hab = h.label } }
    const nt = nearestTrain(m, x, [0, 1, 4])
    out.push({ o2, p, sd: g.epistemic, mean: g.mean, relevance: rel, value: g.epistemic * (0.15 + rel), hab, nearest: nt.x, nearestDist: nt.dist })
  }
  return out
}
