# MVP_STATUS

Atualizado em 20/09/2026.

| Área | Status | Observação |
|---|---|---|
| Setup | ✅ | Next 16.3.5 · React 19.2.8 · TS 5 · Tailwind 4 · Zod 4 · vitest 5 |
| Database | ⚠️ | 3 migrations escritas e revisadas; **não aplicadas** — criar o projeto Supabase foi bloqueado |
| Auth | ⚠️ | Login, signup, magic link, logout e proxy de proteção prontos; não exercitado sem Supabase |
| Storage | ⚠️ | 5 buckets privados + policies por pasta escritos; fallback data URL funcionando |
| Wardrobe | ✅ | Listar, buscar, filtrar, cadastrar, editar campos, excluir |
| AI classification | ✅ | Visão OpenAI quando há chave; heurística determinística sempre |
| Hermes | ✅ | Pipeline completo, orquestração, log de execução, degradação |
| Style Agent | ✅ | Intenção, ocasião, clima, texto livre — sem custo de IA |
| Outfit Agent | ✅ | 1 principal + 2 alternativas, explicação, peça travada e excluída |
| Image Director | ✅ | Prompt estruturado, referências e negativos de preservação de identidade |
| Image generation | ⚠️ | Abstração pronta; OpenAI implementado mas **não testado contra a API real** |
| Quality Control | ✅ | Checagem estrutural sempre; auditoria visual com chave; máx. 2 retries |
| Saved Looks | ✅ | Salvar, listar, filtrar por estilo |
| Preferences | ✅ | Gostei / rejeitei / trocou / regerou viram peso estruturado |
| Tests | ✅ | 58 testes, todos offline |
| Security | ✅ | RLS, ownership em todo método, segredos só no servidor |
| Deployment | ⚠️ | Build de produção passa; deploy não executado (sem autenticação Vercel confirmada) |

## Critério de sucesso do PRP §49

| # | Passo | Verificado |
|---|---|---|
| 1 | Usuário entra | ✅ modo demo / ⚠️ login real não exercitado |
| 2 | Cadastra foto | ✅ tela pronta; placeholder por padrão |
| 3 | Adiciona roupas | ✅ navegador |
| 4 | IA identifica as peças | ✅ heurística; visão pendente de chave |
| 5 | Peças aparecem no guarda-roupa | ✅ navegador |
| 6 | Seleciona "Tênis" | ✅ navegador |
| 7 | Seleciona "Jogo" | ✅ navegador |
| 8 | Hermes consulta as peças | ✅ navegador + teste |
| 9 | Escolhe combinação | ✅ top esportivo + skort + tênis de quadra + viseira + raqueteira |
| 10 | Imagem é gerada | ⚠️ flat lay determinístico; foto real pendente de chave |
| 11 | Resultado aparece | ✅ navegador |
| 12 | Troca uma peça | ✅ teste de integração |
| 13 | Nova combinação é gerada | ✅ teste de integração |
| 14 | Salva | ✅ navegador |
| 15 | Look aparece em "Meus Looks" | ✅ navegador — "1 look salvo" |

## O que falta, e de quem depende

1. **Criar o projeto Supabase** (US$ 10/mês) — bloqueado por política de transação real nesta sessão. Depende da Tatiana.
2. **Colar a `OPENAI_API_KEY`** em `.env.local` — só então a classificação por visão e a imagem real do look rodam.
3. **Deploy na Vercel** — depende dos dois itens acima para valer a pena em produção.
