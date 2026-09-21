import { getContext } from '@/services/context'
import { updateStyleProfileSchema } from '@/schemas/style-profile'
import { fail, ok } from '../_lib/handler'

export async function GET() {
  try {
    const { user, repo } = await getContext()
    return ok({ profile: await repo.getStyleProfile(user.id) })
  } catch (error) {
    return fail(error)
  }
}

/** Como a pessoa se veste no trabalho, na igreja e no tênis (§12). */
export async function PATCH(request: Request) {
  try {
    const { user, repo } = await getContext()
    const patch = updateStyleProfileSchema.parse(await request.json())
    return ok({ profile: await repo.updateStyleProfile(user.id, patch) })
  } catch (error) {
    return fail(error)
  }
}
