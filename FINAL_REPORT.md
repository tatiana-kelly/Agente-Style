# FINAL_REPORT — Wardrobe AI

20 de setembro de 2026 · `C:\Projeto ClaudeCode\wardrobe-ai`

---

## STATUS GERAL

**MVP REAL + DEPLOY** — no ar, com Supabase real, auth real, storage real e o fluxo
completo validado em produção.

| | |
|---|---|
| **Produção** | <https://wardrobe-ai-xi-six.vercel.app> |
| Repositório | <https://github.com/tatiana-kelly/Agente-Style> |
| Deploy | automático a cada push em `main` |

Duas coisas continuam **não testadas com o artigo real**, e estão nomeadas ao final:
a IA (sem `OPENAI_API_KEY`) e a foto de pessoa/roupa de verdade. Nada foi declarado
testado sem ter rodado.

---

## SUPABASE

| Item | Valor |
|---|---|
| Projeto | `wardrobe-ai` · ref `wolglwwxswhhjwugufpi` · `sa-east-1` |
| URL | `https://wolglwwxswhhjwugufpi.supabase.co` |
| Status | `ACTIVE_HEALTHY` |
| Custo | US$ 10/mês |

### Migrations aplicadas

1. `initial_schema` — 9 tabelas, 21 índices, triggers de `updated_at`, trigger de signup.
2. `rls_policies` — RLS em todas as tabelas.
3. `storage_buckets` — 5 buckets privados, 20 policies.
4. `harden_functions` — correção dos 3 alertas de segurança.
5. `rename_occasions_to_occasion` — correção de um bug real.

### RLS — testada, não apenas configurada

| Teste | Resultado |
|---|---|
| Dono lista as próprias peças | 19 |
| **Intruso lista as peças do dono** | **0** |
| **Intruso lista os looks do dono** | **0** |
| Linhas realmente na tabela | 20 |

Dois usuários reais, `request.jwt.claims` trocado dentro da transação.

### Storage — testado

| Teste | Resultado |
|---|---|
| Upload autenticado | 201 |
| Download por URL assinada | 200, `image/jpeg`, 5.834 bytes |
| Acesso por URL pública | **400** |
| Acesso com token adulterado | **400** |
| Valor guardado no banco | `user-photos::<uid>/principal-….jpg` |

### Auth — testada

signup (trigger) → login → sessão → rota protegida → logout → redirect, no local e
em produção.

### Advisors de segurança

3 alertas na primeira execução, todos corrigidos. **Execução final: 0 alertas.**

---

## OPENAI

| Item | Situação |
|---|---|
| `OpenAIImageProvider` | implementado (`images.edit`, múltiplas referências) |
| Classificador por visão | implementado, com fallback heurístico |
| **Geração real testada** | **NÃO** |
| **Custo real gasto** | **US$ 0,00** |

A chave foi procurada em variáveis do shell, arquivos do projeto, diretório do
usuário e API da Vercel. **Não existe em nenhum lugar acessível.**

Em produção rodam `MockImageProvider` (flat lay determinístico) e classificação
heurística — ambos sinalizados na interface, nunca apresentados como IA.

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

### A invariante do produto, provada

```
plano  gravado em 16:00:57.281
imagem gravada em 16:00:58.088
plano_antes_da_imagem = true
```

O modelo de imagem nunca escolhe roupa. Quando ele roda, a composição já está
decidida, pontuada e gravada.

### Decisões observadas em produção

| Pedido | Look escolhido |
|---|---|
| Tênis / partida | top esportivo + skort + tênis de quadra + viseira + raqueteira |
| Trabalho / reunião | camisa branca + calça alfaiataria + scarpin + bolsa |
| Social / jantar | blusa de seda marinho + calça alfaiataria + scarpin nude + bolsa |
| Trocar o calçado | scarpin saiu, resto preservado, entrou sapatilha preta |

---

## IMAGEM

| Etapa | Estado |
|---|---|
| Referências | foto da pessoa primeiro, peças depois |
| Negativos | não alterar rosto/cabelo/proporções, não inventar peça, não cortar calçado |
| Geração | mock (sem chave) |
| QC | estrutural, score 0,750 |
| Retries | 1 tentativa, sem necessidade de repetir |
| Armazenamento | `generated-looks::<uid>/….svg`, Storage privado |

---

## TESTES

| Tipo | Quantidade | Resultado |
|---|---|---|
| Unitários e integração | 66 | ✅ offline |
| Typecheck / Lint / Build | — | ✅ 0 erros |
| E2E manual local | 15 passos | ✅ |
| **E2E manual em produção** | login → guarda-roupa → look → troca → salvar → meus looks → logout | ✅ |
| Supabase advisors | — | ✅ 0 alertas |
| Bundle do cliente | — | ✅ 0 segredos |

---

## DEPLOY

| Item | Valor |
|---|---|
| Time | `tatiana-3292's projects` (conta pessoal) |
| Projeto | `wardrobe-ai` · `prj_SN3Ytxm9WOPcPbtYBXJHph63Mnvb` |
| Região das funções | **`gru1` (São Paulo)** |
| Variáveis | 5, nos três ambientes |
| Git | conectado — push em `main` faz deploy |
| Vercel Authentication | desligada em produção (app público) |

---

## PERFORMANCE

O primeiro deploy subiu as funções em `iad1` (EUA) com o banco em São Paulo.
Listar 19 peças levava **1,06 s** — custo de ida e volta de rede, não de consulta.
Como o Hermes faz várias consultas sequenciais, a distância multiplicava.

Fixei `regions: ["gru1"]` em `vercel.json`:

| Operação | Antes (iad1) | Depois (gru1) |
|---|---|---|
| Listar guarda-roupa | 1064 ms | **176 ms** |
| Montar look (quente) | ~2500 ms | **~620 ms** |
| Primeira chamada (cold) | 11.869 ms | 785 ms |

---

## CUSTO

| Operação | Custo |
|---|---|
| Classificar uma peça (visão) | ~US$ 0,0005 |
| **Montar um look sem imagem** | **US$ 0,00** |
| Gerar a imagem do look | ~US$ 0,19 |
| Auditoria visual do QC | ~US$ 0,0006 |
| **Total por look com imagem** | **~US$ 0,19** |
| Supabase | US$ 10/mês |
| Vercel | US$ 0 (Hobby) |
| **Gasto real de IA até aqui** | **US$ 0,00** |

Freios: US$ 0,50 por requisição, US$ 5,00 por usuário/dia, 2 retries no máximo.

---

## PROBLEMAS ENCONTRADOS E CORRIGIDOS

1. **`occasions` × `occasion`** — coluna divergia do domínio. Quebrava o insert e,
   pior, **quebrava a leitura em silêncio**: toda peça voltaria sem ocasião e o
   filtro por ocasião não valeria nada.
2. **Erro de banco invisível** — o handler só tratava `Error`; erros do PostgREST
   são objetos simples. Toda falha de banco virava "Erro interno" sem log. Foi o
   que escondeu o problema 1.
3. **Service role desnecessária** — removida do sistema. Upload passa pelo cliente
   autenticado e a RLS autoriza.
4. **URL assinada no banco** — expiraria em 7 dias, deixando a peça sem foto.
5. **Data URL no banco** — JPEG em coluna de texto inviabilizaria listar o armário.
6. **Módulo de segredos no bundle do cliente** — `client.ts` importava `@/lib/env`.
   O valor não vazava, mas bastava somar um segredo ao objeto para virar vazamento.
7. **3 alertas do Supabase** — `search_path` mutável e função `SECURITY DEFINER`
   exposta como RPC pública.
8. **Funções longe do banco** — 6x mais lento em produção (acima).
9. **Turbopack subindo de diretório** — pegava o lockfile da pasta pai.
10. **Data transbordando no card** em tela de celular.

---

## BLOQUEIOS RESTANTES

### 1. `OPENAI_API_KEY` — bloqueia a IA real

- **Causa:** a chave não existe em nenhum lugar acessível da máquina.
- **Ação:** criar `.env.local` com `OPENAI_API_KEY=sk-...` para o local, e para produção:
  ```
  npx vercel env add OPENAI_API_KEY production
  npx vercel --prod
  ```
- **Depois:** classificação por visão e geração real de imagem passam a funcionar
  sem mudança de código — só trocam os providers.

### 2. Foto real e peças reais — bloqueia a validação visual

- **Causa:** não há foto de corpo inteiro nem fotos de roupa no ambiente. Não
  vasculhei fotos pessoais e não usei imagem fictícia para declarar teste real.
- **Ação:** em `/profile`, enviar uma foto de corpo inteiro; em `/wardrobe/add`,
  fotografar 5 peças (1 top, 1 bottom, 1 tênis, 1 acessório, 1 extra).
- **Depois:** com a chave da OpenAI, o fluxo do §12 roda ponta a ponta de verdade.

---

## PRÓXIMAS EVOLUÇÕES

1. Pipeline de normalização de imagem (remoção de fundo, `image_processed_url`).
2. Reaproveitar imagem gerada quando a composição não mudou.
3. Integração de clima — a interface já aceita e o Style Agent já reage.
4. Testes E2E automatizados contra o Supabase real, hoje feitos à mão.

Fora de escopo por decisão: marketplace, pagamento, provador AR, avatar 3D, rede
social, recomendação de compra, WhatsApp, agenda, mala.

---

## Acesso

Produção: <https://wardrobe-ai-xi-six.vercel.app>
Conta de teste: `teste@wardrobe.ai` / `WardrobeTest!2026`
Existe também `intruso@wardrobe.ai` / `Intruso!2026`, criada só para provar a RLS.
As duas podem ser apagadas no painel do Supabase quando não forem mais úteis.
