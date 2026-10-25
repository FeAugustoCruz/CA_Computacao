// Funções de texto usadas para interpretar as planilhas: dias, horários, código e turma.
// Tudo aqui é puro (sem rede e sem arquivos), para poder ser testado com facilidade.

/** Minúsculas e sem acentos. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Troca espaços especiais por espaço comum, junta espaços repetidos e apara cada linha. */
export const clean = (s) =>
  String(s ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l, i, a) => l || (i > 0 && i < a.length - 1 && a[i - 1]))
    .join('\n')
    .trim()

/* ------------------------------------------------------------------ dias */

const DAY_NAME = { segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 7, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 7 }
// Convenção do SIGAA: 2ª = segunda ... 7ª = sábado.
const DAY_ORDINAL = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 }

const DAY_RE = /(?<![a-z0-9])(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)(?![a-z])|(?<![0-9a-z])([2-7])\s*(?:[ªº°]|a\s*-?\s*feira)/g

/** Dia ISO (1 = segunda ... 7 = domingo) se o texto inteiro for só um dia; senão null. */
export function dayFromText(text) {
  const t = norm(text).replace(/[.,:;]/g, '').trim()
  if (!t) return null
  const found = findDays(t)
  const letters = t.replace(/-?\s*feira/g, '').replace(/[^a-z0-9ªº°]/g, '')
  return found.length === 1 && letters.length <= 9 ? found[0] : null
}

/** Todos os dias citados num texto, na ordem em que aparecem e sem repetir. */
export function findDays(text) {
  const out = []
  const t = norm(text)
  for (const m of t.matchAll(DAY_RE)) {
    const d = m[1] ? DAY_NAME[m[1]] : DAY_ORDINAL[Number(m[2])]
    if (d && !out.includes(d)) out.push(d)
  }
  return out
}

/* --------------------------------------------------------------- horários */

const T = String.raw`(\d{1,2})(?:\s*:\s*(\d{2})|\s*h\s*(\d{2})?)`
const RANGE_RE = new RegExp(`${T}\\s*(?:-|–|—|/|\\ba\\b|\\bas\\b|\\bate\\b)\\s*${T}`, 'g')
const SINGLE_RE = new RegExp(`(?<![0-9])${T}(?![0-9])`, 'g')

const toMinutes = (h, m) => {
  const hh = Number(h)
  const mm = m == null || m === '' ? 0 : Number(m)
  if (!Number.isInteger(hh) || hh < 0 || hh > 24 || mm < 0 || mm > 59 || (hh === 24 && mm > 0)) return null
  return hh * 60 + mm
}

/** "07:00", "7h", "7h30" -> minutos desde 00:00; senão null. Só aceita o texto inteiro. */
export function parseTime(text) {
  const t = norm(text).trim()
  const m = new RegExp(`^${T}$`).exec(t)
  return m ? toMinutes(m[1], m[2] ?? m[3]) : null
}

/** Primeiro intervalo "07:00 - 08:50" / "7h às 8h50" / "07h00-08h50" -> {start, end} em minutos; senão null. */
export function parseRange(text) {
  return allRanges(text)[0] ?? null
}

/** Todos os intervalos de horário encontrados no texto, com a posição de cada um. */
export function allRanges(text) {
  const out = []
  const t = norm(text)
  for (const m of t.matchAll(RANGE_RE)) {
    const start = toMinutes(m[1], m[2] ?? m[3])
    let end = toMinutes(m[4], m[5] ?? m[6])
    if (start == null || end == null) continue
    if (end === 0) end = 24 * 60
    if (end <= start) continue
    out.push({ start, end, index: m.index ?? 0 })
  }
  return out
}

/** Horários soltos ("07:00") encontrados no texto, fora de intervalos. */
export function allTimes(text) {
  const out = []
  const t = norm(text)
  for (const m of t.matchAll(SINGLE_RE)) {
    const v = toMinutes(m[1], m[2] ?? m[3])
    if (v != null) out.push({ at: v, index: m.index ?? 0 })
  }
  return out
}

export const fmtTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/**
 * Interpreta frases como "Seg/Qua 07:00-08:50", "2ª 4ª 07h-08h50 e 6ª 10h-11h50".
 * Devolve [{day, start, end}] e a lista de intervalos que ficaram sem dia (fallbackDays pode preencher).
 */
export function parseSchedule(text, fallbackDays = []) {
  const t = norm(text)
  const tokens = []
  for (const m of t.matchAll(DAY_RE)) {
    const d = m[1] ? DAY_NAME[m[1]] : DAY_ORDINAL[Number(m[2])]
    if (d) tokens.push({ kind: 'day', day: d, index: m.index ?? 0 })
  }
  for (const r of allRanges(text)) tokens.push({ kind: 'range', ...r })
  tokens.sort((a, b) => a.index - b.index)

  const result = []
  const orphans = []
  let pending = []
  let last = []
  for (const tk of tokens) {
    if (tk.kind === 'day') {
      pending.push(tk.day)
    } else {
      // Horário sem dia logo antes repete os dias do horário anterior ("Seg 07:00-08:50 09:00-10:50").
      const days = pending.length ? pending : last.length ? last : fallbackDays
      if (days.length === 0) orphans.push({ start: tk.start, end: tk.end })
      for (const day of days) result.push({ day, start: tk.start, end: tk.end })
      if (pending.length) last = pending
      pending = []
    }
  }
  return { slots: dedupeSlots(result), orphans }
}

function dedupeSlots(slots) {
  const seen = new Set()
  return slots.filter((s) => {
    const k = `${s.day}|${s.start}|${s.end}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/* ---------------------------------------------------- código, turma, nome */

const CODE_RE = /(?<![A-Za-z0-9])([A-Za-z]{3})\s?[-.]?\s?(\d{5})(?![0-9])/

/** Código oficial de disciplina da UFES (3 letras + 5 dígitos), normalizado em maiúsculas. */
export function extractCode(text) {
  const m = CODE_RE.exec(String(text ?? ''))
  return m ? { code: `${m[1]}${m[2]}`.toUpperCase(), index: m.index, length: m[0].length } : null
}

const TURMA_WORD_RE = /(?<![A-Za-z0-9])turma\s*[-:.]?\s*0*(\d{1,2}|[A-Za-z])(?![A-Za-z0-9])/i
const TURMA_T_RE = /(?<![A-Za-z0-9])T\s?0*(\d{1,2})(?![A-Za-z0-9])/
const TURMA_AFTER_CODE_RE = /^\s*[-–/.]\s*0*(\d{1,2})(?![0-9A-Za-z])/

/** Turma citada no texto ("Turma 01", "T02", "COM10129-01"); a posição do código ajuda no último formato. */
export function extractTurma(text, codeInfo = null) {
  const s = String(text ?? '')
  let m = TURMA_WORD_RE.exec(s)
  if (m) return { turma: m[1].toUpperCase().padStart(/\d/.test(m[1]) ? 2 : 1, '0'), match: m[0] }
  m = TURMA_T_RE.exec(s)
  if (m) return { turma: m[1].padStart(2, '0'), match: m[0] }
  if (codeInfo) {
    m = TURMA_AFTER_CODE_RE.exec(s.slice(codeInfo.index + codeInfo.length))
    if (m) return { turma: m[1].padStart(2, '0'), match: m[0] }
  }
  return null
}

/** Células que indicam horário sem aula. */
const IGNORE_RE = /^(livre|vago|vaga|intervalo|almoco|jantar|lanche|sem aula|n\/?a|x|-+|—+|–+|\.+|\?+|reservad[oa]|bloquead[oa]|manutencao|feriado|recesso)$/

export function isIgnorable(text) {
  const t = norm(text).replace(/\s+/g, ' ').trim()
  return t === '' || IGNORE_RE.test(t)
}

const PROF_RE = /^(prof(?:a|\.|\.ª|essor(?:a)?)?\b|dr\.?\b|dra\.?\b|me\.?\b|ms\.?\b|msc\.?\b)/i

/**
 * Separa o conteúdo de uma célula de horário em código, nome, turma e linhas extras.
 * Exemplo de célula: "COM10129 - Banco de Dados\nProf. Fulano\nT01".
 */
export function parseCell(text) {
  const raw = clean(text)
  if (isIgnorable(raw)) return null
  const lines = raw.split('\n').filter(Boolean)
  const joined = lines.join(' ')
  const codeInfo = extractCode(joined)
  const turmaInfo = extractTurma(joined, codeInfo)

  let name = ''
  const extra = []
  const strip = (l) => {
    let s = l
    const c = extractCode(s)
    if (c) s = (s.slice(0, c.index) + ' ' + s.slice(c.index + c.length)).trim()
    const tm = extractTurma(s, c)
    if (tm && tm.match && !PROF_RE.test(s)) s = s.replace(tm.match, ' ')
    return s.replace(/^[\s\-–/:|,.()]+|[\s\-–/:|,.()]+$/g, '').replace(/\s+/g, ' ').trim()
  }
  for (const l of lines) {
    const s = strip(l)
    if (!s) continue
    if (!name && !PROF_RE.test(s) && !(extractTurma(l) && s.length <= 3)) name = s
    else extra.push(s)
  }
  if (!name && !codeInfo) return null
  return { code: codeInfo?.code ?? null, name, turma: turmaInfo?.turma ?? null, extra, raw }
}

const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6' }

/** Chave para comparar nomes de disciplina: sem acentos, sem pontuação, algarismos romanos finais viram números. */
export function nameKey(name) {
  const words = norm(name)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length > 1 && ROMAN[words[words.length - 1]]) words[words.length - 1] = ROMAN[words[words.length - 1]]
  return words.join(' ')
}
