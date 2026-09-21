import { notFound } from 'next/navigation'
import { getContext } from '@/services/context'
import { EditItemForm } from '@/components/wardrobe/edit-item-form'

export const dynamic = 'force-dynamic'

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, repo } = await getContext()
  const item = await repo.getItem(user.id, id)
  if (!item) notFound()

  return <EditItemForm item={item} />
}
