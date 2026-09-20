/**
 * Reduz a imagem no navegador antes de enviar: menos payload, menos custo de
 * visão, e o celular não trava subindo uma foto de 12 MP.
 */
export async function downscale(file: File, maxSide: number, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', quality)
}
