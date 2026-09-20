import { describe, expect, it } from 'vitest'
import { classificationSchema, createWardrobeItemSchema } from '@/schemas/wardrobe'
import { generateLookRequestSchema } from '@/schemas/outfit'
import { feedbackSchema } from '@/schemas/user'
import { heuristicClassify } from '@/lib/ai/classifier'

describe('validação de schema', () => {
  it('rejeita categoria inexistente', () => {
    expect(classificationSchema.safeParse({ category: 'chapeu-magico', subcategory: 'x', color: 'preto', formality: 3 }).success).toBe(false)
  })

  it('rejeita formalidade fora da escala', () => {
    expect(classificationSchema.safeParse({ category: 'top', subcategory: 'camisa', color: 'preto', formality: 42 }).success).toBe(false)
  })

  it('aplica os defaults declarados', () => {
    const parsed = classificationSchema.parse({ category: 'top', subcategory: 'camisa', color: 'branco', formality: 7 })
    expect(parsed.pattern).toBe('liso')
    expect(parsed.sport_type).toBe('nenhum')
    expect(parsed.season).toHaveLength(4)
  })

  it('exige nome ao criar peça', () => {
    expect(createWardrobeItemSchema.safeParse({ category: 'top', subcategory: 'camisa', color: 'preto' }).success).toBe(false)
  })

  it('pede estilo válido na geração de look', () => {
    expect(generateLookRequestSchema.safeParse({ style: 'medieval' }).success).toBe(false)
    expect(generateLookRequestSchema.parse({ style: 'tenis' }).render_image).toBe(true)
  })

  it('aceita apenas ações de feedback conhecidas', () => {
    expect(feedbackSchema.safeParse({ outfit_id: 'o1', action: 'amei-demais' }).success).toBe(false)
    expect(feedbackSchema.safeParse({ outfit_id: 'o1', action: 'liked' }).success).toBe(true)
  })
})

describe('classificação heurística', () => {
  it('identifica skort como bottom de tênis', () => {
    const c = heuristicClassify('skort branco de tênis')
    expect(c.category).toBe('bottom')
    expect(c.subcategory).toBe('skort')
    expect(c.sport_type).toBe('tenis')
  })

  it('identifica blazer como sobreposição formal', () => {
    const c = heuristicClassify('blazer preto')
    expect(c.category).toBe('outerwear')
    expect(c.formality).toBeGreaterThanOrEqual(7)
  })

  it('sempre devolve objeto válido pelo schema', () => {
    expect(classificationSchema.safeParse(heuristicClassify('coisa sem nome')).success).toBe(true)
  })
})
