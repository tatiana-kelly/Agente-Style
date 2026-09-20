# FINAL_REPORT — Wardrobe AI

20 de setembro de 2026 · `C:\Projeto ClaudeCode\wardrobe-ai`

---

## STATUS GERAL

**MVP REAL** — Supabase, Auth, Storage, RLS, guarda-roupa, Hermes e persistência
rodando contra infraestrutura real e verificados com evidência.

**Não é "MVP REAL + DEPLOY"**, e não é por falta de tentativa: restam dois
bloqueios que exigem ação humana — `vercel login` interativo e a `OPENAI_API_KEY`.

O que ficou fora é nomeado item a item abaixo. Nada foi declarado testado sem ter
rodado.

---

## SUPABASE

| Item | Valor |
|---|---|
| Projeto | `wardrobe-ai` |
| Ref | `wolglwwxswhhjwugufpi` |
| Região | `sa-east-1` |
| URL | `https://wolglwwxswhhjwugufpi.supabase.co` |
| Status | `ACTIVE_HEALTHY` |
| Custo | US$ 10/mês (confirmado antes de criar) |

### Migrations aplicadas

1. `initial_schema` — 9 tabelas, 21 índices, triggers de `updated_at`, trigger de signup.
2. `rls_policies` — RLS em todas as tabelas.
3. `storage_buckets` — 5 buckets privados, 20 policies.
4. `harden_functions` — correção dos alertas de segurança.
5. `rename_occasions_to_occasion` — correção de um bug real (abaixo).

### RLS — testada, não apenas configurada

| Teste | Resultado |
|---|---|
| Dono lista as próprias peças | 19 |
| **Intruso lista as peças do dono** | **0** |
| **Intruso lista os looks do dono** | **0** |
| Linhas realmente na tabela | 20 |

Feito com dois usuários reais e `request.jwt.claims` trocado dentro da transação.

### Storage — testado

| Teste | Resultado |
|---|---|
| Upload autenticado | 201 |
| Download por URL assinada | 200, `image/jpeg`, 5.834 bytes |
| Acesso por URL pública | **400** |
| Acesso com token adulterado | **400** |
| Valor guardado no banco | `user-photos::<uid>/principal-….jpg` (referência, não URL) |

### Auth — testada

signup (via trigger) → login → sessão → rota protegida → logout → redirect. Todos
verificados no navegador.

### Advisors de segurança

Primeira execução acusou 3 alertas; todos corrigidos. **Execução final: 0 alertas.**

---

## OPENAI

| Item | Situação |
|---|---|
| Provider | `OpenAIImageProvider` implementado (`images.edit`, múltiplas referências) |
| Classificador | Visão implementada, com fallback heurístico |
| Modelo de imagem | `gpt-image-1` (configurável) |
| Modelo de texto | `gpt-5-mini` (configurável) |
| **Geração real testada** | **NÃO** |
| Custo real gasto | **US$ 0,00** |

A chave foi procurada em variáveis do shell, arquivos do projeto, diretório do
usuário e configuração da Vercel. **Não existe em nenhum lugar acessível.**

Enquanto isso, o sistema usa `MockImageProvider` (flat lay determinístico) e
classificação heurística. Ambos são explicitamente marcados na interface.

---

## HERMES

```
HERMES
├─ Style Agent ........ intenção, ocasião, clima, texto livre   [sem IA]
├─ Wardrobe Agent ..... pré-filtro determinístico               [sem IA]
├─ Outfit Agent ....... composição + explicação                 [sem IA]
│     ↓ PERSISTE O PLANO
├─ Image Director ..... prompt + referências + negativos        [sem IA]
└─ Quality Control .... estrutural sempre, visual com chave     [IA barata]
```

Quatro dos seis passos não chamam modelo nenhum.

### Execução real registrada

```
agent_runs: hermes | success | 1332 ms | US$ 0,000000
outfit:  5 peças | confiança 1.0 | explicação de 285 caracteres
```

Look de tênis escolhido: top esportivo branco + skort branco + tênis de quadra +
viseira + raqueteira. Look de trabalho: camisa branca + calça alfaiataria +
scarpin nude + bolsa estruturada.

---

## IMAGEM

| Etapa | Estado |
|---|---|
| Input | foto da pessoa + descritores das peças + metadados |
| Referências | foto primeiro, peças depois |
| Negativos | não alterar rosto/cabelo/proporções, não inventar peça, não cortar calçado |
| Geração | mock (sem chave) |
| QC | estrutural, score 0,750 |
| Retries | 1 tentativa, sem necessidade de repetir |
| Armazenamento | `generated-looks::<uid>/….svg` no Storage real |

### A invariante do produto, provada

```
plano  gravado em 16:00:57.281
imagem gravada em 16:00:58.088
plano_antes_da_imagem = true
```

O modelo de imagem nunca escolhe roupa. Quando ele roda, a composição já está
decidida e persistida.

---

## TESTES

| Tipo | Quantidade | Resultado |
|---|---|---|
| Unitários e integração | 66 | ✅ todos, offline |
| Typecheck | — | ✅ 0 erros |
| Lint | — | ✅ 0 problemas |
| Build de produção | — | ✅ 18 rotas + proxy |
| E2E manual em stack real | 15 passos | ✅ 11 reais, 4 com ressalva |
| Segurança (Supabase advisors) | — | ✅ 0 alertas |
| Segurança (bundle do cliente) | — | ✅ 0 segredos |

---

## DEPLOY

| Item | Valor |
|---|---|
| Time Vercel | `tatiana-3292's projects` (**conta pessoal**, única disponível) |
| Projeto | `wardrobe-ai` — `prj_SN3Ytxm9WOPcPbtYBXJHph63Mnvb` |
| Variáveis configuradas | 5, nos três ambientes |
| Vínculo local | `.vercel/project.json` escrito |
| Build com env real | ✅ validado |
| **Deploy executado** | **NÃO** |
| **URL de produção** | **não existe ainda** |

### Por que não deployei — três caminhos avaliados

1. **Vercel CLI** — instalada; `vercel whoami` responde que exige `vercel login`,
   que abre o navegador. Ação humana inevitável.
2. **Git** — `create_git_project` exige repositório remoto. O MCP do GitHub não
   está autenticado, não há remote e push não foi autorizado.
3. **Deploy inline pela API** — tecnicamente possível, mas exigiria eu retranscrever
   ~900 KB de código-fonte através de chamadas de ferramenta. Descartado pelo risco
   de corromper o source silenciosamente; não vale a pena para economizar um login.

---

## CUSTO

| Operação | Custo |
|---|---|
| Classificar uma peça (visão) | ~US$ 0,0005 |
| **Montar um look sem imagem** | **US$ 0,00** |
| Gerar a imagem do look | ~US$ 0,19 |
| Auditoria visual do QC | ~US$ 0,0006 |
| **Total por look com imagem** | **~US$ 0,19** |
| Cadastrar 50 peças | ~US$ 0,03 |
| Supabase | US$ 10/mês |
| **Gasto real nesta sessão** | **US$ 0,00 de IA** + US$ 10/mês de Supabase |

Freios: US$ 0,50 por requisição, US$ 5,00 por usuário por dia, 2 retries no máximo.
Atingido qualquer teto, o look sai sem imagem e a tela diz o porquê.

---

## PROBLEMAS ENCONTRADOS E CORRIGIDOS NESTA FASE

1. **`occasions` × `occasion`** — a coluna divergia do domínio. Quebrava o insert e,
   pior, **quebrava a leitura em silêncio**: toda peça voltaria sem ocasião e o
   filtro por ocasião não valeria nada. Renomeei a coluna; o mapeamento sumiu.
2. **Erro de banco invisível** — o handler só tratava `Error`; erros do PostgREST
   são objetos simples, então toda falha de banco virava "Erro interno" sem log.
   Foi o que escondeu o problema 1.
3. **Service role desnecessária** — o upload usava uma chave que ignora RLS.
   Removida do sistema: upload passa pelo cliente autenticado e a RLS autoriza.
4. **URL assinada no banco** — expiraria em 7 dias, deixando a peça sem foto.
   Agora o banco guarda `bucket::caminho` e a assinatura é gerada na leitura.
5. **Data URL no banco** — um JPEG em coluna de texto inviabilizaria listar o
   guarda-roupa. Agora vai para o Storage.
6. **Módulo de segredos no bundle do cliente** — `client.ts` importava `@/lib/env`,
   que lê `OPENAI_API_KEY`. O valor não vazava, mas bastava alguém somar um segredo
   ao objeto `env` para virar vazamento real. Verificado depois: 0 ocorrências.
7. **3 alertas do Supabase** — `search_path` mutável e função `SECURITY DEFINER`
   exposta como RPC pública. Corrigidos; advisors zerados.
8. **Turbopack subindo de diretório** — pegava o `package-lock.json` da pasta pai.
9. **Data transbordando no card** — formato encurtado para caber no celular.

---

## BLOQUEIOS RESTANTES

### 1. `OPENAI_API_KEY` — bloqueia IA real

- **Causa:** a chave não existe em nenhum lugar acessível.
- **Ação humana:** criar `.env.local` na raiz do projeto com `OPENAI_API_KEY=sk-...`
- **Local:** `C:\Projeto ClaudeCode\wardrobe-ai\.env.local`
- **Depois:** classificação por visão e geração real de imagem passam a funcionar
  sem nenhuma mudança de código — só trocam os providers.

### 2. `vercel login` — bloqueia o deploy

- **Causa:** a CLI exige autenticação por navegador.
- **Ação humana:** em um terminal interativo:
  ```
  cd "C:\Projeto ClaudeCode\wardrobe-ai"
  npx vercel login
  npx vercel --prod
  ```
- **Depois:** o projeto já está criado e vinculado, com as variáveis do Supabase
  configuradas. O deploy sai direto.

### 3. Foto real e peças reais — bloqueia a validação visual

- **Causa:** não há foto de corpo inteiro nem fotos de roupa no ambiente. Não
  vasculhei suas fotos pessoais e não usei imagem fictícia para declarar teste real.
- **Ação humana:** em `/profile`, enviar uma foto de corpo inteiro; em
  `/wardrobe/add`, fotografar 5 peças (1 top, 1 bottom, 1 tênis, 1 acessório, 1 extra).
- **Depois:** com a chave da OpenAI, o fluxo do §12 roda ponta a ponta de verdade.

---

## PRÓXIMAS EVOLUÇÕES

1. Pipeline de normalização de imagem (remoção de fundo, `image_processed_url`).
2. Reaproveitar imagem gerada quando a composição não mudou.
3. Integração de clima — a interface já aceita e o Style Agent já reage.
4. Testes E2E automatizados contra o Supabase real, hoje feitos à mão.

Fora de escopo por decisão: marketplace, pagamento, provador AR, avatar 3D, rede
social, recomendação de compra, WhatsApp, agenda, mala.
