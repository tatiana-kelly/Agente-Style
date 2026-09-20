'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Shirt, Sparkles, Heart, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/wardrobe', label: 'Guarda-roupa', icon: Shirt },
  { href: '/create-look', label: 'Criar', icon: Sparkles, primary: true },
  { href: '/outfits', label: 'Meus looks', icon: Heart },
  { href: '/profile', label: 'Perfil', icon: User },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-sand/60 bg-bone/85 backdrop-blur-md">
        <div
          className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
        >
          <Link href="/" className="display text-xl tracking-tight">
            Wardrobe<span className="text-rose"> AI</span>
          </Link>

          <nav className="hidden gap-7 text-sm md:flex">
            {NAV.filter((n) => !n.primary).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'transition-colors hover:text-espresso',
                  isActive(pathname, item.href) ? 'text-espresso' : 'text-mist',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/create-look"
            className="hidden rounded-full bg-espresso px-5 py-2 text-sm text-bone transition-colors hover:bg-cocoa md:inline-block"
          >
            Criar look
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-28 pt-6 md:pb-16">{children}</main>

      {/* Navegação inferior: o uso principal é no celular, fotografando roupa (PRP §43). */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-sand/60 bg-bone/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="mx-auto flex max-w-lg items-end justify-around px-2 py-2">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)

            if (item.primary) {
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-label="Criar look"
                    className="mb-1 flex size-12 items-center justify-center rounded-full bg-espresso text-bone shadow-lg shadow-espresso/20 transition-transform active:scale-95"
                  >
                    <Icon className="size-5" />
                  </Link>
                </li>
              )
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex w-16 flex-col items-center gap-1 py-1 text-[0.625rem] transition-colors',
                    active ? 'text-espresso' : 'text-mist',
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.6} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}
