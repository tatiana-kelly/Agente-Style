import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole, Style } from '@/schemas/outfit'
import { ruleFor, type StyleRule } from './style-rules'

export function roleForItem(item: WardrobeItem): OutfitRole {
  return item.category as OutfitRole
}

export interface CandidateContext {
  style: Style
  occasion?: string
  season?: string
  excludeIds?: string[]
  favoriteColors?: string[]
  avoidColors?: string[]
  /** peso aprendido por id de peça, de -1 a 1 */
  preferenceWeights?: Record<string, number>
}

/**
 * Filtro rígido: a peça é *elegível* para este estilo?
 * Rejeitar aqui é barato; rejeitar depois da IA é caro.
 */
export function isEligible(item: WardrobeItem, rule: StyleRule, ctx: CandidateContext): boolean {
  if (!item.active) return false
  if (ctx.excludeIds?.includes(item.id)) return false
  if (rule.forbiddenSubcategories.includes(item.subcategory)) return false

  // Tolerância de 1 ponto: um guarda-roupa pequeno não pode ficar sem resposta.
  const [min, max] = rule.formality
  if (item.formality < min - 1 || item.formality > max + 1) return false

  if (rule.preferredSportTypes.length > 0) {
    const sportOk = rule.preferredSportTypes.includes(item.sport_type)
    const neutralOk = item.sport_type === 'nenhum' && item.formality <= 3
    if (!sportOk && !neutralOk) return false
  }
  return true
}

/** 0..1 — quão bem a peça atende ao pedido, antes de olhar o conjunto. */
export function scoreItem(item: WardrobeItem, rule: StyleRule, ctx: CandidateContext): number {
  let score = 0.5

  const role = roleForItem(item)
  const preferred = rule.preferredSubcategories[role]
  if (preferred?.includes(item.subcategory)) score += 0.2

  const formalityGap = Math.abs(item.formality - rule.idealFormality)
  score += Math.max(0, 0.2 - formalityGap * 0.04)

  if (ctx.occasion && item.occasion.includes(ctx.occasion as never)) score += 0.12
  if (ctx.season && item.season.includes(ctx.season as never)) score += 0.05
  if (rule.preferredSportTypes.includes(item.sport_type) && item.sport_type !== 'nenhum') score += 0.1

  if (ctx.favoriteColors?.some((c) => sameColor(c, item.color))) score += 0.08
  if (ctx.avoidColors?.some((c) => sameColor(c, item.color))) score -= 0.25

  score += (ctx.preferenceWeights?.[item.id] ?? 0) * 0.2

  return clamp01(score)
}

function sameColor(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export interface CandidatePool {
  byRole: Record<OutfitRole, WardrobeItem[]>
  scores: Record<string, number>
  missingRoles: OutfitRole[]
}

/**
 * Monta o pool de candidatos já ordenado e limitado.
 * `limitPerRole` existe para não despejar o guarda-roupa inteiro no modelo (PRP §35).
 */
export function buildCandidatePool(
  items: WardrobeItem[],
  ctx: CandidateContext,
  limitPerRole = 6,
): CandidatePool {
  const rule = ruleFor(ctx.style)
  const byRole = {} as Record<OutfitRole, WardrobeItem[]>
  const scores: Record<string, number> = {}

  for (const item of items) {
    if (!isEligible(item, rule, ctx)) continue
    const role = roleForItem(item)
    scores[item.id] = scoreItem(item, rule, ctx)
    ;(byRole[role] ??= []).push(item)
  }

  for (const role of Object.keys(byRole) as OutfitRole[]) {
    byRole[role] = byRole[role]
      .sort((a, b) => scores[b.id] - scores[a.id])
      .slice(0, limitPerRole)
  }

  // Um vestido satisfaz top+bottom de uma vez.
  const hasDress = (byRole.dress?.length ?? 0) > 0
  const missingRoles = rule.requiredRoles.filter((role) => {
    if (hasDress && (role === 'top' || role === 'bottom')) return false
    return (byRole[role]?.length ?? 0) === 0
  })

  return { byRole, scores, missingRoles }
}
