import { getContext } from '@/services/context'
import { adicionarTerceiraPeca } from '@/agents/hermes'
import { fail, ok } from '../../../_lib/handler'

type Params = { params: Promise<{ id: string }> }

/**
 * Acrescenta a terceira peça a um look já montado.
 *
 * Existe para não refazer o look inteiro quando a pessoa só quer um casaco:
 * esfriou, ela toca no botão, e o resto do look continua exatamente o mesmo.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { user, repo } = await getContext()

    const resultado = await adicionarTerceiraPeca({ repo, userId: user.id, outfitId: id })
    if (!resultado.success) return ok({ error: resultado.error }, 422)

    return ok({ item: resultado.item })
  } catch (error) {
    return fail(error)
  }
}
