import { describe, expect, it } from 'vitest'
import { generateCandidates } from '@/lib/outfits/engine'
import {
  distanciaEntreLooks, estruturaDoLook, familiaDoLook, comparavel,
  limitarPorFormula, selecionarDiversos,
} from '@/lib/outfits/diversity'
import { CENARIO_GUARDA_ROUPA, cenarioCtx, item } from './helpers/wardrobe-benchmark'
import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'

function peca(role: OutfitRole, it: WardrobeItem) {
  return { role, item: it, slotAffinity: 1 }
}

const blazer = item({ id: 'blazer', category: 'outerwear', subcategory: 'blazer', color: 'preto', formality: 7 })
const casaquinho = item({ id: 'casaquinho', category: 'outerwear', subcategory: 'cardiga', color: 'creme', formality: 4 })
const alfaiataria = item({ id: 'alfaiataria', category: 'bottom', subcategory: 'calca', color: 'caramelo', formality: 7 })
const jeans = item({ id: 'jeans', category: 'bottom', subcategory: 'calca', color: 'jeans', formality: 3 })
const salto = item({ id: 'salto', category: 'shoes', subcategory: 'salto', color: 'caramelo', formality: 8 })
const tenis = item({ id: 'tenis', category: 'shoes', subcategory: 'tenis', color: 'branco', formality: 3 })
const camisaListrada = item({ id: 'camisa-listrada', category: 'top', subcategory: 'camisa', color: 'branco', formality: 6 })
const camisaPreta = item({ id: 'camisa-preta', category: 'top', subcategory: 'camisa', color: 'preto', formality: 6 })

describe('família de look — variação não é alternativa', () => {
  // Exatamente o caso que ela reportou: três looks que só trocam a blusa.
  const look1 = comparavel([peca('outerwear', blazer), peca('top', camisaListrada), peca('bottom', alfaiataria), peca('shoes', salto)], 'f1')
  const look2 = comparavel([peca('outerwear', blazer), peca('top', camisaPreta), peca('bottom', alfaiataria), peca('shoes', salto)], 'f1')
  const outroLook = comparavel([peca('outerwear', casaquinho), peca('top', camisaListrada), peca('bottom', jeans), peca('shoes', tenis)], 'f2')

  it('trocar só a parte de cima mantém a mesma família', () => {
    expect(familiaDoLook(look1.items)).toBe(familiaDoLook(look2.items))
    expect(familiaDoLook(look1.items)).toBe('blazer|calca-alfaiataria|salto')
  })

  it('mudar terceira peça, base e calçado muda a família', () => {
    expect(familiaDoLook(outroLook.items)).toBe('casaquinho|calca-casual|tenis')
    expect(estruturaDoLook(familiaDoLook(outroLook.items))).not.toBe(estruturaDoLook(familiaDoLook(look1.items)))
  })

  it('a distância entre duas variações é baixa e entre duas ideias é alta', () => {
    expect(distanciaEntreLooks(look1, look2)).toBeLessThan(0.3)
    expect(distanciaEntreLooks(look1, outroLook)).toBeGreaterThan(0.8)
  })

  it('alfaiataria e jeans são bases diferentes, mesmo sendo as duas calças', () => {
    const comAlfaiataria = familiaDoLook([peca('bottom', alfaiataria), peca('shoes', salto)])
    const comJeans = familiaDoLook([peca('bottom', jeans), peca('shoes', salto)])
    expect(comAlfaiataria).not.toBe(comJeans)
  })

  it('a seleção prefere a ideia diferente mesmo com nota um pouco menor', () => {
    const escolhidos = selecionarDiversos(
      [
        { look: look1, qualidade: 0.9, original: 'variação A' },
        { look: look2, qualidade: 0.89, original: 'variação B' },
        { look: outroLook, qualidade: 0.8, original: 'outra ideia' },
      ],
      2,
    )
    expect(escolhidos).toContain('variação A')
    expect(escolhidos).toContain('outra ideia')
  })

  it('uma fórmula não inunda o ranking', () => {
    const muitas = Array.from({ length: 10 }, (_, n) => ({
      look: look1, qualidade: 0.9 - n * 0.01, original: `f1-${n}`,
    }))
    const limitado = limitarPorFormula([...muitas, { look: outroLook, qualidade: 0.5, original: 'outra' }], 2)
    expect(limitado.filter((c) => c.original.toString().startsWith('f1-'))).toHaveLength(2)
    expect(limitado.map((c) => c.original)).toContain('outra')
  })
})

describe('TESTE OBRIGATÓRIO — 3 looks, 3 ideias', () => {
  const contextos = [
    { nome: 'trabalho', style: 'trabalho', occasion: 'trabalho' },
    { nome: 'almoço', style: 'social', occasion: 'almoco' },
    { nome: 'viagem', style: 'viagem', occasion: 'viagem' },
    { nome: 'dia a dia', style: 'dia-a-dia', occasion: 'dia-comum' },
    { nome: 'jantar', style: 'jantar', occasion: 'jantar' },
    { nome: 'passeio', style: 'casual', occasion: 'passeio' },
  ] as const

  for (const c of contextos) {
    it(`${c.nome}: as três opções vêm de estruturas diferentes`, () => {
      const r = generateCandidates(CENARIO_GUARDA_ROUPA, cenarioCtx({ ...c, clima: 'ameno' }), 3)
      expect(r.candidates.length).toBe(3)

      const estruturas = r.candidates.map((cand) => estruturaDoLook(familiaDoLook(cand.items)))
      expect(new Set(estruturas).size).toBe(estruturas.length)
    })

    it(`${c.nome}: nenhuma opção repete terceira peça + base + calçado de outra`, () => {
      const r = generateCandidates(CENARIO_GUARDA_ROUPA, cenarioCtx({ ...c, clima: 'ameno' }), 3)
      const chave = (cand: (typeof r.candidates)[number]) =>
        ['outerwear', 'bottom', 'shoes']
          .map((role) => cand.items.find((i) => i.role === role)?.item.id ?? '-')
          .join('|')
      const chaves = r.candidates.map(chave)
      expect(new Set(chaves).size).toBe(chaves.length)
    })
  }

  it('trabalho não devolve três vezes blazer + mesma calça + mesmo sapato', () => {
    const r = generateCandidates(
      CENARIO_GUARDA_ROUPA,
      cenarioCtx({ style: 'trabalho', occasion: 'trabalho', clima: 'ameno' }),
      3,
    )
    const combos = r.candidates.map((c) =>
      [c.items.find((i) => i.role === 'bottom')?.item.id, c.items.find((i) => i.role === 'shoes')?.item.id].join('|'),
    )
    expect(new Set(combos).size).toBeGreaterThan(1)
  })

  it('a diversidade não passa por cima da harmonia de cor', () => {
    for (const c of contextos) {
      const r = generateCandidates(CENARIO_GUARDA_ROUPA, cenarioCtx({ ...c, clima: 'ameno' }), 3)
      for (const cand of r.candidates) {
        if (cand.tier <= 3) expect(cand.scores.color_match).toBeGreaterThan(0.3)
      }
    }
  })
})

describe('as três opções não dividem peças', () => {
  const contextos = [
    { style: 'trabalho', occasion: 'trabalho' },
    { style: 'casual', occasion: 'passeio' },
    { style: 'viagem', occasion: 'viagem' },
  ] as const

  for (const c of contextos) {
    it(`${c.occasion}: nenhuma peça de roupa aparece em duas opções`, () => {
      const r = generateCandidates(CENARIO_GUARDA_ROUPA, cenarioCtx({ ...c, clima: 'ameno' }), 3)
      const vistas = new Map<string, number>()
      const roupa = ['top', 'bottom', 'dress', 'outerwear', 'shoes']
      for (const cand of r.candidates) {
        for (const p of cand.items) {
          if (!roupa.includes(p.role)) continue
          vistas.set(p.item.id, (vistas.get(p.item.id) ?? 0) + 1)
        }
      }
      const repetidas = [...vistas.entries()].filter(([, n]) => n > 1)
      expect(repetidas).toEqual([])
    })
  }
})
