import { describe, expect, it } from 'vitest'
import { buildCandidatePool, isEligible, roleForItem } from '@/lib/wardrobe/filters'
import { ruleFor } from '@/lib/wardrobe/style-rules'
import { buildDemoWardrobe } from '@/data/demo-wardrobe'

const items = buildDemoWardrobe('u1')
const byName = (name: string) => items.find((i) => i.name === name)!

describe('elegibilidade por estilo', () => {
  it('rejeita salto em look de tênis', () => {
    expect(isEligible(byName('Scarpin nude'), ruleFor('tenis'), { style: 'tenis' })).toBe(false)
  })

  it('rejeita legging em look social', () => {
    expect(isEligible(byName('Legging preta'), ruleFor('social'), { style: 'social' })).toBe(false)
  })

  it('aceita skort de tênis em look de tênis', () => {
    expect(isEligible(byName('Skort branco de tênis'), ruleFor('tenis'), { style: 'tenis' })).toBe(true)
  })

  it('aceita blazer em look de trabalho', () => {
    expect(isEligible(byName('Blazer preto estruturado'), ruleFor('trabalho'), { style: 'trabalho' })).toBe(true)
  })

  it('exclui peça pedida explicitamente na lista de exclusão', () => {
    const skort = byName('Skort branco de tênis')
    expect(isEligible(skort, ruleFor('tenis'), { style: 'tenis', excludeIds: [skort.id] })).toBe(false)
  })
})

describe('pool de candidatos', () => {
  it('mapeia categoria para papel', () => {
    expect(roleForItem(byName('Calça jeans reta'))).toBe('bottom')
  })

  it('limita o número de candidatos por papel para conter custo', () => {
    const pool = buildCandidatePool(items, { style: 'casual' }, 2)
    for (const list of Object.values(pool.byRole)) {
      expect(list.length).toBeLessThanOrEqual(2)
    }
  })

  it('para tênis, só sobram peças de quadra ou neutras informais', () => {
    const pool = buildCandidatePool(items, { style: 'tenis' })
    const shoes = pool.byRole.shoes ?? []
    expect(shoes.length).toBeGreaterThan(0)
    expect(shoes.every((s) => s.formality <= 4)).toBe(true)
    expect(shoes.some((s) => s.subcategory === 'tenis-tenis')).toBe(true)
  })

  it('acusa papel faltante quando não há calçado elegível', () => {
    const semCalcado = items.filter((i) => i.category !== 'shoes')
    const pool = buildCandidatePool(semCalcado, { style: 'social' })
    expect(pool.missingRoles).toContain('shoes')
  })
})
