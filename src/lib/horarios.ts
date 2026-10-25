// Lógica da consulta de horários: filtros, agrupamento por disciplina e geometria da grade semanal.
// Sem React nem acesso ao DOM, para poder ser testada com `npm test`.
import { disciplinas } from '../content/curriculo.ts'
import type { Aula, Disciplina, HorariosData } from '../types.ts'
import { norm } from './text.ts'

/* ---------------------------------------------------------------- tempo */

export const DIAS: Record<number, { curto: string; longo: string }> = {
  1: { curto: 'Seg', longo: 'Segunda-feira' },
  2: { curto: 'Ter', longo: 'Terça-feira' },
  3: { curto: 'Qua', longo: 'Quarta-feira' },
  4: { curto: 'Qui', longo: 'Quinta-feira' },
  5: { curto: 'Sex', longo: 'Sexta-feira' },
  6: { curto: 'Sáb', longo: 'Sábado' },
  7: { curto: 'Dom', longo: 'Domingo' },
}

/** "07:30" -> 450 */
export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
export const faixa = (a: Pick<Aula, 'start' | 'end'>) => `${a.start}–${a.end}`
export const localLabel = (a: Aula) => (a.local.room ? `${a.local.group} · ${a.local.room}` : a.local.group)

/* ------------------------------------------------------------- currículo */

const byCode = new Map(disciplinas.map((d) => [d.code, d]))
export const infoCurriculo = (a: Pick<Aula, 'ref'>): Disciplina | null => (a.ref ? (byCode.get(a.ref) ?? null) : null)

export function periodoLabel(d: Disciplina | null): string {
  if (!d) return ''
  if (d.special === 'Estágio') return 'Estágio'
  if (d.kind === 'OP') return 'Optativa'
  return d.period ? `${d.period}º período` : ''
}

export const nomesPreReq = (d: Disciplina): string[] => d.prereqs.map((c) => byCode.get(c)?.name ?? c)

/** Períodos do currículo obrigatório (1 a 8), para o filtro. */
export const PERIODOS = Array.from(new Set(disciplinas.filter((d) => d.kind === 'OB' && d.period).map((d) => d.period as number))).sort((a, b) => a - b)

/* ---------------------------------------------------------------- filtros */

export interface Filtros {
  q: string
  /** 0 = todos */
  dia: number
  local: string
  turma: string
  /** '' = todos, '1'..'8' = período, 'op' = optativas */
  periodo: string
  /** HH:MM: aulas que começam a partir daqui */
  de: string
  /** HH:MM: aulas que terminam até aqui */
  ate: string
  ocultarRevisar: boolean
}

export const FILTROS_VAZIOS: Filtros = { q: '', dia: 0, local: '', turma: '', periodo: '', de: '', ate: '', ocultarRevisar: false }

export const filtrosAtivos = (f: Filtros) => (Object.keys(FILTROS_VAZIOS) as (keyof Filtros)[]).filter((k) => f[k] !== FILTROS_VAZIOS[k] && !(k === 'q' && f.q.trim() === '')).length

export function filtrar(aulas: Aula[], f: Filtros): Aula[] {
  const termos = norm(f.q).split(/\s+/).filter(Boolean)
  const de = f.de ? toMin(f.de) : null
  const ate = f.ate ? toMin(f.ate) : null
  return aulas.filter((a) => {
    if (f.ocultarRevisar && a.status === 'revisar') return false
    if (f.dia && a.day !== f.dia) return false
    if (f.local && a.local.group !== f.local) return false
    if (f.turma && a.turma !== f.turma) return false
    if (de != null && toMin(a.start) < de) return false
    if (ate != null && toMin(a.end) > ate) return false
    if (f.periodo) {
      const d = infoCurriculo(a)
      if (!d) return false
      if (f.periodo === 'op' ? d.kind !== 'OP' : !(d.kind === 'OB' && String(d.period) === f.periodo)) return false
    }
    if (termos.length) {
      const alvo = norm(`${a.name} ${a.code ?? ''} ${a.ref ?? ''}`)
      if (!termos.every((t) => alvo.includes(t))) return false
    }
    return true
  })
}

/** Valores disponíveis para os filtros, calculados sobre todas as aulas. */
export function opcoes(aulas: Aula[]) {
  const uniq = <T,>(xs: T[]) => Array.from(new Set(xs))
  return {
    locais: uniq(aulas.map((a) => a.local.group)).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    turmas: uniq(aulas.map((a) => a.turma).filter((t): t is string => !!t)).sort(),
    horas: uniq(aulas.flatMap((a) => [a.start, a.end])).sort(),
    dias: uniq(aulas.map((a) => a.day)).sort((a, b) => a - b),
  }
}

/* ------------------------------------------------------------ agrupamento */

export interface GrupoDisciplina {
  key: string
  code: string | null
  name: string
  info: Disciplina | null
  aulas: Aula[]
  turmas: string[]
  /** Quantas aulas do grupo precisam de confirmação. */
  aRevisar: number
  avisos: number
}

/** Chave que junta as aulas de uma mesma disciplina: código do currículo, código da planilha ou nome. */
export const chaveGrupo = (a: Pick<Aula, 'ref' | 'code' | 'name'>) => a.ref ?? a.code ?? norm(a.name)

export function agrupar(aulas: Aula[]): GrupoDisciplina[] {
  const map = new Map<string, GrupoDisciplina>()
  for (const a of aulas) {
    const key = chaveGrupo(a)
    let g = map.get(key)
    if (!g) {
      g = { key, code: a.ref ?? a.code, name: a.name, info: infoCurriculo(a), aulas: [], turmas: [], aRevisar: 0, avisos: 0 }
      map.set(key, g)
    }
    g.aulas.push(a)
    if (a.turma && !g.turmas.includes(a.turma)) g.turmas.push(a.turma)
    if (a.status === 'revisar') g.aRevisar++
    if (a.issues.length) g.avisos++
  }
  const rank = (g: GrupoDisciplina) => (g.info ? (g.info.kind === 'OB' ? (g.info.period ?? 50) : 60) : 99)
  const groups = Array.from(map.values())
  for (const g of groups) {
    g.aulas.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || localLabel(a).localeCompare(localLabel(b), 'pt-BR'))
    g.turmas.sort()
  }
  return groups.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'pt-BR'))
}

export const contar = (aulas: Aula[]) => ({ aulas: aulas.length, disciplinas: new Set(aulas.map(chaveGrupo)).size })

/* ------------------------------------------------------ geometria da grade */

export interface Bloco {
  aula: Aula
  ini: number
  fim: number
  /** Coluna dentro do grupo de aulas que se sobrepõem. */
  col: number
  cols: number
}

/** Distribui as aulas de um dia em colunas lado a lado quando os horários se sobrepõem. */
export function dispor(aulas: Aula[]): Bloco[] {
  const items = aulas.map((aula) => ({ aula, ini: toMin(aula.start), fim: toMin(aula.end) })).sort((a, b) => a.ini - b.ini || b.fim - a.fim)
  const out: Bloco[] = []
  let cluster: Bloco[] = []
  let ends: number[] = []
  const close = () => {
    for (const b of cluster) b.cols = ends.length
    cluster = []
    ends = []
  }
  for (const it of items) {
    if (ends.length && it.ini >= Math.max(...ends)) close()
    let col = ends.findIndex((e) => e <= it.ini)
    if (col < 0) col = ends.length
    ends[col] = it.fim
    const b: Bloco = { ...it, col, cols: 1 }
    cluster.push(b)
    out.push(b)
  }
  close()
  return out
}

export interface Trecho {
  de: number
  ate: number
  y: number
  h: number
  vazio: boolean
}
export interface Escala {
  trechos: Trecho[]
  altura: number
  marcas: { min: number; y: number; label: string }[]
  pxMin: number
}

/**
 * Escala vertical montada com os horários reais das aulas (sem faixas fixas).
 * Intervalos longos sem aula nenhuma são comprimidos para não desperdiçar espaço.
 */
export function escala(aulas: Aula[], pxMin = 1.15, vazioPx = 32, vazioMin = 90): Escala {
  if (!aulas.length) return { trechos: [], altura: 0, marcas: [], pxMin }
  const ivs = aulas
    .map((a) => ({ de: Math.floor(toMin(a.start) / 60) * 60, ate: Math.ceil(toMin(a.end) / 60) * 60 }))
    .sort((a, b) => a.de - b.de || a.ate - b.ate)
  const busy: { de: number; ate: number }[] = []
  for (const iv of ivs) {
    const last = busy[busy.length - 1]
    if (last && iv.de - last.ate < vazioMin) last.ate = Math.max(last.ate, iv.ate)
    else busy.push({ ...iv })
  }
  const trechos: Trecho[] = []
  const marcas: Escala['marcas'] = []
  let y = 0
  busy.forEach((b, i) => {
    if (i > 0) {
      trechos.push({ de: busy[i - 1].ate, ate: b.de, y, h: vazioPx, vazio: true })
      y += vazioPx
    }
    const h = (b.ate - b.de) * pxMin
    trechos.push({ de: b.de, ate: b.ate, y, h, vazio: false })
    for (let m = b.de; m <= b.ate; m += 60) marcas.push({ min: m, y: y + (m - b.de) * pxMin, label: `${String(Math.floor(m / 60)).padStart(2, '0')}h` })
    y += h
  })
  return { trechos, altura: y, marcas, pxMin }
}

/** Posição vertical (px) de um horário na escala. */
export function yDe(esc: Escala, min: number): number {
  const t = esc.trechos.find((x) => !x.vazio && min >= x.de && min <= x.ate)
  return t ? t.y + (min - t.de) * esc.pxMin : 0
}

/* ------------------------------------------------------- estado dos dados */

/** Depois deste número de dias sem coleta bem-sucedida, os dados são considerados possivelmente desatualizados. */
export const LIMITE_DIAS = 8

export interface EstadoDados {
  vazio: boolean
  dias: number | null
  antigo: boolean
  /** A tentativa de atualização mais recente falhou (total ou parcialmente). */
  falhou: boolean
  fontesComProblema: number
}

export function estadoDados(data: HorariosData, agora: number): EstadoDados {
  const dias = data.generatedAt ? Math.max(0, Math.floor((agora - Date.parse(data.generatedAt)) / 86_400_000)) : null
  return {
    vazio: data.generatedAt == null && data.aulas.length === 0,
    dias,
    antigo: dias != null && dias > LIMITE_DIAS,
    falhou: data.lastAttempt ? !data.lastAttempt.ok : false,
    fontesComProblema: data.sources.filter((s) => s.status !== 'ok').length,
  }
}

export function fmtDataHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(d).replace(',', ' às')
}
