// Oxygen margin of safety (OMOS), NASA/TM-2008-215260 Eq. 1: mean 0g limit minus mean 1g limit.
// A material rated by the 1-g NASA-STD-6001 Test 1 at limit L may burn in reduced gravity at about L + OMOS.
import type { earthVsOrbit } from '@/components/Headline'

export type Row = ReturnType<typeof earthVsOrbit>[number]
export type Cls = 'thin' | 'thick'
export const clsOf = (key: string): Cls => key === 'pmma' ? 'thick' : 'thin'

/** Values NASA reported but that we cannot recompute from tabulated records (shown, never mixed into the fit). */
export const REPORTED = [
  { label: 'Thin films and fabrics, 0 g, lunar and Martian g (mean)', omos: -2.6, cls: 'thin' as Cls, src: '20130000677', who: 'Urban et al., IAC-12, 2012' },
  { label: 'PMMA rods (SMµRF, SoFIE)', omos: -1.4, cls: 'thick' as Cls, src: '20200000361', who: 'Ferkul et al., 2019' },
  { label: 'PMMA ¼-inch rod, 1-g blowoff vs BASS-II', omos: -2.4, cls: 'thick' as Cls, src: '20160000593', who: 'Ferkul et al., 2014' },
]

export function omosStats(rows: Row[], cls: Cls) {
  const v = rows.filter(r => clsOf(r.key) === cls).map(r => r.omos)
  if (cls === 'thick') v.push(...REPORTED.filter(r => r.cls === 'thick').map(r => r.omos))
  return { n: v.length, mean: v.reduce((a, b) => a + b, 0) / v.length, worst: Math.min(...v), best: Math.max(...v) }
}

export type Verdict = 'burns-1g' | 'retest' | 'holds'
/** limit1g: Test 1 limiting O2 (%); habO2: habitat O2 (%). */
export function check(limit1g: number, habO2: number, s: { mean: number; worst: number }) {
  const orbitMean = limit1g + s.mean, orbitWorst = limit1g + s.worst
  const verdict: Verdict = limit1g <= habO2 ? 'burns-1g' : orbitWorst > habO2 ? 'holds' : 'retest'
  return { orbitMean, orbitWorst, margin1g: limit1g - habO2, marginOrbit: orbitWorst - habO2, verdict }
}
export const VERDICT: Record<Verdict, { h: string; tone: string }> = {
  'burns-1g': { h: 'Fails the 1-g test at this oxygen', tone: 'text-signal' },
  retest: { h: 'Passes at 1 g, but the margin can vanish in reduced gravity: test in microgravity', tone: 'text-signal' },
  holds: { h: 'Margin holds even with the largest loss measured so far', tone: 'text-ok' },
}

/** Leave-one-material-out: de-rate each thin material with the other thin materials' OMOS, compare to its measured 0 g limit. */
export function looCheck(rows: Row[]) {
  const thin = rows.filter(r => clsOf(r.key) === 'thin')
  return thin.map(r => {
    const others = thin.filter(o => o.key !== r.key).map(o => o.omos)
    const mean = others.reduce((a, b) => a + b, 0) / others.length, worst = Math.min(...others)
    return { label: r.label, measured: r.ug, predMean: r.g1 + mean, predWorst: r.g1 + worst, conservative: r.g1 + worst <= r.ug }
  })
}
