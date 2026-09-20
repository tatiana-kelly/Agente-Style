import { getContext } from '@/services/context'
import { createWardrobeItemSchema } from '@/schemas/wardrobe'
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
    const item = await repo.createItem(user.id, input)
    return ok({ item }, 201)
  } catch (error) {
    return fail(error)
  }
}
