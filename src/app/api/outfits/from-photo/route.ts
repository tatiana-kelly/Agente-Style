import { z } from 'zod'
import { getContext } from '@/services/context'
import { createWardrobeItemSchema } from '@/schemas/wardrobe'
import { BUCKETS, dataUrlToBuffer } from '@/services/image-service'
import { styleSchema } from '@/schemas/outfit'
import { fail, ok } from '../../_lib/handler'

const bodySchema = z.object({
  image: z.string().startsWith('data:', 'Envie a foto como data URL'),
  name: z.string().min(1).max(120).optional(),
  style: styleSchema.default('casual'),
  occasion: z.string().optional(),
  items: z.array(createWardrobeItemSchema).min(1, 'Informe ao menos uma peça'),
})

/**
 * Arquiva um look que a pessoa já montou e fotografou.
 *
 * A foto vira duas coisas ao mesmo tempo: as peças entram no guarda-roupa,
 * separadas, e o conjunto vira um look salvo. É o que permite reaproveitar as
 * peças em combinações futuras em vez de guardar só uma foto solta.
 */
export async function POST(request: Request) {
  try {
    const { user, repo } = await getContext()
    const body = bodySchema.parse(await request.json())

    // A foto do conjunto é a mesma para todas as peças; a pessoa troca depois.
    const { buffer, contentType } = dataUrlToBuffer(body.image)
    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    const fileName = `look-${Date.now()}.${ext}`

    const original = await repo.storeImage(user.id, BUCKETS.wardrobeOriginal, fileName, buffer, contentType)
    const thumb = await repo.storeImage(user.id, BUCKETS.wardrobeThumbnails, fileName, buffer, contentType)
    const lookImage = await repo.storeImage(user.id, BUCKETS.generatedLooks, fileName, buffer, contentType)

    const criadas = []
    for (const item of body.items) {
      criadas.push(
        await repo.createItem(user.id, {
          ...item,
          image_original_url: original.ref ?? original.url,
          thumbnail_url: thumb.ref ?? thumb.url,
        }),
      )
    }

    const outfit = await repo.saveOutfit({
      userId: user.id,
      name: body.name?.trim() || `Look de ${new Date().toLocaleDateString('pt-BR')}`,
      style: body.style,
      occasion: body.occasion,
      explanation: 'Look que você montou e fotografou. As peças ficaram no guarda-roupa e voltam em outras combinações.',
      scores: {},
      status: 'saved',
      items: criadas.map((i) => ({ wardrobe_item_id: i.id, role: i.category })),
    })

    await repo.saveGeneratedLook({
      user_id: user.id,
      outfit_id: outfit.id,
      prompt: 'Foto enviada pela usuária',
      image_url: lookImage.ref ?? lookImage.url,
      model: 'foto-do-usuario',
      generation_metadata: { origem: 'upload' },
      quality_score: 1,
    })

    return ok({ outfitId: outfit.id, pecasCriadas: criadas.length }, 201)
  } catch (error) {
    return fail(error)
  }
}
