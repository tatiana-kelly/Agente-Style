import { outfitFormulaSchema, type OutfitFormula } from '@/schemas/formula'

/**
 * Biblioteca de fórmulas de look.
 *
 * Cada entrada é um princípio de styling reduzido a arquétipos de peça, nível de
 * formalidade e padrão de cor. Nenhuma referencia uma foto ou um look de pessoa
 * específica — o que se guarda é a relação entre as peças (§37).
 */

type Slot = [string, string[]]

function f(
  id: string,
  name: string,
  category: string,
  style: string[],
  occasion: string[],
  formality: [number, number],
  required: Slot[],
  optional: Slot[],
  colorPatterns: string[],
  silhouette: string,
  description: string,
  sourceType: string,
  sourceRef: string,
  novelty = 0.3,
  modestyMin = 0,
): OutfitFormula {
  return outfitFormulaSchema.parse({
    id, name, category, style, occasion, formality,
    required_roles: required.map(([role, archetypes]) => ({ role, archetypes })),
    optional_roles: optional.map(([role, archetypes]) => ({ role, archetypes })),
    color_patterns: colorPatterns,
    silhouette, description,
    source_type: sourceType, source_reference: sourceRef,
    novelty, modesty_min: modestyMin,
  })
}

const SHOES_ELEGANT = ['heels', 'elegant_shoe', 'flats', 'loafers']
const ACC_ELEGANT = ['jewelry', 'watch', 'belt']
const BAG_ELEGANT = ['structured_bag', 'tote']

// ─────────────────────────────────────────────────────────── TRABALHO / SOCIAL
const WORK: OutfitFormula[] = [
  f('work-blazer-blouse-trousers', 'Blazer + blusa + alfaiataria', 'work',
    ['trabalho', 'social', 'elegante'], ['trabalho', 'reuniao'], [7, 9],
    [['top', ['blouse', 'shirt']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', SHOES_ELEGANT]],
    [['outerwear', ['blazer']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'CLASSIC', 'MONOCHROMATIC'], 'structured',
    'O blazer é o que sobe o registro: o mesmo conjunto sem ele vira business casual.',
    'dress-code', 'business formal — blazer como marcador de formalidade', 0.15),

  f('work-shirt-trousers-loafers', 'Camisa + alfaiataria + mocassim', 'work',
    ['trabalho', 'social'], ['trabalho', 'reuniao'], [6, 8],
    [['top', ['shirt', 'blouse']], ['bottom', ['tailored_trousers']], ['shoes', ['loafers', 'flats', 'elegant_shoe']]],
    [['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['NEUTRAL', 'CLASSIC'], 'column',
    'Calçado fechado e baixo mantém o profissional sem exigir salto.',
    'dress-code', 'business casual — calçado fechado', 0.2),

  f('work-dress-blazer', 'Vestido + blazer', 'work',
    ['trabalho', 'social', 'elegante'], ['trabalho', 'reuniao', 'evento'], [7, 9],
    [['dress', ['dress', 'midi_dress']], ['shoes', SHOES_ELEGANT]],
    [['outerwear', ['blazer']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'structured',
    'Uma peça só resolve a silhueta; o blazer dá a estrutura nos ombros.',
    'dress-code', 'business formal — vestido com sobreposição', 0.25),

  f('work-monochrome-tailoring', 'Alfaiataria monocromática', 'work',
    ['trabalho', 'social', 'elegante', 'moderno'], ['trabalho', 'reuniao', 'evento'], [8, 10],
    [['top', ['blouse', 'shirt', 'knit']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', SHOES_ELEGANT]],
    [['outerwear', ['blazer']], ['accessory', ACC_ELEGANT]],
    ['MONOCHROMATIC', 'TONAL'], 'column',
    'Uma cor só de cima a baixo alonga a silhueta e lê como muito resolvido.',
    'styling-principle', 'coluna de cor única', 0.45),

  f('work-shirt-midi-skirt', 'Camisa + saia midi', 'work',
    ['trabalho', 'social', 'feminino'], ['trabalho', 'reuniao', 'almoco'], [6, 8],
    [['top', ['shirt', 'blouse']], ['bottom', ['midi_skirt', 'pleated_skirt', 'skirt']], ['shoes', SHOES_ELEGANT]],
    [['outerwear', ['blazer', 'cardigan']], ['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['NEUTRAL', 'CLASSIC', 'TONAL'], 'fitted_top_full_bottom',
    'Camisa por dentro marca a cintura e equilibra o volume da saia.',
    'styling-principle', 'proporção justo em cima, amplo embaixo', 0.3, 1),

  f('work-knit-trousers', 'Tricô + alfaiataria', 'work',
    ['trabalho', 'social', 'moderno'], ['trabalho', 'reuniao'], [5, 7],
    [['top', ['knit']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['loafers', 'flats', 'elegant_shoe', 'heels']]],
    [['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['TONAL', 'NEUTRAL', 'CLASSIC'], 'relaxed',
    'Malha no lugar da camisa suaviza sem perder o registro de trabalho.',
    'dress-code', 'business casual — malha estruturada', 0.35),

  f('work-blazer-tshirt-trousers', 'Blazer + camiseta + alfaiataria', 'work',
    ['trabalho', 'moderno'], ['trabalho', 'almoco'], [5, 7],
    [['top', ['tshirt', 'tank']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['loafers', 'sneakers', 'flats']]],
    [['outerwear', ['blazer']], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'structured',
    'Camiseta sob o blazer é o jeito contemporâneo de baixar a formalidade sem desleixo.',
    'styling-principle', 'blazer sobre peça casual', 0.55),

  f('work-trouser-suit', 'Terninho', 'work',
    ['trabalho', 'social', 'elegante'], ['trabalho', 'reuniao', 'evento'], [8, 10],
    [['top', ['blouse', 'shirt']], ['bottom', ['tailored_trousers']], ['shoes', ['heels', 'elegant_shoe', 'loafers']], ['outerwear', ['blazer']]],
    [['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'structured',
    'Blazer e calça na mesma cor é o registro mais formal do guarda-roupa de trabalho.',
    'dress-code', 'business formal — terno feminino', 0.2),

  f('work-wideleg-blouse', 'Pantalona + blusa', 'work',
    ['trabalho', 'moderno', 'elegante'], ['trabalho', 'almoco', 'reuniao'], [6, 8],
    [['top', ['blouse', 'shirt', 'knit']], ['bottom', ['wide_leg_trousers']], ['shoes', ['heels', 'loafers', 'elegant_shoe']]],
    [['outerwear', ['blazer']], ['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['TONAL', 'NEUTRAL'], 'fitted_top_full_bottom',
    'Blusa ajustada compensa o volume da pantalona.',
    'styling-principle', 'equilíbrio de proporção', 0.4),

  f('work-tonal-layering', 'Camadas tonais', 'work',
    ['trabalho', 'elegante', 'moderno'], ['trabalho', 'reuniao'], [6, 9],
    [['top', ['blouse', 'knit', 'shirt']], ['bottom', ['tailored_trousers', 'midi_skirt']], ['shoes', SHOES_ELEGANT]],
    [['outerwear', ['blazer', 'cardigan', 'coat']], ['accessory', ACC_ELEGANT]],
    ['TONAL', 'MONOCHROMATIC'], 'column',
    'Tons próximos da mesma família criam profundidade sem contraste duro.',
    'color-theory', 'gradação tonal', 0.5),
]

// ───────────────────────────────────────────────────────────────────── IGREJA
const CHURCH: OutfitFormula[] = [
  f('church-midi-dress', 'Vestido midi', 'church',
    ['igreja', 'elegante', 'feminino'], ['igreja', 'almoco', 'evento'], [6, 8],
    [['dress', ['midi_dress', 'dress']], ['shoes', ['elegant_shoe', 'flats', 'heels']]],
    [['outerwear', ['blazer', 'cardigan']], ['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['NEUTRAL', 'TONAL', 'CLASSIC'], 'relaxed',
    'Vestido na altura midi é o ponto de partida mais seguro: resolve tudo em uma peça.',
    'dress-code', 'modest dressing — comprimento na altura do joelho ou abaixo', 0.2, 2),

  f('church-midi-skirt-blouse', 'Saia midi + blusa', 'church',
    ['igreja', 'elegante', 'feminino'], ['igreja', 'almoco'], [6, 8],
    [['top', ['blouse', 'shirt']], ['bottom', ['midi_skirt', 'pleated_skirt', 'skirt']], ['shoes', ['elegant_shoe', 'flats', 'heels']]],
    [['outerwear', ['cardigan', 'blazer']], ['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['NEUTRAL', 'TONAL', 'CLASSIC'], 'fitted_top_full_bottom',
    'Blusa e saia midi em tons suaves: elegante, coberto e confortável para ficar sentada.',
    'dress-code', 'modest dressing — blusa de gola discreta com saia midi', 0.2, 2),

  f('church-pleated-skirt-knit', 'Saia plissada + tricô', 'church',
    ['igreja', 'feminino', 'elegante'], ['igreja'], [5, 7],
    [['top', ['knit', 'blouse']], ['bottom', ['pleated_skirt', 'midi_skirt']], ['shoes', ['flats', 'elegant_shoe', 'heels']]],
    [['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['TONAL', 'NEUTRAL'], 'fitted_top_full_bottom',
    'A plissada dá movimento; a malha cobre os ombros sem parecer pesada.',
    'dress-code', 'modest dressing — ombros cobertos', 0.3, 2),

  f('church-trousers-blouse', 'Alfaiataria + blusa elegante', 'church',
    ['igreja', 'social', 'elegante'], ['igreja', 'almoco'], [6, 8],
    [['top', ['blouse', 'shirt']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['elegant_shoe', 'flats', 'heels']]],
    [['outerwear', ['blazer', 'cardigan']], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'CLASSIC', 'MONOCHROMATIC'], 'column',
    'Nem toda igreja pede saia: calça de alfaiataria com blusa cumpre o mesmo registro.',
    'dress-code', 'modest dressing — alternativa de calça', 0.3, 1),

  f('church-dress-blazer', 'Vestido + blazer', 'church',
    ['igreja', 'elegante'], ['igreja', 'evento'], [7, 9],
    [['dress', ['dress', 'midi_dress']], ['shoes', ['elegant_shoe', 'heels']], ['outerwear', ['blazer', 'cardigan']]],
    [['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'structured',
    'O blazer acrescenta cobertura e sobe o registro quando o culto é mais formal.',
    'dress-code', 'modest dressing — camada extra de cobertura', 0.25, 3),

  f('church-wideleg-blouse', 'Pantalona + blusa fluida', 'church',
    ['igreja', 'feminino', 'moderno'], ['igreja', 'almoco'], [5, 7],
    [['top', ['blouse']], ['bottom', ['wide_leg_trousers']], ['shoes', ['flats', 'elegant_shoe', 'heels']]],
    [['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['TONAL', 'NEUTRAL'], 'fitted_top_full_bottom',
    'Tecido que cai em vez de marcar: confortável para ficar de pé e sentar.',
    'dress-code', 'modest dressing — caimento fluido', 0.4, 2),

  f('church-monochrome-elegant', 'Monocromático elegante', 'church',
    ['igreja', 'elegante'], ['igreja', 'evento'], [7, 9],
    [['top', ['blouse', 'knit']], ['bottom', ['midi_skirt', 'tailored_trousers']], ['shoes', ['elegant_shoe', 'heels', 'flats']]],
    [['outerwear', ['blazer', 'cardigan']], ['accessory', ACC_ELEGANT]],
    ['MONOCHROMATIC', 'TONAL'], 'column',
    'Uma cor só, sem disputa visual — discreto e sofisticado ao mesmo tempo.',
    'styling-principle', 'coluna de cor única', 0.4, 2),

  f('church-soft-colors', 'Combinação em tons suaves', 'church',
    ['igreja', 'feminino'], ['igreja', 'almoco'], [5, 8],
    [['top', ['blouse', 'knit']], ['bottom', ['midi_skirt', 'pleated_skirt', 'wide_leg_trousers']], ['shoes', ['flats', 'elegant_shoe', 'heels']]],
    [['outerwear', ['cardigan']], ['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['NEUTRAL', 'TONAL', 'NEUTRAL_ACCENT'], 'relaxed',
    'Paleta clara e abafada: o contrário de chamar atenção.',
    'color-theory', 'cartela suave e desaturada', 0.35, 2),

  f('church-knit-midi-skirt', 'Tricô + saia midi', 'church',
    ['igreja', 'elegante', 'feminino'], ['igreja'], [5, 7],
    [['top', ['knit', 'blouse']], ['bottom', ['midi_skirt', 'skirt']], ['shoes', ['flats', 'elegant_shoe']]],
    [['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    ['TONAL', 'NEUTRAL'], 'column',
    'Malha fina por dentro da saia mantém a linha da cintura visível.',
    'styling-principle', 'peça por dentro define a cintura', 0.3, 2),
]

// ───────────────────────────────────────────────────────────────────── TÊNIS
const TENNIS: OutfitFormula[] = [
  f('tennis-top-skort-shoes', 'Top + skort + tênis de quadra', 'tennis',
    ['tenis', 'esporte'], ['partida-tenis', 'treino'], [0, 2],
    [['top', ['sport_top', 'tank', 'tshirt']], ['bottom', ['skort', 'skirt']], ['shoes', ['tennis_shoes', 'sneakers']]],
    [['accessory', ['visor', 'cap']], ['bag', ['tennis_bag', 'backpack']]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'athletic',
    'Skort dá liberdade de movimento com o short embutido — o padrão da quadra.',
    'sport-functional', 'tênis — mobilidade lateral e cobertura', 0.1),

  f('tennis-top-shorts-shoes', 'Top + shorts + tênis de quadra', 'tennis',
    ['tenis', 'esporte'], ['partida-tenis', 'treino'], [0, 2],
    [['top', ['sport_top', 'tank', 'tshirt']], ['bottom', ['shorts']], ['shoes', ['tennis_shoes', 'sneakers']]],
    [['accessory', ['visor', 'cap']], ['bag', ['tennis_bag', 'backpack']]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'athletic',
    'Shorts quando o dia está quente e o jogo é longo.',
    'sport-functional', 'tênis — ventilação', 0.15),

  f('tennis-polo-skort', 'Polo + skort', 'tennis',
    ['tenis'], ['partida-tenis', 'treino'], [1, 3],
    [['top', ['polo', 'tshirt']], ['bottom', ['skort', 'skirt', 'shorts']], ['shoes', ['tennis_shoes', 'sneakers']]],
    [['accessory', ['visor', 'cap']], ['bag', ['tennis_bag']]],
    ['CLASSIC', 'NEUTRAL'], 'athletic',
    'Polo é o registro mais tradicional da quadra, aceito em clube com regra de branco.',
    'sport-functional', 'tênis — dress code de clube', 0.2),

  f('tennis-dress', 'Vestido de tênis', 'tennis',
    ['tenis', 'esporte'], ['partida-tenis'], [0, 2],
    [['dress', ['sport_dress', 'dress']], ['shoes', ['tennis_shoes']]],
    [['accessory', ['visor', 'cap']], ['bag', ['tennis_bag']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'athletic',
    'Peça única de quadra: menos ajuste durante o jogo.',
    'sport-functional', 'tênis — peça única', 0.25),

  f('tennis-top-leggings', 'Top + legging + tênis', 'tennis',
    ['tenis', 'esporte'], ['partida-tenis', 'treino'], [0, 2],
    [['top', ['sport_top', 'tank', 'tshirt']], ['bottom', ['leggings']], ['shoes', ['tennis_shoes', 'sneakers']]],
    [['outerwear', ['windbreaker', 'jacket']], ['accessory', ['visor', 'cap']], ['bag', ['tennis_bag']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'athletic',
    'Legging quando esfria ou a quadra é de saibro e raspa a perna.',
    'sport-functional', 'tênis — proteção e temperatura', 0.2),

  f('tennis-tank-skirt', 'Regata + saia de tênis', 'tennis',
    ['tenis', 'esporte'], ['partida-tenis', 'treino'], [0, 2],
    [['top', ['tank', 'sport_top']], ['bottom', ['skirt', 'skort']], ['shoes', ['tennis_shoes', 'sneakers']]],
    [['accessory', ['visor', 'cap']], ['bag', ['tennis_bag']]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'athletic',
    'Regata para calor, com saia técnica.',
    'sport-functional', 'tênis — calor', 0.2),
]

// ──────────────────────────────────────────────────────────────────── ESPORTE
const SPORT: OutfitFormula[] = [
  f('sport-top-leggings', 'Top + legging', 'sport',
    ['esporte'], ['treino'], [0, 2],
    [['top', ['sport_top', 'tank', 'tshirt']], ['bottom', ['leggings']], ['shoes', ['sneakers', 'tennis_shoes']]],
    [['outerwear', ['windbreaker', 'jacket']], ['bag', ['backpack']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'athletic',
    'Base de academia: compressão embaixo, mobilidade em cima.',
    'sport-functional', 'treino — mobilidade', 0.1),

  f('sport-tshirt-shorts', 'Camiseta + shorts', 'sport',
    ['esporte'], ['treino'], [0, 2],
    [['top', ['tshirt', 'tank', 'sport_top']], ['bottom', ['shorts']], ['shoes', ['sneakers', 'tennis_shoes']]],
    [['accessory', ['cap']], ['bag', ['backpack']]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'athletic',
    'Corrida e treino em dia quente.',
    'sport-functional', 'treino — ventilação', 0.15),

  f('sport-dress-sneakers', 'Vestido esportivo + tênis', 'sport',
    ['esporte'], ['treino', 'dia-comum'], [0, 3],
    [['dress', ['sport_dress', 'dress']], ['shoes', ['sneakers', 'tennis_shoes']]],
    [['outerwear', ['windbreaker', 'jacket']], ['accessory', ['cap', 'visor']], ['bag', ['backpack']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'athletic',
    'Peça única para treino leve ou caminhada.',
    'sport-functional', 'treino — peça única', 0.3),

  f('sport-layered-cold', 'Treino em camadas', 'sport',
    ['esporte'], ['treino'], [0, 3],
    [['top', ['sport_top', 'tshirt', 'tank']], ['bottom', ['leggings', 'shorts']], ['shoes', ['sneakers', 'tennis_shoes']], ['outerwear', ['windbreaker', 'jacket']]],
    [['accessory', ['cap']], ['bag', ['backpack']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'athletic',
    'Corta-vento por cima resolve treino em manhã fria.',
    'sport-functional', 'treino — temperatura', 0.25),
]

// ───────────────────────────────────────────────────────────────────── CASUAL
const CASUAL: OutfitFormula[] = [
  f('casual-tshirt-jeans-sneakers', 'Camiseta + jeans + tênis', 'casual',
    ['casual', 'dia-a-dia', 'moderno'], ['dia-comum', 'passeio'], [2, 4],
    [['top', ['tshirt', 'tank']], ['bottom', ['jeans']], ['shoes', ['sneakers', 'flats']]],
    [['outerwear', ['jacket', 'cardigan']], ['accessory', ['sunglasses', 'watch']], ['bag', ['tote', 'backpack']]],
    ['CLASSIC', 'NEUTRAL'], 'relaxed',
    'O uniforme do dia comum. Funciona porque não tenta nada.',
    'styling-principle', 'base casual', 0.05),

  f('casual-shirt-jeans', 'Camisa + jeans', 'casual',
    ['casual', 'moderno', 'dia-a-dia'], ['dia-comum', 'passeio', 'almoco'], [3, 5],
    [['top', ['shirt', 'blouse']], ['bottom', ['jeans']], ['shoes', ['sneakers', 'flats', 'loafers']]],
    [['outerwear', ['blazer', 'jacket']], ['accessory', ['watch', 'belt']], ['bag', ['tote']]],
    ['CLASSIC', 'NEUTRAL'], 'relaxed',
    'Camisa em vez de camiseta sobe meio ponto sem virar social.',
    'styling-principle', 'casual elevado', 0.2),

  f('casual-knit-trousers-sneakers', 'Tricô + calça + tênis', 'casual',
    ['casual', 'moderno', 'viagem'], ['dia-comum', 'passeio', 'viagem'], [3, 5],
    [['top', ['knit', 'tshirt']], ['bottom', ['tailored_trousers', 'wide_leg_trousers', 'jeans']], ['shoes', ['sneakers', 'flats']]],
    [['outerwear', ['jacket', 'coat']], ['bag', ['tote', 'backpack']]],
    ['TONAL', 'NEUTRAL'], 'relaxed',
    'Tênis com alfaiataria: confortável sem parecer roupa de ginástica.',
    'styling-principle', 'mistura de registros', 0.45),

  f('casual-top-wideleg', 'Top + pantalona', 'casual',
    ['casual', 'moderno', 'feminino'], ['dia-comum', 'passeio', 'almoco'], [3, 6],
    [['top', ['tshirt', 'blouse', 'knit', 'tank']], ['bottom', ['wide_leg_trousers']], ['shoes', ['sneakers', 'flats', 'sandals']]],
    [['accessory', ['sunglasses', 'jewelry']], ['bag', ['tote']]],
    ['TONAL', 'NEUTRAL', 'NEUTRAL_ACCENT'], 'fitted_top_full_bottom',
    'Cima justa, baixo amplo — a proporção faz o trabalho.',
    'styling-principle', 'equilíbrio de proporção', 0.35),

  f('casual-tshirt-skirt', 'Camiseta + saia + tênis', 'casual',
    ['casual', 'moderno', 'feminino'], ['dia-comum', 'passeio'], [3, 5],
    [['top', ['tshirt', 'tank']], ['bottom', ['midi_skirt', 'skirt', 'pleated_skirt']], ['shoes', ['sneakers', 'flats']]],
    [['outerwear', ['jacket', 'cardigan']], ['bag', ['tote']]],
    ['NEUTRAL_ACCENT', 'CLASSIC'], 'fitted_top_full_bottom',
    'Camiseta com saia midi e tênis é o casual contemporâneo por excelência.',
    'styling-principle', 'mistura de registros', 0.5),

  f('casual-jeans-blazer', 'Jeans + blazer', 'casual',
    ['casual', 'moderno', 'trabalho'], ['dia-comum', 'almoco', 'passeio'], [4, 6],
    [['top', ['tshirt', 'knit', 'shirt']], ['bottom', ['jeans']], ['shoes', ['loafers', 'sneakers', 'flats']]],
    [['outerwear', ['blazer']], ['accessory', ['watch', 'belt']], ['bag', ['tote', 'structured_bag']]],
    ['CLASSIC', 'NEUTRAL'], 'structured',
    'Blazer sobre jeans: o jeito mais rápido de fazer o casual parecer intencional.',
    'styling-principle', 'estrutura sobre casual', 0.3),

  f('casual-dress-sneakers', 'Vestido + tênis', 'casual',
    ['casual', 'moderno', 'feminino'], ['dia-comum', 'passeio'], [3, 5],
    [['dress', ['dress', 'midi_dress']], ['shoes', ['sneakers', 'flats']]],
    [['outerwear', ['jacket', 'cardigan']], ['bag', ['tote', 'backpack']]],
    ['NEUTRAL_ACCENT', 'MONOCHROMATIC'], 'relaxed',
    'Tênis derruba a formalidade do vestido e deixa o look usável de dia.',
    'styling-principle', 'mistura de registros', 0.5),

  f('casual-knit-jeans-boots', 'Tricô + jeans + bota', 'casual',
    ['casual', 'dia-a-dia', 'moderno'], ['dia-comum', 'passeio', 'almoco'], [3, 5],
    [['top', ['knit', 'tshirt']], ['bottom', ['jeans']], ['shoes', ['boots', 'flats', 'sneakers']]],
    [['outerwear', ['jacket', 'coat']], ['accessory', ['watch', 'sunglasses']], ['bag', ['tote']]],
    ['TONAL', 'NEUTRAL', 'CLASSIC'], 'relaxed',
    'Malha e bota dão peso visual ao jeans no frio.',
    'styling-principle', 'base casual de inverno', 0.2),

  f('casual-polo-trousers', 'Polo + calça', 'casual',
    ['casual', 'dia-a-dia', 'trabalho'], ['dia-comum', 'almoco', 'trabalho'], [3, 6],
    [['top', ['polo', 'knit']], ['bottom', ['tailored_trousers', 'jeans']], ['shoes', ['loafers', 'sneakers', 'flats']]],
    [['accessory', ['watch', 'belt']], ['bag', ['tote']]],
    ['NEUTRAL', 'CLASSIC'], 'relaxed',
    'Polo é meio caminho entre camiseta e camisa.',
    'dress-code', 'casual de escritório', 0.25),
]

// ───────────────────────────────────────────────────────────────────── JANTAR
const DINNER: OutfitFormula[] = [
  f('dinner-dress-heels', 'Vestido + salto', 'dinner',
    ['jantar', 'elegante', 'festa', 'feminino'], ['jantar', 'evento', 'festa'], [7, 9],
    [['dress', ['dress', 'midi_dress']], ['shoes', ['heels', 'elegant_shoe', 'sandals']]],
    [['accessory', ['jewelry', 'watch']], ['bag', ['structured_bag']], ['outerwear', ['blazer']]],
    ['MONOCHROMATIC', 'NEUTRAL', 'CLASSIC'], 'relaxed',
    'Vestido com salto: decisão única, resultado previsível.',
    'styling-principle', 'peça única de noite', 0.15),

  f('dinner-blouse-trousers-heels', 'Blusa + calça + salto', 'dinner',
    ['jantar', 'elegante', 'social'], ['jantar', 'evento'], [7, 9],
    [['top', ['blouse', 'statement_top']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['heels', 'elegant_shoe']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']], ['outerwear', ['blazer']]],
    ['MONOCHROMATIC', 'NEUTRAL', 'TONAL'], 'column',
    'Calça de alfaiataria com salto lê tão formal quanto vestido, com mais conforto.',
    'styling-principle', 'alternativa de calça para a noite', 0.3),

  f('dinner-skirt-blouse-heels', 'Saia + blusa + salto', 'dinner',
    ['jantar', 'elegante', 'feminino'], ['jantar', 'evento', 'festa'], [7, 9],
    [['top', ['blouse', 'statement_top', 'knit']], ['bottom', ['midi_skirt', 'skirt', 'pleated_skirt']], ['shoes', ['heels', 'elegant_shoe', 'sandals']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']]],
    ['TONAL', 'NEUTRAL', 'CLASSIC'], 'fitted_top_full_bottom',
    'Saia midi com salto alonga a perna e mantém o registro elegante.',
    'styling-principle', 'proporção e altura', 0.3),

  f('dinner-statement-top-neutral-bottom', 'Top statement + base neutra', 'dinner',
    ['jantar', 'moderno', 'festa'], ['jantar', 'festa', 'evento'], [6, 9],
    [['top', ['statement_top', 'blouse']], ['bottom', ['tailored_trousers', 'midi_skirt']], ['shoes', ['heels', 'elegant_shoe']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']]],
    ['NEUTRAL_ACCENT'], 'fitted_top_full_bottom',
    'Se a peça de cima chama atenção, a de baixo precisa ficar quieta.',
    'styling-principle', 'um ponto focal por look', 0.55),

  f('dinner-monochrome-elegant', 'Monocromático de noite', 'dinner',
    ['jantar', 'elegante', 'festa'], ['jantar', 'festa', 'evento'], [8, 10],
    [['top', ['blouse', 'knit']], ['bottom', ['tailored_trousers', 'midi_skirt']], ['shoes', ['heels', 'elegant_shoe']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']]],
    ['MONOCHROMATIC'], 'column',
    'Preto sobre preto, ou qualquer cor sobre ela mesma: máxima elegância com mínima decisão.',
    'color-theory', 'coluna de cor única', 0.35),
]

// ───────────────────────────────────────────────────────────────────── EVENTO
const EVENT: OutfitFormula[] = [
  f('event-dress-heels-jewelry', 'Vestido + salto + joia', 'event',
    ['evento', 'festa', 'elegante'], ['evento', 'festa'], [8, 10],
    [['dress', ['dress', 'midi_dress']], ['shoes', ['heels', 'elegant_shoe', 'sandals']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'relaxed',
    'Registro de evento: a joia é o que separa do jantar comum.',
    'dress-code', 'evento social', 0.2),

  f('event-tailoring-heels', 'Alfaiataria de festa', 'event',
    ['evento', 'elegante', 'moderno'], ['evento', 'festa'], [8, 10],
    [['top', ['blouse', 'statement_top']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['heels', 'elegant_shoe']], ['outerwear', ['blazer']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'structured',
    'Terninho em evento noturno é alternativa moderna ao vestido.',
    'dress-code', 'evento social — alternativa de calça', 0.45),

  f('event-skirt-statement', 'Saia + top de destaque', 'event',
    ['evento', 'festa', 'feminino'], ['evento', 'festa'], [7, 10],
    [['top', ['statement_top', 'blouse']], ['bottom', ['midi_skirt', 'pleated_skirt', 'skirt']], ['shoes', ['heels', 'sandals', 'elegant_shoe']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']]],
    ['NEUTRAL_ACCENT', 'TONAL'], 'fitted_top_full_bottom',
    'Saia com movimento e top que sustenta o olhar.',
    'styling-principle', 'um ponto focal por look', 0.5),

  f('event-midi-dress-blazer', 'Vestido midi + blazer', 'event',
    ['evento', 'elegante', 'social'], ['evento', 'festa', 'jantar'], [7, 9],
    [['dress', ['midi_dress', 'dress']], ['shoes', ['heels', 'elegant_shoe']], ['outerwear', ['blazer']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'structured',
    'Blazer sobre vestido resolve evento diurno e ar-condicionado.',
    'dress-code', 'evento social diurno', 0.3),

  f('event-tonal-elegant', 'Evento em cartela tonal', 'event',
    ['evento', 'elegante', 'feminino'], ['evento', 'festa'], [7, 10],
    [['top', ['blouse', 'statement_top']], ['bottom', ['midi_skirt', 'wide_leg_trousers']], ['shoes', ['heels', 'sandals', 'elegant_shoe']]],
    [['accessory', ['jewelry']], ['bag', ['structured_bag']], ['outerwear', ['blazer']]],
    ['TONAL', 'MONOCHROMATIC'], 'column',
    'Tons próximos em peças grandes dão sofisticação sem contraste duro.',
    'color-theory', 'gradação tonal', 0.45),
]

// ───────────────────────────────────────────────────────────────────── VIAGEM
const TRAVEL: OutfitFormula[] = [
  f('travel-comfort-trousers-sneakers', 'Conforto + calça + tênis', 'travel',
    ['viagem', 'casual'], ['viagem', 'dia-comum'], [2, 5],
    [['top', ['tshirt', 'knit', 'tank']], ['bottom', ['tailored_trousers', 'wide_leg_trousers', 'jeans', 'leggings']], ['shoes', ['sneakers', 'flats']]],
    [['outerwear', ['jacket', 'cardigan', 'windbreaker']], ['bag', ['backpack', 'tote']]],
    ['NEUTRAL', 'TONAL'], 'relaxed',
    'Aeroporto pede tecido que não amassa e calçado que entra e sai fácil.',
    'styling-principle', 'viagem — conforto e praticidade', 0.15),

  f('travel-knit-wideleg', 'Tricô + pantalona', 'travel',
    ['viagem', 'moderno', 'casual'], ['viagem', 'passeio'], [3, 6],
    [['top', ['knit', 'tshirt']], ['bottom', ['wide_leg_trousers']], ['shoes', ['sneakers', 'flats', 'loafers']]],
    [['outerwear', ['jacket', 'coat']], ['bag', ['tote', 'backpack']]],
    ['TONAL', 'NEUTRAL'], 'fitted_top_full_bottom',
    'Pantalona é a calça mais confortável que ainda parece arrumada.',
    'styling-principle', 'viagem — conforto sem desleixo', 0.35),

  f('travel-layered', 'Look em camadas', 'travel',
    ['viagem'], ['viagem'], [2, 6],
    [['top', ['tshirt', 'knit', 'shirt']], ['bottom', ['jeans', 'tailored_trousers', 'leggings']], ['shoes', ['sneakers', 'boots', 'flats']], ['outerwear', ['jacket', 'cardigan', 'coat', 'windbreaker']]],
    [['accessory', ['sunglasses']], ['bag', ['backpack', 'tote']]],
    ['NEUTRAL', 'TONAL'], 'relaxed',
    'Camadas resolvem avião gelado e rua quente no mesmo dia.',
    'styling-principle', 'viagem — variação térmica', 0.3),

  f('travel-monochrome', 'Viagem monocromática', 'travel',
    ['viagem', 'moderno'], ['viagem'], [3, 6],
    [['top', ['knit', 'tshirt', 'blouse']], ['bottom', ['tailored_trousers', 'wide_leg_trousers', 'jeans']], ['shoes', ['sneakers', 'flats', 'boots']]],
    [['outerwear', ['coat', 'jacket']], ['bag', ['tote', 'backpack']]],
    ['MONOCHROMATIC', 'TONAL'], 'column',
    'Uma cartela só multiplica as combinações possíveis com menos peças na mala.',
    'styling-principle', 'cápsula de viagem', 0.4),
]

// ──────────────────────────────────────────────────────── CURINGAS / FALLBACK
const UNIVERSAL: OutfitFormula[] = [
  f('universal-top-bottom-shoes', 'Base: cima + baixo + calçado', 'universal',
    ['casual', 'dia-a-dia', 'social', 'trabalho', 'viagem', 'moderno', 'feminino', 'elegante', 'igreja', 'jantar', 'evento', 'festa', 'esporte', 'tenis'],
    ['dia-comum', 'passeio', 'trabalho', 'reuniao', 'almoco', 'jantar', 'evento', 'festa', 'viagem', 'igreja', 'treino', 'partida-tenis'],
    [0, 10],
    [['top', ['tshirt', 'blouse', 'shirt', 'knit', 'polo', 'tank', 'sport_top', 'statement_top']],
     ['bottom', ['tailored_trousers', 'wide_leg_trousers', 'jeans', 'midi_skirt', 'pleated_skirt', 'skirt', 'shorts', 'skort', 'leggings']],
     ['shoes', ['heels', 'flats', 'elegant_shoe', 'loafers', 'sneakers', 'tennis_shoes', 'boots', 'sandals']]],
    [['outerwear', ['blazer', 'cardigan', 'jacket', 'coat', 'windbreaker']], ['accessory', ACC_ELEGANT], ['bag', [...BAG_ELEGANT, 'backpack']]],
    [], 'relaxed',
    'Estrutura mínima de um look completo. É a rede de segurança do Tier 5.',
    'styling-principle', 'estrutura base', 0.2),

  f('universal-dress-shoes', 'Base: vestido + calçado', 'universal',
    ['casual', 'social', 'elegante', 'feminino', 'igreja', 'jantar', 'evento', 'festa', 'moderno', 'dia-a-dia'],
    ['dia-comum', 'passeio', 'almoco', 'jantar', 'evento', 'festa', 'igreja', 'trabalho', 'reuniao'],
    [0, 10],
    [['dress', ['dress', 'midi_dress', 'sport_dress']],
     ['shoes', ['heels', 'flats', 'elegant_shoe', 'loafers', 'sneakers', 'sandals', 'boots', 'tennis_shoes']]],
    [['outerwear', ['blazer', 'cardigan', 'jacket', 'coat']], ['accessory', ACC_ELEGANT], ['bag', BAG_ELEGANT]],
    [], 'relaxed',
    'Vestido cobre cima e baixo de uma vez.',
    'styling-principle', 'estrutura base', 0.2),
]

export const OUTFIT_FORMULAS: OutfitFormula[] = [
  ...WORK, ...CHURCH, ...TENNIS, ...SPORT, ...CASUAL, ...DINNER, ...EVENT, ...TRAVEL, ...UNIVERSAL,
]

export const FORMULA_COUNT = OUTFIT_FORMULAS.length

export function formulasFor(style: string, occasion?: string): OutfitFormula[] {
  return OUTFIT_FORMULAS.filter(
    (f) =>
      f.active &&
      f.style.includes(style as never) &&
      (!occasion || f.occasion.includes(occasion as never)),
  )
}
