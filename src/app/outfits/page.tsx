import Link from 'next/link'
import { getContext } from '@/services/context'
import { ItemThumb } from '@/components/ui/item-thumb'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'
import { occasionLabel, styleLabel } from '@/lib/labels'
import { styleSchema } from '@/schemas/outfit'

export const dynamic = 'force-dynamic'

const FILTERS = ['tenis', 'social', 'trabalho', 'casual', 'viagem', 'esporte'] as const

export default async function OutfitsPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>
}) {
  const { style: rawStyle } = await searchParams
  const parsed = rawStyle ? styleSchema.safeParse(rawStyle) : null
  const style = parsed?.success ? parsed.data : undefined

  const { user, repo } = await getContext()
  const [outfits, items] = await Promise.all([repo.listOutfits(user.id, style), repo.listItems(user.id)])
  const byId = new Map(items.map((i) => [i.id, i]))

  return (
    <div className="rise">
      <p className="eyebrow">{outfits.length === 1 ? '1 look salvo' : `${outfits.length} looks salvos`}</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">Meus looks</h1>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        <FilterLink label="Todos" href="/outfits" active={!style} />
        {FILTERS.map((f) => (
          <FilterLink key={f} label={styleLabel(f)} href={`/outfits?style=${f}`} active={style === f} />
        ))}
      </div>

      {outfits.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="Nenhum look salvo ainda"
          description="Monte um look e toque em Salvar para guardá-lo aqui."
          actionLabel="Montar meu look"
          actionHref="/create-look"
        />
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {outfits.map((outfit) => (
            <li key={outfit.id} className="rounded-card border border-sand/70 bg-ivory/40 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-medium">{outfit.name}</p>
                <span className="shrink-0 text-xs text-mist">{formatDate(outfit.created_at)}</span>
              </div>
              <p className="mt-1 text-xs text-mist">
                {styleLabel(outfit.style)}
                {outfit.occasion ? ` · ${occasionLabel(outfit.occasion)}` : ''}
              </p>

              <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                {outfit.items.map((oi) => {
                  const item = byId.get(oi.wardrobe_item_id)
                  if (!item) return null
                  return (
                    <li key={oi.wardrobe_item_id} className="size-16 shrink-0 overflow-hidden rounded-soft" title={item.name}>
                      <ItemThumb item={item} />
                    </li>
                  )
                })}
              </ul>

              {outfit.explanation && (
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-cocoa">{outfit.explanation}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
        active ? 'border-espresso bg-espresso text-bone' : 'border-sand text-cocoa hover:border-clay'
      }`}
    >
      {label}
    </Link>
  )
}
