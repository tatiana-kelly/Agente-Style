import OpenAI from 'openai'
import type { ImageGenerationInput, ImageGenerationResult, QualityReport } from '@/schemas/image'
import { env, hasOpenAI } from '@/lib/env'
import { estimateTextCost } from '@/lib/ai/cost'

export interface QualityControlInput {
  result: ImageGenerationResult
  request: ImageGenerationInput
  attempt: number
  maxAttempts: number
}

export interface QualityControlOutput extends QualityReport {
  /** Notas a devolver ao Image Director quando houver nova tentativa. */
  correctionNotes: string[]
  estimated_cost: number
  checkedBy: 'vision' | 'structural'
}

/**
 * Verificação pós-geração (PRP §20).
 * A checagem estrutural roda sempre e é grátis; a visual só quando há chave.
 */
export async function runQualityControl(input: QualityControlInput): Promise<QualityControlOutput> {
  const structural = structuralCheck(input)
  if (!structural.approved || !hasOpenAI || !input.result.image_base64) {
    return structural
  }

  try {
    const visual = await visionCheck(input)
    return visual
  } catch {
    // Falha na verificação não invalida a imagem: aprova com ressalva.
    return { ...structural, issues: [...structural.issues, 'Verificação visual indisponível nesta execução.'] }
  }
}

function structuralCheck(input: QualityControlInput): QualityControlOutput {
  const issues: string[] = []
  const { result, request } = input

  if (!result.success) issues.push(result.error ?? 'Geração falhou sem detalhe.')
  if (result.success && !result.image_base64 && !result.image_url) issues.push('Resposta sem imagem utilizável.')
  if (request.references.length === 0) issues.push('Nenhuma referência visual foi enviada ao modelo.')

  const hasPerson = request.references.some((r) => r.kind === 'person')
  if (!hasPerson) issues.push('Sem foto da pessoa: a identidade não pôde ser preservada.')

  const approved = result.success && issues.filter((i) => !i.startsWith('Sem foto')).length === 0
  const score = approved ? (hasPerson ? 0.75 : 0.6) : 0

  return {
    approved,
    score,
    issues,
    retry: !approved && input.attempt < input.maxAttempts,
    correctionNotes: [],
    estimated_cost: 0,
    checkedBy: 'structural',
  }
}

const VISION_SYSTEM = `Você audita imagens geradas de moda. Responda SOMENTE JSON:
{"approved":boolean,"score":number(0..1),"issues":string[],"corrections":string[]}
Reprove se: houver mais de uma pessoa; membros ou dedos deformados; peça de roupa que não estava na lista; cor de peça diferente da pedida; calçado cortado fora do enquadramento.
"corrections" são instruções curtas e acionáveis para regerar.`

async function visionCheck(input: QualityControlInput): Promise<QualityControlOutput> {
  const client = new OpenAI({ apiKey: env.openaiKey })
  const expected = input.request.references
    .filter((r) => r.kind === 'garment')
    .map((r) => `- ${r.label}`)
    .join('\n')

  const userText = `Peças que a pessoa DEVE estar usando:\n${expected || '(sem lista)'}\n\nAudite a imagem.`

  const completion = await client.chat.completions.create({
    model: env.textModel,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VISION_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${input.result.image_base64}`, detail: 'low' },
          },
        ],
      },
    ],
  })

  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as {
    approved?: boolean
    score?: number
    issues?: string[]
    corrections?: string[]
  }

  const usage = completion.usage
  const cost = estimateTextCost(usage?.prompt_tokens ?? 800, usage?.completion_tokens ?? 150)
  const approved = parsed.approved ?? true
  const issues = parsed.issues ?? []

  return {
    approved,
    score: clamp01(parsed.score ?? (approved ? 0.85 : 0.3)),
    issues,
    retry: !approved && input.attempt < input.maxAttempts,
    correctionNotes: parsed.corrections ?? issues,
    estimated_cost: cost,
    checkedBy: 'vision',
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
