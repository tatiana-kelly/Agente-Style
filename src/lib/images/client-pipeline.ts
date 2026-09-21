'use client'

import { FULL_BOX, padBox, toPixels, type Box } from './geometry'
import { BACKGROUND_REASON_TEXT, opaqueBounds, removeUniformBackground } from './background'

/**
 * Pipeline de recorte que roda no navegador.
 *
 * No navegador de propósito: a foto já está ali em resolução cheia, e recortar
 * no cliente evita subir 4000 px ao servidor só para cortar. O servidor recebe
 * só os recortes, cada um pequeno — o que também respeita o limite de 4,5 MB
 * por requisição da Vercel.
 */

export interface LoadedPhoto {
  bitmap: ImageBitmap
  width: number
  height: number
}

/** Abre a foto em resolução cheia, já com a orientação do EXIF aplicada. */
export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  return { bitmap, width: bitmap.width, height: bitmap.height }
}

function canvasOf(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')
  return { canvas, ctx }
}

/** Versão reduzida da foto inteira — é o que vai para a IA detectar as peças. */
export function toDataUrl(photo: LoadedPhoto, maxSide: number, quality = 0.88): string {
  const scale = Math.min(1, maxSide / Math.max(photo.width, photo.height))
  const w = Math.round(photo.width * scale)
  const h = Math.round(photo.height * scale)
  const { canvas, ctx } = canvasOf(w, h)
  ctx.drawImage(photo.bitmap, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

export interface Crop {
  /** Recorte com fundo, JPEG. Vira `image_original_url` da peça. */
  original: string
  /** Recorte sem fundo, PNG transparente — só quando deu para remover. */
  semFundo: string | null
  /** Por que não removeu, em texto para a pessoa. */
  avisoFundo: string | null
  /** Caixa efetivamente usada (com margem), para guardar no metadata. */
  box: Box
}

/**
 * Recorta uma peça da foto original.
 * `pad` é a margem em fração da caixa: caixa de modelo de visão costuma cortar a
 * ponta do sapato ou a alça da bolsa, e sobrar um pouco de fundo custa nada.
 */
export function cropPiece(
  photo: LoadedPhoto,
  box: Box | null,
  opts: { pad?: number; maxSide?: number; removerFundo?: boolean } = {},
): Crop {
  const pad = opts.pad ?? 0.08
  const maxSide = opts.maxSide ?? 900
  const efetiva = box ? padBox(box, pad) : FULL_BOX

  const { sx, sy, sw, sh } = toPixels(efetiva, photo.width, photo.height)
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))

  const { canvas, ctx } = canvasOf(w, h)
  ctx.drawImage(photo.bitmap, sx, sy, sw, sh, 0, 0, w, h)
  const original = canvas.toDataURL('image/jpeg', 0.9)

  if (opts.removerFundo === false || !box) {
    return { original, semFundo: null, avisoFundo: null, box: efetiva }
  }

  const imageData = ctx.getImageData(0, 0, w, h)
  const resultado = removeUniformBackground(imageData.data, w, h)

  if (!resultado.applied || !resultado.data) {
    return {
      original,
      semFundo: null,
      avisoFundo: resultado.reason ? BACKGROUND_REASON_TEXT[resultado.reason] : null,
      box: efetiva,
    }
  }

  // Apara a moldura transparente: a miniatura fica centrada na peça.
  const limites = opaqueBounds(resultado.data, w, h) ?? { x: 0, y: 0, w, h }
  const margem = Math.round(Math.max(limites.w, limites.h) * 0.04)
  const bx = Math.max(0, limites.x - margem)
  const by = Math.max(0, limites.y - margem)
  const bw = Math.min(w - bx, limites.w + margem * 2)
  const bh = Math.min(h - by, limites.h + margem * 2)

  ctx.putImageData(new ImageData(resultado.data, w, h), 0, 0)
  const recorte = canvasOf(bw, bh)
  recorte.ctx.drawImage(canvas, bx, by, bw, bh, 0, 0, bw, bh)

  return {
    original,
    semFundo: recorte.canvas.toDataURL('image/png'),
    avisoFundo: null,
    box: efetiva,
  }
}

/** Executa com paralelismo limitado — 15 uploads de uma vez sobrecarregam o celular. */
export async function emLotes<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T, indice: number) => Promise<R>,
  aoProgredir?: (feitos: number) => void,
): Promise<R[]> {
  const resultados: R[] = new Array(itens.length)
  let proximo = 0
  let feitos = 0

  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++
      resultados[i] = await tarefa(itens[i], i)
      feitos++
      aoProgredir?.(feitos)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador))
  return resultados
}
