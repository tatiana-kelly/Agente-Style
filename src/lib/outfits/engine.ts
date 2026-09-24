import type { WardrobeItem } from '@/schemas/wardrobe'
import type { NoveltyLevel, OutfitRole, Style } from '@/schemas/outfit'
import type { OutfitFormula, FormulaSlot } from '@/schemas/formula'
import { OUTFIT_FORMULAS } from '@/data/outfit-formulas'
import { matchesSlot, slotAffinity } from './archetypes'
import { avaliarCoerencia, penalidadeRepeticao, MAX_ACESSORIOS } from './coherence'
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

  // Equipamento de quadra só em contexto de quadra: raqueteira não é bolsa de
  // viagem e viseira de tênis não termina look de passeio.
  // Tênis de quadra e de corrida são equipamento: fora do esporte, o tênis
  // casual faz o papel e o técnico destoa do look.
  const daQuadra = ['raqueteira', 'viseira', 'tenis-tenis', 'tenis-corrida'].includes(item.subcategory)
  const contextoDeQuadra =
    ctx.style === 'tenis' || ctx.style === 'esporte' ||
    ctx.occasion === 'partida-tenis' || ctx.occasion === 'treino'
  if (daQuadra && !contextoDeQuadra) return false

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

function candidatesForSlot(
  items: WardrobeItem[],
  slot: FormulaSlot,
  ctx: EngineContext,
  tier: number,
  used: Set<string>,
): SlotPick[] {
  const picks: SlotPick[] = []

  for (const item of items) {
    if (used.has(item.id)) continue
    if ((item.category as OutfitRole) !== slot.role) continue
    if (!isUsable(item, ctx, tier)) continue

    const affinity = slotAffinity(item, slot.archetypes)
    // Tier 1 e 2 exigem o arquétipo; a partir do Tier 3 qualquer peça do papel serve.
    if (affinity === 0 && tier <= 2) continue
    if (affinity === 0 && !matchesSlot(item, slot.archetypes) && tier <= 2) continue

    picks.push({ item, affinity: affinity || 0.25 })
  }

  // Empate de afinidade era sempre resolvido pela mesma peça: a repetida cai
  // na ordenação para o guarda-roupa inteiro circular.
  return picks
    .sort(
      (a, b) =>
        b.affinity - penalidadeRepeticao(b.item, ctx.recentItemIds) -
        (a.affinity - penalidadeRepeticao(a.item, ctx.recentItemIds)),
    )
    .slice(0, 5)
}

// ─────────────────────────────────────────────────────────────── construção

function buildFromFormula(
  items: WardrobeItem[],
  formula: OutfitFormula,
  ctx: EngineContext,
  tier: number,
  rolesPresent: Set<OutfitRole>,
): OutfitCandidate[] {
  const locked = items.filter((i) => ctx.lockedItemIds.includes(i.id))
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
        : candidatesForSlot(items, slot, ctx, tier, partial.used)

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

      for (const option of options.slice(0, 3)) {
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
  // Portões, na ordem: composição, cor e clima. Look que não passa não é
  // mostrado — a pessoa não deveria precisar descartar look feio na mão.
  const coerentes = complete.filter(
    (p) =>
      avaliarCoerencia(p.picks, { tier, formula }).length === 0 &&
      (tier >= 4 || avaliarPaleta(p.picks).aprovada) &&
      travaDeCorOk(p.picks, formula) &&
      climaOk(p.picks, ctx.clima, tier),
  )
  if (coerentes.length === 0) return []

  return coerentes.map((p) => {
    let withExtras = addOptional(p.picks, items, formula, ctx, tier, p.used)
    withExtras = garantirTravadas(withExtras, locked)
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
  // Sem acessório na fórmula, usa o padrão: a pessoa quer o look terminado.
  if (!slots.some((s) => s.role === 'accessory')) slots.push(ACESSORIO_PADRAO)
  if (!slots.some((s) => s.role === 'bag')) slots.push(BOLSA_PADRAO)

  for (const slot of slots) {
    // Terceira peça é styling, não agasalho: nas referências o blazer aparece
    // o ano inteiro. Só não entra quando faz calor — aí vira desconforto.
    if (slot.role === 'outerwear' && ctx.clima === 'calor') continue

    const limite = MAX_POR_PAPEL[slot.role] ?? 1
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
      // Limiar mais baixo que o original (0.5): acessório neutro quase sempre
      // funciona, e sem isto o look voltava sem brinco, cinto nem bolsa.
      if (candidato.value < 0.4) continue
      // Não empilhar três colares: uma peça por família de acessório.
      const familia = familiaDoAcessorio(candidato.item.subcategory)
      if (familiasUsadas.has(familia)) continue

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
const PESADAS = ['casaco', 'sueter', 'corta-vento']
const DE_CALOR = ['shorts', 'bermuda', 'top-esportivo', 'regata']

function climaOk(
  picks: Array<{ item: WardrobeItem; role: OutfitRole }>,
  clima: EngineContext['clima'],
  tier: number,
): boolean {
  if (!clima || tier >= 4) return true

  if (clima === 'calor') {
    return !picks.some((p) => PESADAS.includes(p.item.subcategory))
  }
  if (clima === 'frio') {
    // Peça de calor no frio só passa quando há camada cobrindo o look.
    const temCamada = picks.some((p) => p.role === 'outerwear')
    const temPecaDeCalor = picks.some((p) => DE_CALOR.includes(p.item.subcategory))
    if (temPecaDeCalor && !temCamada) return false
    return !picks.some((p) => ['chinelo', 'sandalia'].includes(p.item.subcategory))
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
    (palette.score + patternBonus) * 0.5 + dna.nota * 0.3 + afinidadeComReferencias(picks) * 0.2,
  )

  const avgFormality = items.reduce((s, i) => s + i.formality, 0) / Math.max(items.length, 1)
  const spread = items.length > 1 ? Math.max(...items.map((i) => i.formality)) - Math.min(...items.map((i) => i.formality)) : 0
  const [fmin, fmax] = ctx.formalityOverride ?? formula.formality
  const target = (fmin + fmax) / 2
  const formality_match = clamp01(1 - Math.abs(avgFormality - target) / 5) * clamp01(1 - spread / 9)

  // Style gate: a fórmula que veio das referências dela vale mais que uma
  // fórmula genérica igualmente aplicável.
  const bonusReferencia = formula.source_type === 'style-reference' ? 0.15 : 0
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
    { tier: 3, formulas: [...byStyle, ...universal] },
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
  return selecionarDiversos(limitarPorFormula(candidatos, 6), count)
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
