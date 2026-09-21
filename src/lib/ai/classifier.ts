import OpenAI from 'openai'
import {
  classificationSchema,
  detectionSchema,
  type Classification,
  type DetectedGarment,
  ALL_SUBCATEGORIES,
  CATEGORIES,
  SEASONS,
  OCCASIONS,
  SPORT_TYPES,
  PATTERNS,
} from '@/schemas/wardrobe'
import { env, hasOpenAI } from '@/lib/env'
import { approxTokens, estimateTextCost } from './cost'

export interface ClassificationResult {
  /** Todas as peças encontradas na foto. Nunca vazio. */
  items: DetectedGarment[]
  source: 'openai' | 'heuristic'
  estimated_cost: number
  latency_ms: number
  warning?: string
}

const SYSTEM = `Você cataloga peças de roupa para um guarda-roupa digital.
Responda SOMENTE com JSON válido, sem markdown.

A foto pode conter MAIS DE UMA peça (por exemplo blusa e calça lado a lado).
Devolva {"items":[...]} com UMA entrada por peça de vestuário distinta.
Uma peça só na foto = array com um item.
NÃO conte como peça: cabides, cama, móveis, partes do corpo, sombra, fundo.
NÃO separe partes da mesma peça (gola, manga, botão são a mesma peça).
Acrescente "position": onde a peça está na foto, em 2 ou 3 palavras
(ex: "à esquerda", "em cima", "peça de baixo").

Campos de cada item:
- category: ${CATEGORIES.join(' | ')}
- subcategory: ${ALL_SUBCATEGORIES.join(' | ')}
- color: cor dominante em português, uma palavra (ex: preto, branco, marinho, oliva)
- secondary_colors: array de cores em português (pode ser vazio)
- pattern: ${PATTERNS.join(' | ')}
- material: material provável em português
- style: estilo em uma palavra (ex: casual, social, esportivo, minimalista)
- formality: inteiro 0 (pijama) a 10 (black tie)
- sport_type: ${SPORT_TYPES.join(' | ')}
- season: array de ${SEASONS.join(' | ')}
- occasion: array de ${OCCASIONS.join(' | ')}
- description: uma frase curta descrevendo a peça
A subcategory DEVE pertencer à category informada.`

/**
 * Classificação de peça. Modelo barato, não o de raciocínio (PRP §59).
 * Sem chave, cai na heurística: o cadastro nunca trava por falta de IA.
 */
export async function classifyGarment(
  imageDataUrl: string,
  hint?: string,
): Promise<ClassificationResult> {
  const started = Date.now()

  if (!hasOpenAI) {
    return {
      items: [single(heuristicClassify(hint ?? ''))],
      source: 'heuristic',
      estimated_cost: 0,
      latency_ms: Date.now() - started,
      warning: 'OPENAI_API_KEY ausente: peça classificada por heurística, revise os campos.',
    }
  }

  try {
    const client = new OpenAI({ apiKey: env.openaiKey })
    const userText = hint
      ? `Contexto do usuário: "${hint}". Catalogue as peças da imagem.`
      : 'Catalogue as peças da imagem.'

    const completion = await client.chat.completions.create({
      model: env.textModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
          ],
        },
      ],
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    const raw = JSON.parse(content)
    // Aceita tanto {"items":[...]} quanto o objeto solto de uma peça só,
    // para o schema antigo não quebrar se o modelo responder do jeito velho.
    const parsed = detectionSchema.safeParse(
      Array.isArray(raw?.items) ? raw : { items: [raw] },
    )
    const usage = completion.usage
    const cost = estimateTextCost(
      usage?.prompt_tokens ?? approxTokens(SYSTEM + userText),
      usage?.completion_tokens ?? 200,
    )

    if (!parsed.success) {
      return {
        items: [single(heuristicClassify(hint ?? ''))],
        source: 'heuristic',
        estimated_cost: cost,
        latency_ms: Date.now() - started,
        warning: 'Resposta da IA fora do formato esperado; usei a heurística. Revise os campos.',
      }
    }

    const items = dedupeGarments(parsed.data.items.map((i) => ({ ...normalize(i), position: i.position })))

    return {
      items,
      source: 'openai',
      estimated_cost: cost,
      latency_ms: Date.now() - started,
      warning: items.length > 1 ? `Encontrei ${items.length} peças nesta foto.` : undefined,
    }
  } catch (error) {
    return {
      items: [single(heuristicClassify(hint ?? ''))],
      source: 'heuristic',
      estimated_cost: 0,
      latency_ms: Date.now() - started,
      warning:
        error instanceof Error
          ? `Falha na IA (${error.message}); classificação heurística aplicada.`
          : 'Falha na IA.',
    }
  }
}

function single(c: Classification): DetectedGarment {
  return { ...c, position: '' }
}

/**
 * Duas entradas com a mesma categoria E subcategoria E cor quase certamente são
 * a mesma peça vista duas vezes — o modelo às vezes separa gola e corpo.
 */
function dedupeGarments(items: DetectedGarment[]): DetectedGarment[] {
  const seen = new Set<string>()
  const out: DetectedGarment[] = []
  for (const item of items) {
    const key = `${item.category}|${item.subcategory}|${item.color.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/** Garante que a subcategoria pertence à categoria, mesmo se o modelo escorregar. */
function normalize(c: Classification): Classification {
  const subOk = ALL_SUBCATEGORIES.includes(c.subcategory as never)
  return { ...c, subcategory: subOk ? c.subcategory : fallbackSubcategory(c.category) }
}

function fallbackSubcategory(category: Classification['category']): string {
  const map: Record<Classification['category'], string> = {
    top: 'camiseta',
    bottom: 'calca',
    dress: 'vestido',
    outerwear: 'jaqueta',
    shoes: 'tenis',
    accessory: 'oculos',
    bag: 'bolsa',
  }
  return map[category]
}

interface Keyword {
  re: RegExp
  category: Classification['category']
  sub: string
  formality: number
  sport?: Classification['sport_type']
}

/**
 * Ordem = precedência: a primeira entrada que casar vence.
 * As específicas vêm antes das genéricas, senão "viseira de tênis" vira calçado.
 */
const KEYWORDS: Keyword[] = [
  { re: /skort|saia.?short/i, category: 'bottom', sub: 'skort', formality: 1, sport: 'tenis' },
  { re: /legging/i, category: 'bottom', sub: 'legging', formality: 1, sport: 'academia' },
  { re: /short|bermuda/i, category: 'bottom', sub: 'shorts', formality: 2 },
  { re: /saia/i, category: 'bottom', sub: 'saia', formality: 6 },
  { re: /cal[cç]a/i, category: 'bottom', sub: 'calca', formality: 6 },
  { re: /vestido/i, category: 'dress', sub: 'vestido', formality: 7 },
  { re: /blazer/i, category: 'outerwear', sub: 'blazer', formality: 8 },
  { re: /jaqueta|corta.?vento/i, category: 'outerwear', sub: 'jaqueta', formality: 3 },
  { re: /casaco|sobretudo/i, category: 'outerwear', sub: 'casaco', formality: 6 },
  { re: /salto|scarpin/i, category: 'shoes', sub: 'salto', formality: 8 },
  { re: /sapatilha/i, category: 'shoes', sub: 'sapatilha', formality: 6 },
  { re: /sand[aá]lia/i, category: 'shoes', sub: 'sandalia', formality: 5 },
  { re: /bota/i, category: 'shoes', sub: 'bota', formality: 5 },
  { re: /bolsa|clutch/i, category: 'bag', sub: 'bolsa', formality: 6 },
  { re: /mochila/i, category: 'bag', sub: 'mochila', formality: 2 },
  { re: /raqueteira/i, category: 'bag', sub: 'raqueteira', formality: 1, sport: 'tenis' },
  { re: /viseira/i, category: 'accessory', sub: 'viseira', formality: 1, sport: 'tenis' },
  { re: /bon[eé]/i, category: 'accessory', sub: 'bone', formality: 1 },
  { re: /[oó]culos/i, category: 'accessory', sub: 'oculos', formality: 5 },
  { re: /rel[oó]gio/i, category: 'accessory', sub: 'relogio', formality: 6 },
  { re: /cinto/i, category: 'accessory', sub: 'cinto', formality: 6 },
  { re: /camisa/i, category: 'top', sub: 'camisa', formality: 7 },
  { re: /polo/i, category: 'top', sub: 'polo', formality: 4 },
  { re: /regata/i, category: 'top', sub: 'regata', formality: 2 },
  { re: /top|cropped/i, category: 'top', sub: 'top-esportivo', formality: 1, sport: 'geral' },
  { re: /su[eé]ter|tric[oô]/i, category: 'top', sub: 'sueter', formality: 5 },
  { re: /blusa/i, category: 'top', sub: 'blusa', formality: 6 },
  { re: /camiseta/i, category: 'top', sub: 'camiseta', formality: 2 },
  // Genérica por último: "tênis" sozinho é calçado, mas "viseira de tênis" não é.
  { re: /t[eê]nis/i, category: 'shoes', sub: 'tenis', formality: 2, sport: 'geral' },
]

const COLOR_WORDS = [
  'preto', 'branco', 'cinza', 'bege', 'marinho', 'azul', 'vermelho', 'verde',
  'rosa', 'amarelo', 'roxo', 'marrom', 'off-white', 'nude', 'oliva', 'vinho', 'jeans',
]

/**
 * Heurística por texto. Não é "IA barata": é ausência de IA.
 * Serve de rede de segurança e mantém os testes offline e determinísticos.
 */
export function heuristicClassify(text: string): Classification {
  const match = KEYWORDS.find((k) => k.re.test(text))
  const color = COLOR_WORDS.find((c) => new RegExp(c, 'i').test(text)) ?? 'neutro'
  // "de tênis" qualifica o esporte ("viseira de tênis"), não a peça.
  const isTennis = /de t[eê]nis|t[eê]nis de t[eê]nis|quadra|raquete|partida/i.test(text)

  const category = match?.category ?? 'top'
  const subcategory = isTennis && category === 'shoes' ? 'tenis-tenis' : (match?.sub ?? 'camiseta')
  const sport_type: Classification['sport_type'] = isTennis ? 'tenis' : (match?.sport ?? 'nenhum')

  return classificationSchema.parse({
    category,
    subcategory,
    color,
    secondary_colors: [],
    pattern: 'liso',
    material: 'desconhecido',
    style: (match?.formality ?? 3) >= 6 ? 'social' : 'casual',
    formality: match?.formality ?? 3,
    sport_type,
    season: [...SEASONS],
    occasion: [],
    description: text.slice(0, 140),
  })
}
