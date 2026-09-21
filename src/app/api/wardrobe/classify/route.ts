import { z } from 'zod'
import { getContext } from '@/services/context'
import { classifyGarment } from '@/lib/ai/classifier'
import { fail, ok } from '../../_lib/handler'

const bodySchema = z.object({
  image: z.string().min(1, 'Envie a imagem em data URL'),
  hint: z.string().max(200).optional(),
})

/** Classificação da peça no upload (PRP §8). */
export async function POST(request: Request) {
  try {
    const { user, repo } = await getContext()
    const { image, hint } = bodySchema.parse(await request.json())

    const result = await classifyGarment(image, hint)

    await repo.logAiUsage({
      user_id: user.id,
      provider: result.source === 'openai' ? 'openai' : 'local',
      model: result.source === 'openai' ? 'text-vision' : 'heuristic',
      operation: 'classify_garment',
      estimated_cost: result.estimated_cost,
      latency_ms: result.latency_ms,
      success: true,
    })

    return ok({
      items: result.items,
      source: result.source,
      warning: result.warning,
    })
  } catch (error) {
    return fail(error)
  }
}
