import type { SupabaseClient } from '@supabase/supabase-js'

export const BUCKETS = {
  userPhotos: 'user-photos',
  wardrobeOriginal: 'wardrobe-original',
  wardrobeProcessed: 'wardrobe-processed',
  wardrobeThumbnails: 'wardrobe-thumbnails',
  generatedLooks: 'generated-looks',
} as const

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]

export interface StoredImage {
  /** URL pronta para exibir agora (assinada ou data URL). */
  url: string
  /** `bucket::caminho` para guardar no banco; null no modo demo. */
  ref: string | null
  storage: 'supabase' | 'inline'
}

/** Uma semana: tempo de vida da URL assinada devolvida ao cliente. */
export const SIGNED_URL_TTL = 60 * 60 * 24 * 7

/**
 * Upload com o cliente do PRÓPRIO usuário.
 *
 * Deliberadamente NÃO usa service role: as policies de Storage autorizam pela
 * primeira pasta do caminho (`<user_id>/`), então a RLS faz a autorização em vez
 * de ser contornada. Isso remove um segredo do sistema e fecha a porta para um bug
 * de autorização virar vazamento entre usuários.
 */
export async function uploadUserFile(
  db: SupabaseClient,
  bucket: BucketName,
  userId: string,
  fileName: string,
  data: Buffer,
  contentType: string,
): Promise<StoredImage> {
  const path = `${userId}/${fileName}`

  const { error } = await db.storage.from(bucket).upload(path, data, { contentType, upsert: true })
  if (error) throw new Error(`Upload para ${bucket} falhou: ${error.message}`)

  const signed = await db.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL)
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`Não consegui assinar a URL de ${path}: ${signed.error?.message ?? 'sem URL'}`)
  }

  return { url: signed.data.signedUrl, ref: encodeRef(bucket, path), storage: 'supabase' }
}

export function inlineImage(data: Buffer, contentType: string): StoredImage {
  return { url: `data:${contentType};base64,${data.toString('base64')}`, ref: null, storage: 'inline' }
}

export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!match) throw new Error('Data URL inválida')
  return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] }
}

/**
 * Referência de arquivo guardada no banco: `bucket::caminho`.
 *
 * O banco NÃO guarda URL assinada: ela expira em 7 dias e a peça ficaria sem foto.
 * Também não guarda data URL: um JPEG de 700 KB em coluna de texto inviabiliza
 * listar o guarda-roupa. Guarda a referência e assina na leitura.
 */
const REF_SEPARATOR = '::'

export function encodeRef(bucket: BucketName, path: string): string {
  return `${bucket}${REF_SEPARATOR}${path}`
}

export function decodeRef(value: string): { bucket: BucketName; path: string } | null {
  const idx = value.indexOf(REF_SEPARATOR)
  if (idx === -1) return null
  const bucket = value.slice(0, idx) as BucketName
  if (!Object.values(BUCKETS).includes(bucket)) return null
  return { bucket, path: value.slice(idx + REF_SEPARATOR.length) }
}

/**
 * Troca referências por URLs assinadas, agrupando por bucket para não fazer
 * uma chamada por peça ao listar o guarda-roupa.
 */
export async function signRefs(
  db: SupabaseClient,
  values: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const byBucket = new Map<BucketName, Set<string>>()

  for (const value of values) {
    const ref = value ? decodeRef(value) : null
    if (!ref) continue
    if (!byBucket.has(ref.bucket)) byBucket.set(ref.bucket, new Set())
    byBucket.get(ref.bucket)!.add(ref.path)
  }

  const resolved = new Map<string, string>()

  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, paths]) => {
      const list = [...paths]
      const { data, error } = await db.storage.from(bucket).createSignedUrls(list, SIGNED_URL_TTL)
      if (error || !data) {
        console.error(`[storage:${bucket}] falha ao assinar URLs:`, error?.message)
        return
      }
      for (const entry of data) {
        if (entry.signedUrl && entry.path) resolved.set(encodeRef(bucket, entry.path), entry.signedUrl)
      }
    }),
  )

  return resolved
}
