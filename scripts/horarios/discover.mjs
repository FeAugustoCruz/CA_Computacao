// Descoberta dos links das planilhas nas páginas oficiais.
import { parse } from 'node-html-parser'
import { norm } from './text.mjs'

const FILE_EXT = /\.(xlsx|xls|csv|ods)(?:$|[?#])/i

/** Converte links de visualização do Google em links de download de .xlsx. */
export function toDownloadUrl(href) {
  const sheet = /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/(?:e\/)?([\w-]+)/.exec(href)
  if (sheet) {
    const published = /\/d\/e\//.test(href)
    return published ? `https://docs.google.com/spreadsheets/d/e/${sheet[1]}/pub?output=xlsx` : `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=xlsx`
  }
  const drive = /^https?:\/\/drive\.google\.com\/file\/d\/([\w-]+)/.exec(href)
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`
  return href
}

function fileNameOf(href) {
  try {
    const u = new URL(href)
    return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '')
  } catch {
    return ''
  }
}

/** Todos os links que parecem planilhas, com o texto e o contexto de cada um. */
export function findLinks(html, pageUrl) {
  const root = parse(html)
  const out = []
  let heading = ''
  for (const el of root.querySelectorAll('h1,h2,h3,h4,h5,h6,a,iframe')) {
    const tag = el.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) {
      heading = el.text.replace(/\s+/g, ' ').trim()
      continue
    }
    const raw = el.getAttribute(tag === 'a' ? 'href' : 'src')
    if (!raw || raw.startsWith('#') || /^(mailto|tel|javascript):/i.test(raw)) continue
    let href
    try {
      href = new URL(raw, pageUrl).toString()
    } catch {
      continue
    }
    const isFile = FILE_EXT.test(href)
    const isGoogle = /^https?:\/\/(docs\.google\.com\/spreadsheets|drive\.google\.com\/file)/.test(href)
    if (!isFile && !isGoogle) continue
    const parentTag = el.parentNode?.tagName?.toLowerCase?.()
    const near = parentTag && /^(li|p|td|th|dd|dt)$/.test(parentTag) ? el.parentNode.text.replace(/\s+/g, ' ').trim().slice(0, 240) : ''
    out.push({
      href,
      downloadUrl: toDownloadUrl(href),
      text: el.text.replace(/\s+/g, ' ').trim(),
      title: el.getAttribute('title') ?? '',
      fileName: fileNameOf(href),
      heading,
      near,
    })
  }
  return out
}

const semesterOf = (s) => {
  const m = /(20\d{2})\s*[./\-_ ]?\s*([12])\b/.exec(s)
  return m ? Number(m[1]) * 10 + Number(m[2]) : 0
}

/**
 * Escolhe o link de uma fonte entre os encontrados na página.
 * Prefere correspondências no texto do link ou no nome do arquivo e, havendo várias, o semestre mais recente.
 */
export function pickLink(links, source) {
  const scored = []
  for (const l of links) {
    const strong = norm(`${l.text} ${l.title} ${l.fileName}`)
    const weak = norm(`${l.heading} ${l.near}`)
    let score = 0
    for (const re of source.match) {
      if (re.test(strong)) score += 3
      else if (re.test(weak)) score += 1
    }
    if (score > 0) scored.push({ link: l, score, sem: semesterOf(`${l.text} ${l.fileName} ${l.heading}`) })
  }
  if (!scored.length) return { link: null, warning: `não encontrei na página um link de planilha para "${source.group}"` }
  scored.sort((a, b) => b.sem - a.sem || b.score - a.score)
  const top = scored[0]
  const tied = scored.filter((s) => s.sem === top.sem && s.score === top.score && s.link.downloadUrl !== top.link.downloadUrl)
  return {
    link: top.link,
    warning: tied.length ? `há ${tied.length + 1} links igualmente prováveis para "${source.group}"; usei o primeiro (${top.link.fileName || top.link.href})` : null,
  }
}
