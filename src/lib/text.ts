/** Minúsculas e sem acentos, para buscas que ignoram acentuação. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
