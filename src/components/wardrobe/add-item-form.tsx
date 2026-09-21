'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ALL_SUBCATEGORIES, CATEGORIES, OCCASIONS, SPORT_TYPES,
  type DetectedGarment,
} from '@/schemas/wardrobe'
import { titleCase } from '@/lib/utils'
import { garmentName, occasionLabel, subcategoryLabel } from '@/lib/labels'
import { downscale } from '@/lib/image-client'

type Step = 'capture' | 'classifying' | 'review' | 'saving'

interface Draft extends DetectedGarment {
  name: string
  brand: string
  incluir: boolean
}

/**
 * Cadastro de peça.
 *
 * Uma foto pode conter mais de uma peça — é assim que a pessoa fotografa de
 * verdade, o conjunto estendido na cama. Antes o sistema catalogava "blusa e
 * calça" como uma peça só, e o erro contaminava todo look montado depois.
 * Agora cada peça detectada vira uma linha revisável.
 */
export function AddItemForm() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setStep('classifying')
    try {
      const dataUrl = await downscale(file, 768)
      setPreview(dataUrl)

      const res = await fetch('/api/wardrobe/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, hint: file.name.replace(/\.[^.]+$/, '') }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui classificar a peça.')

      const detected = payload.items as DetectedGarment[]
      setNotice(payload.warning ?? null)
      setDrafts(detected.map((c) => ({ ...c, name: suggestName(c), brand: '', incluir: true })))
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao processar a imagem.')
      setStep('capture')
    }
  }

  function patch<K extends keyof Draft>(index: number, key: K, value: Draft[K]) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [key]: value } : d)))
  }

  async function save() {
    const selecionadas = drafts.filter((d) => d.incluir)
    if (selecionadas.length === 0) return

    setStep('saving')
    setError(null)
    try {
      for (const [i, draft] of selecionadas.entries()) {
        setProgresso(`Salvando ${i + 1} de ${selecionadas.length}…`)
        const res = await fetch('/api/wardrobe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...draft,
            brand: draft.brand.trim() || undefined,
            // Todas compartilham a foto original; a pessoa troca depois se quiser.
            image_original_url: preview ?? undefined,
          }),
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error ?? `Falha ao salvar "${draft.name}".`)
      }
      router.push('/wardrobe')
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
      <p className="eyebrow">Nova peça</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">Cadastrar no guarda-roupa</h1>

      {error && (
        <p role="alert" className="mt-5 rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[320px_1fr]">
        <div>
          <div className="aspect-[3/4] overflow-hidden rounded-card bg-ivory">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local em data URL
              <img src={preview} alt="Peça enviada" className="size-full object-cover" />
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
              Identificando as peças…
            </div>
          )}

          {step === 'capture' && (
            <div className="rounded-card border border-dashed border-sand px-5 py-8 text-sm leading-relaxed text-cocoa">
              Tire a foto sobre um fundo liso. Pode fotografar <strong>mais de uma peça</strong> na
              mesma imagem — a IA separa cada uma, e você revisa antes de salvar.
            </div>
          )}

          {drafts.length > 0 && (step === 'review' || step === 'saving') && (
            <div className="space-y-4">
              {notice && (
                <p className="rounded-soft bg-ivory px-4 py-2.5 text-xs leading-relaxed text-cocoa">{notice}</p>
              )}

              {drafts.map((draft, index) => (
                <div
                  key={index}
                  className={`rounded-card border p-4 transition-colors ${
                    draft.incluir ? 'border-sand bg-ivory/40' : 'border-sand/50 bg-transparent opacity-55'
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-2.5 pb-3">
                    <input
                      type="checkbox"
                      checked={draft.incluir}
                      onChange={(e) => patch(index, 'incluir', e.target.checked)}
                      className="size-4 accent-[var(--color-espresso)]"
                    />
                    <span className="text-sm font-medium">
                      Peça {index + 1}
                      {draft.position ? <span className="font-normal text-mist"> · {draft.position}</span> : null}
                    </span>
                  </label>

                  <div className="space-y-3">
                    <Field label="Nome">
                      <input
                        value={draft.name}
                        onChange={(e) => patch(index, 'name', e.target.value)}
                        className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Categoria">
                        <Select
                          value={draft.category}
                          options={[...CATEGORIES]}
                          onChange={(v) => patch(index, 'category', v as Draft['category'])}
                        />
                      </Field>
                      <Field label="Subcategoria">
                        <Select
                          value={draft.subcategory}
                          options={[...ALL_SUBCATEGORIES]}
                          label={subcategoryLabel}
                          onChange={(v) => patch(index, 'subcategory', v)}
                        />
                      </Field>
                      <Field label="Cor">
                        <input
                          value={draft.color}
                          onChange={(e) => patch(index, 'color', e.target.value)}
                          className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
                        />
                      </Field>
                      <Field label="Marca (opcional)">
                        <input
                          value={draft.brand}
                          onChange={(e) => patch(index, 'brand', e.target.value)}
                          className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
                        />
                      </Field>
                      <Field label="Esporte">
                        <Select
                          value={draft.sport_type}
                          options={[...SPORT_TYPES]}
                          onChange={(v) => patch(index, 'sport_type', v as Draft['sport_type'])}
                        />
                      </Field>
                      <Field label={`Formalidade: ${draft.formality}`}>
                        <input
                          type="range" min={0} max={10} value={draft.formality}
                          onChange={(e) => patch(index, 'formality', Number(e.target.value))}
                          className="w-full accent-[var(--color-espresso)]"
                        />
                      </Field>
                    </div>

                    <Field label="Ocasiões">
                      <div className="flex flex-wrap gap-2">
                        {OCCASIONS.map((o) => {
                          const active = draft.occasion.includes(o)
                          return (
                            <button
                              key={o}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                patch(
                                  index,
                                  'occasion',
                                  active ? draft.occasion.filter((x) => x !== o) : [...draft.occasion, o],
                                )
                              }
                              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                                active ? 'border-espresso bg-espresso text-bone' : 'border-sand text-cocoa hover:border-clay'
                              }`}
                            >
                              {occasionLabel(o)}
                            </button>
                          )
                        })}
                      </div>
                    </Field>
                  </div>
                </div>
              ))}

              <Button onClick={save} disabled={step === 'saving' || selecionadas === 0} className="w-full md:w-auto">
                {step === 'saving' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {progresso ?? (selecionadas === 1 ? 'Salvar peça' : `Salvar ${selecionadas} peças`)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow block pb-1.5">{label}</span>
      {children}
    </label>
  )
}

function Select({
  value, options, onChange, label = titleCase,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  label?: (v: string) => string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>{label(o)}</option>
      ))}
    </select>
  )
}

function suggestName(c: DetectedGarment): string {
  return garmentName(c.subcategory, c.color)
}
