import type { HermesRequest, HermesResponse } from '@/schemas/hermes'
import type { Repository } from '@/services/repository'
import type { OutfitProposal } from '@/agents/outfit-agent'
import { resolveStyleIntent } from '@/agents/style-agent'
import { runWardrobeAgent } from '@/agents/wardrobe-agent'
import { runOutfitAgent } from '@/agents/outfit-agent'
import { runImageDirector } from '@/agents/image-director'
import { runQualityControl } from '@/agents/quality-control'
import { getImageProvider } from '@/lib/ai/image-provider'
import { BudgetExceededError, CostBudget, estimateImageCost } from '@/lib/ai/cost'
import { env } from '@/lib/env'
import { BUCKETS, storeImage } from '@/services/image-service'

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
    const [profile, preferences, items, photo] = await Promise.all([
      repo.getProfile(request.userId),
      repo.listPreferences(request.userId),
      repo.listItems(request.userId),
      repo.getPrimaryPhoto(request.userId),
    ])

    if (items.length === 0) {
      return fail('Seu guarda-roupa está vazio. Cadastre algumas peças para eu montar um look.')
    }

    // 2. Style Agent — interpreta a intenção
    const intent = resolveStyleIntent({
      style: request.style,
      occasion: request.occasion,
      context: request.context,
      weather: request.weather,
    })

    // 3. Wardrobe Agent — filtra o que existe de verdade
    const wardrobe = runWardrobeAgent({
      items,
      intent,
      preferences,
      favoriteColors: profile?.favorite_colors ?? [],
      avoidColors: profile?.avoid_colors ?? [],
      excludeIds: request.exclude_item_ids,
    })

    // 4. Outfit Agent — monta 1 principal + alternativas
    const preferenceWeights: Record<string, number> = {}
    for (const p of preferences) {
      if (p.preference_type === 'liked_item') preferenceWeights[p.value] = p.weight
      if (p.preference_type === 'disliked_item') preferenceWeights[p.value] = -Math.abs(p.weight)
    }

    const outfit = runOutfitAgent({
      items,
      intent,
      lockedItemIds: request.locked_item_ids,
      excludeIds: request.exclude_item_ids,
      favoriteColors: profile?.favorite_colors ?? [],
      avoidColors: profile?.avoid_colors ?? [],
      preferenceWeights,
      count: 3,
    })

    if (!outfit.primary) {
      return fail(
        wardrobe.missing_roles.length > 0
          ? `Não consegui fechar um look de ${request.style}: faltam peças para ${wardrobe.missing_roles.join(', ')}.`
          : 'Não encontrei combinação adequada com as peças disponíveis.',
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
      scores: outfit.primary.scores as unknown as Record<string, number>,
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
          scores: alt.scores as unknown as Record<string, number>,
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
      image_url: image.url,
      model: image.model,
      generation_metadata: { attempts: image.attempts, issues: image.issues, checkedBy: image.checkedBy },
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

interface RenderOutcome {
  url: string | null
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
}): Promise<RenderOutcome> {
  const { request, outfit, intent, photoUrl, budget, repo } = args
  const provider = getImageProvider()
  const maxAttempts = 1 + env.maxImageRetries

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
    })
    lastPrompt = direction.prompt

    const cost = estimateImageCost(1)
    if (!budget.canAfford(cost)) {
      return {
        url: null, prompt: lastPrompt, model: lastModel, attempts: attempt - 1,
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

    const qc = await runQualityControl({ result, request: direction, attempt, maxAttempts })
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
      const stored = await storeImage(
        BUCKETS.generatedLooks,
        request.userId,
        `${Date.now()}.${ext}`,
        Buffer.from(result.image_base64, 'base64'),
        contentType,
      )
      return {
        url: stored.url, prompt: lastPrompt, model: result.model, attempts: attempt,
        issues: qc.issues, qualityScore: qc.score, checkedBy: qc.checkedBy,
      }
    }

    if (!qc.retry) {
      return {
        url: null, prompt: lastPrompt, model: result.model, attempts: attempt,
        issues: qc.issues, qualityScore: qc.score, checkedBy: qc.checkedBy,
        warning: qc.issues[0] ?? result.error ?? 'A imagem não passou no controle de qualidade.',
      }
    }
    corrections = qc.correctionNotes
  }

  return {
    url: null, prompt: lastPrompt, model: lastModel, attempts: maxAttempts,
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
