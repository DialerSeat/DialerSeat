import Link from 'next/link'
import { getManagerTenant } from '@/lib/manager'


















export default async function GoToDesktopButton() {
  const tenant = await getManagerTenant()
  if (!tenant) return null

  return (
    <Link
      href="/dashboard/manager/desktop"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        margin: '0 0 8px 0',
        borderRadius: 10,
        textDecoration: 'none',
        background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.primary_color}cc)`,
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 2,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>🖥️</span>
      <span>GO TO DESKTOP</span>
    </Link>
  )
}




















