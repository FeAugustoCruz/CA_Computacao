export interface Member {
  id: string
  name: string
  role: string
  bio?: string
  photo?: { src: string; alt: string }
  links?: { label: string; href: string }[]
  /** Cartão ainda não preenchido com dados oficiais. */
  placeholder?: boolean
}

export type DocCategory =
  | 'Estatuto'
  | 'Atas e assembleias'
  | 'Editais e comunicados oficiais'
  | 'Documentos institucionais'
  | 'Relatórios de atividades'
  | 'Outros arquivos'

export interface DocItem {
  id: string
  title: string
  category: DocCategory
  dateLabel: string
  description: string
  href: string
  /** Quem produziu o documento. */
  source?: string
}

export interface Complementar {
  code: string
  description: string
  /** O relatório da UFES corta o texto no fim da linha. */
  truncated?: boolean
  type: string
  typeTruncated?: boolean
  /** CH total conforme o relatório. null quando o campo está em branco. */
  ch: number | null
}

export interface Disciplina {
  code: string
  name: string
  credits: number
  /** OB = obrigatória, OP = optativa */
  kind: 'OB' | 'OP'
  /** Período sugerido. null nas optativas. */
  period: number | null
  /** Códigos das disciplinas exigidas, como listadas no currículo. */
  prereqs: string[]
  /** Exige ter vencido este período (estágio). */
  minPeriod?: number
  /** Exige este mínimo de créditos (TCC I). */
  minCredits?: number
  special?: 'Estágio' | 'TCC'
}

/* ---------- Horários das aulas (gerado por scripts/horarios/update.mjs) ---------- */

/** Dia da semana no padrão ISO: 1 = segunda ... 7 = domingo. */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface AulaAviso {
  kind: string
  text: string
}

/** Uma ocorrência de aula: uma disciplina, em um dia, horário e local. */
export interface Aula {
  id: string
  /** Código lido da planilha (pode faltar). */
  code: string | null
  /** Código da disciplina no currículo a que esta aula foi associada. */
  ref: string | null
  name: string
  turma: string | null
  day: DiaSemana
  /** HH:MM */
  start: string
  end: string
  local: { group: string; room: string | null }
  /** curso = confirmada pelo código; revisar = identificada só pelo nome ou por código divergente. */
  status: 'curso' | 'revisar'
  via: 'codigo' | 'nome'
  source: { id: string; sheet: string; cell: string | null }
  extra: string[]
  issues: AulaAviso[]
}

export interface HorariosFonte {
  id: string
  label: string
  pageUrl: string
  fileUrl: string | null
  fileName: string | null
  fetchedAt: string | null
  fileLastModified: string | null
  sheetUpdatedText: string | null
  status: 'ok' | 'desatualizada' | 'falhou' | 'nao-encontrada'
  error: string | null
  sheets: number
  lidas: number
  doCurso: number
  aRevisar: number
  descartadas: number
  warnings: string[]
}

export interface HorariosData {
  schemaVersion: 1
  course: string
  /** Quando os dados foram coletados com sucesso pela última vez. null = nunca. */
  generatedAt: string | null
  lastAttempt: { at: string; ok: boolean; message: string | null } | null
  sources: HorariosFonte[]
  aulas: Aula[]
}
