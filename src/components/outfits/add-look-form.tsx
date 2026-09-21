'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, Check, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ALL_SUBCATEGORIES, CATEGORIES, type DetectedGarment } from '@/schemas/wardrobe'
import { STYLES } from '@/schemas/outfit'
import { garmentName, styleLabel, subcategoryLabel } from '@/lib/labels'
import { downscale } from '@/lib/image-client'

type Step = 'capture' | 'classifying' | 'review' | 'saving'

interface Draft extends DetectedGarment {
  name: string
  incluir: boolean
}

/**
 * Arquiva um look que já existe em foto.
 *
 * A foto do conjunto pronto é a melhor fonte de dado que este produto tem: já
 * mostra peças que combinam de verdade, escolhidas pela própria pessoa. Em vez
 * de virar uma foto solta numa galeria, ela é desmontada em peças que voltam em
 * combinações futuras.
 */
export function AddLookForm() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [nome, setNome] = useState('')
  const [estilo, setEstilo] = useState<string>('casual')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setStep('classifying')
    try {
      const dataUrl = await downscale(file, 900)
      setPreview(dataUrl)

      const res = await fetch('/api/wardrobe/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, hint: 'look completo montado' }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui identificar as peças.')

      const detected = payload.items as DetectedGarment[]
      setNotice(
        detected.length === 1
          ? 'Identifiquei uma peça. Se o look tem mais, vale uma foto com as peças mais visíveis.'
          : `Identifiquei ${detected.length} peças neste look.`,
      )
      setDrafts(detected.map((c) => ({ ...c, name: garmentName(c.subcategory, c.color), incluir: true })))
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao processar a foto.')
      setStep('capture')
    }
  }

  function patch<K extends keyof Draft>(index: number, key: K, value: Draft[K]) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [key]: value } : d)))
  }

  async function save() {
    const selecionadas = drafts.filter((d) => d.incluir)
    if (selecionadas.length === 0 || !preview) return

    setStep('saving')
    setError(null)
    setProgresso('Arquivando o look…')
    try {
      const res = await fetch('/api/outfits/from-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: preview,
          name: nome.trim() || undefined,
          style: estilo,
          items: selecionadas.map((d) => ({
            name: d.name,
            category: d.category,
            subcategory: d.subcategory,
            color: d.color,
            secondary_colors: d.secondary_colors,
            pattern: d.pattern,
            material: d.material,
            style: d.style,
            formality: d.formality,
            sport_type: d.sport_type,
            season: d.season,
            occasion: d.occasion,
            description: d.description,
          })),
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Falha ao arquivar o look.')

      router.push('/outfits')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.')
      setStep('review')
      setProgresso(null)
    }
  }

  const selecionadas = drafts.filter((d) => d.incluir).length

  return (
    <div className="rise pb-8">
      <Link href="/outfits" className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-espresso">
        <ArrowLeft className="size-4" /> Meus looks
      </Link>

      <p className="eyebrow mt-5">Look pronto</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">Arquivar um look que você montou</h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-cocoa">
        Envie a foto de um look seu. Eu separo as peças, guardo cada uma no guarda-roupa e
        uso essas peças nas próximas combinações.
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[320px_1fr]">
        <div>
          <div className="aspect-[3/4] overflow-hidden rounded-card bg-ivory">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local em data URL
              <img src={preview} alt="Look enviado" className="size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-mist">
                <Camera className="size-8" strokeWidth={1.4} />
                <span className="text-xs">Nenhuma foto ainda</span>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => cameraInput.current?.click()} disabled={step === 'classifying'}>
              <Camera className="size-4" /> Câmera
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={step === 'classifying'}>
              <Upload className="size-4" /> Galeria
            </Button>
          </div>

          <input
            ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={fileInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        <div>
          {step === 'classifying' && (
            <div className="flex items-center gap-3 rounded-card bg-ivory px-5 py-6 text-sm text-cocoa">
              <Loader2 className="size-4 animate-spin" />
              Separando as peças do look…
            </div>
          )}

          {step === 'capture' && (
            <div className="rounded-card border border-dashed border-sand px-5 py-8 text-sm leading-relaxed text-cocoa">
              Pode ser uma foto sua vestindo o look, ou o conjunto estendido. Quanto mais
              visíveis as peças, melhor a separação.
            </div>
          )}

          {drafts.length > 0 && (step === 'review' || step === 'saving') && (
            <div className="space-y-4">
              {notice && (
                <p className="rounded-soft bg-ivory px-4 py-2.5 text-xs leading-relaxed text-cocoa">{notice}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="eyebrow block pb-1.5">Nome do look (opcional)</span>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Almoço de domingo"
                    className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm placeholder:text-mist focus:border-clay focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="eyebrow block pb-1.5">Estilo</span>
                  <select
                    value={estilo}
                    onChange={(e) => setEstilo(e.target.value)}
                    className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
                  >
                    {STYLES.map((s) => (
                      <option key={s} value={s}>{styleLabel(s)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                {drafts.map((draft, index) => (
                  <div
                    key={index}
                    className={`flex flex-wrap items-center gap-2 rounded-soft border p-3 transition-colors ${
                      draft.incluir ? 'border-sand bg-ivory/40' : 'border-sand/50 opacity-55'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={draft.incluir}
                      onChange={(e) => patch(index, 'incluir', e.target.checked)}
                      className="size-4 accent-[var(--color-espresso)]"
                    />
                    <input
                      value={draft.name}
                      onChange={(e) => patch(index, 'name', e.target.value)}
                      className="min-w-32 flex-1 rounded-soft border border-sand bg-transparent px-2.5 py-1.5 text-sm focus:border-clay focus:outline-none"
                    />
                    <select
                      value={draft.category}
                      onChange={(e) => patch(index, 'category', e.target.value as Draft['category'])}
                      className="rounded-soft border border-sand bg-transparent px-2 py-1.5 text-xs focus:border-clay focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={draft.subcategory}
                      onChange={(e) => patch(index, 'subcategory', e.target.value)}
                      className="rounded-soft border border-sand bg-transparent px-2 py-1.5 text-xs focus:border-clay focus:outline-none"
                    >
                      {ALL_SUBCATEGORIES.map((sub) => (
                        <option key={sub} value={sub}>{subcategoryLabel(sub)}</option>
                      ))}
                    </select>
                    {draft.position && <span className="text-xs text-mist">{draft.position}</span>}
                  </div>
                ))}
              </div>

              <Button onClick={save} disabled={step === 'saving' || selecionadas === 0}>
                {step === 'saving' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {progresso ?? `Arquivar look com ${selecionadas} ${selecionadas === 1 ? 'peça' : 'peças'}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
