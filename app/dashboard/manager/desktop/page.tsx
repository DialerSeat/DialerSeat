import { redirect } from 'next/navigation'
import { getManagerTenant } from '@/lib/manager'
import { getTenantBranding } from '@/lib/tenant'
import { ThemeProvider } from '@/components/ThemeProvider'
import Desktop from '@/components/admin-desktop/Desktop'


























export const dynamic = 'force-dynamic'

export default async function ManagerDesktopPage() {
  const tenant = await getManagerTenant()
  if (!tenant) {
    redirect('/dashboard')
  }

  
  const branding = await getTenantBranding(tenant.slug)

  return (
    <ThemeProvider initialBranding={branding}>
      <Desktop role="manager" />
    </ThemeProvider>
  )
}