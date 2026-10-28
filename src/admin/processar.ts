// Processa no navegador as planilhas enviadas no painel, com o mesmo leitor usado na coleta automática (scripts/horarios).
// @ts-ignore módulo JS sem tipos
import { PAGES, COURSE, SCHEMA_VERSION, SOURCES } from '../../scripts/horarios/config.mjs'
// @ts-ignore módulo JS sem tipos
import { consolidate } from '../../scripts/horarios/consolidate.mjs'
// @ts-ignore módulo JS sem tipos
import { parseSheet } from '../../scripts/horarios/parse-sheet.mjs'
// @ts-ignore módulo JS sem tipos
import { nameKey } from '../../scripts/horarios/text.mjs'
// @ts-ignore módulo JS sem tipos
import { readWorkbook } from '../../scripts/horarios/workbook.mjs'
import { disciplinas } from '../content/curriculo'
import type { Aula, Disciplina, HorariosData, HorariosFonte } from '../types'

interface FonteConfig {
  id: string
  page: 'salas' | 'laboratorios'
  group: string
}

export const FONTES = SOURCES as FonteConfig[]

export interface Envio {
  id: string
  arquivo: File
}

export interface Resultado {
  /** Dados prontos para publicar; null se nenhuma planilha pôde ser aproveitada. */
  data: HorariosData | null
  /** Uma linha por planilha aproveitada. */
  fontes: HorariosFonte[]
  /** Problemas que impediram aproveitar alguma planilha. */
  erros: string[]
}

function indiceCurriculo() {
  const byCode = new Map<string, Disciplina>(disciplinas.map((d) => [d.code, d]))
  const byNameKey = new Map<string, Disciplina[]>()
  for (const d of disciplinas) {
    const k = nameKey(d.name) as string
    byNameKey.set(k, [...(byNameKey.get(k) ?? []), d])
  }
  return { list: disciplinas, byCode, byNameKey }
}

/**
 * Lê as planilhas enviadas e junta o resultado aos dados atuais.
 * Fontes que não foram enviadas continuam como estavam; planilhas que não rendem nenhuma aula do curso são recusadas
 * (não apagam os dados anteriores).
 */
export async function processar(envios: Envio[], atual: HorariosData, agora = new Date()): Promise<Resultado> {
  const erros: string[] = []
  const lidas: { source: FonteConfig; meta: HorariosFonte; raw: unknown[] }[] = []

  for (const { id, arquivo } of envios) {
    const source = FONTES.find((s) => s.id === id)
    if (!source) continue
    const anterior = atual.sources.find((s) => s.id === id)
    const meta: HorariosFonte = {
      id,
      label: source.group,
      pageUrl: (PAGES as Record<string, string>)[source.page],
      fileUrl: anterior?.fileUrl ?? null,
      fileName: arquivo.name,
      fetchedAt: agora.toISOString(),
      fileLastModified: arquivo.lastModified ? new Date(arquivo.lastModified).toISOString() : null,
      sheetUpdatedText: null,
      status: 'ok',
      error: null,
      sheets: 0,
      lidas: 0,
      doCurso: 0,
      aRevisar: 0,
      descartadas: 0,
      warnings: [],
    }
    try {
      const sheets = await readWorkbook(new Uint8Array(await arquivo.arrayBuffer()), arquivo.name)
      meta.sheets = sheets.length
      const raw: unknown[] = []
      for (const sh of sheets) {
        const r = parseSheet(sh)
        raw.push(...r.aulas)
        meta.warnings.push(...r.warnings)
        if (r.updatedText && !meta.sheetUpdatedText) meta.sheetUpdatedText = r.updatedText
      }
      if (sheets.length === 0) throw new Error('a planilha não tem nenhuma aba visível')
      lidas.push({ source, meta, raw })
    } catch (e) {
      erros.push(`${source.group} (${arquivo.name}): ${(e as Error).message}`)
    }
  }

  const fresh = consolidate(
    lidas.map((l) => ({ sourceId: l.source.id, group: l.source.group, raw: l.raw })),
    indiceCurriculo(),
  ) as { aulas: Aula[]; stats: Map<string, { lidas: number; descartadas: number }> }

  const aceitas: { meta: HorariosFonte; aulas: Aula[] }[] = []
  for (const l of lidas) {
    const aulas = fresh.aulas.filter((a) => a.source.id === l.source.id)
    const st = fresh.stats.get(l.source.id)
    l.meta.lidas = st?.lidas ?? 0
    l.meta.descartadas = st?.descartadas ?? 0
    l.meta.doCurso = aulas.filter((a) => a.status === 'curso').length
    l.meta.aRevisar = aulas.filter((a) => a.status === 'revisar').length
    if (aulas.length === 0) {
      erros.push(`${l.source.group} (${l.meta.fileName}): li a planilha, mas não reconheci nenhuma aula do curso. Confira se é o arquivo certo; mantive os dados anteriores.`)
      continue
    }
    const antes = atual.aulas.filter((a) => a.source.id === l.source.id).length
    if (antes >= 10 && aulas.length < antes * 0.4) l.meta.warnings.push(`O número de aulas caiu de ${antes} para ${aulas.length} em relação aos dados atuais. Confira se a planilha está completa.`)
    aceitas.push({ meta: l.meta, aulas })
  }

  if (aceitas.length === 0) return { data: null, fontes: [], erros }

  const novas = new Map(aceitas.map((a) => [a.meta.id, a]))
  const ids = [...new Set([...atual.sources.map((s) => s.id), ...novas.keys()])]
  const sources = ids.map((id) => novas.get(id)?.meta ?? (atual.sources.find((s) => s.id === id) as HorariosFonte))
  const aulas = ids
    .flatMap((id) => novas.get(id)?.aulas ?? atual.aulas.filter((a) => a.source.id === id))
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id))

  const data: HorariosData = {
    schemaVersion: SCHEMA_VERSION,
    course: COURSE.name,
    generatedAt: agora.toISOString(),
    lastAttempt: { at: agora.toISOString(), ok: erros.length === 0, message: erros.length ? `Algumas planilhas não foram aproveitadas: ${erros.join(' ')}` : null },
    sources,
    aulas,
  }
  return { data, fontes: aceitas.map((a) => a.meta), erros }
}
