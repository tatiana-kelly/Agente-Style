import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getContext } from '@/services/context'
import { BUCKETS, dataUrlToBuffer } from '@/services/image-service'
import { fail, ok } from '../../_lib/handler'

const bodySchema = z.object({
  image: z.string().startsWith('data:', 'Envie a foto como data URL'),
})

/**
 * Guarda a foto do lote, uma vez só.
 *
 * Nunca destruir a original (PRP §9): cada peça recebe o seu recorte, mas a
 * foto de onde ele saiu fica preservada, e o metadata da peça aponta para ela
 * junto com a caixa. Isso permite recortar de novo se a caixa veio torta.
 */
export async function POST(request: Request) {
  try {
    const { user, repo } = await getContext()
    const { image } = bodySchema.parse(await request.json())
    const { buffer, contentType } = dataUrlToBuffer(image)
    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'

    const stored = await repo.storeImage(
      user.id,
      BUCKETS.wardrobeOriginal,
      `lote-${randomUUID()}.${ext}`,
      buffer,
      contentType,
    )
    return ok({ ref: stored.ref ?? stored.url }, 201)
  } catch (error) {
    return fail(error)
  }
}
