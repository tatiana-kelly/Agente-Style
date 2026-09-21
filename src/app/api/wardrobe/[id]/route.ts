import { randomUUID } from 'node:crypto'
import { getContext } from '@/services/context'
import { updateWardrobeItemSchema } from '@/schemas/wardrobe'
import { BUCKETS, dataUrlToBuffer } from '@/services/image-service'
import { fail, ok } from '../../_lib/handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { user, repo } = await getContext()
    const item = await repo.getItem(user.id, id)
    if (!item) return ok({ error: 'Peça não encontrada' }, 404)
    return ok({ item })
  } catch (error) {
    return fail(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { user, repo } = await getContext()
    const patch = updateWardrobeItemSchema.parse(await request.json())

    // Foto nova chega como data URL. Vai para o Storage privado e o banco fica
    // com a referência, igual ao cadastro — senão um JPEG de 700 KB entraria
    // numa coluna de texto e a listagem do guarda-roupa ficaria inviável.
    if (patch.image_original_url?.startsWith('data:')) {
      const { buffer, contentType } = dataUrlToBuffer(patch.image_original_url)
      const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      const fileName = `${randomUUID()}.${ext}`

      const stored = await repo.storeImage(user.id, BUCKETS.wardrobeOriginal, fileName, buffer, contentType)
      const thumb = await repo.storeImage(user.id, BUCKETS.wardrobeThumbnails, fileName, buffer, contentType)

      patch.image_original_url = stored.ref ?? stored.url
      patch.thumbnail_url = thumb.ref ?? thumb.url
    } else {
      // Sem foto nova, não tocar nas referências já salvas: a listagem devolve
      // URLs assinadas, e gravá-las de volta apagaria a referência do Storage.
      delete patch.image_original_url
      delete patch.thumbnail_url
    }

    const item = await repo.updateItem(user.id, id, patch)
    if (!item) return ok({ error: 'Peça não encontrada' }, 404)
    return ok({ item })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { user, repo } = await getContext()
    const deleted = await repo.deleteItem(user.id, id)
    if (!deleted) return ok({ error: 'Peça não encontrada' }, 404)
    return ok({ deleted: true })
  } catch (error) {
    return fail(error)
  }
}
