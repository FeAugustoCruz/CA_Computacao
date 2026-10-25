// Consolidação: reconhece as disciplinas do curso, junta aulas contíguas, remove duplicidades e aponta conflitos.
import { fmtTime, nameKey, norm } from './text.mjs'

const slug = (s) => norm(s ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Relaciona uma aula lida à grade curricular.
 * 1. Código oficial presente no currículo: confirmada.
 * 2. Sem código (ou código fora do currículo), mas nome igual ao de uma disciplina do currículo: "revisar".
 * 3. Caso contrário: outra disciplina do campus, descartada da exibição.
 */
export function classify(raw, curriculum) {
  const issues = []
  if (raw.code && curriculum.byCode.has(raw.code)) {
    const ref = curriculum.byCode.get(raw.code)
    const a = nameKey(raw.name)
    const b = nameKey(ref.name)
    if (!raw.name) issues.push({ kind: 'nome-ausente', text: 'A planilha não traz o nome da disciplina; foi usado o nome do currículo.' })
    else if (a !== b && !a.includes(b) && !b.includes(a)) issues.push({ kind: 'nome-diferente', text: `A planilha chama esta disciplina de "${raw.name}"; o currículo usa "${ref.name}".` })
    // O nome exibido é sempre o do currículo, para a mesma disciplina aparecer igual em todas as planilhas.
    return { status: 'curso', via: 'codigo', ref: ref.code, name: ref.name, issues }
  }
  const matches = raw.name ? (curriculum.byNameKey.get(nameKey(raw.name)) ?? []) : []
  if (matches.length) {
    const ref = matches.length === 1 ? matches[0] : null
    issues.push(
      raw.code
        ? { kind: 'codigo-diferente', text: `O código ${raw.code} da planilha não consta no currículo; o nome coincide com ${ref ? `${ref.code} (${ref.name})` : 'mais de uma disciplina do currículo'}. Confirme com a coordenação.` }
        : { kind: 'sem-codigo', text: 'A planilha não traz o código; a disciplina foi identificada só pelo nome. Confirme com a coordenação.' },
    )
    return { status: 'revisar', via: 'nome', ref: ref?.code ?? null, name: ref?.name ?? raw.name, issues }
  }
  return null
}

/**
 * @param {Array<{sourceId:string, group:string, raw:Array}>} inputs aulas lidas por fonte
 * @returns {{aulas:Array, stats:Map<string,{lidas:number, descartadas:number}>}}
 */
export function consolidate(inputs, curriculum) {
  const stats = new Map()
  const prepared = []
  for (const { sourceId, group, raw } of inputs) {
    const st = { lidas: raw.length, descartadas: 0 }
    stats.set(sourceId, st)
    for (const r of raw) {
      const c = classify(r, curriculum)
      if (!c) {
        st.descartadas++
        continue
      }
      prepared.push({ r, c, sourceId, group })
    }
  }

  // Junta aulas contíguas (ou sobrepostas) da mesma disciplina, turma, dia e local: a planilha pode repetir a aula em cada faixa de horário.
  const buckets = new Map()
  for (const p of prepared) {
    const key = [p.c.ref ?? nameKey(p.c.name), p.r.code ?? '', p.r.turma ?? '', p.r.day, p.group, norm(p.r.room ?? ''), p.sourceId, p.r.sheet].join('|')
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(p)
  }
  const merged = []
  for (const list of buckets.values()) {
    list.sort((a, b) => a.r.start - b.r.start || a.r.end - b.r.end)
    let cur = null
    for (const p of list) {
      if (cur && p.r.start <= cur.end) {
        cur.end = Math.max(cur.end, p.r.end)
        for (const x of p.r.extra) if (!cur.extra.includes(x)) cur.extra.push(x)
      } else {
        if (cur) merged.push(cur)
        cur = { ...p, end: p.r.end, start: p.r.start, extra: [...p.r.extra] }
      }
    }
    if (cur) merged.push(cur)
  }

  const aulas = merged.map((m) => ({
    id: [slug(m.c.ref ?? m.r.code ?? m.c.name), m.r.turma ?? 'x', m.r.day, m.start, slug(m.group), slug(m.r.room ?? 'x')].join('-'),
    code: m.r.code,
    ref: m.c.ref,
    name: m.c.name,
    turma: m.r.turma,
    day: m.r.day,
    start: fmtTime(m.start),
    end: fmtTime(m.end),
    local: { group: m.group, room: m.r.room },
    status: m.c.status,
    via: m.c.via,
    source: { id: m.sourceId, sheet: m.r.sheet, cell: m.r.cell },
    extra: m.extra,
    issues: [...m.c.issues],
  }))

  // Ids repetidos (mesmo conjunto de dados em abas diferentes) ganham sufixo para continuarem únicos.
  const seen = new Map()
  for (const a of aulas) {
    const n = (seen.get(a.id) ?? 0) + 1
    seen.set(a.id, n)
    if (n > 1) a.id = `${a.id}-${n}`
  }

  flagConflicts(aulas)
  aulas.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id))
  return { aulas, stats }
}

const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

/** Duas aulas diferentes na mesma sala e no mesmo horário: aviso nas duas. */
function flagConflicts(aulas) {
  const byRoom = new Map()
  for (const a of aulas) {
    if (!a.local.room) continue
    const k = `${a.local.group}|${norm(a.local.room)}|${a.day}`
    if (!byRoom.has(k)) byRoom.set(k, [])
    byRoom.get(k).push(a)
  }
  for (const list of byRoom.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const same = (a.ref ?? a.name) === (b.ref ?? b.name) && (a.turma ?? '') === (b.turma ?? '')
        if (same || !(mins(a.start) < mins(b.end) && mins(b.start) < mins(a.end))) continue
        a.issues.push({ kind: 'conflito-sala', text: `Outra aula usa a mesma sala neste horário: ${b.name}${b.turma ? ` (turma ${b.turma})` : ''}, ${b.start}–${b.end}. Confira nas planilhas oficiais.` })
        b.issues.push({ kind: 'conflito-sala', text: `Outra aula usa a mesma sala neste horário: ${a.name}${a.turma ? ` (turma ${a.turma})` : ''}, ${a.start}–${a.end}. Confira nas planilhas oficiais.` })
      }
  }
}
