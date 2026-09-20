import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'
import type { ImageGenerationInput, ImageReference } from '@/schemas/image'
import type { StyleIntent } from '@/agents/style-agent'

export interface ImageDirectorInput {
  personPhotoUrl: string | null
  items: Array<{ item: WardrobeItem; role: OutfitRole }>
  intent: StyleIntent
  /** Reforços acrescentados depois de uma reprovação do Quality Control. */
  correctionNotes?: string[]
}

/**
 * Traduz o look já decidido em instrução para o modelo de imagem.
 * Não escolhe peça: quando este agente roda, a decisão já foi tomada (PRP §19).
 */
export function runImageDirector(input: ImageDirectorInput): ImageGenerationInput {
  const references: ImageReference[] = []

  if (input.personPhotoUrl) {
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
  }
}

function buildPrompt(input: ImageDirectorInput): string {
  const described = input.items.map(({ item, role }) => describeGarment(item, role)).join('\n')
  const hasPhoto = Boolean(input.personPhotoUrl)

  const subject = hasPhoto
    ? 'Use a PRIMEIRA imagem de referência como a pessoa. Preserve exatamente rosto, tom de pele, cabelo, altura e proporções corporais.'
    : 'Gere uma pessoa de corpo inteiro, em pose natural e neutra.'

  const corrections = input.correctionNotes?.length
    ? `\n\nCORREÇÕES OBRIGATÓRIAS DESTA TENTATIVA:\n${input.correctionNotes.map((c) => `- ${c}`).join('\n')}`
    : ''

  return `Fotografia editorial de moda, corpo inteiro, uma única pessoa.

${subject}

VISTA A PESSOA EXATAMENTE COM ESTAS PEÇAS, e apenas com elas:
${described}

As imagens de referência seguintes são as peças reais do guarda-roupa. Reproduza cor, corte, comprimento e detalhes de cada uma com fidelidade.

Contexto: ${input.intent.style.replace(/-/g, ' ')}, ocasião ${input.intent.occasion.replace(/-/g, ' ')}.
Cenário: fundo neutro e limpo, luz natural suave, foco na roupa.
Enquadramento: corpo inteiro, da cabeça aos pés, calçado totalmente visível.${corrections}`
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
