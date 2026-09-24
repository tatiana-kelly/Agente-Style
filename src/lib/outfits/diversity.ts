import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'

/**
 * Diversidade de composição — três opções precisam ser três IDEIAS de look.
 *
 * O motor sabia achar a melhor combinação e, depois, devolvia variações dela:
 * mesmo blazer, mesma calça, mesmo sapato, trocando a blusa. Tecnicamente são
 * três looks; para quem está se arrumando, é um só.
 *
 * A unidade de comparação aqui não é a peça, é a FAMÍLIA: que terceira peça,
 * que tipo de base e que calçado formam a estrutura. "Blazer + alfaiataria +
 * salto" e "casaquinho + jeans + tênis" são famílias diferentes mesmo quando
 * dividem a mesma paleta.
 */

export interface Peca {
  item: WardrobeItem
  role: OutfitRole
  slotAffinity: number
}

const TERCEIRAS: Record<string, string> = {
  blazer: 'blazer', colete: 'colete', cardiga: 'casaquinho',
  jaqueta: 'jaqueta', casaco: 'casaco', 'corta-vento': 'corta-vento',
}

const BASES: Record<string, string> = {
  calca: 'calca', shorts: 'short', bermuda: 'short', saia: 'saia',
  legging: 'legging', skort: 'skort', vestido: 'vestido', macacao: 'vestido',
}

const CALCADOS: Record<string, string> = {
  salto: 'salto', sapato: 'raso', sapatilha: 'raso', tenis: 'tenis',
  'tenis-tenis': 'tenis', 'tenis-corrida': 'tenis', bota: 'bota',
  sandalia: 'sandalia', chinelo: 'sandalia',
}

function classificar(p: Peca | undefined, mapa: Record<string, string>, vazio: string): string {
  if (!p) return vazio
  return mapa[p.item.subcategory] ?? p.item.subcategory
}

/**
 * Assinatura estrutural do look. Duas opções com a mesma assinatura são a
 * mesma ideia de look, por mais que as cores mudem.
 */
export function familiaDoLook(picks: Peca[]): string {
  const terceira = picks.find((p) => p.role === 'outerwear')
  const baixo = picks.find((p) => p.role === 'bottom' || p.role === 'dress')
  const calcado = picks.find((p) => p.role === 'shoes')

  // Alfaiataria e jeans são bases diferentes ainda que ambas sejam "calça":
  // é essa diferença que separa terninho de casual chic.
  const base = classificar(baixo, BASES, 'sem-base')
  const registroDaBase = baixo && baixo.item.formality >= 6 ? 'alfaiataria' : 'casual'
  const baseCompleta = base === 'calca' ? `calca-${registroDaBase}` : base

  return [
    classificar(terceira, TERCEIRAS, 'sem-terceira'),
    baseCompleta,
    classificar(calcado, CALCADOS, 'sem-calcado'),
  ].join('|')
}

export interface LookComparavel {
  items: Peca[]
  formulaId: string
  familia: string
  formalidadeMedia: number
}

export function comparavel(items: Peca[], formulaId: string): LookComparavel {
  const nucleo = items.filter((p) => p.role !== 'accessory' && p.role !== 'bag')
  return {
    items,
    formulaId,
    familia: familiaDoLook(items),
    formalidadeMedia:
      nucleo.reduce((s, p) => s + p.item.formality, 0) / Math.max(nucleo.length, 1),
  }
}

/**
 * 0 = o mesmo look; 1 = duas propostas sem nada em comum.
 *
 * Pesa o que a pessoa enxerga primeiro — estrutura, terceira peça, base e
 * calçado — e não a blusa, que é justamente o que o motor trocava.
 */
export function distanciaEntreLooks(a: LookComparavel, b: LookComparavel): number {
  let distancia = 0

  if (a.familia !== b.familia) distancia += 0.4
  if (a.formulaId !== b.formulaId) distancia += 0.2

  const peca = (l: LookComparavel, role: OutfitRole) =>
    l.items.find((p) => p.role === role)?.item.id

  if (peca(a, 'bottom') !== peca(b, 'bottom')) distancia += 0.15
  if (peca(a, 'shoes') !== peca(b, 'shoes')) distancia += 0.15
  if (peca(a, 'outerwear') !== peca(b, 'outerwear')) distancia += 0.1

  // Duas propostas no mesmo nível de formalidade dão a mesma sensação.
  if (Math.abs(a.formalidadeMedia - b.formalidadeMedia) >= 1.5) distancia += 0.1

  return Math.min(1, distancia)
}

function pecaDe(look: LookComparavel, role: OutfitRole): string | undefined {
  return look.items.find((p) => p.role === role)?.item.id
}

export interface Candidato<T> {
  look: LookComparavel
  qualidade: number
  original: T
}

/** Terceira peça + base: é o que define a ideia do look. O sapato ajusta o registro. */
export function estruturaDoLook(familia: string): string {
  return familia.split('|').slice(0, 2).join('|')
}

/**
 * Escolhe as N propostas mais fortes E mais diferentes entre si.
 *
 * Três passadas, cada uma menos exigente: primeiro exige família diferente,
 * depois aceita mesma família com estrutura distante, e só no fim completa com
 * o que sobrou. Guarda-roupa pequeno continua recebendo três opções — mas
 * quando há variedade disponível, ela aparece.
 */
export function selecionarDiversos<T>(candidatos: Array<Candidato<T>>, quantidade: number): T[] {
  if (candidatos.length === 0) return []

  const ordenados = [...candidatos].sort((a, b) => b.qualidade - a.qualidade)
  const escolhidos: Array<Candidato<T>> = [ordenados[0]]

  /**
   * Exigências em ordem decrescente. A primeira é o que uma stylist faria:
   * outra estrutura, outra base, outra parte de cima. As seguintes vão
   * cedendo, porque guarda-roupa pequeno também merece três opções.
   */
  const passadas: Array<{
    estrutura: boolean
    familia?: boolean
    base: boolean
    cima: boolean
    alemDaBlusa?: boolean
    distancia: number
  }> = [
    { estrutura: true, base: true, cima: true, distancia: 0.6 },
    { estrutura: true, base: true, cima: false, distancia: 0.6 },
    { estrutura: true, base: false, cima: false, distancia: 0.45 },
    // Quando o armário só dá uma estrutura (ex.: só calça de alfaiataria para
    // trabalho), ainda dá para variar o registro pelo calçado e pela base.
    { estrutura: false, familia: true, base: true, cima: false, distancia: 0.4 },
    { estrutura: false, familia: true, base: false, cima: false, distancia: 0.25 },
    { estrutura: false, base: true, cima: false, distancia: 0.2 },
    // Antes de repetir a ideia, exige ao menos que mude a base, o calçado ou a
    // terceira peça: trocar só a blusa nunca é uma segunda opção.
    { estrutura: false, base: false, cima: false, alemDaBlusa: true, distancia: 0 },
    { estrutura: false, base: false, cima: false, distancia: 0 },
  ]

  for (const regra of passadas) {
    for (const candidato of ordenados) {
      if (escolhidos.length >= quantidade) break
      if (escolhidos.includes(candidato)) continue

      if (regra.estrutura) {
        const estrutura = estruturaDoLook(candidato.look.familia)
        if (escolhidos.some((e) => estruturaDoLook(e.look.familia) === estrutura)) continue
      }
      if (regra.familia && escolhidos.some((e) => e.look.familia === candidato.look.familia)) continue
      if (regra.base && escolhidos.some((e) => pecaDe(e.look, 'bottom') === pecaDe(candidato.look, 'bottom'))) {
        continue
      }
      if (regra.cima) {
        const cima = pecaDe(candidato.look, 'top')
        if (cima && escolhidos.some((e) => pecaDe(e.look, 'top') === cima)) continue
      }

      if (regra.alemDaBlusa) {
        const mudouAlgoVisivel = escolhidos.every((e) =>
          (['bottom', 'shoes', 'outerwear'] as OutfitRole[]).some(
            (role) => pecaDe(e.look, role) !== pecaDe(candidato.look, role),
          ),
        )
        if (!mudouAlgoVisivel) continue
      }

      const distancia = Math.min(...escolhidos.map((e) => distanciaEntreLooks(e.look, candidato.look)))
      if (distancia >= regra.distancia) escolhidos.push(candidato)
    }
    if (escolhidos.length >= quantidade) break
  }

  return escolhidos.map((e) => e.original)
}

/**
 * Nenhuma fórmula pode inundar o ranking.
 *
 * Uma fórmula boa gera dezenas de variações, e todas ficavam no topo — por
 * isso as três opções saíam da mesma ideia. Duas por fórmula bastam para ela
 * disputar; o resto é ruído.
 */
export function limitarPorFormula<T>(
  candidatos: Array<Candidato<T>>,
  maximoPorFormula = 2,
): Array<Candidato<T>> {
  const contagem = new Map<string, number>()
  const resultado: Array<Candidato<T>> = []

  for (const c of [...candidatos].sort((a, b) => b.qualidade - a.qualidade)) {
    const chave = `${c.look.formulaId}::${c.look.familia}::${pecaDe(c.look, 'bottom') ?? '-'}`
    const usados = contagem.get(chave) ?? 0
    if (usados >= maximoPorFormula) continue
    contagem.set(chave, usados + 1)
    resultado.push(c)
  }

  return resultado
}
