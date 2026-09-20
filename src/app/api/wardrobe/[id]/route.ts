import { getContext } from '@/services/context'
import { updateWardrobeItemSchema } from '@/schemas/wardrobe'
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
