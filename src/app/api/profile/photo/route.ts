import { z } from 'zod'
import { getContext } from '@/services/context'
import { BUCKETS, dataUrlToBuffer } from '@/services/image-service'
import { fail, ok } from '../../_lib/handler'

const bodySchema = z.object({
  image: z.string().startsWith('data:', 'Envie a foto como data URL'),
})

/**
 * Foto principal do usuário — a referência que preserva a identidade na geração.
 * Vai para bucket privado sob `<user_id>/`; a policy de Storage faz a autorização.
 */
export async function POST(request: Request) {
  try {
    const { user, repo } = await getContext()
    const { image } = bodySchema.parse(await request.json())

    const { buffer, contentType } = dataUrlToBuffer(image)
    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'

    const stored = await repo.storeImage(
      user.id,
      BUCKETS.userPhotos,
      `principal-${Date.now()}.${ext}`,
      buffer,
      contentType,
    )

    // O banco guarda a referência; a resposta devolve a URL assinada para a tela.
    await repo.setPrimaryPhoto(user.id, stored.ref ?? stored.url)

    return ok({ url: stored.url }, 201)
  } catch (error) {
    return fail(error)
  }
}
