import Link from 'next/link'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-card border border-dashed border-sand bg-ivory/40 px-6 py-14 text-center', className)}>
      <p className="display text-2xl">{title}</p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-cocoa">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-6 inline-block rounded-full bg-espresso px-6 py-3 text-sm text-bone transition-colors hover:bg-cocoa"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
