import type { WardrobeItem } from '@/schemas/wardrobe'
import type { EngineContext } from '@/lib/outfits/engine'

/** Guarda-roupa de benchmark: as peças que aparecem nas referências dela. */
export function item(over: Partial<WardrobeItem> & { id: string; category: WardrobeItem['category'] }): WardrobeItem {
  return {
    user_id: 'u1',
    name: over.name ?? over.id,
    subcategory: 'camiseta',
    color: 'preto',
    secondary_colors: [],
    pattern: 'liso',
    material: 'algodao',
    style: 'casual',
    formality: 5,
    sport_type: 'nenhum',
    season: ['verao', 'outono', 'inverno', 'primavera'],
    occasion: [],
    description: '',
    active: true,
    created_at: new Date().toISOString(),
    ...over,
  } as WardrobeItem
}

export const CENARIO_GUARDA_ROUPA: WardrobeItem[] = [
  // partes de cima
  item({ id: 'camiseta-branca', name: 'Camiseta branca', category: 'top', subcategory: 'camiseta', color: 'branco', formality: 3 }),
  item({ id: 'regata-preta', name: 'Regata preta', category: 'top', subcategory: 'regata', color: 'preto', formality: 4 }),
  item({ id: 'camisa-branca', name: 'Camisa branca', category: 'top', subcategory: 'camisa', color: 'branco', formality: 7, style: 'social' }),
  item({ id: 'blusa-creme', name: 'Blusa creme', category: 'top', subcategory: 'blusa', color: 'creme', formality: 6, style: 'social' }),
  item({ id: 'top-marrom', name: 'Top marrom', category: 'top', subcategory: 'regata', color: 'marrom', formality: 5 }),
  // partes de baixo
  item({ id: 'jeans', name: 'Calça jeans', category: 'bottom', subcategory: 'calca', color: 'jeans', formality: 3 }),
  item({ id: 'alfaiataria-preta', name: 'Calça de alfaiataria preta', category: 'bottom', subcategory: 'calca', color: 'preto', formality: 7, style: 'social' }),
  item({ id: 'alfaiataria-bege', name: 'Calça de alfaiataria bege', category: 'bottom', subcategory: 'calca', color: 'bege', formality: 7, style: 'social' }),
  item({ id: 'legging-preta', name: 'Legging preta', category: 'bottom', subcategory: 'legging', color: 'preto', formality: 2, style: 'esportivo', sport_type: 'academia' }),
  item({ id: 'short-bege', name: 'Short de alfaiataria bege', category: 'bottom', subcategory: 'shorts', color: 'bege', formality: 5, style: 'social' }),
  item({ id: 'saia-midi-preta', name: 'Saia midi preta', category: 'bottom', subcategory: 'saia', color: 'preto', formality: 6, style: 'social' }),
  // terceiras peças
  item({ id: 'blazer-preto', name: 'Blazer preto', category: 'outerwear', subcategory: 'blazer', color: 'preto', formality: 7, style: 'social' }),
  item({ id: 'blazer-creme', name: 'Blazer creme', category: 'outerwear', subcategory: 'blazer', color: 'creme', formality: 7, style: 'social' }),
  item({ id: 'casaquinho-bege', name: 'Casaquinho bege', category: 'outerwear', subcategory: 'cardiga', color: 'bege', formality: 4 }),
  item({ id: 'colete-cru', name: 'Colete cru', category: 'outerwear', subcategory: 'colete', color: 'cru', formality: 6, style: 'social' }),
  item({ id: 'casaco-cinza', name: 'Casaco cinza', category: 'outerwear', subcategory: 'casaco', color: 'cinza', formality: 6 }),
  // calçados
  item({ id: 'tenis-branco', name: 'Tênis branco', category: 'shoes', subcategory: 'tenis', color: 'branco', formality: 3 }),
  item({ id: 'salto-nude', name: 'Scarpin nude', category: 'shoes', subcategory: 'salto', color: 'nude', formality: 8, style: 'social' }),
  item({ id: 'mocassim-caramelo', name: 'Mocassim caramelo', category: 'shoes', subcategory: 'sapato', color: 'caramelo', formality: 6 }),
  item({ id: 'bota-preta', name: 'Bota preta', category: 'shoes', subcategory: 'bota', color: 'preto', formality: 6 }),
  // acabamento
  item({ id: 'bolsa-caramelo', name: 'Bolsa caramelo', category: 'bag', subcategory: 'bolsa', color: 'caramelo', formality: 6 }),
  item({ id: 'bolsa-preta', name: 'Bolsa preta', category: 'bag', subcategory: 'bolsa', color: 'preto', formality: 7 }),
  item({ id: 'oculos', name: 'Óculos de sol', category: 'accessory', subcategory: 'oculos', color: 'preto', formality: 4 }),
  item({ id: 'cinto-caramelo', name: 'Cinto caramelo', category: 'accessory', subcategory: 'cinto', color: 'caramelo', formality: 5 }),
  item({ id: 'brinco-dourado', name: 'Brinco dourado', category: 'accessory', subcategory: 'brinco', color: 'dourado', formality: 6 }),
  item({ id: 'bone-preto', name: 'Boné preto', category: 'accessory', subcategory: 'bone', color: 'preto', formality: 2 }),
]

export function cenarioCtx(over: Partial<EngineContext> = {}): EngineContext {
  return {
    style: 'casual',
    favoriteColors: [], avoidColors: [], preferredArchetypes: [],
    modestyLevel: 0, preferenceWeights: {}, lockedItemIds: [], excludeIds: [],
    novelty: 'equilibrado', recentSignatures: [], recentItemIds: [], recentFormulaIds: [],
    ...over,
  }
}

