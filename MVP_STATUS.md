# MVP_STATUS

Atualizado em 20/09/2026, após a fase de execução real.

**Status geral: MVP REAL DEPLOYADO E VALIDADO EM PRODUCAO.**

Os 6 cenários do §33 passam em produção. Bug de look incompleto corrigido com
regressão. Detalhe do motor em [`docs/OUTFIT-ENGINE.md`](docs/OUTFIT-ENGINE.md).

Producao: <https://wardrobe-ai-xi-six.vercel.app>
Repositorio: <https://github.com/tatiana-kelly/Agente-Style>

| Área | Status | Evidência |
|---|---|---|
| Setup | ✅ | Next 16.3.5 · React 19.2.8 · TS 5 · Tailwind 4 · Zod 4 · vitest 5 |
| Database | ✅ **real** | Projeto `wolglwwxswhhjwugufpi` (sa-east-1). 9 tabelas, 21 índices, 4 migrations aplicadas |
| RLS | ✅ **testada** | Intruso enxerga 0 de 20 peças e 0 looks; dono enxerga as suas |
| Storage | ✅ **testado** | 5 buckets privados, upload 201, download 200, público 400, token adulterado 400 |
| Auth | ✅ **testada** | Login, sessão, rota protegida, logout, redirect pós-logout |
| Wardrobe | ✅ **real** | CREATE 20, READ, UPDATE, DELETE (soft) contra Supabase |
| AI classification | ✅ **real** | `text-vision` em produção: US$ 0,0015, 8,7 s, `source: openai` |
| Hermes | ✅ **real** | Pipeline completo, `agent_runs` gravado; ~620 ms quente em produção |
| Style Agent | ✅ | Sem custo de IA |
| Outfit Agent | ✅ **real** | Outfit Intelligence Engine: 54 fórmulas, busca em 5 camadas |
| Color engine | ✅ | 9 relações, nota 0–3, paleta com penalidade do pior par |
| Perfil de estilo | ✅ | Dress code por contexto (trabalho/igreja/tênis) + modéstia |
| Linguagem natural | ✅ | Frase livre sobrepõe o estilo marcado na tela |
| Image Director | ✅ | Prompt, referências e negativos de identidade |
| Image generation | ✅ **real** | `gpt-image-1` em produção: US$ 0,19, 44,9 s, 5 peças corretas |
| Quality Control | ✅ **real (visão)** | Auditou a imagem gerada: score 0,950, 1 tentativa, 0 ressalvas |
| Saved Looks | ✅ **real** | 4 looks salvos e listados em produção |
| Preferences | ✅ **real** | 7 preferências em 4 tipos |
| Tests | ✅ | 119 testes, todos offline |
| Security | ✅ **auditada** | 0 alertas no Supabase, 0 segredos no bundle do cliente, 0 no histórico git |
| Build | ✅ | Produção compila com env real, 18 rotas + proxy |
| Deployment | ✅ **em produção** | Vercel `gru1`, alias ativo, git conectado (push = deploy) |
| Performance | ✅ **corrigida** | Região movida para São Paulo: listar 1064 ms → 176 ms |

## Critério de sucesso do PRP §38

| Passo | Real? | Como foi verificado |
|---|---|---|
| LOGIN | ✅ real | Conta no Supabase Auth, senha, sessão em cookie |
| FOTO DO USUÁRIO | ⚠️ sintética | Upload real ao Storage, mas a imagem é um desenho em canvas — **não é foto da Tatiana**, então a preservação de identidade continua sem teste |
| CADASTRO DE ROUPAS | ✅ real | 20 linhas em `wardrobe_items` |
| IA IDENTIFICA ROUPAS | ✅ real | Visão OpenAI classificou corretamente em produção |
| GUARDA-ROUPA REAL | ✅ real | 19 peças após o teste de exclusão |
| USUÁRIO ESCOLHE OCASIÃO | ✅ real | Pela interface |
| HERMES | ✅ real | `agent_runs`: success, 1332 ms |
| SELEÇÃO DE PEÇAS REAIS | ✅ real | UUIDs do banco, nunca inventados |
| PLANO DO LOOK | ✅ real | 5 linhas em `outfit_items` |
| PERSISTÊNCIA | ✅ real | Plano 16:00:57.281 → imagem 16:00:58.088 |
| GERAÇÃO DE IMAGEM | ✅ real | `gpt-image-1`, foto editorial com as 5 peças do plano |
| QUALITY CONTROL | ✅ real | Auditoria visual aprovou com 0,950, sem ressalvas |
| IMAGEM FINAL | ✅ real | URL assinada do bucket `generated-looks` |
| TROCAR PEÇA | ✅ real | Em produção: scarpin saiu, resto preservado, entrou sapatilha |
| SALVAR LOOK | ✅ real | status `saved` |
| MEUS LOOKS | ✅ real | 4 looks listados em produção |

## Bloqueios restantes

### 1. Foto real e peças reais — o único bloqueio restante
Não há foto de corpo inteiro nem fotos de roupa no ambiente. Não vasculhei fotos
pessoais e não usei imagem fictícia para declarar teste real. A foto que subiu ao
Storage foi gerada em canvas, só para exercitar o caminho.

Consequência concreta: a imagem gerada em produção tem as 5 peças certas, mas a
pessoa nela **foi inventada pelo modelo**. Preservar rosto, cabelo e proporções é o
ponto central do produto e é exatamente o que ainda não foi exercitado.

Para fechar: em `/profile` enviar uma foto de corpo inteiro; em `/wardrobe/add`
fotografar 5 peças com foto.

## Conta de teste criada

`teste@wardrobe.ai` / `WardrobeTest!2026` — confirmada, com 19 peças e 4 looks.
Existe também `intruso@wardrobe.ai` / `Intruso!2026`, usada só para provar a RLS.
Ambas podem ser apagadas no painel do Supabase quando não forem mais úteis.
