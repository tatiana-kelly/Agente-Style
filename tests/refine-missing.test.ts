import { describe, expect, it } from 'vitest'
import { faltantes } from '@/agents/style-agent/refine'
import { buildDemoWardrobe } from '@/data/demo-wardrobe'

const items = buildDemoWardrobe('u1')

/**
 * Regressão: a lista de faltantes já saiu como a frase inteira porque o split
 * usava um \b que virou caractere de backspace e nunca casava.
 */
describe('o que falta no guarda-roupa', () => {
  it('lista item a item, não a frase inteira', () => {
    const faltas = faltantes('inclua sapato vermelho e cinto vermelho e casaco', items)
    expect(faltas.length).toBeGreaterThanOrEqual(2)
    // Nenhuma entrada pode ser a frase toda.
    for (const f of faltas) {
      expect(f.length).toBeLessThan(30)
      expect(f).not.toMatch(/inclua/i)
    }
  })

  it('nomeia a peça pedida', () => {
    const faltas = faltantes('inclua cinto vermelho', items).join(' ')
    expect(faltas).toMatch(/cinto/i)
  })

  it('não lista peça que existe', () => {
    expect(faltantes('inclua bolsa preta', items)).toHaveLength(0)
  })

  it('ignora o que a pessoa mandou tirar', () => {
    expect(faltantes('tira o sapato vermelho', items)).toHaveLength(0)
  })
})
