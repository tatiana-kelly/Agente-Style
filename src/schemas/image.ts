import { z } from 'zod'

/** Referência visual enviada ao modelo de imagem. */
export const imageReferenceSchema = z.object({
  kind: z.enum(['person', 'garment']),
  url: z.string(),
  label: z.string(),
})
export type ImageReference = z.infer<typeof imageReferenceSchema>

/** Descritor textual da peça: existe mesmo quando ela ainda não tem foto cadastrada. */
export const garmentDescriptorSchema = z.object({
  role: z.string(),
  name: z.string(),
  color: z.string(),
})
export type GarmentDescriptor = z.infer<typeof garmentDescriptorSchema>

export const imageGenerationInputSchema = z.object({
  prompt: z.string().min(1),
  negative_notes: z.array(z.string()).default([]),
  references: z.array(imageReferenceSchema),
  /** Sempre completo; `references` só traz as peças que têm imagem. */
  garments: z.array(garmentDescriptorSchema).default([]),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1536'),
  /**
   * 'low' é a prévia das 3 opções: sai em segundos e custa uma fração.
   * 'high' é a do look salvo, onde vale pagar por acabamento e semelhança.
   */
  quality: z.enum(['low', 'medium', 'high']).default('high'),
})
export type ImageGenerationInput = z.infer<typeof imageGenerationInputSchema>

export const imageGenerationResultSchema = z.object({
  success: z.boolean(),
  image_base64: z.string().optional(),
  image_url: z.string().optional(),
  model: z.string(),
  provider: z.string(),
  estimated_cost: z.number().default(0),
  latency_ms: z.number().default(0),
  error: z.string().optional(),
})
export type ImageGenerationResult = z.infer<typeof imageGenerationResultSchema>

/** Contrato de troca de provider (PRP §47). */
export interface ImageProvider {
  readonly name: string
  generateLook(input: ImageGenerationInput): Promise<ImageGenerationResult>
}

export const qualityReportSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(1),
  issues: z.array(z.string()).default([]),
  retry: z.boolean().default(false),
})
export type QualityReport = z.infer<typeof qualityReportSchema>
