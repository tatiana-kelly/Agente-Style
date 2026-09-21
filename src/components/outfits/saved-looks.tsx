'use client'

import { useState } from 'react'
import { Eye, Loader2, Shirt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemThumb } from '@/components/ui/item-thumb'
import type { WardrobeItem } from '@/schemas/wardrobe'
import type { Outfit } from '@/schemas/outfit'
import { formatDate } from '@/lib/utils'
import { occasionLabel, styleLabel } from '@/lib/labels'

export interface LookSalvo {
  outfit: Outfit
  pecas: Array<{ role: string; item: WardrobeItem }>
  imagem: string | null
}

/**
 * Meus looks.
 *
 * O cartão lidera com a foto do look VESTIDO. As miniaturas de peça existem
 * como apoio, não como o registro: guardar um look é guardar como ele fica no
 * corpo, não um mosaico de roupas soltas.
 */
export function SavedLooks({ looks }: { looks: LookSalvo[] }) {
  const [imagens, setImagens] = useState<Record<string, string>>({})
  const [gerando, setGerando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function verVestido(outfitId: string) {
    if (gerando) return
    setGerando(outfitId)
    setErro(null)
    try {
      const res = await fetch(`/api/outfits/${outfitId}/image`, { method: 'POST' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui gerar a imagem.')
      setImagens((prev) => ({ ...prev, [outfitId]: payload.imageUrl }))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar a imagem.')
    } finally {
      setGerando(null)
    }
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mt-4 rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">{erro}</p>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {looks.map(({ outfit, pecas, imagem }) => {
          const foto = imagens[outfit.id] ?? imagem
          const contexto = [styleLabel(outfit.style), outfit.occasion ? occasionLabel(outfit.occasion) : null]
            .filter(Boolean)
            // "Trabalho · Trabalho" não diz nada; quando coincidem, mostra uma vez.
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(' · ')

          return (
            <li
              key={outfit.id}
              className="flex flex-col overflow-hidden rounded-card border border-sand/70 bg-ivory/40"
            >
              <figure className="relative aspect-[2/3] overflow-hidden bg-ivory">
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
                  <img src={foto} alt={outfit.name} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-3 px-5 text-center">
                    <Shirt className="size-7 text-mist" strokeWidth={1.4} />
                    <p className="text-xs leading-relaxed text-cocoa">
                      Este look ainda não tem foto sua vestindo.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => verVestido(outfit.id)}
                      disabled={gerando !== null}
                    >
                      {gerando === outfit.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                      {gerando === outfit.id ? 'Criando…' : 'Ver em mim'}
                    </Button>
                  </div>
                )}
              </figure>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{outfit.name}</p>
                  <span className="shrink-0 text-xs text-mist">{formatDate(outfit.created_at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-mist">{contexto}</p>

                {/* Miniaturas como apoio: dizem QUAIS peças, sem roubar a cena. */}
                <ul className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                  {pecas.map(({ item }) => (
                    <li
                      key={item.id}
                      className="size-10 shrink-0 overflow-hidden rounded-soft"
                      title={item.name}
                    >
                      <ItemThumb item={item} />
                    </li>
                  ))}
                </ul>

                {outfit.explanation && (
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-cocoa">{outfit.explanation}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
