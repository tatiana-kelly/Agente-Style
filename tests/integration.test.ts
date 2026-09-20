import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRepository } from '@/services/memory-repository'
import { runHermes } from '@/agents/hermes'
import { heuristicClassify } from '@/lib/ai/classifier'
import { applyFeedback, preferenceWeightMap } from '@/services/preference-service'
import { hermesRequestSchema } from '@/schemas/hermes'
import { createWardrobeItemSchema } from '@/schemas/wardrobe'

const USER = 'u-integra'
let repo: MemoryRepository

beforeEach(() => {
  repo = new MemoryRepository()
})

describe('integração: cadastrar peça → classificar → selecionar → gerar look', () => {
  it('classifica, salva e a peça fica disponível para o Hermes', async () => {
    const classification = heuristicClassify('viseira rosa de tênis')
    const input = createWardrobeItemSchema.parse({ ...classification, name: 'Viseira rosa' })

    const criada = await repo.createItem(USER, input)
    expect(criada.id).toBeTruthy()
    expect(criada.sport_type).toBe('tenis')

    const items = await repo.listItems(USER)
    expect(items.some((i) => i.id === criada.id)).toBe(true)
  })

  it('peça excluída deixa de ser considerada', async () => {
    const items = await repo.listItems(USER)
    const tenisQuadra = items.find((i) => i.subcategory === 'tenis-tenis')!
    await repo.deleteItem(USER, tenisQuadra.id)

    const result = await runHermes(hermesRequestSchema.parse({ userId: USER, style: 'tenis' }), { repo })
    expect(result.selectedItems).not.toContain(tenisQuadra.id)
  })

  it('o look gerado é persistido e recuperável', async () => {
    const result = await runHermes(hermesRequestSchema.parse({ userId: USER, style: 'trabalho' }), { repo })
    const outfit = await repo.getOutfit(USER, result.outfitId!)

    expect(outfit).not.toBeNull()
    expect(outfit!.items.length).toBe(result.selectedItems!.length)
    expect(outfit!.status).toBe('draft')
  })
})

describe('aprendizado de preferência', () => {
  it('curtir sobe o peso das peças usadas', async () => {
    const result = await runHermes(hermesRequestSchema.parse({ userId: USER, style: 'casual' }), { repo })
    const outfit = (await repo.getOutfit(USER, result.outfitId!))!
    const items = (await repo.listItems(USER)).filter((i) =>
      outfit.items.some((o) => o.wardrobe_item_id === i.id),
    )

    await applyFeedback(repo, USER, outfit, items, { outfit_id: outfit.id, action: 'liked' })

    const pesos = preferenceWeightMap(await repo.listPreferences(USER))
    for (const item of items) expect(pesos[item.id]).toBeGreaterThan(0)
  })

  it('rejeitar deixa o peso negativo', async () => {
    const result = await runHermes(hermesRequestSchema.parse({ userId: USER, style: 'casual' }), { repo })
    const outfit = (await repo.getOutfit(USER, result.outfitId!))!
    const items = (await repo.listItems(USER)).filter((i) =>
      outfit.items.some((o) => o.wardrobe_item_id === i.id),
    )

    await applyFeedback(repo, USER, outfit, items, { outfit_id: outfit.id, action: 'rejected' })

    const pesos = preferenceWeightMap(await repo.listPreferences(USER))
    for (const item of items) expect(pesos[item.id]).toBeLessThan(0)
  })

  it('trocar uma peça penaliza só a peça trocada', async () => {
    const result = await runHermes(hermesRequestSchema.parse({ userId: USER, style: 'casual' }), { repo })
    const outfit = (await repo.getOutfit(USER, result.outfitId!))!
    const items = (await repo.listItems(USER)).filter((i) =>
      outfit.items.some((o) => o.wardrobe_item_id === i.id),
    )
    const calcadoId = outfit.items.find((o) => o.role === 'shoes')!.wardrobe_item_id

    await applyFeedback(repo, USER, outfit, items, {
      outfit_id: outfit.id, action: 'swapped', swapped_role: 'shoes',
    })

    const pesos = preferenceWeightMap(await repo.listPreferences(USER))
    expect(pesos[calcadoId]).toBeLessThan(0)
    const outros = items.filter((i) => i.id !== calcadoId)
    for (const item of outros) expect(pesos[item.id]).toBeUndefined()
  })
})

/** Smoke do critério de sucesso do PRP §49, ponta a ponta. */
describe('smoke: jornada completa', () => {
  it('guarda-roupa → tênis/jogo → look → troca → salvar → aparece em Meus Looks', async () => {
    // 1-5: guarda-roupa disponível
    const items = await repo.listItems(USER)
    expect(items.length).toBe(20)

    // 6-11: seleciona tênis + jogo e recebe o look com imagem
    const primeiro = await runHermes(
      hermesRequestSchema.parse({ userId: USER, style: 'tenis', occasion: 'partida-tenis' }),
      { repo },
    )
    expect(primeiro.success).toBe(true)
    expect(primeiro.generatedImageUrl).toBeTruthy()

    // 12-13: troca uma peça e recebe nova combinação
    const calcado = primeiro.proposals![0].proposal.items.find((i) => i.role === 'shoes')!
    const segundo = await runHermes(
      hermesRequestSchema.parse({
        userId: USER, style: 'tenis', occasion: 'partida-tenis',
        exclude_item_ids: [calcado.item.id],
        locked_item_ids: primeiro.proposals![0].proposal.items
          .filter((i) => i.role !== 'shoes').map((i) => i.item.id),
      }),
      { repo },
    )
    expect(segundo.success).toBe(true)
    expect(segundo.outfitId).not.toBe(primeiro.outfitId)

    // 14: salva
    expect(await repo.markOutfitSaved(USER, segundo.outfitId!)).toBe(true)

    // 15: aparece em Meus Looks
    const salvos = await repo.listOutfits(USER)
    expect(salvos.map((o) => o.id)).toContain(segundo.outfitId)
    expect(await repo.listOutfits(USER, 'tenis')).toHaveLength(1)
  })
})
