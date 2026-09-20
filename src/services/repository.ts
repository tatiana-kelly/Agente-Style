import type { WardrobeItem, CreateWardrobeItemInput } from '@/schemas/wardrobe'
import type { Outfit, OutfitRole, Style } from '@/schemas/outfit'
import type { UserProfile, UserPreference, UserPhoto } from '@/schemas/user'
import type { BucketName, StoredImage } from './image-service'

export interface SaveOutfitInput {
  userId: string
  name: string
  style: Style
  occasion?: string
  context?: string
  explanation: string
  scores: Record<string, number>
  status?: 'draft' | 'saved' | 'discarded'
  items: Array<{ wardrobe_item_id: string; role: OutfitRole }>
}

export interface GeneratedLookRecord {
  id: string
  user_id: string
  outfit_id: string
  prompt: string
  image_url: string | null
  model: string
  generation_metadata: Record<string, unknown>
  quality_score: number
  created_at: string
}

export interface AgentRunRecord {
  user_id: string
  agent: string
  request: Record<string, unknown>
  response: Record<string, unknown>
  status: 'success' | 'error' | 'degraded'
  latency_ms: number
  tokens: number
  estimated_cost: number
}

export interface AiUsageRecord {
  user_id: string
  provider: string
  model: string
  operation: string
  estimated_cost: number
  latency_ms: number
  success: boolean
}

/**
 * Fronteira de persistência.
 * Dois drivers implementam isto: Supabase (produção) e memória (demo/testes).
 * Nenhum agente conhece Supabase diretamente.
 */
export interface Repository {
  readonly driver: 'supabase' | 'memory'

  listItems(userId: string): Promise<WardrobeItem[]>
  getItem(userId: string, id: string): Promise<WardrobeItem | null>
  createItem(userId: string, input: CreateWardrobeItemInput): Promise<WardrobeItem>
  updateItem(userId: string, id: string, patch: Partial<CreateWardrobeItemInput>): Promise<WardrobeItem | null>
  deleteItem(userId: string, id: string): Promise<boolean>

  getProfile(userId: string): Promise<UserProfile | null>
  updateProfile(userId: string, patch: Partial<UserProfile>): Promise<UserProfile | null>
  getPrimaryPhoto(userId: string): Promise<UserPhoto | null>
  setPrimaryPhoto(userId: string, imageUrl: string): Promise<UserPhoto>

  saveOutfit(input: SaveOutfitInput): Promise<Outfit>
  listOutfits(userId: string, style?: Style): Promise<Outfit[]>
  getOutfit(userId: string, id: string): Promise<Outfit | null>
  markOutfitSaved(userId: string, id: string): Promise<boolean>

  saveGeneratedLook(record: Omit<GeneratedLookRecord, 'id' | 'created_at'>): Promise<GeneratedLookRecord>
  getGeneratedLook(userId: string, outfitId: string): Promise<GeneratedLookRecord | null>

  listPreferences(userId: string): Promise<UserPreference[]>
  upsertPreference(userId: string, type: string, value: string, weightDelta: number): Promise<UserPreference>

  /**
   * Grava um binário no Storage do usuário.
   * Fica no repositório porque é a mesma fronteira de persistência e o mesmo
   * cliente autenticado — nenhum agente precisa conhecer Supabase para salvar imagem.
   */
  storeImage(
    userId: string,
    bucket: BucketName,
    fileName: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredImage>

  logAgentRun(record: AgentRunRecord): Promise<void>
  logAiUsage(record: AiUsageRecord): Promise<void>
  /** Soma gasta hoje, para o freio diário (PRP §36). */
  todayCost(userId: string): Promise<number>
}
