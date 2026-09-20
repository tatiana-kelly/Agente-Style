import { getContext } from '@/services/context'
import { fail, ok } from '../../_lib/handler'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { user, repo } = await getContext()
    const outfit = await repo.getOutfit(user.id, id)
    if (!outfit) return ok({ error: 'Look não encontrado' }, 404)

    const look = await repo.getGeneratedLook(user.id, id)
    return ok({ outfit, generatedImageUrl: look?.image_url ?? null })
  } catch (error) {
    return fail(error)
  }
}

/** "Salvar look": muda o status de draft para saved (PRP §22). */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { user, repo } = await getContext()
    const saved = await repo.markOutfitSaved(user.id, id)
    if (!saved) return ok({ error: 'Look não encontrado' }, 404)
    return ok({ saved: true })
  } catch (error) {
    return fail(error)
  }
}
