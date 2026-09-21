import type { Style } from '@/schemas/outfit'

/**
 * Extração de contexto a partir de linguagem natural (§20).
 *
 * Determinística de propósito. "Vou à igreja domingo" é uma frase curta e
 * previsível — chamar um modelo para descobrir que ali existe a palavra "igreja"
 * seria pagar para fazer o que uma regex faz (§31). A IA continua disponível
 * para o caso ambíguo, mas ela é a exceção, não o caminho.
 */

export interface ExtractedContext {
  style?: Style
  occasion?: string
  /** Período do dia, quando dito. */
  period?: 'manha' | 'tarde' | 'noite'
  /** Dia citado, sem resolver data — serve de nota ao usuário. */
  day?: string
  /** Sinal de que o compromisso é importante e pede subir o registro. */
  elevated?: boolean
  /** Pedido explícito de algo diferente do usual. */
  wantsNovelty?: boolean
  /** Confiança de que a frase realmente indicava a ocasião. */
  confidence: number
  matched: string[]
}

interface Rule {
  re: RegExp
  style?: Style
  occasion?: string
  weight: number
}

/** Ordem importa: o mais específico vem antes. */
const RULES: Rule[] = [
  { re: /\bigrej|\bculto\b|\bmissa\b|\bdomingo de manh/i, style: 'igreja', occasion: 'igreja', weight: 1 },
  { re: /jogar t[eê]nis|partida de t[eê]nis|\bquadra\b|\braquete/i, style: 'tenis', occasion: 'partida-tenis', weight: 1 },
  { re: /\btreino\b|treinar|academia|corrida|correr/i, style: 'esporte', occasion: 'treino', weight: 0.9 },
  { re: /reuni[aã]o|entrevista|apresenta[cç][aã]o/i, style: 'trabalho', occasion: 'reuniao', weight: 1 },
  { re: /trabalh|escrit[oó]rio|expediente/i, style: 'trabalho', occasion: 'trabalho', weight: 0.9 },
  { re: /\bjantar\b|jantando/i, style: 'jantar', occasion: 'jantar', weight: 1 },
  { re: /\balmo[cç]/i, occasion: 'almoco', weight: 0.8 },
  { re: /festa|aniversári|balada/i, style: 'festa', occasion: 'festa', weight: 1 },
  { re: /casamento|formatura|\bevento\b|cerim[oô]nia/i, style: 'evento', occasion: 'evento', weight: 1 },
  { re: /viaj|viagem|aeroporto|\bvoo\b/i, style: 'viagem', occasion: 'viagem', weight: 1 },
  { re: /passear|passeio|shopping/i, style: 'casual', occasion: 'passeio', weight: 0.7 },
]

/** Estilos citados diretamente ("quero algo elegante"). */
const STYLE_WORDS: Array<{ re: RegExp; style: Style }> = [
  { re: /\belegante\b|sofisticad/i, style: 'elegante' },
  { re: /\bsocial\b/i, style: 'social' },
  { re: /\bcasual\b|tranquil|confort/i, style: 'casual' },
  { re: /\besportiv|\besporte\b/i, style: 'esporte' },
  { re: /\bfeminin/i, style: 'feminino' },
  { re: /\bmodern|atual|despojad/i, style: 'moderno' },
]

const PERIODS: Array<{ re: RegExp; period: ExtractedContext['period'] }> = [
  { re: /\bmanh[aã]|de manh[aã]|cedo\b/i, period: 'manha' },
  { re: /\btarde\b/i, period: 'tarde' },
  { re: /\bnoite\b|\bnoturn/i, period: 'noite' },
]

const DAYS = ['domingo', 'segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta', 'sábado', 'sabado', 'hoje', 'amanhã', 'amanha']

/**
 * Lê a frase do usuário e devolve o contexto.
 * Nunca inventa: o que não estiver no texto volta indefinido.
 */
export function extractContext(text: string): ExtractedContext {
  const t = (text ?? '').trim()
  if (!t) return { confidence: 0, matched: [] }

  const matched: string[] = []
  let style: Style | undefined
  let occasion: string | undefined
  let confidence = 0

  for (const rule of RULES) {
    if (!rule.re.test(t)) continue
    matched.push(rule.occasion ?? rule.style ?? 'regra')
    if (!occasion && rule.occasion) occasion = rule.occasion
    if (!style && rule.style) style = rule.style
    confidence = Math.max(confidence, rule.weight)
    break
  }

  // Estilo citado explicitamente sobrepõe o inferido da ocasião.
  for (const s of STYLE_WORDS) {
    if (s.re.test(t)) {
      matched.push(`estilo:${s.style}`)
      style = s.style
      confidence = Math.max(confidence, 0.7)
      break
    }
  }

  const period = PERIODS.find((p) => p.re.test(t))?.period
  const day = DAYS.find((d) => t.toLowerCase().includes(d))

  // "importante", "especial" pedem subir um degrau de formalidade.
  const elevated = /importante|especial|decisiv|chefe|diretor|cliente/i.test(t)
  const wantsNovelty = /diferente|nov[oa]\b|sair do [óo]bvio|ousad|arriscar|outra coisa/i.test(t)

  return { style, occasion, period, day, elevated, wantsNovelty, confidence, matched }
}
