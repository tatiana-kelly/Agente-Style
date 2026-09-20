import { describe, expect, it } from 'vitest'
import { composeOutfits } from '@/lib/outfits/composer'
import { scoreOutfit, wardrobeMatchScore } from '@/lib/outfits/scoring'
import { buildDemoWardrobe } from '@/data/demo-wardrobe'

const items = buildDemoWardrobe('u1')
const byName = (name: string) => items.find((i) => i.name === name)!

describe('composição de look', () => {
  it('monta look de tênis com calçado de quadra', () => {
    const [look] = composeOutfits(items, { style: 'tenis', occasion: 'partida-tenis' })
    const shoes = look.items.find((i) => i.role === 'shoes')
    expect(shoes?.item.sport_type).toBe('tenis')
    expect(look.items.some((i) => i.role === 'top')).toBe(true)
    expect(look.items.some((i) => i.role === 'bottom')).toBe(true)
  })

  it('nunca coloca salto em look de tênis', () => {
    const looks = composeOutfits(items, { style: 'tenis', count: 3 })
    for (const look of looks) {
      expect(look.items.some((i) => i.item.subcategory === 'salto')).toBe(false)
    }
  })

  it('monta look social com formalidade alta', () => {
    const [look] = composeOutfits(items, { style: 'social', occasion: 'evento' })
    const média = look.items.reduce((s, i) => s + i.item.formality, 0) / look.items.length
    expect(média).toBeGreaterThanOrEqual(6)
  })

  it('devolve alternativas distintas entre si', () => {
    const looks = composeOutfits(items, { style: 'casual', count: 3 })
    const assinaturas = looks.map((l) => l.items.map((i) => i.item.id).sort().join('|'))
    expect(new Set(assinaturas).size).toBe(assinaturas.length)
  })

  it('respeita peça travada pelo usuário', () => {
    const skort = byName('Skort branco de tênis')
    const looks = composeOutfits(items, { style: 'tenis', lockedItemIds: [skort.id], count: 3 })
    for (const look of looks) {
      expect(look.items.some((i) => i.item.id === skort.id)).toBe(true)
    }
  })

  it('não reaproveita peça excluída na nova tentativa', () => {
    const tenisQuadra = byName('Tênis de quadra branco')
    const looks = composeOutfits(items, { style: 'tenis', excludeIds: [tenisQuadra.id], count: 3 })
    for (const look of looks) {
      expect(look.items.some((i) => i.item.id === tenisQuadra.id)).toBe(false)
    }
  })

  it('usa apenas peças que existem no guarda-roupa', () => {
    const ids = new Set(items.map((i) => i.id))
    const looks = composeOutfits(items, { style: 'trabalho', count: 3 })
    for (const look of looks) {
      for (const { item } of look.items) expect(ids.has(item.id)).toBe(true)
    }
  })

  it('devolve lista vazia quando não há nenhuma peça', () => {
    expect(composeOutfits([], { style: 'casual' })).toEqual([])
  })

  it('evita repetir a mesma peça em dois papéis', () => {
    const [look] = composeOutfits(items, { style: 'viagem' })
    const ids = look.items.map((i) => i.item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('score do look', () => {
  it('cobre todos os papéis obrigatórios quando o guarda-roupa permite', () => {
    const [look] = composeOutfits(items, { style: 'trabalho' })
    expect(wardrobeMatchScore(look.items.map((i) => i.item), 'trabalho')).toBe(1)
  })

  it('confiança fica entre 0 e 1', () => {
    const [look] = composeOutfits(items, { style: 'social' })
    const scores = scoreOutfit(look.items.map((i) => i.item), 'social', 'evento')
    expect(scores.outfit_confidence).toBeGreaterThan(0)
    expect(scores.outfit_confidence).toBeLessThanOrEqual(1)
  })

  it('look coerente pontua mais que mistura de formalidades extremas', () => {
    const coerente = [byName('Camisa branca de algodão'), byName('Calça alfaiataria preta'), byName('Scarpin nude')]
    const incoerente = [byName('Top esportivo branco'), byName('Calça alfaiataria preta'), byName('Scarpin nude')]
    expect(scoreOutfit(coerente, 'social', 'evento').style_score)
      .toBeGreaterThan(scoreOutfit(incoerente, 'social', 'evento').style_score)
  })
})
