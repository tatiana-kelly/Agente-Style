import { getContext } from '@/services/context'
import { ProfileForm } from '@/components/profile/profile-form'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { StyleProfileForm } from '@/components/profile/style-profile-form'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const { user, repo } = await getContext()
  const [profile, photo] = await Promise.all([repo.getProfile(user.id), repo.getPrimaryPhoto(user.id)])

  return (
    <>
      <ProfileForm initialProfile={profile} photoUrl={photo?.image_url ?? null} isDemo={user.isDemo} />
      <StyleProfileForm />
      {!user.isDemo && (
        <div className="mt-8 border-t border-sand/60 pt-5">
          <SignOutButton />
        </div>
      )}
    </>
  )
}
