import { describe, expect, it } from 'vitest'
import { generateCandidates, type OutfitCandidate } from '@/lib/outfits/engine'
import { OUTFIT_FORMULAS } from '@/data/outfit-formulas'
import { REFERENCE_FORMULAS } from '@/data/formulas-reference'
import { avaliarPaleta, classificarCor, afinidadeComReferencias } from '@/lib/outfits/style-dna'
import { estiloParaOcasiao, estacaoParaClima } from '@/agents/style-agent'
import { runOutfitAgent } from '@/agents/outfit-agent'
import type { WardrobeItem } from '@/schemas/wardrobe'
import { CENARIO_GUARDA_ROUPA as GUARDA_ROUPA, cenarioCtx as ctx, item } from './helpers/wardrobe-benchmark'
import type { OutfitRole } from '@/schemas/outfit'

/**
 * Benchmark: as referências visuais da usuária.
 *
 * O guarda-roupa abaixo tem as peças que aparecem nas pranchas dela — jeans,
 * alfaiataria, colete, casaquinho, blazer, short, saia midi, tênis branco,
 * salto nude, bolsa caramelo. Se o motor não reproduz aqueles looks COM estas
 * peças, ele não aprendeu a linguagem; aprendeu só a combinar.
 */
const temPapel = (c: OutfitCandidate, role: OutfitRole) => c.items.some((i) => i.role === role)
const pecas = (c: OutfitCandidate) => c.items.map((i) => i.item.id)

describe('as fórmulas das referências existem e estão ativas', () => {
  it('a biblioteca carrega as fórmulas de referência', () => {
    expect(REFERENCE_FORMULAS.length).toBeGreaterThanOrEqual(20)
    for (const f of REFERENCE_FORMULAS) expect(f.source_type).toBe('style-reference')
  })

  it('as famílias das pranchas estão todas cobertas', () => {
    const nomes = OUTFIT_FORMULAS.map((f) => f.name.toLowerCase())
    for (const familia of [
      'casual chic', 'jeans e blazer', 'terninho clássico', 'alfaiataria com tênis',
      'colete e alfaiataria', 'colete e shorts', 'all black', 'monocromático',
      'neutros sofisticados', 'básico inteligente', 'sport chic', 'sofisticação moderna',
      'esportivo e elegante', 'conforto com estilo', 'linho e elegância', 'toque de cor',
      'elegância noturna', 'vestido jeans', 'saia midi chic',
    ]) {
      expect(nomes).toContain(familia)
    }
  })

  it('nenhuma fórmula de referência copia peça de foto: todas são arquétipos', () => {
    for (const f of REFERENCE_FORMULAS) {
      for (const slot of [...f.required_roles, ...f.optional_roles]) {
        expect(slot.archetypes.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('paleta — o DNA de cor das referências', () => {
  it('classifica os neutros das referências como neutros', () => {
    for (const cor of ['branco', 'off-white', 'creme', 'bege', 'caramelo', 'preto', 'marinho', 'cinza', 'jeans']) {
      expect(classificarCor(cor)).toBe('neutro')
    }
  })

  it('marrom e vinho entram como secundários, não como cor forte', () => {
    expect(classificarCor('marrom')).toBe('secundaria')
    expect(classificarCor('vinho')).toBe('secundaria')
  })

  it('verde e laranja são ponto de cor', () => {
    expect(classificarCor('verde')).toBe('accent')
    expect(classificarCor('laranja')).toBe('accent')
  })

  const paleta = (cores: Array<[OutfitRole, string]>) =>
    avaliarPaleta(cores.map(([role, color], n) => ({
      role, slotAffinity: 1,
      item: item({ id: `p${n}`, category: role === 'dress' ? 'dress' : (role as WardrobeItem['category']), color }),
    })))

  it('reprova azul forte com vermelho forte', () => {
    const r = paleta([['top', 'azul'], ['bottom', 'vermelho'], ['shoes', 'preto']])
    expect(r.aprovada).toBe(false)
  })

  it('reprova duas cores fortes mesmo com base neutra', () => {
    expect(paleta([['top', 'verde'], ['bottom', 'rosa'], ['shoes', 'branco']]).aprovada).toBe(false)
  })

  for (const receita of [
    [['bottom', 'jeans'], ['top', 'branco'], ['shoes', 'bege']],
    [['bottom', 'bege'], ['top', 'creme'], ['shoes', 'caramelo']],
    [['bottom', 'preto'], ['top', 'branco'], ['shoes', 'caramelo']],
    [['bottom', 'marinho'], ['top', 'branco'], ['shoes', 'bege']],
    [['bottom', 'marrom'], ['top', 'creme'], ['shoes', 'bege']],
  ] as Array<Array<[OutfitRole, string]>>) {
    const nome = receita.map(([, c]) => c).join(' + ')
    it(`aprova a receita das referências: ${nome}`, () => {
      const r = paleta(receita)
      expect(r.aprovada).toBe(true)
      expect(r.nota).toBeGreaterThan(0.7)
    })
  }

  it('um ponto de cor sobre base neutra passa', () => {
    expect(paleta([['top', 'branco'], ['bottom', 'preto'], ['shoes', 'vermelho']]).aprovada).toBe(true)
  })

  it('look neutro tem mais afinidade com as referências que look colorido', () => {
    const neutro = [['top', 'branco'], ['bottom', 'jeans'], ['shoes', 'bege']] as Array<[OutfitRole, string]>
    const colorido = [['top', 'amarelo'], ['bottom', 'verde'], ['shoes', 'vermelho']] as Array<[OutfitRole, string]>
    const mapear = (l: Array<[OutfitRole, string]>) =>
      l.map(([role, color], n) => ({ role, slotAffinity: 1, item: item({ id: `x${n}`, category: 'top', color }) }))
    expect(afinidadeComReferencias(mapear(neutro))).toBeGreaterThan(afinidadeComReferencias(mapear(colorido)))
  })
})

describe('20 cenários com o guarda-roupa das referências', () => {
  const cenarios = [
    { nome: 'trabalho no calor', occasion: 'trabalho', style: 'trabalho', clima: 'calor' },
    { nome: 'trabalho no frio', occasion: 'trabalho', style: 'trabalho', clima: 'frio' },
    { nome: 'trabalho ameno', occasion: 'trabalho', style: 'trabalho', clima: 'ameno' },
    { nome: 'reunião', occasion: 'reuniao', style: 'trabalho', clima: 'ameno' },
    { nome: 'igreja', occasion: 'igreja', style: 'igreja', clima: 'ameno' },
    { nome: 'igreja no frio', occasion: 'igreja', style: 'igreja', clima: 'frio' },
    { nome: 'dia a dia', occasion: 'dia-comum', style: 'dia-a-dia', clima: 'ameno' },
    { nome: 'dia a dia no calor', occasion: 'dia-comum', style: 'dia-a-dia', clima: 'calor' },
    { nome: 'passeio', occasion: 'passeio', style: 'casual', clima: 'ameno' },
    { nome: 'passeio no calor', occasion: 'passeio', style: 'casual', clima: 'calor' },
    { nome: 'passeio no frio', occasion: 'passeio', style: 'casual', clima: 'frio' },
    { nome: 'almoço', occasion: 'almoco', style: 'social', clima: 'calor' },
    { nome: 'jantar', occasion: 'jantar', style: 'jantar', clima: 'ameno' },
    { nome: 'jantar no frio', occasion: 'jantar', style: 'jantar', clima: 'frio' },
    { nome: 'evento', occasion: 'evento', style: 'evento', clima: 'ameno' },
    { nome: 'viagem', occasion: 'viagem', style: 'viagem', clima: 'ameno' },
    { nome: 'viagem no frio', occasion: 'viagem', style: 'viagem', clima: 'frio' },
    { nome: 'moderno passeio', occasion: 'passeio', style: 'moderno', clima: 'ameno' },
    { nome: 'elegante almoço', occasion: 'almoco', style: 'elegante', clima: 'calor' },
    { nome: 'feminino passeio', occasion: 'passeio', style: 'feminino', clima: 'ameno' },
  ] as const

  for (const cenario of cenarios) {
    it(`${cenario.nome}: look completo, paleta aprovada e clima respeitado`, () => {
      const r = generateCandidates(
        GUARDA_ROUPA,
        ctx({ style: cenario.style, occasion: cenario.occasion, clima: cenario.clima }),
        3,
      )
      expect(r.candidates.length).toBeGreaterThan(0)

      for (const c of r.candidates) {
        // veste a pessoa
        expect(temPapel(c, 'dress') || (temPapel(c, 'top') && temPapel(c, 'bottom'))).toBe(true)
        expect(temPapel(c, 'shoes')).toBe(true)

        // paleta dentro do DNA (tiers 1-3; o tier 4 é rede de segurança)
        if (c.tier <= 3) expect(avaliarPaleta(c.items).aprovada).toBe(true)

        // clima
        const ids = pecas(c)
        if (cenario.clima === 'calor') {
          expect(ids).not.toContain('casaco-cinza')
        }
        if (cenario.clima === 'frio' && c.tier <= 3) {
          const temCamada = temPapel(c, 'outerwear')
          const temShort = ids.includes('short-bege')
          expect(!temShort || temCamada).toBe(true)
        }
      }
    })
  }
})

describe('as referências aparecem no resultado', () => {
  it('trabalho traz alfaiataria com terceira peça', () => {
    const r = generateCandidates(GUARDA_ROUPA, ctx({ style: 'trabalho', occasion: 'trabalho', clima: 'ameno' }), 3)
    const comTerceira = r.candidates.filter((c) => temPapel(c, 'outerwear'))
    expect(comTerceira.length).toBeGreaterThan(0)
  })

  it('o dia a dia no calor não propõe casaco', () => {
    const r = generateCandidates(GUARDA_ROUPA, ctx({ style: 'dia-a-dia', occasion: 'dia-comum', clima: 'calor' }), 3)
    for (const c of r.candidates) expect(pecas(c)).not.toContain('casaco-cinza')
  })

  it('o colete é usado como peça de look, não fica parado no armário', () => {
    // Percorre os compromissos do dia a dia: em algum deles o colete precisa
    // entrar, senão a peça-chave das referências virou item morto.
    const contextos = [
      { style: 'moderno', occasion: 'trabalho' },
      { style: 'moderno', occasion: 'passeio' },
      { style: 'trabalho', occasion: 'trabalho' },
      { style: 'elegante', occasion: 'almoco' },
      { style: 'casual', occasion: 'dia-comum' },
    ] as const

    const usouColete = contextos.some((c) =>
      generateCandidates(GUARDA_ROUPA, ctx({ ...c, clima: 'ameno' }), 3).candidates.some((cand) =>
        pecas(cand).includes('colete-cru'),
      ),
    )
    expect(usouColete).toBe(true)
  })

  it('as fórmulas de referência ganham das genéricas em empate', () => {
    const r = generateCandidates(GUARDA_ROUPA, ctx({ style: 'casual', occasion: 'passeio', clima: 'ameno' }), 3)
    expect(r.candidates[0].formula.source_type).toBe('style-reference')
  })
})

describe('a tela decide menos e o sistema decide mais', () => {
  it('a ocasião define o estilo sem a pessoa escolher', () => {
    expect(estiloParaOcasiao('trabalho')).toBe('trabalho')
    expect(estiloParaOcasiao('igreja')).toBe('igreja')
    expect(estiloParaOcasiao('jantar')).toBe('jantar')
    expect(estiloParaOcasiao('dia-comum')).toBe('dia-a-dia')
    expect(estiloParaOcasiao(undefined)).toBe('casual')
  })

  it('o clima escolhido vira estação', () => {
    expect(estacaoParaClima('calor')).toBe('verao')
    expect(estacaoParaClima('frio')).toBe('inverno')
    expect(estacaoParaClima('auto')).toBeUndefined()
  })
})

describe('a explicação fala como stylist', () => {
  const saida = runOutfitAgent(GUARDA_ROUPA, ctx({ style: 'casual', occasion: 'passeio', clima: 'ameno' }), 3)

  it('cita as peças do look e o motivo da paleta', () => {
    const texto = saida.primary!.explanation
    expect(texto.length).toBeGreaterThan(40)
    expect(texto).not.toMatch(/tier|score|formula_match|archetype/i)
    expect(texto).toMatch(/paleta|cor|tom/i)
  })

  it('cada opção se apresenta pelo que tem de diferente', () => {
    const etiquetas = [saida.primary!, ...saida.alternatives].map((p) => p.etiqueta)
    expect(new Set(etiquetas).size).toBe(etiquetas.length)
    expect(etiquetas).toContain('Mais elegante')
    expect(etiquetas).toContain('Mais confortável')
  })
})
