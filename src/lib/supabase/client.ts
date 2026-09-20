'use client'

import { createBrowserClient } from '@supabase/ssr'
import { env, hasSupabase } from '@/lib/env'

/** Cliente de browser. Só usa a anon key — nunca a service role (PRP §41). */
export function createClient() {
  if (!hasSupabase) return null
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey)
}
