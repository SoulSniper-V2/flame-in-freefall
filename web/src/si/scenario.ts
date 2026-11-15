// Scenario engine: rank investigations by distance from a user-defined habitat condition.
import type { Inv, Pt, Cat } from '../data'
export type MatClass = 'Solid' | 'Liquid' | 'Gas' | 'Smoke' | 'Any'
export interface Scenario { o2: number; psia: number; g: number; flow: number; mat: MatClass; focus: Cat | 'all' }
export interface ScenHit { inv: Inv; score: number; nearest: Pt | null; dist: number | null; inside: boolean; notes: string[] }
const flowOf = (i: Inv): [number, number] | null => {
  if (i.ranges.flow_cms) return i.ranges.flow_cms
  const m = i.si.flow.match(/(\d+(?:\.\d+)?)\s*(?:-|–)\s*(\d+(?:\.\d+)?)\s*cm\/s/); if (m) return [+m[1], +m[2]]
  const u = i.si.flow.match(/up to (\d+)\s*cm\/s/i); if (u) return [0, +u[1]]
  if (/quiescent/i.test(i.si.flow)) return [0, 0]
  return null
}
export function runScenario(invs: Inv[], pts: Pt[], s: Scenario): ScenHit[] {
  const o2 = s.o2 / 100, p = s.psia / 14.696
  return invs.map(inv => {
    const notes: string[] = []
    const mine = pts.filter(q => q.acc === inv.id && q.o2 != null)
    let nearest: Pt | null = null, dist: number | null = null
    for (const q of mine) {
      const d = q.p_atm != null ? Math.hypot((q.o2! - o2) / 0.1, (q.p_atm - p) / 0.3) : Math.abs(q.o2! - o2) / 0.1 + 0.5
      if (dist == null || d < dist) { dist = d; nearest = q }
    }
    const atm = dist == null ? 0.2 : Math.exp(-dist)
    const r = inv.ranges; const inO2 = r.o2_frac ? o2 >= r.o2_frac[0] - 0.005 && o2 <= r.o2_frac[1] + 0.005 : false
    const inP = r.p_atm ? p >= r.p_atm[0] - 0.02 && p <= r.p_atm[1] + 0.02 : false
    const inside = inO2 && inP
    const phaseMatch = s.mat === 'Any' ? 1 : s.mat === 'Smoke' ? (/Smoke|Aerosol/.test(inv.phase) ? 1 : 0.2) : inv.phase.startsWith(s.mat) || (s.mat === 'Solid' && /emulating solids/.test(inv.phase)) ? 1 : /Computational/.test(inv.phase) && inv.si.fuels.join(' ').match(s.mat === 'Solid' ? /PMMA|wax/ : s.mat === 'Liquid' ? /droplet|alkane/ : /gas/) ? 0.7 : 0.25
    const fr = flowOf(inv); let flowM = 0.5
    if (fr) { const d = s.flow < fr[0] ? fr[0] - s.flow : s.flow > fr[1] ? s.flow - fr[1] : 0; flowM = Math.exp(-d / 10) }
    const micro = /Microgravity/.test(inv.si.gravity); const gM = s.g < 0.01 ? (micro ? 1 : 0.5) : micro ? 0.6 + (inv.id === 'PSI-22' ? 0.15 : 0) : 0.5
    const catScore = s.focus === 'all' ? inv.fireSafetyIndex / 100 : inv.categories[s.focus].score / 10
    const score = 100 * (0.32 * atm + 0.22 * phaseMatch + 0.12 * flowM + 0.1 * gM + 0.24 * catScore)
    if (inside) notes.push(nearest?.kind === 'target' ? 'Inside the exploration atmospheres targeted by this investigation (pressures from objectives text).' : nearest?.kind === 'matrix' ? 'Inside the tabulated O₂ × pressure test matrix — interpolation.' : 'Scenario lies inside the tested O₂–pressure envelope — interpolation.')
    else if (r.o2_frac && r.p_atm) notes.push(`Outside tested envelope (O₂ ${Math.round(r.o2_frac[0] * 100)}–${Math.round(r.o2_frac[1] * 100)}%, ${(r.p_atm[0] * 14.696).toFixed(1)}–${(r.p_atm[1] * 14.696).toFixed(1)} psia) — extrapolation.`)
    else if (r.o2_frac) notes.push(`Only O₂ is tabulated (${Math.round(r.o2_frac[0] * 100)}–${Math.round(r.o2_frac[1] * 100)}%); pressure unknown in PSI.`)
    else notes.push('No tabulated O₂/pressure test conditions in PSI for this investigation.')
    if (fr && (s.flow < fr[0] || s.flow > fr[1])) notes.push(fr[1] === 0 ? `Tested quiescent (no forced flow); your airflow is ${s.flow} cm/s.` : `Airflow ${s.flow} cm/s outside tested ${fr[0] === fr[1] ? fr[0] : `${fr[0]}–${fr[1]}`} cm/s.`)
    if (s.g > 0.01 && micro) notes.push(`Microgravity data bound ${s.g} g from below only; 1-g data bound it from above.`)
    return { inv, score, nearest, dist, inside, notes }
  }).sort((a, b) => b.score - a.score)
}
export function caveats(s: Scenario): string[] {
  const c: string[] = []
  if (s.g > 0.01 && s.g < 0.99) c.push(`No partial-gravity (${s.g} g) combustion data exist in PSI yet (future LUCI / FM2). Microgravity and 1-g results bound intermediate gravity; E-FIELD Flames used electric fields to mimic buoyancy.`)
  if (s.o2 > 40) c.push(`Only ACME Flame Design and CFI-G tabulate O₂ above 40% (up to 85%) and only for gaseous fuels — solid/liquid flammability at ${s.o2}% O₂ is an extrapolation.`)
  if (s.o2 >= 99) c.push('Pure-O₂ environments (e.g., spacesuits at 4.3 psia, Apollo 1 cabin) are far outside all PSI test envelopes. Treat every result as qualitative.')
  if (s.psia < 7) c.push(`Lowest tabulated pressure in PSI combustion tables is ≈6.3 psia (ACME Flame Design). ${s.psia} psia is extrapolation.`)
  if (s.o2 > 22 && s.mat === 'Solid') c.push('Solid-fuel microgravity tests in PSI (BASS, BASS-II, Saffire) stayed at ≤ 22% O₂; ACME BRE emulated solids up to 40% O₂ with a gas burner.')
  if (s.flow === 0) c.push('Quiescent flow: ACME BRE found flames at elevated O₂ kept burning with no airflow — ventilation shutdown may not extinguish fires.')
  c.push('Scores rank relevance of existing evidence; they are not flammability predictions or certification guidance.')
  return c
}
