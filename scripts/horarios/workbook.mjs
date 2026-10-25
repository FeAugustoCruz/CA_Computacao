// Leitura de planilhas para uma estrutura simples: abas com uma grade de células.
// Cada célula: { v: texto, rs: linhas ocupadas, cs: colunas ocupadas, m: true se faz parte de uma mescla e não é a célula principal }.
import ExcelJS from 'exceljs'

export class UnsupportedFormatError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UnsupportedFormatError'
  }
}

const MAX_ROWS = 600
const MAX_COLS = 80

/** Número da coluna (1 = A) -> letras. */
export function colLetters(n) {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
/** Posição 0-based -> referência de célula estilo A1. */
export const cellRef = (r, c) => `${colLetters(c + 1)}${r + 1}`

/** Identifica o formato pelos primeiros bytes. */
export function sniff(buf) {
  const b = Buffer.from(buf.subarray(0, 8))
  if (b[0] === 0x50 && b[1] === 0x4b) return 'zip'
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'xls'
  if (b.toString('latin1', 0, 4) === '%PDF') return 'pdf'
  const head = Buffer.from(buf.subarray(0, 512)).toString('utf8').trimStart().toLowerCase()
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<?xml')) return 'html'
  return 'text'
}

/**
 * Lê o arquivo e devolve [{ name, grid }].
 * Formatos aceitos: .xlsx e .csv. Outros geram UnsupportedFormatError com a explicação.
 */
export async function readWorkbook(buf, hint = '') {
  const kind = sniff(buf)
  if (kind === 'zip') return readXlsx(buf, hint)
  if (kind === 'text') return [{ name: hint || 'CSV', grid: readCsv(Buffer.from(buf).toString('utf8').replace(/^﻿/, '')) }]
  if (kind === 'xls') throw new UnsupportedFormatError('arquivo no formato antigo .xls (Excel 97-2003), ainda não suportado; salve como .xlsx')
  if (kind === 'pdf') throw new UnsupportedFormatError('o arquivo é um PDF, não uma planilha')
  throw new UnsupportedFormatError('o endereço devolveu uma página da web (HTML/XML) em vez de uma planilha; o arquivo pode exigir login ou não é um link direto')
}

async function readXlsx(buf, hint) {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buf)
  } catch (e) {
    throw new UnsupportedFormatError(`não foi possível abrir como .xlsx (${hint || 'arquivo'}): ${e.message}. Se for .ods ou outro formato, salve como .xlsx`)
  }
  const sheets = []
  for (const ws of wb.worksheets) {
    if (ws.state && ws.state !== 'visible') continue
    sheets.push({ name: ws.name, grid: sheetToGrid(ws) })
  }
  return sheets
}

function cellText(cell) {
  const val = cell.value
  if (val == null) return ''
  if (val instanceof Date) {
    // Horário puro vem como data em 1899-12-30; data completa vem como data de verdade.
    const y = val.getUTCFullYear()
    const hh = String(val.getUTCHours()).padStart(2, '0')
    const mm = String(val.getUTCMinutes()).padStart(2, '0')
    if (y <= 1900) return `${hh}:${mm}`
    const d = `${String(val.getUTCDate()).padStart(2, '0')}/${String(val.getUTCMonth() + 1).padStart(2, '0')}/${y}`
    return hh === '00' && mm === '00' ? d : `${d} ${hh}:${mm}`
  }
  if (typeof val === 'object' && val.error) return ''
  try {
    return String(cell.text ?? '').replace(/[   ]/g, ' ').trim()
  } catch {
    return ''
  }
}

function sheetToGrid(ws) {
  const rows = Math.min(ws.rowCount, MAX_ROWS)
  const cols = Math.min(ws.columnCount, MAX_COLS)
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ v: '', rs: 1, cs: 1, m: false })))
  for (let r = 1; r <= rows; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= cols; c++) grid[r - 1][c - 1].v = cellText(row.getCell(c))
  }
  // Mesclas: a célula principal guarda o texto e o tamanho; as demais repetem o texto e ficam marcadas.
  for (const range of ws.model.merges ?? []) {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range)
    if (!m) continue
    const toCol = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
    const c1 = toCol(m[1]) - 1, r1 = Number(m[2]) - 1, c2 = toCol(m[3]) - 1, r2 = Number(m[4]) - 1
    if (r1 >= rows || c1 >= cols) continue
    const master = grid[r1][c1]
    master.rs = Math.min(r2, rows - 1) - r1 + 1
    master.cs = Math.min(c2, cols - 1) - c1 + 1
    for (let r = r1; r <= Math.min(r2, rows - 1); r++)
      for (let c = c1; c <= Math.min(c2, cols - 1); c++) {
        if (r === r1 && c === c1) continue
        grid[r][c] = { v: master.v, rs: 1, cs: 1, m: true }
      }
  }
  return trimGrid(grid)
}

/** Remove linhas e colunas vazias do fim. */
export function trimGrid(grid) {
  let lastRow = -1
  let lastCol = -1
  grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.v !== '') {
        lastRow = Math.max(lastRow, r)
        lastCol = Math.max(lastCol, c)
      }
    }),
  )
  return grid.slice(0, lastRow + 1).map((row) => row.slice(0, lastCol + 1))
}

/** CSV simples (RFC 4180): aspas, vírgula, ponto e vírgula ou tabulação. */
export function readCsv(text) {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n')
  const delim = [';', '\t', ','].map((d) => [d, firstLines.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]
  const rows = []
  let row = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) {
      row.push(cur)
      cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else cur += ch
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    rows.push(row)
  }
  const width = Math.min(MAX_COLS, Math.max(0, ...rows.map((r) => r.length)))
  const grid = rows.slice(0, MAX_ROWS).map((r) => Array.from({ length: width }, (_, c) => ({ v: (r[c] ?? '').trim(), rs: 1, cs: 1, m: false })))
  return trimGrid(grid)
}
