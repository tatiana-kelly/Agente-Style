import { getContext } from '@/services/context'
import { createWardrobeItemSchema } from '@/schemas/wardrobe'
import { BUCKETS, dataUrlToBuffer } from '@/services/image-service'
import { fail, ok } from '../_lib/handler'

export async function GET() {
  try {
    const { user, repo } = await getContext()
    const items = await repo.listItems(user.id)
    return ok({ items, driver: repo.driver })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    const { user, repo } = await getContext()
    const input = createWardrobeItemSchema.parse(await request.json())

    // A tela manda a foto como data URL. Ela vai para o Storage privado;
    // o banco fica com a referência, não com o binário.
    let imageRef: string | undefined
    let thumbRef: string | undefined

    if (input.image_original_url?.startsWith('data:')) {
      const { buffer, contentType } = dataUrlToBuffer(input.image_original_url)
      const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      const fileName = `${Date.now()}.${ext}`

      const stored = await repo.storeImage(user.id, BUCKETS.wardrobeOriginal, fileName, buffer, contentType)
      imageRef = stored.ref ?? stored.url

      // O MVP ainda não processa a imagem; a original serve de miniatura.
      const thumb = await repo.storeImage(user.id, BUCKETS.wardrobeThumbnails, fileName, buffer, contentType)
      thumbRef = thumb.ref ?? thumb.url
    }

    const item = await repo.createItem(user.id, {
      ...input,
      image_original_url: imageRef ?? input.image_original_url,
      thumbnail_url: thumbRef ?? input.thumbnail_url,
    })

    return ok({ item }, 201)
  } catch (error) {
    return fail(error)
  }
}
