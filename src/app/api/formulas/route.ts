import { getContext } from '@/services/context'
import { OUTFIT_FORMULAS } from '@/data/outfit-formulas'
import { fail, ok } from '../_lib/handler'

/**
 * Biblioteca de fórmulas.
 *
 * O motor lê a cópia em código (custo zero, sem ida ao banco). A tabela
 * `outfit_formulas` existe para inspeção e edição futura, e esta rota é o que
 * mantém as duas em sincronia.
 */
export async function GET() {
  try {
    await getContext()
    return ok({
      total: OUTFIT_FORMULAS.length,
      formulas: OUTFIT_FORMULAS.map((f) => ({
        id: f.id, name: f.name, category: f.category, style: f.style,
        occasion: f.occasion, formality: f.formality, novelty: f.novelty,
        source_type: f.source_type, source_reference: f.source_reference,
      })),
    })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Sincroniza a biblioteca de código para a tabela. Idempotente.
 *
 * Em regime normal a RLS bloqueia esta escrita de propósito: a biblioteca é
 * conhecimento compartilhado e não pode ser alterada pelo cliente. O seed é uma
 * operação administrativa — abrir a policy, sincronizar, fechar de novo.
 */
export async function POST() {
  try {
    const { repo } = await getContext()
    if (repo.driver !== 'supabase') {
      return ok({ error: 'Sincronização só faz sentido com Supabase configurado.' }, 409)
    }

    const rows = OUTFIT_FORMULAS.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      style: f.style,
      occasion: f.occasion,
      formality_min: f.formality[0],
      formality_max: f.formality[1],
      season: f.season,
      required_roles: f.required_roles,
      optional_roles: f.optional_roles,
      color_patterns: f.color_patterns,
      silhouette: f.silhouette,
      description: f.description,
      source_type: f.source_type,
      source_reference: f.source_reference,
      novelty: f.novelty,
      modesty_min: f.modesty_min,
      active: f.active,
    }))

    const synced = await repo.syncFormulas(rows)
    return ok({ synced })
  } catch (error) {
    return fail(error)
  }
}
