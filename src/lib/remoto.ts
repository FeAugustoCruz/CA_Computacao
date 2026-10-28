// Horários publicados pelo painel de administração (Supabase). Só usa fetch: nenhuma biblioteca extra no site público.
// Sem as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build, o recurso fica desligado e o site usa só o JSON embutido.
import type { HorariosData } from '../types'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ?? ''
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

export const supabaseConfig = { url, key, ativo: Boolean(url && key) }

/** Confere o formato mínimo antes de usar dados vindos de fora. */
export function dadosValidos(x: unknown): x is HorariosData {
  const d = x as HorariosData | null
  return !!d && d.schemaVersion === 1 && Array.isArray(d.aulas) && Array.isArray(d.sources) && (d.generatedAt === null || typeof d.generatedAt === 'string')
}

export const cabecalhos = (token?: string): Record<string, string> => ({ apikey: key, Authorization: `Bearer ${token ?? key}` })

/** Última versão publicada, ou null se não houver, se o recurso estiver desligado ou se a rede falhar. */
export async function buscarPublicados(signal?: AbortSignal): Promise<HorariosData | null> {
  if (!supabaseConfig.ativo) return null
  try {
    const res = await fetch(`${url}/rest/v1/horarios_publicados?id=eq.1&select=data`, { headers: cabecalhos(), signal })
    if (!res.ok) return null
    const rows = (await res.json()) as { data: unknown }[]
    return rows[0] && dadosValidos(rows[0].data) ? rows[0].data : null
  } catch {
    return null
  }
}

/** Escolhe o conjunto mais recente (pela data da coleta ou do envio). */
export function maisRecente(a: HorariosData, b: HorariosData | null): HorariosData {
  if (!b) return a
  const ta = a.generatedAt ? Date.parse(a.generatedAt) : 0
  const tb = b.generatedAt ? Date.parse(b.generatedAt) : 0
  return tb > ta ? b : a
}
