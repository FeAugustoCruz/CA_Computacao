import { useCallback, useEffect, useState } from 'react'

const KEY = 'ca-grade-concluidas-v1'

function read(valid: Set<string>): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string' && valid.has(c)) : [])
  } catch {
    return new Set()
  }
}

/**
 * Disciplinas marcadas como concluídas. Ficam salvas só neste navegador (localStorage):
 * não há conta nem servidor. Se o navegador bloquear o armazenamento, a marcação continua
 * funcionando durante a visita e `saveFailed` avisa que ela não será lembrada.
 */
export function useConcluidas(valid: Set<string>) {
  const [done, setDone] = useState(() => read(valid))
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...done]))
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [done])

  // Mantém várias abas do mesmo navegador em sincronia.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setDone(read(valid))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [valid])

  const toggle = useCallback((code: string) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (!next.delete(code)) next.add(code)
      return next
    })
  }, [])

  const setMany = useCallback((codes: string[], on: boolean) => {
    setDone((prev) => {
      const next = new Set(prev)
      codes.forEach((c) => (on ? next.add(c) : next.delete(c)))
      return next
    })
  }, [])

  const clear = useCallback(() => setDone(new Set()), [])

  return { done, toggle, setMany, clear, saveFailed }
}
