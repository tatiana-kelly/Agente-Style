import { cn } from '@/lib/utils'
import type { WardrobeItem } from '@/schemas/wardrobe'
import { colorFamily, normalizeColor } from '@/lib/wardrobe/colors'

/**
 * Amostra de cor quando a peça ainda não tem foto — o grid nunca fica vazio.
 * A cor exata vem primeiro: pela família, preto, branco e bege virariam o mesmo bloco.
 */
const EXACT: Record<string, string> = {
  preto: '#2b2724', branco: '#f7f4f0', 'off-white': '#f0ebe4', cru: '#ede5da',
  cinza: '#9b9691', grafite: '#4a4643', bege: '#d9c8b4', creme: '#ece0cd',
  nude: '#dcc0ad', areia: '#d8c9b2', marinho: '#2a3852', 'azul-marinho': '#2a3852',
  jeans: '#5a7396', denim: '#5a7396', oliva: '#6b7248', militar: '#5a5f3f',
  vinho: '#5e2733', bordo: '#5e2733', prata: '#c3c6ca', dourado: '#c5a15a', ouro: '#c5a15a',
}

const FAMILY: Record<string, string> = {
  neutro: '#c9bfb4', vermelho: '#a8443c', laranja: '#c2703c', amarelo: '#c9a227',
  verde: '#5d7a52', azul: '#3f5a7a', roxo: '#6e5580', rosa: '#c08490',
  marrom: '#7a5c44', metalico: '#b3b3b8', desconhecido: '#cfc4b8',
}

function swatchFor(color: string): string {
  return EXACT[normalizeColor(color)] ?? FAMILY[colorFamily(color)] ?? FAMILY.desconhecido
}

/** Inicial escura sobre amostra clara, clara sobre amostra escura. */
function isLight(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

export function ItemThumb({ item, className }: { item: WardrobeItem; className?: string }) {
  const url = item.thumbnail_url ?? item.image_processed_url ?? item.image_original_url

  if (url) {
    // Recorte sem fundo é PNG transparente: `cover` cortaria a ponta do sapato.
    // Inteiro e centrado sobre o tom da página, parece foto de catálogo.
    const semFundo = Boolean(item.image_processed_url)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URLs assinadas de host dinâmico
      <img
        src={url}
        alt={item.name}
        loading="lazy"
        className={cn(semFundo ? 'size-full bg-ivory object-contain p-[8%]' : 'size-full object-cover', className)}
      />
    )
  }

  const swatch = swatchFor(item.color)

  return (
    <div
      className={cn('flex size-full items-center justify-center', className)}
      style={{ backgroundColor: swatch, color: isLight(swatch) ? '#2e2622' : '#faf7f3' }}
      aria-hidden
    >
      <span className="display text-2xl opacity-70">{item.name.charAt(0).toUpperCase()}</span>
    </div>
  )
}
