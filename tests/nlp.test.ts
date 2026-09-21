import { describe, expect, it } from 'vitest'
import { extractContext } from '@/agents/style-agent/nlp'
import { resolveStyleIntent } from '@/agents/style-agent'
import { defaultStyleProfile } from '@/schemas/style-profile'

describe('interpretação de linguagem natural (§20)', () => {
  it('"Vou à igreja domingo de manhã"', () => {
    const r = extractContext('Vou à igreja domingo de manhã.')
    expect(r.style).toBe('igreja')
    expect(r.occasion).toBe('igreja')
    expect(r.period).toBe('manha')
    expect(r.day).toBe('domingo')
  })

  it('"Tenho reunião importante amanhã"', () => {
    const r = extractContext('Tenho reunião importante amanhã.')
    expect(r.occasion).toBe('reuniao')
    expect(r.elevated).toBe(true)
    expect(r.day).toBe('amanhã')
  })

  it('"Vou jogar tênis às 18h"', () => {
    const r = extractContext('Vou jogar tênis às 18h.')
    expect(r.style).toBe('tenis')
    expect(r.occasion).toBe('partida-tenis')
  })

  it('"Quero algo elegante para jantar"', () => {
    const r = extractContext('Quero algo elegante para jantar.')
    expect(r.occasion).toBe('jantar')
    expect(r.style).toBe('elegante')
  })

  it('"Quero algo diferente" pede ousadia', () => {
    expect(extractContext('Quero algo diferente hoje.').wantsNovelty).toBe(true)
  })

  it('texto vazio não inventa contexto', () => {
    const r = extractContext('')
    expect(r.style).toBeUndefined()
    expect(r.occasion).toBeUndefined()
    expect(r.confidence).toBe(0)
  })

  it('texto sem pista não inventa ocasião', () => {
    const r = extractContext('ahsdkjfh lorem ipsum')
    expect(r.occasion).toBeUndefined()
  })
})

describe('intenção com perfil pessoal (§11)', () => {
  it('frase livre sobrepõe o estilo marcado na tela', () => {
    const intent = resolveStyleIntent({ style: 'casual', context: 'Vou à igreja domingo.' })
    expect(intent.style).toBe('igreja')
    expect(intent.occasion).toBe('igreja')
  })

  it('igreja eleva a modéstia mesmo com perfil permissivo', () => {
    const profile = { ...defaultStyleProfile('u1'), modesty_level: 0 }
    const intent = resolveStyleIntent({ style: 'igreja', profile })
    expect(intent.modestyLevel).toBeGreaterThanOrEqual(2)
  })

  it('dress code de trabalho muda a faixa de formalidade', () => {
    const casual = resolveStyleIntent({
      style: 'trabalho',
      profile: { ...defaultStyleProfile('u1'), work_style: 'casual' },
    })
    const executivo = resolveStyleIntent({
      style: 'trabalho',
      profile: { ...defaultStyleProfile('u1'), work_style: 'executivo' },
    })
    expect(executivo.formality[0]).toBeGreaterThan(casual.formality[0])
  })

  it('igreja clássica pede mais formalidade que casual elegante', () => {
    const classico = resolveStyleIntent({
      style: 'igreja',
      profile: { ...defaultStyleProfile('u1'), church_style: 'classico' },
    })
    const casualElegante = resolveStyleIntent({
      style: 'igreja',
      profile: { ...defaultStyleProfile('u1'), church_style: 'casual-elegante' },
    })
    expect(classico.formality[0]).toBeGreaterThanOrEqual(casualElegante.formality[0])
  })

  it('"importante" sobe um ponto de formalidade', () => {
    const normal = resolveStyleIntent({ style: 'trabalho', context: 'reunião' })
    const importante = resolveStyleIntent({ style: 'trabalho', context: 'reunião importante com o cliente' })
    expect(importante.formality[1]).toBeGreaterThanOrEqual(normal.formality[1])
  })

  it('pedido de novidade vira apetite ousado', () => {
    expect(resolveStyleIntent({ style: 'casual', context: 'quero algo diferente' }).novelty).toBe('ousado')
  })
})
