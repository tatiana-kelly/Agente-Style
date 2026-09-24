'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Heart, Loader2, RefreshCw, Replace, Save, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { LookCollage } from '@/components/ui/look-collage'
import { NOVELTY_LEVELS, STYLES, type NoveltyLevel, type Style } from '@/schemas/outfit'
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
  refinementNotes?: string[]
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
  const [novelty, setNovelty] = useState<NoveltyLevel>('equilibrado')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<LookResponse | null>(null)
  const [imagens, setImagens] = useState<Record<string, string>>({})
  const [gerando, setGerando] = useState<string | null>(null)
  const [vestindo, setVestindo] = useState<Set<string>>(new Set())
  const [semFoto, setSemFoto] = useState(false)
  const [falhas, setFalhas] = useState<Record<string, string>>({})
  const [ajuste, setAjuste] = useState<Record<string, string>>({})
  const [ajustando, setAjustando] = useState<string | null>(null)
  const [swapRole, setSwapRole] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // Sem foto no perfil, o look é vestido num manequim — dá para usar assim,
  // mas quem quer se ver precisa saber onde colocar a foto.
  useEffect(() => {
    let vivo = true
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => { if (vivo) setSemFoto(!d?.photo?.image_url) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  // O contador avança só enquanto a requisição está em voo; o reset acontece ao disparar.
  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setProgress((p) => Math.min(p + 1, PROGRESS.length - 1)), 2600)
    return () => clearInterval(id)
  }, [loading])

  async function generate(
    options: { excludeIds?: string[]; lockedIds?: string[]; instruction?: string; baseOutfitId?: string } = {},
  ) {
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
          render_image: false,
          novelty,
          exclude_item_ids: options.excludeIds ?? [],
          locked_item_ids: options.lockedIds ?? [],
          instruction: options.instruction,
          base_outfit_id: options.baseOutfitId,
        }),
      })
      const payload: LookResponse = await res.json()
      if (!payload.success) throw new Error(payload.error ?? 'Não consegui montar o look.')

      setResult(payload)
      setImagens({})
      setFalhas({})
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      if (payload.proposals?.length) void vestirTodas(payload.proposals)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao montar o look.')
    } finally {
      setLoading(false)
    }
  }

  /** Trocar peça: trava o resto do look e exclui só a peça recusada. */
  async function swapPiece(p: Proposal, role: string) {
    const target = p.items.find((i) => i.role === role)
    if (!target) return
    await generate({
      excludeIds: [target.item.id],
      lockedIds: p.items.filter((i) => i.role !== role).map((i) => i.item.id),
    })
  }

  async function sendFeedback(p: Proposal, action: 'liked' | 'saved' | 'rejected') {
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outfit_id: p.outfitId, action }),
    })

    if (action !== 'saved') {
      setFeedback('Anotado — vou usar isso nas próximas sugestões.')
      return
    }

    // Look salvo é look guardado VESTIDO: sem a foto no corpo, Meus Looks vira
    // um mosaico de peças soltas. A geração é paga, mas salvar é um ato
    // deliberado — não acontece nas três opções, só na que ela escolheu.
    setGerando(p.outfitId)
    setFeedback('Look salvo. Caprichando na foto com você vestindo…')
    const ok = await vestir(p.outfitId, 'final')
    setGerando(null)
    setFeedback(
      ok
        ? 'Look salvo em Meus looks, com a foto no corpo.'
        : 'Look salvo em Meus looks. A foto no corpo não saiu agora — dá para gerar depois em Meus looks.',
    )
  }

  /** Ajuste escrito sobre um look existente. */
  async function aplicarAjuste(p: Proposal) {
    const texto = (ajuste[p.outfitId] ?? '').trim()
    if (!texto) return
    setAjustando(p.outfitId)
    try {
      await generate({ instruction: texto, baseOutfitId: p.outfitId })
      setAjuste((prev) => ({ ...prev, [p.outfitId]: '' }))
    } finally {
      setAjustando(null)
    }
  }

  /**
   * Veste o look num corpo. Look é roupa no corpo, não peça recortada: a
   * prévia das 3 opções sai sozinha, em qualidade média, e o acabamento fica
   * para a que a pessoa salvar.
   */
  async function vestir(outfitId: string, qualidade: 'previa' | 'final'): Promise<boolean> {
    try {
      const res = await fetch(`/api/outfits/${outfitId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualidade }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui gerar a imagem.')
      setImagens((prev) => ({ ...prev, [outfitId]: payload.imageUrl }))
      return true
    } catch (e) {
      // Falha de uma opção não derruba as outras: aquele cartão fica na
      // vitrine de peças, com o aviso no lugar do corpo.
      setFalhas((prev) => ({
        ...prev,
        [outfitId]: e instanceof Error ? e.message : 'Não consegui vestir este look.',
      }))
      return false
    }
  }

  /** Dispara as três de uma vez; cada cartão troca assim que a sua fica pronta. */
  async function vestirTodas(propostas: Proposal[]) {
    setVestindo(new Set(propostas.map((p) => p.outfitId)))
    await Promise.all(
      propostas.map(async (p) => {
        await vestir(p.outfitId, 'previa')
        setVestindo((prev) => {
          const resto = new Set(prev)
          resto.delete(p.outfitId)
          return resto
        })
      }),
    )
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

      <section className="mt-8">
        <h2 className="display text-2xl">Quanto quero ousar?</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {NOVELTY_LEVELS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={novelty === n}
              onClick={() => setNovelty(n)}
              className={`rounded-soft border px-3 py-3 text-sm capitalize transition-colors ${
                novelty === n ? 'border-espresso bg-espresso text-bone' : 'border-sand text-cocoa hover:border-clay'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-mist">
          {novelty === 'classico' && 'Combinações consagradas, sem surpresa.'}
          {novelty === 'equilibrado' && 'Seguro, com espaço para uma escolha menos óbvia.'}
          {novelty === 'ousado' && 'Combinações menos previsíveis, usando o que você tem.'}
        </p>
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

      {result?.proposals && result.proposals.length > 0 && !loading && (
        <div ref={resultRef} className="rise mt-10 scroll-mt-24">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-2xl">
              {result.proposals.length === 1 ? 'Seu look' : `${result.proposals.length} opções para você`}
            </h2>
            {result.degraded && <span className="text-xs text-mist">{result.imageWarning}</span>}
          </div>

          {semFoto && (
            <p className="mt-2 rounded-soft bg-ivory px-3 py-2 text-xs leading-relaxed text-cocoa">
              Estou vestindo os looks num manequim.{' '}
              <Link href="/profile" className="underline underline-offset-2">
                Coloque uma foto sua de corpo inteiro no perfil
              </Link>{' '}
              para se ver com as roupas.
            </p>
          )}

          {feedback && <p className="mt-2 text-xs text-cocoa">{feedback}</p>}
          {result.refinementNotes && result.refinementNotes.length > 0 && (
            <p className="mt-2 rounded-soft bg-ivory px-3 py-2 text-xs leading-relaxed text-cocoa">
              {result.refinementNotes.join(' ')}
            </p>
          )}

          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {result.proposals.map((p, i) => {
              const imagem = imagens[p.outfitId]
              return (
                <li key={p.outfitId} className="flex flex-col overflow-hidden rounded-card border border-sand/70 bg-ivory/40">
                  <figure className="relative aspect-[2/3] overflow-hidden bg-ivory">
                    {imagem ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL assinada
                      <img src={imagem} alt={`Opção ${i + 1}`} className="size-full object-cover" />
                    ) : (
                      // Enquanto a foto no corpo nao chega, as pecas ja aparecem
                      // compostas — a tela nunca fica vazia esperando.
                      <>
                        <LookCollage items={p.items} />
                        {vestindo.has(p.outfitId) && (
                          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-bone/85 py-2 text-xs text-cocoa backdrop-blur-sm">
                            <Loader2 className="size-3.5 animate-spin" /> Vestindo o look…
                          </span>
                        )}
                        {falhas[p.outfitId] && !vestindo.has(p.outfitId) && (
                          <span className="absolute inset-x-0 bottom-0 bg-bone/90 px-3 py-2 text-[0.6875rem] leading-snug text-cocoa">
                            {falhas[p.outfitId]}
                          </span>
                        )}
                      </>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-bone/90 px-2.5 py-1 text-[0.625rem] font-medium">
                      {i === 0 ? 'Principal' : `Opção ${i + 1}`}
                    </span>
                  </figure>

                  <div className="flex flex-1 flex-col p-4">
                    <ul className="space-y-1.5">
                      {p.items.map(({ role, item }) => (
                        <li key={item.id} className="flex items-baseline gap-2 text-xs">
                          <span className="w-20 shrink-0 text-mist">{roleLabel(role)}</span>
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3 flex-1 text-xs leading-relaxed text-cocoa">{p.explanation}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="sm" onClick={() => sendFeedback(p, 'liked')}>
                        <Heart className="size-3.5" /> Gostei
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => sendFeedback(p, 'saved')}
                        disabled={gerando !== null}
                      >
                        {gerando === p.outfitId ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                        {gerando === p.outfitId ? 'Salvando…' : 'Salvar'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSwapRole(swapRole === p.outfitId ? null : p.outfitId)}
                      >
                        <Replace className="size-3.5" /> Trocar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => generate({ excludeIds: p.items.map((x) => x.item.id) })}>
                        <RefreshCw className="size-3.5" /> Outra
                      </Button>
                    </div>

                    {/*
                      Ajuste em linguagem natural sobre ESTE look.
                      O resto das pecas fica travado, entao "inclua cinto
                      vermelho" muda uma coisa so, em vez de sortear tudo de novo.
                    */}
                    <div className="mt-3 border-t border-sand/60 pt-3">
                      <span className="eyebrow block pb-1.5">Ajustar com suas palavras</span>
                      <div className="flex gap-1.5">
                        <input
                          value={ajuste[p.outfitId] ?? ''}
                          onChange={(e) => setAjuste((prev) => ({ ...prev, [p.outfitId]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.code === 'Enter' || e.code === 'NumpadEnter') aplicarAjuste(p)
                          }}
                          placeholder="inclua cinto vermelho"
                          className="min-w-0 flex-1 rounded-soft border border-sand bg-transparent px-2.5 py-2 text-xs placeholder:text-mist focus:border-clay focus:outline-none"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => aplicarAjuste(p)}
                          disabled={ajustando !== null || !(ajuste[p.outfitId] ?? '').trim()}
                        >
                          {ajustando === p.outfitId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Wand2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {swapRole === p.outfitId && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-sand/60 pt-3">
                        {p.items.map(({ role }) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => swapPiece(p, role)}
                            className="rounded-full border border-sand px-2.5 py-1 text-[0.6875rem] text-cocoa hover:border-clay"
                          >
                            Trocar {roleLabel(role).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
