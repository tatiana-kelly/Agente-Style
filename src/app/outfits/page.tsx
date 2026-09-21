import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getContext } from '@/services/context'
import { EmptyState } from '@/components/ui/empty-state'
import { styleLabel } from '@/lib/labels'
import { SavedLooks } from '@/components/outfits/saved-looks'
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
  const imagens = await repo.getGeneratedLooksFor(user.id, outfits.map((o) => o.id))

  const looks = outfits.map((outfit) => ({
    outfit,
    imagem: imagens.get(outfit.id) ?? null,
    pecas: outfit.items
      .map((oi) => ({ role: oi.role as string, item: byId.get(oi.wardrobe_item_id) }))
      .filter((x): x is { role: string; item: NonNullable<typeof x.item> } => Boolean(x.item)),
  }))

  return (
    <div className="rise">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{outfits.length === 1 ? '1 look salvo' : `${outfits.length} looks salvos`}</p>
          <h1 className="display mt-2 text-3xl md:text-4xl">Meus looks</h1>
        </div>
        <Link
          href="/outfits/add"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-espresso px-5 py-3 text-sm text-bone transition-colors hover:bg-cocoa"
        >
          <Plus className="size-4" />
          Add look
        </Link>
      </div>

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
          description="Monte um look e toque em Salvar, ou envie a foto de um look que você já montou."
          actionLabel="Montar meu look"
          actionHref="/create-look"
        />
      ) : (
        <SavedLooks looks={looks} />
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
