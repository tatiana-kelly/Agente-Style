import { createServerSupabase } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/env'
import { DEMO_USER_EMAIL, DEMO_USER_ID } from '@/data/demo-wardrobe'
import { memoryRepository } from './memory-repository'
import { SupabaseRepository } from './supabase-repository'
import type { Repository } from './repository'

export interface SessionUser {
  id: string
  email: string
  isDemo: boolean
}

export interface RequestContext {
  user: SessionUser
  repo: Repository
}

/**
 * Resolve usuário + driver de dados em um único ponto.
 * Sem Supabase configurado o app cai no usuário demo em vez de quebrar (PRP §38).
 */
export async function getContext(): Promise<RequestContext> {
  if (isDemoMode) {
    return {
      user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL, isDemo: true },
      repo: memoryRepository,
    }
  }

  const supabase = await createServerSupabase()
  if (!supabase) {
    return {
      user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL, isDemo: true },
      repo: memoryRepository,
    }
  }

  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new UnauthorizedError()

  return {
    user: { id: data.user.id, email: data.user.email ?? '', isDemo: false },
    repo: new SupabaseRepository(supabase),
  }
}

export class UnauthorizedError extends Error {
  readonly status = 401
  constructor() {
    super('Sessão não encontrada. Faça login para continuar.')
    this.name = 'UnauthorizedError'
  }
}
