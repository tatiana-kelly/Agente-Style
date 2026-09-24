import type { Style, OutfitRole } from '@/schemas/outfit'

/**
 * Regra determinística por intenção de look.
 * É o pré-filtro do PRP §35: reduz o guarda-roupa ANTES de qualquer chamada de IA.
 */
export interface StyleRule {
  formality: readonly [number, number]
  idealFormality: number
  requiredRoles: readonly OutfitRole[]
  optionalRoles: readonly OutfitRole[]
  /** sport_type aceitos; vazio = qualquer um. */
  preferredSportTypes: readonly string[]
  /** Subcategorias que tornam a peça inelegível para este estilo. */
  forbiddenSubcategories: readonly string[]
  /** Subcategorias que ganham bônus, por papel. */
  preferredSubcategories: Partial<Record<OutfitRole, readonly string[]>>
  defaultOccasion: string
}

const SOCIAL_FORBIDDEN = ['legging', 'skort', 'top-esportivo', 'tenis-corrida', 'tenis-tenis', 'chinelo', 'bone', 'viseira']
const SPORT_FORBIDDEN = ['blazer', 'salto', 'sapato', 'sandalia', 'camisa', 'vestido', 'saia', 'joia']

export const STYLE_RULES: Record<Style, StyleRule> = {
  social: {
    formality: [6, 10], idealFormality: 7.5,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: ['nenhum'], forbiddenSubcategories: SOCIAL_FORBIDDEN,
    preferredSubcategories: { top: ['camisa', 'blusa'], bottom: ['calca', 'saia'], shoes: ['salto', 'sapato', 'sapatilha'], outerwear: ['blazer', 'colete'] },
    defaultOccasion: 'evento',
  },
  trabalho: {
    formality: [5, 9], idealFormality: 6.5,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: ['nenhum'], forbiddenSubcategories: SOCIAL_FORBIDDEN,
    preferredSubcategories: { top: ['camisa', 'blusa', 'polo'], bottom: ['calca', 'saia'], shoes: ['sapatilha', 'sapato', 'salto'], outerwear: ['blazer', 'colete'] },
    defaultOccasion: 'trabalho',
  },
  evento: {
    formality: [7, 10], idealFormality: 8.5,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: ['nenhum'], forbiddenSubcategories: SOCIAL_FORBIDDEN,
    preferredSubcategories: { shoes: ['salto', 'sapato'], bottom: ['saia', 'calca'], accessory: ['joia'] },
    defaultOccasion: 'evento',
  },
  festa: {
    formality: [6, 10], idealFormality: 8,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['accessory', 'bag', 'outerwear'],
    preferredSportTypes: ['nenhum'], forbiddenSubcategories: SOCIAL_FORBIDDEN,
    preferredSubcategories: { shoes: ['salto', 'sandalia'], accessory: ['joia', 'bijuteria'] },
    defaultOccasion: 'festa',
  },
  jantar: {
    formality: [5, 9], idealFormality: 7,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: ['nenhum'], forbiddenSubcategories: SOCIAL_FORBIDDEN,
    preferredSubcategories: { shoes: ['salto', 'sapatilha', 'sandalia'], top: ['blusa', 'camisa'] },
    defaultOccasion: 'jantar',
  },
  casual: {
    formality: [1, 6], idealFormality: 3.5,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: [], forbiddenSubcategories: ['salto'],
    preferredSubcategories: { top: ['camiseta', 'blusa'], bottom: ['calca', 'shorts', 'saia'], shoes: ['tenis', 'sapatilha', 'sandalia'] },
    defaultOccasion: 'passeio',
  },
  'dia-a-dia': {
    formality: [1, 6], idealFormality: 3,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: [], forbiddenSubcategories: ['salto'],
    preferredSubcategories: { top: ['camiseta', 'blusa'], shoes: ['tenis', 'sapatilha'] },
    defaultOccasion: 'dia-comum',
  },
  viagem: {
    formality: [1, 6], idealFormality: 3.5,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: [], forbiddenSubcategories: ['salto', 'joia'],
    preferredSubcategories: { shoes: ['tenis', 'sapatilha'], outerwear: ['jaqueta', 'corta-vento'], bag: ['mochila'] },
    defaultOccasion: 'viagem',
  },
  esporte: {
    formality: [0, 3], idealFormality: 1,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['accessory', 'bag', 'outerwear'],
    preferredSportTypes: ['corrida', 'academia', 'yoga', 'geral', 'tenis'],
    forbiddenSubcategories: SPORT_FORBIDDEN,
    preferredSubcategories: { top: ['top-esportivo', 'regata', 'camiseta'], bottom: ['legging', 'shorts'], shoes: ['tenis-corrida', 'tenis'] },
    defaultOccasion: 'treino',
  },
  igreja: {
    formality: [5, 9], idealFormality: 6.5,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: ['nenhum'],
    // Modestia: nada esportivo nem curto demais. A saia midi e a peca ancora.
    forbiddenSubcategories: [...SOCIAL_FORBIDDEN, 'shorts', 'top-esportivo', 'regata'],
    preferredSubcategories: {
      top: ['blusa', 'camisa', 'sueter'],
      bottom: ['saia', 'calca'],
      dress: ['vestido'],
      shoes: ['sapatilha', 'salto', 'sapato'],
      outerwear: ['blazer', 'colete', 'cardiga'],
    },
    defaultOccasion: 'igreja',
  },
  elegante: {
    formality: [6, 10], idealFormality: 7.5,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: ['nenhum'], forbiddenSubcategories: SOCIAL_FORBIDDEN,
    preferredSubcategories: { top: ['blusa', 'camisa'], bottom: ['saia', 'calca'], shoes: ['salto', 'sapatilha'] },
    defaultOccasion: 'evento',
  },
  feminino: {
    formality: [4, 9], idealFormality: 6,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: ['nenhum'], forbiddenSubcategories: ['top-esportivo', 'legging', 'tenis-corrida'],
    preferredSubcategories: { top: ['blusa'], bottom: ['saia'], dress: ['vestido'], shoes: ['sapatilha', 'salto', 'sandalia'] },
    defaultOccasion: 'passeio',
  },
  moderno: {
    formality: [3, 8], idealFormality: 5,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['outerwear', 'accessory', 'bag'],
    preferredSportTypes: [], forbiddenSubcategories: [],
    preferredSubcategories: { top: ['camiseta', 'blusa', 'camisa'], bottom: ['calca', 'saia'], shoes: ['tenis', 'sapatilha'], outerwear: ['blazer', 'colete'] },
    defaultOccasion: 'passeio',
  },
  tenis: {
    formality: [0, 3], idealFormality: 1,
    requiredRoles: ['top', 'bottom', 'shoes'], optionalRoles: ['accessory', 'bag', 'outerwear'],
    preferredSportTypes: ['tenis', 'geral'],
    forbiddenSubcategories: SPORT_FORBIDDEN,
    preferredSubcategories: {
      top: ['top-esportivo', 'regata', 'camiseta', 'polo'],
      bottom: ['skort', 'saia', 'shorts', 'legging'],
      shoes: ['tenis-tenis', 'tenis'],
      accessory: ['viseira', 'bone', 'faixa', 'meia'],
      bag: ['raqueteira', 'mochila'],
    },
    defaultOccasion: 'partida-tenis',
  },
}

export function ruleFor(style: Style): StyleRule {
  return STYLE_RULES[style]
}
