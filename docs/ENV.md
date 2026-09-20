# Variáveis de ambiente

> **Por que este arquivo existe e não um `.env.example`:** o ambiente desta máquina
> bloqueia a criação e a leitura de qualquer arquivo `.env*` por agentes. O conteúdo
> abaixo é exatamente o que deveria estar em `.env.example` — copie o bloco para
> `.env.local`.

```bash
# ---------------------------------------------------------------- Supabase
# Projeto wardrobe-ai (sa-east-1). Sem estas duas, o app sobe em MODO DEMO:
# guarda-roupa fictício em memória, sem login e sem persistência.
NEXT_PUBLIC_SUPABASE_URL=https://wolglwwxswhhjwugufpi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key do projeto>

# ------------------------------------------------------------------ OpenAI
# Sem esta chave o app continua funcionando: a classificação de peça cai em
# heurística e a visualização do look vira um flat lay das peças escolhidas.
OPENAI_API_KEY=

# ------------------------------------------------------- Modelos (opcional)
OPENAI_TEXT_MODEL=gpt-5-mini
OPENAI_IMAGE_MODEL=gpt-image-1

# --------------------------------------------------- Freios de custo (US$)
AI_MAX_DAILY_COST_USD=5
AI_MAX_REQUEST_COST_USD=0.5
AI_MAX_IMAGE_RETRIES=2
```

## Não existe SUPABASE_SERVICE_ROLE_KEY

Por decisão de arquitetura, este sistema **não usa service role**.

Todo acesso a dado e a arquivo passa pelo cliente autenticado do próprio usuário,
e quem autoriza é a RLS — inclusive os uploads para o Storage, que dependem das
policies por pasta `<user_id>/`.

O motivo é simples: uma chave que ignora a RLS transforma qualquer bug de
autorização em vazamento entre contas. Sem ela, o pior caso é uma operação ser
negada, não um dado de outra pessoa aparecer.

## O que cada variável faz

| Variável | Obrigatória | Efeito se faltar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | não | Modo demo (memória) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | não | Modo demo (memória) |
| `OPENAI_API_KEY` | não | Classificação heurística + flat lay no lugar da foto gerada |
| `OPENAI_TEXT_MODEL` | não | Usa `gpt-5-mini` |
| `OPENAI_IMAGE_MODEL` | não | Usa `gpt-image-1` |
| `AI_MAX_DAILY_COST_USD` | não | Usa US$ 5 |
| `AI_MAX_REQUEST_COST_USD` | não | Usa US$ 0,50 |
| `AI_MAX_IMAGE_RETRIES` | não | Usa 2 |

## Fronteira servidor/cliente

Só `NEXT_PUBLIC_*` chega ao navegador, e isso é verificado no bundle gerado:

```bash
npm run build
grep -rlE "openaiKey|OPENAI_API_KEY" .next/static/   # tem que voltar vazio
```

`src/lib/supabase/client.ts` deliberadamente **não importa** `@/lib/env`, para que
o módulo que lê segredos nunca entre no grafo do cliente.

## Vercel

As variáveis do Supabase e os freios de custo **já estão configurados** no projeto
`wardrobe-ai` (production, preview e development). Falta apenas:

```bash
npx vercel env add OPENAI_API_KEY production
```
