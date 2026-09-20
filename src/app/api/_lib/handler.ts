import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { UnauthorizedError } from '@/services/context'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

/** Erro do PostgREST/Supabase: objeto simples, não instância de Error. */
interface PostgrestLike {
  message?: string
  details?: string
  hint?: string
  code?: string
}

function isPostgrestError(e: unknown): e is PostgrestLike {
  return typeof e === 'object' && e !== null && 'message' in e && ('code' in e || 'details' in e)
}

/** Erro sempre com formato estável: a UI nunca recebe stack trace (PRP §58). */
export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      { status: 422 },
    )
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // Sem este ramo, toda falha de banco vira "Erro interno" e o log não diz nada.
  if (isPostgrestError(error)) {
    console.error('[api] postgrest', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return NextResponse.json({ error: error.message ?? 'Falha no banco de dados' }, { status: 500 })
  }

  const message = error instanceof Error ? error.message : 'Erro interno'
  console.error('[api]', message, error)
  return NextResponse.json({ error: message }, { status: 500 })
}
