import raw from '../data/horarios.json'
import type { HorariosData } from '../types'

/**
 * Horários coletados das planilhas oficiais da UFES (Alegre) por scripts/horarios/update.mjs.
 * O arquivo é regenerado a cada atualização automática; não edite à mão.
 */
export const horarios = raw as unknown as HorariosData

export const paginasOficiais = [
  { label: 'Horários das salas (Prédio Central e Ciclo Básico)', href: 'https://graduacao.alegre.ufes.br/horario/salas' },
  { label: 'Horários dos laboratórios (Chi-Chiu e Reuni)', href: 'https://graduacao.alegre.ufes.br/horario/laboratorios' },
]

/** Cor de cada prédio ou laboratório nos blocos da grade (paleta do CA, com contraste suficiente nos dois temas). */
export function corLocal(group: string): string {
  switch (group) {
    case 'Prédio Central':
      return 'bg-orange text-night'
    case 'Ciclo Básico':
      return 'bg-graphite text-white'
    case 'Laboratório Chi-Chiu':
      return 'bg-sand text-ink border-l-[5px] border-orange'
    case 'Laboratório Reuni':
      return 'bg-night text-white border border-orange/70'
    default:
      return 'bg-surface-2 text-fg border border-line'
  }
}
