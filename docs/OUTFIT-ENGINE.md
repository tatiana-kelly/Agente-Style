# Outfit Intelligence Engine

## O bug que motivou esta camada

O motor anterior enumerava peças por papel. Quando o filtro de formalidade cortava
a única peça de um papel obrigatório, `buildSkeletons` descartava **o papel** e
seguia em frente:

```
guarda-roupa: camiseta preta, camisa branca, calça alfaiataria (f8), tênis, scarpin
pedido:       casual  (faixa de formalidade 1–6, tolerância até 7)

filtro corta a calça (8 > 7)  →  papel "bottom" fica sem candidato
buildSkeletons descarta "bottom"
resultado:  top + shoes        ← um look sem parte de baixo
```

Um guarda-roupa só de tops devolvia três "looks" de tops. O motor nunca falhava
alto — falhava em silêncio, entregando roupa incompleta com nota de confiança alta.

Passou despercebido porque o guarda-roupa demo tem 20 peças bem distribuídas e
cobre todos os papéis em todos os estilos. O defeito só aparece com guarda-roupa
pequeno ou enviesado — ou seja, com guarda-roupa real.

## A correção, em duas partes

**1. Separar as duas causas.** Um papel sem candidato tem duas origens diferentes,
e o motor antigo tratava as duas do mesmo jeito:

| Causa | Resposta certa |
|---|---|
| O filtro cortou as peças existentes | Abortar e descer de camada com filtro mais frouxo |
| O guarda-roupa não tem nenhuma peça do papel | Aceitar incompleto e dizer o que falta |

**2. Regra inegociável `coversBody`.** Um look tem vestido, ou tem parte de cima
**e** parte de baixo. Sem isso não é look, e nenhuma nota alta compensa.

Com as duas, o mesmo caso agora escala para o Tier 3, relaxa a formalidade e
devolve camiseta preta + calça alfaiataria + tênis branco — um look completo.

## Busca em camadas

```
Tier 1   fórmula do estilo E da ocasião        formalidade exata
Tier 2   fórmula do estilo                     ±1 de formalidade
Tier 3   fórmula do estilo + universais        ±2, proibições de estilo cedem
Tier 4   universais                            ±4
Tier 5   universais                            sem restrição de formalidade
```

Só desce quando a camada de cima não produziu nada. Duas coisas **nunca** cedem,
em nenhuma camada:

- **Funcionalidade esportiva** — salto e blazer não vão para a quadra.
- **Modéstia pedida pelo usuário** — a partir do nível "coberto", shorts, regata e
  top esportivo saem das sugestões.

Quando nem o Tier 5 resolve, a resposta não é "não foi possível": é
`diagnoseGap`, que diz qual papel falta no guarda-roupa.

## Biblioteca de fórmulas

54 fórmulas ativas em 9 categorias. Cada uma é um princípio de styling reduzido a
arquétipos de peça — nunca uma foto, nunca o look de uma pessoa específica.

| Categoria | Fórmulas |
|---|---|
| work | 10 |
| church | 9 |
| casual | 9 |
| tennis | 6 |
| dinner | 5 |
| event | 5 |
| travel | 4 |
| sport | 4 |
| universal | 2 |

Toda fórmula declara `source_type` e `source_reference`: de onde veio a regra.

A biblioteca vive em `src/data/outfit-formulas.ts` — versionada, tipada e testada.
A tabela `outfit_formulas` a espelha para inspeção e edição futura; o motor lê a
cópia em código, sem ida ao banco.

### Arquétipos

A subcategoria sozinha não basta: "saia" pode ser midi ou de quadra, "vestido"
pode ser social ou de tênis. `archetypesOf` decide por subcategoria + esporte +
formalidade juntos.

## Motor de cores

Nove relações, não uma comparação de igualdade:

```
MONOCHROMATIC · TONAL · ANALOGOUS · COMPLEMENTARY · SPLIT_COMPLEMENTARY
NEUTRAL · NEUTRAL_ACCENT · CLASSIC · UNRELATED
```

`colorCompatibility(a, b)` devolve 0–3. **Nota baixa não elimina a peça** — o
ranker apenas prefere outra coisa. Combinação ousada precisa continuar possível,
senão o produto só sabe fazer o óbvio.

`analyzePalette` penaliza o pior par além da média: um conflito grave não pode ser
diluído por três acertos. E devolve a relação dominante, que é o que permite à
explicação dizer *por que* as cores funcionam, em vez de só afirmar que funcionam.

## Perfil pessoal

"Trabalho" não quer dizer a mesma coisa para todo mundo, e "igreja" muito menos.
`style_profiles` guarda o dress code de cada contexto e o traduz em faixa de
formalidade:

| Trabalho | Faixa | | Igreja | Faixa |
|---|---|---|---|---|
| casual | 2–5 | | casual-elegante | 4–7 |
| casual-elegante | 4–6 | | feminino | 5–8 |
| business-casual | 5–7 | | clássico | 6–9 |
| social | 6–9 | | sofisticado | 7–9 |
| executivo | 8–10 | | moderno | 4–8 |

Igreja eleva o piso de modéstia para 2 mesmo se o perfil for mais permissivo.

## Ranking

Oito dimensões, internas — o usuário nunca vê nota:

```
formula_match 22%   color_match 18%   style_match 14%   formality_match 14%
occasion_match 12%  wardrobe_match 10%  user_preference 6%   novelty 4%
```

`novelty` não é "quanto maior melhor": é a distância do apetite que o usuário
escolheu (clássico 0.15 · equilibrado 0.4 · ousado 0.75).

## Anti-repetição

Os últimos 8 looks alimentam a penalidade. Assinaturas idênticas são descartadas;
peças repetidas e fórmula repetida baixam a nota — mas a peça continua elegível em
combinação nova, que é o ponto de um guarda-roupa cápsula.

`diversify` também impede que as três alternativas sejam a mesma blusa com sapato
trocado.

## Linguagem natural

Determinística de propósito. "Vou à igreja domingo" é frase curta e previsível;
chamar um modelo para achar a palavra "igreja" seria pagar para fazer o que uma
regex faz. A frase livre **sobrepõe** o estilo marcado na tela.

| Frase | Extraído |
|---|---|
| "Vou à igreja domingo de manhã" | igreja · domingo · manhã |
| "Reunião importante amanhã" | reunião · formalidade +1 |
| "Vou jogar tênis às 18h" | tênis · partida |
| "Quero algo elegante para jantar" | jantar · elegante |
| "Quero algo diferente" | novelty = ousado |

## Três opções, imagem sob demanda

O motor devolve 3 composições distintas. `diversify` impede que sejam a mesma
peça-âncora com sapato trocado.

A imagem **não** é gerada para as três: sairiam US$ 0,57 por pedido para mostrar
duas que a pessoa talvez nem escolha. Cada cartão tem "Ver em mim", e
`POST /api/outfits/[id]/image` reaproveita imagem já gerada em vez de pagar de novo.

## Acessórios

Um look termina com acessório. A fórmula descreve a base, não o acabamento —
então fórmula sem slot de acessório ou de bolsa recebe um slot padrão.

Até 3 acessórios por look, **uma peça por família**:

| Família | Peças |
|---|---|
| pescoço | colar, joia, bijuteria, lenço |
| orelha | brinco |
| mãos | anel, pulseira, relógio |
| cabeça | boné, viseira, chapéu |

Sem isso, o motor empilhava três colares. Sobreposição não conta como acabamento:
casaco e blazer só entram com frio ou quando a fórmula exige.

## Ajuste escrito à mão

Campo em cada cartão: *"inclua cinto vermelho"*, *"troca o scarpin pela
sapatilha"*, *"tira a bolsa"*.

A interpretação é determinística contra o próprio guarda-roupa — o vocabulário é
o das peças cadastradas, e comparar palavra com peça é busca, não raciocínio.

O resto do look fica travado, então o ajuste muda **uma coisa só** em vez de
sortear tudo de novo. Peça travada vence a fórmula: `garantirTravadas` força a
entrada mesmo quando a fórmula não previa aquele papel.

Quando a peça pedida não existe, a resposta nomeia o que falta
(*"sapato vermelho; cinto vermelho; casaco"*) em vez de ignorar o pedido.

## Look pronto por foto

`/outfits/add` recebe a foto de um look já montado. A visão separa as peças,
cada uma entra no guarda-roupa e o conjunto vira um look salvo.

É a melhor fonte de dado que o produto tem: a foto de um look que a pessoa já usa
mostra peças que combinam de verdade, escolhidas por ela — e as peças voltam em
combinações futuras em vez de virar uma foto solta numa galeria.

## Fidelidade da explicação

A explicação cita as peças reais e o princípio de styling, nunca o nome da
fórmula — o nome usa arquétipos ("pantalona") que podem não descrever a peça que
entrou ("calça de alfaiataria").

Duas travas impedem que a explicação invente roupa:

1. Fórmula cuja identidade é a sobreposição **exige** a sobreposição. Se a peça
   que dá nome à fórmula pode faltar, a fórmula está errada.
2. `descricaoConfere` omite a descrição quando ela cita blazer, casaco, cardigã,
   joia, bolsa ou salto que não está no look.

## Custo

**Zero.** Toda esta camada é determinística. IA continua entrando só para ler a
foto de uma peça e desenhar a visualização.
