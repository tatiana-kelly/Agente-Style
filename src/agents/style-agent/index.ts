import type { NoveltyLevel, Style } from '@/schemas/outfit'
import { ruleFor } from '@/lib/wardrobe/style-rules'
import { SEASONS } from '@/schemas/wardrobe'
import { extractContext } from './nlp'
import {
  formalityForContext, modestyForContext, type StyleProfile,
} from '@/schemas/style-profile'

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
  /** Faixa vinda do dress code do usuario; sobrepoe a regra generica do estilo. */
  formalityOverride?: [number, number]
  /** Exigencia de cobertura, 0..3. */
  modestyLevel: number
  /** Apetite por combinacoes menos obvias. */
  novelty: NoveltyLevel
  /** O que foi entendido da frase livre, para a UI poder confirmar. */
  understood: ReturnType<typeof extractContext>
  /** Clima efetivo do look: escolhido na tela, dito no texto ou deduzido. */
  clima: 'calor' | 'ameno' | 'frio'
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
/**
 * A pessoa escolhe ONDE vai, não o "estilo": quem decide o nível de elegância
 * é o sistema. Este mapa é essa decisão, e vale quando a tela não manda estilo.
 */
const ESTILO_POR_OCASIAO: Record<string, Style> = {
  trabalho: 'trabalho',
  reuniao: 'trabalho',
  igreja: 'igreja',
  'dia-comum': 'dia-a-dia',
  almoco: 'social',
  jantar: 'jantar',
  passeio: 'casual',
  viagem: 'viagem',
  'partida-tenis': 'tenis',
  treino: 'esporte',
  evento: 'evento',
  festa: 'festa',
}

export function estiloParaOcasiao(occasion?: string): Style {
  return (occasion && ESTILO_POR_OCASIAO[occasion]) || 'casual'
}

/** Clima escolhido na tela vira estação, que é o que as peças declaram. */
export function estacaoParaClima(clima?: string): string | undefined {
  if (clima === 'calor') return 'verao'
  if (clima === 'frio') return 'inverno'
  if (clima === 'ameno') return 'outono'
  return undefined
}

export function resolveStyleIntent(input: {
  style?: Style
  occasion?: string
  context?: string
  weather?: { temperature?: number; rain?: boolean }
  profile?: StyleProfile | null
  novelty?: NoveltyLevel
  clima?: string
}): StyleIntent {
  const context = input.context ?? ''
  const notes: string[] = []

  // A frase livre pode redefinir estilo e ocasiao: "vou a igreja" vale mais
  // que o estilo que veio marcado na tela.
  const understood = extractContext(context)
  const occasion = input.occasion ?? understood.occasion
  // Ordem: o que ela escreveu > o que a tela mandou > o que a ocasião pede.
  const style = understood.style ?? input.style ?? estiloParaOcasiao(occasion)

  const rule = ruleFor(style)
  let [min, max] = formalityForContext(input.profile ?? null, style) ?? rule.formality
  const formalityOverride = formalityForContext(input.profile ?? null, style)

  if (understood.style && understood.style !== input.style) {
    notes.push(`Entendi pelo texto que a ocasião é ${understood.style}.`)
  }
  if (understood.elevated && max < 10) {
    max = Math.min(10, max + 1)
    min = Math.min(min + 1, max)
    notes.push('Compromisso importante: subi um ponto de formalidade.')
  }
  if (understood.period === 'noite' && max < 10) {
    max = Math.min(10, max + 1)
  }
  if (understood.day) notes.push(`Anotei: ${understood.day}.`)

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

  const novelty: NoveltyLevel = understood.wantsNovelty ? 'ousado' : (input.novelty ?? 'equilibrado')
  if (understood.wantsNovelty) notes.push('Você pediu algo diferente — fui menos óbvio na combinação.')

  return {
    style,
    occasion: occasion ?? rule.defaultOccasion,
    season: estacaoParaClima(input.clima) ?? detectSeason(context, weather?.temperature),
    clima: climaEfetivo(input.clima, context, weather?.temperature),
    formality: [min, max],
    requestedColors: extractMatches(context, COLOR_HINTS).map(normalizeColorWord),
    requestedSubcategories: extractMatches(context, SUBCATEGORY_HINTS).map(normalizeSubcategory),
    notes,
    formalityOverride,
    modestyLevel: modestyForContext(input.profile ?? null, style),
    novelty,
    understood,
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

/** Sem escolha explícita, o clima sai da estação corrente ou do que ela escreveu. */
function climaEfetivo(
  clima: string | undefined,
  context: string,
  temperature?: number,
): 'calor' | 'ameno' | 'frio' {
  if (clima === 'calor' || clima === 'ameno' || clima === 'frio') return clima
  if (typeof temperature === 'number') {
    if (temperature >= 26) return 'calor'
    if (temperature <= 17) return 'frio'
    return 'ameno'
  }
  if (/calor|quente|ver[aã]o/i.test(context)) return 'calor'
  if (/frio|inverno/i.test(context)) return 'frio'
  const estacao = SEASONS[monthToSeasonIndex(new Date().getUTCMonth())]
  if (estacao === 'verao') return 'calor'
  if (estacao === 'inverno') return 'frio'
  return 'ameno'
}
