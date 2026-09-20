import type { SupabaseClient } from '@supabase/supabase-js'
import { classificationSchema, type CreateWardrobeItemInput, type WardrobeItem } from '@/schemas/wardrobe'
import type { Outfit, OutfitRole, Style } from '@/schemas/outfit'
import type { UserPhoto, UserPreference, UserProfile } from '@/schemas/user'
import type {
  AgentRunRecord, AiUsageRecord, GeneratedLookRecord, Repository, SaveOutfitInput,
} from './repository'
import { signRefs, uploadUserFile, type BucketName, type StoredImage } from './image-service'

/**
 * Driver Supabase.
 * Todo método filtra por user_id mesmo com RLS ativa: defesa em profundidade (PRP §41).
 */
export class SupabaseRepository implements Repository {
  readonly driver = 'supabase' as const

  constructor(private readonly db: SupabaseClient) {}

  async listItems(userId: string): Promise<WardrobeItem[]> {
    const { data, error } = await this.db
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (error) throw error
    return this.resolveItemImages((data ?? []) as WardrobeItem[])
  }

  /** O banco guarda `bucket::caminho`; a UI precisa de URL assinada. */
  private async resolveItemImages(items: WardrobeItem[]): Promise<WardrobeItem[]> {
    const signed = await signRefs(
      this.db,
      items.flatMap((i) => [i.image_original_url, i.image_processed_url, i.thumbnail_url]),
    )
    const swap = (v: string | null) => (v ? (signed.get(v) ?? v) : v)

    return items.map((i) => ({
      ...i,
      image_original_url: swap(i.image_original_url),
      image_processed_url: swap(i.image_processed_url),
      thumbnail_url: swap(i.thumbnail_url),
    }))
  }

  async getItem(userId: string, id: string): Promise<WardrobeItem | null> {
    const { data, error } = await this.db
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return (await this.resolveItemImages([data as WardrobeItem]))[0]
  }

  async createItem(userId: string, input: CreateWardrobeItemInput): Promise<WardrobeItem> {
    const base = classificationSchema.parse({
      category: input.category,
      subcategory: input.subcategory,
      color: input.color,
      secondary_colors: input.secondary_colors ?? [],
      pattern: input.pattern ?? 'liso',
      material: input.material ?? 'desconhecido',
      style: input.style ?? 'casual',
      formality: input.formality ?? 3,
      sport_type: input.sport_type ?? 'nenhum',
      season: input.season ?? ['verao', 'outono', 'inverno', 'primavera'],
      occasion: input.occasion ?? [],
      description: input.description ?? '',
    })

    const { data, error } = await this.db
      .from('wardrobe_items')
      .insert({
        ...base,
        user_id: userId,
        name: input.name,
        brand: input.brand ?? null,
        image_original_url: input.image_original_url ?? null,
        image_processed_url: input.image_processed_url ?? null,
        thumbnail_url: input.thumbnail_url ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as WardrobeItem
  }

  async updateItem(userId: string, id: string, patch: Partial<CreateWardrobeItemInput>) {
    const { data, error } = await this.db
      .from('wardrobe_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) throw error
    return (data as WardrobeItem) ?? null
  }

  async deleteItem(userId: string, id: string): Promise<boolean> {
    const { error, count } = await this.db
      .from('wardrobe_items')
      .update({ active: false }, { count: 'exact' })
      .eq('user_id', userId)
      .eq('id', id)
    if (error) throw error
    return (count ?? 0) > 0
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.db.from('users').select('*').eq('id', userId).maybeSingle()
    if (error) throw error
    return (data as UserProfile) ?? null
  }

  async updateProfile(userId: string, patch: Partial<UserProfile>) {
    const { data, error } = await this.db
      .from('users')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .maybeSingle()
    if (error) throw error
    return (data as UserProfile) ?? null
  }

  async getPrimaryPhoto(userId: string): Promise<UserPhoto | null> {
    const { data, error } = await this.db
      .from('user_photos')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null

    const photo = data as UserPhoto
    const signed = await signRefs(this.db, [photo.image_url])
    return { ...photo, image_url: signed.get(photo.image_url) ?? photo.image_url }
  }

  async setPrimaryPhoto(userId: string, imageUrl: string): Promise<UserPhoto> {
    await this.db.from('user_photos').update({ is_primary: false }).eq('user_id', userId)
    const { data, error } = await this.db
      .from('user_photos')
      .insert({ user_id: userId, image_url: imageUrl, photo_type: 'full-body', is_primary: true })
      .select('*')
      .single()
    if (error) throw error
    await this.db.from('users').update({ avatar_url: imageUrl }).eq('id', userId)
    return data as UserPhoto
  }

  async saveOutfit(input: SaveOutfitInput): Promise<Outfit> {
    const { data: outfit, error } = await this.db
      .from('outfits')
      .insert({
        user_id: input.userId,
        name: input.name,
        occasion: input.occasion ?? null,
        style: input.style,
        context: input.context ?? null,
        status: input.status ?? 'draft',
        explanation: input.explanation,
        scores: input.scores,
      })
      .select('*')
      .single()
    if (error) throw error

    if (input.items.length > 0) {
      const { error: itemsError } = await this.db.from('outfit_items').insert(
        input.items.map((i) => ({
          outfit_id: outfit.id,
          wardrobe_item_id: i.wardrobe_item_id,
          role: i.role,
        })),
      )
      if (itemsError) throw itemsError
    }

    return { ...(outfit as Outfit), items: input.items }
  }

  async listOutfits(userId: string, style?: Style): Promise<Outfit[]> {
    let query = this.db
      .from('outfits')
      .select('*, outfit_items(wardrobe_item_id, role)')
      .eq('user_id', userId)
      .eq('status', 'saved')
      .order('created_at', { ascending: false })
    if (style) query = query.eq('style', style)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(mapOutfitRow)
  }

  async getOutfit(userId: string, id: string): Promise<Outfit | null> {
    const { data, error } = await this.db
      .from('outfits')
      .select('*, outfit_items(wardrobe_item_id, role)')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? mapOutfitRow(data) : null
  }

  async markOutfitSaved(userId: string, id: string): Promise<boolean> {
    const { error, count } = await this.db
      .from('outfits')
      .update({ status: 'saved' }, { count: 'exact' })
      .eq('user_id', userId)
      .eq('id', id)
    if (error) throw error
    return (count ?? 0) > 0
  }

  async saveGeneratedLook(record: Omit<GeneratedLookRecord, 'id' | 'created_at'>) {
    const { data, error } = await this.db.from('generated_looks').insert(record).select('*').single()
    if (error) throw error
    return data as GeneratedLookRecord
  }

  async getGeneratedLook(userId: string, outfitId: string) {
    const { data, error } = await this.db
      .from('generated_looks')
      .select('*')
      .eq('user_id', userId)
      .eq('outfit_id', outfitId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null

    const look = data as GeneratedLookRecord
    if (!look.image_url) return look
    const signed = await signRefs(this.db, [look.image_url])
    return { ...look, image_url: signed.get(look.image_url) ?? look.image_url }
  }

  async listPreferences(userId: string): Promise<UserPreference[]> {
    const { data, error } = await this.db.from('user_preferences').select('*').eq('user_id', userId)
    if (error) throw error
    return (data ?? []) as UserPreference[]
  }

  async upsertPreference(userId: string, type: string, value: string, weightDelta: number) {
    const { data: existing } = await this.db
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('preference_type', type)
      .eq('value', value)
      .maybeSingle()

    const weight = clampWeight((existing?.weight ?? 0) + weightDelta)

    const { data, error } = await this.db
      .from('user_preferences')
      .upsert(
        { id: existing?.id, user_id: userId, preference_type: type, value, weight, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,preference_type,value' },
      )
      .select('*')
      .single()
    if (error) throw error
    return data as UserPreference
  }

  async storeImage(
    userId: string,
    bucket: BucketName,
    fileName: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredImage> {
    return uploadUserFile(this.db, bucket, userId, fileName, data, contentType)
  }

  async logAgentRun(record: AgentRunRecord): Promise<void> {
    // Observabilidade nunca pode derrubar o pedido do usuário.
    const { error } = await this.db.from('agent_runs').insert(record)
    if (error) console.error('[agent_runs] falha ao registrar:', error.message)
  }

  async logAiUsage(record: AiUsageRecord): Promise<void> {
    const { error } = await this.db.from('ai_usage').insert(record)
    if (error) console.error('[ai_usage] falha ao registrar:', error.message)
  }

  async todayCost(userId: string): Promise<number> {
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const { data, error } = await this.db
      .from('ai_usage')
      .select('estimated_cost')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
    if (error) return 0
    return (data ?? []).reduce((sum, r) => sum + Number(r.estimated_cost ?? 0), 0)
  }
}

interface OutfitRow extends Omit<Outfit, 'items'> {
  outfit_items?: Array<{ wardrobe_item_id: string; role: OutfitRole }> | null
}

function mapOutfitRow(row: OutfitRow): Outfit {
  const { outfit_items, ...rest } = row
  return { ...rest, items: outfit_items ?? [] }
}

function clampWeight(n: number): number {
  return Number(Math.min(1, Math.max(-1, n)).toFixed(4))
}
