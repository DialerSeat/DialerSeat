import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Desktop from '@/components/admin-desktop/Desktop'
















export const metadata = {
  title: 'DialerSeat Admin',
}

export default async function AdminDesktopPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/dashboard/admin/desktop')
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (!data?.is_admin) {
    redirect('/dashboard/analytics')
  }

  return <Desktop />
}