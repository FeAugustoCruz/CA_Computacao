// Interpretação de uma aba de planilha. Reconhece dois formatos, sem depender de posições fixas de células:
//  - "grade": dias da semana nas colunas e horários nas linhas (uma ou várias salas por aba);
//  - "lista": uma linha por aula, com colunas de disciplina, código, dia, horário e local.
// O que não for reconhecido vira aviso. Nunca se inventa informação.
import { allRanges, allTimes, clean, dayFromText, extractCode, findDays, isIgnorable, norm, parseCell, parseSchedule, parseTime } from './text.mjs'
import { cellRef } from './workbook.mjs'

/**
 * @typedef {{code:string|null,name:string,turma:string|null,day:number,start:number,end:number,room:string|null,extra:string[],sheet:string,cell:string|null}} RawAula
 */

const ROOM_HINT = /\b(sala|salas|lab|laboratorio|laboratorios|auditorio|anfiteatro|bloco|predio|ciclo basico)\b/
const UPDATED_RE = /atualizad[oa]\s*(?:em|:)?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/

const at = (grid, r, c) => grid[r]?.[c]
const text = (grid, r, c) => at(grid, r, c)?.v ?? ''
const rowCells = (grid, r) => (grid[r] ?? []).map((cell, c) => ({ cell, c })).filter((x) => x.cell.v !== '' && !x.cell.m)

/** Início/fim de um rótulo de linha: "07:00 - 08:50" ou só "07:00". */
function timeLabel(v) {
  const r = allRanges(v)[0]
  if (r) return { start: r.start, end: r.end }
  const singles = allTimes(v)
  if (singles.length === 1 && clean(v).length <= 12) return { start: singles[0].at, end: null }
  return null
}

/** Lê uma aba e devolve as aulas encontradas, avisos e o formato reconhecido. */
export function parseSheet(sheet) {
  const { name, grid } = sheet
  const warnings = []
  const filled = grid.reduce((n, row) => n + row.filter((c) => c.v !== '' && !c.m).length, 0)
  if (filled < 4) return { aulas: [], warnings, layout: 'vazia', updatedText: null }

  let updatedText = null
  for (let r = 0; r < Math.min(grid.length, 10) && !updatedText; r++)
    for (const { cell } of rowCells(grid, r)) {
      const m = UPDATED_RE.exec(norm(cell.v))
      if (m) updatedText = m[1]
    }

  const headers = findGradeHeaders(grid)
  if (headers.length) {
    const res = parseGrade(sheet, headers)
    warnings.push(...res.warnings)
    if (res.aulas.length || !findListHeader(grid)) return { aulas: res.aulas, warnings, layout: 'grade', updatedText }
  }
  const list = findListHeader(grid)
  if (list) {
    const res = parseList(sheet, list)
    warnings.push(...res.warnings)
    return { aulas: res.aulas, warnings, layout: 'lista', updatedText }
  }
  warnings.push(`Aba "${name}": formato não reconhecido (não encontrei dias da semana nas colunas nem colunas de disciplina e horário). Nada foi lido desta aba.`)
  return { aulas: [], warnings, layout: null, updatedText }
}

/* ------------------------------------------------------------------ grade */

function findGradeHeaders(grid) {
  const out = []
  for (let r = 0; r < grid.length; r++) {
    const days = []
    for (const { cell, c } of rowCells(grid, r)) {
      const d = dayFromText(cell.v)
      if (d != null && !days.some((x) => x.day === d)) days.push({ day: d, c, cs: cell.cs })
    }
    if (days.length >= 3) out.push({ row: r, days })
  }
  // Cabeçalhos em linhas consecutivas são o mesmo cabeçalho.
  return out.filter((h, i) => i === 0 || h.row !== out[i - 1].row + 1)
}

function parseGrade(sheet, headers) {
  const { name, grid } = sheet
  const aulas = []
  const warnings = []
  const unreadable = []

  headers.forEach((h, i) => {
    const nextHeader = headers[i + 1]?.row ?? grid.length
    const minDayCol = Math.min(...h.days.map((d) => d.c))
    const lastRow = trimTitleRows(grid, nextHeader - 1, h.row, minDayCol)
    const title = blockTitle(grid, h, i > 0 ? headers[i - 1].row : -1, minDayCol)

    // Coluna(s) de horário: a mais à esquerda dos dias com mais rótulos de hora.
    const timeCols = pickTimeColumns(grid, h.row + 1, lastRow, minDayCol)
    if (!timeCols) {
      warnings.push(`Aba "${name}"${title ? `, bloco "${title}"` : ''}: achei os dias da semana, mas não achei a coluna de horários. Bloco ignorado.`)
      return
    }
    const slots = buildSlots(grid, h.row + 1, lastRow, timeCols)
    if (!slots.length) return
    const slotByRow = new Map(slots.map((s) => [s.row, s]))

    // Sublinha de cabeçalho com nomes de sala por coluna (quando cada dia tem várias colunas).
    const roomByCol = new Map()
    const firstDataRow = slots[0].row
    for (let r = h.row + 1; r < firstDataRow; r++) {
      const cells = rowCells(grid, r).filter(({ c, cell }) => c >= minDayCol && !extractCode(cell.v) && !allRanges(cell.v).length)
      if (cells.length >= 2) cells.forEach(({ c, cell }) => roomByCol.set(c, clean(cell.v).replace(/\n/g, ' ')))
    }

    for (const d of h.days) {
      for (let c = d.c; c < d.c + Math.max(1, d.cs); c++) {
        for (const slot of slots) {
          const cell = at(grid, slot.row, c)
          if (!cell || cell.m || isIgnorable(cell.v)) continue
          const parsed = parseCell(cell.v)
          if (!parsed) {
            unreadable.push(cellRef(slot.row, c))
            continue
          }
          const lastSlot = lastSlotWithin(slots, slot.row, slot.row + Math.max(1, cell.rs) - 1, slotByRow)
          const end = lastSlot.end
          if (end <= slot.start) continue
          aulas.push({
            code: parsed.code,
            name: parsed.name,
            turma: parsed.turma,
            day: d.day,
            start: slot.start,
            end,
            room: cleanRoom(roomByCol.get(c) ?? title ?? name),
            extra: parsed.extra,
            sheet: name,
            cell: cellRef(slot.row, c),
          })
        }
      }
    }
  })

  if (unreadable.length) warnings.push(`Aba "${name}": ${unreadable.length} célula(s) com texto que não consegui interpretar (ex.: ${unreadable.slice(0, 3).join(', ')}).`)
  return { aulas, warnings }
}

/** Sobe a partir do fim do bloco enquanto as linhas forem vazias ou títulos do próximo bloco. */
function trimTitleRows(grid, from, headerRow, minDayCol) {
  let r = from
  while (r > headerRow) {
    const cells = rowCells(grid, r)
    const hasTime = cells.some(({ cell, c }) => c < minDayCol && timeLabel(cell.v))
    const titleLike = cells.length > 0 && cells.length <= 2 && cells.every(({ cell }) => ROOM_HINT.test(norm(cell.v)) && !extractCode(cell.v))
    if (hasTime) break
    if (cells.length === 0 || titleLike) r--
    else break
  }
  return r
}

/** Título do bloco (sala): texto acima do cabeçalho ou no canto esquerdo da linha do cabeçalho. */
function blockTitle(grid, header, prevHeaderRow, minDayCol) {
  const candidates = []
  for (let r = header.row; r >= Math.max(prevHeaderRow + 1, header.row - 3); r--) {
    for (const { cell, c } of rowCells(grid, r)) {
      if (r === header.row && c >= minDayCol) continue
      const t = clean(cell.v).replace(/\n/g, ' ')
      if (!t || dayFromText(t) != null || timeLabel(t)) continue
      if (/^(hor[aá]rios?|hora|horas)$/i.test(t)) continue
      candidates.push({ t, hint: ROOM_HINT.test(norm(t)), r })
    }
  }
  const best = candidates.find((x) => x.hint)
  if (!best) return null
  // Fica só com o trecho a partir da palavra-chave ("Horário 2026/2 - SALA 101" -> "SALA 101").
  const m = /\b(sala|laborat[oó]rio|lab\.?|audit[oó]rio|anfiteatro)\b.*/i.exec(best.t)
  return (m ? m[0] : best.t).replace(/\s+[-–|]\s+(?:20\d{2}.*|hor[aá]rio.*)$/i, '').trim()
}

function pickTimeColumns(grid, fromRow, toRow, minDayCol) {
  const score = []
  for (let c = 0; c < minDayCol; c++) {
    let ranges = 0
    let singles = 0
    for (let r = fromRow; r <= toRow; r++) {
      const cell = at(grid, r, c)
      if (!cell || cell.v === '') continue
      const t = timeLabel(cell.v)
      if (!t) continue
      if (t.end != null) ranges++
      else singles++
    }
    score.push({ c, ranges, singles })
  }
  const best = [...score].sort((a, b) => b.ranges + b.singles - (a.ranges + a.singles) || a.c - b.c)[0]
  if (!best || best.ranges + best.singles < 1) return null
  if (best.ranges >= best.singles) return { start: best.c, end: null }
  // Horários soltos: a coluna seguinte pode ser o fim.
  const next = score.find((s) => s.c === best.c + 1)
  return { start: best.c, end: next && next.singles >= Math.ceil(best.singles / 2) ? next.c : null }
}

function buildSlots(grid, fromRow, toRow, cols) {
  const slots = []
  for (let r = fromRow; r <= toRow; r++) {
    const a = at(grid, r, cols.start)
    if (!a || a.v === '') continue
    const t = timeLabel(a.v)
    if (!t) continue
    let end = t.end
    if (end == null && cols.end != null) {
      const e = timeLabel(text(grid, r, cols.end))
      if (e) end = e.start
    }
    slots.push({ row: r, start: t.start, end })
  }
  // Sem horário de fim: vai até o início do próximo horário (se próximo) ou dura 60 min, a hora-aula oficial do campus.
  slots.forEach((s, i) => {
    if (s.end != null) return
    const next = slots[i + 1]
    s.end = next && next.start > s.start && next.start - s.start <= 180 ? next.start : s.start + 60
  })
  return slots.filter((s) => s.end > s.start)
}

function lastSlotWithin(slots, fromRow, toRow, byRow) {
  if (toRow <= fromRow) return byRow.get(fromRow)
  let best = byRow.get(fromRow)
  for (const s of slots) if (s.row >= fromRow && s.row <= toRow) best = s
  return best
}

function cleanRoom(r) {
  const t = clean(r ?? '').replace(/\n/g, ' ').trim()
  return t || null
}

/* ------------------------------------------------------------------ lista */

const ROLE_PATTERNS = [
  ['code', /^(cod(\.|igo)?( da)?( disciplina| disc\.?)?|cod\.? disc\.?|codigo)$/],
  ['name', /^(nome( da)?( disciplina| componente)?|disciplina|componente( curricular)?|atividade)$/],
  ['turma', /^(turma|tur\.?|secao)$/],
  ['dia', /^(dia( da semana)?|dias( da semana)?)$/],
  ['horario', /^(horarios?|hora|horas|dia e horario|horario das aulas)$/],
  ['inicio', /^(inicio|hora inicio|hora inicial|inicial|das)$/],
  ['fim', /^(fim|termino|hora fim|hora final|final|ate)$/],
  ['sala', /^(sala|local|ambiente|laboratorio|lab\.?|espaco)$/],
  ['predio', /^(predio|bloco)$/],
]

function findListHeader(grid) {
  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const roles = new Map()
    for (const { cell, c } of rowCells(grid, r)) {
      const t = norm(cell.v).replace(/[:*]/g, '').replace(/\s+/g, ' ').trim()
      const hit = ROLE_PATTERNS.find(([, re]) => re.test(t))
      if (hit && !roles.has(hit[0])) roles.set(hit[0], c)
    }
    const hasWho = roles.has('code') || roles.has('name')
    const hasWhen = roles.has('dia') || roles.has('horario') || roles.has('inicio')
    if (roles.size >= 3 && hasWho && hasWhen) return { row: r, roles }
  }
  return null
}

function parseList(sheet, header) {
  const { name: sheetName, grid } = sheet
  const { roles } = header
  const aulas = []
  const warnings = []
  const bad = []
  let sectionDay = null
  const get = (r, role) => (roles.has(role) ? clean(text(grid, r, roles.get(role))).replace(/\n/g, ' ') : '')

  for (let r = header.row + 1; r < grid.length; r++) {
    const cells = rowCells(grid, r)
    if (cells.length === 0) continue
    // Linha de seção com o dia ("SEGUNDA-FEIRA") vale para as linhas seguintes quando não há coluna de dia.
    if (cells.length === 1 && dayFromText(cells[0].cell.v) != null && !roles.has('dia')) {
      sectionDay = dayFromText(cells[0].cell.v)
      continue
    }
    const codeTxt = get(r, 'code')
    const nameTxt = get(r, 'name')
    const parsed = parseCell([codeTxt, nameTxt].filter(Boolean).join(' - ') || nameTxt || codeTxt)
    if (!parsed) continue
    const turma = parsed.turma ?? (get(r, 'turma') ? get(r, 'turma').replace(/^turma\s*/i, '').trim().toUpperCase().padStart(/^\d+$/.test(get(r, 'turma')) ? 2 : 1, '0') : null)

    const diaTxt = get(r, 'dia')
    const fallbackDays = findDays(diaTxt).length ? findDays(diaTxt) : sectionDay ? [sectionDay] : []
    let slots = []
    if (roles.has('inicio') && roles.has('fim')) {
      const s = parseTime(get(r, 'inicio'))
      const e = parseTime(get(r, 'fim'))
      if (s != null && e != null && e > s) slots = fallbackDays.map((day) => ({ day, start: s, end: e }))
    }
    if (!slots.length) {
      const res = parseSchedule([diaTxt, get(r, 'horario')].filter(Boolean).join(' '), fallbackDays)
      slots = res.slots
    }
    if (!slots.length) {
      bad.push(cellRef(r, roles.get('horario') ?? roles.get('dia') ?? roles.get('inicio') ?? 0))
      continue
    }
    const room = [get(r, 'predio'), get(r, 'sala')].filter(Boolean).join(' · ') || sheetName
    for (const s of slots)
      aulas.push({ code: parsed.code, name: parsed.name, turma, day: s.day, start: s.start, end: s.end, room: cleanRoom(room), extra: parsed.extra, sheet: sheetName, cell: cellRef(r, 0) })
  }
  if (bad.length) warnings.push(`Aba "${sheetName}": ${bad.length} linha(s) sem dia ou horário reconhecível (ex.: ${bad.slice(0, 3).join(', ')}).`)
  return { aulas, warnings }
}
