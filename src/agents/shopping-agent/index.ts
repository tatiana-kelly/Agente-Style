import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'
import type { GarmentArchetype, OutfitFormula, FormulaSlot } from '@/schemas/formula'
import { OUTFIT_FORMULAS } from '@/data/outfit-formulas'
import { archetypesOf } from '@/lib/outfits/archetypes'
import { classificarCor } from '@/lib/outfits/style-dna'

/**
 * Agente de compra — "você já tem essa calça; com uma blusa assim, fica melhor".
 *
 * A pergunta que ele responde não é "o que está na moda?", e sim: qual fórmula
 * das referências dela fica a UMA peça de distância de ser possível com o que
 * ela já tem? Essa peça é a sugestão, e a peça que ela já tem é a âncora — é o
 * que faz a sugestão soar como conselho e não como anúncio.
 */

export interface SugestaoDeCompra {
  /** Peça que ela já tem e que motiva a compra. */
  ancora: WardrobeItem
  /** O que comprar, em português de pessoa. */
  peca: string
  /** O que passa a ser possível. */
  motivo: string
  /** Nome da fórmula que a compra destrava. */
  look: string
  termoDeBusca: string
}

/** Como cada arquétipo se chama para quem vai comprar. */
const NOME_DA_PECA: Partial<Record<GarmentArchetype, string>> = {
  vest: 'um colete de alfaiataria',
  blazer: 'um blazer de corte reto',
  cardigan: 'um casaquinho de tricô',
  jacket: 'uma jaqueta leve',
  denim_jacket: 'uma jaqueta jeans',
  coat: 'um casaco longo',
  midi_skirt: 'uma saia midi',
  long_skirt: 'uma saia longa',
  pleated_skirt: 'uma saia plissada',
  dress: 'um vestido',
  midi_dress: 'um vestido midi',
  long_dress: 'um vestido longo',
  jumpsuit: 'um macacão',
  shorts: 'um short de alfaiataria',
  wide_leg_trousers: 'uma calça pantalona',
  tailored_trousers: 'uma calça de alfaiataria',
  jeans: 'uma calça jeans',
  knit: 'um tricô',
  blouse: 'uma blusa fluida',
  shirt: 'uma camisa',
  tshirt: 'uma camiseta básica',
  tank: 'uma regata de alcinha',
  statement_top: 'uma blusa de cetim',
  heels: 'um scarpin',
  elegant_shoe: 'um sapato fechado',
  loafers: 'um mocassim',
  flats: 'uma sapatilha',
  sneakers: 'um tênis branco',
  boots: 'uma bota de cano curto',
  sandals: 'uma sandália',
  structured_bag: 'uma bolsa estruturada',
  tote: 'uma bolsa sacola',
  belt: 'um cinto',
  jewelry: 'um par de brincos',
  scarf: 'um lenço',
  sunglasses: 'um óculos de sol',
}

const BUSCA: Partial<Record<GarmentArchetype, string>> = {
  vest: 'colete alfaiataria feminino',
  blazer: 'blazer alfaiataria feminino',
  cardigan: 'cardigã tricô feminino',
  denim_jacket: 'jaqueta jeans feminina',
  coat: 'casaco longo feminino',
  midi_skirt: 'saia midi feminina',
  long_skirt: 'saia longa evasê',
  dress: 'vestido feminino',
  midi_dress: 'vestido midi',
  long_dress: 'vestido longo',
  jumpsuit: 'macacão feminino',
  shorts: 'short alfaiataria feminino',
  wide_leg_trousers: 'calça pantalona feminina',
  knit: 'tricô feminino',
  statement_top: 'blusa cetim alcinha',
  heels: 'scarpin feminino',
  loafers: 'mocassim feminino',
  boots: 'bota cano curto feminina',
  sandals: 'sandália feminina',
}

/** A cor sugerida sai da paleta que ela já usa, não de um catálogo. */
function corSugerida(acervo: WardrobeItem[]): string {
  const quentes = acervo.filter((i) => ['bege', 'creme', 'caramelo', 'marrom', 'cru', 'nude'].includes(i.color.toLowerCase()))
  return quentes.length >= acervo.length * 0.2 ? 'caramelo' : 'preto'
}

function temArquetipo(acervo: WardrobeItem[], slot: FormulaSlot): boolean {
  return acervo.some(
    (i) => (i.category as OutfitRole) === slot.role && archetypesOf(i).some((a) => slot.archetypes.includes(a)),
  )
}

/** Peça dela que a fórmula usaria — a âncora da conversa. */
function ancoraPara(acervo: WardrobeItem[], formula: OutfitFormula): WardrobeItem | null {
  const ordem: OutfitRole[] = ['bottom', 'dress', 'outerwear', 'top', 'shoes']
  for (const role of ordem) {
    const slot = formula.required_roles.find((s) => s.role === role)
    if (!slot) continue
    const candidatas = acervo.filter(
      (i) => (i.category as OutfitRole) === role && archetypesOf(i).some((a) => slot.archetypes.includes(a)),
    )
    // Peça neutra é a melhor âncora: é a que aceita mais combinações.
    const neutra = candidatas.find((i) => classificarCor(i.color) === 'neutro')
    if (neutra ?? candidatas[0]) return neutra ?? candidatas[0]
  }
  return null
}

/**
 * Sugestões de compra, das que destravam mais look para as que destravam menos.
 * Devolve no máximo `limite`, uma por tipo de peça.
 */
export function runShoppingAgent(
  acervo: WardrobeItem[],
  limite = 3,
  formulas: OutfitFormula[] = OUTFIT_FORMULAS,
): SugestaoDeCompra[] {
  const ativos = acervo.filter((i) => i.active !== false)
  if (ativos.length === 0) return []

  const cor = corSugerida(ativos)
  const candidatas = new Map<GarmentArchetype, { sugestao: SugestaoDeCompra; destrava: number }>()

  for (const formula of formulas) {
    if (formula.source_type !== 'style-reference') continue

    const faltando = formula.required_roles.filter((slot) => !temArquetipo(ativos, slot))
    // Fórmula a UMA peça de distância: é a compra que rende de imediato.
    if (faltando.length !== 1) continue

    const slot = faltando[0]
    const arquetipo = slot.archetypes.find((a) => NOME_DA_PECA[a]) ?? slot.archetypes[0]
    const ancora = ancoraPara(ativos, formula)
    if (!ancora) continue

    const nome = NOME_DA_PECA[arquetipo] ?? 'uma peça'
    const existente = candidatas.get(arquetipo)
    if (existente) {
      existente.destrava += 1
      continue
    }

    candidatas.set(arquetipo, {
      destrava: 1,
      sugestao: {
        ancora,
        peca: `${nome} ${cor}`,
        motivo: `Você já tem ${ancora.name.toLowerCase()}. Com ${nome}, dá para montar "${formula.name}".`,
        look: formula.name,
        termoDeBusca: `${BUSCA[arquetipo] ?? nome} ${cor}`,
      },
    })
  }

  return [...candidatas.values()]
    .sort((a, b) => b.destrava - a.destrava)
    .slice(0, limite)
    .map((c) => ({
      ...c.sugestao,
      motivo:
        c.destrava > 1
          ? `${c.sugestao.motivo} E mais ${c.destrava - 1} ${c.destrava === 2 ? 'look' : 'looks'} das suas referências.`
          : c.sugestao.motivo,
    }))
}
