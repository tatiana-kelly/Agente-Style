# MVP_STATUS

Atualizado em 20/09/2026, após a fase de execução real.

**Status geral: MVP REAL — bloqueado no deploy por login interativo da Vercel.**

| Área | Status | Evidência |
|---|---|---|
| Setup | ✅ | Next 16.3.5 · React 19.2.8 · TS 5 · Tailwind 4 · Zod 4 · vitest 5 |
| Database | ✅ **real** | Projeto `wolglwwxswhhjwugufpi` (sa-east-1). 9 tabelas, 21 índices, 4 migrations aplicadas |
| RLS | ✅ **testada** | Intruso enxerga 0 de 20 peças e 0 looks; dono enxerga as suas |
| Storage | ✅ **testado** | 5 buckets privados, upload 201, download 200, público 400, token adulterado 400 |
| Auth | ✅ **testada** | Login, sessão, rota protegida, logout, redirect pós-logout |
| Wardrobe | ✅ **real** | CREATE 20, READ, UPDATE, DELETE (soft) contra Supabase |
| AI classification | ⚠️ heurística | Visão OpenAI implementada, **não exercitada** — sem chave |
| Hermes | ✅ **real** | Pipeline completo em 2,1 s, `agent_runs` gravado |
| Style Agent | ✅ | Sem custo de IA |
| Outfit Agent | ✅ **real** | 5 peças reais + 2 alternativas, confiança 1.0 |
| Image Director | ✅ | Prompt, referências e negativos de identidade |
| Image generation | ⚠️ mock | `OpenAIImageProvider` implementado, **não exercitado** — sem chave |
| Quality Control | ⚠️ estrutural | Auditoria visual exige chave; estrutural rodou (score 0,75, 1 tentativa) |
| Saved Looks | ✅ **real** | 2 looks salvos e listados |
| Preferences | ✅ **real** | 7 preferências em 4 tipos |
| Tests | ✅ | 66 testes, todos offline |
| Security | ✅ **auditada** | 0 alertas no Supabase, 0 segredos no bundle do cliente, 0 no histórico git |
| Performance | ✅ | Look sem imagem = US$ 0; assinatura de URL agrupada por bucket |
| Build | ✅ | Produção compila com env real, 18 rotas + proxy |
| Deployment | ⛔ **bloqueado** | Projeto Vercel criado e pré-vinculado; falta `vercel login` |

## Critério de sucesso do PRP §38

| Passo | Real? | Como foi verificado |
|---|---|---|
| LOGIN | ✅ real | Conta no Supabase Auth, senha, sessão em cookie |
| FOTO DO USUÁRIO | ⚠️ sintética | Upload real ao Storage, mas a imagem foi gerada em canvas — **não é foto da Tatiana** |
| CADASTRO DE ROUPAS | ✅ real | 20 linhas em `wardrobe_items` |
| IA IDENTIFICA ROUPAS | ⚠️ heurística | Sem `OPENAI_API_KEY` |
| GUARDA-ROUPA REAL | ✅ real | 19 peças após o teste de exclusão |
| USUÁRIO ESCOLHE OCASIÃO | ✅ real | Pela interface |
| HERMES | ✅ real | `agent_runs`: success, 1332 ms |
| SELEÇÃO DE PEÇAS REAIS | ✅ real | UUIDs do banco, nunca inventados |
| PLANO DO LOOK | ✅ real | 5 linhas em `outfit_items` |
| PERSISTÊNCIA | ✅ real | Plano 16:00:57.281 → imagem 16:00:58.088 |
| GERAÇÃO DE IMAGEM | ⚠️ mock | Flat lay determinístico, gravado no Storage real |
| QUALITY CONTROL | ⚠️ estrutural | Aprovou com 0,75 em 1 tentativa |
| IMAGEM FINAL | ✅ real | URL assinada do bucket `generated-looks` |
| SALVAR LOOK | ✅ real | status `saved` |
| MEUS LOOKS | ✅ real | 2 looks listados |

## Bloqueios restantes — ambos exigem ação humana

### 1. `OPENAI_API_KEY` ausente
Procurada em: variáveis do shell, arquivos do projeto, `~`, configuração da Vercel.
**Não existe** em nenhum lugar acessível. Sem ela, classificação por visão e geração
real de imagem ficam sem teste — e eu não vou declarar testado o que não rodou.

### 2. Vercel exige login interativo
A CLI não está autenticada e `vercel login` abre o navegador. O MCP da Vercel está
autenticado e foi usado para criar o projeto e as variáveis, mas não expõe uma rota
de deploy a partir de código local.

Já preparado: projeto `wardrobe-ai` criado, 5 variáveis configuradas nos três
ambientes, `.vercel/project.json` escrito (CLI já vinculada), build de produção
validado com as credenciais reais.

## Conta de teste criada

`teste@wardrobe.ai` / `WardrobeTest!2026` — confirmada, com as 19 peças e 2 looks.
Existe também `intruso@wardrobe.ai` / `Intruso!2026`, usada só para provar a RLS.
Ambas podem ser apagadas no painel do Supabase quando não forem mais úteis.
