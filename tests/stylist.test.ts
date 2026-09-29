import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/** A OpenAI é simulada: os testes verificam o CONTRATO, não a rede. */
const criar = vi.fn()
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: criar } }
  },
}))
vi.mock('@/lib/env', async (original) => {
  const real = await original<typeof import('@/lib/env')>()
  return { ...real, hasOpenAI: true, env: { ...real.env, openaiKey: 'teste', textModel: 'gpt-5-mini' } }
})

const { runStylist } = await import('@/agents/stylist')
const { runLookCritic } = await import('@/agents/look-critic')
const { item } = await import('./helpers/wardrobe-benchmark')
type Proposta = Parameters<typeof runLookCritic>[0][number]

function proposta(nome: string, pecas: Array<[string, ReturnType<typeof item>]>): Proposta {
  return {
    etiqueta: nome,
    sugestao: null,
    items: pecas.map(([role, i]) => ({ role, item: i })),
    scores: {},
    explanation: `explicação do motor para ${nome}`,
    name: nome,
    formulaId: `f-${nome}`,
    formulaName: nome,
    tier: 1,
    signature: nome,
  } as unknown as Proposta
}

const camisa = item({ id: 'c1', name: 'Camisa branca', category: 'top', subcategory: 'camisa', color: 'branco', formality: 7 })
const calca = item({ id: 'b1', name: 'Calça preta', category: 'bottom', subcategory: 'calca', color: 'preto', formality: 7 })
const salto = item({ id: 's1', name: 'Scarpin nude', category: 'shoes', subcategory: 'salto', color: 'nude', formality: 8 })
const jeans = item({ id: 'b2', name: 'Calça jeans', category: 'bottom', subcategory: 'calca', color: 'jeans', formality: 3 })
const tenis = item({ id: 's2', name: 'Tênis branco', category: 'shoes', subcategory: 'tenis', color: 'branco', formality: 3 })
const blazer = item({ id: 'o1', name: 'Blazer preto', category: 'outerwear', subcategory: 'blazer', color: 'preto', formality: 7 })
const camisetaVermelha = item({ id: 'c2', name: 'Camiseta vermelha', category: 'top', subcategory: 'camiseta', color: 'vermelho', formality: 3 })
const calcaAzul = item({ id: 'b3', name: 'Calça azul', category: 'bottom', subcategory: 'calca', color: 'azul', formality: 4 })
const botaMarrom = item({ id: 's3', name: 'Bota marrom', category: 'shoes', subcategory: 'bota', color: 'marrom', formality: 5 })

const candidatos = [
  proposta('terninho', [['top', camisa], ['bottom', calca], ['shoes', salto], ['outerwear', blazer]]),
  proposta('casual chic', [['top', camisa], ['bottom', jeans], ['shoes', tenis], ['outerwear', blazer]]),
  proposta('básico', [['top', camisa], ['bottom', jeans], ['shoes', tenis]]),
  proposta('colorido', [['top', camisetaVermelha], ['bottom', calcaAzul], ['shoes', botaMarrom]]),
]

const resposta = (json: unknown) => ({
  choices: [{ message: { content: JSON.stringify(json) } }],
  usage: { prompt_tokens: 500, completion_tokens: 120 },
})

beforeEach(() => criar.mockReset())
afterEach(() => vi.clearAllMocks())

describe('stylist — a OpenAI escolhe entre os candidatos do motor', () => {
  const entrada = { ocasiao: 'jantar', clima: 'frio', candidatos, acervo: [], quantidade: 3 }

  it('respeita a escolha e a ordem que a stylist devolveu', async () => {
    criar.mockResolvedValue(resposta({ escolhidos: [1, 0, 2], etiquetas: ['Casual chic', 'Elegante', 'Básico'], explicacoes: ['a', 'b', 'c'] }))
    const r = await runStylist(entrada)
    expect(r.escolhidos).toEqual([1, 0, 2])
    expect(r.etiquetas[0]).toBe('Casual chic')
    expect(r.fonte).toBe('openai')
    expect(r.custo).toBeGreaterThan(0)
  })

  it('descarta índice inválido — a IA não pode inventar peça nem look', async () => {
    criar.mockResolvedValue(resposta({ escolhidos: [0, 99, -1, 2], etiquetas: [], explicacoes: [] }))
    const r = await runStylist(entrada)
    expect(r.escolhidos).toEqual([0, 2])
  })

  it('cai na ordem do motor quando a resposta vem vazia', async () => {
    criar.mockResolvedValue(resposta({ escolhidos: [] }))
    const r = await runStylist(entrada)
    expect(r.fonte).toBe('motor')
    expect(r.escolhidos).toEqual([0, 1, 2])
  })

  it('cai na ordem do motor quando a chamada falha — o look não se perde', async () => {
    criar.mockImplementationOnce(async () => {
      throw new Error('rede fora')
    })
    const r = await runStylist(entrada)
    expect(r.fonte).toBe('motor')
    expect(r.aviso).toMatch(/rede fora/)
  })

  it('não gasta chamada quando não há o que escolher', async () => {
    const r = await runStylist({ ...entrada, candidatos: candidatos.slice(0, 2) })
    expect(criar).not.toHaveBeenCalled()
    expect(r.fonte).toBe('motor')
  })

  it('manda para a IA o pedido, o clima e o DNA das referências', async () => {
    criar.mockResolvedValue(resposta({ escolhidos: [0], etiquetas: [], explicacoes: [] }))
    await runStylist({ ...entrada, pedido: 'jantar em Campos do Jordão' })
    const enviado = criar.mock.calls[0][0].messages[1].content as string
    expect(enviado).toContain('Campos do Jordão')
    expect(enviado).toContain('frio')
    expect(enviado).toMatch(/Casual chic|casual chic/)
    expect(enviado).toContain('Camisa branca')
  })
})

describe('look critic — segunda opinião antes de mostrar', () => {
  it('aprova quando a IA aprova e a paleta fecha', async () => {
    criar.mockResolvedValue(resposta({ aprovado: true, criticas: [] }))
    const r = await runLookCritic([candidatos[0], candidatos[1]])
    expect(r.aprovado).toBe(true)
  })

  it('reprova o look que a IA apontou', async () => {
    criar.mockResolvedValue(resposta({ aprovado: false, criticas: [{ indice: 1, problemas: ['muito básico'], correcoes: ['adicionar terceira peça'] }] }))
    const r = await runLookCritic([candidatos[0], candidatos[1]])
    expect(r.aprovado).toBe(false)
    expect(r.criticas[0].indice).toBe(1)
  })

  it('reprova paleta incoerente mesmo se a IA tiver aprovado', async () => {
    // vermelho + azul + marrom: o caso que ela reclamou
    criar.mockResolvedValue(resposta({ aprovado: true, criticas: [] }))
    const r = await runLookCritic([candidatos[3]])
    expect(r.aprovado).toBe(false)
    expect(r.criticas[0].problemas[0]).toMatch(/disputam|conversa|base neutra/)
  })

  it('ignora índice fora da lista', async () => {
    criar.mockResolvedValue(resposta({ aprovado: false, criticas: [{ indice: 42, problemas: ['x'], correcoes: [] }] }))
    const r = await runLookCritic([candidatos[0]])
    expect(r.criticas).toEqual([])
  })
})

describe('interpretar o pedido escrito', () => {
  it('lê ocasião, clima e registro de uma frase só', async () => {
    const { interpretarPedido } = await import('@/agents/style-agent/nlu-openai')
    criar.mockResolvedValue(
      resposta({
        occasion: 'jantar', clima: 'frio', style: 'elegante',
        formalidade: [7, 9], conforto: true,
        pecas_citadas: [], notas: ['Jantar à noite, com frio.'],
      }),
    )
    const r = await interpretarPedido('Vou jantar em Campos do Jordão. Está frio. Quero algo elegante e confortável.')
    expect(r.occasion).toBe('jantar')
    expect(r.clima).toBe('frio')
    expect(r.style).toBe('elegante')
    expect(r.formalidade).toEqual([7, 9])
    expect(r.conforto).toBe(true)
    expect(r.custo).toBeGreaterThan(0)
  })

  it('recusa ocasião e estilo que não existem na taxonomia', async () => {
    const { interpretarPedido } = await import('@/agents/style-agent/nlu-openai')
    criar.mockResolvedValue(resposta({ occasion: 'balada-na-lua', style: 'inventado', clima: 'gelado' }))
    const r = await interpretarPedido('qualquer texto suficientemente longo aqui')
    expect(r.occasion).toBeUndefined()
    expect(r.style).toBeUndefined()
    expect(r.clima).toBeUndefined()
  })

  it('não gasta chamada com texto curto demais', async () => {
    const { interpretarPedido } = await import('@/agents/style-agent/nlu-openai')
    criar.mockReset()
    const r = await interpretarPedido('oi')
    expect(criar).not.toHaveBeenCalled()
    expect(r.notas).toEqual([])
  })
})
