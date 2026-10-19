/**
 * Textos institucionais editáveis da página "Sobre".
 * `text: null` aparece como campo de preenchimento. Nada aqui é história ou missão inventada.
 */
export const aboutIntro =
  'O Centro Acadêmico é a entidade que representa os estudantes do curso junto à coordenação, ao colegiado e à universidade. Esta página reúne, nas palavras da própria gestão, quem somos e o que fazemos.'

export const aboutSections: { id: string; title: string; prompt: string; text: string[] | null }[] = [
  { 
    id: 'historia', title: 'Nossa história', prompt: '[Inserir a história do Centro Acadêmico]', text: [
      'O CACC surgiu na necessidade de uma representação estudantil para o curso de Ciência da Computação.'
    ] },
  { id: 'missao', title: 'Missão e objetivos', prompt: '[Inserir missão e objetivos]', text: [
    'O CACC existe para as questões que a coordenação não alcança e que o estudante não consegue resolver sozinho. Sua principal missão é fazer a intermediação entre os alunos e o colegiado do curso.','Na prática tem o objetivo de acompanhar a qualidade do curso, zelar pelos direitos do corpo discente e acolher a os alunos e suas demandas.'
  ] },
  { id: 'representacao', title: 'Atuação na representação discente', prompt: '[Descrever como o CA representa os estudantes]', text: [
     'A representação discente se dá nas reuniões do colegiado e nas demais instâncias deliberativas possíveis. O CACC leva para esses espaços as demandas que chegam dos estudantes, buscando apreciá-las com imparcialidade e transparência.','Além da atuação formal, o CACC mantém-se à disposição para o contato com a comunidade discente. Assim, qualquer aluno pode acompanhar o que está em pauta e trazer sua contribuição.'
  ] },
  { id: 'importancia', title: 'Importância para a comunidade acadêmica', prompt: '[Inserir texto institucional]', text: [
    'A existência do Centro Acadêmico se justifica pela necessidade de união da comunidade acadêmica. Um centro acadêmico ativo promove integração e acolhimento aos alunos, além de representação oficial e promoção de atividades construtivas.'
  ] },
  { id: 'integracao', title: 'Iniciativas de integração', prompt: '[Listar iniciativas voltadas à integração dos estudantes]', text: null },
]
