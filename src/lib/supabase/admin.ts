import { createClient } from '@supabase/supabase-js'
import { env, hasSupabaseAdmin } from '@/lib/env'

/**
 * Service role: ignora RLS.
 * Usar SOMENTE em código de servidor e sempre filtrando por user_id explicitamente.
 */
export function createAdminSupabase() {
  if (!hasSupabaseAdmin) return null
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
