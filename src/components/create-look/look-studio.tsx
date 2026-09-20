'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Heart, Loader2, RefreshCw, Replace, Save, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { ItemThumb } from '@/components/ui/item-thumb'
import { STYLES, type Style } from '@/schemas/outfit'
import { OCCASIONS } from '@/schemas/wardrobe'
import type { WardrobeItem } from '@/schemas/wardrobe'
import { occasionLabel, roleLabel, styleLabel } from '@/lib/labels'

interface Proposal {
  outfitId: string
  name: string
  explanation: string
  items: Array<{ role: string; item: WardrobeItem }>
}

interface LookResponse {
  success: boolean
  outfitId?: string
  generatedImageUrl?: string
  explanation?: string
  proposals?: Proposal[]
  degraded?: boolean
  imageWarning?: string
  error?: string
}

/** Mensagens de progresso do PRP §45 — a tela nunca fica parada sem explicação. */
const PROGRESS = [
  'Analisando seu guarda-roupa…',
  'Montando a combinação…',
  'Criando seu look…',
  'Finalizando…',
]

export function LookStudio() {
  const params = useSearchParams()
  const initialStyle = (params.get('style') as Style | null) ?? null

  const [style, setStyle] = useState<Style | null>(initialStyle)
  const [occasion, setOccasion] = useState<string | null>(null)
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<LookResponse | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [swapRole, setSwapRole] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // O contador avança só enquanto a requisição está em voo; o reset acontece ao disparar.
  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setProgress((p) => Math.min(p + 1, PROGRESS.length - 1)), 2600)
    return () => clearInterval(id)
  }, [loading])

  const active = result?.proposals?.[activeIndex] ?? null

  async function generate(options: { excludeIds?: string[]; lockedIds?: string[] } = {}) {
    if (!style) return
    setProgress(0)
    setLoading(true)
    setError(null)
    setFeedback(null)
    setSwapRole(null)

    try {
      const res = await fetch('/api/generate-look', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style,
          occasion: occasion ?? undefined,
          context: context.trim() || undefined,
          render_image: true,
          exclude_item_ids: options.excludeIds ?? [],
          locked_item_ids: options.lockedIds ?? [],
        }),
      })
      const payload: LookResponse = await res.json()
      if (!payload.success) throw new Error(payload.error ?? 'Não consegui montar o look.')

      setResult(payload)
      setActiveIndex(0)
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao montar o look.')
    } finally {
      setLoading(false)
    }
  }

  /** Trocar peça: trava o resto do look e exclui só a peça recusada. */
  async function swapPiece(role: string) {
    if (!active) return
    const target = active.items.find((i) => i.role === role)
    if (!target) return
    await generate({
      excludeIds: [target.item.id],
      lockedIds: active.items.filter((i) => i.role !== role).map((i) => i.item.id),
    })
  }

  async function sendFeedback(action: 'liked' | 'saved' | 'rejected') {
    if (!active) return
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outfit_id: active.outfitId, action }),
    })
    setFeedback(action === 'saved' ? 'Look salvo em Meus looks.' : 'Anotado — vou usar isso nas próximas sugestões.')
  }

  return (
    <div className="rise pb-8">
      <p className="eyebrow">Criar look</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">Para onde você vai?</h1>

      <section className="mt-5">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {OCCASIONS.map((o) => (
            <Chip key={o} active={occasion === o} onClick={() => setOccasion(occasion === o ? null : o)}>
              {occasionLabel(o)}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="display text-2xl">Qual estilo?</h2>
        <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-5">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={style === s}
              onClick={() => setStyle(s)}
              className={`rounded-soft border px-3 py-3 text-sm transition-colors ${
                style === s ? 'border-espresso bg-espresso text-bone' : 'border-sand text-cocoa hover:border-clay'
              }`}
            >
              {styleLabel(s)}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="display text-2xl">Alguma preferência?</h2>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="Quero usar minha saia preta. É de manhã e vai fazer calor."
          className="mt-3 w-full resize-none rounded-soft border border-sand bg-transparent px-4 py-3 text-sm placeholder:text-mist focus:border-clay focus:outline-none"
        />
      </section>

      <Button
        onClick={() => generate()}
        disabled={!style || loading}
        size="lg"
        className="mt-6 w-full md:w-auto"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {loading ? PROGRESS[progress] : 'Montar meu look'}
      </Button>

      {!style && <p className="mt-2 text-xs text-mist">Escolha um estilo para continuar.</p>}

      {error && (
        <p role="alert" className="mt-5 rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">
          {error}
        </p>
      )}

      {loading && (
        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="shimmer aspect-[2/3] rounded-card" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shimmer h-16 rounded-soft" />
            ))}
          </div>
        </div>
      )}

      {result && active && !loading && (
        <div ref={resultRef} className="rise mt-10 scroll-mt-24">
          <h2 className="display text-2xl">Seu look</h2>

          {result.proposals && result.proposals.length > 1 && (
            <div className="mt-3 flex gap-2">
              {result.proposals.map((p, i) => (
                <Chip key={p.outfitId} active={i === activeIndex} onClick={() => setActiveIndex(i)}>
                  {i === 0 ? 'Principal' : `Alternativa ${i}`}
                </Chip>
              ))}
            </div>
          )}

          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_300px]">
            <figure className="overflow-hidden rounded-card bg-ivory">
              {result.generatedImageUrl && activeIndex === 0 ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL assinada / data URL
                <img src={result.generatedImageUrl} alt="Visualização do look" className="w-full object-cover" />
              ) : (
                <div className="flex aspect-[2/3] flex-col items-center justify-center gap-3 px-8 text-center">
                  <p className="display text-xl">Look montado</p>
                  <p className="text-sm leading-relaxed text-cocoa">
                    {result.imageWarning ??
                      (activeIndex > 0
                        ? 'Visualização disponível apenas para o look principal.'
                        : 'Não conseguimos gerar a visualização agora — as peças abaixo são a sua combinação.')}
                  </p>
                </div>
              )}
            </figure>

            <div>
              <p className="text-sm leading-relaxed text-cocoa">{active.explanation}</p>

              <ul className="mt-5 space-y-2">
                {active.items.map(({ role, item }) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-soft bg-ivory/70 p-2">
                    <div className="size-14 shrink-0 overflow-hidden rounded-soft">
                      <ItemThumb item={item} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-mist">{roleLabel(role)}</p>
                    </div>
                    {swapRole === 'open' && (
                      <button
                        type="button"
                        onClick={() => swapPiece(role)}
                        className="shrink-0 rounded-full border border-sand px-3 py-1.5 text-xs text-cocoa hover:border-clay"
                      >
                        Trocar
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => sendFeedback('liked')}>
                  <Heart className="size-4" /> Gostei
                </Button>
                <Button variant="secondary" size="sm" onClick={() => generate({ excludeIds: active.items.map((i) => i.item.id) })}>
                  <RefreshCw className="size-4" /> Outra opção
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSwapRole(swapRole === 'open' ? null : 'open')}
                >
                  <Replace className="size-4" /> Trocar peça
                </Button>
                <Button variant="primary" size="sm" onClick={() => sendFeedback('saved')}>
                  <Save className="size-4" /> Salvar
                </Button>
              </div>

              {feedback && <p className="mt-3 text-xs text-cocoa">{feedback}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
