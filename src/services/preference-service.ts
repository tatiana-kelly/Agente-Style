import type { Repository } from './repository'
import type { WardrobeItem } from '@/schemas/wardrobe'
import type { Outfit } from '@/schemas/outfit'
import type { FeedbackInput } from '@/schemas/user'
import { normalizeColor } from '@/lib/wardrobe/colors'

/** Peso por ação. Curtir sobe devagar; rejeitar desce mais rápido. */
const WEIGHTS: Record<FeedbackInput['action'], number> = {
  liked: 0.25,
  saved: 0.35,
  rejected: -0.3,
  swapped: -0.15,
  regenerated: -0.05,
}

/**
 * Converte comportamento em preferência estruturada (PRP §23).
 * Sem treinar modelo: só memória explícita que o filtro já sabe ler.
 */
export async function applyFeedback(
  repo: Repository,
  userId: string,
  outfit: Outfit,
  items: WardrobeItem[],
  feedback: FeedbackInput,
): Promise<void> {
  const weight = WEIGHTS[feedback.action]
  const positive = weight > 0

  for (const item of items) {
    // Ao trocar uma peça, só ela é penalizada — o resto do look agradou.
    if (feedback.action === 'swapped' && feedback.swapped_role) {
      const role = outfit.items.find((o) => o.wardrobe_item_id === item.id)?.role
      if (role !== feedback.swapped_role) continue
    }
    await repo.upsertPreference(userId, positive ? 'liked_item' : 'disliked_item', item.id, Math.abs(weight) * (positive ? 1 : 1))
  }

  if (positive && items.length >= 2) {
    const majorColors = items
      .filter((i) => !['accessory', 'bag'].includes(i.category))
      .map((i) => normalizeColor(i.color))
      .sort()
    if (majorColors.length >= 2) {
      await repo.upsertPreference(userId, 'color_combination', majorColors.join('+'), weight)
    }
  }

  await repo.upsertPreference(userId, 'style_affinity', outfit.style, weight)
  if (outfit.occasion) {
    await repo.upsertPreference(userId, 'occasion_affinity', outfit.occasion, weight)
  }
}

/** Mapa id da peça → peso, pronto para o filtro de candidatos. */
export function preferenceWeightMap(
  preferences: Array<{ preference_type: string; value: string; weight: number }>,
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const p of preferences) {
    if (p.preference_type === 'liked_item') map[p.value] = p.weight
    if (p.preference_type === 'disliked_item') map[p.value] = -Math.abs(p.weight)
  }
  return map
}
