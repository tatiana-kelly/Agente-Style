import type { Style, OutfitRole } from '@/schemas/outfit'
import { titleCase } from '@/lib/utils'

/**
 * Rótulos de exibição.
 * Os enums do banco são sem acento e com hífen; a tela não deve mostrar "Partida Tenis".
 */
export const OCCASION_LABELS: Record<string, string> = {
  reuniao: 'Reunião',
  almoco: 'Almoço',
  jantar: 'Jantar',
  'partida-tenis': 'Partida de tênis',
  treino: 'Treino',
  viagem: 'Viagem',
  evento: 'Evento',
  festa: 'Festa',
  'dia-comum': 'Dia comum',
  trabalho: 'Trabalho',
  passeio: 'Passeio',
  igreja: 'Igreja',
}

export const STYLE_LABELS: Record<Style, string> = {
  social: 'Social',
  casual: 'Casual',
  esporte: 'Esporte',
  tenis: 'Tênis',
  trabalho: 'Trabalho',
  evento: 'Evento',
  viagem: 'Viagem',
  jantar: 'Jantar',
  festa: 'Festa',
  'dia-a-dia': 'Dia a dia',
  igreja: 'Igreja',
  elegante: 'Elegante',
  feminino: 'Feminino',
  moderno: 'Moderno',
}

export const ROLE_LABELS: Record<OutfitRole, string> = {
  top: 'Parte de cima',
  bottom: 'Parte de baixo',
  dress: 'Vestido',
  shoes: 'Calçado',
  outerwear: 'Sobreposição',
  accessory: 'Acessório',
  bag: 'Bolsa',
}

export function occasionLabel(value: string): string {
  return OCCASION_LABELS[value] ?? titleCase(value)
}

export function styleLabel(value: string): string {
  return STYLE_LABELS[value as Style] ?? titleCase(value)
}

export function roleLabel(value: string): string {
  return ROLE_LABELS[value as OutfitRole] ?? titleCase(value)
}
