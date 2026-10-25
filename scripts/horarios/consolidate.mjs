// Consolidação: reconhece as disciplinas do curso, junta aulas contíguas, remove duplicidades e aponta conflitos.
import { fmtTime, nameKey, norm } from './text.mjs'

const slug = (s) => norm(s ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Relaciona uma aula lida à grade curricular.
 * 1. Código oficial presente no currículo: confirmada.
 * 2. Sem código, mas com a turma do curso (CC1, CC2...) e nome igual ao de uma disciplina do currículo: confirmada pela turma.
 * 3. Sem código (ou código fora do currículo), mas nome igual ao de uma disciplina do currículo: "revisar".
 * 4. Turma do curso (CC...) mas disciplina fora do currículo: "revisar" (pode ser uma optativa nova).
 * 5. Caso contrário: outra disciplina do campus, descartada da exibição.
 */
export function classify(raw, curriculum) {
  const issues = []
  // O código da disciplina é o mesmo em todos os cursos; quem indica o curso é a turma (CC1 = Computação, SI1, AG1, BL1...).
  const outra = /(?<![A-Za-z0-9])((?!CC)[A-Z]{2}\s?\d{1,2})(?![A-Za-z0-9])/.exec([raw.name, ...(raw.extra ?? [])].join(' '))
  const outroCurso = (tag) => ({ kind: 'outro-curso', text: `A planilha indica a turma ${tag.replace(/\s/g, '')}, que não é de Ciência da Computação (CC). O nome ou código coincide com uma disciplina do currículo, mas é provável que a aula seja de outro curso. Confirme com a coordenação.` })
  if (raw.code && curriculum.byCode.has(raw.code)) {
    const ref = curriculum.byCode.get(raw.code)
    const a = nameKey(raw.name)
    const b = nameKey(ref.name)
    if (!raw.name) issues.push({ kind: 'nome-ausente', text: 'A planilha não traz o nome da disciplina; foi usado o nome do currículo.' })
    else if (a !== b && !a.includes(b) && !b.includes(a)) issues.push({ kind: 'nome-diferente', text: `A planilha chama esta disciplina de "${raw.name}"; o currículo usa "${ref.name}".` })
    // O nome exibido é sempre o do currículo, para a mesma disciplina aparecer igual em todas as planilhas.
    if (outra && !/^CC\d+$/.test(raw.turma ?? '')) return { status: 'revisar', via: 'codigo', ref: ref.code, name: ref.name, issues: [outroCurso(outra[1])] }
    return { status: 'curso', via: 'codigo', ref: ref.code, name: ref.name, issues }
  }
  const matches = raw.name ? (curriculum.byNameKey.get(nameKey(raw.name)) ?? []) : []
  const turmaDoCurso = /^CC\d+$/.test(raw.turma ?? '')
  if (matches.length === 1 && !raw.code && turmaDoCurso) {
    return { status: 'curso', via: 'turma', ref: matches[0].code, name: matches[0].name, issues: [{ kind: 'sem-codigo-turma', text: `A planilha não traz o código; a disciplina foi identificada pelo nome e pela turma ${raw.turma}.` }] }
  }
  if (!matches.length && turmaDoCurso) {
    return { status: 'revisar', via: 'turma', ref: null, name: raw.name || 'Disciplina sem nome', issues: [{ kind: 'fora-do-curriculo', text: `A planilha indica a turma ${raw.turma} (Ciência da Computação), mas esta disciplina não consta no currículo. Pode ser uma optativa nova; confirme com a coordenação.` }] }
  }
  if (matches.length) {
    const ref = matches.length === 1 ? matches[0] : null
    if (outra && !raw.code) {
      issues.push(outroCurso(outra[1]))
    } else
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
