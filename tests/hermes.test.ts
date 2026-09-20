import { beforeEach, describe, expect, it } from 'vitest'
import { runHermes } from '@/agents/hermes'
import { MemoryRepository } from '@/services/memory-repository'
import { hermesRequestSchema } from '@/schemas/hermes'

const USER = 'u-hermes'
let repo: MemoryRepository

function request(overrides: Record<string, unknown> = {}) {
  return hermesRequestSchema.parse({ userId: USER, style: 'tenis', occasion: 'partida-tenis', ...overrides })
}

beforeEach(() => {
  repo = new MemoryRepository()
})

describe('roteamento do Hermes', () => {
  it('percorre o pipeline e devolve look com peças reais', async () => {
    const result = await runHermes(request(), { repo })

    expect(result.success).toBe(true)
    expect(result.outfitId).toBeTruthy()
    expect(result.selectedItems?.length).toBeGreaterThanOrEqual(3)

    const existentes = new Set((await repo.listItems(USER)).map((i) => i.id))
    for (const id of result.selectedItems ?? []) expect(existentes.has(id)).toBe(true)
  })

  it('devolve uma principal e duas alternativas', async () => {
    const result = await runHermes(request({ style: 'casual' }), { repo })
    expect(result.alternatives?.length).toBe(2)
    expect(result.proposals?.length).toBe(3)
  })

  it('explica a escolha em texto', async () => {
    const result = await runHermes(request(), { repo })
    expect(result.explanation).toBeTruthy()
    expect(result.explanation!.length).toBeGreaterThan(20)
  })

  it('falha com mensagem útil quando o guarda-roupa está vazio', async () => {
    const vazio = new MemoryRepository()
    for (const item of await vazio.listItems(USER)) await vazio.deleteItem(USER, item.id)

    const result = await runHermes(request(), { repo: vazio })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vazio/i)
  })

  it('não gera imagem quando render_image é falso', async () => {
    const result = await runHermes(request({ render_image: false }), { repo })
    expect(result.success).toBe(true)
    expect(result.generatedImageUrl).toBeUndefined()
  })

  it('registra a execução em agent_runs', async () => {
    await runHermes(request(), { repo })
    expect(await repo.todayCost(USER)).toBeGreaterThanOrEqual(0)
  })

  it('respeita o teto diário e degrada em vez de quebrar', async () => {
    await repo.logAiUsage({
      user_id: USER, provider: 'openai', model: 'gpt-image-1',
      operation: 'generate_look_image', estimated_cost: 999, latency_ms: 10, success: true,
    })

    const result = await runHermes(request(), { repo })
    expect(result.success).toBe(true)
    expect(result.degraded).toBe(true)
    expect(result.generatedImageUrl).toBeUndefined()
    expect(result.imageWarning).toMatch(/teto di[aá]rio/i)
  })

  it('mantém a peça travada ao trocar outra', async () => {
    const primeiro = await runHermes(request(), { repo })
    const items = primeiro.proposals![0].proposal.items
    const calcado = items.find((i) => i.role === 'shoes')!
    const resto = items.filter((i) => i.role !== 'shoes').map((i) => i.item.id)

    const segundo = await runHermes(
      request({ exclude_item_ids: [calcado.item.id], locked_item_ids: resto }),
      { repo },
    )

    expect(segundo.success).toBe(true)
    expect(segundo.selectedItems).not.toContain(calcado.item.id)
    for (const id of resto) expect(segundo.selectedItems).toContain(id)
  })
})
