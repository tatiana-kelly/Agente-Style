import { outfitFormulaSchema, type OutfitFormula } from '@/schemas/formula'

/**
 * Fórmulas de guarda-roupa cápsula.
 *
 * Vieram de material de consultoria de imagem que a Tatiana trouxe. O que entra
 * aqui é o PRINCÍPIO por trás dos looks — proporção, camada, registro, ponto de
 * cor —, nunca a lista de peças de um look específico nem o texto de origem
 * (§37). Assim a regra vale para qualquer guarda-roupa, e não só para quem tem
 * exatamente aquelas peças.
 *
 * A ideia que sustenta o bloco: poucas peças neutras que conversam entre si
 * rendem semanas de looks quando o que muda é a terceira peça, o calçado e o
 * acessório.
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
  season?: string[],
): OutfitFormula {
  return outfitFormulaSchema.parse({
    id, name, category, style, occasion, formality,
    ...(season ? { season } : {}),
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
const QUENTE = ['verao', 'primavera']

// ─────────────────────────────────────────── TERCEIRA PEÇA SOBRE BASE NEUTRA
const CAPSULE: OutfitFormula[] = [
  f('capsule-blazer-tshirt-jeans-sneakers', 'Blazer + camiseta + jeans + tênis', 'capsule',
    ['casual', 'moderno', 'dia-a-dia', 'viagem', 'trabalho'], ['dia-comum', 'passeio', 'trabalho', 'viagem', 'almoco'], [4, 6],
    [['top', ['tshirt', 'tank']], ['bottom', ['jeans', 'wide_leg_trousers']], ['shoes', ['sneakers', 'loafers']], ['outerwear', ['blazer', 'cardigan']]],
    [['bag', [...BAG_ELEGANT, 'backpack']], ['accessory', [...ACC_ELEGANT, 'sunglasses']]],
    ['NEUTRAL', 'CLASSIC'], 'relaxed',
    'A alfaiataria em cima puxa o jeans para cima; o tênis segura o conjunto no casual.',
    'styling-principle', 'cápsula — terceira peça sobre base básica', 0.2),

  f('capsule-cardigan-jeans-sneakers', 'Casaquinho + jeans + tênis', 'capsule',
    ['casual', 'dia-a-dia', 'feminino', 'viagem'], ['dia-comum', 'passeio', 'viagem', 'almoco'], [3, 5],
    [['top', ['tshirt', 'tank', 'blouse']], ['bottom', ['jeans', 'wide_leg_trousers']], ['shoes', ['sneakers', 'flats']], ['outerwear', ['cardigan', 'jacket']]],
    [['bag', ['tote', 'structured_bag', 'backpack']], ['accessory', ['jewelry', 'sunglasses', 'belt']]],
    ['NEUTRAL', 'TONAL'], 'relaxed',
    'O tricô suaviza o jeans sem pedir formalidade — é a versão macia do blazer.',
    'styling-principle', 'cápsula — terceira peça macia', 0.2),

  f('capsule-blazer-leggings-sneakers', 'Blazer + legging + tênis', 'capsule',
    ['casual', 'moderno', 'viagem', 'dia-a-dia'], ['viagem', 'dia-comum', 'passeio'], [3, 5],
    [['top', ['tank', 'sport_top', 'tshirt']], ['bottom', ['leggings']], ['shoes', ['sneakers']], ['outerwear', ['blazer']]],
    [['bag', ['tote', 'backpack', 'structured_bag']], ['accessory', ['cap', 'sunglasses', 'watch']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'athletic',
    'Conforto de legging com a estrutura do blazer: é o que separa look de viagem de roupa de treino.',
    'styling-principle', 'estrutura sobre peça elástica', 0.45),

  f('capsule-tailoring-sneakers', 'Alfaiataria com tênis', 'capsule',
    ['moderno', 'trabalho', 'casual', 'dia-a-dia'], ['trabalho', 'dia-comum', 'passeio', 'viagem'], [5, 7],
    [['top', ['blouse', 'shirt', 'tshirt', 'tank']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['sneakers']]],
    [['outerwear', ['blazer']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'TONAL', 'MONOCHROMATIC'], 'column',
    'Tênis quebra a formalidade do terninho: o mesmo conjunto passa a servir para o dia comum.',
    'styling-principle', 'quebra de formalidade pelo calçado', 0.4),

  f('capsule-jeans-blazer-heels', 'Jeans + blazer + salto', 'capsule',
    ['social', 'elegante', 'jantar', 'moderno'], ['jantar', 'almoco', 'evento', 'passeio'], [6, 8],
    [['top', ['blouse', 'tank', 'tshirt']], ['bottom', ['jeans']], ['shoes', ['heels', 'elegant_shoe', 'boots']], ['outerwear', ['blazer']]],
    [['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'CLASSIC', 'NEUTRAL_ACCENT'], 'structured',
    'Jeans escuro com salto e blazer atravessa quase todo ambiente que não exige traje formal.',
    'styling-principle', 'jeans elevado por alfaiataria e salto', 0.25),

  f('capsule-all-black-layered', 'All black com terceira peça', 'capsule',
    ['moderno', 'elegante', 'social', 'jantar', 'trabalho'], ['trabalho', 'jantar', 'evento', 'reuniao'], [6, 9],
    [['top', ['tank', 'tshirt', 'knit', 'blouse']], ['bottom', ['tailored_trousers', 'jeans', 'wide_leg_trousers']], ['shoes', ['boots', 'heels', 'loafers', 'sneakers']], ['outerwear', ['blazer', 'jacket']]],
    [['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['MONOCHROMATIC'], 'column',
    'Tudo na mesma cor escura alonga a silhueta; o interesse vem da textura e do acessório.',
    'color-theory', 'monocromático escuro — continuidade vertical', 0.3),

  f('capsule-tonal-neutrals', 'Neutros em camadas tonais', 'capsule',
    ['elegante', 'social', 'trabalho', 'moderno'], ['trabalho', 'almoco', 'reuniao', 'evento'], [6, 8],
    [['top', ['blouse', 'tank', 'knit', 'tshirt']], ['bottom', ['wide_leg_trousers', 'tailored_trousers']], ['shoes', SHOES_ELEGANT], ['outerwear', ['blazer', 'cardigan']]],
    [['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['TONAL', 'NEUTRAL'], 'column',
    'Cru, bege e marrom na mesma família: sofisticação sem depender de cor forte.',
    'color-theory', 'degradê de neutros quentes', 0.35),

  f('capsule-dark-bottom-structured-top', 'Base escura + terceira peça estruturada', 'capsule',
    ['moderno', 'jantar', 'social', 'festa'], ['jantar', 'festa', 'evento', 'passeio'], [6, 8],
    [['top', ['tank', 'tshirt', 'blouse']], ['bottom', ['tailored_trousers', 'jeans', 'leggings']], ['shoes', ['boots', 'heels', 'sneakers', 'loafers']], ['outerwear', ['blazer', 'jacket']]],
    [['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'structured',
    'Baixo escuro com brilho de couro pede corte reto em cima para não pesar.',
    'styling-principle', 'contraste de textura em base escura', 0.5),
]

// ───────────────────────────────────────────────────── COLETE DE ALFAIATARIA
const VEST: OutfitFormula[] = [
  f('vest-tailored-trousers', 'Colete + alfaiataria', 'vest',
    ['moderno', 'trabalho', 'elegante', 'social'], ['trabalho', 'reuniao', 'almoco', 'evento'], [6, 8],
    [['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', SHOES_ELEGANT], ['outerwear', ['vest']]],
    [['top', ['tank', 'blouse', 'shirt']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['MONOCHROMATIC', 'NEUTRAL', 'TONAL'], 'structured',
    'O colete faz o papel da parte de cima e dá ombro ao look — sozinho ou sobre uma regata.',
    'styling-principle', 'colete como peça de estrutura', 0.45),

  f('vest-shorts-heels', 'Colete + short de alfaiataria', 'vest',
    ['moderno', 'feminino', 'elegante', 'jantar'], ['almoco', 'jantar', 'passeio', 'evento'], [5, 7],
    [['bottom', ['shorts']], ['shoes', ['heels', 'elegant_shoe', 'sandals', 'loafers']], ['outerwear', ['vest']]],
    [['top', ['tank']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'structured',
    'Conjunto de alfaiataria com short: elegante no calor, desde que a modelagem seja reta.',
    'styling-principle', 'conjunto colete + short', 0.55, 0, QUENTE),

  f('vest-under-blazer', 'Colete sob blazer', 'vest',
    ['trabalho', 'elegante', 'social', 'moderno'], ['trabalho', 'reuniao', 'evento'], [7, 9],
    [['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', SHOES_ELEGANT], ['outerwear', ['vest', 'blazer']]],
    [['top', ['shirt', 'blouse', 'tank']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'structured',
    'Duas camadas de alfaiataria sobem o registro sem precisar de terno completo.',
    'dress-code', 'camadas de alfaiataria em ambiente formal', 0.5),

  f('vest-jeans-loafers', 'Colete + jeans + mocassim', 'vest',
    ['moderno', 'casual', 'dia-a-dia'], ['dia-comum', 'passeio', 'trabalho'], [4, 6],
    [['bottom', ['jeans', 'wide_leg_trousers']], ['shoes', ['loafers', 'sneakers', 'flats']], ['outerwear', ['vest']]],
    [['top', ['tshirt', 'tank', 'shirt']], ['bag', ['tote', 'structured_bag']], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'CLASSIC'], 'relaxed',
    'Colete sobre jeans é o meio-termo entre camiseta solta e blazer fechado.',
    'styling-principle', 'colete em registro casual', 0.5),

  f('vest-midi-skirt', 'Colete + saia midi', 'vest',
    ['feminino', 'moderno', 'elegante', 'igreja'], ['almoco', 'igreja', 'passeio', 'trabalho'], [5, 7],
    [['bottom', ['midi_skirt', 'pleated_skirt', 'long_skirt']], ['shoes', SHOES_ELEGANT], ['outerwear', ['vest']]],
    [['top', ['blouse', 'tank', 'shirt']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'TONAL'], 'fitted_top_full_bottom',
    'Cima justa e baixo com volume: o colete marca a cintura que a saia solta esconde.',
    'styling-principle', 'proporção justa em cima, ampla embaixo', 0.45, 1),
]

// ───────────────────────────────────────────── CALOR COM COMPOSTURA (VERÃO)
const SUMMER: OutfitFormula[] = [
  f('summer-tailored-shorts-blazer', 'Short de alfaiataria + blazer', 'summer',
    ['moderno', 'elegante', 'social', 'feminino'], ['almoco', 'passeio', 'jantar', 'evento'], [5, 7],
    [['top', ['tank', 'tshirt', 'blouse']], ['bottom', ['shorts']], ['shoes', ['loafers', 'heels', 'sandals', 'flats']], ['outerwear', ['blazer']]],
    [['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'TONAL'], 'structured',
    'Short deixa de ser praia quando a modelagem é de alfaiataria e a terceira peça é séria.',
    'styling-principle', 'short em registro social', 0.5, 0, QUENTE),

  f('summer-shorts-tshirt-sneakers', 'Short + camiseta + tênis', 'summer',
    ['casual', 'dia-a-dia', 'viagem'], ['dia-comum', 'passeio', 'viagem'], [2, 4],
    [['top', ['tshirt', 'tank']], ['bottom', ['shorts']], ['shoes', ['sneakers', 'sandals', 'flats']]],
    [['outerwear', ['denim_jacket', 'jacket', 'cardigan']], ['bag', ['tote', 'backpack']], ['accessory', ['cap', 'sunglasses', 'jewelry']]],
    ['NEUTRAL', 'CLASSIC'], 'relaxed',
    'A dupla mais simples do verão; quem dá o tom é o acessório.',
    'styling-principle', 'base de verão', 0.15, 0, QUENTE),

  f('summer-shirt-shorts-belt', 'Camisa + short + cinto', 'summer',
    ['moderno', 'feminino', 'casual', 'elegante'], ['almoco', 'passeio', 'dia-comum', 'viagem'], [4, 6],
    [['top', ['shirt', 'blouse']], ['bottom', ['shorts']], ['shoes', ['sandals', 'flats', 'loafers', 'sneakers']], ['accessory', ['belt']]],
    [['bag', BAG_ELEGANT], ['accessory', ['jewelry', 'sunglasses']]],
    ['NEUTRAL', 'TONAL'], 'fitted_top_full_bottom',
    'Camisa por dentro e cinto na cintura: o que muda a linha do corpo é onde a peça termina.',
    'styling-principle', 'cintura marcada por cinto', 0.35, 0, QUENTE),

  f('summer-linen-shirt-wide-leg', 'Camisa leve + calça ampla', 'summer',
    ['elegante', 'feminino', 'viagem', 'social', 'igreja'], ['almoco', 'viagem', 'igreja', 'passeio', 'jantar'], [5, 7],
    [['top', ['shirt', 'blouse', 'tank']], ['bottom', ['wide_leg_trousers', 'tailored_trousers']], ['shoes', ['sandals', 'flats', 'loafers', 'heels']]],
    [['bag', BAG_ELEGANT], ['accessory', [...ACC_ELEGANT, 'scarf', 'sunglasses']]],
    ['NEUTRAL', 'TONAL', 'MONOCHROMATIC'], 'column',
    'Tecido fluido em cima e embaixo dá frescor sem perder a linha reta do look.',
    'styling-principle', 'fluidez em coluna para dias quentes', 0.3, 1),

  f('summer-long-skirt-tank', 'Saia longa + regata', 'summer',
    ['feminino', 'casual', 'igreja', 'elegante', 'viagem'], ['passeio', 'igreja', 'almoco', 'viagem', 'dia-comum'], [4, 6],
    [['top', ['tank', 'tshirt', 'blouse']], ['bottom', ['long_skirt', 'midi_skirt']], ['shoes', ['sandals', 'flats', 'sneakers']]],
    [['outerwear', ['denim_jacket', 'cardigan', 'jacket']], ['bag', ['tote', 'structured_bag']], ['accessory', [...ACC_ELEGANT, 'scarf']]],
    ['NEUTRAL', 'TONAL', 'NEUTRAL_ACCENT'], 'fitted_top_full_bottom',
    'Regata ajustada equilibra o volume da saia longa — sem isso o corpo some no tecido.',
    'styling-principle', 'equilíbrio de volume', 0.3, 2),

  f('summer-jumpsuit', 'Macacão ou macaquinho', 'summer',
    ['moderno', 'feminino', 'casual', 'viagem', 'elegante'], ['passeio', 'viagem', 'almoco', 'dia-comum', 'jantar'], [4, 7],
    [['dress', ['jumpsuit', 'dress']], ['shoes', ['sandals', 'flats', 'sneakers', 'heels']]],
    [['outerwear', ['blazer', 'denim_jacket', 'jacket']], ['bag', BAG_ELEGANT], ['accessory', [...ACC_ELEGANT, 'sunglasses']]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'column',
    'Peça única resolve o look inteiro; o cinto é o que define cintura quando a modelagem é reta.',
    'styling-principle', 'peça única de verão', 0.4, 0, QUENTE),

  f('summer-maxi-dress-flats', 'Vestido longo + calçado raso', 'summer',
    ['feminino', 'elegante', 'igreja', 'casual', 'viagem'], ['igreja', 'almoco', 'passeio', 'viagem', 'evento'], [5, 7],
    [['dress', ['long_dress', 'dress', 'midi_dress']], ['shoes', ['sandals', 'flats', 'elegant_shoe']]],
    [['outerwear', ['denim_jacket', 'cardigan', 'blazer']], ['bag', BAG_ELEGANT], ['accessory', [...ACC_ELEGANT, 'scarf']]],
    ['NEUTRAL', 'TONAL', 'ANALOGOUS'], 'column',
    'O comprimento já é o volume do look: calçado raso e acessório discreto bastam.',
    'styling-principle', 'vestido longo em dia quente', 0.3, 2),
]

// ─────────────────────────────────────────────── ACESSÓRIO COMO MULTIPLICADOR
// O mesmo conjunto muda de mensagem quando muda o complemento. Estas fórmulas
// existem para o motor propor a MESMA base com finalização diferente.
const ACCENT: OutfitFormula[] = [
  f('accent-belt-over-layer', 'Cinto por cima da terceira peça', 'accent',
    ['moderno', 'elegante', 'social', 'feminino'], ['trabalho', 'jantar', 'evento', 'almoco'], [6, 8],
    [['bottom', ['tailored_trousers', 'wide_leg_trousers', 'jeans', 'midi_skirt']], ['shoes', SHOES_ELEGANT], ['outerwear', ['blazer', 'vest', 'coat']], ['accessory', ['belt']]],
    [['top', ['tank', 'blouse', 'tshirt']], ['bag', BAG_ELEGANT], ['accessory', ['jewelry']]],
    ['MONOCHROMATIC', 'NEUTRAL'], 'structured',
    'Cinto sobre o blazer cria cintura onde a peça é reta — muda a silhueta sem trocar nada.',
    'styling-principle', 'cintura marcada sobre sobreposição', 0.6),

  f('accent-scarf-neutral-base', 'Base neutra + lenço', 'accent',
    ['feminino', 'elegante', 'moderno', 'viagem', 'igreja'], ['passeio', 'viagem', 'igreja', 'almoco', 'trabalho'], [4, 7],
    [['top', ['blouse', 'shirt', 'tshirt', 'knit', 'tank']], ['bottom', ['tailored_trousers', 'jeans', 'midi_skirt', 'wide_leg_trousers']], ['shoes', SHOES_ELEGANT], ['accessory', ['scarf']]],
    [['outerwear', ['blazer', 'denim_jacket', 'cardigan']], ['bag', BAG_ELEGANT], ['accessory', ['jewelry', 'sunglasses']]],
    ['NEUTRAL_ACCENT', 'NEUTRAL'], 'relaxed',
    'Look todo neutro com um lenço estampado: a cor entra por onde é fácil trocar.',
    'color-theory', 'ponto de cor em base neutra', 0.45),

  f('accent-statement-necklace-basic', 'Peça básica + colar de presença', 'accent',
    ['moderno', 'feminino', 'jantar', 'social', 'festa'], ['jantar', 'festa', 'evento', 'passeio', 'almoco'], [4, 7],
    [['top', ['tshirt', 'tank', 'knit', 'blouse']], ['bottom', ['jeans', 'tailored_trousers', 'midi_skirt', 'wide_leg_trousers']], ['shoes', SHOES_ELEGANT], ['accessory', ['jewelry']]],
    [['outerwear', ['blazer', 'jacket']], ['bag', BAG_ELEGANT]],
    ['NEUTRAL', 'MONOCHROMATIC'], 'relaxed',
    'Camiseta lisa com colar marcante vira produção: o acessório é que carrega o look.',
    'styling-principle', 'acessório de destaque sobre base simples', 0.4),

  f('accent-nude-shoe-lengthen', 'Calçado no tom da pele', 'accent',
    ['elegante', 'social', 'evento', 'feminino', 'festa'], ['evento', 'festa', 'jantar', 'reuniao', 'almoco'], [6, 9],
    [['top', ['blouse', 'tank', 'shirt', 'statement_top']], ['bottom', ['tailored_trousers', 'midi_skirt', 'wide_leg_trousers', 'pleated_skirt']], ['shoes', ['heels', 'elegant_shoe', 'flats']]],
    [['outerwear', ['blazer']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['TONAL', 'NEUTRAL'], 'column',
    'Sapato próximo ao tom da pele continua a perna em vez de cortá-la.',
    'styling-principle', 'continuidade visual da perna', 0.35),
]

// ──────────────────────────────────────────────────────────────────── DENIM
const DENIM: OutfitFormula[] = [
  f('denim-jacket-dress', 'Jaqueta jeans + vestido', 'denim',
    ['casual', 'feminino', 'dia-a-dia', 'moderno'], ['passeio', 'dia-comum', 'almoco', 'viagem'], [3, 5],
    [['dress', ['dress', 'midi_dress', 'long_dress']], ['shoes', ['sneakers', 'sandals', 'boots', 'flats']], ['outerwear', ['denim_jacket', 'jacket']]],
    [['bag', ['tote', 'structured_bag', 'backpack']], ['accessory', [...ACC_ELEGANT, 'sunglasses']]],
    ['CLASSIC', 'NEUTRAL', 'NEUTRAL_ACCENT'], 'relaxed',
    'Jeans por cima tira a formalidade do vestido e o deixa usável de dia.',
    'styling-principle', 'jaqueta jeans como quebra de registro', 0.3),

  f('denim-jacket-tailoring', 'Jaqueta jeans + alfaiataria', 'denim',
    ['moderno', 'casual', 'dia-a-dia', 'trabalho'], ['dia-comum', 'passeio', 'trabalho', 'viagem'], [4, 6],
    [['top', ['blouse', 'tshirt', 'tank', 'shirt']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['loafers', 'sneakers', 'heels', 'flats']], ['outerwear', ['denim_jacket']]],
    [['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['NEUTRAL', 'CLASSIC'], 'relaxed',
    'Mistura proposital: peça casual sobre calça séria deixa o look moderno, não descuidado.',
    'styling-principle', 'mistura de registros', 0.5),

  f('denim-shirt-dress-belt', 'Vestido chemise + cinto', 'denim',
    ['casual', 'dia-a-dia', 'viagem', 'moderno'], ['dia-comum', 'passeio', 'viagem'], [3, 5],
    [['dress', ['dress', 'midi_dress']], ['shoes', ['sneakers', 'sandals', 'boots']]],
    [['accessory', ['belt', 'sunglasses', 'jewelry']], ['bag', ['tote', 'backpack', 'structured_bag']]],
    ['CLASSIC', 'NEUTRAL'], 'relaxed',
    'Vestido de modelagem camisa aceita cinto na cintura e calçado plano sem perder a linha.',
    'styling-principle', 'vestido camisa com cinto', 0.35, 1),
]

// ─────────────────────────────────────────────────── NOITE A PARTIR DA CÁPSULA
const EVENING: OutfitFormula[] = [
  f('evening-fluid-dress-blazer', 'Vestido fluido + blazer', 'evening',
    ['jantar', 'festa', 'elegante', 'social', 'evento'], ['jantar', 'festa', 'evento'], [7, 9],
    [['dress', ['dress', 'midi_dress', 'long_dress']], ['shoes', ['heels', 'elegant_shoe', 'boots']], ['outerwear', ['blazer']]],
    [['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['MONOCHROMATIC', 'NEUTRAL', 'TONAL'], 'column',
    'O blazer cobre o ombro e dá estrutura ao vestido leve — vale do jantar ao evento.',
    'styling-principle', 'estrutura sobre tecido fluido', 0.35, 1),

  f('evening-satin-top-tailoring', 'Blusa de cetim + alfaiataria', 'evening',
    ['jantar', 'elegante', 'social', 'festa', 'evento'], ['jantar', 'evento', 'festa', 'almoco'], [7, 9],
    [['top', ['tank', 'blouse', 'statement_top']], ['bottom', ['tailored_trousers', 'wide_leg_trousers']], ['shoes', ['heels', 'elegant_shoe']]],
    [['outerwear', ['blazer', 'vest']], ['bag', BAG_ELEGANT], ['accessory', ACC_ELEGANT]],
    ['TONAL', 'MONOCHROMATIC', 'NEUTRAL'], 'column',
    'Brilho discreto em cima e corte seco embaixo: noite sem precisar de vestido.',
    'styling-principle', 'contraste de brilho e alfaiataria', 0.4),
]

export const CAPSULE_FORMULAS: OutfitFormula[] = [
  ...CAPSULE, ...VEST, ...SUMMER, ...ACCENT, ...DENIM, ...EVENING,
]
