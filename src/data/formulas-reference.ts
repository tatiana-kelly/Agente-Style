import { outfitFormulaSchema, type OutfitFormula } from '@/schemas/formula'

/**
 * Fórmulas tiradas das referências visuais da usuária — o padrão de styling
 * que ela reconhece como bonito.
 *
 * O que entra aqui é a ESTRUTURA de cada referência: qual peça faz o papel de
 * base, qual é a terceira peça, que calçado fecha, que paleta sustenta. Nada
 * de peça específica, marca ou foto — essas fórmulas precisam funcionar com o
 * guarda-roupa que ela tem, não com o da imagem.
 *
 * Cada nome é o nome que aparece na referência, porque é assim que ela pensa o
 * look: "casual chic", "terninho", "colete e alfaiataria", "all black".
 */

type Slot = [string, string[]]

function f(args: {
  id: string
  nome: string
  style: string[]
  occasion: string[]
  formality: [number, number]
  required: Slot[]
  optional?: Slot[]
  cores?: string[]
  silhueta: string
  descricao: string
  clima?: string[]
  novelty?: number
  modesty?: number
  travaDeCor?: 'black' | 'monochrome'
}): OutfitFormula {
  return outfitFormulaSchema.parse({
    id: args.id,
    name: args.nome,
    category: 'reference',
    style: args.style,
    occasion: args.occasion,
    formality: args.formality,
    weather: args.clima ?? ['calor', 'ameno', 'frio'],
    required_roles: args.required.map(([role, archetypes]) => ({ role, archetypes })),
    optional_roles: (args.optional ?? []).map(([role, archetypes]) => ({ role, archetypes })),
    color_patterns: args.cores ?? ['NEUTRAL', 'TONAL', 'MONOCHROMATIC'],
    palette_lock: args.travaDeCor,
    silhouette: args.silhueta,
    description: args.descricao,
    source_type: 'style-reference',
    source_reference: 'referência visual da usuária',
    novelty: args.novelty ?? 0.3,
    modesty_min: args.modesty ?? 0,
  })
}

const SALTO = ['heels', 'elegant_shoe']
const RASO_ELEGANTE = ['loafers', 'flats', 'elegant_shoe']
const TENIS = ['sneakers']
const BOLSA = ['structured_bag', 'tote']
const ACC = ['jewelry', 'watch', 'belt', 'sunglasses']
const ACC_CASUAL = ['sunglasses', 'cap', 'jewelry', 'watch', 'belt']

// ───────────────────────────────────────────────── CASAQUINHO / TERCEIRA PEÇA
const TERCEIRA_PECA: OutfitFormula[] = [
  f({
    id: 'ref-casual-chic',
    nome: 'Casual Chic',
    style: ['casual', 'dia-a-dia', 'moderno', 'viagem', 'feminino'],
    occasion: ['dia-comum', 'passeio', 'viagem', 'almoco'],
    formality: [3, 5],
    required: [
      ['top', ['tshirt', 'tank', 'blouse']],
      ['bottom', ['jeans', 'wide_leg_trousers']],
      ['shoes', TENIS],
      ['outerwear', ['cardigan', 'blazer', 'jacket']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC_CASUAL]],
    silhueta: 'relaxed',
    descricao: 'Casaquinho sobre básico e jeans: a terceira peça é o que separa "roupa" de "look".',
    clima: ['ameno', 'frio'],
    novelty: 0.15,
  }),

  f({
    id: 'ref-jeans-blazer-salto',
    nome: 'Jeans e Blazer',
    style: ['moderno', 'social', 'elegante', 'jantar', 'casual'],
    occasion: ['almoco', 'jantar', 'passeio', 'trabalho', 'evento'],
    formality: [5, 7],
    required: [
      ['top', ['tshirt', 'tank', 'blouse', 'shirt']],
      ['bottom', ['jeans']],
      ['shoes', [...SALTO, ...RASO_ELEGANTE]],
      ['outerwear', ['blazer']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    silhueta: 'structured',
    descricao: 'Jeans com blazer e salto: a peça mais casual do armário indo para a mesa do jantar.',
    novelty: 0.2,
  }),

  f({
    id: 'ref-jeans-blazer-tenis',
    nome: 'Jeans com Blazer e Tênis',
    style: ['moderno', 'casual', 'dia-a-dia', 'viagem'],
    occasion: ['dia-comum', 'passeio', 'trabalho', 'viagem'],
    formality: [4, 6],
    required: [
      ['top', ['tshirt', 'tank', 'blouse']],
      ['bottom', ['jeans']],
      ['shoes', TENIS],
      ['outerwear', ['blazer']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC_CASUAL]],
    silhueta: 'relaxed',
    descricao: 'Blazer sobe o jeans, tênis segura o conjunto no dia a dia — nenhum dos dois manda sozinho.',
    novelty: 0.25,
  }),

  f({
    id: 'ref-esportivo-elegante',
    nome: 'Esportivo e Elegante',
    style: ['moderno', 'viagem', 'casual', 'dia-a-dia'],
    occasion: ['viagem', 'dia-comum', 'passeio'],
    formality: [3, 5],
    required: [
      ['top', ['tank', 'tshirt', 'sport_top']],
      ['bottom', ['leggings', 'tailored_trousers']],
      ['shoes', TENIS],
      ['outerwear', ['blazer']],
    ],
    optional: [['bag', ['tote', 'structured_bag', 'backpack']], ['accessory', ['cap', 'sunglasses', 'watch']]],
    cores: ['MONOCHROMATIC', 'NEUTRAL'],
    silhueta: 'athletic',
    descricao: 'Legging com blazer e tênis: conforto de viagem sem parecer que saiu do treino.',
    novelty: 0.4,
  }),

  f({
    id: 'ref-conforto-com-estilo',
    nome: 'Conforto com Estilo',
    style: ['viagem', 'dia-a-dia', 'casual'],
    occasion: ['viagem', 'dia-comum', 'passeio'],
    formality: [2, 4],
    required: [
      ['top', ['knit', 'tshirt', 'tank']],
      ['bottom', ['wide_leg_trousers', 'jeans', 'leggings']],
      ['shoes', TENIS],
    ],
    optional: [
      ['outerwear', ['cardigan', 'jacket', 'blazer']],
      ['bag', ['tote', 'structured_bag', 'backpack']],
      ['accessory', ['cap', 'sunglasses', 'watch']],
    ],
    cores: ['TONAL', 'NEUTRAL', 'MONOCHROMATIC'],
    silhueta: 'relaxed',
    descricao: 'Conjunto confortável em tom único, tênis e boné: dia corrido sem abrir mão da linha do look.',
    novelty: 0.3,
  }),
]

// ─────────────────────────────────────────────────────────────── ALFAIATARIA
const ALFAIATARIA: OutfitFormula[] = [
  f({
    id: 'ref-terninho-classico',
    nome: 'Terninho Clássico',
    style: ['trabalho', 'social', 'elegante', 'evento'],
    occasion: ['trabalho', 'reuniao', 'evento', 'jantar'],
    formality: [7, 9],
    required: [
      ['top', ['tank', 'blouse', 'shirt', 'tshirt']],
      ['bottom', ['tailored_trousers', 'wide_leg_trousers']],
      ['shoes', SALTO],
      ['outerwear', ['blazer']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['MONOCHROMATIC', 'TONAL', 'NEUTRAL'],
    silhueta: 'column',
    descricao: 'Blazer e calça no mesmo tom com regata por baixo: o conjunto faz o trabalho, o resto só acompanha.',
    novelty: 0.15,
  }),

  f({
    id: 'ref-alfaiataria-tenis',
    nome: 'Alfaiataria com Tênis',
    style: ['moderno', 'trabalho', 'casual', 'dia-a-dia', 'viagem'],
    occasion: ['trabalho', 'dia-comum', 'passeio', 'viagem'],
    formality: [5, 7],
    required: [
      ['top', ['tshirt', 'tank', 'blouse', 'shirt']],
      ['bottom', ['tailored_trousers', 'wide_leg_trousers']],
      ['shoes', TENIS],
    ],
    optional: [['outerwear', ['blazer']], ['bag', BOLSA], ['accessory', ACC_CASUAL]],
    cores: ['NEUTRAL', 'TONAL', 'MONOCHROMATIC'],
    silhueta: 'column',
    descricao: 'Alfaiataria com tênis branco: casual chic de verdade, desde que o resto sustente o registro.',
    novelty: 0.35,
  }),

  f({
    id: 'ref-blazer-calca-ampla-salto',
    nome: 'Blazer e Calça Ampla',
    style: ['elegante', 'trabalho', 'social', 'jantar', 'feminino'],
    occasion: ['trabalho', 'reuniao', 'jantar', 'evento', 'almoco'],
    formality: [6, 8],
    required: [
      ['top', ['tank', 'blouse', 'knit', 'tshirt']],
      ['bottom', ['wide_leg_trousers', 'tailored_trousers']],
      ['shoes', SALTO],
      ['outerwear', ['blazer']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['TONAL', 'NEUTRAL', 'MONOCHROMATIC'],
    silhueta: 'column',
    descricao: 'Calça ampla com salto alonga a silhueta inteira; o blazer fecha a linha vertical.',
    novelty: 0.2,
  }),

  f({
    id: 'ref-sofisticacao-moderna',
    nome: 'Sofisticação Moderna',
    style: ['elegante', 'moderno', 'jantar', 'social', 'evento'],
    occasion: ['jantar', 'evento', 'almoco', 'trabalho'],
    formality: [6, 8],
    required: [
      ['top', ['tank', 'statement_top', 'blouse']],
      ['bottom', ['wide_leg_trousers', 'tailored_trousers']],
      ['shoes', SALTO],
      ['outerwear', ['blazer']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['TONAL', 'NEUTRAL'],
    silhueta: 'column',
    descricao: 'Blazer claro, top escuro e calça clara: contraste no meio do look, neutros nas pontas.',
    novelty: 0.35,
  }),

  f({
    id: 'ref-blazer-couro-tenis',
    nome: 'Blazer e Calça Escura com Tênis',
    style: ['moderno', 'casual', 'jantar', 'festa'],
    occasion: ['jantar', 'passeio', 'festa', 'dia-comum'],
    formality: [5, 7],
    required: [
      ['top', ['tank', 'tshirt', 'knit']],
      ['bottom', ['tailored_trousers', 'jeans', 'leggings']],
      ['shoes', TENIS],
      ['outerwear', ['blazer', 'jacket']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC_CASUAL]],
    cores: ['MONOCHROMATIC', 'NEUTRAL'],
    silhueta: 'structured',
    descricao: 'Base escura com brilho e blazer reto: moderno sem precisar de salto.',
    novelty: 0.5,
  }),
]

// ──────────────────────────────────────────────────────────────────── COLETE
const COLETE: OutfitFormula[] = [
  f({
    id: 'ref-colete-alfaiataria',
    nome: 'Colete e Alfaiataria',
    style: ['moderno', 'trabalho', 'elegante', 'social'],
    occasion: ['trabalho', 'reuniao', 'jantar', 'evento'],
    formality: [6, 8],
    required: [
      ['bottom', ['tailored_trousers', 'wide_leg_trousers']],
      ['shoes', SALTO],
      ['outerwear', ['vest']],
    ],
    optional: [['top', ['tank', 'blouse', 'shirt']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['MONOCHROMATIC', 'NEUTRAL'],
    silhueta: 'structured',
    descricao: 'Colete no lugar da blusa e calça social: moderno, elegante e atemporal ao mesmo tempo.',
    novelty: 0.4,
  }),

  f({
    id: 'ref-colete-shorts-salto',
    nome: 'Colete e Shorts',
    style: ['moderno', 'feminino', 'elegante', 'casual'],
    occasion: ['almoco', 'passeio', 'jantar', 'evento'],
    formality: [5, 7],
    required: [
      ['bottom', ['shorts']],
      ['shoes', [...SALTO, ...RASO_ELEGANTE]],
      ['outerwear', ['vest']],
    ],
    optional: [['top', ['tank']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['MONOCHROMATIC', 'TONAL', 'NEUTRAL'],
    silhueta: 'structured',
    descricao: 'Conjunto de colete e shorts de alfaiataria: elegante para dias quentes, e não é praia.',
    clima: ['calor', 'ameno'],
    novelty: 0.5,
  }),

  f({
    id: 'ref-colete-shorts-tenis',
    nome: 'Colete e Shorts com Tênis',
    style: ['moderno', 'casual', 'dia-a-dia'],
    occasion: ['passeio', 'dia-comum', 'viagem'],
    formality: [4, 6],
    required: [
      ['bottom', ['shorts']],
      ['shoes', TENIS],
      ['outerwear', ['vest']],
    ],
    optional: [['top', ['tank', 'tshirt']], ['bag', BOLSA], ['accessory', ACC_CASUAL]],
    cores: ['NEUTRAL', 'TONAL'],
    silhueta: 'relaxed',
    descricao: 'O mesmo colete do trabalho com shorts e tênis: mesma peça, outro registro.',
    clima: ['calor', 'ameno'],
    novelty: 0.5,
  }),

  f({
    id: 'ref-colete-jeans',
    nome: 'Colete com Jeans',
    style: ['moderno', 'casual', 'dia-a-dia', 'feminino'],
    occasion: ['dia-comum', 'passeio', 'trabalho', 'almoco'],
    formality: [4, 6],
    required: [
      ['bottom', ['jeans', 'wide_leg_trousers']],
      ['shoes', [...RASO_ELEGANTE, ...TENIS]],
      ['outerwear', ['vest']],
    ],
    optional: [['top', ['tshirt', 'tank', 'shirt']], ['bag', BOLSA], ['accessory', ACC]],
    silhueta: 'relaxed',
    descricao: 'Colete sobre camiseta com jeans: estrutura em cima, leveza embaixo.',
    novelty: 0.45,
  }),
]

// ─────────────────────────────────────────────────── SHORT COM TERCEIRA PEÇA
const SHORT: OutfitFormula[] = [
  f({
    id: 'ref-sport-chic',
    nome: 'Sport Chic',
    style: ['casual', 'dia-a-dia', 'moderno', 'viagem'],
    occasion: ['passeio', 'dia-comum', 'viagem'],
    formality: [3, 5],
    required: [
      ['top', ['tank', 'tshirt']],
      ['bottom', ['shorts']],
      ['shoes', TENIS],
      ['outerwear', ['blazer', 'cardigan']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC_CASUAL]],
    silhueta: 'relaxed',
    descricao: 'Blazer sobre shorts com tênis: conforto de verão com cara de produção.',
    clima: ['calor', 'ameno'],
    novelty: 0.4,
  }),

  f({
    id: 'ref-short-blazer-salto',
    nome: 'Short com Blazer e Salto',
    style: ['elegante', 'moderno', 'feminino', 'jantar', 'social'],
    occasion: ['almoco', 'jantar', 'evento', 'passeio'],
    formality: [5, 7],
    required: [
      ['top', ['tank', 'blouse', 'tshirt']],
      ['bottom', ['shorts']],
      ['shoes', SALTO],
      ['outerwear', ['blazer']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL', 'TONAL', 'MONOCHROMATIC'],
    silhueta: 'structured',
    descricao: 'Short de alfaiataria com salto e blazer: do dia ao jantar sem trocar de peça.',
    clima: ['calor', 'ameno'],
    novelty: 0.45,
  }),

  f({
    id: 'ref-linho-elegancia',
    nome: 'Linho e Elegância',
    style: ['elegante', 'feminino', 'casual', 'viagem'],
    occasion: ['almoco', 'passeio', 'viagem', 'igreja'],
    formality: [5, 7],
    required: [
      ['top', ['tank', 'tshirt', 'blouse']],
      ['bottom', ['shorts', 'wide_leg_trousers']],
      ['shoes', ['loafers', 'flats', 'sandals']],
      ['outerwear', ['blazer']],
    ],
    optional: [['bag', BOLSA], ['accessory', ['belt', 'jewelry', 'sunglasses', 'watch']]],
    cores: ['TONAL', 'NEUTRAL'],
    silhueta: 'relaxed',
    descricao: 'Tecido leve, cinto marcando a cintura e mocassim: leve e sofisticado no mesmo look.',
    clima: ['calor', 'ameno'],
    novelty: 0.4,
  }),
]

// ─────────────────────────────────────────────────────── PALETA COMO FÓRMULA
const PALETA: OutfitFormula[] = [
  f({
    id: 'ref-all-black',
    nome: 'All Black',
    style: ['moderno', 'elegante', 'jantar', 'social', 'festa', 'trabalho'],
    occasion: ['jantar', 'evento', 'festa', 'trabalho', 'reuniao', 'passeio'],
    formality: [5, 9],
    required: [
      ['top', ['tank', 'tshirt', 'knit', 'blouse', 'shirt']],
      ['bottom', ['tailored_trousers', 'jeans', 'wide_leg_trousers', 'leggings', 'midi_skirt']],
      ['shoes', [...SALTO, ...TENIS, 'boots', 'loafers']],
    ],
    optional: [['outerwear', ['blazer', 'jacket', 'vest']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['MONOCHROMATIC'],
    silhueta: 'column',
    descricao: 'Tudo preto, do topo ao calçado: a silhueta fica inteira e o acessório vira o detalhe.',
    travaDeCor: 'black',
    novelty: 0.3,
  }),

  f({
    id: 'ref-monocromatico',
    nome: 'Monocromático',
    style: ['elegante', 'moderno', 'trabalho', 'social', 'feminino'],
    occasion: ['trabalho', 'almoco', 'jantar', 'evento', 'reuniao', 'igreja'],
    formality: [5, 8],
    required: [
      ['top', ['blouse', 'knit', 'tank', 'shirt', 'tshirt']],
      ['bottom', ['wide_leg_trousers', 'tailored_trousers', 'midi_skirt', 'long_skirt']],
      ['shoes', [...SALTO, ...RASO_ELEGANTE]],
    ],
    optional: [['outerwear', ['blazer', 'cardigan', 'vest']], ['bag', BOLSA], ['accessory', ['belt', 'jewelry', 'watch', 'sunglasses']]],
    cores: ['MONOCHROMATIC', 'TONAL'],
    silhueta: 'column',
    descricao: 'Um tom só, do começo ao fim: limpo, elegante e sempre uma boa escolha.',
    travaDeCor: 'monochrome',
    novelty: 0.3,
  }),

  f({
    id: 'ref-neutros-sofisticados',
    nome: 'Neutros Sofisticados',
    style: ['elegante', 'social', 'trabalho', 'moderno', 'feminino', 'igreja'],
    occasion: ['trabalho', 'almoco', 'reuniao', 'evento', 'igreja', 'jantar'],
    formality: [5, 8],
    required: [
      ['top', ['blouse', 'tank', 'knit', 'shirt']],
      ['bottom', ['wide_leg_trousers', 'tailored_trousers', 'midi_skirt']],
      ['shoes', [...SALTO, ...RASO_ELEGANTE]],
    ],
    optional: [['outerwear', ['blazer', 'cardigan', 'vest']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['TONAL', 'NEUTRAL'],
    silhueta: 'column',
    descricao: 'Creme, bege e caramelo na mesma produção: elegância que não depende de cor forte.',
    novelty: 0.35,
  }),

  f({
    id: 'ref-basico-inteligente',
    nome: 'Básico Inteligente',
    style: ['casual', 'dia-a-dia', 'moderno', 'viagem'],
    occasion: ['dia-comum', 'passeio', 'viagem', 'trabalho'],
    formality: [3, 5],
    required: [
      ['top', ['tshirt', 'shirt', 'tank']],
      ['bottom', ['leggings', 'jeans', 'tailored_trousers']],
      ['shoes', TENIS],
    ],
    optional: [['outerwear', ['shirt', 'blazer', 'cardigan']], ['bag', BOLSA], ['accessory', ACC_CASUAL]],
    cores: ['NEUTRAL', 'MONOCHROMATIC'],
    silhueta: 'relaxed',
    descricao: 'Poucas peças, styling intencional: básico bem escolhido com um acessório que termina o look.',
    novelty: 0.25,
  }),

  f({
    id: 'ref-toque-de-cor',
    nome: 'Toque de Cor',
    style: ['feminino', 'moderno', 'elegante', 'social'],
    occasion: ['almoco', 'passeio', 'evento', 'igreja', 'trabalho'],
    formality: [5, 7],
    required: [
      ['top', ['tank', 'blouse', 'tshirt']],
      ['bottom', ['shorts', 'tailored_trousers', 'midi_skirt', 'jeans', 'wide_leg_trousers']],
      ['shoes', [...SALTO, ...RASO_ELEGANTE]],
      ['outerwear', ['cardigan', 'blazer']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL_ACCENT'],
    silhueta: 'structured',
    descricao: 'Base neutra com uma peça de cor: a cor entra em um lugar só, e por isso funciona.',
    novelty: 0.45,
  }),
]

// ───────────────────────────────────────────── VESTIDO E SAIA NAS REFERÊNCIAS
const VESTIDO_SAIA: OutfitFormula[] = [
  f({
    id: 'ref-elegancia-noturna',
    nome: 'Elegância Noturna',
    style: ['jantar', 'festa', 'elegante', 'evento', 'social'],
    occasion: ['jantar', 'festa', 'evento'],
    formality: [7, 9],
    required: [
      ['top', ['tank', 'statement_top', 'blouse']],
      ['bottom', ['midi_skirt', 'long_skirt', 'pleated_skirt']],
      ['shoes', SALTO],
    ],
    optional: [['outerwear', ['blazer']], ['bag', BOLSA], ['accessory', ['jewelry', 'belt', 'watch']]],
    cores: ['MONOCHROMATIC', 'NEUTRAL'],
    silhueta: 'fitted_top_full_bottom',
    descricao: 'Saia midi com regata e salto: sofisticado para jantar sem virar traje de festa.',
    novelty: 0.3,
    modesty: 1,
  }),

  f({
    id: 'ref-vestido-jeans',
    nome: 'Vestido Jeans',
    style: ['casual', 'dia-a-dia', 'moderno', 'feminino', 'viagem'],
    occasion: ['dia-comum', 'passeio', 'viagem', 'almoco'],
    formality: [3, 5],
    required: [
      ['dress', ['dress', 'midi_dress']],
      ['shoes', [...TENIS, 'sandals', 'boots', 'flats']],
    ],
    optional: [['accessory', ['belt', 'sunglasses', 'jewelry', 'watch']], ['bag', BOLSA], ['outerwear', ['denim_jacket', 'jacket']]],
    cores: ['CLASSIC', 'NEUTRAL'],
    silhueta: 'relaxed',
    descricao: 'Vestido com cinto marcando a cintura: funciona com tênis de dia e com sandália à noite.',
    novelty: 0.3,
    modesty: 1,
  }),

  f({
    id: 'ref-vestido-terceira-peca',
    nome: 'Vestido com Terceira Peça',
    style: ['elegante', 'feminino', 'igreja', 'social', 'jantar'],
    occasion: ['igreja', 'almoco', 'jantar', 'evento', 'passeio'],
    formality: [5, 8],
    required: [
      ['dress', ['dress', 'midi_dress', 'long_dress']],
      ['shoes', [...SALTO, ...RASO_ELEGANTE, 'boots']],
      ['outerwear', ['blazer', 'cardigan', 'coat', 'jacket']],
    ],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL', 'TONAL', 'MONOCHROMATIC'],
    silhueta: 'column',
    descricao: 'Vestido com casaco por cima e bota: prático, coberto e sofisticado nos dias frios.',
    clima: ['ameno', 'frio'],
    novelty: 0.3,
    modesty: 1,
  }),

  f({
    id: 'ref-saia-midi-chic',
    nome: 'Saia Midi Chic',
    style: ['feminino', 'elegante', 'igreja', 'casual', 'social'],
    occasion: ['igreja', 'almoco', 'passeio', 'trabalho', 'evento'],
    formality: [5, 7],
    required: [
      ['top', ['blouse', 'knit', 'tank', 'shirt', 'tshirt']],
      ['bottom', ['midi_skirt', 'long_skirt', 'pleated_skirt']],
      ['shoes', [...RASO_ELEGANTE, ...SALTO, ...TENIS]],
    ],
    optional: [['outerwear', ['cardigan', 'blazer', 'denim_jacket']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL', 'TONAL'],
    silhueta: 'fitted_top_full_bottom',
    descricao: 'Blusa por dentro da saia midi: feminina, atemporal, e vai de tênis a salto.',
    novelty: 0.3,
    modesty: 2,
  }),
]

export const REFERENCE_FORMULAS: OutfitFormula[] = [
  ...TERCEIRA_PECA, ...ALFAIATARIA, ...COLETE, ...SHORT, ...PALETA, ...VESTIDO_SAIA,
]
