import { z } from 'zod'
import { styleSchema } from './outfit'
import { SILHOUETTES } from './formula'

/**
 * Como a pessoa se veste em cada contexto (§11–12).
 *
 * Existe porque "trabalho" não quer dizer a mesma coisa para todo mundo, e
 * "igreja" muito menos: o dress code é do usuário, não do sistema.
 */

export const WORK_DRESS_CODES = ['casual', 'casual-elegante', 'business-casual', 'social', 'executivo'] as const
export type WorkDressCode = (typeof WORK_DRESS_CODES)[number]

export const CHURCH_STYLES = ['casual-elegante', 'feminino', 'classico', 'sofisticado', 'social', 'moderno'] as const
export type ChurchStyle = (typeof CHURCH_STYLES)[number]

export const TENNIS_STYLES = ['esportivo', 'fashion-tennis', 'minimalista', 'colorido'] as const
export type TennisStyle = (typeof TENNIS_STYLES)[number]

/** 0 sem exigência · 1 discreto · 2 coberto · 3 máxima cobertura. */
export const MODESTY_LEVELS = [0, 1, 2, 3] as const

/** Faixa de formalidade que cada dress code de trabalho representa. */
export const WORK_FORMALITY: Record<WorkDressCode, [number, number]> = {
  casual: [2, 5],
  'casual-elegante': [4, 6],
  'business-casual': [5, 7],
  social: [6, 9],
  executivo: [8, 10],
}

export const CHURCH_FORMALITY: Record<ChurchStyle, [number, number]> = {
  'casual-elegante': [4, 7],
  feminino: [5, 8],
  classico: [6, 9],
  sofisticado: [7, 9],
  social: [6, 9],
  moderno: [4, 8],
}

export const styleProfileSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  primary_style: styleSchema.default('casual'),
  secondary_styles: z.array(styleSchema).default([]),
  work_style: z.enum(WORK_DRESS_CODES).default('social'),
  church_style: z.enum(CHURCH_STYLES).default('classico'),
  tennis_style: z.enum(TENNIS_STYLES).default('esportivo'),
  preferred_formality: z.number().int().min(0).max(10).nullable().default(null),
  preferred_colors: z.array(z.string()).default([]),
  avoid_colors: z.array(z.string()).default([]),
  preferred_silhouettes: z.array(z.enum(SILHOUETTES)).default([]),
  preferred_shoes: z.array(z.string()).default([]),
  modesty_level: z.number().int().min(0).max(3).default(1),
  favorite_formulas: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
})
export type StyleProfile = z.infer<typeof styleProfileSchema>

export const updateStyleProfileSchema = styleProfileSchema
  .omit({ id: true, user_id: true, created_at: true, updated_at: true })
  .partial()

/** Perfil padrão quando o usuário ainda não respondeu nada. */
export function defaultStyleProfile(userId: string): StyleProfile {
  const now = new Date().toISOString()
  return styleProfileSchema.parse({
    id: `sp_${userId}`,
    user_id: userId,
    created_at: now,
    updated_at: now,
  })
}

/**
 * Traduz o perfil para a faixa de formalidade daquele contexto.
 * É o que faz "trabalho" significar coisas diferentes para pessoas diferentes.
 */
export function formalityForContext(
  profile: StyleProfile | null,
  style: string,
): [number, number] | undefined {
  if (!profile) return undefined
  if (style === 'trabalho' || style === 'social') return WORK_FORMALITY[profile.work_style]
  if (style === 'igreja') return CHURCH_FORMALITY[profile.church_style]
  return undefined
}

/** Modéstia efetiva: igreja eleva o piso, porque é o contexto que a pede. */
export function modestyForContext(profile: StyleProfile | null, style: string): number {
  const base = profile?.modesty_level ?? 1
  if (style === 'igreja') return Math.max(base, 2)
  return base
}
