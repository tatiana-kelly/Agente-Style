import { getContext } from '@/services/context'
import { styleSchema } from '@/schemas/outfit'
import { fail, ok } from '../_lib/handler'

export async function GET(request: Request) {
  try {
    const { user, repo } = await getContext()
    const styleParam = new URL(request.url).searchParams.get('style')
    const style = styleParam ? styleSchema.parse(styleParam) : undefined

    const outfits = await repo.listOutfits(user.id, style)
    const items = await repo.listItems(user.id)
    const byId = new Map(items.map((i) => [i.id, i]))

    return ok({
      outfits: outfits.map((o) => ({
        ...o,
        resolvedItems: o.items
          .map((oi) => ({ role: oi.role, item: byId.get(oi.wardrobe_item_id) }))
          .filter((x) => Boolean(x.item)),
        generatedImageUrl: null as string | null,
      })),
    })
  } catch (error) {
    return fail(error)
  }
}
