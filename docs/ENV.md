# Variáveis de ambiente

> **Por que este arquivo existe e não um `.env.example`:** o ambiente desta máquina
> bloqueia a criação e a leitura de qualquer arquivo `.env*` por agentes. O conteúdo
> abaixo é exatamente o que deveria estar em `.env.example` — copie o bloco para
> `.env.local` (desenvolvimento) e preencha os valores.

```bash
# ---------------------------------------------------------------- Supabase
# Sem estas duas, o app sobe em MODO DEMO: guarda-roupa fictício em memória,
# nada é persistido e o login não é exigido.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Somente servidor. NUNCA prefixar com NEXT_PUBLIC_.
# Usada para upload no Storage privado e para gerar URLs assinadas.
SUPABASE_SERVICE_ROLE_KEY=

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

## O que cada uma faz

| Variável | Obrigatória | Efeito se faltar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | não | Modo demo (memória) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | não | Modo demo (memória) |
| `SUPABASE_SERVICE_ROLE_KEY` | para Storage | Imagens voltam como data URL em vez de irem para o bucket |
| `OPENAI_API_KEY` | não | Classificação heurística + flat lay no lugar da foto gerada |
| `OPENAI_TEXT_MODEL` | não | Usa `gpt-5-mini` |
| `OPENAI_IMAGE_MODEL` | não | Usa `gpt-image-1` |
| `AI_MAX_DAILY_COST_USD` | não | Usa US$ 5 |
| `AI_MAX_REQUEST_COST_USD` | não | Usa US$ 0,50 |
| `AI_MAX_IMAGE_RETRIES` | não | Usa 2 |

## Regra de segurança

Só `NEXT_PUBLIC_*` chega ao navegador. `SUPABASE_SERVICE_ROLE_KEY` e
`OPENAI_API_KEY` são lidas apenas em código de servidor
(`src/lib/supabase/admin.ts`, `src/lib/ai/*`). Nenhum componente marcado
`'use client'` importa `@/lib/env` para ler segredo.

Ao configurar na Vercel, marque as duas chaves privadas como **Sensitive** e
não as exponha em Preview de forks.
