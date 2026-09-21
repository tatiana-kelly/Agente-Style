import { describe, expect, it } from 'vitest'
import {
  dedupeByOverlap, iou, normalizeBox, padBox, readingOrder, toPixels, type Box,
} from '@/lib/images/geometry'
import { opaqueBounds, removeUniformBackground } from '@/lib/images/background'

describe('normalização da caixa devolvida pela IA', () => {
  it('aceita [x, y, w, h] em fração', () => {
    expect(normalizeBox([0.1, 0.2, 0.3, 0.4])).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })
  })

  it('aceita objeto {x, y, w, h}', () => {
    expect(normalizeBox({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 })).toEqual({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 })
  })

  it('converte pixels quando sabe o tamanho da imagem', () => {
    const b = normalizeBox([100, 50, 200, 100], 1000, 500)!
    expect(b.x).toBeCloseTo(0.1)
    expect(b.w).toBeCloseTo(0.2)
    expect(b.h).toBeCloseTo(0.2)
  })

  it('recusa pixels quando não sabe o tamanho', () => {
    expect(normalizeBox([100, 50, 200, 100])).toBeNull()
  })

  it('corrige formato [x1, y1, x2, y2]', () => {
    const b = normalizeBox([0.6, 0.1, 0.9, 0.4])!
    expect(b.x).toBeCloseTo(0.6)
    expect(b.w).toBeCloseTo(0.3)
    expect(b.h).toBeCloseTo(0.3)
  })

  it('corta o que sai da imagem', () => {
    const b = normalizeBox([0.8, 0.8, 0.5, 0.5])!
    expect(b.x + b.w).toBeLessThanOrEqual(1)
    expect(b.y + b.h).toBeLessThanOrEqual(1)
  })

  it('recusa caixa degenerada e lixo', () => {
    expect(normalizeBox([0.5, 0.5, 0.001, 0.3])).toBeNull()
    expect(normalizeBox('abc')).toBeNull()
    expect(normalizeBox([1, 2])).toBeNull()
    expect(normalizeBox(null)).toBeNull()
  })
})

describe('margem do recorte', () => {
  it('amplia sem sair da imagem', () => {
    const b = padBox({ x: 0.02, y: 0.02, w: 0.5, h: 0.5 }, 0.2)
    expect(b.x).toBe(0)
    expect(b.y).toBe(0)
    expect(b.x + b.w).toBeLessThanOrEqual(1)
  })

  it('cresce proporcionalmente à caixa', () => {
    const b = padBox({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 0.1)
    expect(b.w).toBeCloseTo(0.24)
    expect(b.x).toBeCloseTo(0.38)
  })
})

describe('deduplicação por sobreposição — REGRESSÃO dos 15 sapatos', () => {
  const sapato = (x: number, y: number) => ({
    box: { x, y, w: 0.15, h: 0.15 } as Box,
    category: 'shoes',
    color: 'preto',
    subcategory: 'sapato',
  })

  it('15 sapatos pretos idênticos em lugares diferentes continuam 15', () => {
    const quinze = []
    for (let linha = 0; linha < 3; linha++) {
      for (let col = 0; col < 5; col++) quinze.push(sapato(col * 0.19, linha * 0.3))
    }
    // O bug antigo deduplicava por categoria+subcategoria+cor e devolvia 1.
    expect(dedupeByOverlap(quinze)).toHaveLength(15)
  })

  it('a mesma peça detectada duas vezes vira uma', () => {
    const a = sapato(0.2, 0.2)
    const quaseIgual = { ...sapato(0.21, 0.205) }
    expect(dedupeByOverlap([a, quaseIgual])).toHaveLength(1)
  })

  it('não funde categorias diferentes no mesmo lugar (blusa sobre calça)', () => {
    const blusa = { box: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, category: 'top' }
    const calca = { box: { x: 0.2, y: 0.22, w: 0.5, h: 0.5 }, category: 'bottom' }
    expect(dedupeByOverlap([blusa, calca])).toHaveLength(2)
  })

  it('iou de caixas separadas é zero', () => {
    expect(iou({ x: 0, y: 0, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.5, w: 0.2, h: 0.2 })).toBe(0)
  })

  it('iou de caixas idênticas é um', () => {
    const b = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }
    expect(iou(b, b)).toBeCloseTo(1)
  })
})

describe('conversão e ordem', () => {
  it('caixa normalizada vira pixels dentro da imagem', () => {
    const r = toPixels({ x: 0.5, y: 0.5, w: 0.6, h: 0.6 }, 1000, 800)
    expect(r.sx + r.sw).toBeLessThanOrEqual(1000)
    expect(r.sy + r.sh).toBeLessThanOrEqual(800)
  })

  it('ordena de cima para baixo, esquerda para direita', () => {
    const itens = [
      { box: { x: 0.6, y: 0.6, w: 0.1, h: 0.1 }, id: 'baixo-dir' },
      { box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 }, id: 'cima-esq' },
      { box: { x: 0.6, y: 0.1, w: 0.1, h: 0.1 }, id: 'cima-dir' },
    ]
    expect(readingOrder(itens).map((i) => i.id)).toEqual(['cima-esq', 'cima-dir', 'baixo-dir'])
  })
})

/** Imagem sintética: fundo de uma cor, retângulo de outra no meio. */
function imagem(
  w: number,
  h: number,
  fundo: [number, number, number],
  peca: [number, number, number],
  ruidoFundo = 0,
): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const dentro = x > w * 0.25 && x < w * 0.75 && y > h * 0.25 && y < h * 0.75
      const cor = dentro ? peca : fundo
      // ruído determinístico para simular textura
      const r = ruidoFundo && !dentro ? ((x * 37 + y * 91) % ruidoFundo) - ruidoFundo / 2 : 0
      px[i] = cor[0] + r
      px[i + 1] = cor[1] + r
      px[i + 2] = cor[2] + r
      px[i + 3] = 255
    }
  }
  return px
}

describe('remoção de fundo uniforme', () => {
  it('remove fundo claro liso em volta de peça escura', () => {
    const px = imagem(80, 80, [240, 238, 232], [30, 30, 40])
    const r = removeUniformBackground(px, 80, 80)
    expect(r.applied).toBe(true)
    // canto é fundo → transparente
    expect(r.data![3]).toBe(0)
    // centro é peça → opaco
    const centro = (40 * 80 + 40) * 4
    expect(r.data![centro + 3]).toBe(255)
  })

  it('não apaga peça da mesma cor do fundo (camisa branca no lençol branco)', () => {
    const px = imagem(80, 80, [240, 238, 232], [236, 234, 230])
    const r = removeUniformBackground(px, 80, 80)
    expect(r.applied).toBe(false)
    expect(r.reason).toBe('peca-parecida-com-fundo')
  })

  it('recusa fundo com textura forte', () => {
    const px = imagem(80, 80, [150, 120, 90], [20, 20, 20], 140)
    const r = removeUniformBackground(px, 80, 80)
    expect(r.applied).toBe(false)
    expect(r.reason).toBe('fundo-irregular')
  })

  it('só apaga fundo conectado à borda — detalhe claro no meio da peça fica', () => {
    const w = 80
    const h = 80
    const px = imagem(w, h, [240, 238, 232], [30, 30, 40])
    // botão branco no meio da peça escura, mesma cor do fundo
    for (let y = 38; y < 42; y++) {
      for (let x = 38; x < 42; x++) {
        const i = (y * w + x) * 4
        px[i] = 240
        px[i + 1] = 238
        px[i + 2] = 232
      }
    }
    const r = removeUniformBackground(px, w, h)
    expect(r.applied).toBe(true)
    const botao = (40 * w + 40) * 4
    expect(r.data![botao + 3]).toBe(255)
  })

  it('limites opacos encontram a peça', () => {
    const px = imagem(80, 80, [240, 238, 232], [30, 30, 40])
    const r = removeUniformBackground(px, 80, 80)
    const b = opaqueBounds(r.data!, 80, 80)!
    expect(b.x).toBeGreaterThanOrEqual(18)
    expect(b.x + b.w).toBeLessThanOrEqual(62)
  })
})

/** Desenha retângulos de "peça" sobre fundo liso: [x0, y0, x1, y1] em pixels. */
function cena(w: number, h: number, blocos: Array<[number, number, number, number]>): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const dentro = blocos.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)
      const cor = dentro ? [30, 30, 40] : [240, 238, 232]
      px[i] = cor[0]
      px[i + 1] = cor[1]
      px[i + 2] = cor[2]
      px[i + 3] = 255
    }
  }
  return px
}

const alfa = (r: ReturnType<typeof removeUniformBackground>, w: number, x: number, y: number) =>
  r.data![(y * w + x) * 4 + 3]

describe('margem generosa sem trazer o vizinho', () => {
  it('descarta pedaço de peça vizinha que entra pela borda', () => {
    const w = 100
    const h = 100
    // peça principal no meio + fatia do sapato vizinho encostada na borda direita
    const px = cena(w, h, [[25, 30, 70, 75], [92, 40, 100, 60]])
    const r = removeUniformBackground(px, w, h)
    expect(r.applied).toBe(true)
    expect(alfa(r, w, 47, 52)).toBe(255) // peça principal fica
    expect(alfa(r, w, 96, 50)).toBe(0) // fragmento do vizinho sai
  })

  it('NÃO descarta o segundo pé do par (bloco grande, fora da borda)', () => {
    const w = 120
    const h = 100
    // dois pés do mesmo tamanho, separados, nenhum tocando a borda
    const px = cena(w, h, [[15, 30, 52, 75], [66, 30, 103, 75]])
    const r = removeUniformBackground(px, w, h)
    expect(r.applied).toBe(true)
    expect(alfa(r, w, 30, 50)).toBe(255)
    expect(alfa(r, w, 85, 50)).toBe(255)
  })

  it('NÃO descarta a peça principal mesmo quando ela encosta na borda', () => {
    const w = 100
    const h = 100
    // recorte apertado: a peça toca a borda esquerda, e é o maior bloco
    const px = cena(w, h, [[0, 25, 60, 75]])
    const r = removeUniformBackground(px, w, h)
    expect(r.applied).toBe(true)
    expect(alfa(r, w, 30, 50)).toBe(255)
  })

  it('segundo pé grande que encosta na borda também fica', () => {
    const w = 120
    const h = 100
    const px = cena(w, h, [[15, 30, 55, 75], [80, 30, 120, 75]])
    const r = removeUniformBackground(px, w, h)
    expect(r.applied).toBe(true)
    expect(alfa(r, w, 100, 50)).toBe(255)
  })
})
