import type { Member } from '../types'

//Pra servir fotos de perfil enquanto não alimentamos com as oficiais
const foto = (seed:string):Member['photo'] =>({
  src:`https://ui-avatars.com/api/?background=f99c4f&color=000&name=${seed}`,
  alt:`Foto de ${seed}`,
})

export const members: Member[] = [
  {
    id: '1',
    name:'Fernando Augusto',
    role:'Presidente',
    photo: foto('Fernando Augusto'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '2',
    name:'Milena Bôa',
    role:'Vice-Presidente',
    photo:foto('Milena Bôa'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '3',
    name:'Gabriel Gaspar',
    role:'Diretor Financeiro',
    photo:foto('Gabriel Gaspar'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '4',
    name:'Matheus Marques',
    role:'Assessor Financeiro',
    photo:foto('Matheus Marques'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '5',
    name:'Flávia Lira',
    role:'Diretora de Gestão de Pessoas',
    photo:foto('Flávia Lira'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '6',
    name:'Anthony Silva',
    role:'Assessor de Gestão de Pessoas',
    photo:foto('Anthony Silva'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '7',
    name:'Elis Vieira',
    role:'Diretora de Marketing',
    photo:foto('Elis Vieira'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '8',
    name:'Kayo Santana',
    role:'Assessor de Marketing',
    photo:foto('Kayo Santana'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '9',
    name:'Daniella Honório',
    role:'Assessora de Marketing',
    photo:foto('Daniella Honório'),
    bio:'---',
    placeholder: false,
  },
  {
    id: '10',
    name:'Danillo de Paula',
    role:'Diretor de Projetos',
    bio:'---',
    photo:foto('Danillo de Paula'),
    placeholder: false,
  },
  {
    id: '11',
    name:'João Vitor Tobias',
    role:'Assessor de Projetos',
    photo:foto('João Vitor'),
    bio:'---',
    placeholder: false,
  },
]

export const membersPlaceholder: Member[] = [1, 2, 3, 4].map((n) => ({
  id: `vaga-${n}`,
  name: '[Nome completo]',
  role: '[Cargo ou função]',
  bio: '[Breve descrição, quando pertinente]',
  placeholder: true,
}))
