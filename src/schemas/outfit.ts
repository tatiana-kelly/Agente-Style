import { z } from 'zod'
import { occasionSchema, seasonSchema } from './wardrobe'

/** Papéis que uma peça pode ocupar dentro de um look (PRP §10). */
export const OUTFIT_ROLES = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'bag'] as const
export type OutfitRole = (typeof OUTFIT_ROLES)[number]

/** Intenções de look oferecidas na Home (PRP §5). */
export const STYLES = [
  'social', 'casual', 'esporte', 'tenis', 'trabalho',
  'evento', 'viagem', 'jantar', 'festa', 'dia-a-dia',
] as const
export type Style = (typeof STYLES)[number]
export const styleSchema = z.enum(STYLES)

export const outfitItemSchema = z.object({
  wardrobe_item_id: z.string(),
  role: z.enum(OUTFIT_ROLES),
})

export const outfitSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  occasion: occasionSchema.nullable(),
  style: styleSchema,
  context: z.string().nullable(),
  weather: z.record(z.string(), z.unknown()).nullable(),
  season: seasonSchema.nullable(),
  status: z.enum(['draft', 'saved', 'discarded']).default('draft'),
  items: z.array(outfitItemSchema),
  explanation: z.string().default(''),
  scores: z.record(z.string(), z.number()).default({}),
  created_at: z.string(),
})
export type Outfit = z.infer<typeof outfitSchema>

/** Scores internos. Nunca exibidos como "nota" ao usuário (PRP §21). */
export const outfitScoresSchema = z.object({
  wardrobe_match_score: z.number().min(0).max(1),
  color_score: z.number().min(0).max(1),
  style_score: z.number().min(0).max(1),
  occasion_score: z.number().min(0).max(1),
  outfit_confidence: z.number().min(0).max(1),
})
export type OutfitScores = z.infer<typeof outfitScoresSchema>

export const generateLookRequestSchema = z.object({
  style: styleSchema,
  occasion: occasionSchema.optional(),
  context: z.string().max(500).optional(),
  weather: z
    .object({
      temperature: z.number().optional(),
      rain: z.boolean().optional(),
      humidity: z.number().optional(),
      wind: z.number().optional(),
    })
    .optional(),
  /** Gerar a imagem custa dinheiro: só quando o usuário pedir de fato (PRP §59). */
  render_image: z.boolean().default(true),
  /** Peças que o usuário exigiu manter ao "trocar peça" / "outra opção". */
  locked_item_ids: z.array(z.string()).default([]),
  /** Peças a evitar nesta nova tentativa. */
  exclude_item_ids: z.array(z.string()).default([]),
})
export type GenerateLookRequest = z.infer<typeof generateLookRequestSchema>
