import { describe, expect, it } from 'vitest'
import { analyzePalette, colorCompatibility, colorRelation, describeRelation } from '@/lib/outfits/color-engine'

describe('relação entre cores', () => {
  it('reconhece duplas clássicas', () => {
    expect(colorRelation('marinho', 'branco')).toBe('CLASSIC')
    expect(colorRelation('preto', 'branco')).toBe('CLASSIC')
    expect(colorRelation('camel', 'branco')).toBe('CLASSIC')
  })

  it('reconhece monocromático', () => {
    expect(colorRelation('preto', 'preto')).toBe('MONOCHROMATIC')
  })

  it('reconhece tonal dentro da mesma família', () => {
    // Cores diferentes da mesma família são TONAL; monocromático exige o mesmo nome.
    expect(colorRelation('vermelho', 'bordo')).toBe('TONAL')
    expect(colorRelation('azul', 'turquesa')).toBe('TONAL')
  })

  it('reconhece neutro com acento', () => {
    expect(colorRelation('preto', 'verde')).toBe('NEUTRAL_ACCENT')
  })

  it('reconhece complementar', () => {
    expect(colorRelation('azul', 'laranja')).toBe('COMPLEMENTARY')
  })

  it('reconhece análogo', () => {
    expect(colorRelation('vermelho', 'laranja')).toBe('ANALOGOUS')
  })
})

describe('nota de compatibilidade 0..3', () => {
  it('dá nota máxima para dupla clássica', () => {
    expect(colorCompatibility('marinho', 'branco')).toBe(3)
  })

  it('dá nota máxima quando há neutro', () => {
    expect(colorCompatibility('preto', 'vermelho')).toBe(3)
  })

  it('zera combinação conflitante', () => {
    expect(colorCompatibility('vermelho', 'rosa')).toBe(0)
  })

  it('não elimina combinação incomum — devolve 1, não 0', () => {
    expect(colorCompatibility('roxo', 'amarelo')).toBeGreaterThanOrEqual(1)
  })

  it('cor desconhecida continua possível', () => {
    expect(colorCompatibility('pantone-448c', 'preto')).toBeGreaterThanOrEqual(1)
  })
})

describe('paleta do look inteiro', () => {
  it('paleta neutra pontua mais que paleta conflitante', () => {
    const neutra = analyzePalette(['preto', 'branco', 'cinza'])
    const conflito = analyzePalette(['vermelho', 'rosa', 'laranja'])
    expect(neutra.score).toBeGreaterThan(conflito.score)
  })

  it('identifica a relação dominante para explicar a escolha', () => {
    const r = analyzePalette(['marinho', 'branco'])
    expect(r.dominant).toBe('CLASSIC')
    expect(describeRelation(r.dominant)).toContain('clássica')
  })

  it('aponta o pior par quando há conflito', () => {
    const r = analyzePalette(['preto', 'vermelho', 'rosa'])
    expect(r.worstPair).toBeDefined()
  })

  it('peça única não tem com o que conflitar', () => {
    expect(analyzePalette(['verde']).score).toBe(1)
  })

  it('um conflito grave não é diluído pela média', () => {
    const comConflito = analyzePalette(['preto', 'branco', 'cinza', 'vermelho', 'rosa'])
    const semConflito = analyzePalette(['preto', 'branco', 'cinza', 'marinho'])
    expect(semConflito.score).toBeGreaterThan(comConflito.score)
  })
})
