import { cn } from '@/lib/utils'

export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 text-sm transition-colors',
        active
          ? 'border-espresso bg-espresso text-bone'
          : 'border-sand bg-transparent text-cocoa hover:border-clay',
        className,
      )}
      {...props}
    />
  )
}
