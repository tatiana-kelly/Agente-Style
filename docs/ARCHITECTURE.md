# Arquitetura — Wardrobe AI

## A decisão que define o produto

```
LOOK PLANNING          →   IMAGE RENDERING
"quais peças usar?"        "como mostrar a pessoa usando?"
determinístico             modelo de imagem
persistido primeiro        só depois, e só se pedido
```

O modelo de imagem **nunca** escolhe roupa. Quando o Image Director roda, a
composição já foi decidida, pontuada e **gravada no banco**.

Isso é verificável, não é promessa. Em uma execução real:

```
outfit   gravado em  16:00:57.281
imagem   gravada em  16:00:58.088
```

Se a geração de imagem falhar, o plano continua existindo e a tela mostra as peças.
O contrário — o modelo inventar um look e o sistema tentar explicá-lo depois — é
impossível por construção.

## Pipeline

```
Browser (Next.js App Router, mobile-first)
   │
   ▼
POST /api/generate-look          getContext() resolve usuário + driver
   │
   ▼
HERMES  (orquestrador)
   │
   ├─ 1. Style Agent ........ intenção, ocasião, clima, texto livre   [sem IA]
   ├─ 2. Wardrobe Agent ..... pré-filtro determinístico do armário    [sem IA]
   ├─ 3. Outfit Agent ....... 1 principal + 2 alternativas + porquê   [sem IA]
   │     ↓
   │     PERSISTE O PLANO  ← ponto de não retorno
   │     ↓
   ├─ 4. Image Director ..... prompt + referências + negativos        [sem IA]
   ├─ 5. Image Provider ..... OpenAI | Mock                           [IA de imagem]
   └─ 6. Quality Control .... estrutural sempre, visual com chave     [IA barata]
         ↓ reprovou? volta ao 4 com correções, no máximo 2 vezes
   ▼
Repository  →  Supabase  |  memória
```

Dos seis passos, **quatro não chamam modelo nenhum**.

## Princípio de custo

```
código determinístico > banco > filtros > regras > IA barata > IA de raciocínio > IA de imagem
```

Consequência prática: **montar um look custa US$ 0**. Harmonia de cores,
elegibilidade por estilo, formalidade, composição, score e até a explicação em
texto são código. IA entra em dois pontos apenas: ler a foto de uma peça e
desenhar a visualização.

## Camadas

| Pasta | Papel | Conhece Supabase? | Chama IA? |
|---|---|---|---|
| `src/schemas/` | contratos Zod, taxonomia fechada | não | não |
| `src/lib/wardrobe/` | cores, regras de estilo, filtro | não | não |
| `src/lib/outfits/` | composição e score | não | não |
| `src/lib/ai/` | classificador, custo, providers | não | sim |
| `src/agents/` | Hermes e subagentes | não | só 5 e 6 |
| `src/services/` | repositório, storage, preferências | sim | não |
| `src/app/api/` | rotas HTTP, autorização | via contexto | não |

Nenhum agente importa Supabase. Trocar o banco é trocar um driver.

## Persistência

Duas implementações da mesma interface `Repository`:

- **`SupabaseRepository`** — produção. Todo método filtra por `user_id` *além* da
  RLS: defesa em profundidade.
- **`MemoryRepository`** — demo e testes. Singleton em `globalThis`, porque o Next
  empacota páginas e route handlers separadamente e um `new` no topo do módulo
  criaria estados distintos.

O driver é escolhido em `getContext()` pela presença das variáveis do Supabase.

## Segurança

**Não existe service role.** Todo acesso — inclusive upload de arquivo — usa o
cliente autenticado do usuário, e a RLS autoriza.

Uma chave que ignora RLS transforma qualquer bug de autorização em vazamento
entre contas. Sem ela, o pior caso é uma operação ser negada.

Verificado no projeto real:

| Teste | Resultado |
|---|---|
| Dono lista as próprias peças | 19 |
| Intruso lista as peças do dono | **0** |
| Intruso lista os looks do dono | **0** |
| Linhas na tabela | 20 |
| Arquivo por URL pública | **400** |
| Arquivo com token adulterado | **400** |
| Arquivo com URL assinada válida | 200 |

## Imagens no banco

O banco guarda **referência**, no formato `bucket::caminho`:

```
user-photos::4e971d9f-.../principal-1789919708562.jpg
```

Não guarda URL assinada (expira em 7 dias e a peça ficaria sem foto) nem data URL
(um JPEG em coluna de texto inviabiliza listar o guarda-roupa). A assinatura é
gerada na leitura, agrupada por bucket para não fazer uma chamada por peça.

## Troca de fornecedor de imagem

`ImageProvider` em `src/schemas/image.ts` é a única fronteira:

```ts
interface ImageProvider {
  readonly name: string
  generateLook(input: ImageGenerationInput): Promise<ImageGenerationResult>
}
```

Para Replicate, Flux ou Google: implementar a interface e ajustar
`src/lib/ai/image-provider.ts`. Nada mais muda.

`ImageGenerationInput.garments` carrega o descritor textual de cada peça **sempre**,
mesmo sem foto cadastrada — é o que permite ao provider mock desenhar o flat lay e
ao provider real reforçar a descrição junto das referências visuais.

## Freios de custo

| Freio | Valor padrão | Onde |
|---|---|---|
| Teto por requisição | US$ 0,50 | `CostBudget` |
| Teto diário por usuário | US$ 5,00 | consulta `ai_usage` antes de gerar |
| Retries após reprovação do QC | 2 | `AI_MAX_IMAGE_RETRIES` |

Atingido qualquer teto, o look é entregue **sem imagem**, com o motivo na tela.
Não existe caminho que gere imagem em laço.

## Observabilidade

- `agent_runs` — uma linha por execução do Hermes: status, latência, custo.
- `ai_usage` — uma linha por chamada de modelo: provider, modelo, operação,
  custo estimado, latência, sucesso. É desta tabela que sai o freio diário.

## Extensões previstas, não implementadas

A arquitetura comporta Shopping Agent, Weather Agent, Travel/Packing Agent e
Trend Agent como novos subagentes sob o Hermes, sem tocar no núcleo determinístico.
Fora do escopo do MVP por decisão.
