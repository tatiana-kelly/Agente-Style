import type { WardrobeItem } from '@/schemas/wardrobe'

export const DEMO_USER_ID = 'demo-user'
export const DEMO_USER_EMAIL = 'demo@wardrobe.ai'

/** Silhueta neutra como foto principal: o fluxo não pode depender de arquivo externo (PRP §39). */
export const DEMO_USER_PHOTO = '/demo/model-placeholder.svg'

const NOW = '2026-01-01T12:00:00.000Z'

type Seed = Omit<WardrobeItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'metadata' | 'active' | 'brand' | 'image_original_url' | 'image_processed_url' | 'thumbnail_url'>

const SEEDS: Seed[] = [
  // ---------- 5 tops ----------
  {
    name: 'Camisa branca de algodão', category: 'top', subcategory: 'camisa', color: 'branco',
    secondary_colors: [], pattern: 'liso', material: 'algodão', style: 'social', formality: 7,
    sport_type: 'nenhum', season: ['verao', 'primavera', 'outono'], occasion: ['trabalho', 'reuniao', 'jantar'],
    description: 'Camisa branca de corte reto, gola clássica.',
  },
  {
    name: 'Camiseta preta básica', category: 'top', subcategory: 'camiseta', color: 'preto',
    secondary_colors: [], pattern: 'liso', material: 'algodão', style: 'casual', formality: 2,
    sport_type: 'nenhum', season: ['verao', 'primavera', 'outono', 'inverno'], occasion: ['dia-comum', 'passeio'],
    description: 'Camiseta preta lisa de malha.',
  },
  {
    name: 'Blusa de seda marinho', category: 'top', subcategory: 'blusa', color: 'marinho',
    secondary_colors: [], pattern: 'liso', material: 'seda', style: 'social', formality: 7,
    sport_type: 'nenhum', season: ['primavera', 'outono'], occasion: ['jantar', 'evento', 'trabalho'],
    description: 'Blusa fluida de seda azul-marinho.',
  },
  {
    name: 'Top esportivo branco', category: 'top', subcategory: 'top-esportivo', color: 'branco',
    secondary_colors: [], pattern: 'liso', material: 'poliamida', style: 'esportivo', formality: 1,
    sport_type: 'tenis', season: ['verao', 'primavera'], occasion: ['partida-tenis', 'treino'],
    description: 'Top esportivo de sustentação média, branco.',
  },
  {
    name: 'Regata de treino cinza', category: 'top', subcategory: 'regata', color: 'cinza',
    secondary_colors: [], pattern: 'liso', material: 'poliéster', style: 'esportivo', formality: 1,
    sport_type: 'academia', season: ['verao'], occasion: ['treino', 'partida-tenis'],
    description: 'Regata leve de treino, cinza mescla.',
  },

  // ---------- 4 bottoms ----------
  {
    name: 'Calça alfaiataria preta', category: 'bottom', subcategory: 'calca', color: 'preto',
    secondary_colors: [], pattern: 'liso', material: 'poliéster', style: 'social', formality: 8,
    sport_type: 'nenhum', season: ['outono', 'inverno', 'primavera'], occasion: ['trabalho', 'reuniao', 'evento'],
    description: 'Calça de alfaiataria preta, cintura alta.',
  },
  {
    name: 'Calça jeans reta', category: 'bottom', subcategory: 'calca', color: 'jeans',
    secondary_colors: [], pattern: 'liso', material: 'denim', style: 'casual', formality: 3,
    sport_type: 'nenhum', season: ['outono', 'inverno', 'primavera'], occasion: ['dia-comum', 'passeio', 'viagem'],
    description: 'Jeans azul de lavagem média, corte reto.',
  },
  {
    name: 'Skort branco de tênis', category: 'bottom', subcategory: 'skort', color: 'branco',
    secondary_colors: [], pattern: 'liso', material: 'poliéster', style: 'esportivo', formality: 1,
    sport_type: 'tenis', season: ['verao', 'primavera'], occasion: ['partida-tenis', 'treino'],
    description: 'Skort branco com shorts interno, próprio para quadra.',
  },
  {
    name: 'Legging preta', category: 'bottom', subcategory: 'legging', color: 'preto',
    secondary_colors: [], pattern: 'liso', material: 'elastano', style: 'esportivo', formality: 1,
    sport_type: 'academia', season: ['outono', 'inverno'], occasion: ['treino', 'dia-comum'],
    description: 'Legging preta de compressão leve.',
  },

  // ---------- 4 shoes ----------
  {
    name: 'Tênis de quadra branco', category: 'shoes', subcategory: 'tenis-tenis', color: 'branco',
    secondary_colors: ['cinza'], pattern: 'liso', material: 'couro sintético', style: 'esportivo', formality: 1,
    sport_type: 'tenis', season: ['verao', 'primavera', 'outono'], occasion: ['partida-tenis', 'treino'],
    description: 'Tênis específico de quadra, solado para saibro.',
  },
  {
    name: 'Tênis branco casual', category: 'shoes', subcategory: 'tenis', color: 'branco',
    secondary_colors: [], pattern: 'liso', material: 'couro', style: 'casual', formality: 3,
    sport_type: 'nenhum', season: ['verao', 'primavera', 'outono'], occasion: ['dia-comum', 'passeio', 'viagem'],
    description: 'Tênis branco minimalista de uso diário.',
  },
  {
    name: 'Scarpin nude', category: 'shoes', subcategory: 'salto', color: 'nude',
    secondary_colors: [], pattern: 'liso', material: 'couro', style: 'social', formality: 8,
    sport_type: 'nenhum', season: ['primavera', 'outono', 'verao'], occasion: ['evento', 'jantar', 'reuniao'],
    description: 'Scarpin nude de salto médio.',
  },
  {
    name: 'Sapatilha preta', category: 'shoes', subcategory: 'sapatilha', color: 'preto',
    secondary_colors: [], pattern: 'liso', material: 'couro', style: 'social', formality: 6,
    sport_type: 'nenhum', season: ['outono', 'inverno', 'primavera'], occasion: ['trabalho', 'dia-comum'],
    description: 'Sapatilha preta bico fino.',
  },

  // ---------- 3 outerwear ----------
  {
    name: 'Blazer preto estruturado', category: 'outerwear', subcategory: 'blazer', color: 'preto',
    secondary_colors: [], pattern: 'liso', material: 'poliéster', style: 'social', formality: 9,
    sport_type: 'nenhum', season: ['outono', 'inverno', 'primavera'], occasion: ['trabalho', 'reuniao', 'evento'],
    description: 'Blazer preto de ombro estruturado.',
  },
  {
    name: 'Jaqueta jeans', category: 'outerwear', subcategory: 'jaqueta', color: 'jeans',
    secondary_colors: [], pattern: 'liso', material: 'denim', style: 'casual', formality: 3,
    sport_type: 'nenhum', season: ['outono', 'primavera'], occasion: ['passeio', 'dia-comum', 'viagem'],
    description: 'Jaqueta jeans clássica.',
  },
  {
    name: 'Corta-vento cinza', category: 'outerwear', subcategory: 'corta-vento', color: 'cinza',
    secondary_colors: [], pattern: 'liso', material: 'nylon', style: 'esportivo', formality: 2,
    sport_type: 'geral', season: ['outono', 'inverno'], occasion: ['treino', 'viagem', 'partida-tenis'],
    description: 'Corta-vento leve e compactável.',
  },

  // ---------- 4 accessories / bags ----------
  {
    name: 'Viseira branca', category: 'accessory', subcategory: 'viseira', color: 'branco',
    secondary_colors: [], pattern: 'liso', material: 'algodão', style: 'esportivo', formality: 1,
    sport_type: 'tenis', season: ['verao', 'primavera'], occasion: ['partida-tenis', 'treino'],
    description: 'Viseira branca ajustável.',
  },
  {
    name: 'Relógio prateado', category: 'accessory', subcategory: 'relogio', color: 'prata',
    secondary_colors: [], pattern: 'liso', material: 'aço', style: 'social', formality: 7,
    sport_type: 'nenhum', season: ['verao', 'outono', 'inverno', 'primavera'], occasion: ['trabalho', 'reuniao', 'jantar'],
    description: 'Relógio de pulseira prateada.',
  },
  {
    name: 'Bolsa estruturada preta', category: 'bag', subcategory: 'bolsa', color: 'preto',
    secondary_colors: [], pattern: 'liso', material: 'couro', style: 'social', formality: 7,
    sport_type: 'nenhum', season: ['verao', 'outono', 'inverno', 'primavera'], occasion: ['trabalho', 'reuniao', 'evento'],
    description: 'Bolsa estruturada de couro preto.',
  },
  {
    name: 'Raqueteira cinza', category: 'bag', subcategory: 'raqueteira', color: 'cinza',
    secondary_colors: ['preto'], pattern: 'liso', material: 'poliéster', style: 'esportivo', formality: 1,
    sport_type: 'tenis', season: ['verao', 'primavera', 'outono'], occasion: ['partida-tenis', 'treino'],
    description: 'Raqueteira para duas raquetes.',
  },
]

/** 20 peças fictícias que cobrem tênis, social, trabalho e casual. */
export function buildDemoWardrobe(userId: string = DEMO_USER_ID): WardrobeItem[] {
  return SEEDS.map((seed, i) => ({
    ...seed,
    id: `demo-${String(i + 1).padStart(2, '0')}`,
    user_id: userId,
    brand: null,
    image_original_url: null,
    image_processed_url: null,
    thumbnail_url: null,
    metadata: { demo: true },
    active: true,
    created_at: NOW,
    updated_at: NOW,
  }))
}
