import { z } from 'zod'

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  height: z.number().nullable(),
  style_preferences: z.array(z.string()).default([]),
  favorite_colors: z.array(z.string()).default([]),
  avoid_colors: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
})
export type UserProfile = z.infer<typeof userProfileSchema>

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  height: z.number().int().min(100).max(250).nullable().optional(),
  style_preferences: z.array(z.string()).optional(),
  favorite_colors: z.array(z.string()).optional(),
  avoid_colors: z.array(z.string()).optional(),
})

export const userPhotoSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  image_url: z.string(),
  photo_type: z.enum(['full-body', 'portrait', 'other']).default('full-body'),
  is_primary: z.boolean().default(false),
  created_at: z.string(),
})
export type UserPhoto = z.infer<typeof userPhotoSchema>

/** Preferência aprendida a partir do comportamento (PRP §23). */
export const PREFERENCE_TYPES = [
  'color_combination', 'liked_item', 'disliked_item',
  'style_affinity', 'rejected_pairing', 'occasion_affinity',
] as const

export const preferenceSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  preference_type: z.enum(PREFERENCE_TYPES),
  value: z.string(),
  weight: z.number().min(-1).max(1),
  created_at: z.string(),
  updated_at: z.string(),
})
export type UserPreference = z.infer<typeof preferenceSchema>

export const feedbackSchema = z.object({
  outfit_id: z.string(),
  action: z.enum(['liked', 'saved', 'rejected', 'swapped', 'regenerated']),
  swapped_role: z.string().optional(),
})
export type FeedbackInput = z.infer<typeof feedbackSchema>
