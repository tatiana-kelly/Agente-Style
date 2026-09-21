import type { WardrobeItem } from '@/schemas/wardrobe'
import type { GarmentArchetype } from '@/schemas/formula'

/**
 * Traduz a peça real do guarda-roupa para o arquétipo que as fórmulas usam.
 *
 * A subcategoria sozinha não basta: "saia" pode ser midi ou de quadra, e
 * "vestido" pode ser social ou de tênis. O que decide é subcategoria + esporte +
 * formalidade juntos.
 */
export function archetypesOf(item: WardrobeItem): GarmentArchetype[] {
  const sub = item.subcategory
  const sport = item.sport_type !== 'nenhum'
  const formal = item.formality >= 6
  const out: GarmentArchetype[] = []

  switch (sub) {
    case 'camisa':
      out.push('shirt', 'blouse')
      break
    case 'blusa':
      out.push('blouse')
      if (item.formality >= 7) out.push('statement_top')
      break
    case 'camiseta':
      out.push('tshirt')
      break
    case 'polo':
      out.push('polo', 'tshirt')
      break
    case 'regata':
      out.push('tank', sport ? 'sport_top' : 'tshirt')
      break
    case 'top-esportivo':
      out.push('sport_top', 'tank')
      break
    case 'sueter':
      out.push('knit')
      break

    case 'calca':
      // Alfaiataria x jeans: a formalidade é o que separa.
      out.push(formal ? 'tailored_trousers' : 'jeans', 'wide_leg_trousers')
      if (!formal) out.push('tailored_trousers')
      break
    case 'legging':
      out.push('leggings')
      break
    case 'shorts':
    case 'bermuda':
      out.push('shorts')
      break
    case 'skort':
      out.push('skort', 'skirt', 'shorts')
      break
    case 'saia':
      // Sem campo de comprimento no MVP: saia social é tratada como midi,
      // saia esportiva como saia de quadra.
      out.push('skirt')
      if (sport) out.push('skort')
      else out.push('midi_skirt', 'pleated_skirt')
      break

    case 'vestido':
      out.push(sport ? 'sport_dress' : 'dress')
      if (!sport) out.push('midi_dress')
      break
    case 'macacao':
      out.push('dress')
      break

    case 'blazer':
      out.push('blazer')
      break
    case 'cardiga':
      out.push('cardigan')
      break
    case 'jaqueta':
      out.push('jacket')
      break
    case 'corta-vento':
      out.push('windbreaker', 'jacket')
      break
    case 'casaco':
      out.push('coat', 'jacket')
      break

    case 'salto':
      out.push('heels', 'elegant_shoe')
      break
    case 'sapato':
      out.push('elegant_shoe', 'loafers')
      break
    case 'sapatilha':
      out.push('flats', 'elegant_shoe')
      break
    case 'sandalia':
      out.push('sandals')
      if (formal) out.push('elegant_shoe')
      break
    case 'bota':
      out.push('boots')
      break
    case 'tenis-tenis':
      out.push('tennis_shoes', 'sneakers')
      break
    case 'tenis-corrida':
      out.push('sneakers')
      break
    case 'tenis':
      out.push('sneakers')
      if (sport) out.push('tennis_shoes')
      break
    case 'chinelo':
      out.push('sandals')
      break

    case 'viseira':
      out.push('visor', 'cap')
      break
    case 'bone':
      out.push('cap', 'visor')
      break
    case 'relogio':
      out.push('watch')
      break
    case 'joia':
    case 'bijuteria':
      out.push('jewelry')
      break
    case 'cinto':
      out.push('belt')
      break
    case 'oculos':
      out.push('sunglasses')
      break

    case 'bolsa':
      out.push(formal ? 'structured_bag' : 'tote', 'tote')
      break
    case 'mochila':
      out.push('backpack')
      break
    case 'raqueteira':
      out.push('tennis_bag', 'backpack')
      break
    default:
      break
  }

  return [...new Set(out)]
}

/** A peça atende a algum dos arquétipos pedidos pelo slot? */
export function matchesSlot(item: WardrobeItem, archetypes: readonly GarmentArchetype[]): boolean {
  const mine = archetypesOf(item)
  return archetypes.some((a) => mine.includes(a))
}

/**
 * Quão bem a peça atende ao slot: 1 para o arquétipo preferido da fórmula,
 * caindo conforme a posição na lista. Serve para desempatar sem exigir IA.
 */
export function slotAffinity(item: WardrobeItem, archetypes: readonly GarmentArchetype[]): number {
  const mine = archetypesOf(item)
  const idx = archetypes.findIndex((a) => mine.includes(a))
  if (idx === -1) return 0
  return Number((1 - idx / Math.max(archetypes.length, 1)).toFixed(4))
}
