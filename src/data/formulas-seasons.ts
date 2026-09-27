import { outfitFormulaSchema, type OutfitFormula } from '@/schemas/formula'

/**
 * As pranchas das quatro estações.
 *
 * As outras fórmulas descrevem estrutura; estas descrevem estrutura COM
 * estação. É o que faltava para "ameno" e "frio" deixarem de produzir o mesmo
 * look: agora existe fórmula que só faz sentido no frio (camadas, casaco
 * longo, bota) e fórmula que só faz sentido no calor (linho, sandália,
 * vestido leve).
 *
 * As cores de cada estação entram como preferência, não como proibição —
 * ninguém tem o armário inteiro trocado a cada três meses.
 */

type Slot = [string, string[]]

function f(args: {
  id: string
  nome: string
  estacao: string[]
  clima: string[]
  style: string[]
  occasion: string[]
  formality: [number, number]
  required: Slot[]
  optional?: Slot[]
  cores?: string[]
  silhueta: string
  descricao: string
  novelty?: number
  modesty?: number
}): OutfitFormula {
  return outfitFormulaSchema.parse({
    id: args.id,
    name: args.nome,
    category: 'season',
    style: args.style,
    occasion: args.occasion,
    formality: args.formality,
    season: args.estacao,
    weather: args.clima,
    required_roles: args.required.map(([role, archetypes]) => ({ role, archetypes })),
    optional_roles: (args.optional ?? []).map(([role, archetypes]) => ({ role, archetypes })),
    color_patterns: args.cores ?? ['NEUTRAL', 'TONAL', 'MONOCHROMATIC'],
    silhouette: args.silhueta,
    description: args.descricao,
    source_type: 'style-reference',
    source_reference: 'prancha de estação da usuária',
    novelty: args.novelty ?? 0.3,
    modesty_min: args.modesty ?? 0,
  })
}

const SALTO = ['heels', 'elegant_shoe']
const RASO = ['loafers', 'flats', 'elegant_shoe']
const TENIS = ['sneakers']
const SANDALIA = ['sandals', 'flats']
const BOLSA = ['structured_bag', 'tote']
const ACC = ['jewelry', 'watch', 'belt', 'sunglasses']

// ──────────────────────────────────────────────────────────────────── VERÃO
const VERAO: OutfitFormula[] = [
  f({
    id: 'sea-frescor-e-estilo',
    nome: 'Frescor e Estilo',
    estacao: ['verao'], clima: ['calor'],
    style: ['casual', 'dia-a-dia', 'viagem', 'moderno'],
    occasion: ['passeio', 'dia-comum', 'viagem'],
    formality: [2, 4],
    required: [['top', ['tank', 'tshirt']], ['bottom', ['shorts']], ['shoes', TENIS]],
    optional: [['bag', [...BOLSA, 'backpack']], ['accessory', [...ACC, 'cap']]],
    silhueta: 'relaxed',
    descricao: 'Regata com short de linho e tênis: o mínimo que ainda é look, para dia quente.',
    novelty: 0.2,
  }),

  f({
    id: 'sea-basico-sofisticado',
    nome: 'Básico Sofisticado',
    estacao: ['verao', 'primavera'], clima: ['calor', 'ameno'],
    style: ['casual', 'feminino', 'dia-a-dia', 'moderno'],
    occasion: ['passeio', 'dia-comum', 'almoco'],
    formality: [3, 5],
    required: [
      ['top', ['tshirt', 'tank']],
      ['bottom', ['midi_skirt', 'long_skirt', 'pleated_skirt']],
      ['shoes', [...TENIS, ...SANDALIA]],
    ],
    optional: [['bag', BOLSA], ['accessory', [...ACC, 'scarf']]],
    cores: ['NEUTRAL', 'TONAL'],
    silhueta: 'fitted_top_full_bottom',
    descricao: 'Camiseta com saia midi e tênis: versátil, atemporal e fresco.',
    novelty: 0.3, modesty: 2,
  }),

  f({
    id: 'sea-praia-urbana',
    nome: 'Look Praia Urbana',
    estacao: ['verao'], clima: ['calor'],
    style: ['casual', 'viagem', 'feminino', 'dia-a-dia'],
    occasion: ['passeio', 'viagem', 'dia-comum', 'almoco'],
    formality: [2, 4],
    required: [['top', ['shirt', 'tank']], ['bottom', ['shorts']], ['shoes', SANDALIA]],
    optional: [['bag', ['tote', 'structured_bag']], ['accessory', ['sunglasses', 'jewelry', 'belt']]],
    cores: ['NEUTRAL', 'TONAL', 'NEUTRAL_ACCENT'],
    silhueta: 'relaxed',
    descricao: 'Camisa aberta sobre o short, sandália rasteira: praticidade que não parece descuido.',
    novelty: 0.35,
  }),

  f({
    id: 'sea-vestido-leve',
    nome: 'Vestido Leve',
    estacao: ['verao', 'primavera'], clima: ['calor', 'ameno'],
    style: ['feminino', 'elegante', 'casual', 'igreja'],
    occasion: ['almoco', 'passeio', 'igreja', 'jantar'],
    formality: [4, 6],
    required: [['dress', ['dress', 'midi_dress', 'long_dress']], ['shoes', [...SANDALIA, ...RASO]]],
    optional: [['bag', BOLSA], ['accessory', [...ACC, 'scarf']]],
    cores: ['NEUTRAL', 'TONAL'],
    silhueta: 'column',
    descricao: 'Vestido midi e sandália: feminino e prático, sem precisar de mais nada.',
    novelty: 0.25, modesty: 2,
  }),

  f({
    id: 'sea-colorido-na-medida',
    nome: 'Colorido na Medida',
    estacao: ['verao', 'primavera'], clima: ['calor'],
    style: ['feminino', 'moderno', 'casual'],
    occasion: ['passeio', 'almoco', 'dia-comum'],
    formality: [3, 5],
    required: [['top', ['shirt', 'blouse', 'tank']], ['bottom', ['shorts']], ['shoes', [...SANDALIA, ...SALTO]]],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL_ACCENT'],
    silhueta: 'relaxed',
    descricao: 'Uma peça de cor sobre base clara: o toque de cor do verão, em um lugar só.',
    novelty: 0.4,
  }),
]

// ─────────────────────────────────────────────────────────────────── OUTONO
const OUTONO: OutfitFormula[] = [
  f({
    id: 'sea-conforto-e-estilo',
    nome: 'Conforto e Estilo',
    estacao: ['outono', 'inverno'], clima: ['ameno', 'frio'],
    style: ['elegante', 'moderno', 'social', 'trabalho'],
    occasion: ['trabalho', 'almoco', 'passeio', 'jantar'],
    formality: [5, 7],
    required: [['top', ['knit']], ['bottom', ['wide_leg_trousers', 'tailored_trousers']], ['shoes', [...SALTO, ...RASO]]],
    optional: [['outerwear', ['coat', 'blazer']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['TONAL', 'NEUTRAL'],
    silhueta: 'column',
    descricao: 'Tricô com calça ampla: o conforto de outono que continua elegante.',
    novelty: 0.3,
  }),

  f({
    id: 'sea-colete-moderno',
    nome: 'Colete Moderno',
    estacao: ['outono', 'primavera'], clima: ['ameno', 'frio'],
    style: ['moderno', 'elegante', 'trabalho', 'social'],
    occasion: ['trabalho', 'jantar', 'evento', 'almoco'],
    formality: [6, 8],
    required: [['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', SALTO], ['outerwear', ['vest']]],
    optional: [['top', ['tank', 'blouse', 'shirt']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['TONAL', 'MONOCHROMATIC', 'NEUTRAL'],
    silhueta: 'structured',
    descricao: 'Colete e calça social em tons terrosos: moderno sem esforço.',
    novelty: 0.4,
  }),

  f({
    id: 'sea-terceira-peca-vestido',
    nome: 'Terceira Peça',
    estacao: ['outono', 'inverno'], clima: ['ameno', 'frio'],
    style: ['feminino', 'elegante', 'moderno', 'jantar'],
    occasion: ['jantar', 'passeio', 'evento', 'trabalho'],
    formality: [5, 8],
    required: [['dress', ['dress', 'midi_dress']], ['shoes', ['boots', ...SALTO]], ['outerwear', ['coat', 'jacket', 'blazer']]],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL', 'MONOCHROMATIC', 'TONAL'],
    silhueta: 'column',
    descricao: 'Vestido com casaco e bota: prático de manhã, sofisticado à noite.',
    novelty: 0.3, modesty: 1,
  }),

  f({
    id: 'sea-jeans-e-mocassim',
    nome: 'Jeans e Blazer com Mocassim',
    estacao: ['outono', 'primavera'], clima: ['ameno', 'frio'],
    style: ['casual', 'moderno', 'dia-a-dia', 'trabalho'],
    occasion: ['dia-comum', 'passeio', 'trabalho', 'almoco'],
    formality: [4, 6],
    required: [['top', ['shirt', 'blouse']], ['bottom', ['jeans']], ['shoes', ['loafers', 'flats']], ['outerwear', ['blazer']]],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL', 'CLASSIC'],
    silhueta: 'relaxed',
    descricao: 'Camisa, jeans, blazer e mocassim: versátil o ano todo, e nunca fora de lugar.',
    novelty: 0.25,
  }),
]

// ────────────────────────────────────────────────────────────────── INVERNO
const INVERNO: OutfitFormula[] = [
  f({
    id: 'sea-elegancia-urbana',
    nome: 'Elegância Urbana',
    estacao: ['inverno'], clima: ['frio'],
    style: ['moderno', 'casual', 'dia-a-dia', 'elegante'],
    occasion: ['dia-comum', 'passeio', 'trabalho', 'viagem'],
    formality: [4, 6],
    required: [['top', ['knit', 'tshirt', 'blouse']], ['bottom', ['jeans']], ['shoes', ['boots']], ['outerwear', ['coat', 'jacket', 'blazer']]],
    optional: [['bag', BOLSA], ['accessory', [...ACC, 'scarf']]],
    cores: ['NEUTRAL', 'TONAL', 'CLASSIC'],
    silhueta: 'relaxed',
    descricao: 'Casaco sobre jeans com bota: quentinho e estiloso, o uniforme de inverno.',
    novelty: 0.25,
  }),

  f({
    id: 'sea-look-em-camadas',
    nome: 'Look em Camadas',
    estacao: ['inverno'], clima: ['frio'],
    style: ['moderno', 'casual', 'dia-a-dia', 'trabalho'],
    occasion: ['dia-comum', 'trabalho', 'passeio', 'viagem'],
    formality: [4, 7],
    required: [['top', ['knit', 'shirt']], ['bottom', ['tailored_trousers', 'wide_leg_trousers', 'jeans']], ['shoes', [...TENIS, 'boots', ...RASO]], ['outerwear', ['coat', 'blazer', 'jacket', 'vest']]],
    optional: [['bag', BOLSA], ['accessory', [...ACC, 'scarf']]],
    cores: ['TONAL', 'NEUTRAL', 'MONOCHROMATIC'],
    silhueta: 'relaxed',
    descricao: 'Camisa por baixo do tricô, casaco por cima: camadas fazem o inverno virar styling.',
    novelty: 0.45,
  }),

  f({
    id: 'sea-terno-com-estilo',
    nome: 'Terno com Estilo',
    estacao: ['inverno', 'outono'], clima: ['frio', 'ameno'],
    style: ['trabalho', 'social', 'elegante', 'moderno'],
    occasion: ['trabalho', 'reuniao', 'jantar', 'evento'],
    formality: [7, 9],
    required: [['top', ['knit', 'blouse', 'tank']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['boots', ...SALTO]], ['outerwear', ['blazer']]],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['MONOCHROMATIC', 'TONAL'],
    silhueta: 'column',
    descricao: 'Conjunto de alfaiataria com tricô por baixo e bota: o terninho que aguenta o frio.',
    novelty: 0.35,
  }),

  f({
    id: 'sea-casaco-e-vestido',
    nome: 'Casaco e Vestido',
    estacao: ['inverno'], clima: ['frio'],
    style: ['feminino', 'elegante', 'jantar', 'social', 'igreja'],
    occasion: ['jantar', 'evento', 'igreja', 'almoco'],
    formality: [6, 9],
    required: [['dress', ['dress', 'midi_dress', 'long_dress']], ['shoes', ['boots', ...SALTO]], ['outerwear', ['coat']]],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['MONOCHROMATIC', 'NEUTRAL', 'TONAL'],
    silhueta: 'column',
    descricao: 'Vestido com casaco longo e bota: feminino e atemporal, sem passar frio.',
    novelty: 0.3, modesty: 1,
  }),
]

// ──────────────────────────────────────────────────────────────── PRIMAVERA
const PRIMAVERA: OutfitFormula[] = [
  f({
    id: 'sea-colete-em-evidencia',
    nome: 'Colete em Evidência',
    estacao: ['primavera', 'verao'], clima: ['calor', 'ameno'],
    style: ['moderno', 'casual', 'dia-a-dia', 'trabalho'],
    occasion: ['dia-comum', 'passeio', 'trabalho', 'almoco'],
    formality: [4, 6],
    required: [['bottom', ['wide_leg_trousers', 'tailored_trousers']], ['shoes', TENIS], ['outerwear', ['vest']]],
    optional: [['top', ['tank', 'tshirt']], ['bag', BOLSA], ['accessory', [...ACC, 'cap']]],
    cores: ['NEUTRAL', 'TONAL'],
    silhueta: 'relaxed',
    descricao: 'Colete com calça ampla e tênis: estiloso, versátil e leve para dias amenos.',
    novelty: 0.5,
  }),

  f({
    id: 'sea-floral-e-elegante',
    nome: 'Floral e Elegante',
    estacao: ['primavera'], clima: ['ameno', 'calor'],
    style: ['feminino', 'elegante', 'social', 'moderno'],
    occasion: ['almoco', 'passeio', 'trabalho', 'igreja'],
    formality: [5, 7],
    required: [['top', ['blouse', 'shirt', 'statement_top']], ['bottom', ['wide_leg_trousers', 'tailored_trousers', 'midi_skirt']], ['shoes', RASO]],
    optional: [['outerwear', ['blazer', 'cardigan', 'vest']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL_ACCENT', 'TONAL'],
    silhueta: 'column',
    descricao: 'Estampa em cima e base neutra embaixo: a cor da primavera sem exagero.',
    novelty: 0.45, modesty: 1,
  }),

  f({
    id: 'sea-conjunto-fresco',
    nome: 'Conjunto Fresco',
    estacao: ['primavera', 'verao'], clima: ['calor', 'ameno'],
    style: ['moderno', 'elegante', 'feminino', 'viagem'],
    occasion: ['almoco', 'viagem', 'passeio', 'jantar'],
    formality: [4, 6],
    required: [['top', ['tank', 'tshirt']], ['bottom', ['wide_leg_trousers', 'shorts']], ['shoes', [...SANDALIA, ...TENIS]]],
    optional: [['outerwear', ['blazer', 'vest', 'cardigan']], ['bag', BOLSA], ['accessory', ACC]],
    cores: ['TONAL', 'MONOCHROMATIC', 'NEUTRAL'],
    silhueta: 'relaxed',
    descricao: 'Conjunto em tom único com regata e sandália: leve, resolvido e sofisticado.',
    novelty: 0.35,
  }),

  f({
    id: 'sea-feminino-e-moderno',
    nome: 'Feminino e Moderno',
    estacao: ['primavera', 'verao'], clima: ['calor', 'ameno'],
    style: ['feminino', 'moderno', 'elegante', 'social'],
    occasion: ['almoco', 'jantar', 'evento', 'passeio'],
    formality: [5, 7],
    required: [['top', ['tank', 'tshirt', 'blouse']], ['bottom', ['shorts']], ['shoes', SALTO], ['outerwear', ['blazer', 'cardigan']]],
    optional: [['bag', BOLSA], ['accessory', ACC]],
    cores: ['NEUTRAL', 'NEUTRAL_ACCENT', 'TONAL'],
    silhueta: 'structured',
    descricao: 'Blazer com short e salto: feminino, moderno e pronto para dias amenos.',
    novelty: 0.45,
  }),
]

export const SEASON_FORMULAS: OutfitFormula[] = [...VERAO, ...OUTONO, ...INVERNO, ...PRIMAVERA]
