import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole, OutfitScores } from '@/schemas/outfit'
import { buildCandidatePool, type CandidateContext } from '@/lib/wardrobe/filters'
import { ruleFor } from '@/lib/wardrobe/style-rules'
import { colorPairScore } from '@/lib/wardrobe/colors'
import { scoreOutfit } from './scoring'

export interface ComposedOutfit {
  items: Array<{ item: WardrobeItem; role: OutfitRole }>
  scores: OutfitScores
  missingRoles: OutfitRole[]
}

export interface ComposeOptions extends CandidateContext {
  lockedItemIds?: string[]
  /** Quantas composições distintas devolver (1 principal + alternativas). */
  count?: number
}

/**
 * Monta as composições sem IA.
 * O modelo entra depois, para explicar e para desempatar — não para escolher peça.
 */
export function composeOutfits(items: WardrobeItem[], opts: ComposeOptions): ComposedOutfit[] {
  const { style, count = 3, lockedItemIds = [] } = opts
  const rule = ruleFor(style)
  const pool = buildCandidatePool(items, opts)
  const locked = items.filter((i) => lockedItemIds.includes(i.id))

  // Peça travada pelo usuário entra no pool do seu papel mesmo se o filtro a cortaria.
  for (const item of locked) {
    const role = item.category as OutfitRole
    pool.byRole[role] = [item, ...(pool.byRole[role] ?? []).filter((i) => i.id !== item.id)]
    pool.scores[item.id] ??= 0.7
  }

  const lockedRoles = new Set(locked.map((i) => i.category as OutfitRole))
  const skeletons = buildSkeletons(pool.byRole, rule.requiredRoles, lockedRoles)

  const combos: ComposedOutfit[] = []
  for (const skeleton of skeletons) {
    for (const base of enumerate(skeleton, pool.byRole, locked)) {
      const withExtras = addOptionalPieces(base, pool.byRole, rule.optionalRoles, pool.scores)
      const plain = withExtras.map((x) => x.item)
      combos.push({
        items: withExtras,
        scores: scoreOutfit(plain, style, opts.occasion),
        missingRoles: pool.missingRoles,
      })
    }
  }

  combos.sort((a, b) => b.scores.outfit_confidence - a.scores.outfit_confidence)
  return dedupe(combos).slice(0, count)
}

/** Vestido cobre top+bottom; senão top+bottom separados. */
function buildSkeletons(
  byRole: Record<OutfitRole, WardrobeItem[]>,
  required: readonly OutfitRole[],
  lockedRoles: Set<OutfitRole>,
): OutfitRole[][] {
  const base = required.filter((r) => r !== 'top' && r !== 'bottom')
  const skeletons: OutfitRole[][] = []

  const needsTorso = required.includes('top') || required.includes('bottom')
  if (!needsTorso) return [[...required]]

  if ((byRole.dress?.length ?? 0) > 0 && !lockedRoles.has('top') && !lockedRoles.has('bottom')) {
    skeletons.push(['dress', ...base])
  }
  if ((byRole.top?.length ?? 0) > 0 && (byRole.bottom?.length ?? 0) > 0) {
    skeletons.push(['top', 'bottom', ...base])
  }
  // Guarda-roupa incompleto ainda deve produzir algo utilizável.
  if (skeletons.length === 0) {
    skeletons.push(required.filter((r) => (byRole[r]?.length ?? 0) > 0))
  }
  return skeletons
}

const MAX_COMBOS = 400

function enumerate(
  roles: OutfitRole[],
  byRole: Record<OutfitRole, WardrobeItem[]>,
  locked: WardrobeItem[],
): Array<Array<{ item: WardrobeItem; role: OutfitRole }>> {
  let acc: Array<Array<{ item: WardrobeItem; role: OutfitRole }>> = [[]]

  for (const role of roles) {
    const lockedForRole = locked.find((i) => (i.category as OutfitRole) === role)
    const options = lockedForRole ? [lockedForRole] : (byRole[role] ?? []).slice(0, 4)
    if (options.length === 0) continue

    const next: typeof acc = []
    for (const partial of acc) {
      for (const item of options) {
        if (next.length >= MAX_COMBOS) break
        next.push([...partial, { item, role }])
      }
    }
    acc = next
  }
  return acc.filter((c) => c.length > 0)
}

/** Acessório/bolsa/casaco só entram se não estragarem a paleta. */
function addOptionalPieces(
  base: Array<{ item: WardrobeItem; role: OutfitRole }>,
  byRole: Record<OutfitRole, WardrobeItem[]>,
  optionalRoles: readonly OutfitRole[],
  scores: Record<string, number>,
): Array<{ item: WardrobeItem; role: OutfitRole }> {
  const result = [...base]
  const usedIds = new Set(base.map((b) => b.item.id))

  for (const role of optionalRoles) {
    if (role === 'outerwear') continue // casaco só com clima; não forçar no MVP
    const candidates = (byRole[role] ?? []).filter((i) => !usedIds.has(i.id))
    if (candidates.length === 0) continue

    const best = candidates
      .map((item) => {
        const harmony = Math.min(...result.map((r) => colorPairScore(r.item.color, item.color)))
        return { item, value: (scores[item.id] ?? 0.5) * 0.5 + harmony * 0.5 }
      })
      .sort((a, b) => b.value - a.value)[0]

    if (best && best.value >= 0.6) {
      result.push({ item: best.item, role })
      usedIds.add(best.item.id)
    }
  }
  return result
}

/** Duas composições com o mesmo conjunto de peças são a mesma composição. */
function dedupe(combos: ComposedOutfit[]): ComposedOutfit[] {
  const seen = new Set<string>()
  const out: ComposedOutfit[] = []
  for (const c of combos) {
    const key = c.items.map((i) => i.item.id).sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}
