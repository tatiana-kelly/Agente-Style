import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'
import type { ImageGenerationInput, ImageReference } from '@/schemas/image'
import type { StyleIntent } from '@/agents/style-agent'
import {
  MODEL_PROFILE, escolherCenario, escolherEnquadramento, escolherExpressao, escolherPose,
} from './direction'

export interface ImageDirectorInput {
  personPhotoUrl: string | null
  items: Array<{ item: WardrobeItem; role: OutfitRole }>
  intent: StyleIntent
  /** Reforços acrescentados depois de uma reprovação do Quality Control. */
  correctionNotes?: string[]
  /**
   * 'lookbook' apresenta o look na modelo editorial do app; 'try-on' veste a
   * própria pessoa, a partir da foto dela. São usos diferentes: um é catálogo
   * de inspiração, o outro é "quero ver em mim".
   */
  modo?: 'lookbook' | 'try-on'
  /** Índice da opção (0,1,2): muda enquadramento e expressão entre as três. */
  variacao?: number
}

/**
 * Traduz o look já decidido em instrução para o modelo de imagem.
 * Não escolhe peça: quando este agente roda, a decisão já foi tomada (PRP §19).
 */
export function runImageDirector(input: ImageDirectorInput): ImageGenerationInput {
  const references: ImageReference[] = []

  if (input.modo === 'try-on' && input.personPhotoUrl) {
    references.push({ kind: 'person', url: input.personPhotoUrl, label: 'Pessoa (identidade a preservar)' })
  }

  for (const { item, role } of input.items) {
    const url = item.image_processed_url ?? item.image_original_url
    if (url) {
      references.push({ kind: 'garment', url, label: `${role}: ${item.name}` })
    }
  }

  return {
    prompt: buildPrompt(input),
    negative_notes: buildNegatives(input),
    references,
    garments: input.items.map(({ item, role }) => ({ role, name: item.name, color: item.color })),
    size: '1024x1536',
    // Quem chama decide: prévia das 3 opções baixa, look salvo alto.
    quality: 'high',
  }
}

function buildPrompt(input: ImageDirectorInput): string {
  const described = input.items.map(({ item, role }) => describeGarment(item, role)).join('\n')
  const tryOn = input.modo === 'try-on' && Boolean(input.personPhotoUrl)

  // Dois modos, dois sujeitos. No lookbook a modelo é sempre a mesma, para as
  // três opções parecerem uma sessão de fotos e não três pessoas diferentes.
  const subject = tryOn
    ? `Use a PRIMEIRA imagem de referência como a pessoa.
Preserve exatamente rosto, tom de pele, cabelo, altura e proporções corporais.`
    : MODEL_PROFILE

  const pose = escolherPose(input.items)
  const cenario = escolherCenario(input.intent.occasion)
  const variacao = input.variacao ?? 0

  const corrections = input.correctionNotes?.length
    ? `

CORREÇÕES OBRIGATÓRIAS DESTA TENTATIVA:
${input.correctionNotes.map((c) => `- ${c}`).join('\n')}`
    : ''

  return `Fotografia editorial de moda, uma única pessoa, corpo inteiro.

${subject}

POSE (${pose.nome}): ${pose.descricao}
${escolherExpressao(variacao)}
ENQUADRAMENTO: ${escolherEnquadramento(variacao)}

VISTA A PESSOA EXATAMENTE COM ESTAS PEÇAS, e apenas com elas:
${described}

As imagens de referência seguintes são as peças reais do guarda-roupa.
Reproduza cor, corte, comprimento, textura e caimento de cada uma com fidelidade.

CENÁRIO: ${cenario}. O cenário fica em segundo plano e levemente desfocado —
a roupa é a protagonista.
LUZ: natural e suave, cores fiéis às peças, sem filtro e sem estouro de luz.
ACABAMENTO: editorial de moda contemporâneo, nítido, elegante, natural.
Da cabeça aos pés, com o calçado inteiro visível no quadro.${corrections}`
}

function describeGarment(item: WardrobeItem, role: OutfitRole): string {
  const bits = [
    `${roleLabel(role)}: ${item.name}`,
    `cor ${item.color}`,
    item.pattern !== 'liso' ? `estampa ${item.pattern}` : null,
    item.material !== 'desconhecido' ? `material ${item.material}` : null,
  ].filter(Boolean)
  return `- ${bits.join(', ')}`
}

function roleLabel(role: OutfitRole): string {
  const labels: Record<OutfitRole, string> = {
    top: 'Parte de cima',
    bottom: 'Parte de baixo',
    dress: 'Vestido',
    shoes: 'Calçado',
    outerwear: 'Sobreposição',
    accessory: 'Acessório',
    bag: 'Bolsa',
  }
  return labels[role]
}

function buildNegatives(input: ImageDirectorInput): string[] {
  const negatives = [
    'pose rígida de catálogo: braços retos colados ao corpo e corpo de frente parado',
    'cenário chamativo que compita com a roupa',
    'alterar o rosto, o cabelo ou as proporções da pessoa da referência',
    'adicionar qualquer peça de roupa que não esteja na lista',
    'trocar as cores das peças',
    'mãos ou pés deformados, membros extras, dedos a mais',
    'cortar o calçado fora do enquadramento',
    "incluir texto, marca d'água ou logotipo inventado",
    'colocar mais de uma pessoa na cena',
  ]
  if (!input.items.some((i) => i.role === 'outerwear')) {
    negatives.push('adicionar casaco, blazer ou jaqueta')
  }
  if (!input.items.some((i) => i.role === 'bag')) {
    negatives.push('adicionar bolsa ou mochila')
  }
  return negatives
}
