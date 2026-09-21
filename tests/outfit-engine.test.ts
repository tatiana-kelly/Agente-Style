import { describe, expect, it } from 'vitest'
import { generateCandidates, type EngineContext, type OutfitCandidate } from '@/lib/outfits/engine'
import { buildDemoWardrobe } from '@/data/demo-wardrobe'
import { OUTFIT_FORMULAS, formulasFor } from '@/data/outfit-formulas'
import type { WardrobeItem } from '@/schemas/wardrobe'

const items = buildDemoWardrobe('u1')
const byName = (name: string) => items.find((i) => i.name === name)!

function ctx(over: Partial<EngineContext> = {}): EngineContext {
  return {
    style: 'casual',
    favoriteColors: [], avoidColors: [], preferredArchetypes: [],
    modestyLevel: 0, preferenceWeights: {}, lockedItemIds: [], excludeIds: [],
    novelty: 'equilibrado', recentSignatures: [], recentItemIds: [], recentFormulaIds: [],
    ...over,
  }
}

/** Um look precisa vestir a pessoa: vestido, ou cima E baixo. */
function cobreOCorpo(c: OutfitCandidate): boolean {
  const roles = new Set(c.items.map((i) => i.role))
  return roles.has('dress') || (roles.has('top') && roles.has('bottom'))
}

describe('biblioteca de fórmulas', () => {
  it('tem pelo menos 50 fórmulas ativas', () => {
    expect(OUTFIT_FORMULAS.filter((f) => f.active).length).toBeGreaterThanOrEqual(50)
  })

  it('toda fórmula declara a origem da regra', () => {
    for (const f of OUTFIT_FORMULAS) {
      expect(f.source_reference.length).toBeGreaterThan(3)
    }
  })

  it('todo estilo tem ao menos uma fórmula', () => {
    for (const style of ['trabalho', 'igreja', 'tenis', 'casual', 'jantar', 'viagem', 'evento'] as const) {
      expect(formulasFor(style).length).toBeGreaterThan(0)
    }
  })
})

describe('contextos obrigatórios (§30)', () => {
  const casos = [
    { style: 'igreja', occasion: 'igreja' },
    { style: 'trabalho', occasion: 'trabalho' },
    { style: 'tenis', occasion: 'partida-tenis' },
    { style: 'casual', occasion: 'dia-comum' },
    { style: 'jantar', occasion: 'jantar' },
    { style: 'viagem', occasion: 'viagem' },
  ] as const

  for (const caso of casos) {
    it(`${caso.style} + ${caso.occasion} devolve look completo`, () => {
      const r = generateCandidates(items, ctx(caso), 3)
      expect(r.candidates.length).toBeGreaterThan(0)
      for (const c of r.candidates) expect(cobreOCorpo(c)).toBe(true)
      expect(r.candidates[0].items.some((i) => i.role === 'shoes')).toBe(true)
    })
  }

  it('igreja respeita modéstia: nada de shorts, regata ou top esportivo', () => {
    const r = generateCandidates(items, ctx({ style: 'igreja', occasion: 'igreja', modestyLevel: 2 }), 3)
    for (const c of r.candidates) {
      for (const { item } of c.items) {
        expect(['shorts', 'top-esportivo', 'regata']).not.toContain(item.subcategory)
      }
    }
  })

  it('tênis nunca recebe salto ou blazer', () => {
    const r = generateCandidates(items, ctx({ style: 'tenis', occasion: 'partida-tenis' }), 3)
    for (const c of r.candidates) {
      for (const { item } of c.items) {
        expect(['salto', 'blazer', 'scarpin']).not.toContain(item.subcategory)
        expect(item.formality).toBeLessThan(6)
      }
    }
  })

  it('trabalho social mantém formalidade alta', () => {
    const r = generateCandidates(items, ctx({ style: 'trabalho', occasion: 'trabalho', formalityOverride: [6, 9] }), 3)
    const top = r.candidates[0]
    const media = top.items.reduce((s, i) => s + i.item.formality, 0) / top.items.length
    expect(media).toBeGreaterThanOrEqual(5.5)
  })
})

describe('REGRESSÃO: look incompleto (bug corrigido)', () => {
  // Guarda-roupa onde a única parte de baixo é formal demais para o estilo pedido.
  const pequeno = [
    byName('Camiseta preta básica'),
    byName('Camisa branca de algodão'),
    byName('Calça alfaiataria preta'),
    byName('Tênis branco casual'),
    byName('Scarpin nude'),
  ]

  it('nunca devolve look sem parte de baixo', () => {
    const r = generateCandidates(pequeno, ctx({ style: 'casual' }), 3)
    expect(r.candidates.length).toBeGreaterThan(0)
    for (const c of r.candidates) {
      expect(c.items.some((i) => i.role === 'bottom')).toBe(true)
    }
  })

  it('relaxa a formalidade em vez de descartar o papel obrigatório', () => {
    const r = generateCandidates(pequeno, ctx({ style: 'casual' }), 3)
    // A calça formal só entra porque o motor desceu de camada.
    expect(r.tierUsed).toBeGreaterThan(1)
    expect(r.candidates[0].items.some((i) => i.item.name === 'Calça alfaiataria preta')).toBe(true)
  })

  it('guarda-roupa só com tops não inventa um look', () => {
    const soTops = items.filter((i) => i.category === 'top')
    const r = generateCandidates(soTops, ctx({ style: 'casual' }), 3)
    expect(r.candidates).toHaveLength(0)
    // E diz o que falta, em vez de um erro genérico.
    expect(r.missingRoles).toContain('bottom')
    expect(r.missingRoles).toContain('shoes')
  })

  it('sem calçado nenhum, avisa em vez de montar meio look', () => {
    const semCalcado = items.filter((i) => i.category !== 'shoes')
    const r = generateCandidates(semCalcado, ctx({ style: 'trabalho' }), 3)
    if (r.candidates.length === 0) {
      expect(r.missingRoles).toContain('shoes')
    } else {
      for (const c of r.candidates) expect(cobreOCorpo(c)).toBe(true)
    }
  })
})

describe('cenários de guarda-roupa', () => {
  it('guarda-roupa grande devolve 3 alternativas distintas', () => {
    const r = generateCandidates(items, ctx({ style: 'trabalho', occasion: 'trabalho' }), 3)
    expect(r.candidates).toHaveLength(3)
    const assinaturas = r.candidates.map((c) => c.items.map((i) => i.item.id).sort().join('|'))
    expect(new Set(assinaturas).size).toBe(3)
  })

  it('sem fórmula exata, cai para camada seguinte em vez de falhar', () => {
    // Estilo de tênis com guarda-roupa exclusivamente social.
    const social = items.filter((i) => i.formality >= 6)
    const r = generateCandidates(social, ctx({ style: 'casual' }), 3)
    expect(r.tierUsed).toBeGreaterThanOrEqual(1)
    if (r.candidates.length > 0) expect(cobreOCorpo(r.candidates[0])).toBe(true)
  })

  it('respeita peça travada pelo usuário', () => {
    const skort = byName('Skort branco de tênis')
    const r = generateCandidates(items, ctx({ style: 'tenis', lockedItemIds: [skort.id] }), 3)
    for (const c of r.candidates) {
      expect(c.items.some((i) => i.item.id === skort.id)).toBe(true)
    }
  })

  it('não reaproveita peça excluída', () => {
    const tenisQuadra = byName('Tênis de quadra branco')
    const r = generateCandidates(items, ctx({ style: 'tenis', excludeIds: [tenisQuadra.id] }), 3)
    for (const c of r.candidates) {
      expect(c.items.some((i) => i.item.id === tenisQuadra.id)).toBe(false)
    }
  })

  it('evita repetir um look já usado', () => {
    const primeiro = generateCandidates(items, ctx({ style: 'trabalho' }), 1)
    const assinatura = primeiro.candidates[0].items.map((i) => i.item.id).sort().join('|')

    const segundo = generateCandidates(items, ctx({ style: 'trabalho', recentSignatures: [assinatura] }), 3)
    for (const c of segundo.candidates) {
      expect(c.items.map((i) => i.item.id).sort().join('|')).not.toBe(assinatura)
    }
  })

  it('preferência do usuário empurra a peça favorita para cima', () => {
    const blusa = byName('Blusa de seda marinho')
    const semPref = generateCandidates(items, ctx({ style: 'trabalho' }), 3)
    const comPref = generateCandidates(
      items,
      ctx({ style: 'trabalho', preferenceWeights: { [blusa.id]: 1 }, favoriteColors: ['marinho'] }),
      3,
    )
    const usaBlusa = (r: typeof semPref) => r.candidates.some((c) => c.items.some((i) => i.item.id === blusa.id))
    expect(usaBlusa(comPref) || !usaBlusa(semPref)).toBe(true)
  })

  it('cor a evitar derruba a nota de preferência', () => {
    const r = generateCandidates(items, ctx({ style: 'trabalho', avoidColors: ['preto'] }), 3)
    expect(r.candidates.length).toBeGreaterThan(0)
    const top = r.candidates[0]
    expect(top.scores.user_preference_match).toBeLessThanOrEqual(1)
  })
})

describe('performance', () => {
  it('monta em tempo aceitável mesmo com guarda-roupa grande', () => {
    const grande: WardrobeItem[] = []
    for (let i = 0; i < 6; i++) {
      grande.push(...items.map((it) => ({ ...it, id: `${it.id}-${i}` })))
    }
    const t0 = Date.now()
    const r = generateCandidates(grande, ctx({ style: 'trabalho', occasion: 'trabalho' }), 3)
    expect(Date.now() - t0).toBeLessThan(3000)
    expect(r.candidates.length).toBeGreaterThan(0)
  })
})
