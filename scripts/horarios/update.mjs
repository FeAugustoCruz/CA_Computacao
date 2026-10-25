#!/usr/bin/env node
// Atualização dos horários: baixa as planilhas oficiais, interpreta, consolida e grava src/data/horarios.json.
//
//   node scripts/horarios/update.mjs [--out arquivo.json] [--cache pasta] [--local pasta]
//
// --local usa arquivos já baixados (<id-da-fonte>.xlsx ou .csv) em vez de acessar a UFES. Serve para testar e depurar.
// Se algo falhar, os últimos dados válidos de cada fonte são mantidos e o resultado fica registrado no próprio JSON.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COURSE, PAGES, SCHEMA_VERSION, SOURCES } from './config.mjs'
import { consolidate } from './consolidate.mjs'
import { loadCurriculum } from './curriculum.mjs'
import { findLinks, pickLink, toDownloadUrl } from './discover.mjs'
import { httpGet } from './http.mjs'
import { parseSheet } from './parse-sheet.mjs'
import { readWorkbook } from './workbook.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const emptyData = () => ({ schemaVersion: SCHEMA_VERSION, course: COURSE.name, generatedAt: null, lastAttempt: null, sources: [], aulas: [] })

function readJson(file) {
  try {
    const d = JSON.parse(readFileSync(file, 'utf8'))
    return d && d.schemaVersion === SCHEMA_VERSION && Array.isArray(d.aulas) && Array.isArray(d.sources) ? d : null
  } catch {
    return null
  }
}

function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, `${JSON.stringify(data, null, 1)}\n`)
  renameSync(tmp, file)
}

const newMeta = (source, pageUrl) => ({
  id: source.id,
  label: source.group,
  pageUrl,
  fileUrl: null,
  fileName: null,
  fetchedAt: null,
  fileLastModified: null,
  sheetUpdatedText: null,
  status: 'ok',
  error: null,
  sheets: 0,
  lidas: 0,
  doCurso: 0,
  aRevisar: 0,
  descartadas: 0,
  warnings: [],
})

async function collectSource(source, ctx) {
  const meta = newMeta(source, ctx.pages[source.page])
  try {
    let buf
    let hint = ''
    if (ctx.local) {
      const file = readdirSync(ctx.local).find((f) => f.toLowerCase().startsWith(`${source.id}.`))
      if (!file) throw new Error(`arquivo ${source.id}.xlsx (ou .csv) não encontrado em ${ctx.local}`)
      buf = readFileSync(join(ctx.local, file))
      hint = meta.fileName = file
    } else {
      let link = null
      let res = null
      if (source.directUrl) {
        const direct = { href: source.directUrl, downloadUrl: toDownloadUrl(source.directUrl), fileName: '' }
        try {
          res = await httpGet(direct.downloadUrl, ctx.http)
          link = direct
        } catch (e) {
          meta.warnings.push(`O link direto da planilha falhou (${e.message}); usei a página oficial.`)
        }
      }
      if (!res) {
        const links = await ctx.linksOf(source.page)
        const picked = pickLink(links, source)
        link = picked.link
        if (!link) {
          meta.status = 'nao-encontrada'
          meta.error = `${picked.warning[0].toUpperCase()}${picked.warning.slice(1)}.`
          return { meta, raw: null }
        }
        if (picked.warning) meta.warnings.push(`${picked.warning[0].toUpperCase()}${picked.warning.slice(1)}.`)
        res = await httpGet(link.downloadUrl, ctx.http)
      }
      buf = res.buf
      hint = link.fileName
      meta.fileUrl = link.href
      meta.fileName = link.fileName || null
      const lm = res.lastModified ? new Date(res.lastModified) : null
      meta.fileLastModified = lm && !Number.isNaN(lm.getTime()) ? lm.toISOString() : null
    }
    const sheets = await readWorkbook(buf, hint)
    meta.sheets = sheets.length
    const raw = []
    for (const sh of sheets) {
      const r = parseSheet(sh)
      raw.push(...r.aulas)
      meta.warnings.push(...r.warnings)
      if (r.updatedText && !meta.sheetUpdatedText) meta.sheetUpdatedText = r.updatedText
    }
    meta.fetchedAt = ctx.now.toISOString()
    if (sheets.length === 0) meta.warnings.push('A planilha não tem nenhuma aba visível.')
    else if (raw.length === 0) meta.warnings.push('Nenhuma aula foi reconhecida nesta planilha; o formato pode ter mudado.')
    return { meta, raw }
  } catch (e) {
    meta.status = 'falhou'
    meta.error = e.message
    return { meta, raw: null }
  }
}

/**
 * Executa a atualização e devolve os dados gravados.
 * @param {{out:string, cache?:string|null, local?:string|null, curriculumFile?:string, fetchImpl?:Function, now?:Date, sources?:Array, pages?:object, http?:object, log?:Function}} opts
 */
export async function runUpdate(opts) {
  const { out, cache = null, local = null, curriculumFile = join(ROOT, COURSE.curriculumFile), now = new Date(), sources = SOURCES, pages = PAGES, log = () => {} } = opts
  const http = { fetchImpl: opts.fetchImpl, ...(opts.http ?? {}) }
  if (!http.fetchImpl) delete http.fetchImpl

  const curriculum = loadCurriculum(curriculumFile)
  const previous = (cache && readJson(cache)) || readJson(out) || emptyData()

  const pageLinks = new Map()
  const ctx = {
    local,
    now,
    pages,
    http,
    linksOf: async (page) => {
      if (!pageLinks.has(page)) {
        pageLinks.set(
          page,
          httpGet(pages[page], http).then(
            (r) => findLinks(r.buf.toString('utf8'), r.url),
            (e) => {
              throw new Error(`falha ao abrir a página oficial: ${e.message}`)
            },
          ),
        )
      }
      return pageLinks.get(page)
    },
  }

  const collected = []
  for (const s of sources) {
    const r = await collectSource(s, ctx)
    collected.push({ source: s, ...r })
    log(`${s.id}: ${r.meta.status}${r.meta.error ? ` (${r.meta.error})` : ''}`)
  }

  const fresh = consolidate(
    collected.filter((c) => c.meta.status === 'ok').map((c) => ({ sourceId: c.source.id, group: c.source.group, raw: c.raw })),
    curriculum,
  )

  const sourcesOut = []
  const aulasOut = []
  for (const c of collected) {
    const id = c.source.id
    const prevAulas = previous.aulas.filter((a) => a.source.id === id)
    const prevMeta = previous.sources.find((s) => s.id === id)
    let meta = c.meta
    let aulas = []
    if (meta.status === 'ok') {
      aulas = fresh.aulas.filter((a) => a.source.id === id)
      const st = fresh.stats.get(id)
      meta.lidas = st.lidas
      meta.descartadas = st.descartadas
      if (aulas.length === 0 && prevAulas.length > 0) {
        // Leitura "vazia" onde antes havia aulas: provável mudança de formato. Não apaga os dados anteriores.
        meta = { ...(prevMeta ?? meta), status: 'desatualizada', error: 'A planilha foi lida, mas nenhuma aula do curso foi reconhecida; mantidos os dados anteriores.', warnings: c.meta.warnings }
        aulas = prevAulas
      } else if (prevAulas.length >= 10 && aulas.length < prevAulas.length * 0.4) {
        meta.warnings.push(`O número de aulas caiu de ${prevAulas.length} para ${aulas.length} em relação à coleta anterior. Confira se a planilha está completa.`)
      }
    } else if (prevAulas.length > 0 && prevMeta) {
      meta = { ...prevMeta, status: 'desatualizada', error: meta.error, warnings: prevMeta.warnings ?? [] }
      aulas = prevAulas
    }
    meta.doCurso = aulas.filter((a) => a.status === 'curso').length
    meta.aRevisar = aulas.filter((a) => a.status === 'revisar').length
    sourcesOut.push(meta)
    aulasOut.push(...aulas)
  }
  aulasOut.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id))

  const failed = sourcesOut.filter((s) => s.status !== 'ok')
  const anyFresh = sourcesOut.some((s) => s.status === 'ok')
  const data = {
    schemaVersion: SCHEMA_VERSION,
    course: COURSE.name,
    generatedAt: anyFresh ? now.toISOString() : previous.generatedAt,
    lastAttempt: {
      at: now.toISOString(),
      ok: failed.length === 0,
      message: failed.length ? `Não foi possível atualizar: ${failed.map((s) => `${s.label} (${s.error ?? s.status})`).join('; ')}.` : null,
    },
    sources: sourcesOut,
    aulas: aulasOut,
  }
  writeJson(out, data)
  if (cache && resolve(cache) !== resolve(out)) writeJson(cache, data)
  return data
}

/* ------------------------------------------------------------------- CLI */

function summary(data) {
  const lines = ['## Horários das aulas', '', `Atualização: ${data.lastAttempt?.ok ? 'concluída' : 'com falhas'}. Aulas do curso: ${data.aulas.length}.`, '', '| Fonte | Situação | Aulas do curso | A revisar | Descartadas (outros cursos) |', '|---|---|---|---|---|']
  for (const s of data.sources) lines.push(`| ${s.label} | ${s.status}${s.error ? `: ${s.error}` : ''} | ${s.doCurso} | ${s.aRevisar} | ${s.descartadas} |`)
  const warns = data.sources.flatMap((s) => s.warnings.map((w) => `- **${s.label}:** ${w}`))
  if (warns.length) lines.push('', '### Avisos', ...warns)
  return `${lines.join('\n')}\n`
}

async function main() {
  const args = process.argv.slice(2)
  const arg = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : null
  }
  const out = resolve(ROOT, arg('--out') ?? 'src/data/horarios.json')
  const cache = resolve(ROOT, arg('--cache') ?? '.cache/horarios/horarios.json')
  const local = arg('--local') ? resolve(arg('--local')) : null
  if (local && !existsSync(local)) throw new Error(`Pasta não encontrada: ${local}`)

  const data = await runUpdate({ out, cache, local, log: (m) => console.log(m) })

  for (const s of data.sources) {
    if (s.status !== 'ok') console.log(`::warning title=Horários (${s.label})::${s.error ?? s.status}`)
    for (const w of s.warnings) console.log(`::notice title=Horários (${s.label})::${w}`)
  }
  console.log(`Gravado ${out}: ${data.aulas.length} aulas (${data.sources.map((s) => `${s.label}: ${s.status}`).join(', ')}).`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(data))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && extname(process.argv[1]) === '.mjs') {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
