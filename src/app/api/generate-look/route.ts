import { getContext } from '@/services/context'
import { generateLookRequestSchema } from '@/schemas/outfit'
import { runHermes } from '@/agents/hermes'
import { fail, ok } from '../_lib/handler'

export const maxDuration = 120

/** Rota principal do produto (PRP §34). Tudo passa pelo Hermes. */
export async function POST(request: Request) {
  try {
    const { user, repo } = await getContext()
    const body = generateLookRequestSchema.parse(await request.json())

    const result = await runHermes({ ...body, userId: user.id, intent: 'generate_look' }, { repo })
    if (!result.success) return ok(result, 422)

    const itemsById = new Map((await repo.listItems(user.id)).map((i) => [i.id, i]))

    return ok({
      ...result,
      // A UI precisa das peças para exibir foto e nome sem uma segunda chamada.
      proposals: result.proposals?.map((p) => ({
        outfitId: p.outfitId,
        explanation: p.proposal.explanation,
        name: p.proposal.name,
        items: p.proposal.items.map((i) => ({ role: i.role, item: itemsById.get(i.item.id) ?? i.item })),
      })),
    })
  } catch (error) {
    return fail(error)
  }
}
