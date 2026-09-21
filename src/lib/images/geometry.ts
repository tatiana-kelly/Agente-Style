/**
 * Geometria de recorte — funções puras, sem canvas, para rodar em teste.
 *
 * Toda caixa aqui é NORMALIZADA: x, y, w, h em 0..1 relativos à imagem.
 * É o formato que o modelo de visão devolve e o único que sobrevive a
 * redimensionamento: a mesma caixa serve para a imagem de 1280 px enviada à IA
 * e para a original de 4000 px de onde sai o recorte.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export const FULL_BOX: Box = { x: 0, y: 0, w: 1, h: 1 }

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * Aceita a caixa como o modelo mandar e devolve uma caixa válida, ou null.
 * Modelos às vezes devolvem pixels em vez de fração, ou [x1,y1,x2,y2] em vez
 * de [x,y,w,h]; os dois casos são detectáveis e corrigidos aqui.
 */
export function normalizeBox(raw: unknown, imageW?: number, imageH?: number): Box | null {
  let arr: number[] | null = null

  if (Array.isArray(raw) && raw.length === 4 && raw.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    arr = raw as number[]
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const vals = [o.x, o.y, o.w ?? o.width, o.h ?? o.height]
    if (vals.every((n) => typeof n === 'number' && Number.isFinite(n))) arr = vals as number[]
  }
  if (!arr) return null

  let [x, y, w, h] = arr

  // Pixels em vez de fração: só dá para converter se soubermos o tamanho.
  if (Math.max(x, y, w, h) > 1.5) {
    if (!imageW || !imageH) return null
    x /= imageW
    w /= imageW
    y /= imageH
    h /= imageH
  }

  // Formato [x1,y1,x2,y2]: a "largura" passa do canto direito quando somada.
  if (x + w > 1.02 && w > x && h > y) {
    w = w - x
    h = h - y
  }

  x = clamp01(x)
  y = clamp01(y)
  w = clamp01(Math.min(w, 1 - x))
  h = clamp01(Math.min(h, 1 - y))

  // Caixa degenerada não recorta nada útil.
  if (w < 0.02 || h < 0.02) return null
  return { x, y, w, h }
}

/**
 * Amplia a caixa por uma fração do próprio tamanho.
 * Caixa de modelo de visão tende a cortar a ponta do sapato ou a alça da bolsa;
 * uma margem generosa custa pouco e evita perder a peça.
 */
export function padBox(box: Box, pad: number): Box {
  const dx = box.w * pad
  const dy = box.h * pad
  const x = clamp01(box.x - dx)
  const y = clamp01(box.y - dy)
  return {
    x,
    y,
    w: clamp01(Math.min(box.w + dx * 2, 1 - x)),
    h: clamp01(Math.min(box.h + dy * 2, 1 - y)),
  }
}

export function area(box: Box): number {
  return box.w * box.h
}

/** Interseção sobre união: 0 = caixas separadas, 1 = idênticas. */
export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const union = area(a) + area(b) - inter
  return union <= 0 ? 0 : inter / union
}

/**
 * Remove detecções repetidas pela SOBREPOSIÇÃO das caixas, não pelos atributos.
 *
 * A versão anterior deduplicava por categoria+subcategoria+cor. Numa foto com
 * 15 sapatos pretos, isso fundia os 15 num só. Duas peças iguais em lugares
 * diferentes são duas peças; só é duplicata o que ocupa o mesmo lugar.
 */
export function dedupeByOverlap<T extends { box: Box | null; category: string }>(
  items: T[],
  threshold = 0.6,
): T[] {
  const kept: T[] = []
  for (const item of items) {
    if (!item.box) {
      kept.push(item)
      continue
    }
    const dup = kept.some(
      (k) => k.box && k.category === item.category && iou(k.box, item.box as Box) >= threshold,
    )
    if (!dup) kept.push(item)
  }
  return kept
}

/** Caixa normalizada → retângulo em pixels de uma imagem de tamanho real. */
export function toPixels(box: Box, width: number, height: number) {
  const sx = Math.round(box.x * width)
  const sy = Math.round(box.y * height)
  const sw = Math.max(1, Math.round(box.w * width))
  const sh = Math.max(1, Math.round(box.h * height))
  return {
    sx: Math.min(sx, width - 1),
    sy: Math.min(sy, height - 1),
    sw: Math.min(sw, width - sx),
    sh: Math.min(sh, height - sy),
  }
}

/** Ordena como se lê: de cima para baixo, da esquerda para a direita. */
export function readingOrder<T extends { box: Box | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.box || !b.box) return 0
    const linhaA = Math.round((a.box.y + a.box.h / 2) * 6)
    const linhaB = Math.round((b.box.y + b.box.h / 2) * 6)
    if (linhaA !== linhaB) return linhaA - linhaB
    return a.box.x - b.box.x
  })
}
