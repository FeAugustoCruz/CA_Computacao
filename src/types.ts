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
