// Testes do pipeline de horários. Rode com: npm test
// Todas as planilhas abaixo são SINTÉTICAS, criadas só para os testes. Nenhum dado daqui vai para o site.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import ExcelJS from 'exceljs'
import { consolidate } from './consolidate.mjs'
import { loadCurriculum } from './curriculum.mjs'
import { findLinks, pickLink, toDownloadUrl } from './discover.mjs'
import { parseSheet } from './parse-sheet.mjs'
import { allRanges, dayFromText, extractCode, extractTurma, findDays, nameKey, parseCell, parseRange, parseSchedule, parseTime } from './text.mjs'
import { runUpdate } from './update.mjs'
import { readCsv, readWorkbook, sniff, UnsupportedFormatError } from './workbook.mjs'

const curriculum = loadCurriculum(new URL('../../src/content/curriculo.ts', import.meta.url).pathname)

async function makeXlsx(build) {
  const wb = new ExcelJS.Workbook()
  build(wb)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Grade de uma sala: dias nas colunas, horários nas linhas, com células mescladas e repetidas. */
const gradeXlsx = () =>
  makeXlsx((wb) => {
    const ws = wb.addWorksheet('Sala 101')
    ws.getCell('A1').value = 'HORÁRIO DE AULAS 2026/2 - SALA 101'
    ws.mergeCells('A1:F1')
    ws.getCell('A2').value = 'Atualizado em 15/08/2026'
    ;['Horário', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].forEach((v, i) => (ws.getCell(3, i + 1).value = v))
    ws.getCell('A4').value = '07:00 - 08:50'
    ws.getCell('A5').value = '08:50 - 10:40'
    ws.getCell('A6').value = '10:40 - 12:30'
    ws.getCell('B4').value = 'COM10129 - Banco de Dados\nProf. Fulano\nT01'
    ws.mergeCells('B4:B5')
    ws.getCell('D4').value = 'MPA06839 Cálculo A'
    ws.getCell('D5').value = 'MPA06839 Cálculo A'
    ws.getCell('C6').value = 'LIVRE'
    ws.getCell('E6').value = 'FIS99999 - Física Geral'
    ws.getCell('F6').value = 'Programação I'
  })

test('texto: dias da semana', () => {
  assert.equal(dayFromText('Segunda-feira'), 1)
  assert.equal(dayFromText('2ª'), 1)
  assert.equal(dayFromText('2a feira'), 1)
  assert.equal(dayFromText('Sáb'), 6)
  assert.equal(dayFromText('Horário'), null)
  assert.equal(dayFromText('Segundo semestre'), null)
  assert.deepEqual(findDays('Seg/Qua'), [1, 3])
  assert.deepEqual(findDays('2ª e 4ª'), [1, 3])
})

test('texto: horários em formatos diferentes', () => {
  assert.deepEqual(parseRange('07:00 - 08:50'), { start: 420, end: 530, index: 0 })
  assert.equal(parseRange('7h às 8h50').end, 530)
  assert.equal(parseRange('07h00-08h50').start, 420)
  assert.equal(parseRange('19:00/20:50').end, 1250)
  assert.equal(parseTime('7h30'), 450)
  assert.equal(parseTime('abc'), null)
  assert.equal(allRanges('08:50 - 07:00').length, 0)
})

test('texto: código, turma e célula', () => {
  assert.equal(extractCode('com 06842 - Programação').code, 'COM06842')
  assert.equal(extractCode('Sala 12345'), null)
  assert.equal(extractTurma('Turma 1').turma, '01')
  assert.equal(extractTurma('Banco de Dados T02').turma, '02')
  const code = extractCode('COM10129-01 Banco de Dados')
  assert.equal(extractTurma('COM10129-01 Banco de Dados', code).turma, '01')
  const c = parseCell('COM10129 - Banco de Dados\nProf. Fulano\nT01')
  assert.deepEqual({ code: c.code, name: c.name, turma: c.turma, extra: c.extra }, { code: 'COM10129', name: 'Banco de Dados', turma: '01', extra: ['Prof. Fulano'] })
  assert.equal(parseCell('LIVRE'), null)
  assert.equal(nameKey('Programação II'), nameKey('Programacao 2'))
})

test('texto: frases de horário com vários dias', () => {
  const r = parseSchedule('Seg/Qua 07:00-08:50')
  assert.deepEqual(r.slots.map((s) => s.day), [1, 3])
  const r2 = parseSchedule('Ter 09:00-10:50, Qui 13:00-14:50')
  assert.deepEqual(r2.slots.map((s) => [s.day, s.start]), [[2, 540], [4, 780]])
  assert.equal(parseSchedule('07:00-08:50').orphans.length, 1)
  assert.equal(parseSchedule('07:00-08:50', [5]).slots[0].day, 5)
})

test('planilha: grade com células mescladas, repetidas, ignoradas e sem código', async () => {
  const sheets = await readWorkbook(await gradeXlsx(), 'sala101.xlsx')
  assert.equal(sheets.length, 1)
  const res = parseSheet(sheets[0])
  assert.equal(res.layout, 'grade')
  assert.equal(res.updatedText, '15/08/2026')
  const bd = res.aulas.find((a) => a.code === 'COM10129')
  assert.deepEqual([bd.day, bd.start, bd.end, bd.turma, bd.room], [1, 420, 640, '01', 'SALA 101'])
  assert.equal(res.aulas.filter((a) => a.code === 'MPA06839').length, 2, 'a repetição sem mescla vira duas leituras')
  assert.ok(!res.aulas.some((a) => /livre/i.test(a.name)))

  const { aulas, stats } = consolidate([{ sourceId: 'predio-central', group: 'Prédio Central', raw: res.aulas }], curriculum)
  const calc = aulas.filter((a) => a.ref === 'MPA06839')
  assert.equal(calc.length, 1, 'as leituras contíguas viram uma só')
  assert.deepEqual([calc[0].start, calc[0].end, calc[0].status, calc[0].via], ['07:00', '10:40', 'curso', 'codigo'])
  const prog = aulas.find((a) => a.name === 'Programação I')
  assert.deepEqual([prog.status, prog.via, prog.ref, prog.code], ['revisar', 'nome', 'COM06842', null])
  assert.match(prog.issues[0].text, /só pelo nome/)
  assert.equal(stats.get('predio-central').descartadas, 1, 'Física Geral não é do curso')
  assert.equal(aulas.length, 3)
})

test('planilha: lista em CSV (ponto e vírgula) com vários dias por linha', async () => {
  const csv = ['Código;Disciplina;Turma;Dia;Horário;Sala', 'COM10132;Sistemas Operacionais;01;Seg/Qua;07:00-08:50;Lab 2', 'COM10130;Linguagens Formais e Autômatos;;Ter 09:00-10:50, Qui 09:00-10:50;Sala 12', 'XYZ00001;Outra;;Sex;07:00-08:50;Sala 1', 'COM10133;Teoria dos Grafos;;Sex;sem horário;Sala 3'].join('\n')
  const sheets = await readWorkbook(Buffer.from(csv, 'utf8'), 'x.csv')
  const res = parseSheet(sheets[0])
  assert.equal(res.layout, 'lista')
  assert.equal(res.aulas.length, 5)
  assert.equal(res.aulas.filter((a) => a.code === 'COM10132').length, 2)
  assert.match(res.warnings[0], /1 linha\(s\) sem dia ou horário/)
  const so = res.aulas.find((a) => a.code === 'COM10132')
  assert.deepEqual([so.turma, so.room], ['01', 'Lab 2'])
})

test('planilha: formatos não suportados geram erro claro e abas desconhecidas geram aviso', async () => {
  assert.equal(sniff(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])), 'xls')
  await assert.rejects(readWorkbook(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'a.xls'), UnsupportedFormatError)
  await assert.rejects(readWorkbook(Buffer.from('<!DOCTYPE html><html></html>'), 'login'), /página da web/)
  await assert.rejects(readWorkbook(Buffer.from('%PDF-1.7 ...'), 'a.pdf'), /PDF/)
  const res = parseSheet({ name: 'Notas', grid: readCsv('a;b;c\nd;e;f\ng;h;i') })
  assert.equal(res.layout, null)
  assert.match(res.warnings[0], /formato não reconhecido/)
})

test('planilha: várias salas em blocos empilhados e dias com sub-colunas', async () => {
  const buf = await makeXlsx((wb) => {
    const ws = wb.addWorksheet('Salas')
    ws.getCell('A1').value = 'SALA 201'
    ;['Horário', 'Seg', 'Ter', 'Qua'].forEach((v, i) => (ws.getCell(2, i + 1).value = v))
    ws.getCell('A3').value = '07:00'
    ws.getCell('A4').value = '08:00'
    ws.getCell('B3').value = 'COM10076 Arquitetura de Computadores'
    ws.getCell('A6').value = 'SALA 202'
    ;['Horário', 'Seg', 'Ter', 'Qua'].forEach((v, i) => (ws.getCell(7, i + 1).value = v))
    ws.getCell('A8').value = '13:00 às 14:50'
    ws.getCell('C8').value = 'COM10078 - Estrutura de Dados II'
  })
  const res = parseSheet((await readWorkbook(buf, 's.xlsx'))[0])
  const arq = res.aulas.find((a) => a.code === 'COM10076')
  assert.deepEqual([arq.room, arq.start, arq.end], ['SALA 201', 420, 480], 'horário solto dura até o próximo horário')
  const ed = res.aulas.find((a) => a.code === 'COM10078')
  assert.deepEqual([ed.room, ed.day, ed.start, ed.end], ['SALA 202', 2, 780, 890])
})

test('consolidação: mantém turmas e locais diferentes, junta contíguas e avisa conflito', () => {
  const base = { code: 'COM10129', name: 'Banco de Dados', turma: '01', day: 1, room: 'Sala 1', extra: [], sheet: 'A', cell: 'B2' }
  const raw = [
    { ...base, start: 420, end: 470 },
    { ...base, start: 470, end: 530 },
    { ...base, turma: '02', start: 420, end: 530 },
    { ...base, room: 'Sala 2', start: 420, end: 530 },
    { ...base, code: 'COM10132', name: 'Sistemas Operacionais', turma: null, start: 480, end: 600 },
    { ...base, start: 420, end: 530 },
  ]
  const { aulas } = consolidate([{ sourceId: 's', group: 'Prédio Central', raw }], curriculum)
  assert.equal(aulas.filter((a) => a.ref === 'COM10129' && a.turma === '01' && a.local.room === 'Sala 1').length, 1, 'contíguas e duplicadas viram uma')
  assert.equal(aulas.filter((a) => a.ref === 'COM10129').length, 3, 'turma 02 e Sala 2 continuam separadas')
  const conflict = aulas.filter((a) => a.issues.some((i) => i.kind === 'conflito-sala'))
  assert.equal(conflict.length, 3, 'Banco de Dados T01, Banco de Dados T02 e Sistemas Operacionais disputam a Sala 1; a T01 na Sala 2 não conflita')
  assert.ok(!aulas.find((a) => a.local.room === 'Sala 2').issues.length)
  assert.equal(new Set(aulas.map((a) => a.id)).size, aulas.length, 'ids únicos')
})

test('consolidação: código fora do currículo com nome igual vai para revisão', () => {
  const raw = [{ code: 'COM99999', name: 'Banco de Dados', turma: null, day: 2, start: 420, end: 530, room: null, extra: [], sheet: 'A', cell: 'A1' }]
  const { aulas } = consolidate([{ sourceId: 's', group: 'G', raw }], curriculum)
  assert.equal(aulas[0].status, 'revisar')
  assert.equal(aulas[0].ref, 'COM10129')
  assert.match(aulas[0].issues[0].text, /COM99999.*não consta/)
})

test('descoberta: acha links por seção, prefere o semestre mais recente e converte Google Sheets', () => {
  const html = `<h2>Prédio Central</h2><ul>
    <li><a href="/f/predio-central-2026-1.xlsx">Horário 2026/1</a></li>
    <li><a href="/f/predio-central-2026-2.xlsx">Horário 2026/2</a></li></ul>
    <h2>Ciclo Básico</h2><p><a href="https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0">Planilha</a></p>
    <a href="mailto:x@y">contato</a>`
  const links = findLinks(html, 'https://graduacao.alegre.ufes.br/horario/salas')
  assert.equal(links.length, 3)
  const central = pickLink(links, { group: 'Prédio Central', match: [/predio\s+central/] })
  assert.match(central.link.href, /2026-2\.xlsx$/)
  const ciclo = pickLink(links, { group: 'Ciclo Básico', match: [/ciclo\s+basico/] })
  assert.equal(ciclo.link.downloadUrl, 'https://docs.google.com/spreadsheets/d/ABC123/export?format=xlsx')
  assert.equal(pickLink(links, { group: 'Reuni', match: [/reuni/] }).link, null)
  assert.equal(toDownloadUrl('https://drive.google.com/file/d/XYZ/view'), 'https://drive.google.com/uc?export=download&id=XYZ')
})

test('atualização: coleta, guarda a última cópia válida e informa falhas', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'horarios-'))
  const out = join(dir, 'out.json')
  const cache = join(dir, 'cache', 'cache.json')
  const salas = '<h2>Prédio Central</h2><a href="/f/central-2026-2.xlsx">Horário</a><h2>Ciclo Básico</h2><a href="/f/ciclo.csv">Horário</a>'
  const labs = '<h2>Chi-Chiu</h2><a href="/f/chichiu.csv">Horário</a>'
  const files = { '/f/central-2026-2.xlsx': await gradeXlsx(), '/f/ciclo.csv': Buffer.from('Código;Disciplina;Dia;Horário\nCOM10132;Sistemas Operacionais;Sex;07:00-08:50'), '/f/chichiu.csv': Buffer.from('Código;Disciplina;Dia;Horário\nCOM10599;Outra coisa;Sex;07:00-08:50') }
  let online = true
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (!online) return new Response('indisponível', { status: 503 })
    if (path === '/horario/salas') return new Response(salas)
    if (path === '/horario/laboratorios') return new Response(labs)
    return files[path] ? new Response(files[path]) : new Response('x', { status: 404 })
  }
  const opts = { out, cache, fetchImpl, http: { retries: 0, backoffMs: 0 }, curriculumFile: new URL('../../src/content/curriculo.ts', import.meta.url).pathname }

  const first = await runUpdate({ ...opts, now: new Date('2026-10-20T03:00:00Z') })
  const by = Object.fromEntries(first.sources.map((s) => [s.id, s]))
  assert.equal(by['predio-central'].status, 'ok')
  assert.equal(by['predio-central'].sheetUpdatedText, '15/08/2026')
  assert.equal(by['ciclo-basico'].doCurso, 1)
  assert.equal(by['chi-chiu'].descartadas, 1)
  assert.equal(by.reuni.status, 'nao-encontrada')
  assert.equal(first.lastAttempt.ok, false)
  assert.equal(first.generatedAt, '2026-10-20T03:00:00.000Z')
  const total = first.aulas.length
  assert.ok(total >= 4)
  assert.deepEqual(JSON.parse(readFileSync(cache, 'utf8')).aulas.length, total)

  online = false
  const second = await runUpdate({ ...opts, now: new Date('2026-10-21T03:00:00Z') })
  assert.equal(second.aulas.length, total, 'dados anteriores mantidos')
  assert.equal(second.generatedAt, '2026-10-20T03:00:00.000Z', 'a data dos dados não avança quando nada foi coletado')
  assert.equal(second.lastAttempt.at, '2026-10-21T03:00:00.000Z')
  assert.equal(second.lastAttempt.ok, false)
  const by2 = Object.fromEntries(second.sources.map((s) => [s.id, s]))
  assert.equal(by2['predio-central'].status, 'desatualizada')
  assert.match(by2['predio-central'].error, /503/)
  assert.equal(by2.reuni.status, 'falhou')
})

test('atualização: planilha lida mas sem aulas reconhecidas não apaga os dados anteriores', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'horarios-'))
  const out = join(dir, 'out.json')
  const files = mkdtempSync(join(tmpdir(), 'arquivos-'))
  const sources = [{ id: 'predio-central', page: 'salas', group: 'Prédio Central', match: [] }]
  const base = { out, local: files, sources, curriculumFile: new URL('../../src/content/curriculo.ts', import.meta.url).pathname }
  writeFileSync(join(files, 'predio-central.xlsx'), await gradeXlsx())
  const a = await runUpdate(base)
  assert.ok(a.aulas.length > 0)
  writeFileSync(
    join(files, 'predio-central.xlsx'),
    await makeXlsx((wb) => {
      wb.addWorksheet('Vazia').getCell('A1').value = 'em reformulação'
    }),
  )
  const b = await runUpdate(base)
  assert.equal(b.aulas.length, a.aulas.length)
  assert.equal(b.sources[0].status, 'desatualizada')
  assert.match(b.sources[0].error, /nenhuma aula do curso/)
})
