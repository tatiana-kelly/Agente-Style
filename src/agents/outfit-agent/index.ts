import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'
import { generateCandidates, signature, type EngineContext, type OutfitCandidate } from '@/lib/outfits/engine'
import { describeRelation } from '@/lib/outfits/color-engine'
import { occasionLabel, styleLabel } from '@/lib/labels'

export interface OutfitProposal {
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
  const proposals = result.candidates.map((c) => toProposal(c, ctx))

  return {
    primary: proposals[0] ?? null,
    alternatives: proposals.slice(1),
    missingRoles: result.missingRoles,
    tierUsed: result.tierUsed,
    formulasTried: result.formulasTried,
  }
}

function toProposal(candidate: OutfitCandidate, ctx: EngineContext): OutfitProposal {
  const anchor = candidate.items.find((i) => i.role === 'dress' || i.role === 'top')?.item
  const base = anchor ? anchor.name : styleLabel(ctx.style)

  return {
    items: candidate.items.map((i) => ({ item: i.item, role: i.role })),
    scores: candidate.scores as unknown as Record<string, number>,
    explanation: explain(candidate, ctx),
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
function explain(candidate: OutfitCandidate, ctx: EngineContext): string {
  const partes: string[] = []
  const { formula, palette } = candidate

  const anchor = candidate.items.find((i) => i.role === 'dress' || i.role === 'top')?.item
  const bottom = candidate.items.find((i) => i.role === 'bottom')?.item
  const shoes = candidate.items.find((i) => i.role === 'shoes')?.item

  const ocasiao = occasionLabel(ctx.occasion ?? ctx.style).toLowerCase()

  // A prosa cita as PEÇAS REAIS e o princípio, nunca o nome da fórmula: o nome
  // usa arquétipos ("pantalona") que podem não descrever a peça que entrou
  // ("calça de alfaiataria"), e soaria como se eu estivesse inventando a roupa.
  if (anchor && bottom) {
    partes.push(`Montei ${anchor.name.toLowerCase()} com ${bottom.name.toLowerCase()}.`)
  } else if (anchor) {
    partes.push(`Escolhi ${anchor.name.toLowerCase()} como peça única.`)
  }

  // Rede de segurança: se a descrição da fórmula cita uma peça que não entrou
  // no look, ela é omitida. Explicação que menciona blazer num look sem blazer
  // não é imprecisão de estilo — é o sistema inventando roupa.
  if (descricaoConfere(formula.description, candidate)) {
    partes.push(capitalize(formula.description))
  }

  // Cor: dizer QUAL relação, não só "combina".
  partes.push(`As cores formam ${describeRelation(palette.dominant)}.`)

  if (shoes) {
    if (shoes.sport_type === 'tenis') {
      partes.push(`O ${shoes.name.toLowerCase()} é o calçado correto para quadra — solado e estabilidade certos.`)
    } else if (shoes.formality >= 7) {
      partes.push(`O ${shoes.name.toLowerCase()} sustenta a formalidade pedida por ${ocasiao}.`)
    } else {
      partes.push(`Fechei com ${shoes.name.toLowerCase()}, que mantém o conjunto no registro certo.`)
    }
  }

  // Ser honesto quando a resposta veio de um plano B.
  if (candidate.tier >= 3) {
    partes.push('Seu guarda-roupa não tinha a combinação ideal para este pedido, então flexibilizei a formalidade para fechar um look completo.')
  }
  if (candidate.unmetRoles.length > 0) {
    partes.push(`Faltou ${candidate.unmetRoles.join(' e ')} no guarda-roupa para completar esta fórmula.`)
  }

  return partes.join(' ')
}

/** Palavras de peça que, se citadas, precisam existir no look. */
const PECAS_CITAVEIS: Array<[RegExp, (i: { role: OutfitRole; item: WardrobeItem }) => boolean]> = [
  [/blazer/i, (i) => i.item.subcategory === 'blazer'],
  [/casaco|sobretudo/i, (i) => i.item.subcategory === 'casaco'],
  [/corta-vento/i, (i) => i.item.subcategory === 'corta-vento'],
  [/cardig/i, (i) => i.item.subcategory === 'cardiga'],
  [/joia|colar|brinco/i, (i) => ['joia', 'bijuteria'].includes(i.item.subcategory)],
  [/bolsa/i, (i) => i.role === 'bag'],
  [/salto/i, (i) => i.item.subcategory === 'salto'],
]

function descricaoConfere(descricao: string, candidate: OutfitCandidate): boolean {
  for (const [re, presente] of PECAS_CITAVEIS) {
    if (re.test(descricao) && !candidate.items.some(presente)) return false
  }
  return true
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
