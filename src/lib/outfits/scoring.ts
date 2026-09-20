import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitScores, Style } from '@/schemas/outfit'
import { paletteScore } from '@/lib/wardrobe/colors'
import { ruleFor } from '@/lib/wardrobe/style-rules'
import { clamp01 } from '@/lib/wardrobe/filters'

/** Quanto do look é "peça real e adequada" versus preenchimento forçado. */
export function wardrobeMatchScore(items: WardrobeItem[], style: Style): number {
  const rule = ruleFor(style)
  const roles = new Set(items.map((i) => i.category))
  const hasDress = roles.has('dress')
  const covered = rule.requiredRoles.filter((r) => {
    if (hasDress && (r === 'top' || r === 'bottom')) return true
    return roles.has(r)
  })
  return clamp01(covered.length / rule.requiredRoles.length)
}

export function colorScore(items: WardrobeItem[]): number {
  // Acessórios e bolsas pesam menos na harmonia que as peças grandes.
  const major = items.filter((i) => !['accessory', 'bag'].includes(i.category))
  return paletteScore(major.map((i) => i.color))
}

export function styleScore(items: WardrobeItem[], style: Style): number {
  const rule = ruleFor(style)
  if (items.length === 0) return 0
  const avgFormality = items.reduce((s, i) => s + i.formality, 0) / items.length
  const gap = Math.abs(avgFormality - rule.idealFormality)
  const formalityFit = clamp01(1 - gap / 5)

  // Um look incoerente mistura formalidades muito distantes entre si.
  const spread = Math.max(...items.map((i) => i.formality)) - Math.min(...items.map((i) => i.formality))
  const coherence = clamp01(1 - spread / 8)

  const sportFit = rule.preferredSportTypes.length === 0
    ? 1
    : clamp01(items.filter((i) => rule.preferredSportTypes.includes(i.sport_type)).length / items.length + 0.4)

  return clamp01(formalityFit * 0.45 + coherence * 0.3 + sportFit * 0.25)
}

export function occasionScore(items: WardrobeItem[], occasion?: string): number {
  if (!occasion) return 0.8
  if (items.length === 0) return 0
  const hits = items.filter((i) => i.occasion.includes(occasion as never)).length
  return clamp01(0.5 + (hits / items.length) * 0.5)
}

export function scoreOutfit(items: WardrobeItem[], style: Style, occasion?: string): OutfitScores {
  const wardrobe_match_score = wardrobeMatchScore(items, style)
  const color_score = colorScore(items)
  const style_score = styleScore(items, style)
  const occasion_score = occasionScore(items, occasion)

  const outfit_confidence = clamp01(
    wardrobe_match_score * 0.3 + color_score * 0.25 + style_score * 0.3 + occasion_score * 0.15,
  )

  return {
    wardrobe_match_score: round(wardrobe_match_score),
    color_score: round(color_score),
    style_score: round(style_score),
    occasion_score: round(occasion_score),
    outfit_confidence: round(outfit_confidence),
  }
}

function round(n: number): number {
  return Number(n.toFixed(4))
}
