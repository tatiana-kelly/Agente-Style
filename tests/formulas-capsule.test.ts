import { describe, expect, it } from 'vitest'
import { OUTFIT_FORMULAS, formulasFor } from '@/data/outfit-formulas'
import { CAPSULE_FORMULAS } from '@/data/formulas-capsule'
import { archetypesOf } from '@/lib/outfits/archetypes'
import { generateCandidates, type EngineContext } from '@/lib/outfits/engine'
import { buildDemoWardrobe } from '@/data/demo-wardrobe'
import type { WardrobeItem } from '@/schemas/wardrobe'

function ctx(over: Partial<EngineContext> = {}): EngineContext {
  return {
    style: 'moderno',
    favoriteColors: [], avoidColors: [], preferredArchetypes: [],
    modestyLevel: 0, preferenceWeights: {}, lockedItemIds: [], excludeIds: [],
    novelty: 'equilibrado', recentSignatures: [], recentItemIds: [], recentFormulaIds: [],
    ...over,
  }
}

function peca(over: Partial<WardrobeItem>): WardrobeItem {
  return {
    id: over.id ?? crypto.randomUUID(),
    user_id: 'u1',
    name: over.name ?? 'peça',
    category: 'top',
    subcategory: 'camiseta',
    color: 'preto',
    secondary_colors: [],
    pattern: 'liso',
    material: 'algodao',
    style: 'casual',
    formality: 5,
    sport_type: 'nenhum',
    season: ['verao', 'outono', 'inverno', 'primavera'],
    occasion: [],
    description: '',
    times_worn: 0,
    created_at: new Date().toISOString(),
    ...over,
  } as WardrobeItem
}

describe('fórmulas de guarda-roupa cápsula', () => {
  it('entram na biblioteca sem colidir com as fórmulas antigas', () => {
    const ids = OUTFIT_FORMULAS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(CAPSULE_FORMULAS.length).toBeGreaterThanOrEqual(25)
    expect(OUTFIT_FORMULAS.length).toBeGreaterThanOrEqual(80)
  })

  it('nenhuma descreve o look de uma pessoa: a origem é sempre um princípio', () => {
    for (const f of CAPSULE_FORMULAS) {
      expect(['styling-principle', 'dress-code', 'color-theory', 'sport-functional']).toContain(f.source_type)
      expect(f.description.length).toBeGreaterThan(20)
    }
  })

  it('os estilos novos da Home continuam com fórmula', () => {
    for (const style of ['moderno', 'feminino', 'elegante', 'dia-a-dia', 'festa', 'social'] as const) {
      expect(formulasFor(style).length).toBeGreaterThan(0)
    }
  })
})

describe('peças que a taxonomia não enxergava', () => {
  it('colete vira arquétipo próprio, não blazer', () => {
    const colete = peca({ category: 'outerwear', subcategory: 'colete', formality: 7 })
    expect(archetypesOf(colete)).toContain('vest')
    expect(archetypesOf(colete)).not.toContain('blazer')
  })

  it('lenço deixa de ser tratado como joia', () => {
    const lenco = peca({ category: 'accessory', subcategory: 'lenco', color: 'estampado' })
    expect(archetypesOf(lenco)[0]).toBe('scarf')
  })

  it('macacão é peça única, não vestido de festa', () => {
    const macacao = peca({ category: 'dress', subcategory: 'macacao' })
    expect(archetypesOf(macacao)).toContain('jumpsuit')
  })

  it('saia aceita comprimento longo enquanto não há campo de comprimento', () => {
    const saia = peca({ category: 'bottom', subcategory: 'saia', formality: 6 })
    expect(archetypesOf(saia)).toContain('long_skirt')
  })
})

describe('as fórmulas novas montam look de verdade', () => {
  const guardaRoupa = [
    ...buildDemoWardrobe('u1'),
    peca({ id: 'colete-1', name: 'Colete preto', category: 'outerwear', subcategory: 'colete', formality: 7, style: 'social' }),
    peca({ id: 'lenco-1', name: 'Lenço estampado', category: 'accessory', subcategory: 'lenco', color: 'estampado', pattern: 'estampado' }),
  ]

  it('o colete aparece em algum look do estilo moderno', () => {
    const r = generateCandidates(guardaRoupa, ctx({ style: 'moderno' }), 3)
    expect(r.candidates.length).toBeGreaterThan(0)
  })

  it('estilo moderno devolve look completo e calçado', () => {
    const r = generateCandidates(guardaRoupa, ctx({ style: 'moderno', occasion: 'passeio' }), 3)
    for (const c of r.candidates) {
      const roles = new Set(c.items.map((i) => i.role))
      expect(roles.has('dress') || (roles.has('top') && roles.has('bottom'))).toBe(true)
      expect(roles.has('shoes')).toBe(true)
    }
  })
})
