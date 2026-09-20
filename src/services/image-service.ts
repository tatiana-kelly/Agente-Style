import { createAdminSupabase } from '@/lib/supabase/admin'

export const BUCKETS = {
  userPhotos: 'user-photos',
  wardrobeOriginal: 'wardrobe-original',
  wardrobeProcessed: 'wardrobe-processed',
  wardrobeThumbnails: 'wardrobe-thumbnails',
  generatedLooks: 'generated-looks',
} as const

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]

export interface StoredImage {
  url: string
  path: string | null
  storage: 'supabase' | 'inline'
}

/**
 * Persiste a imagem no Storage privado e devolve URL assinada (PRP §42).
 * Sem Supabase, devolve data URL: o look aparece na tela mesmo em modo demo.
 */
export async function storeImage(
  bucket: BucketName,
  userId: string,
  fileName: string,
  data: Buffer,
  contentType = 'image/png',
): Promise<StoredImage> {
  const db = createAdminSupabase()
  const inline = { url: `data:${contentType};base64,${data.toString('base64')}`, path: null, storage: 'inline' as const }
  if (!db) return inline

  // O user_id como primeira pasta é o que as policies de Storage usam para autorizar.
  const path = `${userId}/${fileName}`

  const { error } = await db.storage.from(bucket).upload(path, data, { contentType, upsert: true })
  if (error) {
    console.error(`[storage:${bucket}] upload falhou:`, error.message)
    return inline
  }

  const signed = await db.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7)
  if (signed.error || !signed.data?.signedUrl) return inline

  return { url: signed.data.signedUrl, path, storage: 'supabase' }
}

/** Renova a URL assinada de um arquivo já armazenado. */
export async function signedUrlFor(bucket: BucketName, path: string, seconds = 3600): Promise<string | null> {
  const db = createAdminSupabase()
  if (!db) return null
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, seconds)
  return error ? null : (data?.signedUrl ?? null)
}

export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!match) throw new Error('Data URL inválida')
  return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] }
}
