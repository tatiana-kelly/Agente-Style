import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { env, hasSupabase } from '@/lib/env'

/** Cliente de servidor ligado à sessão do usuário: a RLS faz a autorização. */
export async function createServerSupabase() {
  if (!hasSupabase) return null
  const cookieStore = await cookies()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(items) {
        try {
          for (const { name, value, options } of items) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component não pode escrever cookie; o middleware renova a sessão.
        }
      },
    },
  })
}
