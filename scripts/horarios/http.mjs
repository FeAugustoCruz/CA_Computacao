// Download com tempo limite, tamanho máximo e novas tentativas. Não tenta contornar bloqueios: se o servidor recusar, a falha é registrada.
import { USER_AGENT } from './config.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const RETRY_STATUS = new Set([429, 500, 502, 503, 504])

export async function httpGet(url, { fetchImpl = globalThis.fetch, retries = 2, timeoutMs = 30000, maxBytes = 25 * 1024 * 1024, backoffMs = 1000 } = {}) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetchImpl(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': USER_AGENT, accept: '*/*' } })
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`)
        if (RETRY_STATUS.has(res.status) && attempt < retries) {
          await sleep(backoffMs * 2 ** attempt)
          continue
        }
        break
      }
      const declared = Number(res.headers.get('content-length') ?? 0)
      if (declared > maxBytes) throw new Error(`arquivo grande demais (${declared} bytes)`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > maxBytes) throw new Error(`arquivo grande demais (${buf.length} bytes)`)
      return { buf, contentType: res.headers.get('content-type') ?? '', lastModified: res.headers.get('last-modified'), url: res.url || url }
    } catch (e) {
      lastError = e.name === 'AbortError' ? new Error('tempo esgotado') : e
      if (attempt < retries) await sleep(backoffMs * 2 ** attempt)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`não foi possível baixar ${url}: ${lastError?.message ?? 'erro desconhecido'}`)
}
