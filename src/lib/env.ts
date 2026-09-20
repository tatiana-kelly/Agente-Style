/**
 * Leitura única das variáveis de ambiente.
 * O app precisa subir e ser navegável mesmo sem Supabase ou OpenAI configurados:
 * sem isso, não dá para testar nada antes de provisionar a infra (PRP §46).
 */
const raw = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  openaiKey: process.env.OPENAI_API_KEY ?? '',
}

export const env = {
  ...raw,
  /** Modelo barato: classificação de peça e texto estruturado (PRP §59). */
  textModel: process.env.OPENAI_TEXT_MODEL ?? 'gpt-5-mini',
  /** Modelo de imagem: só roda quando o usuário pede a visualização. */
  imageModel: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
  maxDailyCostUsd: Number(process.env.AI_MAX_DAILY_COST_USD ?? '5'),
  maxRequestCostUsd: Number(process.env.AI_MAX_REQUEST_COST_USD ?? '0.5'),
  maxImageRetries: Number(process.env.AI_MAX_IMAGE_RETRIES ?? '2'),
} as const

/**
 * Não existe SUPABASE_SERVICE_ROLE_KEY neste sistema, por decisão.
 * Todo acesso a dado e a arquivo passa pelo cliente autenticado do usuário, com RLS.
 * Sem chave que ignore RLS, um bug de autorização não vira vazamento entre contas.
 */
export const hasSupabase = Boolean(raw.supabaseUrl && raw.supabaseAnonKey)

export const hasOpenAI = Boolean(raw.openaiKey)

/** Modo demo: sem Supabase, os dados vivem em memória e o app continua utilizável. */
export const isDemoMode = !hasSupabase
