import { classificationSchema, type CreateWardrobeItemInput, type WardrobeItem } from '@/schemas/wardrobe'
import type { Outfit, Style } from '@/schemas/outfit'
import type { UserPhoto, UserPreference, UserProfile } from '@/schemas/user'
import { newId } from '@/lib/utils'
import { buildDemoWardrobe, DEMO_USER_EMAIL, DEMO_USER_ID, DEMO_USER_PHOTO } from '@/data/demo-wardrobe'
import type {
  AgentRunRecord, AiUsageRecord, GeneratedLookRecord, Repository, SaveOutfitInput,
} from './repository'
import { inlineImage, type BucketName, type StoredImage } from './image-service'

interface UserState {
  profile: UserProfile
  items: WardrobeItem[]
  outfits: Outfit[]
  looks: GeneratedLookRecord[]
  preferences: UserPreference[]
  runs: AgentRunRecord[]
  usage: Array<AiUsageRecord & { at: string }>
  photo: UserPhoto | null
}

/**
 * Driver em memória: mantém o MVP navegável e testável sem infraestrutura.
 * Em serverless o estado não sobrevive entre instâncias — é modo demo, não produção.
 */
export class MemoryRepository implements Repository {
  readonly driver = 'memory' as const
  private users = new Map<string, UserState>()

  private state(userId: string): UserState {
    let s = this.users.get(userId)
    if (!s) {
      const now = new Date().toISOString()
      s = {
        profile: {
          id: userId,
          email: userId === DEMO_USER_ID ? DEMO_USER_EMAIL : `${userId}@local`,
          name: 'Convidada',
          avatar_url: DEMO_USER_PHOTO,
          height: null,
          style_preferences: [],
          favorite_colors: [],
          avoid_colors: [],
          created_at: now,
          updated_at: now,
        },
        items: buildDemoWardrobe(userId),
        outfits: [],
        looks: [],
        preferences: [],
        runs: [],
        usage: [],
        photo: {
          id: newId('photo'),
          user_id: userId,
          image_url: DEMO_USER_PHOTO,
          photo_type: 'full-body',
          is_primary: true,
          created_at: now,
        },
      }
      this.users.set(userId, s)
    }
    return s
  }

  /** Só os testes precisam zerar o estado entre casos. */
  reset(): void {
    this.users.clear()
  }

  async listItems(userId: string) {
    return this.state(userId).items.filter((i) => i.active)
  }

  async getItem(userId: string, id: string) {
    return this.state(userId).items.find((i) => i.id === id) ?? null
  }

  async createItem(userId: string, input: CreateWardrobeItemInput) {
    const now = new Date().toISOString()
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

    const item: WardrobeItem = {
      ...base,
      id: newId('item'),
      user_id: userId,
      name: input.name,
      brand: input.brand ?? null,
      image_original_url: input.image_original_url ?? null,
      image_processed_url: input.image_processed_url ?? null,
      thumbnail_url: input.thumbnail_url ?? null,
      metadata: {},
      active: true,
      created_at: now,
      updated_at: now,
    }
    this.state(userId).items.push(item)
    return item
  }

  async updateItem(userId: string, id: string, patch: Partial<CreateWardrobeItemInput>) {
    const s = this.state(userId)
    const idx = s.items.findIndex((i) => i.id === id)
    if (idx === -1) return null
    s.items[idx] = { ...s.items[idx], ...patch, updated_at: new Date().toISOString() } as WardrobeItem
    return s.items[idx]
  }

  async deleteItem(userId: string, id: string) {
    const s = this.state(userId)
    const idx = s.items.findIndex((i) => i.id === id)
    if (idx === -1) return false
    s.items[idx].active = false
    return true
  }

  async getProfile(userId: string) {
    return this.state(userId).profile
  }

  async updateProfile(userId: string, patch: Partial<UserProfile>) {
    const s = this.state(userId)
    s.profile = { ...s.profile, ...patch, updated_at: new Date().toISOString() }
    return s.profile
  }

  async getPrimaryPhoto(userId: string) {
    return this.state(userId).photo
  }

  async setPrimaryPhoto(userId: string, imageUrl: string) {
    const s = this.state(userId)
    s.photo = {
      id: newId('photo'),
      user_id: userId,
      image_url: imageUrl,
      photo_type: 'full-body',
      is_primary: true,
      created_at: new Date().toISOString(),
    }
    s.profile.avatar_url = imageUrl
    return s.photo
  }

  async saveOutfit(input: SaveOutfitInput) {
    const outfit: Outfit = {
      id: newId('outfit'),
      user_id: input.userId,
      name: input.name,
      occasion: (input.occasion ?? null) as Outfit['occasion'],
      style: input.style,
      context: input.context ?? null,
      weather: null,
      season: null,
      status: input.status ?? 'draft',
      items: input.items,
      explanation: input.explanation,
      scores: input.scores,
      created_at: new Date().toISOString(),
    }
    this.state(input.userId).outfits.unshift(outfit)
    return outfit
  }

  async listOutfits(userId: string, style?: Style) {
    const all = this.state(userId).outfits.filter((o) => o.status === 'saved')
    return style ? all.filter((o) => o.style === style) : all
  }

  async getOutfit(userId: string, id: string) {
    return this.state(userId).outfits.find((o) => o.id === id) ?? null
  }

  async markOutfitSaved(userId: string, id: string) {
    const outfit = this.state(userId).outfits.find((o) => o.id === id)
    if (!outfit) return false
    outfit.status = 'saved'
    return true
  }

  async saveGeneratedLook(record: Omit<GeneratedLookRecord, 'id' | 'created_at'>) {
    const full: GeneratedLookRecord = {
      ...record,
      id: newId('look'),
      created_at: new Date().toISOString(),
    }
    this.state(record.user_id).looks.unshift(full)
    return full
  }

  async getGeneratedLook(userId: string, outfitId: string) {
    return this.state(userId).looks.find((l) => l.outfit_id === outfitId) ?? null
  }

  async listPreferences(userId: string) {
    return this.state(userId).preferences
  }

  async upsertPreference(userId: string, type: string, value: string, weightDelta: number) {
    const s = this.state(userId)
    const existing = s.preferences.find((p) => p.preference_type === type && p.value === value)
    const now = new Date().toISOString()

    if (existing) {
      existing.weight = clampWeight(existing.weight + weightDelta)
      existing.updated_at = now
      return existing
    }
    const created: UserPreference = {
      id: newId('pref'),
      user_id: userId,
      preference_type: type as UserPreference['preference_type'],
      value,
      weight: clampWeight(weightDelta),
      created_at: now,
      updated_at: now,
    }
    s.preferences.push(created)
    return created
  }

  async storeImage(
    _userId: string,
    _bucket: BucketName,
    _fileName: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredImage> {
    // Sem Storage no modo demo: a imagem volta embutida e aparece na tela do mesmo jeito.
    return inlineImage(data, contentType)
  }

  async logAgentRun(record: AgentRunRecord) {
    this.state(record.user_id).runs.push(record)
  }

  async logAiUsage(record: AiUsageRecord) {
    this.state(record.user_id).usage.push({ ...record, at: new Date().toISOString() })
  }

  async todayCost(userId: string) {
    const today = new Date().toISOString().slice(0, 10)
    return this.state(userId)
      .usage.filter((u) => u.at.startsWith(today))
      .reduce((sum, u) => sum + u.estimated_cost, 0)
  }
}

function clampWeight(n: number): number {
  return Number(Math.min(1, Math.max(-1, n)).toFixed(4))
}

/**
 * Uma instância por PROCESSO, não por módulo.
 * O Next empacota páginas e route handlers separadamente, então um `new` no topo
 * do módulo geraria estados distintos — e o look salvo não apareceria em Meus Looks.
 */
const globalStore = globalThis as typeof globalThis & { __wardrobeMemoryRepo?: MemoryRepository }

export const memoryRepository: MemoryRepository =
  globalStore.__wardrobeMemoryRepo ?? (globalStore.__wardrobeMemoryRepo = new MemoryRepository())
