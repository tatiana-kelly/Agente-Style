import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'
import { generateCandidates, signature, type EngineContext, type OutfitCandidate } from '@/lib/outfits/engine'
import { describeRelation } from '@/lib/outfits/color-engine'
import { avaliarPaleta } from '@/lib/outfits/style-dna'
import { occasionLabel, roleLabel, styleLabel } from '@/lib/labels'

export interface OutfitProposal {
  /** Como a opção se apresenta na tela: "Casual chic", "Mais elegante"… */
  etiqueta: string
  items: Array<{ item: WardrobeItem; role: OutfitRole }>
  scores: Record<string, number>
  explanation: string
  name: string
  formulaId: string
  formulaName: string
  tier: number
  signature: string
}

export interface OutfitAgentOutput {
  primary: OutfitProposal | null
  alternatives: OutfitProposal[]
  missingRoles: OutfitRole[]
  tierUsed: number
  formulasTried: number
}

/**
 * Monta o conjunto e escreve a justificativa.
 * Nenhuma chamada de modelo: o motor sabe POR QUE escolheu, então a explicação
 * é derivada do motivo real e não de prosa gerada (§28).
 */
export function runOutfitAgent(items: WardrobeItem[], ctx: EngineContext, count = 3): OutfitAgentOutput {
  const result = generateCandidates(items, ctx, count)
  const proposals = etiquetar(result.candidates.map((c) => toProposal(c, ctx)))

  return {
    primary: proposals[0] ?? null,
    alternatives: proposals.slice(1),
    missingRoles: result.missingRoles,
    tierUsed: result.tierUsed,
    formulasTried: result.formulasTried,
  }
}

/**
 * As três opções precisam se apresentar pelo que TÊM de diferente. "Opção 2"
 * não ajuda ninguém a escolher; "Mais elegante" e "Confortável" ajudam.
 */
function etiquetar(propostas: OutfitProposal[]): OutfitProposal[] {
  if (propostas.length === 0) return propostas

  const formalidade = (p: OutfitProposal) =>
    p.items.reduce((s, i) => s + i.item.formality, 0) / Math.max(p.items.length, 1)

  const ordenadas = [...propostas].sort((a, b) => formalidade(b) - formalidade(a))
  const etiquetas = new Map<OutfitProposal, string>()

  if (propostas.length >= 3) {
    etiquetas.set(ordenadas[0], 'Mais elegante')
    etiquetas.set(ordenadas[ordenadas.length - 1], 'Mais confortável')
    for (const p of ordenadas.slice(1, -1)) etiquetas.set(p, p.formulaName)
  } else if (propostas.length === 2) {
    etiquetas.set(ordenadas[0], 'Mais elegante')
    etiquetas.set(ordenadas[1], 'Mais confortável')
  }

  return propostas.map((p) => ({ ...p, etiqueta: etiquetas.get(p) ?? p.formulaName }))
}

function toProposal(candidate: OutfitCandidate, ctx: EngineContext): OutfitProposal {
  const anchor = candidate.items.find((i) => i.role === 'dress' || i.role === 'top')?.item
  const base = anchor ? anchor.name : styleLabel(ctx.style)

  return {
    etiqueta: candidate.formula.name,
    items: candidate.items.map((i) => ({ item: i.item, role: i.role })),
    scores: candidate.scores as unknown as Record<string, number>,
    explanation: explain(candidate),
    name: `${base} · ${occasionLabel(ctx.occasion ?? ctx.style)}`,
    formulaId: candidate.formula.id,
    formulaName: candidate.formula.name,
    tier: candidate.tier,
    signature: signature(candidate),
  }
}

/**
 * A explicação encadeia: a fórmula que guiou, a relação de cor encontrada e o
 * papel do calçado. Tudo vem de dado real da peça — nada é inventado sobre a roupa.
 */
function explain(candidate: OutfitCandidate): string {
  const partes: string[] = []
  const { formula } = candidate

  const nome = (role: OutfitRole) =>
    candidate.items.find((i) => i.role === role)?.item.name.toLowerCase()

  const cima = nome('top')
  const vestido = nome('dress')
  const baixo = nome('bottom')
  const calcado = nome('shoes')
  const terceira = candidate.items.find((i) => i.role === 'outerwear')?.item
  const bolsa = nome('bag')
  const acessorios = candidate.items.filter((i) => i.role === 'accessory')

  // 1. O look, dito como uma stylist diria: as peças, na ordem em que se veste.
  const pecas = [vestido ?? cima, baixo, terceira?.name.toLowerCase(), calcado, bolsa]
    .filter(Boolean)
    .join(' + ')
  if (pecas) partes.push(`${capitalize(formula.name)}: ${pecas}.`)

  // 2. Por que esta paleta — é a pergunta que ela fez sobre os looks ruins.
  partes.push(razaoDaPaleta(candidate))

  // 3. O que a terceira peça e o calçado estão fazendo ali.
  if (terceira) {
    partes.push(`${capitalize(terceira.name.toLowerCase())} é a terceira peça: é ela que transforma a base em look.`)
  }
  const sapato = candidate.items.find((i) => i.role === 'shoes')?.item
  if (sapato) {
    if (sapato.sport_type === 'tenis') {
      partes.push(`${capitalize(sapato.name.toLowerCase())} é o calçado certo para a quadra.`)
    } else if (sapato.formality >= 7) {
      partes.push(`${capitalize(sapato.name.toLowerCase())} eleva o conjunto sem endurecer.`)
    } else {
      partes.push(`${capitalize(sapato.name.toLowerCase())} mantém o look no registro do dia.`)
    }
  }
  if (acessorios.length > 0) {
    partes.push(`Terminei com ${acessorios.map((a) => a.item.name.toLowerCase()).join(' e ')}.`)
  }

  // 4. Honestidade sobre plano B — continua valendo.
  if (candidate.tier >= 3) {
    partes.push('Seu guarda-roupa não tinha a combinação ideal para este pedido, então flexibilizei para fechar um look completo.')
  }
  if (candidate.unmetRoles.length > 0) {
    const faltando: Record<string, string> = {
      top: 'uma parte de cima', bottom: 'uma parte de baixo', shoes: 'um calçado',
      dress: 'um vestido', outerwear: 'uma sobreposição',
      accessory: 'um acessório', bag: 'uma bolsa',
    }
    const lista = candidate.unmetRoles.map((r) => faltando[r] ?? roleLabel(r).toLowerCase())
    partes.push(`Falta ${lista.join(' e ')} no seu guarda-roupa para fechar este look.`)
  }

  return partes.join(' ')
}

/**
 * A paleta explicada como escolha, não como cálculo. "Análoga com 0,82" não
 * diz nada a quem vai vestir; "neutros, que é o que mais aparece nas suas
 * referências" diz.
 */
function razaoDaPaleta(candidate: OutfitCandidate): string {
  const dna = avaliarPaleta(candidate.items)
  if (dna.accents.length === 1) {
    return `Deixei ${dna.accents[0]} como único ponto de cor, sobre base neutra.`
  }
  if (candidate.palette.dominant === 'MONOCHROMATIC') {
    return 'Tom sobre tom: a silhueta fica inteira, sem corte no meio.'
  }
  if (candidate.palette.dominant === 'TONAL') {
    return 'Neutros na mesma família, que é a paleta que mais aparece nas suas referências.'
  }
  return `Paleta neutra: ${describeRelation(candidate.palette.dominant)}.`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
