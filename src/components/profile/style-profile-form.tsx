'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CHURCH_STYLES, TENNIS_STYLES, WORK_DRESS_CODES, type StyleProfile,
} from '@/schemas/style-profile'
import { titleCase } from '@/lib/utils'

const MODESTY_LABELS = ['Sem exigência', 'Discreto', 'Coberto', 'Máxima cobertura']

/**
 * Dress code por contexto (§12).
 * Existe porque "trabalho" e "igreja" não querem dizer a mesma coisa para todo
 * mundo — quem define o registro é a pessoa, não o sistema.
 */
export function StyleProfileForm() {
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/style-profile')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setProfile(d.profile ?? null)
      })
      .catch(() => {
        if (!cancelled) setError('Não consegui carregar seu perfil de estilo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function patch<K extends keyof StyleProfile>(key: K, value: StyleProfile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p))
    setSaved(false)
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/style-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_style: profile.work_style,
          church_style: profile.church_style,
          tennis_style: profile.tennis_style,
          modesty_level: profile.modesty_level,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui salvar.')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="shimmer mt-8 h-48 rounded-card" />
  if (!profile) return null

  return (
    <section className="mt-10 border-t border-sand/60 pt-8">
      <p className="eyebrow">Como você se veste</p>
      <h2 className="display mt-2 text-2xl">Seu registro em cada contexto</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-cocoa">
        Isto muda o que a IA considera apropriado. Um mesmo pedido de &ldquo;trabalho&rdquo; vira um
        look diferente dependendo do que você responde aqui.
      </p>

      <div className="mt-6 space-y-6">
        <Choice
          label="Como você se veste no trabalho?"
          options={[...WORK_DRESS_CODES]}
          value={profile.work_style}
          onChange={(v) => patch('work_style', v as StyleProfile['work_style'])}
        />
        <Choice
          label="E para a igreja?"
          options={[...CHURCH_STYLES]}
          value={profile.church_style}
          onChange={(v) => patch('church_style', v as StyleProfile['church_style'])}
        />
        <Choice
          label="No tênis?"
          options={[...TENNIS_STYLES]}
          value={profile.tennis_style}
          onChange={(v) => patch('tennis_style', v as StyleProfile['tennis_style'])}
        />

        <div>
          <span className="eyebrow block pb-2">
            Nível de cobertura: {MODESTY_LABELS[profile.modesty_level]}
          </span>
          <input
            type="range"
            min={0}
            max={3}
            value={profile.modesty_level}
            onChange={(e) => patch('modesty_level', Number(e.target.value))}
            className="w-full max-w-sm accent-[var(--color-espresso)]"
          />
          <p className="mt-1 text-xs text-mist">
            A partir de &ldquo;Coberto&rdquo;, shorts, regata e top esportivo saem das sugestões.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>
        )}

        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {saved ? 'Salvo' : 'Salvar preferências'}
        </Button>
      </div>
    </section>
  )
}

function Choice({
  label, options, value, onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <span className="eyebrow block pb-2">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              value === option ? 'border-espresso bg-espresso text-bone' : 'border-sand text-cocoa hover:border-clay'
            }`}
          >
            {titleCase(option)}
          </button>
        ))}
      </div>
    </div>
  )
}
