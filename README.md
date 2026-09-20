# Wardrobe AI

**Vista o que você já tem.** Personal stylist com IA que monta looks usando as peças
reais do seu guarda-roupa — não roupa de catálogo.

---

## O que ele faz

1. Você fotografa uma peça. A IA identifica categoria, cor, tecido, formalidade e ocasião.
2. Você diz para onde vai (partida de tênis, reunião, jantar) e em que estilo.
3. O Hermes consulta o seu armário, escolhe peças reais, explica a escolha e oferece alternativas.
4. Opcionalmente gera a visualização de você usando aquele look.
5. Cada "gostei", "troquei" ou "rejeitei" vira preferência e muda as próximas sugestões.

## Princípio que governa o código

> **Primeiro decidir as peças. Depois desenhar a imagem.**

O modelo de imagem **nunca** escolhe roupa. Quando ele roda, a composição já está fechada
e gravada no banco. Isso é o que separa este produto de um gerador de imagens.

O segundo princípio é de custo:

```
código determinístico > banco > filtros > regras > IA barata > IA de raciocínio > IA de imagem
```

Harmonia de cores, compatibilidade de peças, formalidade, escolha do conjunto e a
explicação do look são **100% determinísticos**. IA só entra para ler uma foto e para
desenhar a visualização.

---

## Arquitetura

```
Browser (Next.js App Router, mobile-first)
   |
   v
POST /api/generate-look
   |
   v
HERMES  (orquestrador — decide a sequência, monta contexto, valida)
   |
   +-- Style Agent ........ interpreta intenção, ocasião, clima, texto livre
   +-- Wardrobe Agent ..... filtra o armário; garante "só peça real"
   +-- Outfit Agent ....... monta 1 principal + 2 alternativas e explica
   +-- Image Director ..... transforma o look em prompt + referências visuais
   +-- Quality Control .... audita a imagem; no máximo 2 novas tentativas
   |
   v
Repository (Supabase  |  memória)
```

### Camadas

| Pasta | Papel |
|---|---|
| `src/schemas/` | Contratos Zod. Taxonomia fechada de categorias, cores e ocasiões. |
| `src/lib/wardrobe/` | Cores, regras de estilo, filtro de candidatos. Sem IA. |
| `src/lib/outfits/` | Composição e score do look. Sem IA. |
| `src/lib/ai/` | Classificador, controle de custo e providers de imagem. |
| `src/agents/` | Hermes e os cinco subagentes. |
| `src/services/` | Repositório (Supabase e memória), imagens e preferências. |
| `src/app/api/` | Rotas HTTP. Toda autorização passa por `getContext()`. |

### Troca de fornecedor de imagem

`ImageProvider` (`src/schemas/image.ts`) é a única fronteira. Hoje existem
`OpenAIImageProvider` e `MockImageProvider`. Para usar Replicate, Flux ou Google,
implemente a interface e ajuste `src/lib/ai/image-provider.ts` — nada mais muda.

---

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

**Funciona sem configurar nada.** Sem Supabase, o app entra em **modo demo**: 20 peças
fictícias em memória, sem login, sem persistência entre reinícios. É o suficiente para
percorrer o fluxo inteiro.

### Variáveis de ambiente

Veja [`docs/ENV.md`](docs/ENV.md) para o bloco completo e o que cada variável faz.
Copie-o para `.env.local`.

### Degradação intencional

| Falta | O que acontece |
|---|---|
| Supabase | Modo demo em memória; sem login |
| `OPENAI_API_KEY` | Classificação por heurística; visualização vira flat lay das peças |
| Teto diário de custo atingido | Look é montado e explicado, sem imagem |
| Geração de imagem falha | Look aparece com as peças e a explicação |

Nada disso derruba o fluxo. A tela sempre diz o que aconteceu.

---

## Supabase

O projeto **já existe**: `wardrobe-ai` / `wolglwwxswhhjwugufpi` / `sa-east-1`,
com as migrations aplicadas, RLS ativa e os 5 buckets privados criados.

Para recriar do zero em outro projeto:

```bash
npx supabase link --project-ref <REF>
npx supabase db push
```

As migrations em `supabase/migrations/` criam, nesta ordem:

1. `..._initial_schema.sql` — 9 tabelas, índices e o trigger que cria `public.users` no signup.
2. `..._rls_policies.sql` — RLS em todas as tabelas; cada pessoa só vê a própria linha.
3. `..._storage_buckets.sql` — 5 buckets **privados** e as policies por pasta `<user_id>/`.

### 3. Carregar o guarda-roupa demo em uma conta real

```bash
curl -X POST http://localhost:3000/api/demo
```

### Modelo de dados

```
users --+-- wardrobe_items ---+
        +-- user_photos       |
        +-- outfits ----------+-- outfit_items
        |      \_ generated_looks
        +-- user_preferences
        +-- ai_usage      (custo por chamada)
        \-- agent_runs    (cada execução do Hermes)
```

---

## Segurança e privacidade

- Fotos de corpo e guarda-roupa são dados privados. **Nenhum bucket é público.**
- Acesso a arquivo sempre por URL assinada gerada no servidor.
- RLS ativa em todas as tabelas; além dela, todo método do repositório filtra por `user_id`.
- **Não existe service role.** Todo acesso, inclusive upload, usa o cliente
  autenticado do usuário — uma chave que ignora RLS transformaria qualquer bug de
  autorização em vazamento entre contas.
- `OPENAI_API_KEY` só existe em código de servidor, e isso é verificado no bundle.
- Nenhum componente `'use client'` importa o módulo que lê segredos.

Verificado no projeto real: intruso enxerga 0 de 20 peças; arquivo por URL pública
retorna 400. Detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Testes

```bash
npm test          # 66 testes
npm run typecheck
npm run lint
npm run build
```

Cobertura por área:

| Arquivo | O que garante |
|---|---|
| `colors.test.ts` | Normalização e harmonia de cores |
| `wardrobe-filters.test.ts` | Elegibilidade por estilo; salto nunca entra em look de tênis |
| `outfit-composer.test.ts` | Composição, alternativas distintas, peça travada, peça excluída |
| `style-agent.test.ts` | Interpretação de intenção, clima e texto livre |
| `schemas.test.ts` | Validação de contratos e classificação heurística |
| `hermes.test.ts` | Roteamento, teto de custo, degradação, troca de peça |
| `integration.test.ts` | Cadastro → classificação → seleção → geração; aprendizado; smoke completo |

Todos rodam **offline**, sem Supabase e sem OpenAI.

---

## Deploy (Vercel)

O projeto Vercel `wardrobe-ai` já existe, já está vinculado (`.vercel/project.json`)
e as variáveis do Supabase já estão configuradas nos três ambientes. Falta só:

```bash
npx vercel login
npx vercel --prod
```

Para ligar a IA em produção, acrescente a chave (marque como **Sensitive**):

```bash
npx vercel env add OPENAI_API_KEY production
```

A rota `/api/generate-look` declara `maxDuration = 120` por causa da geração de imagem.

---

## Troubleshooting

**"Seu guarda-roupa está vazio"** — em Supabase real, rode `POST /api/demo` ou cadastre peças.

**"Não consegui fechar um look de X: faltam peças para Y"** — o filtro determinístico não
achou candidato para um papel obrigatório. É diagnóstico correto, não erro: cadastre uma
peça daquele tipo ou escolha outro estilo.

**Look salvo não aparece em Meus Looks (modo demo)** — o estado vive no processo do
servidor. Reiniciar o `npm run dev` limpa tudo. Configure Supabase para persistir.

**Imagem não é gerada** — confira `OPENAI_API_KEY` e o teto em `AI_MAX_DAILY_COST_USD`.
A tela informa qual dos dois barrou.

---

## Limites conhecidos do MVP

- Sem pipeline de remoção de fundo. A imagem original vira thumbnail; `image_processed_url`
  existe no schema e no Storage, mas não há etapa de processamento ainda.
- Clima é aceito na API e influencia a intenção, mas não há integração meteorológica.
- Quality Control só faz auditoria visual quando há `OPENAI_API_KEY`; sem ela, a checagem
  é estrutural.
- O provider OpenAI de imagem **não foi exercitado contra a API real**: não há
  `OPENAI_API_KEY` acessível no ambiente. Enquanto isso valem o classificador
  heurístico e o flat lay determinístico.
- O deploy ainda não foi feito: a Vercel CLI exige `vercel login` interativo.

Fora de escopo por decisão do PRP: marketplace, pagamento, provador AR, avatar 3D,
rede social, recomendação de compra.
