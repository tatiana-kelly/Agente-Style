import { describe, expect, it } from 'vitest'
import { colorFamily, colorPairScore, isNeutral, normalizeColor, paletteScore } from '@/lib/wardrobe/colors'

describe('normalização de cor', () => {
  it('ignora acento, caixa e espaço', () => {
    expect(normalizeColor(' Azul Marinho ')).toBe('azul-marinho')
    expect(normalizeColor('SALMÃO')).toBe('salmao')
  })

  it('reconhece família pelo primeiro token conhecido', () => {
    expect(colorFamily('verde-oliva')).toBe('verde')
    expect(colorFamily('azul claro')).toBe('azul')
  })

  it('trata cor desconhecida sem quebrar', () => {
    expect(colorFamily('pantone-448c')).toBe('desconhecido')
  })
})

describe('harmonia', () => {
  it('considera marinho um neutro', () => {
    expect(isNeutral('marinho')).toBe(true)
  })

  it('dá nota máxima quando há neutro no par', () => {
    expect(colorPairScore('preto', 'vermelho')).toBe(1)
  })

  it('penaliza combinação conflitante', () => {
    expect(colorPairScore('vermelho', 'rosa')).toBeLessThan(0.4)
  })

  it('paleta com um conflito grave pontua menos que paleta neutra', () => {
    const neutra = paletteScore(['preto', 'branco', 'cinza'])
    const conflito = paletteScore(['vermelho', 'rosa', 'laranja'])
    expect(neutra).toBeGreaterThan(conflito)
    expect(conflito).toBeLessThan(0.5)
  })

  it('peça única sempre harmoniza consigo mesma', () => {
    expect(paletteScore(['verde'])).toBe(1)
  })
})
