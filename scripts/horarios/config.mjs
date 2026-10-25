// Configuração da coleta de horários. Mude aqui se a UFES reorganizar as páginas.

export const USER_AGENT = 'CA-Computacao-UFES-Alegre/1.0 (coleta diária de horários; +https://github.com/FeAugustoCruz/CA_Computacao)'

/** Curso atendido pelo site. A grade curricular é a referência para reconhecer as disciplinas. */
export const COURSE = {
  name: 'Ciência da Computação',
  curriculumFile: 'src/content/curriculo.ts',
}

/** Páginas oficiais (fontes primárias). */
export const PAGES = {
  salas: 'https://graduacao.alegre.ufes.br/horario/salas',
  laboratorios: 'https://graduacao.alegre.ufes.br/horario/laboratorios',
}

/**
 * Cada fonte é uma planilha ligada por um link numa das páginas.
 * `directUrl` (opcional): link oficial da planilha publicada (Google Sheets "Publicar na web"). É tentado primeiro;
 * se falhar, a coleta volta a procurar o link na página oficial.
 * `match`: expressões (aplicadas a texto sem acentos e em minúsculas) que identificam o link da fonte
 * pelo texto do link, nome do arquivo, título da seção ou texto ao redor.
 */
export const SOURCES = [
  {
    id: 'predio-central',
    page: 'salas',
    group: 'Prédio Central',
    directUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQziQtbnCTvmYk2F9J9tw6W0qVvYceMi3IsE-pXRdF6Cc8oIyxsCW4SZbho_AJDj538tcqaG4s8XFEn/pubhtml',
    match: [/predio\s+central/],
  },
  {
    id: 'ciclo-basico',
    page: 'salas',
    group: 'Ciclo Básico',
    directUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJWpCXgWLk-M_rTwUDKNjaky40wExieiDrBlMJoA_tU_XOGK-ngWWzJtBnkSCpwCFDY4Z46GwdqCum/pubhtml',
    match: [/ciclo\s+basico/],
  },
  { id: 'chi-chiu', page: 'laboratorios', group: 'Laboratório Chi-Chiu', match: [/chi[\s_-]*chiu/] },
  { id: 'reuni', page: 'laboratorios', group: 'Laboratório Reuni', match: [/\breuni\b/] },
]

export const SCHEMA_VERSION = 1
