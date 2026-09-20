import type { ImageProvider } from '@/schemas/image'
import { hasOpenAI } from '@/lib/env'
import { OpenAIImageProvider } from './providers/openai-image'
import { MockImageProvider } from './providers/mock-image'

let cached: ImageProvider | null = null

/**
 * Ponto único de troca de fornecedor (PRP §47).
 * Trocar por Replicate/Flux/Google é implementar ImageProvider e mudar esta função.
 */
export function getImageProvider(): ImageProvider {
  if (cached) return cached
  cached = hasOpenAI ? new OpenAIImageProvider() : new MockImageProvider()
  return cached
}

/** Usado nos testes para isolar o provider. */
export function setImageProvider(provider: ImageProvider | null): void {
  cached = provider
}
