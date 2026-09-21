import { colorFamily, isNeutral, normalizeColor, type ColorFamily } from '@/lib/wardrobe/colors'

/**
 * Color Intelligence Engine.
 *
 * A versão anterior comparava cor com cor e classificava tudo o que não fosse
 * neutro como "ok" ou "conflito". Isso é pouco para um stylist: marinho + branco,
 * camel + creme e bordô + rosa são combinações boas por motivos DIFERENTES, e o
 * sistema precisa saber qual é o motivo para conseguir explicar a escolha.
 */
export const COLOR_RELATIONS = [
  'MONOCHROMATIC',
  'TONAL',
  'ANALOGOUS',
  'COMPLEMENTARY',
  'SPLIT_COMPLEMENTARY',
  'NEUTRAL',
  'NEUTRAL_ACCENT',
  'CLASSIC',
  'UNRELATED',
] as const
export type ColorRelation = (typeof COLOR_RELATIONS)[number]

/** Ângulo aproximado no círculo cromático, por família. Neutros não têm matiz. */
const HUE: Partial<Record<ColorFamily, number>> = {
  vermelho: 0,
  laranja: 30,
  amarelo: 55,
  verde: 120,
  azul: 220,
  roxo: 280,
  rosa: 330,
  marrom: 25,
}

/**
 * Pares consagrados. Não são regra absoluta — são sinais que elevam a nota,
 * porque funcionam na prática mesmo quando a teoria do círculo cromático diria
 * que são só "análogos quaisquer".
 */
const CLASSIC_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['marinho', 'branco'], ['preto', 'branco'], ['creme', 'bege'], ['camel', 'branco'],
  ['marinho', 'bege'], ['vinho', 'rosa'], ['verde', 'creme'], ['oliva', 'creme'],
  ['azul', 'branco'], ['marrom', 'creme'], ['cinza', 'rosa'], ['camel', 'marinho'],
  ['preto', 'camel'], ['marinho', 'vinho'], ['cinza', 'branco'], ['bege', 'branco'],
]

/** Famílias que brigam quando ocupam peças grandes ao mesmo tempo. */
const CLASHES: ReadonlyArray<readonly [ColorFamily, ColorFamily]> = [
  ['vermelho', 'rosa'], ['vermelho', 'laranja'], ['laranja', 'rosa'],
  ['roxo', 'marrom'], ['verde', 'rosa'], ['amarelo', 'laranja'],
]

/** Distância angular mínima entre dois matizes (0–180). */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function isClassicPair(a: string, b: string): boolean {
  const [x, y] = [normalizeColor(a), normalizeColor(b)]
  return CLASSIC_PAIRS.some(([p, q]) => (p === x && q === y) || (p === y && q === x))
}

/** Que tipo de relação existe entre duas cores. É isto que alimenta a explicação. */
export function colorRelation(a: string, b: string): ColorRelation {
  const [na, nb] = [normalizeColor(a), normalizeColor(b)]
  const [fa, fb] = [colorFamily(a), colorFamily(b)]

  if (na === nb) return 'MONOCHROMATIC'
  if (isClassicPair(a, b)) return 'CLASSIC'

  const neutralA = isNeutral(a)
  const neutralB = isNeutral(b)
  if (neutralA && neutralB) return 'NEUTRAL'
  if (neutralA || neutralB) return 'NEUTRAL_ACCENT'

  if (fa === fb) return 'TONAL'
  if (fa === 'metalico' || fb === 'metalico') return 'NEUTRAL_ACCENT'

  const ha = HUE[fa]
  const hb = HUE[fb]
  if (ha === undefined || hb === undefined) return 'UNRELATED'

  const d = hueDistance(ha, hb)
  if (d <= 45) return 'ANALOGOUS'
  if (d >= 150) return 'COMPLEMENTARY'
  if (d >= 110) return 'SPLIT_COMPLEMENTARY'
  return 'UNRELATED'
}

/**
 * 0 incompatível · 1 possível · 2 boa · 3 excelente.
 *
 * Nota baixa NÃO elimina a peça: o ranker apenas prefere outra coisa. Combinação
 * ousada precisa continuar possível, senão o produto só sabe fazer o óbvio (§10).
 */
export function colorCompatibility(a: string, b: string): 0 | 1 | 2 | 3 {
  const relation = colorRelation(a, b)
  const [fa, fb] = [colorFamily(a), colorFamily(b)]

  const clash = CLASHES.some(([x, y]) => (x === fa && y === fb) || (x === fb && y === fa))
  if (clash) return relation === 'CLASSIC' ? 2 : 0

  switch (relation) {
    case 'CLASSIC':
    case 'NEUTRAL':
      return 3
    case 'NEUTRAL_ACCENT':
    case 'MONOCHROMATIC':
      return 3
    case 'TONAL':
      return 2
    case 'COMPLEMENTARY':
      return 2
    case 'ANALOGOUS':
      return 2
    case 'SPLIT_COMPLEMENTARY':
      return 1
    case 'UNRELATED':
    default:
      return 1
  }
}

export interface PaletteAnalysis {
  /** 0..1, usado pelo ranker. */
  score: number
  /** Relação dominante entre as peças grandes — alimenta a explicação. */
  dominant: ColorRelation
  /** Quantas cores distintas o look tem. */
  distinct: number
  /** Pior par encontrado, para justificar uma nota baixa. */
  worstPair?: [string, string]
}

/**
 * Analisa a paleta do look inteiro.
 * Penaliza o pior par além da média: um único conflito grave não pode ser
 * diluído por três acertos.
 */
export function analyzePalette(colors: string[]): PaletteAnalysis {
  const list = colors.filter(Boolean)
  if (list.length === 0) return { score: 1, dominant: 'NEUTRAL', distinct: 0 }
  if (list.length === 1) return { score: 1, dominant: 'MONOCHROMATIC', distinct: 1 }

  const relationCount = new Map<ColorRelation, number>()
  let sum = 0
  let pairs = 0
  let worst = 4
  let worstPair: [string, string] | undefined

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const score = colorCompatibility(list[i], list[j])
      const relation = colorRelation(list[i], list[j])
      relationCount.set(relation, (relationCount.get(relation) ?? 0) + 1)
      sum += score
      pairs++
      if (score < worst) {
        worst = score
        worstPair = [list[i], list[j]]
      }
    }
  }

  const avg = sum / pairs / 3
  const worstNorm = worst / 3
  const score = Number((avg * 0.65 + worstNorm * 0.35).toFixed(4))

  // A relação dominante ignora NEUTRAL_ACCENT quando existe algo mais informativo:
  // dizer "tem um neutro" explica menos que "é uma dupla clássica".
  const ranked = [...relationCount.entries()].sort((a, b) => b[1] - a[1])
  const informative = ranked.find(([r]) => r !== 'NEUTRAL_ACCENT' && r !== 'UNRELATED')
  const dominant = informative?.[0] ?? ranked[0]?.[0] ?? 'NEUTRAL'

  return { score, dominant, distinct: new Set(list.map(normalizeColor)).size, worstPair }
}

/** Frase curta que justifica a paleta, usada na explicação ao usuário (§28). */
export function describeRelation(relation: ColorRelation): string {
  const frases: Record<ColorRelation, string> = {
    MONOCHROMATIC: 'um look monocromático, que alonga a silhueta',
    TONAL: 'uma cartela tonal, variando a mesma família de cor',
    ANALOGOUS: 'cores vizinhas no círculo cromático, que conversam sem competir',
    COMPLEMENTARY: 'um contraste complementar, que dá ponto de interesse',
    SPLIT_COMPLEMENTARY: 'um contraste suavizado',
    NEUTRAL: 'uma base neutra, fácil de usar e difícil de errar',
    NEUTRAL_ACCENT: 'um neutro ancorando a cor de destaque',
    CLASSIC: 'uma dupla clássica, que funciona sempre',
    UNRELATED: 'uma combinação mais livre',
  }
  return frases[relation]
}
