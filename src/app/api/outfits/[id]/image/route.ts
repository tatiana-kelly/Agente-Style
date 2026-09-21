import { getContext } from '@/services/context'
import { renderLookImage } from '@/agents/hermes'
import { fail, ok } from '../../../_lib/handler'

export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

/**
 * Gera a visualização de um look já montado.
 *
 * Separado do /generate-look de propósito: as 3 opções saem sem imagem e cada
 * uma vira imagem só se a pessoa pedir. Gerar as três de saída custaria US$ 0,57
 * por pedido para mostrar duas que ela talvez nem escolha.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { user, repo } = await getContext()

    const result = await renderLookImage({ repo, userId: user.id, outfitId: id })
    if (!result.success) return ok({ error: result.error ?? 'Não consegui gerar a imagem.' }, 422)

    return ok({ imageUrl: result.imageUrl, costUsd: result.costUsd })
  } catch (error) {
    return fail(error)
  }
}
