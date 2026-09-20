import { Suspense } from 'react'
import { LookStudio } from '@/components/create-look/look-studio'

export default function CreateLookPage() {
  return (
    <Suspense fallback={<div className="shimmer mt-8 h-64 rounded-card" />}>
      <LookStudio />
    </Suspense>
  )
}
