import { z } from 'zod'
import { OUTFIT_ROLES, styleSchema } from './outfit'
import { occasionSchema, seasonSchema } from './wardrobe'
import { COLOR_RELATIONS } from '@/lib/outfits/color-engine'

/**
 * Uma fórmula é conhecimento de styling em formato executável.
 *
 * Deliberadamente NÃO guarda imagem nem descreve um look de uma pessoa específica.
 * Guarda a relação entre arquétipos de peça — que é o que se pode aplicar a
 * qualquer guarda-roupa (§37).
 */

/** Arquétipos de peça. Mais grosso que subcategoria, mais fino que papel. */
export const GARMENT_ARCHETYPES = [
  // tops
  'blouse', 'shirt', 'tshirt', 'knit', 'polo', 'tank', 'sport_top', 'statement_top',
  // bottoms
  'tailored_trousers', 'wide_leg_trousers', 'jeans', 'midi_skirt', 'pleated_skirt',
  'skirt', 'shorts', 'skort', 'leggings',
  // inteiriças
  'dress', 'midi_dress', 'sport_dress',
  // sobreposição
  'blazer', 'cardigan', 'jacket', 'coat', 'windbreaker',
  // calçados
  'heels', 'flats', 'elegant_shoe', 'loafers', 'sneakers', 'tennis_shoes', 'boots', 'sandals',
  // acessórios
  'visor', 'cap', 'watch', 'jewelry', 'belt', 'sunglasses',
  // bolsas
  'structured_bag', 'tote', 'backpack', 'tennis_bag',
] as const
export type GarmentArchetype = (typeof GARMENT_ARCHETYPES)[number]

export const SILHOUETTES = [
  'fitted_top_full_bottom',
  'full_top_fitted_bottom',
  'column',
  'relaxed',
  'structured',
  'athletic',
] as const
export type Silhouette = (typeof SILHOUETTES)[number]

/** De onde veio a regra — exigido pelo §22/§23. */
export const SOURCE_TYPES = ['styling-principle', 'dress-code', 'sport-functional', 'color-theory'] as const

export const formulaSlotSchema = z.object({
  role: z.enum(OUTFIT_ROLES),
  /** Arquétipos aceitos, em ordem de preferência. */
  archetypes: z.array(z.enum(GARMENT_ARCHETYPES)).min(1),
})
export type FormulaSlot = z.infer<typeof formulaSlotSchema>

export const outfitFormulaSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  style: z.array(styleSchema).min(1),
  occasion: z.array(occasionSchema).min(1),
  formality: z.tuple([z.number().int().min(0).max(10), z.number().int().min(0).max(10)]),
  season: z.array(seasonSchema).default(['verao', 'outono', 'inverno', 'primavera']),
  required_roles: z.array(formulaSlotSchema).min(1),
  optional_roles: z.array(formulaSlotSchema).default([]),
  color_patterns: z.array(z.enum(COLOR_RELATIONS)).default([]),
  silhouette: z.enum(SILHOUETTES),
  description: z.string(),
  source_type: z.enum(SOURCE_TYPES),
  source_reference: z.string(),
  /** Menor = mais óbvia. Alimenta o eixo clássico ↔ ousado. */
  novelty: z.number().min(0).max(1).default(0.3),
  /** Restrições de modéstia; usado por igreja e por preferência do usuário. */
  modesty_min: z.number().min(0).max(3).default(0),
  active: z.boolean().default(true),
})
export type OutfitFormula = z.infer<typeof outfitFormulaSchema>
