import { colorFamily, normalizeColor } from '@/lib/wardrobe/colors'
import { colorCompatibility } from './color-engine'
import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'

/**
 * Style DNA — a linguagem visual das referências que a Tatiana escolheu.
 *
 * As pranchas que ela trouxe (casual chic, terninho, colete, casaquinho, jeans
 * com blazer, monocromático, all black, neutros sofisticados) têm uma
 * assinatura de cor muito clara: base neutra, um ponto de cor no máximo, e
 * nada de cor forte disputando com cor forte.
 *
 * A pergunta que este módulo responde não é "estas cores podem conviver?",
 * e sim "este look se parece com o que ela considera bonito?".
 */

/** Neutros que sustentam qualquer look das referências. */
export const NEUTROS_PRIMARIOS = [
  'branco', 'off-white', 'offwhite', 'cru', 'creme', 'bege', 'areia', 'nude',
  'caramelo', 'camel', 'preto', 'marinho', 'azul-marinho', 'cinza', 'grafite',
  'chumbo', 'jeans', 'denim', 'prata', 'dourado', 'ouro', 'neutro',
]

/** Cores que funcionam como quase-neutro: entram em peça grande sem pesar. */
export const SECUNDARIAS = ['marrom', 'chocolate', 'cafe', 'café', 'bordô', 'bordo', 'vinho', 'terracota', 'rosa-claro']

export type ClasseDeCor = 'neutro' | 'secundaria' | 'accent'

export function classificarCor(cor: string): ClasseDeCor {
  const n = normalizeColor(cor)
  if (NEUTROS_PRIMARIOS.includes(n)) return 'neutro'
  if (SECUNDARIAS.includes(n)) return 'secundaria'
  // Família neutra cobre variações que a lista não prevê ("off white sujo").
  if (colorFamily(cor) === 'neutro') return 'neutro'
  return 'accent'
}

export interface Peca {
  item: WardrobeItem
  role: OutfitRole
  slotAffinity: number
}

const ESTRUTURA: readonly OutfitRole[] = ['top', 'bottom', 'dress', 'outerwear']

/**
 * Paleta aprovada = 1 dominante + neutro + no máximo 1 ponto de cor.
 *
 * O calçado e a bolsa entram na conta como ponto de cor quando fogem do
 * neutro: sapato vermelho não é detalhe, é decisão de look.
 */
export function avaliarPaleta(picks: Peca[]): {
  aprovada: boolean
  accents: string[]
  motivo?: string
  nota: number
} {
  const visiveis = picks.filter((p) => p.role !== 'accessory')
  const cores = visiveis.map((p) => p.item.color).filter(Boolean)
  if (cores.length === 0) return { aprovada: true, accents: [], nota: 1 }

  const accents = [...new Set(
    visiveis
      .filter((p) => classificarCor(p.item.color) === 'accent')
      .map((p) => normalizeColor(p.item.color)),
  )]

  const secundarias = [...new Set(
    visiveis
      .filter((p) => classificarCor(p.item.color) === 'secundaria')
      .map((p) => normalizeColor(p.item.color)),
  )]

  // Duas cores fortes é o erro clássico: azul com vermelho, verde com laranja.
  if (accents.length >= 2) {
    return {
      aprovada: false,
      accents,
      motivo: `${accents.join(' e ')} disputam o mesmo look — nas suas referências entra uma cor por vez.`,
      nota: 0.2,
    }
  }

  // Um ponto de cor exige base neutra de verdade, não uma segunda cor média.
  if (accents.length === 1 && secundarias.length >= 2) {
    return {
      aprovada: false,
      accents,
      motivo: `${accents[0]} pede base neutra, e a base aqui já tem ${secundarias.join(' e ')}.`,
      nota: 0.35,
    }
  }

  // O ponto de cor precisa conversar com a estrutura do look.
  const estrutura = visiveis.filter((p) => ESTRUTURA.includes(p.role))
  if (accents.length === 1 && estrutura.length > 1) {
    const pior = Math.min(
      ...estrutura
        .filter((p) => classificarCor(p.item.color) !== 'accent')
        .map((p) => colorCompatibility(p.item.color, accents[0])),
      3,
    )
    if (pior < 2) {
      return {
        aprovada: false,
        accents,
        motivo: `${accents[0]} não conversa com o resto do look.`,
        nota: 0.3,
      }
    }
  }

  // Nota: quanto mais perto da receita das referências, melhor.
  const neutros = visiveis.filter((p) => classificarCor(p.item.color) === 'neutro').length
  const proporcaoNeutra = neutros / visiveis.length
  // Look todo neutro vale MAIS que look com ponto de cor: é a leitura direta
  // das referências dela, onde a cor é exceção e não regra.
  const nota = Math.min(1, 0.5 + proporcaoNeutra * 0.35 + (accents.length === 0 ? 0.15 : 0))

  return { aprovada: true, accents, nota }
}

/**
 * Combinações que aparecem repetidas nas referências. Não são obrigatórias —
 * ganham prioridade quando o guarda-roupa permite.
 */
const COMBINACOES_DE_OURO: ReadonlyArray<readonly string[]> = [
  ['jeans', 'branco', 'bege'],
  ['bege', 'creme', 'caramelo'],
  ['preto', 'branco', 'caramelo'],
  ['marinho', 'branco', 'bege'],
  ['marrom', 'creme', 'bege'],
  ['preto', 'preto'],
  ['creme', 'creme'],
  ['bege', 'bege'],
  ['branco', 'off-white'],
  ['marrom', 'caramelo'],
]

/** 0..1 — o quanto a paleta do look repete uma receita das referências. */
export function afinidadeComReferencias(picks: Peca[]): number {
  const cores = picks
    .filter((p) => p.role !== 'accessory')
    .map((p) => normalizeColor(p.item.color))
  if (cores.length === 0) return 0.5

  let melhor = 0
  for (const receita of COMBINACOES_DE_OURO) {
    const presentes = receita.filter((c) => cores.includes(c)).length
    const cobertura = presentes / receita.length
    // A receita precisa aparecer quase inteira para contar como "o look dela".
    if (cobertura > melhor) melhor = cobertura
  }

  const neutros = cores.filter((c) => classificarCor(c) === 'neutro').length / cores.length
  return Math.min(1, melhor * 0.6 + neutros * 0.4)
}
