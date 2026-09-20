import { getContext } from '@/services/context'
import { updateProfileSchema } from '@/schemas/user'
import { fail, ok } from '../_lib/handler'

export async function GET() {
  try {
    const { user, repo } = await getContext()
    const [profile, photo] = await Promise.all([repo.getProfile(user.id), repo.getPrimaryPhoto(user.id)])
    return ok({ profile, photo, isDemo: user.isDemo })
  } catch (error) {
    return fail(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, repo } = await getContext()
    const patch = updateProfileSchema.parse(await request.json())
    const profile = await repo.updateProfile(user.id, patch)
    return ok({ profile })
  } catch (error) {
    return fail(error)
  }
}
