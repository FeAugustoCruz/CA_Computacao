import { useEffect, useSyncExternalStore } from 'react'

export type PageName =
  | 'inicio' | 'sobre' | 'integrantes' | 'grade' | 'horarios' | 'documentos' | 'complementares' | 'contato' | 'nao-encontrada'

export interface Route { page: PageName }

const SIMPLE: PageName[] = ['inicio', 'sobre', 'integrantes', 'grade', 'horarios', 'documentos', 'complementares', 'contato']

/** Rotas por hash simples (#sobre, #contato): funcionam em qualquer hospedagem estática. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { page: 'inicio' }
  if ((SIMPLE as string[]).includes(raw)) return { page: raw as PageName }
  return { page: 'nao-encontrada' }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const snapshot = () => window.location.hash

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '')
  return parseHash(hash)
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · CA Computação UFES Alegre` : 'CA Computação UFES Alegre'
  }, [title])
}
