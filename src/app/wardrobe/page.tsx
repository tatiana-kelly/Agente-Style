import { getContext } from '@/services/context'
import { WardrobeBrowser } from '@/components/wardrobe/wardrobe-browser'

export const dynamic = 'force-dynamic'

export default async function WardrobePage() {
  const { user, repo } = await getContext()
  const items = await repo.listItems(user.id)
  return <WardrobeBrowser initialItems={items} />
}
