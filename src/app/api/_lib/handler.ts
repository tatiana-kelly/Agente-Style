import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { UnauthorizedError } from '@/services/context'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
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
  const message = error instanceof Error ? error.message : 'Erro interno'
  console.error('[api]', message)
  return NextResponse.json({ error: message }, { status: 500 })
}
