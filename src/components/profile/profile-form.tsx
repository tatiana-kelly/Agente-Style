'use client'

import { useState } from 'react'
import { Camera, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UserProfile } from '@/schemas/user'
import { titleCase } from '@/lib/utils'

const STYLE_TAGS = ['minimalista', 'clássico', 'esportivo', 'romântico', 'moderno', 'despojado']
const COLORS = ['preto', 'branco', 'marinho', 'bege', 'cinza', 'verde', 'vinho', 'rosa', 'azul', 'marrom']

export function ProfileForm({
  initialProfile,
  photoUrl,
  isDemo,
}: {
  initialProfile: UserProfile | null
  photoUrl: string | null
  isDemo: boolean
}) {
  const [name, setName] = useState(initialProfile?.name ?? '')
  const [height, setHeight] = useState(initialProfile?.height?.toString() ?? '')
  const [styles, setStyles] = useState<string[]>(initialProfile?.style_preferences ?? [])
  const [favorite, setFavorite] = useState<string[]>(initialProfile?.favorite_colors ?? [])
  const [avoid, setAvoid] = useState<string[]>(initialProfile?.avoid_colors ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(list: string[], setter: (v: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          height: height ? Number(height) : null,
          style_preferences: styles,
          favorite_colors: favorite,
          avoid_colors: avoid,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui salvar o perfil.')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rise pb-8">
      <p className="eyebrow">Perfil</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">Meu estilo</h1>

      {isDemo && (
        <p className="mt-5 rounded-soft bg-ivory px-4 py-2.5 text-xs leading-relaxed text-cocoa">
          Modo demo: as alterações valem só para esta sessão.
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[260px_1fr]">
        <div>
          <div className="aspect-[3/4] overflow-hidden rounded-card bg-ivory">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada / asset local
              <img src={photoUrl} alt="Sua foto principal" className="size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-mist">
                <Camera className="size-8" strokeWidth={1.4} />
                <span className="text-xs">Sem foto principal</span>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-mist">
            Foto de corpo inteiro, luz boa, fundo neutro e roupa simples. É ela que a IA usa para
            preservar sua identidade na visualização do look.
          </p>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="eyebrow block pb-1.5">Nome</span>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false) }}
              className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
            />
          </label>

          <label className="block max-w-40">
            <span className="eyebrow block pb-1.5">Altura (cm)</span>
            <input
              type="number" min={100} max={250} value={height}
              onChange={(e) => { setHeight(e.target.value); setSaved(false) }}
              className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
            />
          </label>

          <TagGroup label="Estilos que me representam" options={STYLE_TAGS} selected={styles} onToggle={(v) => toggle(styles, setStyles, v)} />
          <TagGroup label="Cores que amo" options={COLORS} selected={favorite} onToggle={(v) => toggle(favorite, setFavorite, v)} />
          <TagGroup label="Cores que evito" options={COLORS} selected={avoid} onToggle={(v) => toggle(avoid, setAvoid, v)} />

          {error && (
            <p role="alert" className="rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>
          )}

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {saved ? 'Salvo' : 'Salvar perfil'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function TagGroup({
  label, options, selected, onToggle,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div>
      <span className="eyebrow block pb-2">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                active ? 'border-espresso bg-espresso text-bone' : 'border-sand text-cocoa hover:border-clay'
              }`}
            >
              {titleCase(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
