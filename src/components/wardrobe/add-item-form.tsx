'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ALL_SUBCATEGORIES, CATEGORIES, OCCASIONS, SPORT_TYPES, type Classification,
} from '@/schemas/wardrobe'
import { titleCase } from '@/lib/utils'
import { occasionLabel } from '@/lib/labels'

type Step = 'capture' | 'classifying' | 'review' | 'saving'

export function AddItemForm() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [draft, setDraft] = useState<(Classification & { name: string; brand: string }) | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      const c = payload.classification as Classification
      setNotice(payload.warning ?? null)
      setDraft({ ...c, name: suggestName(c), brand: '' })
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao processar a imagem.')
      setStep('capture')
    }
  }

  async function save() {
    if (!draft) return
    setStep('saving')
    setError(null)
    try {
      const res = await fetch('/api/wardrobe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, image_original_url: preview ?? undefined, thumbnail_url: preview ?? undefined }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui salvar a peça.')
      router.push('/wardrobe')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.')
      setStep('review')
    }
  }

  function patch<K extends keyof NonNullable<typeof draft>>(key: K, value: NonNullable<typeof draft>[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <div className="rise pb-8">
      <p className="eyebrow">Nova peça</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">Cadastrar no guarda-roupa</h1>

      {error && (
        <p role="alert" className="mt-5 rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">
          {error}
        </p>
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
              Identificando a peça…
            </div>
          )}

          {step === 'capture' && (
            <div className="rounded-card border border-dashed border-sand px-5 py-8 text-sm leading-relaxed text-cocoa">
              Tire a foto da peça sobre um fundo liso, esticada ou pendurada. A IA preenche
              categoria, cor, tecido e formalidade — você revisa antes de salvar.
            </div>
          )}

          {draft && (step === 'review' || step === 'saving') && (
            <div className="space-y-4">
              {notice && (
                <p className="rounded-soft bg-ivory px-4 py-2.5 text-xs leading-relaxed text-cocoa">{notice}</p>
              )}

              <Field label="Nome">
                <input
                  value={draft.name}
                  onChange={(e) => patch('name', e.target.value)}
                  className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <Select
                    value={draft.category}
                    options={[...CATEGORIES]}
                    onChange={(v) => patch('category', v as Classification['category'])}
                  />
                </Field>
                <Field label="Subcategoria">
                  <Select
                    value={draft.subcategory}
                    options={[...ALL_SUBCATEGORIES]}
                    onChange={(v) => patch('subcategory', v)}
                  />
                </Field>
                <Field label="Cor">
                  <input
                    value={draft.color}
                    onChange={(e) => patch('color', e.target.value)}
                    className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
                  />
                </Field>
                <Field label="Marca (opcional)">
                  <input
                    value={draft.brand}
                    onChange={(e) => patch('brand', e.target.value)}
                    className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
                  />
                </Field>
                <Field label="Esporte">
                  <Select
                    value={draft.sport_type}
                    options={[...SPORT_TYPES]}
                    onChange={(v) => patch('sport_type', v as Classification['sport_type'])}
                  />
                </Field>
                <Field label={`Formalidade: ${draft.formality}`}>
                  <input
                    type="range" min={0} max={10} value={draft.formality}
                    onChange={(e) => patch('formality', Number(e.target.value))}
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
                          patch('occasion', active ? draft.occasion.filter((x) => x !== o) : [...draft.occasion, o])
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

              <Button onClick={save} disabled={step === 'saving' || !draft.name.trim()} className="w-full md:w-auto">
                {step === 'saving' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Salvar peça
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
  value, options, onChange,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {titleCase(o)}
        </option>
      ))}
    </select>
  )
}

function suggestName(c: Classification): string {
  return `${titleCase(c.subcategory)} ${c.color}`.trim()
}

/**
 * Reduz a imagem antes de enviar: menos payload, menos custo de visão,
 * e o celular não trava subindo 12 MP.
 */
async function downscale(file: File, maxSide: number): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', 0.85)
}
