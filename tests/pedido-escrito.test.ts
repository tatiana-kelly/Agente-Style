import { describe, expect, it, vi } from 'vitest'
import { exigenciasDoTexto } from '@/agents/style-agent/refine'
import { generateCandidates } from '@/lib/outfits/engine'
import { CENARIO_GUARDA_ROUPA, cenarioCtx, item } from './helpers/wardrobe-benchmark'

/** O caso real: ela escreveu "Calça preta" e recebeu três shorts. */
const ACERVO = [
  ...CENARIO_GUARDA_ROUPA,
  item({ id: 'preta-2', name: 'Calça preta reta', category: 'bottom', subcategory: 'calca', color: 'preto', formality: 6 }),
  item({ id: 'preta-3', name: 'Calça preta ampla', category: 'bottom', subcategory: 'calca', color: 'preto', formality: 7 }),
]

describe('o pedido escrito manda no look', () => {
  it('"Calça preta" vira exigência de parte de baixo preta', () => {
    const ex = exigenciasDoTexto('Calça preta', ACERVO)
    expect(ex).toHaveLength(1)
    expect(ex[0].role).toBe('bottom')
    expect(ex[0].subcategories).toContain('calca')
    expect(ex[0].color).toBe('preto')
  })

  it('exigência que não existe no armário é ignorada, não trava o look', () => {
    expect(exigenciasDoTexto('vestido roxo', ACERVO)).toEqual([])
  })

  it('"sem blazer" não vira exigência de blazer', () => {
    expect(exigenciasDoTexto('sem blazer', ACERVO)).toEqual([])
  })

  it('com "Calça preta", as três opções têm calça preta — e calças diferentes', () => {
    const r = generateCandidates(
      ACERVO,
      cenarioCtx({
        style: 'dia-a-dia', occasion: 'dia-comum', clima: 'ameno',
        exigencias: exigenciasDoTexto('Calça preta', ACERVO),
      }),
      3,
    )
    expect(r.candidates.length).toBe(3)
    const calcas = r.candidates.map((c) => c.items.find((i) => i.role === 'bottom')!.item)
    for (const calca of calcas) {
      expect(calca.subcategory).toBe('calca')
      expect(calca.color).toBe('preto')
    }
    expect(new Set(calcas.map((c) => c.id)).size).toBe(3)
  })

  it('a exigência não deixa short passar nem no calor', () => {
    const r = generateCandidates(
      ACERVO,
      cenarioCtx({
        style: 'casual', occasion: 'passeio', clima: 'calor',
        exigencias: exigenciasDoTexto('quero usar calça preta', ACERVO),
      }),
      3,
    )
    for (const c of r.candidates) {
      expect(c.items.find((i) => i.role === 'bottom')!.item.subcategory).toBe('calca')
    }
  })
})

describe('a regra de peças diferentes vale depois da stylist', () => {
  it('stylist que repete o mesmo look três vezes não consegue: a tela recebe três diferentes', async () => {
    // A stylist devolve [0,0,0]: sem a regra, a pessoa veria o mesmo look três vezes.
    vi.doMock('@/agents/stylist', () => ({
      runStylist: async (input: { candidatos: unknown[] }) => ({
        escolhidos: [0, 0, 0].slice(0, input.candidatos.length),
        explicacoes: ['a', 'a', 'a'],
        etiquetas: ['X', 'X', 'X'],
        custo: 0,
        fonte: 'openai',
        modelo: 'teste',
      }),
    }))
    vi.doMock('@/agents/look-critic', () => ({
      runLookCritic: async () => ({ aprovado: true, criticas: [], custo: 0, fonte: 'regras', modelo: 'regras' }),
    }))

    const { runHermes } = await import('@/agents/hermes')
    const { memoryRepository } = await import('@/services/memory-repository')
    const { hermesRequestSchema } = await import('@/schemas/hermes')

    const USER = 'u-pedido'
    for (const i of ACERVO) {
      await memoryRepository.createItem(USER, i as never)
    }

    const r = await runHermes(
      hermesRequestSchema.parse({ userId: USER, occasion: 'dia-comum', clima: 'ameno', render_image: false, context: 'Calça preta' }),
      { repo: memoryRepository },
    )
    expect(r.success).toBe(true)
    const looks = r.proposals!.map((p) => p.proposal)
    expect(looks.length).toBe(3)

    const roupa = ['top', 'bottom', 'dress', 'outerwear', 'shoes']
    const vistas = new Map<string, number>()
    for (const look of looks) {
      for (const p of look.items) {
        if (!roupa.includes(p.role)) continue
        vistas.set(p.item.id, (vistas.get(p.item.id) ?? 0) + 1)
      }
      expect(look.items.find((p) => p.role === 'bottom')!.item.color).toBe('preto')
    }
    expect([...vistas.values()].filter((n) => n > 1)).toEqual([])
  })
})

describe('estampa e terceira peça pedidas por escrito', () => {
  const comListrada = [
    ...ACERVO,
    item({ id: 'listrada', name: 'Camisa listrada', category: 'top', subcategory: 'camisa', color: 'branco', pattern: 'listrado', formality: 5 }),
  ]

  it('"camisa listrada" exige a estampa, não só a categoria', () => {
    const ex = exigenciasDoTexto('camisa listrada', comListrada)
    expect(ex).toHaveLength(1)
    expect(ex[0].pattern).toBe('listrado')
    expect(ex[0].role).toBe('top')
  })

  it('"blazer caramelo" obriga o blazer a aparecer, mesmo no calor', () => {
    const acervo = [
      ...ACERVO,
      item({ id: 'blazer-caramelo', name: 'Blazer caramelo', category: 'outerwear', subcategory: 'blazer', color: 'caramelo', formality: 7 }),
    ]
    const r = generateCandidates(
      acervo,
      cenarioCtx({
        style: 'casual', occasion: 'passeio', clima: 'calor',
        exigencias: exigenciasDoTexto('blazer caramelo', acervo),
      }),
      3,
    )
    expect(r.candidates.length).toBeGreaterThan(0)
    for (const c of r.candidates) {
      const terceira = c.items.find((i) => i.role === 'outerwear')
      expect(terceira?.item.id).toBe('blazer-caramelo')
    }
  })
})
