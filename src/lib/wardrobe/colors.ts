/**
 * Harmonia de cores 100% determinística.
 * Chamar IA para dizer que preto combina com branco seria queimar token à toa (PRP §59).
 */

export type ColorFamily =
  | 'neutro' | 'vermelho' | 'laranja' | 'amarelo' | 'verde'
  | 'azul' | 'roxo' | 'rosa' | 'marrom' | 'metalico' | 'desconhecido'

const COLOR_MAP: Record<string, ColorFamily> = {
  preto: 'neutro', branco: 'neutro', 'off-white': 'neutro', cinza: 'neutro',
  grafite: 'neutro', bege: 'neutro', creme: 'neutro', nude: 'neutro',
  marinho: 'neutro', 'azul-marinho': 'neutro', cru: 'neutro', areia: 'neutro',
  vermelho: 'vermelho', bordo: 'vermelho', vinho: 'vermelho', carmim: 'vermelho',
  laranja: 'laranja', coral: 'laranja', terracota: 'laranja', ferrugem: 'laranja',
  amarelo: 'amarelo', mostarda: 'amarelo', ouro: 'metalico', dourado: 'metalico',
  prata: 'metalico', prateado: 'metalico', bronze: 'metalico',
  verde: 'verde', oliva: 'verde', militar: 'verde', menta: 'verde', esmeralda: 'verde',
  azul: 'azul', celeste: 'azul', turquesa: 'azul', jeans: 'azul', denim: 'azul',
  roxo: 'roxo', lilas: 'roxo', lavanda: 'roxo', violeta: 'roxo',
  rosa: 'rosa', pink: 'rosa', magenta: 'rosa', salmao: 'rosa',
  marrom: 'marrom', caramelo: 'marrom', chocolate: 'marrom', camel: 'marrom', tabaco: 'marrom',
}

/** Remove acento e caixa para casar "Azul Marinho" com "azul-marinho". */
export function normalizeColor(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
}

export function colorFamily(raw: string): ColorFamily {
  const n = normalizeColor(raw)
  if (COLOR_MAP[n]) return COLOR_MAP[n]
  // "verde-oliva" / "azul claro" caem aqui: casa pelo primeiro token conhecido.
  for (const token of n.split('-')) {
    if (COLOR_MAP[token]) return COLOR_MAP[token]
  }
  return 'desconhecido'
}

export function isNeutral(raw: string): boolean {
  return colorFamily(raw) === 'neutro'
}

/** Famílias que brigam quando usadas juntas em peças grandes. */
const CLASHES: ReadonlyArray<readonly [ColorFamily, ColorFamily]> = [
  ['vermelho', 'rosa'], ['vermelho', 'laranja'], ['laranja', 'rosa'],
  ['roxo', 'marrom'], ['verde', 'rosa'], ['amarelo', 'laranja'],
]

/** 0..1 — quão bem duas cores convivem. Neutro nunca erra. */
export function colorPairScore(a: string, b: string): number {
  const fa = colorFamily(a)
  const fb = colorFamily(b)
  if (fa === 'desconhecido' || fb === 'desconhecido') return 0.6
  if (fa === 'neutro' || fb === 'neutro') return 1
  if (fa === fb) return 0.85 // monocromático funciona, mas é menos interessante
  if (fa === 'metalico' || fb === 'metalico') return 0.9
  const clash = CLASHES.some(([x, y]) => (x === fa && y === fb) || (x === fb && y === fa))
  return clash ? 0.25 : 0.7
}

/** Média das combinações par a par. Um look só é tão bom quanto seu pior par. */
export function paletteScore(colors: string[]): number {
  const list = colors.filter(Boolean)
  if (list.length < 2) return 1
  let sum = 0
  let pairs = 0
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      sum += colorPairScore(list[i], list[j])
      pairs++
    }
  }
  const avg = sum / pairs
  const worst = Math.min(
    ...list.flatMap((c, i) => list.slice(i + 1).map((d) => colorPairScore(c, d))),
  )
  // Penaliza o pior par para que um único conflito grave não seja diluído pela média.
  return Number((avg * 0.7 + worst * 0.3).toFixed(4))
}
