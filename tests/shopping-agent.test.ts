import { describe, expect, it } from 'vitest'
import { runShoppingAgent } from '@/agents/shopping-agent'
import { CENARIO_GUARDA_ROUPA, item } from './helpers/wardrobe-benchmark'
import type { WardrobeItem } from '@/schemas/wardrobe'

/** Guarda-roupa só de alfaiataria: falta saia, vestido e colete. */
const SO_CALCAS: WardrobeItem[] = [
  item({ id: 'camisa', name: 'Camisa branca', category: 'top', subcategory: 'camisa', color: 'branco', formality: 7 }),
  item({ id: 'blusa', name: 'Blusa creme', category: 'top', subcategory: 'blusa', color: 'creme', formality: 6 }),
  item({ id: 'calca', name: 'Calça de alfaiataria caramelo', category: 'bottom', subcategory: 'calca', color: 'caramelo', formality: 7 }),
  item({ id: 'salto', name: 'Scarpin nude', category: 'shoes', subcategory: 'salto', color: 'nude', formality: 8 }),
  item({ id: 'blazer', name: 'Blazer preto', category: 'outerwear', subcategory: 'blazer', color: 'preto', formality: 7 }),
]

describe('agente de compra — ancorado no que ela já tem', () => {
  const sugestoes = runShoppingAgent(SO_CALCAS, 3)

  it('sugere peça que ela não tem', () => {
    expect(sugestoes.length).toBeGreaterThan(0)
    for (const s of sugestoes) {
      expect(s.peca.length).toBeGreaterThan(3)
      expect(s.termoDeBusca.length).toBeGreaterThan(3)
    }
  })

  it('cada sugestão cita uma peça do guarda-roupa como âncora', () => {
    const ids = new Set(SO_CALCAS.map((i) => i.id))
    for (const s of sugestoes) {
      expect(ids.has(s.ancora.id)).toBe(true)
      expect(s.motivo).toContain(s.ancora.name.toLowerCase())
    }
  })

  it('diz qual look a compra destrava', () => {
    for (const s of sugestoes) expect(s.look.length).toBeGreaterThan(3)
  })

  it('sugere na cor da paleta dela, não em cor solta', () => {
    for (const s of sugestoes) expect(s.peca).toMatch(/caramelo|preto/)
  })

  it('não repete o mesmo tipo de peça', () => {
    const tipos = sugestoes.map((s) => s.peca.replace(/\s(caramelo|preto)$/, ''))
    expect(new Set(tipos).size).toBe(tipos.length)
  })

  it('guarda-roupa completo recebe menos sugestões que um incompleto', () => {
    const completo = runShoppingAgent(CENARIO_GUARDA_ROUPA, 3)
    expect(completo.length).toBeLessThanOrEqual(sugestoes.length)
  })

  it('guarda-roupa vazio não sugere nada', () => {
    expect(runShoppingAgent([], 3)).toEqual([])
  })
})
