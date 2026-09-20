import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'
import { buildCandidatePool, type CandidatePool } from '@/lib/wardrobe/filters'
import type { StyleIntent } from '@/agents/style-agent'
import type { UserPreference } from '@/schemas/user'

export interface WardrobeAgentInput {
  items: WardrobeItem[]
  intent: StyleIntent
  preferences: UserPreference[]
  favoriteColors: string[]
  avoidColors: string[]
  excludeIds: string[]
}

export interface WardrobeAgentOutput {
  pool: CandidatePool
  selected_items: string[]
  missing_roles: OutfitRole[]
  reasoning: string
  confidence: number
}

/**
 * Consulta e filtra o guarda-roupa.
 * É o guardião da regra "só peça real": nada entra aqui que não exista no banco.
 */
export function runWardrobeAgent(input: WardrobeAgentInput): WardrobeAgentOutput {
  const { items, intent, preferences } = input

  const preferenceWeights: Record<string, number> = {}
  for (const pref of preferences) {
    if (pref.preference_type === 'liked_item') preferenceWeights[pref.value] = pref.weight
    if (pref.preference_type === 'disliked_item') preferenceWeights[pref.value] = -Math.abs(pref.weight)
  }

  const pool = buildCandidatePool(items, {
    style: intent.style,
    occasion: intent.occasion,
    season: intent.season,
    excludeIds: input.excludeIds,
    favoriteColors: [...input.favoriteColors, ...intent.requestedColors],
    avoidColors: input.avoidColors,
    preferenceWeights,
  })

  const eligible = Object.values(pool.byRole).flat()
  const confidence = computeConfidence(items.length, eligible.length, pool.missingRoles.length)

  return {
    pool,
    selected_items: eligible.map((i) => i.id),
    missing_roles: pool.missingRoles,
    reasoning: buildReasoning(items.length, eligible.length, pool.missingRoles),
    confidence,
  }
}

function computeConfidence(total: number, eligible: number, missing: number): number {
  if (total === 0) return 0
  const coverage = Math.min(1, eligible / 8)
  const penalty = missing * 0.25
  return Number(Math.max(0, Math.min(1, coverage - penalty)).toFixed(4))
}

function buildReasoning(total: number, eligible: number, missing: OutfitRole[]): string {
  if (total === 0) return 'Guarda-roupa vazio: nenhuma peça cadastrada.'
  const base = `${eligible} de ${total} peças passaram no filtro de estilo, formalidade e ocasião.`
  if (missing.length === 0) return base
  return `${base} Faltam peças para: ${missing.join(', ')}.`
}
