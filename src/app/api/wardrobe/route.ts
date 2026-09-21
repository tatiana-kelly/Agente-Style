import { randomUUID } from 'node:crypto'
import { getContext } from '@/services/context'
import { createWardrobeItemSchema } from '@/schemas/wardrobe'
import { BUCKETS, dataUrlToBuffer, type BucketName } from '@/services/image-service'
import type { Repository } from '@/services/repository'
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

/**
 * Grava um data URL no bucket e devolve a referência.
 *
 * Nome com UUID, nunca `Date.now()`: no cadastro em lote três peças sobem ao
 * mesmo tempo, e com `upsert` dois uploads no mesmo milissegundo gravavam no
 * mesmo arquivo — uma peça sobrescrevia a foto da outra.
 */
async function guardar(
  repo: Repository,
  userId: string,
  bucket: BucketName,
  dataUrl: string,
  base: string,
): Promise<string> {
  const { buffer, contentType } = dataUrlToBuffer(dataUrl)
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  const stored = await repo.storeImage(userId, bucket, `${base}.${ext}`, buffer, contentType)
  return stored.ref ?? stored.url
}

export async function POST(request: Request) {
  try {
    const { user, repo } = await getContext()
    const input = createWardrobeItemSchema.parse(await request.json())
    const base = randomUUID()

    // Cada peça grava o SEU recorte. O banco fica com referências, não binário.
    const original = input.image_original_url?.startsWith('data:')
      ? await guardar(repo, user.id, BUCKETS.wardrobeOriginal, input.image_original_url, base)
      : input.image_original_url

    // Versão sem fundo, quando o navegador conseguiu remover. Vai para o bucket
    // de processadas — que existia desde o início e nunca tinha sido usado.
    const processada = input.image_processed_url?.startsWith('data:')
      ? await guardar(repo, user.id, BUCKETS.wardrobeProcessed, input.image_processed_url, base)
      : input.image_processed_url

    // Miniatura: a versão limpa quando existe, senão o recorte com fundo.
    const fonteMiniatura = input.image_processed_url?.startsWith('data:')
      ? input.image_processed_url
      : input.image_original_url?.startsWith('data:')
        ? input.image_original_url
        : null
    const miniatura = fonteMiniatura
      ? await guardar(repo, user.id, BUCKETS.wardrobeThumbnails, fonteMiniatura, base)
      : input.thumbnail_url

    const item = await repo.createItem(user.id, {
      ...input,
      image_original_url: original,
      image_processed_url: processada,
      thumbnail_url: miniatura,
    })

    return ok({ item }, 201)
  } catch (error) {
    return fail(error)
  }
}
