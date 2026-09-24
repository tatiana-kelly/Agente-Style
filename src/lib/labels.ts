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

/**
 * Rótulo de subcategoria.
 * O slug do banco é sem acento de propósito (é chave); o que a pessoa lê, não.
 * Sem isto o nome sugerido da peça saía "Calca verde".
 */
export const SUBCATEGORY_LABELS: Record<string, string> = {
  camiseta: 'Camiseta', camisa: 'Camisa', polo: 'Polo', regata: 'Regata',
  blusa: 'Blusa', sueter: 'Suéter', 'top-esportivo': 'Top esportivo',
  calca: 'Calça', shorts: 'Shorts', saia: 'Saia', legging: 'Legging',
  skort: 'Skort', bermuda: 'Bermuda',
  vestido: 'Vestido', macacao: 'Macacão',
  jaqueta: 'Jaqueta', blazer: 'Blazer', colete: 'Colete', casaco: 'Casaco', cardiga: 'Cardigã',
  'corta-vento': 'Corta-vento',
  tenis: 'Tênis', 'tenis-corrida': 'Tênis de corrida', 'tenis-tenis': 'Tênis de quadra',
  sapatilha: 'Sapatilha', salto: 'Salto', sandalia: 'Sandália', bota: 'Bota',
  sapato: 'Sapato', chinelo: 'Chinelo',
  cinto: 'Cinto', relogio: 'Relógio', oculos: 'Óculos', bone: 'Boné',
  viseira: 'Viseira', chapeu: 'Chapéu', joia: 'Joia', bijuteria: 'Bijuteria',
  meia: 'Meia', faixa: 'Faixa', brinco: 'Brinco', colar: 'Colar',
  anel: 'Anel', pulseira: 'Pulseira', lenco: 'Lenço',
  bolsa: 'Bolsa', mochila: 'Mochila', necessaire: 'Necessaire', raqueteira: 'Raqueteira',
}

export function subcategoryLabel(value: string): string {
  return SUBCATEGORY_LABELS[value] ?? titleCase(value)
}

/** Subcategorias femininas — o resto é tratado como masculino. */
const FEMININAS = new Set([
  'camisa', 'camiseta', 'blusa', 'regata', 'polo', 'calca', 'saia', 'legging',
  'bermuda', 'bota', 'sandalia', 'sapatilha', 'bolsa', 'mochila', 'viseira',
  'meia', 'faixa', 'joia', 'bijuteria', 'pulseira', 'necessaire', 'raqueteira',
  'jaqueta', 'chinelo',
])

/** Cores que flexionam em gênero. As demais são invariáveis (cinza, verde, bege). */
const CORES_FLEXIVEIS: Record<string, string> = {
  preto: 'preta', branco: 'branca', vermelho: 'vermelha', amarelo: 'amarela',
  roxo: 'roxa', claro: 'clara', escuro: 'escura', amarelado: 'amarelada',
}

/**
 * Nome da peça com concordância.
 * Sem isto o cadastro gerava "Camisa preto" e "Calca preto" — o produto
 * inteiro parece descuidado quando o nome da peça está errado.
 */
export function garmentName(subcategory: string, color: string): string {
  const base = subcategoryLabel(subcategory)
  const cor = color.trim().toLowerCase()
  if (!cor) return base

  const feminina = FEMININAS.has(subcategory)
  const flexionada = feminina ? (CORES_FLEXIVEIS[cor] ?? cor) : cor
  return `${base} ${flexionada}`
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
