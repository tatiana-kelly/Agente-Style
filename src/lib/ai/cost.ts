import { env } from '@/lib/env'

/**
 * Preços aproximados em USD, usados só para estimativa e freio.
 * Cobrança real é a da OpenAI; aqui o objetivo é impedir loop caro (PRP §36).
 */
export const PRICING = {
  text: { inputPer1M: 0.25, outputPer1M: 2.0 },
  image: { perImage: 0.19 },
} as const

export function estimateTextCost(inputTokens: number, outputTokens: number): number {
  const cost =
    (inputTokens / 1_000_000) * PRICING.text.inputPer1M +
    (outputTokens / 1_000_000) * PRICING.text.outputPer1M
  return Number(cost.toFixed(6))
}

export function estimateImageCost(images = 1): number {
  return Number((images * PRICING.image.perImage).toFixed(6))
}

/** Aproximação suficiente para orçamento; não precisa de tokenizer real. */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export class CostBudget {
  private spent = 0
  constructor(private readonly limit = env.maxRequestCostUsd) {}

  get total(): number {
    return Number(this.spent.toFixed(6))
  }

  get remaining(): number {
    return Number(Math.max(0, this.limit - this.spent).toFixed(6))
  }

  canAfford(cost: number): boolean {
    return this.spent + cost <= this.limit
  }

  /** Lança quando a operação estouraria o teto — o chamador decide degradar. */
  charge(cost: number, operation: string): void {
    if (!this.canAfford(cost)) {
      throw new BudgetExceededError(operation, this.spent, this.limit)
    }
    this.spent += cost
  }
}

export class BudgetExceededError extends Error {
  constructor(
    readonly operation: string,
    readonly spent: number,
    readonly limit: number,
  ) {
    super(`Orçamento de IA excedido em "${operation}": US$ ${spent.toFixed(4)} de US$ ${limit.toFixed(2)}`)
    this.name = 'BudgetExceededError'
  }
}
