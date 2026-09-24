import { describe, expect, it } from 'vitest'
import { sugerirCompra } from '@/lib/outfits/wishlist'
import { OUTFIT_FORMULAS } from '@/data/outfit-formulas'
import { item } from './helpers/wardrobe-benchmark'
import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'

const formulaSocial = OUTFIT_FORMULAS.find((f) => f.id === 'ref-terninho-classico')!
const formulaCasual = OUTFIT_FORMULAS.find((f) => f.id === 'ref-casual-chic')!

const peca = (role: OutfitRole, i: WardrobeItem) => ({ role, item: i, slotAffinity: 1 })

const camisa = item({ id: 'camisa', category: 'top', subcategory: 'camisa', color: 'branco', formality: 7 })
const calca = item({ id: 'calca', category: 'bottom', subcategory: 'calca', color: 'bege', formality: 7 })
const salto = item({ id: 'salto', category: 'shoes', subcategory: 'salto', color: 'preto', formality: 8 })
const bolsa = item({ id: 'bolsa', category: 'bag', subcategory: 'bolsa', color: 'preto', formality: 7 })
const cinto = item({ id: 'cinto', category: 'accessory', subcategory: 'cinto', color: 'caramelo', formality: 5 })
const brinco = item({ id: 'brinco', category: 'accessory', subcategory: 'brinco', color: 'dourado', formality: 6 })

const look = [peca('top', camisa), peca('bottom', calca), peca('shoes', salto)]

describe('esse look pede isso aqui', () => {
  it('sugere cinto quando o guarda-roupa não tem nenhum', () => {
    const s = sugerirCompra(look, [camisa, calca, salto], formulaSocial)
    expect(s?.peca).toContain('cinto')
    expect(s?.motivo.length).toBeGreaterThan(10)
    expect(s?.termoDeBusca).toContain('cinto')
  })

  it('sugere na cor que combina com a base do look', () => {
    const s = sugerirCompra(look, [camisa, calca, salto], formulaSocial)
    // base bege pede acessório caramelo, não preto
    expect(s?.peca).toContain('caramelo')
  })

  it('não repete sugestão de peça que ela já tem', () => {
    const acervo = [camisa, calca, salto, cinto, bolsa, brinco]
    const s = sugerirCompra([...look, peca('bag', bolsa)], acervo, formulaSocial)
    expect(s?.peca).not.toContain('cinto')
    expect(s?.peca).not.toContain('bolsa')
    expect(s?.peca).not.toContain('brinco')
  })

  it('sugere scarpin nude para look social sem calçado claro', () => {
    const acervo = [camisa, calca, salto, cinto, bolsa, brinco]
    const s = sugerirCompra([...look, peca('bag', bolsa)], acervo, formulaSocial)
    expect(s?.peca).toContain('nude')
  })

  it('look casual sem terceira peça pede casaquinho, não blazer', () => {
    const casual = [
      peca('top', item({ id: 't', category: 'top', subcategory: 'camiseta', color: 'branco', formality: 3 })),
      peca('bottom', item({ id: 'j', category: 'bottom', subcategory: 'calca', color: 'jeans', formality: 3 })),
      peca('shoes', item({ id: 'te', category: 'shoes', subcategory: 'tenis', color: 'branco', formality: 3 })),
      peca('bag', bolsa),
    ]
    const acervo = [...casual.map((p) => p.item), cinto, brinco]
    const s = sugerirCompra(casual, acervo, formulaCasual)
    expect(s?.peca).toMatch(/casaquinho|lenço/)
  })

  it('devolve null quando não há o que sugerir', () => {
    const completo = [
      ...look,
      peca('bag', bolsa),
      peca('accessory', cinto),
      peca('accessory', brinco),
    ]
    const acervo = [
      ...completo.map((p) => p.item),
      item({ id: 'nude', category: 'shoes', subcategory: 'salto', color: 'nude', formality: 8 }),
      item({ id: 'lenco', category: 'accessory', subcategory: 'lenco', color: 'estampado', formality: 5 }),
      item({ id: 'blazer', category: 'outerwear', subcategory: 'blazer', color: 'preto', formality: 7 }),
      item({ id: 'colete', category: 'outerwear', subcategory: 'colete', color: 'cru', formality: 6 }),
      item({ id: 'oculos', category: 'accessory', subcategory: 'oculos', color: 'preto', formality: 4 }),
    ]
    expect(sugerirCompra(completo, acervo, formulaSocial)).toBeNull()
  })
})
