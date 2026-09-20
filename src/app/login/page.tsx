import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="shimmer mx-auto mt-16 h-80 max-w-sm rounded-card" />}>
      <LoginForm />
    </Suspense>
  )
}
