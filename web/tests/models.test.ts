// Parity: the browser implementations in src/ml.ts must reproduce scikit-learn's own predictions
// for the exported models (reference values written by ml/train_models.py).
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { gpPredict, ensPredict, type GPModel, type EnsModel } from '../src/ml'
const M = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../public/models', n), 'utf8'))
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference.json'), 'utf8'))
describe('browser models match scikit-learn', () => {
  it('Gaussian process burning rate: mean and std', () => {
    const m = M('flex_k_gp.json') as GPModel
    for (const r of REF.flex_k) { const g = gpPredict(m, r.x); expect(g.mean).toBeCloseTo(r.mean, 3); expect(g.sd).toBeCloseTo(r.sd, 3) }
  })
  it('deep-ensemble extinction probability', () => {
    const m = M('flex_ext.json') as EnsModel
    for (const r of REF.flex_ext) expect(ensPredict(m, r.x).p).toBeCloseTo(r.p, 3)
  })
  it('random-forest ignition probability', () => {
    const m = M('cfig_ign.json') as EnsModel
    for (const r of REF.cfig_ign) expect(ensPredict(m, r.x).p).toBeCloseTo(r.p, 3)
  })
})
describe('data integrity', () => {
  const inv = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/investigations.json'), 'utf8'))
  const cond = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/conditions.json'), 'utf8'))
  it('24 investigations, every one linked to its PSI record', () => { expect(inv.length).toBe(24); for (const i of inv) expect(i.sourceUrl).toMatch(/psi\.nasa\.gov/) })
  it('every recorded condition carries its verbatim NASA cells', () => {
    for (const p of cond.points.filter((p: any) => p.status === 'recorded')) { expect(p.src.table).toMatch(/\.csv$/); expect(p.src.cells.o2[1]).not.toBe('') }
  })
  it('oxygen fractions and pressures are physical', () => {
    for (const p of cond.points) { if (p.o2 != null) expect(p.o2).toBeGreaterThan(0.1); if (p.o2 != null) expect(p.o2).toBeLessThanOrEqual(1); if (p.p_atm != null) expect(p.p_atm).toBeGreaterThan(0.2) }
  })
})
