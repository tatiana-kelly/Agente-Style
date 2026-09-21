import { z } from 'zod'

/**
 * Taxonomia fechada do guarda-roupa.
 * Manter fechada é o que permite o pré-filtro determinístico (PRP §35)
 * e evita que o modelo invente categorias que o banco não entende.
 */
export const CATEGORIES = ['top', 'bottom', 'shoes', 'outerwear', 'accessory', 'bag', 'dress'] as const
export type Category = (typeof CATEGORIES)[number]

export const SUBCATEGORIES = {
  top: ['camiseta', 'camisa', 'polo', 'regata', 'blusa', 'sueter', 'top-esportivo'],
  bottom: ['calca', 'shorts', 'saia', 'legging', 'skort', 'bermuda'],
  dress: ['vestido', 'macacao'],
  outerwear: ['jaqueta', 'blazer', 'casaco', 'cardiga', 'corta-vento'],
  shoes: ['tenis', 'tenis-corrida', 'tenis-tenis', 'sapatilha', 'salto', 'sandalia', 'bota', 'sapato', 'chinelo'],
  accessory: ['cinto', 'relogio', 'oculos', 'bone', 'viseira', 'chapeu', 'joia', 'bijuteria', 'meia', 'faixa'],
  bag: ['bolsa', 'mochila', 'necessaire', 'raqueteira'],
} as const satisfies Record<Category, readonly string[]>

export const ALL_SUBCATEGORIES = Object.values(SUBCATEGORIES).flat()

export const PATTERNS = ['liso', 'listrado', 'xadrez', 'floral', 'animal-print', 'poa', 'geometrico', 'estampado'] as const
export const SEASONS = ['verao', 'outono', 'inverno', 'primavera'] as const
export const SPORT_TYPES = ['tenis', 'corrida', 'academia', 'yoga', 'geral', 'nenhum'] as const

/** 0 = pijama, 10 = black tie. Escala única usada por todos os agentes. */
export const FORMALITY_MIN = 0
export const FORMALITY_MAX = 10

export const OCCASIONS = [
  'reuniao', 'almoco', 'jantar', 'partida-tenis', 'treino', 'viagem',
  'evento', 'festa', 'dia-comum', 'trabalho', 'passeio',
  // Igreja nao existia e o pedido "vou a igreja" morria na validacao com 422.
  'igreja',
] as const

export const categorySchema = z.enum(CATEGORIES)
export const seasonSchema = z.enum(SEASONS)
export const occasionSchema = z.enum(OCCASIONS)
export const sportTypeSchema = z.enum(SPORT_TYPES)

/** O que a IA de classificação deve devolver ao receber a foto de uma peça (PRP §8). */
export const classificationSchema = z.object({
  category: categorySchema,
  subcategory: z.string().min(1),
  color: z.string().min(1),
  secondary_colors: z.array(z.string()).default([]),
  pattern: z.enum(PATTERNS).default('liso'),
  material: z.string().default('desconhecido'),
  style: z.string().default('casual'),
  formality: z.number().int().min(FORMALITY_MIN).max(FORMALITY_MAX),
  sport_type: sportTypeSchema.default('nenhum'),
  season: z.array(seasonSchema).default([...SEASONS]),
  occasion: z.array(occasionSchema).default([]),
  description: z.string().default(''),
})
export type Classification = z.infer<typeof classificationSchema>

/**
 * Peça detectada dentro de uma foto que pode ter várias.
 * `position` é só para a pessoa distinguir uma da outra na hora de revisar.
 */
export const detectedGarmentSchema = classificationSchema.extend({
  position: z.string().default(''),
})
export type DetectedGarment = z.infer<typeof detectedGarmentSchema>

export const detectionSchema = z.object({
  items: z.array(detectedGarmentSchema).min(1),
})

export const wardrobeItemSchema = classificationSchema.extend({
  id: z.string(),
  user_id: z.string(),
  name: z.string().min(1),
  brand: z.string().nullable().default(null),
  image_original_url: z.string().nullable().default(null),
  image_processed_url: z.string().nullable().default(null),
  thumbnail_url: z.string().nullable().default(null),
  metadata: z.record(z.string(), z.unknown()).default({}),
  active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
})
export type WardrobeItem = z.infer<typeof wardrobeItemSchema>

export const createWardrobeItemSchema = classificationSchema.partial().extend({
  name: z.string().min(1, 'Dê um nome para a peça'),
  category: categorySchema,
  subcategory: z.string().min(1),
  color: z.string().min(1),
  brand: z.string().optional(),
  image_original_url: z.string().optional(),
  image_processed_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
})
export type CreateWardrobeItemInput = z.infer<typeof createWardrobeItemSchema>

export const updateWardrobeItemSchema = createWardrobeItemSchema.partial()
