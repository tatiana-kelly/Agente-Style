import type { WardrobeItem } from '@/schemas/wardrobe'
import type { NoveltyLevel, OutfitRole, Style } from '@/schemas/outfit'
import type { OutfitFormula, FormulaSlot } from '@/schemas/formula'
import { OUTFIT_FORMULAS } from '@/data/outfit-formulas'
import { matchesSlot, slotAffinity } from './archetypes'
import { avaliarCoerencia, nucleoDoLook, penalidadeRepeticao, MAX_ACESSORIOS } from './coherence'
import { classificarCor, corDaEstacao } from './style-dna'
import { normalizeColor } from '@/lib/wardrobe/colors'
import { afinidadeComReferencias, avaliarPaleta } from './style-dna'
import { comparavel, limitarPorFormula, selecionarDiversos } from './diversity'
import { analyzePalette, colorCompatibility, colorRelation, type PaletteAnalysis } from './color-engine'
import { ruleFor } from '@/lib/wardrobe/style-rules'

/**
 * OUTFIT INTELLIGENCE ENGINE
 *
 * Substitui a montagem anterior, que enumerava peças por papel e, quando um papel
 * obrigatório ficava sem candidato, simplesmente o descartava — devolvendo "looks"
 * sem parte de baixo. Aqui o papel obrigatório nunca some: o que cede é o rigor do
 * filtro, em camadas, até a peça aparecer.
 */

export interface EngineContext {
  style: Style
  occasion?: string
  season?: string
  /** Clima do dia: decide fórmula, camada e calçado. */
  clima?: 'calor' | 'ameno' | 'frio'
  /**
   * Semente da geração. Duas chamadas com sementes diferentes exploram partes
   * diferentes do guarda-roupa — é o que faz "Montar meu look" duas vezes
   * seguidas devolver coisas diferentes em vez do mesmo trio.
   */
  semente?: number
  /**
   * Peças que a pessoa pediu com todas as letras ("inclua o blazer").
   * Pedido explícito vence o clima; travar o resto do look para não sortear
   * tudo de novo, não.
   */
  lockedExplicitIds?: string[]
  formalityOverride?: [number, number]
  favoriteColors: string[]
  avoidColors: string[]
  preferredArchetypes: string[]
  /** 0 = sem exigência, 3 = máxima cobertura. */
  modestyLevel: number
  /** id da peça → peso -1..1 aprendido do feedback. */
  preferenceWeights: Record<string, number>
  lockedItemIds: string[]
  excludeIds: string[]
  novelty: NoveltyLevel
  /** Assinaturas de looks recentes, para não repetir (§17). */
  recentSignatures: string[]
  recentItemIds: string[]
  recentFormulaIds: string[]
}

export interface CandidateScores {
  formula_match: number
  color_match: number
  style_match: number
  occasion_match: number
  formality_match: number
  wardrobe_match: number
  user_preference_match: number
  novelty: number
  total: number
}

export interface OutfitCandidate {
  formula: OutfitFormula
  items: Array<{ item: WardrobeItem; role: OutfitRole; slotAffinity: number }>
  scores: CandidateScores
  palette: PaletteAnalysis
  /** Em qual camada de fallback este candidato foi encontrado (1 = ideal). */
  tier: number
  /** Papéis que a fórmula pedia e o guarda-roupa não tem de jeito nenhum. */
  unmetRoles: OutfitRole[]
}

const NOVELTY_TARGET: Record<NoveltyLevel, number> = {
  classico: 0.15,
  equilibrado: 0.4,
  ousado: 0.75,
}

/** Quanto cada camada relaxa o filtro de formalidade. */
const TIER_TOLERANCE = [0, 1, 2, 4, 10]

// ───────────────────────────────────────────────────────────── elegibilidade

function isUsable(item: WardrobeItem, ctx: EngineContext, tier: number): boolean {
  if (!item.active) return false
  if (ctx.excludeIds.includes(item.id)) return false

  const rule = ruleFor(ctx.style)
  const tolerance = TIER_TOLERANCE[Math.min(tier, TIER_TOLERANCE.length) - 1] ?? 10
  const [min, max] = ctx.formalityOverride ?? rule.formality

  if (item.formality < min - tolerance || item.formality > max + tolerance) return false

  // Proibição por estilo cede a partir do Tier 3, exceto funcional (§5).
  if (tier <= 2 && rule.forbiddenSubcategories.includes(item.subcategory)) return false

  // Funcionalidade esportiva nunca cede: salto não vai para a quadra, em nenhum tier.
  if ((ctx.style === 'tenis' || ctx.style === 'esporte') && item.formality >= 6) return false

  // Roupa de esporte é equipamento: top de treino, skort de quadra, raqueteira
  // e tênis técnico não terminam look de passeio. 'geral' fica de fora da
  // regra — é o tênis branco do dia a dia, que as referências usam em tudo.
  const ESPORTES_ESPECIFICOS = ['tenis', 'corrida', 'academia', 'yoga']
  const equipamento =
    ESPORTES_ESPECIFICOS.includes(item.sport_type) ||
    ['raqueteira', 'viseira', 'tenis-tenis', 'tenis-corrida'].includes(item.subcategory)
  const contextoEsportivo =
    ctx.style === 'tenis' || ctx.style === 'esporte' ||
    ctx.occasion === 'partida-tenis' || ctx.occasion === 'treino'
  if (equipamento && !contextoEsportivo) return false

  // Modéstia é pedido explícito do usuário; só cede se ele baixar o nível.
  if (ctx.modestyLevel >= 2 && ['shorts', 'top-esportivo', 'regata'].includes(item.subcategory)) {
    return false
  }
  return true
}

// ───────────────────────────────────────────────────────── seleção por slot

interface SlotPick {
  item: WardrobeItem
  affinity: number
}

/**
 * Quanto esta peça serve à COR que a fórmula pede e ao que já está escolhido.
 *
 * Sem isto, todas as camisas empatavam em afinidade e o desempate virava a
 * ordem do banco: "All Black" nunca via a camisa preta, e "Neutros
 * Sofisticados" saía com camisa verde. Nas referências a cor é a decisão do
 * look, não o critério de desempate.
 */
function valorDeCor(
  item: WardrobeItem,
  formula: OutfitFormula,
  jaEscolhidas: Array<{ item: WardrobeItem }>,
): number {
  let valor = 0

  if (formula.palette_lock === 'black') {
    valor += normalizeColor(item.color) === 'preto' ? 0.6 : -0.6
  } else if (formula.palette_lock === 'monochrome' && jaEscolhidas.length > 0) {
    const relacao = colorRelation(jaEscolhidas[0].item.color, item.color)
    valor += relacao === 'MONOCHROMATIC' || relacao === 'TONAL' ? 0.5 : -0.5
  }

  if (jaEscolhidas.length > 0) {
    const media =
      jaEscolhidas.reduce((s, p) => s + colorCompatibility(p.item.color, item.color), 0) /
      jaEscolhidas.length
    valor += (media / 3) * 0.25
  }

  // Base neutra é o que sustenta as referências dela.
  if (classificarCor(item.color) === 'neutro') valor += 0.15

  // Peça da estação corrente ganha um empurrão — sem virar filtro, senão
  // guarda-roupa pequeno trava.
  if (ctxSeasonBonus(item)) valor += 0.05
  // E a cartela de cor da estação, que é o que as pranchas destacam.
  if (corDaEstacao(item.color, estacaoAtual)) valor += 0.08

  return valor
}

/** Ruído estável: mesmo id + mesma semente dão sempre o mesmo valor, em 0..1. */
function ruido(id: string, semente: number): number {
  let h = semente | 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0) % 1000003
  return (h % 1000) / 1000
}

let estacaoAtual: string | undefined
function ctxSeasonBonus(item: WardrobeItem): boolean {
  return Boolean(estacaoAtual && item.season.includes(estacaoAtual as never))
}

function candidatesForSlot(
  items: WardrobeItem[],
  slot: FormulaSlot,
  ctx: EngineContext,
  tier: number,
  used: Set<string>,
  formula?: OutfitFormula,
  jaEscolhidas: Array<{ item: WardrobeItem }> = [],
): SlotPick[] {
  const picks: SlotPick[] = []
  estacaoAtual = ctx.season

  for (const item of items) {
    if (used.has(item.id)) continue
    if ((item.category as OutfitRole) !== slot.role) continue
    if (!isUsable(item, ctx, tier)) continue
    // Peça que briga com o clima não entra nem como opcional.
    if (!pecaCombinaComClima(item, ctx.clima) && !(ctx.lockedExplicitIds ?? []).includes(item.id)) continue

    const affinity = slotAffinity(item, slot.archetypes)
    // Tier 1 e 2 exigem o arquétipo; a partir do Tier 3 qualquer peça do papel serve.
    if (affinity === 0 && tier <= 2) continue
    if (affinity === 0 && !matchesSlot(item, slot.archetypes) && tier <= 2) continue

    picks.push({ item, affinity: affinity || 0.25 })
  }

  const nota = (p: SlotPick) =>
    p.affinity -
    penalidadeRepeticao(p.item, ctx.recentItemIds) +
    (formula ? valorDeCor(p.item, formula, jaEscolhidas) : 0) +
    // Empate é a regra, não a exceção: com 22 calças elegíveis, dezenas
    // empatam em afinidade e cor. Sem este desempate a ordem é sempre a
    // mesma e o app parece ter cinco peças. A semente muda a cada geração,
    // então "Montar meu look" de novo explora outro canto do armário.
    ruido(p.item.id, ctx.semente ?? 0) * 0.12

  // Enxergar mais peças por papel: com 5, o motor decidia entre as mesmas
  // cinco calças do guarda-roupa inteiro.
  const limite = formula?.palette_lock ? 14 : 10

  return picks.sort((a, b) => nota(b) - nota(a)).slice(0, limite)
}

// ─────────────────────────────────────────────────────────────── construção

function buildFromFormula(
  items: WardrobeItem[],
  formula: OutfitFormula,
  ctx: EngineContext,
  tier: number,
  rolesPresent: Set<OutfitRole>,
): OutfitCandidate[] {
  // Travada por conveniência (botão "Trocar") ainda passa pelo clima; travada
  // porque ela pediu, não. Sem isto, o blazer do look anterior voltava sozinho
  // depois de ela mudar o clima para calor.
  const explicitas = new Set(ctx.lockedExplicitIds ?? [])
  const locked = items.filter(
    (i) =>
      ctx.lockedItemIds.includes(i.id) &&
      (explicitas.has(i.id) || pecaCombinaComClima(i, ctx.clima)),
  )
  const lockedByRole = new Map(locked.map((i) => [i.category as OutfitRole, i]))

  let partials: Array<{ picks: Array<{ item: WardrobeItem; role: OutfitRole; slotAffinity: number }>; used: Set<string> }> = [
    { picks: [], used: new Set() },
  ]
  const unmetRoles: OutfitRole[] = []

  for (const slot of formula.required_roles) {
    const lockedItem = lockedByRole.get(slot.role)
    const next: typeof partials = []

    for (const partial of partials) {
      const options = lockedItem
        ? [{ item: lockedItem, affinity: 1 }]
        : candidatesForSlot(items, slot, ctx, tier, partial.used, formula, partial.picks)

      if (options.length === 0) {
        // Duas causas diferentes, tratadas de forma diferente — era aqui que
        // o motor antigo errava, tratando as duas como "descarta o papel":
        //
        // (a) o guarda-roupa TEM peças desse papel e o filtro as cortou.
        //     Isso é problema meu, não do usuário: aborta e deixa o tier
        //     seguinte tentar com o filtro mais frouxo.
        // (b) o guarda-roupa não tem NENHUMA peça desse papel.
        //     Aí não há filtro que resolva: aceita incompleto e reporta.
        if (rolesPresent.has(slot.role)) return []

        if (!unmetRoles.includes(slot.role)) unmetRoles.push(slot.role)
        next.push(partial)
        continue
      }

      // Fórmula de paleta testa mais alternativas: é nela que a cor decide.
      for (const option of options.slice(0, formula.palette_lock ? 6 : 4)) {
        const used = new Set(partial.used)
        used.add(option.item.id)
        next.push({
          picks: [...partial.picks, { item: option.item, role: slot.role, slotAffinity: option.affinity }],
          used,
        })
      }
    }
    partials = next.slice(0, 60)
  }

  // Um candidato só vale se cobriu todos os papéis obrigatórios que o
  // guarda-roupa é capaz de cobrir, E se veste a pessoa.
  const complete = partials.filter(
    (p) => p.picks.length === formula.required_roles.length - unmetRoles.length && coversBody(p.picks),
  )
  if (complete.length === 0) return []

  // Look montado ainda não é look bom: aqui entram as regras de composição.
  // Reprovar tudo neste tier é de propósito — o tier seguinte afrouxa, e vale
  // mais tentar de novo do que entregar blusa social com tênis.
  //
  // Os portões rodam sobre o look COMPLETO, com terceira peça e acabamento:
  // antes eles olhavam só os papéis obrigatórios, e um "All Black" podia
  // ganhar blazer branco depois de aprovado.
  const exigeSobreposicao = formula.required_roles.some((sl) => sl.role === 'outerwear')

  // Com e sem terceira peça viram candidatos SEPARADOS.
  //
  // Garantir a terceira peça sempre fez todo look sair com blazer — e aí as
  // três opções voltaram a ter a mesma estrutura. Oferecendo as duas versões,
  // quem decide é o ranking (que prefere o look completo) e a diversidade
  // (que prefere estruturas diferentes entre as opções).
  const montados = complete.flatMap((p) => {
    const completo = garantirTravadas(
      addOptional(p.picks, items, formula, ctx, tier, p.used),
      locked,
    )
    const variantes = [completo]

    // A versão sem terceira peça não pode descartar o que ela travou.
    const travadas = new Set(locked.map((i) => i.id))
    const terceiraTravada = completo.some((x) => x.role === 'outerwear' && travadas.has(x.item.id))
    if (!exigeSobreposicao && !terceiraTravada && completo.some((x) => x.role === 'outerwear')) {
      const semTerceira = completo.filter((x) => x.role !== 'outerwear')
      if (coversBody(semTerceira)) variantes.push(semTerceira)
    }

    return variantes.map((withExtras) => ({ ...p, withExtras }))
  })

  const coerentes = montados.filter(
    ({ withExtras }) =>
      avaliarCoerencia(withExtras, { tier, formula, clima: ctx.clima }).length === 0 &&
      paletaDaFormulaOk(withExtras, formula, tier) &&
      (tier >= 4 || avaliarPaleta(withExtras).aprovada) &&
      travaDeCorOk(withExtras, formula) &&
      climaOk(withExtras, ctx.clima, tier, explicitas),
  )
  if (coerentes.length === 0) return []

  return coerentes.map((p) => {
    const withExtras = p.withExtras
    const palette = analyzePalette(
      withExtras.filter((x) => !['accessory', 'bag'].includes(x.role)).map((x) => x.item.color),
    )
    return {
      formula,
      items: withExtras,
      palette,
      tier,
      unmetRoles: [...unmetRoles],
      scores: score(withExtras, formula, palette, ctx, tier, unmetRoles.length),
    }
  })
}

/**
 * Acessório e bolsa estão desligados a pedido dela: o que está cadastrado
 * nesses papéis veio junto das fotos em lote e não é o acervo real. Volta a
 * ligar quando ela cadastrar os acessórios de verdade — é só trocar para true.
 */
const ACABAMENTO_ATIVO = false

/** Quantas peças cada papel opcional pode contribuir. */
const MAX_POR_PAPEL: Partial<Record<OutfitRole, number>> = {
  accessory: MAX_ACESSORIOS,
  bag: 1,
  outerwear: 1,
}

/**
 * Slot padrão de acessório, usado quando a fórmula não declara nenhum.
 * Um look completo tem acessório; a fórmula descreve a base, não o acabamento.
 */
const ACESSORIO_PADRAO: FormulaSlot = {
  role: 'accessory',
  archetypes: ['jewelry', 'watch', 'belt', 'sunglasses', 'visor', 'cap'],
}

/**
 * Terceira peça por padrão.
 *
 * As referências são inequívocas: é a terceira peça que separa roupa de look.
 * Antes o motor garantia acessório e bolsa por padrão, mas não ela — a
 * prioridade estava invertida, e 6 em cada 10 looks saíam sem camada nenhuma.
 */
const SOBREPOSICAO_PADRAO: FormulaSlot = {
  role: 'outerwear',
  archetypes: ['blazer', 'vest', 'cardigan', 'jacket', 'denim_jacket', 'coat'],
}

/** Mesmo raciocínio para bolsa: quase todo look sai de casa com uma. */
const BOLSA_PADRAO: FormulaSlot = {
  role: 'bag',
  archetypes: ['structured_bag', 'tote', 'backpack', 'tennis_bag'],
}

function addOptional(
  base: Array<{ item: WardrobeItem; role: OutfitRole; slotAffinity: number }>,
  items: WardrobeItem[],
  formula: OutfitFormula,
  ctx: EngineContext,
  tier: number,
  used: Set<string>,
): Array<{ item: WardrobeItem; role: OutfitRole; slotAffinity: number }> {
  const result = [...base]
  const taken = new Set(used)

  const slots = [...formula.optional_roles]
  // Estrutura antes do acabamento: a terceira peça é o que separa roupa de
  // look, e era a única que não tinha slot padrão. No calor, `candidatesForSlot`
  // já barra tudo que não seja colete.
  const temSobreposicao =
    base.some((p) => p.role === 'outerwear') ||
    formula.required_roles.some((sl) => sl.role === 'outerwear')
  if (!temSobreposicao && !slots.some((sl) => sl.role === 'outerwear')) {
    slots.unshift(SOBREPOSICAO_PADRAO)
  }
  // Sem acessório na fórmula, usa o padrão: a pessoa quer o look terminado.
  if (ACABAMENTO_ATIVO) {
    if (!slots.some((s) => s.role === 'accessory')) slots.push(ACESSORIO_PADRAO)
    if (!slots.some((s) => s.role === 'bag')) slots.push(BOLSA_PADRAO)
  }

  for (const slot of slots) {
    if (!ACABAMENTO_ATIVO && (slot.role === 'accessory' || slot.role === 'bag')) continue

    // Um acessório termina o look; o segundo só quando a fórmula pede — e
    // ainda assim precisa acrescentar algo, não repetir o primeiro.
    const formulaPedeAcessorio = formula.optional_roles.some((s) => s.role === 'accessory')
    const limite =
      slot.role === 'accessory' ? (formulaPedeAcessorio ? MAX_ACESSORIOS : 1) : (MAX_POR_PAPEL[slot.role] ?? 1)
    const familiasUsadas = new Set<string>()
    let adicionados = 0

    const ordenados = candidatesForSlot(items, slot, ctx, tier, taken)
      .map((p) => {
        const harmony = Math.min(...result.map((r) => colorCompatibility(r.item.color, p.item.color)))
        const value = p.affinity * 0.45 + (harmony / 3) * 0.55 - penalidadeRepeticao(p.item, ctx.recentItemIds)
        return { ...p, value }
      })
      .sort((a, b) => b.value - a.value)

    for (const candidato of ordenados) {
      if (adicionados >= limite) break
      // Acabamento precisa merecer o lugar: com limiar baixo, todo acessório
      // neutro entrava e os três looks saíam com o mesmo par dourado.
      if (candidato.value < 0.6) continue
      // Não empilhar três colares: uma peça por família de acessório.
      const familia = familiaDoAcessorio(candidato.item.subcategory)
      if (familiasUsadas.has(familia)) continue
      // O segundo acessório tem de somar: família E cor diferentes do primeiro.
      if (slot.role === 'accessory' && adicionados > 0) {
        const jaTem = result.filter((r) => r.role === 'accessory')
        if (jaTem.some((r) => normalizeColor(r.item.color) === normalizeColor(candidato.item.color))) continue
      }

      result.push({ item: candidato.item, role: slot.role, slotAffinity: candidato.affinity })
      taken.add(candidato.item.id)
      familiasUsadas.add(familia)
      adicionados++
    }
  }
  return result
}

/**
 * Peça travada pela pessoa entra sempre.
 *
 * `addOptional` só olha os slots da fórmula, então um blazer pedido à mão ficava
 * de fora quando a fórmula não previa sobreposição — e "inclua blazer" não
 * incluía blazer nenhum. Pedido explícito vence a fórmula.
 */
function garantirTravadas(
  picks: Array<{ item: WardrobeItem; role: OutfitRole; slotAffinity: number }>,
  locked: WardrobeItem[],
): Array<{ item: WardrobeItem; role: OutfitRole; slotAffinity: number }> {
  const presentes = new Set(picks.map((p) => p.item.id))
  const faltando = locked.filter((l) => !presentes.has(l.id))
  if (faltando.length === 0) return picks

  return [
    ...picks,
    ...faltando.map((item) => ({ item, role: item.category as OutfitRole, slotAffinity: 1 })),
  ]
}

/** Agrupa acessórios que ocupam o mesmo lugar no corpo. */
function familiaDoAcessorio(subcategoria: string): string {
  if (['joia', 'bijuteria', 'colar', 'lenco'].includes(subcategoria)) return 'pescoco'
  if (['brinco'].includes(subcategoria)) return 'orelha'
  if (['anel', 'pulseira', 'relogio'].includes(subcategoria)) return 'maos'
  if (['bone', 'viseira', 'chapeu'].includes(subcategoria)) return 'cabeca'
  return subcategoria
}

/**
 * Fórmula que declara padrão de cor precisa cumpri-lo.
 *
 * `color_patterns` era só bônus no ranking: "Neutros Sofisticados" saía com
 * camisa verde. Em tier 1 e 2 vira porteiro; depois volta a ser preferência,
 * porque rede de segurança não pode recusar look completo.
 */
function paletaDaFormulaOk(
  picks: Array<{ item: WardrobeItem; role: OutfitRole }>,
  formula: OutfitFormula,
  tier: number,
): boolean {
  if (tier > 2 || formula.color_patterns.length === 0) return true
  const paleta = analyzePalette(
    picks.filter((p) => !['accessory', 'bag'].includes(p.role)).map((p) => p.item.color),
  )
  return formula.color_patterns.includes(paleta.dominant)
}

/**
 * A fórmula que promete uma paleta precisa entregá-la. Sem isto o motor
 * chamava de "All Black" um look com camisa branca e sapato bege.
 */
function travaDeCorOk(
  picks: Array<{ item: WardrobeItem; role: OutfitRole }>,
  formula: OutfitFormula,
): boolean {
  if (!formula.palette_lock) return true

  const nucleo = picks.filter((p) => ['top', 'bottom', 'dress', 'outerwear', 'shoes'].includes(p.role))
  if (nucleo.length === 0) return false

  if (formula.palette_lock === 'black') {
    return nucleo.every((p) => normalizeColor(p.item.color) === 'preto')
  }
  // Monocromático aceita tons vizinhos, não "tudo neutro": branco com preto
  // são os dois neutros e não formam tom sobre tom.
  for (let i = 0; i < nucleo.length; i++) {
    for (let j = i + 1; j < nucleo.length; j++) {
      const relacao = colorRelation(nucleo[i].item.color, nucleo[j].item.color)
      if (relacao !== 'MONOCHROMATIC' && relacao !== 'TONAL') return false
    }
  }
  return true
}

/**
 * Clima não é detalhe: casaco em 35 graus e regata em dia frio são erros que
 * derrubam o look inteiro, por mais bonito que ele seja na tela.
 */
const PESADAS = ['casaco', 'sueter', 'corta-vento', 'bota']
const DE_CALOR = ['shorts', 'bermuda', 'top-esportivo', 'regata']
/** Colete é sobreposição sem manga: é a única que sobrevive ao calor. */
const SOBREPOSICAO_DE_CALOR = ['colete']

/**
 * A peça, sozinha, combina com o clima?
 *
 * Esta pergunta não depende de fórmula nem de tier: casaco em 35 graus está
 * errado mesmo quando o motor está na rede de segurança. Por isso ela vale
 * SEMPRE — ao contrário da regra de camadas, que é de composição.
 */
export function pecaCombinaComClima(item: WardrobeItem, clima: EngineContext['clima']): boolean {
  if (!clima) return true
  if (clima === 'calor') {
    if (PESADAS.includes(item.subcategory)) return false
    // Sobreposição no calor, só colete — sem manga.
    return item.category !== 'outerwear' || SOBREPOSICAO_DE_CALOR.includes(item.subcategory)
  }
  if (clima === 'frio') return !['chinelo', 'sandalia'].includes(item.subcategory)
  return true
}

function climaOk(
  picks: Array<{ item: WardrobeItem; role: OutfitRole }>,
  clima: EngineContext['clima'],
  tier: number,
  /** O que ela pediu com todas as letras não é julgado pelo clima. */
  explicitas: ReadonlySet<string> = new Set(),
): boolean {
  if (!clima) return true

  // Peça a peça: vale em todos os tiers. Antes o tier 4 desligava o clima
  // inteiro, e guarda-roupa pequeno recebia bota em dia de calor.
  if (picks.some((p) => !explicitas.has(p.item.id) && !pecaCombinaComClima(p.item, clima))) {
    return false
  }

  // Regra de composição: essa sim cede na rede de segurança, porque é melhor
  // um look sem camada do que nenhuma resposta.
  if (clima === 'frio' && tier < 4) {
    const temCamada = picks.some((p) => p.role === 'outerwear')
    const temPecaDeCalor = picks.some((p) => DE_CALOR.includes(p.item.subcategory))
    if (temPecaDeCalor && !temCamada) return false
  }
  return true
}

// ────────────────────────────────────────────────────────────────── ranking

function score(
  picks: Array<{ item: WardrobeItem; role: OutfitRole; slotAffinity: number }>,
  formula: OutfitFormula,
  palette: PaletteAnalysis,
  ctx: EngineContext,
  tier: number,
  unmet: number,
): CandidateScores {
  const items = picks.map((p) => p.item)
  const rule = ruleFor(ctx.style)

  const formula_match = clamp01(
    (picks.reduce((s, p) => s + p.slotAffinity, 0) / Math.max(picks.length, 1)) * (1 - (tier - 1) * 0.12),
  )

  // Cor: paleta do look + o quanto ela repete a linguagem das referências.
  // Sem esta segunda parte, "tecnicamente compatível" ganhava de "bonito".
  const patternBonus = formula.color_patterns.includes(palette.dominant) ? 0.12 : 0
  const dna = avaliarPaleta(picks)
  const color_match = clamp01(
    (palette.score + patternBonus) * 0.35 + dna.nota * 0.45 + afinidadeComReferencias(picks) * 0.2,
  )

  // Formalidade se mede na roupa, não no acessório: a bijuteria f6 fazia um
  // look básico parecer incoerente e entregava a vitória a outro look.
  const nucleo = nucleoDoLook(picks).map((p) => p.item)
  const base = nucleo.length > 0 ? nucleo : items
  const avgFormality = base.reduce((s, i) => s + i.formality, 0) / Math.max(base.length, 1)
  const spread = base.length > 1 ? Math.max(...base.map((i) => i.formality)) - Math.min(...base.map((i) => i.formality)) : 0
  const [fmin, fmax] = ctx.formalityOverride ?? formula.formality
  const target = (fmin + fmax) / 2
  const formality_match = clamp01(1 - Math.abs(avgFormality - target) / 5) * clamp01(1 - spread / 9)

  // Style gate: a fórmula que veio das referências dela vale mais que uma
  // fórmula genérica igualmente aplicável.
  const bonusReferencia = formula.source_type === 'style-reference' ? 0.35 : 0
  const style_match = clamp01(
    bonusReferencia +
    (formula.style.includes(ctx.style) ? 0.6 : 0.25) +
      (items.filter((i) => rule.preferredSubcategories[i.category as OutfitRole]?.includes(i.subcategory)).length /
        Math.max(items.length, 1)) *
        0.4,
  )

  const occasion_match = ctx.occasion
    ? clamp01(
        (formula.occasion.includes(ctx.occasion as never) ? 0.5 : 0.2) +
          (items.filter((i) => i.occasion.includes(ctx.occasion as never)).length / Math.max(items.length, 1)) * 0.5,
      )
    : 0.75

  const wardrobe_match = clamp01(1 - unmet * 0.5)

  let pref = 0.5
  for (const item of items) {
    pref += (ctx.preferenceWeights[item.id] ?? 0) * 0.12
    if (ctx.favoriteColors.some((c) => sameColor(c, item.color))) pref += 0.06
    if (ctx.avoidColors.some((c) => sameColor(c, item.color))) pref -= 0.2
  }
  const user_preference_match = clamp01(pref)

  // Novidade: distância do que o usuário acabou de usar, somada à da fórmula.
  const repeatedItems = items.filter((i) => ctx.recentItemIds.includes(i.id)).length
  const repeatedFormula = ctx.recentFormulaIds.includes(formula.id) ? 1 : 0
  const freshness = clamp01(1 - repeatedItems / Math.max(items.length, 1) * 0.7 - repeatedFormula * 0.3)
  const noveltyRaw = clamp01(formula.novelty * 0.5 + freshness * 0.5)
  // Quanto mais perto do apetite escolhido, melhor — não "quanto maior, melhor".
  const novelty = clamp01(1 - Math.abs(noveltyRaw - NOVELTY_TARGET[ctx.novelty]) * 1.6)

  const total = clamp01(
    formula_match * 0.22 +
      color_match * 0.18 +
      style_match * 0.14 +
      occasion_match * 0.11 +
      formality_match * 0.15 +
      wardrobe_match * 0.09 +
      user_preference_match * 0.06 +
      novelty * 0.05,
  )

  return {
    formula_match: r(formula_match),
    color_match: r(color_match),
    style_match: r(style_match),
    occasion_match: r(occasion_match),
    formality_match: r(formality_match),
    wardrobe_match: r(wardrobe_match),
    user_preference_match: r(user_preference_match),
    novelty: r(novelty),
    total: r(total),
  }
}

// ───────────────────────────────────────────────────────────────── busca

export interface GenerateResult {
  candidates: OutfitCandidate[]
  /** Em qual camada a busca conseguiu resolver. */
  tierUsed: number
  /** Papéis que o guarda-roupa simplesmente não cobre. */
  missingRoles: OutfitRole[]
  /** Quantas fórmulas foram testadas. */
  formulasTried: number
}

/**
 * Busca em camadas (§27). Só desce de camada se a de cima não produziu nada:
 * o usuário recebe a melhor resposta possível, nunca "não foi possível".
 */
export function generateCandidates(
  items: WardrobeItem[],
  ctx: EngineContext,
  count = 3,
): GenerateResult {
  const pool = items.filter((i) => i.active)
  const rolesPresent = new Set(pool.map((i) => i.category as OutfitRole))

  const climaOkFormula = (f: OutfitFormula) => !ctx.clima || f.weather.includes(ctx.clima)

  const byStyleAndOccasion = OUTFIT_FORMULAS.filter(
    (f) =>
      f.active && climaOkFormula(f) && f.style.includes(ctx.style) &&
      (!ctx.occasion || f.occasion.includes(ctx.occasion as never)),
  )
  const byStyle = OUTFIT_FORMULAS.filter((f) => f.active && climaOkFormula(f) && f.style.includes(ctx.style))
  const universal = OUTFIT_FORMULAS.filter((f) => f.category === 'universal')

  const ladder: Array<{ tier: number; formulas: OutfitFormula[] }> = [
    { tier: 1, formulas: byStyleAndOccasion },
    { tier: 2, formulas: byStyle },
    // A curinga fica fora dos tiers bons: ela aceita qualquer coisa e estava
    // competindo — e ganhando — de fórmula de referência no tier 1.
    { tier: 3, formulas: byStyle },
    { tier: 4, formulas: universal },
    { tier: 5, formulas: universal },
  ]

  let formulasTried = 0

  for (const step of ladder) {
    const found: OutfitCandidate[] = []
    // Fórmula com modéstia menor que a exigida não serve.
    const usable = step.formulas.filter((f) => f.modesty_min <= 3 && ctx.modestyLevel <= 1 ? true : f.modesty_min >= Math.min(ctx.modestyLevel, 2) || step.tier >= 3)

    for (const formula of usable) {
      formulasTried++
      found.push(...buildFromFormula(pool, formula, ctx, step.tier, rolesPresent))
      // Teto alto de propósito: com poucos candidatos, os três melhores são
      // quase sempre a mesma ideia de look em três cores.
      if (found.length > 400) break
    }

    const ranked = dedupe(found)
      .filter((c) => !ctx.recentSignatures.includes(signature(c)))
      .sort((a, b) => b.scores.total - a.scores.total)

    if (ranked.length > 0) {
      const missing = ranked[0].unmetRoles
      const escolhidos = variarAcabamento(diversify(ranked, count), pool, ctx, step.tier)
      return { candidates: escolhidos, tierUsed: step.tier, missingRoles: missing, formulasTried }
    }

  }

  // Zero candidatos: diagnosticar o que falta, em vez de devolver "não foi possível".
  return { candidates: [], tierUsed: 5, missingRoles: diagnoseGap(pool, ctx), formulasTried }
}

/**
 * O que impede este guarda-roupa de vestir esta pessoa para esta ocasião.
 * Alimenta a mensagem ao usuário: "faltam sapatos" é acionável, "não consegui" não é.
 */
function diagnoseGap(items: WardrobeItem[], ctx: EngineContext): OutfitRole[] {
  const usable = items.filter((i) => isUsable(i, ctx, 5))
  const roles = new Set(usable.map((i) => i.category as OutfitRole))
  const missing: OutfitRole[] = []

  if (!roles.has('dress')) {
    if (!roles.has('top')) missing.push('top')
    if (!roles.has('bottom')) missing.push('bottom')
  }
  if (!roles.has('shoes')) missing.push('shoes')
  return missing
}

/**
 * Regra inegociável: um look veste a pessoa.
 *
 * Ou tem vestido, ou tem parte de cima E parte de baixo. Sem isto, um
 * guarda-roupa incompleto produzia "looks" de camiseta e tênis, ou só calçado —
 * o motor ficava satisfeito e a usuária, nua. Quando nem isto é possível, a
 * resposta certa é dizer o que falta, não inventar um conjunto.
 */
function coversBody(picks: Array<{ role: OutfitRole; item: WardrobeItem }>): boolean {
  const roles = new Set(picks.map((p) => p.role))
  if (roles.has('dress')) return true

  // Colete veste o tronco: nas referências ele aparece sozinho sobre a calça,
  // sem blusa por baixo. Exigir uma "parte de cima" fazia o motor descartar
  // toda fórmula de colete — a peça existia no armário e nunca saía.
  const cobreTronco = roles.has('top') || picks.some((p) => p.item.subcategory === 'colete')
  return cobreTronco && roles.has('bottom')
}

/** Assinatura do conjunto de peças — dois looks com as mesmas peças são o mesmo look. */
export function signature(candidate: OutfitCandidate): string {
  return candidate.items.map((i) => i.item.id).sort().join('|')
}

function dedupe(list: OutfitCandidate[]): OutfitCandidate[] {
  const seen = new Set<string>()
  const out: OutfitCandidate[] = []
  for (const c of list) {
    const key = signature(c)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

/**
 * Alternativas precisam ser de fato diferentes: penaliza reaproveitar a mesma
 * peça-âncora, senão as três opções viram a mesma blusa com sapato trocado.
 */
/**
 * Troca o acabamento repetido entre as opções.
 *
 * As três saíam com o mesmo colar, o mesmo brinco e a mesma bolsa porque cada
 * uma é montada sem saber das outras. O acabamento é justamente o que faz a
 * mesma base parecer outro look — repeti-lo joga fora essa chance.
 */
function variarAcabamento(
  escolhidos: OutfitCandidate[],
  items: WardrobeItem[],
  ctx: EngineContext,
  tier: number,
): OutfitCandidate[] {
  const jaUsados = new Set<string>()
  const ehAcabamento = (role: OutfitRole) => role === 'accessory' || role === 'bag'

  return escolhidos.map((candidato, indice) => {
    if (indice === 0) {
      for (const p of candidato.items) if (ehAcabamento(p.role)) jaUsados.add(p.item.id)
      return candidato
    }

    const noLook = new Set(candidato.items.map((p) => p.item.id))
    const trocados = candidato.items.map((p) => {
      if (!ehAcabamento(p.role) || !jaUsados.has(p.item.id)) return p

      const alternativa = items
        .filter(
          (i) =>
            (i.category as OutfitRole) === p.role &&
            !noLook.has(i.id) &&
            !jaUsados.has(i.id) &&
            familiaDoAcessorio(i.subcategory) === familiaDoAcessorio(p.item.subcategory) &&
            isUsable(i, ctx, tier),
        )
        .map((i) => ({
          item: i,
          harmonia: Math.min(
            ...candidato.items
              .filter((x) => !ehAcabamento(x.role))
              .map((x) => colorCompatibility(x.item.color, i.color)),
          ),
        }))
        .sort((a, b) => b.harmonia - a.harmonia)[0]

      // Sem alternativa à altura, repetir é melhor que tirar o acessório.
      if (!alternativa || alternativa.harmonia < 2) return p
      noLook.add(alternativa.item.id)
      return { ...p, item: alternativa.item }
    })

    for (const p of trocados) if (ehAcabamento(p.role)) jaUsados.add(p.item.id)
    return { ...candidato, items: trocados }
  })
}

/**
 * Escolhe as opções por IDEIA de look, não por nota.
 *
 * O ranking sozinho devolvia três variações da melhor fórmula — mesmo blazer,
 * mesma calça, mesmo sapato, outra blusa. Aqui cada opção precisa vir de uma
 * família diferente (terceira peça + tipo de base + calçado) enquanto o
 * guarda-roupa permitir.
 */
function diversify(ranked: OutfitCandidate[], count: number): OutfitCandidate[] {
  const candidatos = ranked.map((c) => ({
    look: comparavel(c.items, c.formula.id),
    qualidade: c.scores.total,
    original: c,
  }))

  // O teto por fórmula evita que uma ideia domine o topo; alto o bastante para
  // ainda sobrar combinação sem nenhuma peça repetida quando ela existir.
  return selecionarDiversos(limitarPorFormula(candidatos, 12), count)
}

function sameColor(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function r(n: number): number {
  return Number(n.toFixed(4))
}
