// Carrega a grade curricular (gerada a partir do PDF do currículo por scripts/gen-curriculo.py).
import { readFileSync } from 'node:fs'
import { nameKey } from './text.mjs'

/** Lê as disciplinas de src/content/curriculo.ts (uma disciplina em JSON por linha). */
export function loadCurriculum(file) {
  const src = readFileSync(file, 'utf8')
  const list = []
  for (const line of src.split('\n')) {
    const m = /^\s*(\{"code".*\}),?\s*$/.exec(line)
    if (m) list.push(JSON.parse(m[1]))
  }
  if (list.length === 0) throw new Error(`Nenhuma disciplina encontrada em ${file}`)
  return indexCurriculum(list)
}

export function indexCurriculum(list) {
  const byCode = new Map(list.map((d) => [d.code, d]))
  const byNameKey = new Map()
  for (const d of list) {
    const k = nameKey(d.name)
    byNameKey.set(k, [...(byNameKey.get(k) ?? []), d])
  }
  return { list, byCode, byNameKey }
}
