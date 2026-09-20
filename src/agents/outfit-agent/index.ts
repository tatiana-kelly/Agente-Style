import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole, OutfitScores } from '@/schemas/outfit'
import { composeOutfits, type ComposedOutfit } from '@/lib/outfits/composer'
import { colorFamily, isNeutral } from '@/lib/wardrobe/colors'
import type { StyleIntent } from '@/agents/style-agent'
import { occasionLabel, styleLabel } from '@/lib/labels'

export interface OutfitAgentInput {
  items: WardrobeItem[]
  intent: StyleIntent
  lockedItemIds: string[]
  excludeIds: string[]
  favoriteColors: string[]
  avoidColors: string[]
  preferenceWeights: Record<string, number>
  count?: number
}

export interface OutfitProposal {
  items: Array<{ item: WardrobeItem; role: OutfitRole }>
  scores: OutfitScores
  explanation: string
  name: string
}

export interface OutfitAgentOutput {
  primary: OutfitProposal | null
  alternatives: OutfitProposal[]
  missingRoles: OutfitRole[]
}

/** Monta o conjunto e escreve a justificativa. Nenhuma chamada de modelo aqui. */
export function runOutfitAgent(input: OutfitAgentInput): OutfitAgentOutput {
  const composed = composeOutfits(input.items, {
    style: input.intent.style,
    occasion: input.intent.occasion,
    season: input.intent.season,
    excludeIds: input.excludeIds,
    lockedItemIds: input.lockedItemIds,
    favoriteColors: [...input.favoriteColors, ...input.intent.requestedColors],
    avoidColors: input.avoidColors,
    preferenceWeights: input.preferenceWeights,
    count: input.count ?? 3,
  })

  const proposals = composed.map((c) => toProposal(c, input.intent))

  return {
    primary: proposals[0] ?? null,
    alternatives: proposals.slice(1),
    missingRoles: composed[0]?.missingRoles ?? [],
  }
}

function toProposal(composed: ComposedOutfit, intent: StyleIntent): OutfitProposal {
  return {
    items: composed.items,
    scores: composed.scores,
    explanation: explain(composed, intent),
    name: buildName(composed, intent),
  }
}

function buildName(composed: ComposedOutfit, intent: StyleIntent): string {
  const anchor = composed.items.find((i) => i.role === 'dress' || i.role === 'top')?.item
  const base = anchor ? anchor.name : styleLabel(intent.style)
  return `${base} · ${occasionLabel(intent.occasion)}`
}

/**
 * Explicação determinística.
 * O usuário quer entender a escolha — não precisa de prosa gerada por modelo para isso.
 */
function explain(composed: ComposedOutfit, intent: StyleIntent): string {
  const parts: string[] = []
  const items = composed.items.map((i) => i.item)

  const shoes = composed.items.find((i) => i.role === 'shoes')?.item
  const anchor = composed.items.find((i) => i.role === 'dress' || i.role === 'top')?.item

  if (anchor) {
    parts.push(`Comecei pela ${anchor.name.toLowerCase()}, que atende bem a ${occasionLabel(intent.occasion).toLowerCase()}.`)
  }

  const neutrals = items.filter((i) => isNeutral(i.color))
  if (neutrals.length >= 2) {
    parts.push('A base neutra mantém o conjunto coeso e fácil de usar.')
  } else {
    const families = [...new Set(items.map((i) => colorFamily(i.color)))].filter((f) => f !== 'desconhecido')
    if (families.length <= 2) parts.push('A paleta ficou curta e alinhada, sem disputa entre as cores.')
  }

  if (shoes) {
    if (shoes.sport_type === 'tenis') {
      parts.push(`O ${shoes.name.toLowerCase()} é o calçado correto para quadra — solado e estabilidade certos.`)
    } else {
      parts.push(`Fechei com ${shoes.name.toLowerCase()}, que acompanha a formalidade do resto.`)
    }
  }

  const extras = composed.items.filter((i) => i.role === 'accessory' || i.role === 'bag')
  if (extras.length > 0) {
    parts.push(`Acrescentei ${extras.map((e) => e.item.name.toLowerCase()).join(' e ')} para completar sem pesar.`)
  }

  if (intent.notes.length > 0) parts.push(intent.notes[0])

  return parts.join(' ')
}
