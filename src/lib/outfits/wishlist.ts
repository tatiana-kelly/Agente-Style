import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'
import type { OutfitFormula } from '@/schemas/formula'
import { classificarCor } from './style-dna'

/**
 * "Esse look pede isso aqui" — a peça que falta para o look ficar no ponto.
 *
 * Nas referências, o que separa uma produção boa de uma produção completa quase
 * sempre é um acessório: o cinto que marca a cintura, o scarpin nude que alonga
 * a perna, o brinco que ilumina o rosto. Aqui a sugestão sai do que o look
 * pediria E do que o guarda-roupa não tem — nunca de catálogo.
 */

export interface Peca {
  item: WardrobeItem
  role: OutfitRole
  slotAffinity: number
}

export interface Sugestao {
  /** O que comprar, em português de pessoa: "um cinto caramelo". */
  peca: string
  /** Por que ESTE look melhora com ela. */
  motivo: string
  /** Para a busca do usuário, se ele quiser procurar. */
  termoDeBusca: string
}

const temSubcategoria = (acervo: WardrobeItem[], subs: string[]) =>
  acervo.some((i) => subs.includes(i.subcategory) && i.active !== false)

const noLook = (picks: Peca[], subs: string[]) =>
  picks.some((p) => subs.includes(p.item.subcategory))

/** A peça sugerida entra na paleta do look, não numa cor solta. */
function corDeApoio(picks: Peca[]): string {
  const visiveis = picks.filter((p) => p.role !== 'accessory' && p.role !== 'bag')
  const temQuente = visiveis.some((p) => ['bege', 'creme', 'caramelo', 'marrom', 'cru'].includes(p.item.color.toLowerCase()))
  return temQuente ? 'caramelo' : 'preto'
}

/**
 * Uma sugestão por look, na ordem de quem mais transforma a produção.
 * Devolve null quando o look já está completo — sugerir por sugerir é ruído.
 */
export function sugerirCompra(
  picks: Peca[],
  acervo: WardrobeItem[],
  formula: OutfitFormula,
  /** Sugestões já feitas nas outras opções: a mesma dica três vezes é ruído. */
  evitar: ReadonlySet<string> = new Set(),
): Sugestao | null {
  for (const candidata of sugestoesPossiveis(picks, acervo, formula)) {
    if (!evitar.has(candidata.termoDeBusca)) return candidata
  }
  return null
}

/** Todas as sugestões que este look aceita, da mais transformadora à menor. */
function sugestoesPossiveis(
  picks: Peca[],
  acervo: WardrobeItem[],
  formula: OutfitFormula,
): Sugestao[] {
  const encontradas: Sugestao[] = []
  const vistas = new Set<string>()

  // Cada volta devolve a próxima regra que ainda não foi anotada.
  for (let i = 0; i < 8; i++) {
    const proxima = avaliarRegras(picks, acervo, formula, vistas)
    if (!proxima) break
    encontradas.push(proxima)
    vistas.add(proxima.termoDeBusca)
  }
  return encontradas
}

function avaliarRegras(
  picks: Peca[],
  acervo: WardrobeItem[],
  formula: OutfitFormula,
  vistas: ReadonlySet<string>,
): Sugestao | null {
  const devolver = (s: Sugestao) => (vistas.has(s.termoDeBusca) ? null : s)
  const cor = corDeApoio(picks)
  const temCima = picks.some((p) => p.role === 'top')
  const ehSocial = formula.formality[1] >= 6

  // 1. Cinto: a peça que muda a silhueta, e a mais citada nas referências.
  if (temCima && !noLook(picks, ['cinto']) && !temSubcategoria(acervo, ['cinto'])) {
    const s = devolver({
      peca: `um cinto ${cor} de fivela discreta`,
      motivo: 'Marca a cintura e dá estrutura a um look de peças retas.',
      termoDeBusca: `cinto feminino ${cor} fivela pequena`,
    })
    if (s) return s
  }

  // 2. Bolsa: sem ela o look fica sem acabamento, e ela some na foto.
  if (!picks.some((p) => p.role === 'bag') && !temSubcategoria(acervo, ['bolsa'])) {
    const s = devolver({
      peca: `uma bolsa estruturada ${cor}`,
      motivo: 'É o que fecha o look — e bolsa de cor neutra serve em quase tudo.',
      termoDeBusca: `bolsa estruturada ${cor}`,
    })
    if (s) return s
  }

  // 3. Scarpin nude: alonga a perna e resolve look social sem pesar.
  const calcado = picks.find((p) => p.role === 'shoes')?.item
  if (
    ehSocial && calcado && calcado.formality >= 6 &&
    !acervo.some((i) => i.subcategory === 'salto' && ['nude', 'bege', 'creme'].includes(i.color.toLowerCase()))
  ) {
    const s = devolver({
      peca: 'um scarpin nude',
      motivo: 'No tom da pele, ele continua a perna em vez de cortá-la — e combina com tudo.',
      termoDeBusca: 'scarpin nude bico fino',
    })
    if (s) return s
  }

  // 4. Brinco: o acessório mais barato que mais muda a foto.
  if (!noLook(picks, ['brinco']) && !temSubcategoria(acervo, ['brinco'])) {
    const s = devolver({
      peca: 'um par de brincos dourados',
      motivo: 'Ilumina o rosto e termina o look sem competir com a roupa.',
      termoDeBusca: 'brinco dourado argola pequena',
    })
    if (s) return s
  }

  // 5. Lenço: nas referências é o que põe cor sem arriscar o look inteiro.
  const soNeutros = picks
    .filter((p) => p.role !== 'accessory')
    .every((p) => classificarCor(p.item.color) === 'neutro')
  if (soNeutros && !temSubcategoria(acervo, ['lenco'])) {
    const s = devolver({
      peca: 'um lenço estampado leve',
      motivo: 'Este look está todo neutro: o lenço põe cor num lugar fácil de tirar.',
      termoDeBusca: 'lenço de seda estampado pescoço',
    })
    if (s) return s
  }

  // 6. Terceira peça: sem ela, a base boa continua parecendo roupa de casa.
  if (!picks.some((p) => p.role === 'outerwear') && !temSubcategoria(acervo, ['blazer', 'colete', 'cardiga'])) {
    const s = devolver({
      peca: ehSocial ? 'um blazer neutro de corte reto' : 'um casaquinho de tricô claro',
      motivo: 'A terceira peça é o que transforma a base em produção.',
      termoDeBusca: ehSocial ? 'blazer alfaiataria feminino bege' : 'cardigã tricô creme',
    })
    if (s) return s
  }

  // 7. Colete: peça-chave das referências que falta na maioria dos armários.
  if (ehSocial && !temSubcategoria(acervo, ['colete'])) {
    const s = devolver({
      peca: 'um colete de alfaiataria',
      motivo: 'Nas suas referências ele aparece muito: usa-se sozinho ou sob o blazer.',
      termoDeBusca: 'colete alfaiataria feminino cru',
    })
    if (s) return s
  }

  // 8. Óculos: acabamento de look de dia, e ele aparece em toda a referência.
  if (!noLook(picks, ['oculos']) && !temSubcategoria(acervo, ['oculos'])) {
    const s = devolver({
      peca: 'um óculos de sol de armação clássica',
      motivo: 'Termina o look de dia — nas suas referências ele está em quase todas.',
      termoDeBusca: 'óculos de sol feminino armação acetato',
    })
    if (s) return s
  }

  return null
}
