import { ItemThumb } from '@/components/ui/item-thumb'
import type { WardrobeItem } from '@/schemas/wardrobe'
import { roleLabel } from '@/lib/labels'

/** Peças que desenham a silhueta ficam grandes; o resto vira fileira de apoio. */
const PRINCIPAIS = new Set(['top', 'bottom', 'dress', 'outerwear', 'layer'])

/**
 * Vitrine do look: as peças arrumadas como num flat lay de revista.
 *
 * Existe porque a foto no corpo é lenta e paga — esperar por ela para ver a
 * combinação deixava a tela em "Criando…" por dezenas de segundos. A vitrine
 * sai instantânea, com as fotos que já estão no guarda-roupa, e a imagem
 * vestida fica para o look que a pessoa decidir salvar.
 */
export function LookCollage({
  items,
}: {
  items: Array<{ role: string; item: WardrobeItem }>
}) {
  const grandes = items.filter((i) => PRINCIPAIS.has(i.role))
  const apoio = items.filter((i) => !PRINCIPAIS.has(i.role))
  // Sem peça principal reconhecida, as primeiras assumem o papel: a vitrine
  // nunca fica só com sapato e brinco miúdos no meio do vazio.
  const destaque = grandes.length > 0 ? grandes : items.slice(0, 2)
  const resto = grandes.length > 0 ? apoio : items.slice(2)

  return (
    <div className="flex size-full flex-col gap-2 p-3">
      {/* Lado a lado a partir de duas pecas: empilhado, o cartao fica alto
          demais e no celular o look vira rolagem. */}
      <div className={`grid flex-1 gap-2 ${destaque.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {destaque.map(({ role, item }) => (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-soft bg-bone"
            title={`${roleLabel(role)}: ${item.name}`}
          >
            <ItemThumb item={item} className="absolute inset-0 object-cover" />
          </div>
        ))}
      </div>

      {resto.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {resto.map(({ role, item }) => (
            <span
              key={item.id}
              className="size-12 overflow-hidden rounded-soft bg-bone"
              title={`${roleLabel(role)}: ${item.name}`}
            >
              <ItemThumb item={item} />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
