import { describe, expect, it } from 'vitest'
import { BUCKETS, decodeRef, encodeRef, dataUrlToBuffer, inlineImage } from '@/services/image-service'

describe('referência de storage', () => {
  it('codifica e decodifica ida e volta', () => {
    const ref = encodeRef(BUCKETS.userPhotos, 'uid-1/principal.jpg')
    expect(ref).toBe('user-photos::uid-1/principal.jpg')
    expect(decodeRef(ref)).toEqual({ bucket: 'user-photos', path: 'uid-1/principal.jpg' })
  })

  it('não confunde URL assinada com referência', () => {
    expect(decodeRef('https://x.supabase.co/storage/v1/object/sign/user-photos/a.jpg?token=y')).toBeNull()
  })

  it('não confunde data URL com referência', () => {
    expect(decodeRef('data:image/png;base64,AAAA')).toBeNull()
  })

  it('rejeita bucket fora da lista conhecida', () => {
    expect(decodeRef('bucket-invasor::uid/arquivo.jpg')).toBeNull()
  })

  it('preserva caminho com barras', () => {
    const ref = encodeRef(BUCKETS.generatedLooks, 'uid/2026/09/look.png')
    expect(decodeRef(ref)?.path).toBe('uid/2026/09/look.png')
  })
})

describe('data URL', () => {
  it('extrai buffer e content type', () => {
    const { buffer, contentType } = dataUrlToBuffer('data:image/jpeg;base64,/9j/4AAQ')
    expect(contentType).toBe('image/jpeg')
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('rejeita string que não é data URL', () => {
    expect(() => dataUrlToBuffer('https://exemplo.com/a.jpg')).toThrow(/inválida/i)
  })

  it('imagem inline não gera referência de banco', () => {
    const stored = inlineImage(Buffer.from('abc'), 'image/png')
    expect(stored.ref).toBeNull()
    expect(stored.storage).toBe('inline')
    expect(stored.url.startsWith('data:image/png;base64,')).toBe(true)
  })
})
