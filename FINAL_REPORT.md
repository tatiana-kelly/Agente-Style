# FINAL_REPORT — Wardrobe AI

20 de setembro de 2026 · `C:\Projeto ClaudeCode\wardrobe-ai`

---

## 1. Resumo

MVP funcional de personal stylist com IA, construído do zero. O app sobe, navega,
classifica peça, monta look com peças reais, explica a escolha, oferece alternativas,
permite trocar peça e salvar — tudo validado no navegador e coberto por 58 testes.

Três coisas **não** foram concluídas, todas por dependência externa:

| Pendência | Motivo | Quem resolve |
|---|---|---|
| Projeto Supabase | Criar custa **US$ 10/mês**; a transação foi bloqueada nesta sessão | Tatiana aprova e cria |
| `OPENAI_API_KEY` | A chave não está disponível para o agente | Tatiana cola em `.env.local` |
| Deploy na Vercel | Exige aprovação explícita (regra do CLAUDE.md) | Tatiana autoriza |

Por causa disso, o app foi construído para **funcionar sem nenhuma das três**. Em modo
demo ele roda com 20 peças fictícias em memória, classificação heurística e visualização
em flat lay. É software executável hoje, não arquitetura no papel.

---

## 2. Arquitetura

```
Browser (Next.js App Router · mobile-first)
   |
   v
POST /api/generate-look
   |
   v
HERMES — orquestrador
   |
   +-- Style Agent ....... intenção, ocasião, clima, texto livre
   +-- Wardrobe Agent .... filtra o armário; garante "só peça real"
   +-- Outfit Agent ...... 1 principal + 2 alternativas + explicação
   +-- Image Director .... prompt + referências + negativos de identidade
   +-- Quality Control ... auditoria; no máximo 2 retries
   |
   v
Repository  →  Supabase  |  memória
```

### Decisão estrutural que define o produto

`LOOK PLANNING` e `IMAGE RENDERING` são etapas separadas e o plano é **persistido antes**
de qualquer gasto com imagem. O modelo de imagem recebe a composição fechada; ele nunca
decide o que vestir. É o que impede o produto de virar um gerador de imagens bonito e
inútil.

### Decisão de custo

Ordem obedecida em todo o código:

```
código determinístico > banco > filtros > regras > IA barata > IA de raciocínio > IA de imagem
```

Harmonia de cores, elegibilidade por estilo, montagem do conjunto, score e **a própria
explicação do look** são determinísticos. Chamar um modelo para escrever "preto combina
com branco" seria queimar token à toa.

---

## 3. Agentes

| Agente | Arquivo | Usa IA? |
|---|---|---|
| Hermes | `src/agents/hermes/index.ts` | não — orquestra |
| Style Agent | `src/agents/style-agent/index.ts` | não — regex e regras |
| Wardrobe Agent | `src/agents/wardrobe-agent/index.ts` | não — filtro + score |
| Outfit Agent | `src/agents/outfit-agent/index.ts` | não — enumeração + score |
| Image Director | `src/agents/image-director/index.ts` | não — monta o prompt |
| Quality Control | `src/agents/quality-control/index.ts` | sim, se houver chave |

Só dois pontos do sistema chamam modelo: **classificar a foto da peça** e **gerar/auditar
a imagem do look**.

---

## 4. Banco de dados

9 tabelas em `supabase/migrations/`: `users`, `wardrobe_items`, `user_photos`, `outfits`,
`outfit_items`, `generated_looks`, `user_preferences`, `ai_usage`, `agent_runs`.

- RLS ativa em todas; política `auth.uid() = user_id`.
- `outfit_items` não tem `user_id` — a posse é herdada de `outfits` via `exists`.
- Índices parciais por `user_id + category`, `sport_type` e `formality`, que são exatamente
  as colunas do pré-filtro determinístico.
- Trigger `on_auth_user_created` cria a linha em `public.users` no signup.
- `unique (user_id, preference_type, value)` sustenta o upsert de preferência.

**Status: escritas e revisadas, não aplicadas** — não há projeto Supabase.

---

## 5. APIs

| Rota | Método | Função |
|---|---|---|
| `/api/generate-look` | POST | Rota principal. Tudo passa pelo Hermes. |
| `/api/wardrobe` | GET, POST | Listar e cadastrar peça |
| `/api/wardrobe/[id]` | GET, PATCH, DELETE | Ler, corrigir e remover peça |
| `/api/wardrobe/classify` | POST | Classificação da foto no upload |
| `/api/outfits` | GET | Looks salvos, com filtro por estilo |
| `/api/outfits/[id]` | GET, POST | Detalhe e "salvar look" |
| `/api/preferences` | GET, POST | Aprendizado por feedback |
| `/api/profile` | GET, PATCH | Perfil e preferências de estilo |
| `/api/demo` | POST | Carrega as 20 peças demo em conta real |

Toda rota resolve usuário e driver por `getContext()`. Erro sai sempre no mesmo formato,
nunca com stack trace.

---

## 6. IA utilizada

| Uso | Modelo padrão | Quando roda | Custo estimado |
|---|---|---|---|
| Classificar peça | `gpt-5-mini` (visão, `detail: low`) | no upload | ~US$ 0,0005 |
| Auditar imagem | `gpt-5-mini` (visão) | após gerar | ~US$ 0,0006 |
| Gerar look | `gpt-image-1` | só se o usuário pedir | ~US$ 0,19 |

Imagem enviada ao classificador é reduzida a 768 px no navegador antes do upload —
menos payload, menos custo, e o celular não trava subindo 12 MP.

### Freios de custo

- Teto por requisição: US$ 0,50 (`CostBudget`)
- Teto diário por usuário: US$ 5,00 (consultado em `ai_usage` antes de gerar)
- Máximo de 2 retries após reprovação do Quality Control
- Atingido qualquer teto, o look é entregue **sem imagem**, com a explicação do porquê

---

## 7. Image generation

`ImageProvider` é a fronteira única (`src/schemas/image.ts`). Duas implementações:

- **`OpenAIImageProvider`** — `images.edit` com múltiplas referências: a foto da pessoa
  primeiro, as peças em seguida. Prompt com negativos explícitos de preservação de
  identidade (não alterar rosto, cabelo, proporções; não inventar peça; não cortar o calçado).
- **`MockImageProvider`** — flat lay SVG determinístico com as cores reais das peças
  escolhidas. É o que aparece hoje, sem chave.

Trocar para Replicate, Flux ou Google é implementar a interface e mudar uma função.

---

## 8. Testes executados

```
npm test        → 58 passed (7 arquivos)
npm run typecheck → 0 erros
npm run lint      → 0 problemas
npm run build     → sucesso, 16 rotas
```

Todos os testes rodam **offline**, sem Supabase e sem OpenAI.

Validação manual no navegador (375×812, modo demo):

- Home, guarda-roupa com 20 peças, busca e filtros
- `/create-look` → "Partida de tênis" + "Tênis" → **Montar meu look**
- Resultado correto: top esportivo branco + skort branco + tênis de quadra + viseira + raqueteira
- Explicação gerada, 2 alternativas, botões de feedback
- **Salvar** → `/outfits` mostra "1 look salvo"

---

## 9. Problemas encontrados

1. **Classificação errada de acessório esportivo.** "Viseira rosa de tênis" virava calçado:
   a palavra genérica "tênis" casava antes das entradas específicas. Encontrado por teste.
2. **Estado demo não sobrevivia entre rotas.** O look salvo não aparecia em Meus Looks —
   Next empacota páginas e route handlers separadamente, gerando instâncias distintas do
   repositório em memória. Encontrado no navegador, não nos testes.
3. **Imagem mock vinha vazia.** As peças demo não têm foto, então o provider não recebia
   nada para desenhar.
4. **Amostras de cor indistinguíveis.** Preto, branco e bege caíam todos na família
   "neutro" e viravam o mesmo bloco bege no grid.
5. **`middleware` depreciado** no Next 16.
6. **`setState` dentro de `useEffect`** no contador de progresso — erro de lint.
7. **Conflito de peer dependency** entre vitest 5 e `@types/node@20`.

## 10. Problemas resolvidos

1. Ordem de precedência explícita no classificador; "tênis" genérico foi para o fim da lista
   e `de tênis` passou a qualificar o esporte, não a peça. Comentado no código.
2. Singleton em `globalThis` para o repositório em memória — padrão do Next para estado
   de processo. Revalidado no navegador: "1 look salvo".
3. Novo campo `garments` em `ImageGenerationInput`, sempre preenchido pelo Image Director
   independente de haver URL. O mock passou a desenhar um flat lay com as cores reais.
4. Mapa de cor exata antes do mapa de família, com contraste automático da inicial.
5. Migrado para `proxy.ts` via codemod oficial.
6. Reset do contador movido para o disparo da requisição.
7. `@types/node` alinhado em `^22` (resolve o conflito de verdade, sem `--legacy-peer-deps`).

**Nenhum problema ficou em aberto no código entregue.**

---

## 11. Variáveis necessárias

Bloco completo em [`docs/ENV.md`](docs/ENV.md).

> O ambiente desta máquina bloqueia criar ou ler qualquer arquivo `.env*` por agente —
> por isso não existe `.env.example` no repositório. O conteúdo está em `docs/ENV.md`
> para você copiar para `.env.local`.

Obrigatórias para produção: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.

---

## 12. Deploy

**Não executado** — deploy exige aprovação explícita.

A Vercel está autenticada nesta sessão, no time SAL Express
(`team_8kU5gZk9UKfHzc1gDCJ3JTWx`). Vale decidir se um produto de consumo deve mesmo
morar nesse time ou em uma conta pessoal.

```bash
cd "C:\Projeto ClaudeCode\wardrobe-ai"
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add OPENAI_API_KEY production
npx vercel --prod
```

## 13. URL da aplicação

Não há URL de produção. Localmente: **http://localhost:3000** (`npm run dev`).

## 14. Como executar localmente

```bash
cd "C:\Projeto ClaudeCode\wardrobe-ai"
npm install
npm run dev
```

Funciona sem configurar nada, em modo demo.

---

## 15. Custos estimados

| Item | Custo |
|---|---|
| Supabase (projeto novo) | **US$ 10/mês** — ainda não criado |
| Classificar uma peça | ~US$ 0,0005 |
| Montar um look sem imagem | **US$ 0** — é tudo determinístico |
| Montar um look com imagem | ~US$ 0,19 (+0,0006 de auditoria) |
| Um usuário cadastrando 50 peças | ~US$ 0,03 |
| Teto diário por usuário | US$ 5,00 (configurável) |

Montar look sem visualização custa zero. Esse foi o desenho, não um acidente.

---

## 16. Próximas evoluções

**Imediato, para destravar o MVP**

1. Aprovar e criar o projeto Supabase; rodar `supabase db push`.
2. Colar a `OPENAI_API_KEY` e validar a geração real de imagem contra a API — é o único
   trecho não exercitado em produção.
3. Decidir o time da Vercel e fazer o primeiro deploy.

**Curto prazo**

4. Pipeline de normalização de imagem (remoção de fundo, thumbnail, `image_processed_url`).
5. Integração de clima — a interface já aceita e o Style Agent já reage.
6. Upload da foto principal do usuário pela tela de perfil.

**Arquitetura já preparada, não implementada** (respeitando o escopo do PRP): agente de
mala, personal shopping por gaps, look por agenda, WhatsApp.
