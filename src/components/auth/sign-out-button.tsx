'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut}>
      <LogOut className="size-4" /> Sair
    </Button>
  )
}
