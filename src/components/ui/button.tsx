import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-espresso text-bone hover:bg-cocoa',
        secondary: 'bg-ivory text-espresso hover:bg-sand',
        outline: 'border border-sand text-espresso hover:border-clay hover:bg-ivory/60',
        ghost: 'text-cocoa hover:bg-ivory',
        accent: 'bg-rose text-bone hover:bg-rose/90',
      },
      size: {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-sm',
        lg: 'px-8 py-4 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />
}

export { button as buttonVariants }
