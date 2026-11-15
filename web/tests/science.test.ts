// Every number the submission states is recomputed here from the shipped data, so a pipeline change
// that moves a headline number fails CI instead of silently contradicting the write-up.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { earthVsOrbit, thinMeanOmos, type Lit } from '../src/components/Headline'
import { check, looCheck, omosStats } from '../src/margin'
import { litFor, litNear } from '../src/components/LitEvidence'
import { recommend, type GPModel } from '../src/ml'
import { envelopeStats } from '../src/components/Envelope'
const J = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'))
const lit = J('public/data/literature.json') as Lit
const cond = J('public/data/conditions.json').points as { acc: string; o2: number | null; p_atm: number | null; fuel?: string; kind?: string }[]
const meta = J('public/data/meta.json')
const subPath = path.join(__dirname, '../../submission/submission.md')
// The submission text is kept outside the public repo; its wording checks run only where it exists.
const sub = fs.existsSync(subPath) ? fs.readFileSync(subPath, 'utf8') : null
const says = (t: string) => { if (sub) expect(sub).toContain(t) }
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')

describe('literature database', () => {
  it('708 unique records from 84 reports, counts match the submission', () => {
    expect(lit.records.length).toBe(708); expect(Object.keys(lit.papers).length).toBe(84)
    const measured = lit.records.filter(r => r.basis === 'measured').length
    says(`${measured} first-hand`)
  })
  it('every record quotes its source and the quote contains the value (verification firewall)', () => {
    for (const r of lit.records) {
      expect(lit.papers[r.paper]).toBeDefined()
      const q = squash(r.quote).replace(/(\d),(\d{3})/g, '$1$2')
      const nums = (q.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
      expect(nums.some(n => Math.abs(Math.abs(n) - Math.abs(r.value)) < 1e-6 * Math.max(1, Math.abs(r.value)))).toBe(true)
    }
  })
  it('predictions phrased "will be" are not labelled as measurements', () => {
    for (const r of lit.records) if (/\bwill\s+(not\s+)?be\b/i.test(r.quote)) expect(r.basis).not.toBe('measured')
  })
})

describe('oxygen margin of safety (NASA/TM-2008-215260 Eq. 1)', () => {
  const rows = earthVsOrbit(lit); const R = Object.fromEntries(rows.map(r => [r.key, r]))
  it('reproduces the paper: Mylar -3.9, Ultem -2.75, Nomex -1.2', () => {
    expect(R['mylar'].omos).toBeCloseTo(-3.9, 2); expect(R['ultem 1000'].omos).toBeCloseTo(-2.75, 2); expect(R['nomex ht90-40'].omos).toBeCloseTo(-1.2, 2)
  })
  it('thin-material mean reproduces NASA’s published average of 2.6 points (Urban et al. 2012)', () => { expect(Math.abs(thinMeanOmos(rows) + 2.6)).toBeLessThan(0.05) })
  it('thick class uses NASA-reported PMMA rod margins (worst −2.4)', () => { expect(Math.abs(R['pmma'].omos)).toBeLessThan(0.5); expect(omosStats(Object.values(R), 'thick').worst).toBeCloseTo(-2.4, 5) })
  it('material check: a thin material rated 31% at 1 g needs re-testing for a 30% habitat', () => {
    expect(check(31, 30, omosStats(rows, 'thin')).verdict).toBe('retest'); expect(check(29, 30, omosStats(rows, 'thin')).verdict).toBe('burns-1g'); expect(check(35, 30, omosStats(rows, 'thin')).verdict).toBe('holds')
  })
  it('leave-one-material-out: worst-case de-rating is conservative for Ultem and Nomex, not for Mylar (disclosed on the site)', () => {
    const L = Object.fromEntries(looCheck(rows).map(r => [r.label, r.conservative])); expect(L).toEqual({ 'Mylar film': false, 'Ultem film': true, 'Nomex fabric': true })
  })
  it('submission states the reproduced numbers', () => { says('−3.9'); says('2.6') })
})

describe('evidence gap', () => {
  const inv = J('public/data/investigations.json') as any[]
  const st = envelopeStats({ points: cond, byId: Object.fromEntries(inv.map(i => [i.id, i])) } as any)
  it('PSI solid-material tests stop at 22.2% O2', () => { expect(st.solidMax * 100).toBeCloseTo(22.2, 1); says('22.2% O₂') })
  it('84 exploration-band conditions, none of them solids', () => { expect(st.explor).toBe(84); expect(st.explorSolid).toBe(0); says('PSI holds 84 conditions') })
  it('1,186 unit-normalised conditions', () => { expect(cond.length).toBe(1186) })
})

describe('literature lookups', () => {
  it('investigation match is exact: BASS does not pull BASS-II records', () => {
    expect(litFor(lit, 'BASS').every(r => (r as any).investigation === 'BASS')).toBe(true)
    expect(litFor(lit, 'BASS-II').length).toBeGreaterThan(0)
  })
  it('lunar habitat surfaces the LUCI partial-gravity flight first', () => {
    const L = litNear(lit, 30, 0.166)
    expect(L.partial[0].gravity_g).toBeCloseTo(0.167, 2)
    expect(L.partial.some(r => (r as any).investigation === 'LUCI')).toBe(true)
  })
})

describe('next-experiment recommender', () => {
  it('top pick is a heptane droplet at 36% O2 and 7.7 psia', () => {
    const m = J('public/models/flex_k_gp.json') as GPModel; const H = meta.habitats
    const best = recommend(m, [H.lunar, H.rover], { heptane: 1, D0: 3, xCO2: 0, xHe: 0 }).sort((a, b) => b.value - a.value)[0]
    expect(best.o2).toBeCloseTo(0.36, 2); expect(best.p * 14.696).toBeCloseTo(7.7, 0)
  })
})

describe('SI interpretations (machine-checked)', () => {
  const I = J('public/data/interpretations.json') as { habitats: Record<string, { text: string; cites: { text: string }[] }[]>; investigations: Record<string, { text: string; cites: { text: string }[] }[]> }
  const nums = (s: string) => (s.match(/(?<![\w.])[-−]?\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map(x => Math.abs(+x.replace('−', '-').replace(/,/g, '')))
  it('covers every habitat and all 24 investigations', () => { expect(Object.keys(I.habitats).length).toBe(5); expect(Object.keys(I.investigations).length).toBe(24) })
  it('every number in every sentence appears in its cited facts', () => {
    for (const group of [I.habitats, I.investigations]) for (const ss of Object.values(group)) for (const s of ss) {
      expect(s.cites.length).toBeGreaterThan(0)
      const pool = s.cites.flatMap(c => nums(c.text)); for (const v of nums(s.text)) expect(pool).toContain(v)
    }
  })
  it('no overclaiming words', () => { const all = JSON.stringify(I); expect(/\b(guarantee\w*|certif\w*|proves?|proven|revolutionary)\b/i.test(all)).toBe(false) })
})

describe('BASS-II outcomes restored from NASA/TM-20210011385', () => {
  const B2 = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/bass2.json'), 'utf8'))
  it('restores outcomes for most PSI BASS-II tests and agrees with the independent NASA paper', () => {
    expect(B2.n_tests).toBe(129); expect(B2.rows.filter((r: { obs: string | null }) => r.obs).length).toBeGreaterThanOrEqual(120); expect(B2.crosscheck.agrees).toBe(true)
  })
  it('model beats the base rate held out, and PMMA rods burn below their 1-g blowoff limit', () => {
    expect(B2.model.loo_brier).toBeLessThan(B2.model.baseline_brier); expect(B2.model.o2_50.rod.hi).toBeLessThan(16); expect(B2.model.o2_50.nomex.identified).toBe(false); expect(B2.model.o2_50.slab.identified).toBe(false); expect(B2.model.o2_50.rod.identified).toBe(true); expect(B2.brackets.nomex.highest_out.o2).toBeGreaterThan(22)
  })
  it('flags only physically impossible PSI cells', () => { for (const f of B2.psi_flags) expect(/final O2 (\d+\.?\d*)/.exec(f.issue)).not.toBeNull(); expect(B2.psi_flags.length).toBe(5) })
})
