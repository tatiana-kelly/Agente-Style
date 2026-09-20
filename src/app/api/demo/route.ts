import { getContext } from '@/services/context'
import { buildDemoWardrobe } from '@/data/demo-wardrobe'
import { createWardrobeItemSchema } from '@/schemas/wardrobe'
import { fail, ok } from '../_lib/handler'

/**
 * Carrega as 20 peças demo na conta atual (PRP §38).
 * Permite testar o produto em Supabase real sem fotografar o armário inteiro antes.
 */
export async function POST() {
  try {
    const { user, repo } = await getContext()

    const existing = await repo.listItems(user.id)
    if (existing.length > 0) {
      return ok({ error: 'Seu guarda-roupa já tem peças. Esvazie antes de carregar a demo.' }, 409)
    }

    const seeds = buildDemoWardrobe(user.id)
    for (const seed of seeds) {
      await repo.createItem(user.id, createWardrobeItemSchema.parse({
        name: seed.name,
        category: seed.category,
        subcategory: seed.subcategory,
        color: seed.color,
        secondary_colors: seed.secondary_colors,
        pattern: seed.pattern,
        material: seed.material,
        style: seed.style,
        formality: seed.formality,
        sport_type: seed.sport_type,
        season: seed.season,
        occasion: seed.occasion,
        description: seed.description,
      }))
    }

    return ok({ created: seeds.length }, 201)
  } catch (error) {
    return fail(error)
  }
}
