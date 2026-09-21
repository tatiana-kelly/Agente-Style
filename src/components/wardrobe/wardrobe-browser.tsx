'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Search } from 'lucide-react'
import type { WardrobeItem } from '@/schemas/wardrobe'
import { Chip } from '@/components/ui/chip'
import { ItemThumb } from '@/components/ui/item-thumb'
import { EmptyState } from '@/components/ui/empty-state'
import { titleCase } from '@/lib/utils'

/** Filtros da tela de guarda-roupa (PRP §25). */
const FILTERS = [
  { id: 'todos', label: 'Todos', test: () => true },
  { id: 'tops', label: 'Tops', test: (i: WardrobeItem) => i.category === 'top' || i.category === 'dress' },
  { id: 'bottoms', label: 'Bottoms', test: (i: WardrobeItem) => i.category === 'bottom' },
  { id: 'calcados', label: 'Calçados', test: (i: WardrobeItem) => i.category === 'shoes' },
  { id: 'acessorios', label: 'Acessórios', test: (i: WardrobeItem) => i.category === 'accessory' || i.category === 'bag' },
  { id: 'tenis', label: 'Tênis', test: (i: WardrobeItem) => i.sport_type === 'tenis' },
  { id: 'social', label: 'Social', test: (i: WardrobeItem) => i.formality >= 6 },
] as const

export function WardrobeBrowser({ initialItems }: { initialItems: WardrobeItem[] }) {
  const [items] = useState(initialItems)
  const [filter, setFilter] = useState<string>('todos')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0]
    const q = query.trim().toLowerCase()

    return items.filter((item) => {
      if (!active.test(item)) return false
      if (!q) return true
      // Busca livre: "preto", "camisa", "tênis branco" precisam funcionar.
      const haystack = [item.name, item.color, item.subcategory, item.style, item.description]
        .join(' ')
        .toLowerCase()
      return q.split(/\s+/).every((token) => haystack.includes(token))
    })
  }, [items, filter, query])

  return (
    <div className="rise">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{items.length} peças</p>
          <h1 className="display mt-2 text-3xl md:text-4xl">Meu guarda-roupa</h1>
        </div>
        <Link
          href="/wardrobe/add"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-espresso px-5 py-3 text-sm text-bone transition-colors hover:bg-cocoa"
        >
          <Plus className="size-4" />
          Add peça
        </Link>
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="preto, camisa, tênis branco…"
          className="w-full rounded-full border border-sand bg-transparent py-3 pl-11 pr-4 text-sm placeholder:text-mist focus:border-clay focus:outline-none"
        />
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={items.length === 0 ? 'Guarda-roupa vazio' : 'Nada encontrado'}
          description={
            items.length === 0
              ? 'Cadastre suas peças para que a IA possa montar looks com o que você já tem.'
              : 'Ajuste a busca ou escolha outro filtro.'
          }
          actionLabel={items.length === 0 ? 'Cadastrar primeira peça' : undefined}
          actionHref={items.length === 0 ? '/wardrobe/add' : undefined}
        />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {visible.map((item) => (
            <li key={item.id} className="group relative overflow-hidden rounded-card bg-ivory">
              <Link href={`/wardrobe/${item.id}/edit`} className="block">
                <div className="aspect-[3/4] overflow-hidden">
                  <ItemThumb item={item} />
                </div>
                <div className="flex items-center gap-2 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="mt-0.5 truncate text-xs text-mist">
                      {titleCase(item.subcategory)} · {titleCase(item.color)}
                    </p>
                  </div>
                  {/*
                    Sempre visível, nunca só no hover: o produto é usado no
                    celular fotografando roupa, e lá não existe hover.
                  */}
                  <span
                    aria-hidden
                    className="shrink-0 rounded-full border border-sand p-2 text-cocoa transition-colors group-hover:border-clay group-hover:text-espresso"
                  >
                    <Pencil className="size-3.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
