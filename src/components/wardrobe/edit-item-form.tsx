'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, Check, Loader2, Sparkles, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemThumb } from '@/components/ui/item-thumb'
import {
  ALL_SUBCATEGORIES, CATEGORIES, OCCASIONS, PATTERNS, SPORT_TYPES,
  type Classification, type WardrobeItem,
} from '@/schemas/wardrobe'
import { titleCase } from '@/lib/utils'
import { occasionLabel } from '@/lib/labels'
import { downscale } from '@/lib/image-client'

/**
 * Edição da peça: trocar a foto e corrigir o que a classificação errou.
 *
 * A IA acerta a maior parte, mas erra acento, confunde peça quando a foto tem
 * duas juntas, e não sabe a formalidade que a peça tem para VOCÊ. Sem esta tela
 * o erro fica preso no guarda-roupa e contamina todo look montado depois.
 */
export function EditItemForm({ item }: { item: WardrobeItem }) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState({
    name: item.name,
    brand: item.brand ?? '',
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    pattern: item.pattern,
    material: item.material,
    formality: item.formality,
    sport_type: item.sport_type,
    occasion: item.occasion,
  })
  const [novaFoto, setNovaFoto] = useState<string | null>(null)
  const [reclassificando, setReclassificando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function patch<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function trocarFoto(file: File) {
    setError(null)
    setAviso(null)
    try {
      const dataUrl = await downscale(file, 768)
      setNovaFoto(dataUrl)
    } catch {
      setError('Não consegui ler essa imagem.')
    }
  }

  /** Reclassifica a partir da foto atual — útil quando a foto trocou. */
  async function reclassificar() {
    if (!novaFoto) return
    setReclassificando(true)
    setError(null)
    try {
      const res = await fetch('/api/wardrobe/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: novaFoto, hint: draft.name }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Falha ao reclassificar.')

      const c = payload.classification as Classification
      setDraft((d) => ({
        ...d,
        category: c.category,
        subcategory: c.subcategory,
        color: c.color,
        pattern: c.pattern,
        material: c.material,
        formality: c.formality,
        sport_type: c.sport_type,
        occasion: c.occasion,
      }))
      setAviso(payload.warning ?? 'Campos preenchidos de novo pela foto. Revise antes de salvar.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao reclassificar.')
    } finally {
      setReclassificando(false)
    }
  }

  async function salvar() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/wardrobe/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          brand: draft.brand.trim() || undefined,
          ...(novaFoto ? { image_original_url: novaFoto } : {}),
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui salvar.')
      router.push('/wardrobe')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.')
      setSaving(false)
    }
  }

  async function excluir() {
    if (!confirm(`Remover "${item.name}" do guarda-roupa?`)) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/wardrobe/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Não consegui remover.')
      router.push('/wardrobe')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao remover.')
      setRemoving(false)
    }
  }

  return (
    <div className="rise pb-8">
      <Link href="/wardrobe" className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-espresso">
        <ArrowLeft className="size-4" /> Guarda-roupa
      </Link>

      <p className="eyebrow mt-5">Editar peça</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">{item.name}</h1>

      {error && (
        <p role="alert" className="mt-5 rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[320px_1fr]">
        <div>
          <div className="aspect-[3/4] overflow-hidden rounded-card bg-ivory">
            {novaFoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local em data URL
              <img src={novaFoto} alt="Nova foto" className="size-full object-cover" />
            ) : (
              <ItemThumb item={item} />
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => cameraInput.current?.click()}>
              <Camera className="size-4" /> Câmera
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> Galeria
            </Button>
          </div>

          {novaFoto && (
            <>
              <Button variant="ghost" className="mt-2 w-full" onClick={reclassificar} disabled={reclassificando}>
                {reclassificando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Reler os dados da nova foto
              </Button>
              <button
                type="button"
                onClick={() => setNovaFoto(null)}
                className="mt-1 w-full text-xs text-mist hover:text-espresso"
              >
                Descartar a nova foto
              </button>
            </>
          )}

          <input
            ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => e.target.files?.[0] && trocarFoto(e.target.files[0])}
          />
          <input
            ref={fileInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && trocarFoto(e.target.files[0])}
          />
        </div>

        <div className="space-y-4">
          {aviso && (
            <p className="rounded-soft bg-ivory px-4 py-2.5 text-xs leading-relaxed text-cocoa">{aviso}</p>
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
                onChange={(v) => patch('category', v as typeof draft.category)}
              />
            </Field>
            <Field label="Subcategoria">
              <Select value={draft.subcategory} options={[...ALL_SUBCATEGORIES]} onChange={(v) => patch('subcategory', v)} />
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
            <Field label="Estampa">
              <Select value={draft.pattern} options={[...PATTERNS]} onChange={(v) => patch('pattern', v as typeof draft.pattern)} />
            </Field>
            <Field label="Material">
              <input
                value={draft.material}
                onChange={(e) => patch('material', e.target.value)}
                className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
              />
            </Field>
            <Field label="Esporte">
              <Select
                value={draft.sport_type}
                options={[...SPORT_TYPES]}
                onChange={(v) => patch('sport_type', v as typeof draft.sport_type)}
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

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={salvar} disabled={saving || !draft.name.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Salvar alterações
            </Button>
            <Button variant="ghost" onClick={excluir} disabled={removing}>
              {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Remover peça
            </Button>
          </div>
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
        <option key={o} value={o}>{titleCase(o)}</option>
      ))}
    </select>
  )
}
