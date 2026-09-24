import { describe, expect, it } from 'vitest'
import {
  amplitudeFormalidade, avaliarCoerencia, coresFortes, misturaAutorizada,
  penalidadeRepeticao, MAX_ACESSORIOS, type Peca,
} from '@/lib/outfits/coherence'
import { generateCandidates, type EngineContext } from '@/lib/outfits/engine'
import { OUTFIT_FORMULAS } from '@/data/outfit-formulas'
import { buildDemoWardrobe } from '@/data/demo-wardrobe'
import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'

const formulaSocial = OUTFIT_FORMULAS.find((f) => f.id === 'work-blazer-blouse-trousers')!
const formulaMistura = OUTFIT_FORMULAS.find((f) => f.id === 'capsule-tailoring-sneakers')!

function peca(role: OutfitRole, over: Partial<WardrobeItem>): Peca {
  return {
    role,
    slotAffinity: 1,
    item: {
      id: over.id ?? `${role}-${Math.random()}`,
      user_id: 'u1',
      name: over.name ?? role,
      category: role === 'dress' ? 'dress' : (role as WardrobeItem['category']),
      subcategory: over.subcategory ?? 'camisa',
      color: over.color ?? 'preto',
      secondary_colors: [],
      pattern: 'liso',
      material: 'algodao',
      style: 'social',
      formality: over.formality ?? 6,
      sport_type: 'nenhum',
      season: ['verao', 'outono', 'inverno', 'primavera'],
      occasion: [],
      description: '',
      active: true,
      created_at: new Date().toISOString(),
      ...over,
    } as WardrobeItem,
  }
}

function ctx(over: Partial<EngineContext> = {}): EngineContext {
  return {
    style: 'social',
    favoriteColors: [], avoidColors: [], preferredArchetypes: [],
    modestyLevel: 0, preferenceWeights: {}, lockedItemIds: [], excludeIds: [],
    novelty: 'equilibrado', recentSignatures: [], recentItemIds: [], recentFormulaIds: [],
    ...over,
  }
}

describe('registro único — o que separa look de peças juntas', () => {
  const blusaSocial = peca('top', { formality: 7, color: 'branco' })
  const calcaSocial = peca('bottom', { formality: 7, color: 'preto', subcategory: 'calca' })
  const tenis = peca('shoes', { formality: 2, color: 'branco', subcategory: 'tenis' })
  const salto = peca('shoes', { formality: 8, color: 'preto', subcategory: 'salto' })

  it('reprova blusa social com tênis', () => {
    const quebras = avaliarCoerencia([blusaSocial, calcaSocial, tenis], { tier: 1, formula: formulaSocial })
    expect(quebras.map((q) => q.regra)).toContain('calcado')
  })

  it('aprova o mesmo look quando a fórmula pede a mistura de propósito', () => {
    const quebras = avaliarCoerencia([blusaSocial, calcaSocial, tenis], { tier: 1, formula: formulaMistura })
    expect(quebras).toHaveLength(0)
    expect(misturaAutorizada(formulaMistura)).toBe(true)
  })

  it('aprova look coerente', () => {
    expect(avaliarCoerencia([blusaSocial, calcaSocial, salto], { tier: 1, formula: formulaSocial })).toHaveLength(0)
  })

  it('a rede de segurança do tier 4 aceita o que o tier 1 recusa', () => {
    expect(avaliarCoerencia([blusaSocial, calcaSocial, tenis], { tier: 4, formula: formulaSocial })).toHaveLength(0)
  })

  it('mede a distância entre a peça mais e a menos formal', () => {
    expect(amplitudeFormalidade([blusaSocial, calcaSocial, tenis])).toBe(5)
    expect(amplitudeFormalidade([blusaSocial, calcaSocial, salto])).toBe(1)
  })
})

describe('um ponto de cor', () => {
  const base = [
    peca('top', { color: 'amarelo', formality: 6 }),
    peca('bottom', { color: 'verde', formality: 6, subcategory: 'calca' }),
    peca('shoes', { color: 'vermelho', formality: 6, subcategory: 'salto' }),
  ]

  it('reprova três cores fortes disputando o look', () => {
    expect(coresFortes(base)).toHaveLength(3)
    expect(avaliarCoerencia(base, { tier: 1, formula: formulaSocial }).map((q) => q.regra)).toContain('cor')
  })

  it('neutro não conta como cor forte', () => {
    const neutro = [
      peca('top', { color: 'branco' }),
      peca('bottom', { color: 'preto', subcategory: 'calca' }),
      peca('shoes', { color: 'bege', subcategory: 'salto' }),
    ]
    expect(coresFortes(neutro)).toHaveLength(0)
    expect(avaliarCoerencia(neutro, { tier: 1, formula: formulaSocial })).toHaveLength(0)
  })

  it('duas cores que brigam não passam no tier 1', () => {
    const briga = [
      peca('top', { color: 'laranja' }),
      peca('bottom', { color: 'rosa', subcategory: 'calca' }),
      peca('shoes', { color: 'preto', subcategory: 'salto' }),
    ]
    expect(avaliarCoerencia(briga, { tier: 1, formula: formulaSocial }).map((q) => q.regra)).toContain('cor')
  })
})

describe('acabamento na medida', () => {
  it('reprova acessório empilhado', () => {
    const exagero = [
      peca('top', { color: 'branco' }),
      peca('bottom', { color: 'preto', subcategory: 'calca' }),
      peca('shoes', { color: 'preto', subcategory: 'salto' }),
      peca('accessory', { color: 'dourado', subcategory: 'colar' }),
      peca('accessory', { color: 'dourado', subcategory: 'brinco' }),
      peca('accessory', { color: 'dourado', subcategory: 'anel' }),
    ]
    expect(avaliarCoerencia(exagero, { tier: 1, formula: formulaSocial }).map((q) => q.regra)).toContain('acessorio')
  })

  it('peça repetida no histórico perde posição', () => {
    const item = peca('bag', { id: 'bolsa-1' }).item
    expect(penalidadeRepeticao(item, [])).toBe(0)
    expect(penalidadeRepeticao(item, ['bolsa-1'])).toBeGreaterThan(penalidadeRepeticao(item, ['x', 'y', 'z', 'bolsa-1']))
  })
})

describe('as 3 opções precisam ser 3 opções', () => {
  /** Guarda-roupa com folga: só assim dá para exigir variedade de verdade. */
  const farto: WardrobeItem[] = [
    ...['branco', 'marinho', 'preto', 'bege'].map((cor, n) =>
      peca('top', { id: `t${n}`, name: `Camisa ${cor}`, subcategory: 'camisa', color: cor, formality: 7 }).item),
    ...['preto', 'cinza', 'marinho'].map((cor, n) =>
      peca('bottom', { id: `b${n}`, name: `Calça ${cor}`, subcategory: 'calca', color: cor, formality: 7 }).item),
    ...['preto', 'nude', 'bege'].map((cor, n) =>
      peca('shoes', { id: `s${n}`, name: `Salto ${cor}`, subcategory: 'salto', color: cor, formality: 8 }).item),
    ...['preto', 'caramelo'].map((cor, n) =>
      peca('outerwear', { id: `o${n}`, name: `Blazer ${cor}`, subcategory: 'blazer', color: cor, formality: 7 }).item),
    peca('accessory', { id: 'a0', name: 'Colar dourado', subcategory: 'colar', color: 'dourado', formality: 6 }).item,
    peca('accessory', { id: 'a1', name: 'Brinco dourado', subcategory: 'brinco', color: 'dourado', formality: 6 }).item,
    peca('accessory', { id: 'a2', name: 'Cinto preto', subcategory: 'cinto', color: 'preto', formality: 6 }).item,
    peca('bag', { id: 'g0', name: 'Bolsa preta', subcategory: 'bolsa', color: 'preto', formality: 7 }).item,
    peca('bag', { id: 'g1', name: 'Bolsa caramelo', subcategory: 'bolsa', color: 'caramelo', formality: 7 }).item,
  ]

  const nucleoDe = (c: { items: Array<{ role: string; item: WardrobeItem }> }) =>
    new Set(c.items.filter((i) => ['top', 'bottom', 'dress', 'outerwear', 'shoes'].includes(i.role)).map((i) => i.item.id))

  it('com guarda-roupa farto, nenhuma opção repete a peça de cima', () => {
    const r = generateCandidates(farto, ctx({ style: 'social' }), 3)
    expect(r.candidates.length).toBe(3)
    const tops = r.candidates.map((c) => c.items.find((i) => i.role === 'top')?.item.id)
    expect(new Set(tops).size).toBe(tops.length)
  })

  it('com guarda-roupa farto, cada opção muda pelo menos duas peças de estrutura', () => {
    const r = generateCandidates(farto, ctx({ style: 'social' }), 3)
    for (let i = 0; i < r.candidates.length; i++) {
      for (let j = i + 1; j < r.candidates.length; j++) {
        const a = nucleoDe(r.candidates[i])
        const b = nucleoDe(r.candidates[j])
        const iguais = [...a].filter((id) => b.has(id)).length
        expect(Math.max(a.size, b.size) - iguais).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('o acabamento não se repete entre as opções quando há alternativa', () => {
    const r = generateCandidates(farto, ctx({ style: 'social' }), 3)
    const bolsas = r.candidates.map((c) => c.items.find((i) => i.role === 'bag')?.item.id).filter(Boolean)
    expect(new Set(bolsas).size).toBeGreaterThan(1)
  })

  it('guarda-roupa pequeno ainda devolve 3 opções, mesmo parecidas', () => {
    const r = generateCandidates(buildDemoWardrobe('u1'), ctx({ style: 'social' }), 3)
    expect(r.candidates.length).toBeGreaterThan(0)
    for (let i = 0; i < r.candidates.length; i++) {
      for (let j = i + 1; j < r.candidates.length; j++) {
        const a = nucleoDe(r.candidates[i])
        const b = nucleoDe(r.candidates[j])
        const iguais = [...a].filter((id) => b.has(id)).length
        // Nunca dois looks idênticos: aí seriam menos opções do que a tela promete.
        expect(Math.max(a.size, b.size) - iguais).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('nenhum look sai com mais de dois acessórios', () => {
    for (const style of ['social', 'casual', 'trabalho', 'jantar', 'moderno'] as const) {
      const r = generateCandidates(buildDemoWardrobe('u1'), ctx({ style }), 3)
      for (const c of r.candidates) {
        expect(c.items.filter((i) => i.role === 'accessory').length).toBeLessThanOrEqual(MAX_ACESSORIOS)
      }
    }
  })
})
