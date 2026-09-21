/**
 * Remoção de fundo UNIFORME — função pura sobre pixels RGBA, sem canvas.
 *
 * Por que não IA: remover fundo com gpt-image-1 custa ~US$ 0,19 por peça;
 * uma foto com 15 sapatos sairia US$ 2,85 só para limpar fundo. As bibliotecas
 * de segmentação que rodam no navegador são pesadas (dezenas de MB de modelo)
 * e a mais usada tem licença AGPL, incompatível com produto fechado.
 *
 * O caso real é peça sobre cama, chão ou parede: fundo quase liso. Para esse
 * caso, preencher a partir das bordas o que tem a cor do fundo resolve de
 * graça. Quando o fundo não é liso, ou a peça tem a cor do fundo, a função
 * RECUSA em vez de arriscar apagar a peça — "quando possível" (pedido).
 */

export interface BackgroundResult {
  applied: boolean
  /** Por que não aplicou — vira texto para a pessoa, não fica mudo. */
  reason?: 'fundo-irregular' | 'peca-parecida-com-fundo' | 'sobrou-pouca-peca' | 'sobrou-quase-tudo'
  /**
   * Pixels RGBA com alfa ajustado. Só vem quando applied = true.
   * Tipado com ArrayBuffer (não ArrayBufferLike) para caber direto em ImageData.
   */
  data?: Uint8ClampedArray<ArrayBuffer>
  /** Fração da imagem que foi considerada fundo. */
  removedRatio: number
}

interface Options {
  /** Distância de cor para considerar "mesmo fundo". */
  tolerance?: number
  /** Desvio máximo aceito nas bordas para o fundo contar como liso. */
  maxBorderSpread?: number
  /** Contraste mínimo entre centro e fundo para não apagar a peça. */
  minContrast?: number
}

function dist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  // Distância euclidiana ponderada: o olho é mais sensível a verde.
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * 1.6
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? 0
}

export function removeUniformBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  opts: Options = {},
): BackgroundResult {
  const tolerance = opts.tolerance ?? 42
  const maxBorderSpread = opts.maxBorderSpread ?? 34
  const minContrast = opts.minContrast ?? 38
  const total = width * height

  // 1. Cor do fundo: mediana de um anel de 3% nas bordas.
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.03))
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= ring && x < width - ring && y >= ring && y < height - ring) continue
      const i = (y * width + x) * 4
      rs.push(pixels[i])
      gs.push(pixels[i + 1])
      bs.push(pixels[i + 2])
    }
  }
  const bg = [median(rs), median(gs), median(bs)] as const

  // 2. O fundo é liso? Se as bordas variam demais, não há "cor de fundo".
  let spread = 0
  for (let k = 0; k < rs.length; k++) spread += dist(rs[k], gs[k], bs[k], bg[0], bg[1], bg[2])
  spread /= rs.length
  if (spread > maxBorderSpread) return { applied: false, reason: 'fundo-irregular', removedRatio: 0 }

  // 3. A peça se distingue do fundo? Camisa branca em lençol branco: não arriscar.
  const cx0 = Math.floor(width * 0.3)
  const cx1 = Math.ceil(width * 0.7)
  const cy0 = Math.floor(height * 0.3)
  const cy1 = Math.ceil(height * 0.7)
  let cr = 0
  let cg = 0
  let cb = 0
  let cn = 0
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const i = (y * width + x) * 4
      cr += pixels[i]
      cg += pixels[i + 1]
      cb += pixels[i + 2]
      cn++
    }
  }
  if (cn > 0 && dist(cr / cn, cg / cn, cb / cn, bg[0], bg[1], bg[2]) < minContrast) {
    return { applied: false, reason: 'peca-parecida-com-fundo', removedRatio: 0 }
  }

  // 4. Preenchimento a partir das bordas. Só é fundo o que está CONECTADO à
  //    borda — um detalhe claro no meio da peça não é apagado.
  const isBg = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  const tryPush = (x: number, y: number) => {
    const p = y * width + x
    if (isBg[p]) return
    const i = p * 4
    if (dist(pixels[i], pixels[i + 1], pixels[i + 2], bg[0], bg[1], bg[2]) > tolerance) return
    isBg[p] = 1
    queue[tail++] = p
  }

  for (let x = 0; x < width; x++) {
    tryPush(x, 0)
    tryPush(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y)
    tryPush(width - 1, y)
  }

  while (head < tail) {
    const p = queue[head++]
    const x = p % width
    const y = (p - x) / width
    if (x > 0) tryPush(x - 1, y)
    if (x < width - 1) tryPush(x + 1, y)
    if (y > 0) tryPush(x, y - 1)
    if (y < height - 1) tryPush(x, y + 1)
  }

  const removedRatio = tail / total

  // 5. Sanidade: removeu quase nada, ou quase tudo — nos dois casos algo deu errado.
  if (removedRatio < 0.05) return { applied: false, reason: 'sobrou-quase-tudo', removedRatio }
  if (removedRatio > 0.93) return { applied: false, reason: 'sobrou-pouca-peca', removedRatio }

  // 6. Alfa com borda suave: pixel de peça vizinho de fundo fica semitransparente,
  //    senão o contorno sai serrilhado.
  const out = new Uint8ClampedArray(pixels)
  for (let p = 0; p < total; p++) {
    if (isBg[p]) {
      out[p * 4 + 3] = 0
      continue
    }
    const x = p % width
    const y = (p - x) / width
    let vizinhosFundo = 0
    if (x > 0 && isBg[p - 1]) vizinhosFundo++
    if (x < width - 1 && isBg[p + 1]) vizinhosFundo++
    if (y > 0 && isBg[p - width]) vizinhosFundo++
    if (y < height - 1 && isBg[p + width]) vizinhosFundo++
    if (vizinhosFundo > 0) out[p * 4 + 3] = Math.round(255 * (1 - vizinhosFundo * 0.18))
  }

  return { applied: true, data: out, removedRatio }
}

/** Menor retângulo que contém os pixels visíveis — para não sobrar moldura vazia. */
export function opaqueBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  alphaMin = 24,
): { x: number; y: number; w: number; h: number } | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < alphaMin) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export const BACKGROUND_REASON_TEXT: Record<NonNullable<BackgroundResult['reason']>, string> = {
  'fundo-irregular': 'Fundo com textura: mantive o recorte com fundo.',
  'peca-parecida-com-fundo': 'A peça tem a cor do fundo: não removi para não apagar a peça.',
  'sobrou-pouca-peca': 'A remoção apagaria a peça: mantive o fundo.',
  'sobrou-quase-tudo': 'Pouco fundo para remover: mantive como está.',
}
