'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup' | 'magic'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()
    if (!supabase) {
      setError('Supabase não configurado. O app está em modo demo e não exige login.')
      setLoading(false)
      return
    }

    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        })
        if (error) throw error
        setMessage('Enviamos um link de acesso para o seu e-mail.')
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Conta criada. Confirme o e-mail, se a confirmação estiver ativa, e entre.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(next)
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rise mx-auto max-w-sm pt-10">
      <p className="eyebrow">Wardrobe AI</p>
      <h1 className="display mt-3 text-4xl">
        Vista o que
        <br />
        você já tem.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-cocoa">
        Entre para acessar seu guarda-roupa e seus looks.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <label className="block">
          <span className="eyebrow block pb-1.5">E-mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
          />
        </label>

        {mode !== 'magic' && (
          <label className="block">
            <span className="eyebrow block pb-1.5">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-soft border border-sand bg-transparent px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>
        )}
        {message && (
          <p className="rounded-soft bg-ivory px-4 py-3 text-sm text-cocoa">{message}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {mode === 'signup' ? 'Criar conta' : mode === 'magic' ? 'Enviar link' : 'Entrar'}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-mist">
        {mode !== 'signin' && (
          <button type="button" className="hover:text-espresso" onClick={() => setMode('signin')}>
            Já tenho conta
          </button>
        )}
        {mode !== 'signup' && (
          <button type="button" className="hover:text-espresso" onClick={() => setMode('signup')}>
            Criar conta
          </button>
        )}
        {mode !== 'magic' && (
          <button type="button" className="hover:text-espresso" onClick={() => setMode('magic')}>
            Entrar por link no e-mail
          </button>
        )}
      </div>
    </div>
  )
}
