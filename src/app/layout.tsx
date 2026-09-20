import type { Metadata, Viewport } from 'next'
import { Inter, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/app-shell'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })
const serif = Instrument_Serif({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wardrobe AI — Vista o que você já tem',
  description: 'Seu guarda-roupa. Seu estilo. Um personal stylist com IA.',
}

export const viewport: Viewport = {
  themeColor: '#faf7f3',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${serif.variable} h-full`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
