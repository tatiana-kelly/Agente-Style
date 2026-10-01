import { describe, expect, it } from 'vitest'
import { faltantes, parseRefinement } from '@/agents/style-agent/refine'
import { generateCandidates, type EngineContext } from '@/lib/outfits/engine'
import { buildDemoWardrobe } from '@/data/demo-wardrobe'
import type { WardrobeItem } from '@/schemas/wardrobe'

const items = buildDemoWardrobe('u1')
const byName = (n: string) => items.find((i) => i.name === n)!

describe('ajuste escrito à mão (§3)', () => {
  it('"inclua bolsa" acha a bolsa do guarda-roupa', () => {
    const r = parseRefinement('inclua bolsa', items)
    expect(r.includeIds).toContain(byName('Bolsa estruturada preta').id)
    expect(r.unresolved).toBe(false)
  })

  it('"tira a bolsa" exclui em vez de incluir', () => {
    const r = parseRefinement('tira a bolsa', items)
    expect(r.excludeIds).toContain(byName('Bolsa estruturada preta').id)
    expect(r.includeIds).toHaveLength(0)
  })

  it('"troca o scarpin pela sapatilha" tira um e põe o outro', () => {
    const r = parseRefinement('troca o scarpin pela sapatilha', items)
    expect(r.excludeIds).toContain(byName('Scarpin nude').id)
    expect(r.includeIds).toContain(byName('Sapatilha preta').id)
  })

  it('casa por cor além da peça', () => {
    const r = parseRefinement('inclua calça preta', items)
    expect(r.includeIds).toContain(byName('Calça alfaiataria preta').id)
  })

  it('entende dois pedidos na mesma frase', () => {
    const r = parseRefinement('inclua blazer e tira a bolsa', items)
    expect(r.includeIds).toContain(byName('Blazer preto estruturado').id)
    expect(r.excludeIds).toContain(byName('Bolsa estruturada preta').id)
  })

  it('não adivinha quando não há peça nem cor', () => {
    const r = parseRefinement('deixa mais bonito', items)
    expect(r.unresolved).toBe(true)
    expect(r.includeIds).toHaveLength(0)
    expect(r.excludeIds).toHaveLength(0)
  })

  it('texto vazio não muda nada', () => {
    const r = parseRefinement('', items)
    expect(r.unresolved).toBe(false)
    expect(r.includeIds).toHaveLength(0)
  })

  it('aponta o que o guarda-roupa não tem, em vez de ignorar', () => {
    const faltas = faltantes('inclua sapato vermelho e cinto vermelho', items)
    expect(faltas.length).toBeGreaterThan(0)
  })

  it('não reclama de peça que existe', () => {
    expect(faltantes('inclua bolsa', items)).toHaveLength(0)
  })
})

function ctx(over: Partial<EngineContext> = {}): EngineContext {
  return {
    style: 'trabalho',
    favoriteColors: [], avoidColors: [], preferredArchetypes: [],
    modestyLevel: 0, preferenceWeights: {}, lockedItemIds: [], excludeIds: [],
    novelty: 'equilibrado', recentSignatures: [], recentItemIds: [], recentFormulaIds: [],
    ...over,
  }
}

describe('acessórios no look (§1)', () => {
  it('todo look sai com cinto, bolsa e sapato — e sem joia por enquanto', () => {
    // Regra dela: cinto, bolsa e sapato em tudo. Joias ficam de fora até ela
    // cadastrar as de verdade.
    const r = generateCandidates(items, ctx(), 3)
    expect(r.candidates.length).toBeGreaterThan(0)
    // O guarda-roupa demo tem bolsa mas não tem cinto: o cinto só pode ser
    // exigido quando existe — quando não existe, vira sugestão de compra.
    const temCinto = items.some((i) => i.subcategory === 'cinto')
    for (const c of r.candidates) {
      expect(c.items.some((i) => i.role === 'shoes')).toBe(true)
      expect(c.items.some((i) => i.role === 'bag')).toBe(true)
      expect(c.items.some((i) => i.item.subcategory === 'cinto')).toBe(temCinto)
      expect(c.items.some((i) => ['colar', 'brinco', 'anel', 'joia', 'bijuteria'].includes(i.item.subcategory))).toBe(false)
    }
  })

  it('peça travada pelo ajuste sempre entra', () => {
    const blazer = byName('Blazer preto estruturado')
    const r = generateCandidates(items, ctx({ lockedItemIds: [blazer.id] }), 3)
    for (const c of r.candidates) {
      expect(c.items.some((i) => i.item.id === blazer.id)).toBe(true)
    }
  })

  it('não empilha dois acessórios da mesma família', () => {
    const comJoias: WardrobeItem[] = [
      ...items,
      { ...byName('Relógio prateado'), id: 'colar-1', name: 'Colar dourado', subcategory: 'colar', color: 'dourado' },
      { ...byName('Relógio prateado'), id: 'colar-2', name: 'Colar prateado', subcategory: 'colar', color: 'prata' },
    ]
    const r = generateCandidates(comJoias, ctx(), 3)
    for (const c of r.candidates) {
      const colares = c.items.filter((i) => i.item.subcategory === 'colar')
      expect(colares.length).toBeLessThanOrEqual(1)
    }
  })

  it('no máximo três acessórios por look', () => {
    const r = generateCandidates(items, ctx(), 3)
    for (const c of r.candidates) {
      expect(c.items.filter((i) => i.role === 'accessory').length).toBeLessThanOrEqual(3)
    }
  })
})
