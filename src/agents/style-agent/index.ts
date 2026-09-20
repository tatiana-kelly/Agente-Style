import type { Style } from '@/schemas/outfit'
import { ruleFor } from '@/lib/wardrobe/style-rules'
import { SEASONS } from '@/schemas/wardrobe'

export interface StyleIntent {
  style: Style
  occasion: string
  season: string
  /** Faixa de formalidade efetiva, já ajustada pelo contexto livre. */
  formality: [number, number]
  /** Cores que o usuário pediu explicitamente no campo de preferência. */
  requestedColors: string[]
  /** Subcategorias citadas no texto livre ("quero usar minha saia preta"). */
  requestedSubcategories: string[]
  notes: string[]
}

const PERIOD_HINTS: Array<{ re: RegExp; note: string }> = [
  { re: /manh[aã]/i, note: 'Período da manhã: priorizar conforto e peças mais leves.' },
  { re: /tarde/i, note: 'Período da tarde: atenção a sol e temperatura.' },
  { re: /noite|jantar/i, note: 'Período da noite: pode subir um ponto de formalidade.' },
]

const SUBCATEGORY_HINTS = [
  'saia', 'calca', 'calça', 'camisa', 'camiseta', 'blusa', 'vestido', 'shorts',
  'legging', 'skort', 'blazer', 'jaqueta', 'tenis', 'tênis', 'salto', 'sapatilha', 'bota',
]

const COLOR_HINTS = [
  'preto', 'preta', 'branco', 'branca', 'marinho', 'azul', 'vermelho', 'vermelha',
  'verde', 'rosa', 'amarelo', 'bege', 'cinza', 'nude', 'marrom', 'jeans',
]

/**
 * Interpreta a intenção sem chamar IA.
 * O texto livre do MVP é curto e previsível; regex resolve e sai de graça (PRP §59).
 */
export function resolveStyleIntent(input: {
  style: Style
  occasion?: string
  context?: string
  weather?: { temperature?: number; rain?: boolean }
}): StyleIntent {
  const rule = ruleFor(input.style)
  const context = input.context ?? ''
  const notes: string[] = []

  let [min, max] = rule.formality

  for (const hint of PERIOD_HINTS) {
    if (hint.re.test(context)) notes.push(hint.note)
  }
  if (/noite|jantar/i.test(context) && max < 10) {
    max = Math.min(10, max + 1)
    min = Math.min(min + 1, max)
  }
  if (/confort|leve|pr[aá]tic/i.test(context)) {
    min = Math.max(0, min - 1)
    notes.push('Pedido de conforto: peças mais soltas ganham prioridade.')
  }

  const weather = input.weather
  if (typeof weather?.temperature === 'number') {
    if (weather.temperature <= 16) notes.push('Frio: incluir camada extra quando houver.')
    if (weather.temperature >= 28) notes.push('Calor: evitar sobreposição.')
  }
  if (weather?.rain) notes.push('Chuva: evitar calçado aberto e tecido delicado.')

  return {
    style: input.style,
    occasion: input.occasion ?? rule.defaultOccasion,
    season: detectSeason(context, weather?.temperature),
    formality: [min, max],
    requestedColors: extractMatches(context, COLOR_HINTS).map(normalizeColorWord),
    requestedSubcategories: extractMatches(context, SUBCATEGORY_HINTS).map(normalizeSubcategory),
    notes,
  }
}

function extractMatches(text: string, vocabulary: string[]): string[] {
  const lower = text.toLowerCase()
  return [...new Set(vocabulary.filter((word) => lower.includes(word)))]
}

function normalizeColorWord(word: string): string {
  return word.replace(/a$/, 'o').replace(/pret[oa]/, 'preto').replace(/branc[oa]/, 'branco')
}

function normalizeSubcategory(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function detectSeason(context: string, temperature?: number): string {
  if (/ver[aã]o|calor/i.test(context) || (temperature ?? 0) >= 28) return 'verao'
  if (/inverno|frio/i.test(context) || (temperature !== undefined && temperature <= 16)) return 'inverno'
  if (/outono/i.test(context)) return 'outono'
  if (/primavera/i.test(context)) return 'primavera'
  return SEASONS[monthToSeasonIndex(new Date().getUTCMonth())]
}

/** Hemisfério sul: dez–fev verão, mar–mai outono, jun–ago inverno, set–nov primavera. */
function monthToSeasonIndex(month: number): number {
  if (month === 11 || month <= 1) return 0
  if (month <= 4) return 1
  if (month <= 7) return 2
  return 3
}
