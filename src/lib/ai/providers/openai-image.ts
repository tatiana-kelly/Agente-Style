import OpenAI, { toFile } from 'openai'
import type { ImageGenerationInput, ImageGenerationResult, ImageProvider } from '@/schemas/image'
import { env } from '@/lib/env'
import { estimateImageCost } from '@/lib/ai/cost'

/**
 * Edição com referências visuais: a foto da pessoa vem primeiro,
 * as peças em seguida, para que o modelo trate a pessoa como base e as roupas como referência.
 */
export class OpenAIImageProvider implements ImageProvider {
  readonly name = 'openai'
  private client: OpenAI

  constructor(apiKey: string = env.openaiKey) {
    this.client = new OpenAI({ apiKey })
  }

  async generateLook(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const started = Date.now()
    try {
      const files = await Promise.all(
        input.references.map(async (ref, i) => {
          const res = await fetch(ref.url)
          if (!res.ok) throw new Error(`Falha ao baixar referência ${ref.label} (HTTP ${res.status})`)
          const buf = Buffer.from(await res.arrayBuffer())
          const ext = contentTypeToExt(res.headers.get('content-type'))
          return toFile(buf, `${ref.kind}-${i}.${ext}`, { type: `image/${ext}` })
        }),
      )

      // Sem nenhuma referência (peças ainda sem foto), a imagem nasce só do
      // texto: melhor um look desenhado do que nenhum look.
      const response =
        files.length === 0
          ? await this.client.images.generate({
              model: env.imageModel,
              prompt: buildPrompt(input),
              size: input.size,
              quality: input.quality,
              n: 1,
            })
          : await this.editarComReferencias(files, input)

      const b64Direto = response.data?.[0]?.b64_json
      if (!b64Direto) throw new Error('Resposta do modelo veio sem imagem')

      return {
        success: true,
        image_base64: b64Direto,
        model: env.imageModel,
        provider: this.name,
        estimated_cost: estimateImageCost(1, input.quality),
        latency_ms: Date.now() - started,
      }
    } catch (error) {
      return {
        success: false,
        model: env.imageModel,
        provider: this.name,
        estimated_cost: 0,
        latency_ms: Date.now() - started,
        error: error instanceof Error ? error.message : 'Erro desconhecido na geração',
      }
    }
  }

  private async editarComReferencias(
    files: Awaited<ReturnType<typeof toFile>>[],
    input: ImageGenerationInput,
  ) {
    {
      const temPessoa = input.references.some((r) => r.kind === 'person')
      return await this.client.images.edit({
        model: env.imageModel,
        image: files,
        prompt: buildPrompt(input),
        size: input.size,
        quality: input.quality,
        // Fidelidade alta preserva o rosto da referência — custa mais, então
        // só entra na imagem definitiva, não na prévia.
        ...(temPessoa && input.quality === 'high' ? { input_fidelity: 'high' as const } : {}),
        n: 1,
      })
    }
  }
}

function buildPrompt(input: ImageGenerationInput): string {
  const negatives = input.negative_notes.length
    ? `\n\nNÃO FAÇA:\n${input.negative_notes.map((n) => `- ${n}`).join('\n')}`
    : ''
  return `${input.prompt}${negatives}`
}

function contentTypeToExt(ct: string | null): string {
  if (!ct) return 'png'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpeg'
  if (ct.includes('webp')) return 'webp'
  return 'png'
}
