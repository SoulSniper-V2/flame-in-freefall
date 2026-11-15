import { pipeline } from '@huggingface/transformers'
import fs from 'fs'
const invs = JSON.parse(fs.readFileSync('/workspace/flame-in-freefall/web/public/data/investigations.json'))
const sent = t => (t || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter(s => s.length > 20)
const chunks = []
for (const i of invs) {
  const add = (field, text) => text && text.length > 30 && chunks.push({ id: i.id, a: i.acronym, field, text: text.trim() })
  add('summary', i.si.summary)
  i.si.findings.forEach(f => add('finding', f))
  add('conditions', `${i.acronym} test conditions — fuels: ${i.si.fuels.join(', ')}; geometry: ${i.si.geometry}; oxygen: ${i.si.o2}; pressure: ${i.si.pressure}; airflow: ${i.si.flow}; gravity: ${i.si.gravity}; hardware: ${i.si.hardware}; sensors: ${i.si.sensors.join(', ')}.`)
  for (const [c, v] of Object.entries(i.categories)) add(`${c} rationale`, `${i.acronym} ${c} relevance ${v.score}/10: ${v.rationale}`)
  for (const [field, txt] of Object.entries(i.psi)) { const s = sent(txt); for (let k = 0; k < s.length; k += 3) add(field, s.slice(k, k + 3).join(' ')) }
}
console.log('chunks', chunks.length)
const ex = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })
const vecs = []
for (let k = 0; k < chunks.length; k += 32) {
  const b = chunks.slice(k, k + 32).map(c => `${c.a}: ${c.text}`)
  const o = await ex(b, { pooling: 'mean', normalize: true })
  for (let j = 0; j < b.length; j++) vecs.push(Array.from(o.data.slice(j * 384, (j + 1) * 384)))
}
const q = new Int8Array(vecs.length * 384); vecs.forEach((v, r) => v.forEach((x, c) => q[r * 384 + c] = Math.max(-127, Math.min(127, Math.round(x * 127 / 0.4)))))
fs.writeFileSync('/workspace/flame-in-freefall/web/public/data/rag_chunks.json', JSON.stringify({ model: 'Xenova/all-MiniLM-L6-v2', dim: 384, scale: 0.4 / 127, chunks, emb: Buffer.from(q.buffer).toString('base64') }))
console.log('done', vecs.length)
