import OpenAI from 'openai'
import type { ImageGenerationInput, ImageGenerationResult, QualityReport } from '@/schemas/image'
import { env, hasOpenAI } from '@/lib/env'
import { estimateTextCost } from '@/lib/ai/cost'

export interface QualityControlInput {
  result: ImageGenerationResult
  request: ImageGenerationInput
  attempt: number
  maxAttempts: number
  /**
   * Prévia não passa pela checagem visual: ela custa uma chamada de visão e
   * alguns segundos por imagem, e aqui são três de uma vez. A checagem
   * estrutural, que é grátis, continua rodando.
   */
  skipVision?: boolean
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
  if (input.skipVision || !structural.approved || !hasOpenAI || !input.result.image_base64) {
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
  // Sem referência visual não é falha: no modo lookbook a imagem nasce da
  // descrição, e peça sem foto cadastrada é o caso comum de quem está começando.
  const semReferencia = request.references.length === 0
  if (semReferencia) issues.push('Sem foto das peças: usei a descrição para desenhar o look.')

  const hasPerson = request.references.some((r) => r.kind === 'person')
  if (!hasPerson) issues.push('Sem foto da pessoa: o look foi apresentado na modelo do app.')

  const bloqueios = issues.filter((i) => !i.startsWith('Sem foto'))
  const approved = result.success && bloqueios.length === 0
  const score = approved ? (hasPerson ? 0.75 : semReferencia ? 0.55 : 0.65) : 0

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

const VISION_SYSTEM = `Você audita imagens geradas de moda, com olho de editor de moda.
Responda SOMENTE JSON:
{"approved":boolean,"score":number(0..1),"apresentacao":number(0..1),"issues":string[],"corrections":string[]}

REPROVE (fidelidade — o look é o plano, a imagem só mostra):
- mais de uma pessoa na cena;
- membros, mãos ou dedos deformados;
- peça de roupa que não estava na lista;
- cor de peça diferente da pedida;
- calçado cortado fora do enquadramento ou pés fora do quadro.

AVALIE a apresentação em "apresentacao" (0..1), e reprove abaixo de 0,4:
- pose rígida de catálogo: braços retos colados ao corpo, corpo de frente parado;
- expressão artificial ou "cara de documento";
- aparência de manequim de vitrine em vez de pessoa;
- cenário que rouba a atenção da roupa;
- luz estourada ou filtro que falseia a cor das peças.

"corrections" são instruções curtas e acionáveis para regerar — incluindo pose e
enquadramento quando o problema for de apresentação.`

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
    /** Nota de apresentação: pose, naturalidade, presença editorial. */
    apresentacao?: number
    issues?: string[]
    corrections?: string[]
  }

  const usage = completion.usage
  const cost = estimateTextCost(usage?.prompt_tokens ?? 800, usage?.completion_tokens ?? 150)
  const apresentacao = clamp01(parsed.apresentacao ?? 0.7)
  // Fidelidade e apresentação reprovam por caminhos diferentes: a primeira é
  // erro de conteúdo, a segunda é foto de catálogo — e as duas derrubam o look.
  const approved = (parsed.approved ?? true) && apresentacao >= 0.4
  const issues = [...(parsed.issues ?? [])]
  if (apresentacao < 0.4) issues.push('A imagem ficou com cara de catálogo: pose e presença fracas.')

  return {
    approved,
    score: clamp01(((parsed.score ?? (approved ? 0.85 : 0.3)) + apresentacao) / 2),
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
