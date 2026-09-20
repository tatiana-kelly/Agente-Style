import { describe, expect, it } from 'vitest'
import { resolveStyleIntent } from '@/agents/style-agent'

describe('interpretação de intenção', () => {
  it('entende "jogar tênis de manhã" como esporte, sem subir formalidade', () => {
    const intent = resolveStyleIntent({ style: 'tenis', context: 'Quero um look para jogar tênis de manhã.' })
    expect(intent.style).toBe('tenis')
    expect(intent.occasion).toBe('partida-tenis')
    expect(intent.formality[1]).toBeLessThanOrEqual(3)
    expect(intent.notes.join(' ')).toMatch(/manh/i)
  })

  it('sobe um ponto de formalidade quando o contexto é noite', () => {
    const base = resolveStyleIntent({ style: 'casual' })
    const noite = resolveStyleIntent({ style: 'casual', context: 'jantar à noite' })
    expect(noite.formality[1]).toBeGreaterThan(base.formality[1])
  })

  it('extrai peça citada no texto livre', () => {
    const intent = resolveStyleIntent({ style: 'social', context: 'Quero usar minha saia preta.' })
    expect(intent.requestedSubcategories).toContain('saia')
    expect(intent.requestedColors).toContain('preto')
  })

  it('usa a ocasião padrão do estilo quando nada é informado', () => {
    expect(resolveStyleIntent({ style: 'trabalho' }).occasion).toBe('trabalho')
  })

  it('anota chuva e frio vindos do clima', () => {
    const intent = resolveStyleIntent({ style: 'casual', weather: { temperature: 12, rain: true } })
    expect(intent.season).toBe('inverno')
    expect(intent.notes.join(' ')).toMatch(/Frio/)
    expect(intent.notes.join(' ')).toMatch(/Chuva/)
  })
})
