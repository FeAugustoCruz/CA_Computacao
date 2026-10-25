// Testes da lógica de exibição (src/lib/horarios.ts). Dados sintéticos, só para teste.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agrupar, contar, dispor, escala, estadoDados, FILTROS_VAZIOS, filtrar, filtrosAtivos, opcoes, yDe } from '../../src/lib/horarios.ts'

let n = 0
const aula = (o = {}) => ({
  id: `a${++n}`,
  code: 'COM10129',
  ref: 'COM10129',
  name: 'Banco de Dados',
  turma: null,
  day: 1,
  start: '07:00',
  end: '08:50',
  local: { group: 'Prédio Central', room: 'Sala 1' },
  status: 'curso',
  via: 'codigo',
  source: { id: 'predio-central', sheet: 'A', cell: 'B2' },
  extra: [],
  issues: [],
  ...o,
})

const lista = [
  aula(),
  aula({ day: 3, start: '09:00', end: '10:50', turma: '01' }),
  aula({ code: 'COM06842', ref: 'COM06842', name: 'Programação I', day: 2, start: '13:00', end: '14:50', local: { group: 'Ciclo Básico', room: 'Sala 7' } }),
  aula({ code: 'COM10599', ref: 'COM11013', name: 'Mineração de Dados', day: 5, start: '19:00', end: '20:50', local: { group: 'Laboratório Reuni', room: null }, status: 'revisar', via: 'nome', code: null }),
]

test('filtros: pesquisa sem acento, por nome e por código', () => {
  assert.equal(filtrar(lista, { ...FILTROS_VAZIOS, q: 'programacao' }).length, 1)
  assert.equal(filtrar(lista, { ...FILTROS_VAZIOS, q: 'com10129' }).length, 2)
  assert.equal(filtrar(lista, { ...FILTROS_VAZIOS, q: 'banco dados' }).length, 2)
  assert.equal(filtrar(lista, { ...FILTROS_VAZIOS, q: 'inexistente' }).length, 0)
})

test('filtros: funcionam em conjunto', () => {
  const f = (o) => filtrar(lista, { ...FILTROS_VAZIOS, ...o }).length
  assert.equal(f({ dia: 3 }), 1)
  assert.equal(f({ local: 'Ciclo Básico' }), 1)
  assert.equal(f({ turma: '01' }), 1)
  assert.equal(f({ periodo: '4' }), 2, 'Banco de Dados é do 4º período')
  assert.equal(f({ periodo: '1' }), 1)
  assert.equal(f({ periodo: 'op' }), 1, 'Mineração de Dados é optativa')
  assert.equal(f({ de: '09:00' }), 3)
  assert.equal(f({ ate: '10:50' }), 2)
  assert.equal(f({ de: '09:00', ate: '10:50' }), 1)
  assert.equal(f({ ocultarRevisar: true }), 3)
  assert.equal(f({ q: 'dados', dia: 1, periodo: '4', local: 'Prédio Central' }), 1)
})

test('filtros: contagem de filtros ativos e limpeza', () => {
  assert.equal(filtrosAtivos(FILTROS_VAZIOS), 0)
  assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, q: '  ' }), 0)
  assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, q: 'x', dia: 2, ocultarRevisar: true }), 3)
})

test('agrupamento: uma entrada por disciplina, ordenada por período, sem duplicar a disciplina', () => {
  const g = agrupar(lista)
  assert.deepEqual(g.map((x) => x.name), ['Programação I', 'Banco de Dados', 'Mineração de Dados'])
  const bd = g.find((x) => x.name === 'Banco de Dados')
  assert.equal(bd.aulas.length, 2)
  assert.deepEqual(bd.turmas, ['01'])
  assert.equal(g.find((x) => x.name === 'Mineração de Dados').aRevisar, 1)
  assert.deepEqual(contar(lista), { aulas: 4, disciplinas: 3 })
  assert.deepEqual(opcoes(lista).locais, ['Ciclo Básico', 'Laboratório Reuni', 'Prédio Central'])
})

test('grade: aulas sobrepostas ficam lado a lado e grupos independentes não se afetam', () => {
  const b = dispor([aula({ start: '07:00', end: '09:00' }), aula({ start: '07:30', end: '08:30' }), aula({ start: '09:00', end: '10:00' })])
  const por = (s) => b.find((x) => x.aula.start === s)
  assert.deepEqual([por('07:00').col, por('07:00').cols], [0, 2])
  assert.deepEqual([por('07:30').col, por('07:30').cols], [1, 2])
  assert.deepEqual([por('09:00').col, por('09:00').cols], [0, 1])
})

test('grade: escala usa horários reais e comprime intervalos longos sem aula', () => {
  const esc = escala([aula({ start: '07:00', end: '08:50' }), aula({ start: '14:00', end: '15:50' })], 1, 30)
  assert.equal(esc.trechos.filter((t) => t.vazio).length, 1)
  assert.equal(esc.altura, 120 + 30 + 120)
  assert.equal(yDe(esc, 7 * 60 + 30), 30)
  assert.equal(yDe(esc, 14 * 60), 150)
  assert.equal(escala([]).altura, 0)
  const curto = escala([aula({ start: '07:00', end: '08:00' }), aula({ start: '09:00', end: '10:00' })], 1, 30)
  assert.equal(curto.trechos.filter((t) => t.vazio).length, 0, 'intervalo curto não é comprimido')
  const longa = escala([aula({ start: '07:00', end: '07:50' })], 1)
  assert.equal(yDe(longa, 7 * 60 + 50), 50, 'durações diferentes de 1h são respeitadas')
})

test('estado dos dados: vazio, antigo e falha na última atualização', () => {
  const base = { schemaVersion: 1, course: 'x', generatedAt: null, lastAttempt: null, sources: [], aulas: [] }
  assert.equal(estadoDados(base, Date.now()).vazio, true)
  const agora = Date.parse('2026-10-20T12:00:00Z')
  const velho = estadoDados({ ...base, generatedAt: '2026-10-10T12:00:00Z', aulas: lista, lastAttempt: { at: '2026-10-20T03:00:00Z', ok: false, message: 'x' }, sources: [{ status: 'desatualizada' }] }, agora)
  assert.deepEqual([velho.vazio, velho.dias, velho.antigo, velho.falhou, velho.fontesComProblema], [false, 10, true, true, 1])
  assert.equal(estadoDados({ ...base, generatedAt: '2026-10-19T12:00:00Z', aulas: lista }, agora).antigo, false)
})
