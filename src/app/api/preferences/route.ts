import { getContext } from '@/services/context'
import { feedbackSchema } from '@/schemas/user'
import { applyFeedback } from '@/services/preference-service'
import { fail, ok } from '../_lib/handler'

export async function GET() {
  try {
    const { user, repo } = await getContext()
    return ok({ preferences: await repo.listPreferences(user.id) })
  } catch (error) {
    return fail(error)
  }
}

/** Registra o aprendizado a cada gostei / rejeitei / troquei (PRP §23). */
export async function POST(request: Request) {
  try {
    const { user, repo } = await getContext()
    const feedback = feedbackSchema.parse(await request.json())

    const outfit = await repo.getOutfit(user.id, feedback.outfit_id)
    if (!outfit) return ok({ error: 'Look não encontrado' }, 404)

    const all = await repo.listItems(user.id)
    const ids = new Set(outfit.items.map((i) => i.wardrobe_item_id))
    await applyFeedback(repo, user.id, outfit, all.filter((i) => ids.has(i.id)), feedback)

    if (feedback.action === 'saved') await repo.markOutfitSaved(user.id, outfit.id)

    return ok({ registered: true })
  } catch (error) {
    return fail(error)
  }
}
