'use client'

import { createBrowserClient } from '@supabase/ssr'

/*
 * Este módulo NÃO importa `@/lib/env` de propósito.
 *
 * `@/lib/env` lê OPENAI_API_KEY. Importá-lo aqui arrastava esse módulo para o
 * bundle do navegador: o valor não vazava (Next resolve para string vazia no
 * cliente), mas bastava alguém acrescentar um segredo ao objeto `env` para o
 * vazamento passar a ser real, sem nenhum aviso.
 *
 * Código de cliente lê apenas NEXT_PUBLIC_*, direto do process.env.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Cliente de browser. Só a anon key — a RLS é quem autoriza. */
export function createClient() {
  if (!url || !anonKey) return null
  return createBrowserClient(url, anonKey)
}
