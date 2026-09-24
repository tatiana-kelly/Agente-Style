import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'
import type { OutfitFormula } from '@/schemas/formula'
import { colorCompatibility } from './color-engine'
import { isNeutral } from '@/lib/wardrobe/colors'

/**
 * Regras de composição — o que um consultor de imagem corrigiria no look.
 *
 * O motor antigo montava looks "válidos" e feios: blusa social com tênis,
 * calça amarela com colete marinho, e três joias douradas em toda produção.
 * Nada disso é bug de filtro — o filtro pergunta "esta peça serve ao estilo?".
 * Falta a pergunta seguinte: "estas peças funcionam JUNTAS?".
 *
 * Cada regra aqui vale para qualquer guarda-roupa e tem motivo declarado, para
 * o look poder explicar a si mesmo.
 */

export interface Peca {
  item: WardrobeItem
  role: OutfitRole
  slotAffinity: number
}

/** Peças que desenham o look. Acessório e bolsa são acabamento, não estrutura. */
const NUCLEO: readonly OutfitRole[] = ['top', 'bottom', 'dress', 'outerwear', 'shoes']

export interface RegraQuebrada {
  regra: 'formalidade' | 'cor' | 'calcado' | 'acessorio'
  motivo: string
}

export function nucleoDoLook(picks: Peca[]): Peca[] {
  return picks.filter((p) => NUCLEO.includes(p.role))
}

/** Diferença entre a peça mais formal e a menos formal do núcleo. */
export function amplitudeFormalidade(picks: Peca[]): number {
  const f = nucleoDoLook(picks).map((p) => p.item.formality)
  if (f.length < 2) return 0
  return Math.max(...f) - Math.min(...f)
}

/** Cores que pesam no look: neutro não conta, porque neutro combina com tudo. */
export function coresFortes(picks: Peca[]): string[] {
  const cores = nucleoDoLook(picks)
    .map((p) => p.item.color)
    .filter((c) => c && !isNeutral(c))
  return [...new Set(cores.map((c) => c.trim().toLowerCase()))]
}

/**
 * Alfaiataria com tênis é mistura proposital, não descuido — mas só quando a
 * fórmula pede. Fora dela, calçado esportivo com peça social é acidente.
 */
export function misturaAutorizada(formula: OutfitFormula): boolean {
  const slotCalcado = [...formula.required_roles, ...formula.optional_roles].find((s) => s.role === 'shoes')
  const aceitaTenis = Boolean(slotCalcado?.archetypes.some((a) => a === 'sneakers' || a === 'tennis_shoes'))
  return aceitaTenis && formula.formality[1] >= 6
}

export interface OpcoesCoerencia {
  /** Camada da busca: quanto mais alta, mais o motor precisa aceitar. */
  tier: number
  formula: OutfitFormula
}

/**
 * Devolve o que está errado no look. Lista vazia = look que um consultor
 * assinaria embaixo.
 */
export function avaliarCoerencia(picks: Peca[], opts: OpcoesCoerencia): RegraQuebrada[] {
  const { tier, formula } = opts
  // Tier 4 e 5 são rede de segurança: é melhor um look imperfeito do que a
  // tela dizendo "não consegui montar nada".
  if (tier >= 4) return []

  const quebras: RegraQuebrada[] = []
  const mistura = misturaAutorizada(formula)
  const nucleo = nucleoDoLook(picks)

  // 1. Registro único. Peça de festa com peça de treino não formam look.
  const limite = (tier <= 2 ? 3 : 4) + (mistura ? 2 : 0)
  const amplitude = amplitudeFormalidade(picks)
  if (amplitude > limite) {
    quebras.push({
      regra: 'formalidade',
      motivo: `A peça mais formal e a mais informal estão a ${amplitude} pontos de distância.`,
    })
  }

  // 2. Um ponto de cor. Base neutra sustenta uma cor; duas só se conversarem.
  const fortes = coresFortes(picks)
  if (fortes.length > 2) {
    quebras.push({ regra: 'cor', motivo: `${fortes.length} cores fortes disputando atenção no mesmo look.` })
  } else if (fortes.length === 2 && tier <= 2 && colorCompatibility(fortes[0], fortes[1]) < 2) {
    quebras.push({ regra: 'cor', motivo: `${fortes[0]} e ${fortes[1]} não se sustentam juntos.` })
  }

  // 3. O calçado fecha o registro do look — é o que mais denuncia incoerência.
  const calcado = nucleo.find((p) => p.role === 'shoes')
  const resto = nucleo.filter((p) => p.role !== 'shoes')
  if (calcado && resto.length > 0 && !mistura) {
    const media = resto.reduce((s, p) => s + p.item.formality, 0) / resto.length
    const distancia = Math.abs(calcado.item.formality - media)
    const tolerancia = tier <= 2 ? 3 : 4
    if (distancia > tolerancia) {
      quebras.push({
        regra: 'calcado',
        motivo: `O calçado está ${distancia.toFixed(1)} pontos fora do registro do resto do look.`,
      })
    }
  }

  // 4. Acabamento, não vitrine: acessório demais tira o foco da roupa.
  const acessorios = picks.filter((p) => p.role === 'accessory')
  if (acessorios.length > MAX_ACESSORIOS) {
    quebras.push({ regra: 'acessorio', motivo: 'Acessórios demais para um look só.' })
  }

  return quebras
}

/**
 * Dois acessórios bastam para terminar um look. O terceiro compete com os
 * outros dois em vez de somar — e era o que fazia toda produção sair com
 * colar, brinco e anel iguais.
 */
export const MAX_ACESSORIOS = 2

/**
 * Peça repetida perde posição na escolha.
 *
 * Sem isto, a mesma bolsa preta e o mesmo sapato ganhavam todo desempate e
 * apareciam em todos os looks: o app parecia ter um look só, em variações.
 */
export function penalidadeRepeticao(item: WardrobeItem, recentes: string[]): number {
  if (!recentes.includes(item.id)) return 0
  const posicao = recentes.indexOf(item.id)
  // Usada no último look pesa mais que usada cinco looks atrás.
  return posicao < 3 ? 0.3 : 0.15
}
