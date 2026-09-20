import { z } from 'zod'
import { generateLookRequestSchema } from './outfit'

/** Contrato interno do orquestrador (PRP §33). */
export const hermesRequestSchema = generateLookRequestSchema.extend({
  userId: z.string(),
  intent: z.string().default('generate_look'),
})
export type HermesRequest = z.infer<typeof hermesRequestSchema>

export interface HermesResponse {
  success: boolean
  outfitId?: string
  generatedImageUrl?: string
  selectedItems?: string[]
  explanation?: string
  alternatives?: string[]
  /** Preenchido quando o look foi montado mas a imagem falhou (PRP §46). */
  degraded?: boolean
  error?: string
}

export const AGENT_NAMES = [
  'hermes', 'wardrobe-agent', 'style-agent',
  'outfit-agent', 'image-director', 'quality-control',
] as const
export type AgentName = (typeof AGENT_NAMES)[number]
