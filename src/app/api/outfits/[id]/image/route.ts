import { getContext } from '@/services/context'
import { renderLookImage } from '@/agents/hermes'
import { fail, ok } from '../../../_lib/handler'

export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

/**
 * Gera a visualização de um look já montado.
 *
 * Duas velocidades: `qualidade: 'previa'` veste as 3 opções assim que elas
 * saem — qualidade média, uma tentativa, sem checagem visual — e 'final' dá
 * acabamento ao look que a pessoa salvou. Ver o look no corpo é o produto;
 * pedir clique para isso era o que deixava a tela parada.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { user, repo } = await getContext()

    const body = await request.json().catch(() => ({}))
    const qualidade = body?.qualidade === 'previa' ? 'previa' : 'final'

    const result = await renderLookImage({ repo, userId: user.id, outfitId: id, qualidade })
    if (!result.success) return ok({ error: result.error ?? 'Não consegui gerar a imagem.' }, 422)

    return ok({ imageUrl: result.imageUrl, costUsd: result.costUsd })
  } catch (error) {
    return fail(error)
  }
}
