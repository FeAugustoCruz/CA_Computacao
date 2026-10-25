/**
 * Dados institucionais. Só entram aqui fatos fornecidos pela gestão.
 * Valores `null` aparecem no site como "[Inserir ...]" até serem preenchidos.
 */
export const site = {
  name: 'Centro Acadêmico de Ciência da Computação',
  short: 'CA Computação',
  institution: 'Universidade Federal do Espírito Santo',
  institutionShort: 'UFES',
  campus: 'Campus Alegre',
  email: 'caccomp.ufes@gmail.com',
  instagram: '@cacc.ufes',
  otherSocial: null as { label: string; href: string }[] | null,
  location: 'UFES - Campus Alegre',
  openingHours: '08h - 18h',
}

export const placeholders = {
  email: '[Inserir e-mail oficial]',
  instagram: '[Inserir @ do Instagram]',
  location: '[Inserir localização do CA]',
  openingHours: '[Inserir horário de atendimento]',
}

export const nav = [
  { page: 'inicio', label: 'Início' },
  { page: 'sobre', label: 'Sobre' },
  { page: 'integrantes', label: 'Integrantes' },
  { page: 'grade', label: 'Grade curricular' },
  { page: 'horarios', label: 'Horários' },
  { page: 'documentos', label: 'Documentos' },
  { page: 'complementares', label: 'Complementares' },
  { page: 'contato', label: 'Contato' },
] as const
