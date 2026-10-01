import type { HermesRequest, HermesResponse } from '@/schemas/hermes'
import type { Repository } from '@/services/repository'
import type { OutfitProposal } from '@/agents/outfit-agent'
import { resolveStyleIntent } from '@/agents/style-agent'
import { interpretarPedido } from '@/agents/style-agent/nlu-openai'
import { runWardrobeAgent } from '@/agents/wardrobe-agent'
import { runOutfitAgent } from '@/agents/outfit-agent'
import { runStylist } from '@/agents/stylist'
import { runLookCritic } from '@/agents/look-critic'

/**
 * Quantos looks o motor entrega para a stylist escolher.
 *
 * Com três, não há escolha — e a IA só confirmaria a ordem do motor. Com uma
 * dúzia, ela compara ideias diferentes e a conta continua barata: é uma
 * chamada de texto, não de imagem.
 */
const CANDIDATOS_PARA_A_STYLIST = 12

/**
 * Reaplica a regra de peças diferentes sobre a ordem que a stylist escolheu.
 * A preferência dela é respeitada (vem primeiro); o que ela repetiu é trocado
 * pelo próximo candidato que não divide roupa com os já escolhidos.
 */
function garantirPecasDiferentes(
  escolhidos: OutfitProposal[],
  todos: OutfitProposal[],
): OutfitProposal[] {
  // A stylist pode devolver o mesmo look duas vezes; aqui cada look conta uma.
  const vistos = new Set<string>()
  const ordenados = [...escolhidos, ...todos].filter((c) => {
    if (vistos.has(c.signature)) return false
    vistos.add(c.signature)
    return true
  })

  const candidatos = ordenados.map((p, pos) => ({
    look: comparavel(p.items.map((i) => ({ ...i, slotAffinity: 1 })), p.formulaId),
    // Posição vira qualidade: a stylist pôs em primeiro quem ela preferiu.
    qualidade: 1 - pos / Math.max(ordenados.length, 1),
    original: p,
  }))

  return selecionarDiversos(candidatos, Math.max(escolhidos.length, 1))
}

/** Estourar o teto não pode derrubar o look já montado: anota e segue. */
function cobrar(budget: CostBudget, custo: number, operacao: string): void {
  if (custo <= 0) return
  try {
    budget.charge(custo, operacao)
  } catch (e) {
    if (!(e instanceof BudgetExceededError)) throw e
  }
}
import { exigenciasDoTexto, faltantes, parseRefinement } from '@/agents/style-agent/refine'
import { comparavel, selecionarDiversos } from '@/lib/outfits/diversity'
import type { EngineContext } from '@/lib/outfits/engine'
import { runImageDirector } from '@/agents/image-director'
import { runQualityControl } from '@/agents/quality-control'
import { getImageProvider } from '@/lib/ai/image-provider'
import { BudgetExceededError, CostBudget, estimateImageCost } from '@/lib/ai/cost'
import { env } from '@/lib/env'
import { BUCKETS } from '@/services/image-service'
import { colorCompatibility } from '@/lib/outfits/color-engine'
import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'

export interface HermesDeps {
  repo: Repository
}

export interface HermesResult extends HermesResponse {
  /** Alternativas completas para a UI mostrar sem nova chamada. */
  proposals?: Array<{ outfitId: string; proposal: OutfitProposal }>
  scores?: Record<string, number>
  missingRoles?: string[]
  imageWarning?: string
  costUsd?: number
  /** O que foi entendido do ajuste escrito, para confirmar de volta. */
  refinementNotes?: string[]
}

/**
 * Orquestrador. Decide a sequência, monta o contexto de cada subagente e valida o resultado.
 * Não executa o trabalho dos especialistas — e nunca deixa o modelo de imagem escolher peça.
 */
export async function runHermes(request: HermesRequest, deps: HermesDeps): Promise<HermesResult> {
  const startedAt = Date.now()
  const budget = new CostBudget()
  const { repo } = deps

  try {
    // 1. Contexto do usuário
    const [profile, styleProfile, preferences, items, photo] = await Promise.all([
      repo.getProfile(request.userId),
      repo.getStyleProfile(request.userId),
      repo.listPreferences(request.userId),
      repo.listItems(request.userId),
      repo.getPrimaryPhoto(request.userId),
    ])

    if (items.length === 0) {
      return fail('Seu guarda-roupa está vazio. Cadastre algumas peças para eu montar um look.')
    }

    // 2. Style Agent — interpreta a intenção
    //
    // O que ela escreveu vale mais que o que a tela marcou: "vou jantar em
    // Campos do Jordão, está frio" define ocasião, clima e registro sozinho.
    const entendido = await interpretarPedido(request.context ?? '')
    cobrar(budget, entendido.custo, 'interpretacao')

    const intent = resolveStyleIntent({
      style: request.style,
      occasion: request.occasion,
      context: request.context,
      weather: request.weather,
      profile: styleProfile,
      novelty: request.novelty,
      // Clima escrito por ela ganha do botão: quem digita "está frio" acabou
      // de dar a informação mais recente.
      clima: entendido.clima ?? request.clima,
      occasionSugerida: entendido.occasion,
      styleSugerido: entendido.style,
      formalidadePedida: entendido.formalidade,
      conforto: entendido.conforto,
    })

    // 3. Wardrobe Agent — diagnostico do acervo disponivel
    const wardrobe = runWardrobeAgent({
      items,
      intent,
      preferences,
      favoriteColors: profile?.favorite_colors ?? [],
      avoidColors: profile?.avoid_colors ?? [],
      excludeIds: request.exclude_item_ids,
    })

    // 4. Outfit Intelligence Engine — fórmula, cor, perfil, histórico
    const preferenceWeights: Record<string, number> = {}
    for (const p of preferences) {
      if (p.preference_type === 'liked_item') preferenceWeights[p.value] = p.weight
      if (p.preference_type === 'disliked_item') preferenceWeights[p.value] = -Math.abs(p.weight)
    }

    // Historico recente alimenta a penalidade de repeticao (§17).
    const recent = await repo.listRecentOutfits(request.userId, 8)
    const recentItemIds = recent.flatMap((o) => o.items.map((i) => i.wardrobe_item_id))
    const recentSignatures = recent.map((o) => o.items.map((i) => i.wardrobe_item_id).sort().join('|'))
    const recentFormulaIds = recent.map((o) => String(o.scores?.formula_id ?? '')).filter(Boolean)

    // Ajuste escrito a mao sobre um look existente (§3 do pedido).
    let lockedItemIds = [...request.locked_item_ids]
    let excludeIds = [...request.exclude_item_ids]
    const refinementNotes: string[] = []

    if (request.instruction?.trim()) {
      const refino = parseRefinement(request.instruction, items)
      const naoTem = faltantes(request.instruction, items)

      if (request.base_outfit_id) {
        const base = await repo.getOutfit(request.userId, request.base_outfit_id)
        if (base) {
          const byId = new Map(items.map((i) => [i.id, i]))
          // Papeis que a instrucao vai preencher nao podem ficar travados no
          // valor antigo, senao "troca o sapato" nao troca nada.
          const papeisNovos = new Set(
            refino.includeIds.map((id) => byId.get(id)?.category).filter(Boolean) as string[],
          )
          lockedItemIds = base.items
            .map((i) => i.wardrobe_item_id)
            .filter((id) => {
              if (refino.excludeIds.includes(id)) return false
              const cat = byId.get(id)?.category
              return !(cat && papeisNovos.has(cat))
            })
        }
      }

      lockedItemIds = [...new Set([...lockedItemIds, ...refino.includeIds])]
      excludeIds = [...new Set([...excludeIds, ...refino.excludeIds])]
      refinementNotes.push(...refino.notes)

      if (naoTem.length > 0) {
        refinementNotes.push(`Não achei no seu guarda-roupa: ${naoTem.join('; ')}.`)
      }
      if (refino.unresolved && naoTem.length === 0) {
        refinementNotes.push('Não entendi o ajuste, então mantive o look como estava.')
      }
    }

    // O que ela pediu no texto entra mesmo contra o clima; o resto, que fica
    // travado só para o look não ser sorteado de novo, passa pelo gate.
    const pedidasNoTexto = request.instruction?.trim()
      ? parseRefinement(request.instruction, items).includeIds
      : []

    // "Calça preta" na caixa de pedido é condição do look inteiro, não ajuste.
    // Antes isso era lido e descartado: a pessoa pedia calça e recebia short.
    const textoDoPedido = [request.context ?? '', ...entendido.pecasCitadas].join('. ')
    const exigencias = exigenciasDoTexto(textoDoPedido, items)
    const notasDeExigencia = exigencias.map((e) => `Mantive ${e.texto.toLowerCase()} em todas as opções, como você pediu.`)

    const engineCtx: EngineContext = {
      exigencias,
      style: intent.style,
      occasion: intent.occasion,
      season: intent.season,
      clima: intent.clima,
      formalityOverride: intent.formalityOverride,
      favoriteColors: profile?.favorite_colors ?? [],
      avoidColors: profile?.avoid_colors ?? [],
      preferredArchetypes: [],
      modestyLevel: intent.modestyLevel,
      preferenceWeights,
      // Semente nova por pedido: o mesmo compromisso, no mesmo clima, não
      // pode devolver o mesmo trio de looks toda vez.
      semente: Date.now(),
      lockedItemIds,
      lockedExplicitIds: pedidasNoTexto,
      excludeIds,
      novelty: intent.novelty,
      recentSignatures,
      recentItemIds,
      recentFormulaIds,
    }

    // O motor monta MUITO mais do que três: é entre esses candidatos — todos
    // já aprovados nos portões de cor, clima e coerência — que a stylist da
    // OpenAI escolhe. Código garante o verificável; ela escolhe o bonito.
    const outfit = runOutfitAgent(items, engineCtx, CANDIDATOS_PARA_A_STYLIST)

    const escolha = await runStylist({
      pedido: request.context,
      exigencias: exigencias.map((e) => e.texto),
      pecasRecentes: recentItemIds
        .slice(0, 12)
        .map((id) => items.find((i) => i.id === id)?.name)
        .filter((n): n is string => Boolean(n)),
      ocasiao: intent.occasion,
      clima: intent.clima,
      candidatos: [outfit.primary, ...outfit.alternatives].filter(Boolean) as OutfitProposal[],
      perfil: styleProfile,
      acervo: items,
      quantidade: 3,
    })
    cobrar(budget, escolha.custo, 'stylist')
    await repo.logAiUsage({
      user_id: request.userId,
      provider: escolha.fonte === 'openai' ? 'openai' : 'local',
      model: escolha.modelo,
      operation: 'stylist_escolhe_look',
      estimated_cost: escolha.custo,
      latency_ms: 0,
      success: escolha.fonte === 'openai',
    })

    const todos = [outfit.primary, ...outfit.alternatives].filter(Boolean) as OutfitProposal[]
    let escolhidos = escolha.escolhidos.map((i, pos) => ({
      ...todos[i],
      etiqueta: escolha.etiquetas[pos] ?? todos[i].etiqueta,
      explanation: escolha.explicacoes[pos] ?? todos[i].explanation,
    }))

    // Segunda opinião antes de mostrar: o que o crítico reprovar é trocado
    // pelo melhor candidato que sobrou. Um ciclo — dois já seria teimosia.
    const critica = await runLookCritic(escolhidos)
    cobrar(budget, critica.custo, 'look-critic')
    await repo.logAiUsage({
      user_id: request.userId,
      provider: critica.fonte === 'openai' ? 'openai' : 'local',
      model: critica.modelo,
      operation: 'look_critic',
      estimated_cost: critica.custo,
      latency_ms: 0,
      success: critica.fonte === 'openai',
    })
    const notasDaCritica: string[] = [...notasDeExigencia]

    if (!critica.aprovado && critica.criticas.length > 0) {
      const usados = new Set(escolhidos.map((e) => e.signature))
      const reserva = todos.filter((c) => !usados.has(c.signature))

      escolhidos = escolhidos.map((look, i) => {
        const problema = critica.criticas.find((c) => c.indice === i)
        if (!problema) return look
        const substituto = reserva.shift()
        if (!substituto) return look
        notasDaCritica.push(`Troquei uma das opções: ${problema.problemas[0] ?? 'não convenceu na revisão'}.`)
        return substituto
      })
    }

    // A stylist escolhe por gosto; a regra "nenhuma peça repetida entre as
    // opções" é do código e vale DEPOIS da escolha dela. Sem isto o mesmo
    // tênis e a mesma camiseta voltavam nas três — foi o que ela viu.
    escolhidos = garantirPecasDiferentes(escolhidos, todos)

    outfit.primary = escolhidos[0] ?? outfit.primary
    outfit.alternatives = escolhidos.slice(1)

    if (!outfit.primary) {
      // Diagnostico acionavel em vez de "nao foi possivel" (§27).
      const faltando = outfit.missingRoles.length > 0 ? outfit.missingRoles : wardrobe.missing_roles
      const nomes: Record<string, string> = {
        top: 'uma parte de cima', bottom: 'uma parte de baixo', shoes: 'um calçado',
        dress: 'um vestido', outerwear: 'uma sobreposição', accessory: 'um acessório', bag: 'uma bolsa',
      }
      return fail(
        faltando.length > 0
          ? `Para fechar um look de ${request.style} falta ${faltando.map((r) => nomes[r] ?? r).join(' e ')} no seu guarda-roupa.`
          : `Suas peças de ${request.style} não fecham um look completo. Cadastre mais uma peça de baixo ou um calçado adequado.`,
      )
    }

    // 5. Persistir o plano antes de gastar com imagem
    const saved = await repo.saveOutfit({
      userId: request.userId,
      name: outfit.primary.name,
      style: intent.style,
      occasion: intent.occasion,
      context: request.context,
      explanation: outfit.primary.explanation,
      scores: { ...outfit.primary.scores, formula_id: outfit.primary.formulaId } as unknown as Record<string, number>,
      status: 'draft',
      items: outfit.primary.items.map((i) => ({ wardrobe_item_id: i.item.id, role: i.role })),
    })

    const alternatives = await Promise.all(
      outfit.alternatives.map((alt) =>
        repo.saveOutfit({
          userId: request.userId,
          name: alt.name,
          style: intent.style,
          occasion: intent.occasion,
          context: request.context,
          explanation: alt.explanation,
          scores: { ...alt.scores, formula_id: alt.formulaId } as unknown as Record<string, number>,
          status: 'draft',
          items: alt.items.map((i) => ({ wardrobe_item_id: i.item.id, role: i.role })),
        }),
      ),
    )

    const base: HermesResult = {
      success: true,
      outfitId: saved.id,
      selectedItems: outfit.primary.items.map((i) => i.item.id),
      explanation: outfit.primary.explanation,
      alternatives: alternatives.map((a) => a.id),
      proposals: [
        { outfitId: saved.id, proposal: outfit.primary },
        ...alternatives.map((a, i) => ({ outfitId: a.id, proposal: outfit.alternatives[i] })),
      ],
      scores: outfit.primary.scores as unknown as Record<string, number>,
      missingRoles: outfit.missingRoles,
      refinementNotes: refinementNotes.length > 0 ? refinementNotes : undefined,
    }

    // 6. Imagem: só quando pedida e só se couber no orçamento (PRP §59)
    if (!request.render_image) {
      await log(repo, request, base, startedAt, budget.total, 'success')
      return { ...base, costUsd: budget.total }
    }

    const spentToday = await repo.todayCost(request.userId)
    if (spentToday >= env.maxDailyCostUsd) {
      const degraded = {
        ...base,
        degraded: true,
        imageWarning: `Teto diário de IA atingido (US$ ${env.maxDailyCostUsd}). O look foi montado, mas sem visualização.`,
      }
      await log(repo, request, degraded, startedAt, 0, 'degraded')
      return { ...degraded, costUsd: 0 }
    }

    const image = await renderWithRetries({ request, outfit: outfit.primary, intent, photoUrl: photo?.image_url ?? null, budget, repo })

    if (!image.url) {
      const degraded = { ...base, degraded: true, imageWarning: image.warning }
      await log(repo, request, degraded, startedAt, budget.total, 'degraded')
      return { ...degraded, costUsd: budget.total }
    }

    await repo.saveGeneratedLook({
      user_id: request.userId,
      outfit_id: saved.id,
      prompt: image.prompt,
      image_url: image.ref,
      model: image.model,
      generation_metadata: { attempts: image.attempts, issues: image.issues, checkedBy: image.checkedBy, qualidade: 'final' },
      quality_score: image.qualityScore,
    })

    const final = { ...base, generatedImageUrl: image.url, costUsd: budget.total }
    await log(repo, request, final, startedAt, budget.total, 'success')
    return final
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado no Hermes'
    await log(repo, request, { success: false, error: message }, startedAt, budget.total, 'error')
    return { success: false, error: message }
  }
}

/**
 * Gera a imagem de um look JÁ PERSISTIDO.
 *
 * Existe para que as 3 opções sejam escolhas de verdade: cada uma pode virar
 * imagem sob demanda, sem gerar as três de saída — o que custaria US$ 0,57 por
 * pedido para mostrar duas que a pessoa talvez nem escolha (PRP §59).
 */
export async function renderLookImage(args: {
  repo: Repository
  userId: string
  outfitId: string
  /**
   * 'previa' veste as 3 opções assim que elas saem: qualidade média, uma
   * tentativa, sem checagem visual — bem mais rápido e barato que a imagem
   * definitiva. 'final' é o acabamento do look que a pessoa salvou.
   */
  qualidade?: 'previa' | 'final'
  /** 'lookbook' usa a modelo do app; 'try-on' usa a foto dela. */
  modo?: 'lookbook' | 'try-on'
  /** Índice da opção na tela: muda pose e enquadramento entre as três. */
  variacao?: number
}): Promise<{ success: boolean; imageUrl?: string; error?: string; costUsd: number }> {
  const { repo, userId, outfitId } = args
  const qualidade = args.qualidade ?? 'final'
  const budget = new CostBudget()

  const existente = await repo.getGeneratedLook(userId, outfitId)
  if (existente?.image_url) {
    const meta = existente.generation_metadata as { qualidade?: string; modo?: string } | null
    const mesmoModo = (meta?.modo ?? 'lookbook') === (args.modo ?? 'lookbook')
    const jaEFinal = meta?.qualidade !== 'previa'
    // Reaproveitar em vez de pagar de novo (PRP §35). A exceção é a prévia
    // quando a pessoa salva o look: aí vale refazer com acabamento.
    if (mesmoModo && (jaEFinal || qualidade === 'previa')) {
      return { success: true, imageUrl: existente.image_url, costUsd: 0 }
    }
  }

  const outfit = await repo.getOutfit(userId, outfitId)
  if (!outfit) return { success: false, error: 'Look não encontrado.', costUsd: 0 }

  const spentToday = await repo.todayCost(userId)
  if (spentToday >= env.maxDailyCostUsd) {
    return {
      success: false,
      error: `Teto diário de IA atingido (US$ ${env.maxDailyCostUsd}).`,
      costUsd: 0,
    }
  }

  const [items, photo] = await Promise.all([repo.listItems(userId), repo.getPrimaryPhoto(userId)])
  const byId = new Map(items.map((i) => [i.id, i]))
  const picks = outfit.items
    .map((oi) => ({ item: byId.get(oi.wardrobe_item_id), role: oi.role }))
    .filter((x): x is { item: (typeof items)[number]; role: typeof x.role } => Boolean(x.item))

  if (picks.length === 0) return { success: false, error: 'As peças deste look não existem mais.', costUsd: 0 }

  const intent = resolveStyleIntent({ style: outfit.style, occasion: outfit.occasion ?? undefined })

  const image = await renderWithRetries({
    request: { userId, style: outfit.style, intent: 'render_only' } as HermesRequest,
    outfit: { etiqueta: '', sugestao: null, complementos: [], items: picks, scores: {}, explanation: outfit.explanation, name: outfit.name, formulaId: '', formulaName: '', tier: 1, signature: '' },
    intent,
    photoUrl: photo?.image_url ?? null,
    budget,
    repo,
    qualidade,
    modo: args.modo ?? 'lookbook',
    variacao: args.variacao ?? 0,
  })

  if (!image.url) return { success: false, error: image.warning, costUsd: budget.total }

  await repo.saveGeneratedLook({
    user_id: userId,
    outfit_id: outfitId,
    prompt: image.prompt,
    image_url: image.ref,
    model: image.model,
    generation_metadata: { attempts: image.attempts, issues: image.issues, checkedBy: image.checkedBy, qualidade, modo: args.modo ?? 'lookbook' },
    quality_score: image.qualityScore,
  })

  return { success: true, imageUrl: image.url, costUsd: budget.total }
}

interface RenderOutcome {
  /** URL assinada, para a resposta HTTP. */
  url: string | null
  /** `bucket::caminho`, para o banco — URL assinada expiraria em 7 dias. */
  ref: string | null
  prompt: string
  model: string
  attempts: number
  issues: string[]
  qualityScore: number
  checkedBy: string
  warning?: string
}

/** Geração + Quality Control com teto rígido de tentativas (PRP §20). */
async function renderWithRetries(args: {
  request: HermesRequest
  outfit: OutfitProposal
  intent: ReturnType<typeof resolveStyleIntent>
  photoUrl: string | null
  budget: CostBudget
  repo: Repository
  qualidade?: 'previa' | 'final'
  modo?: 'lookbook' | 'try-on'
  variacao?: number
}): Promise<RenderOutcome> {
  const { request, outfit, intent, photoUrl, budget, repo } = args
  const previa = args.qualidade === 'previa'
  const provider = getImageProvider()
  // Prévia não repete: três opções na tela já são três gerações simultâneas.
  const maxAttempts = previa ? 1 : 1 + env.maxImageRetries

  let corrections: string[] = []
  let lastIssues: string[] = []
  let lastPrompt = ''
  let lastModel = provider.name

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const direction = runImageDirector({
      personPhotoUrl: photoUrl,
      items: outfit.items,
      intent,
      correctionNotes: corrections,
      modo: args.modo ?? 'lookbook',
      variacao: args.variacao ?? 0,
    })
    // Media na previa: 'low' borra tecido e rosto, e o ponto aqui e ver a
    // roupa no corpo. 'high' fica para o look salvo.
    direction.quality = previa ? 'medium' : 'high'
    lastPrompt = direction.prompt

    const cost = estimateImageCost(1, direction.quality)
    if (!budget.canAfford(cost)) {
      return {
        url: null, ref: null, prompt: lastPrompt, model: lastModel, attempts: attempt - 1,
        issues: lastIssues, qualityScore: 0, checkedBy: 'budget',
        warning: `Orçamento por pedido (US$ ${env.maxRequestCostUsd}) não cobre outra geração.`,
      }
    }

    const result = await provider.generateLook(direction)
    lastModel = result.model
    if (result.estimated_cost > 0) {
      try {
        budget.charge(result.estimated_cost, 'image')
      } catch (e) {
        if (!(e instanceof BudgetExceededError)) throw e
      }
    }

    await repo.logAiUsage({
      user_id: request.userId,
      provider: result.provider,
      model: result.model,
      operation: 'generate_look_image',
      estimated_cost: result.estimated_cost,
      latency_ms: result.latency_ms,
      success: result.success,
    })

    const qc = await runQualityControl({ result, request: direction, attempt, maxAttempts, skipVision: previa })
    if (qc.estimated_cost > 0) {
      try {
        budget.charge(qc.estimated_cost, 'quality-control')
      } catch (e) {
        if (!(e instanceof BudgetExceededError)) throw e
      }
    }
    lastIssues = qc.issues

    if (qc.approved && result.image_base64) {
      const contentType = provider.name === 'mock' ? 'image/svg+xml' : 'image/png'
      const ext = provider.name === 'mock' ? 'svg' : 'png'
      const stored = await repo.storeImage(
        request.userId,
        BUCKETS.generatedLooks,
        `${Date.now()}.${ext}`,
        Buffer.from(result.image_base64, 'base64'),
        contentType,
      )
      return {
        url: stored.url, ref: stored.ref ?? stored.url,
        prompt: lastPrompt, model: result.model, attempts: attempt,
        issues: qc.issues, qualityScore: qc.score, checkedBy: qc.checkedBy,
      }
    }

    if (!qc.retry) {
      return {
        url: null, ref: null, prompt: lastPrompt, model: result.model, attempts: attempt,
        issues: qc.issues, qualityScore: qc.score, checkedBy: qc.checkedBy,
        warning: qc.issues[0] ?? result.error ?? 'A imagem não passou no controle de qualidade.',
      }
    }
    corrections = qc.correctionNotes
  }

  return {
    url: null, ref: null, prompt: lastPrompt, model: lastModel, attempts: maxAttempts,
    issues: lastIssues, qualityScore: 0, checkedBy: 'exhausted',
    warning: 'Não consegui gerar uma imagem aprovada dentro do limite de tentativas.',
  }
}

function fail(message: string): HermesResult {
  return { success: false, error: message }
}

async function log(
  repo: Repository,
  request: HermesRequest,
  response: HermesResult,
  startedAt: number,
  cost: number,
  status: 'success' | 'error' | 'degraded',
): Promise<void> {
  await repo.logAgentRun({
    user_id: request.userId,
    agent: 'hermes',
    request: request as unknown as Record<string, unknown>,
    response: { success: response.success, outfitId: response.outfitId, error: response.error },
    status,
    latency_ms: Date.now() - startedAt,
    tokens: 0,
    estimated_cost: cost,
  })
}

/**
 * Acrescenta a melhor terceira peça a um look existente.
 *
 * Não refaz o look: procura, entre as sobreposições do guarda-roupa, a que
 * conversa com a paleta e a formalidade do que já está montado. O look original
 * continua salvo; este vira uma versão com casaco.
 */
export async function adicionarTerceiraPeca(args: {
  repo: Repository
  userId: string
  outfitId: string
}): Promise<{ success: boolean; item?: WardrobeItem; outfitId?: string; error?: string }> {
  const { repo, userId, outfitId } = args

  const [outfit, items] = await Promise.all([repo.getOutfit(userId, outfitId), repo.listItems(userId)])
  if (!outfit) return { success: false, error: 'Look não encontrado.' }

  const byId = new Map(items.map((i) => [i.id, i]))
  const atuais = outfit.items
    .map((oi) => ({ item: byId.get(oi.wardrobe_item_id), role: oi.role }))
    .filter((x): x is { item: WardrobeItem; role: OutfitRole } => Boolean(x.item))

  if (atuais.some((p) => p.role === 'outerwear')) {
    return { success: false, error: 'Este look já tem uma terceira peça.' }
  }

  const visiveis = atuais.filter((p) => p.role !== 'accessory' && p.role !== 'bag')
  const formalidadeMedia =
    visiveis.reduce((s, p) => s + p.item.formality, 0) / Math.max(visiveis.length, 1)

  const candidatas = items
    .filter((i) => i.category === 'outerwear' && i.active !== false)
    .map((i) => ({
      item: i,
      harmonia: Math.min(...visiveis.map((p) => colorCompatibility(p.item.color, i.color))),
      distancia: Math.abs(i.formality - formalidadeMedia),
    }))
    .filter((c) => c.harmonia >= 2 && c.distancia <= 3)
    .sort((a, b) => b.harmonia - a.harmonia || a.distancia - b.distancia)

  const escolhida = candidatas[0]
  if (!escolhida) {
    return { success: false, error: 'Não achei no seu guarda-roupa uma terceira peça que combine com este look.' }
  }

  const novo = await repo.saveOutfit({
    userId,
    name: outfit.name,
    style: outfit.style,
    occasion: outfit.occasion ?? undefined,
    explanation: `${outfit.explanation} Acrescentei ${escolhida.item.name.toLowerCase()} por cima, mantendo o resto do look.`,
    scores: outfit.scores ?? {},
    items: [
      ...outfit.items.map((i) => ({ wardrobe_item_id: i.wardrobe_item_id, role: i.role })),
      { wardrobe_item_id: escolhida.item.id, role: 'outerwear' as OutfitRole },
    ],
  })

  return { success: true, item: escolhida.item, outfitId: novo.id }
}
