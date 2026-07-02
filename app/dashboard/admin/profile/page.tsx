import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserProfile } from '@clerk/nextjs'
import Link from 'next/link'





















export default async function AdminProfilePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a14',
      padding: 'max(24px, env(safe-area-inset-top, 0px)) 24px 24px',
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
    }}>
      <div style={{
        maxWidth: 980,
        margin: '0 auto',
      }}>
        {/* Back-to-desktop bar */}
        <div style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <Link
            href="/dashboard/admin/desktop"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 6,
              background: 'rgba(74,158,255,0.1)',
              border: '1px solid rgba(74,158,255,0.3)',
              color: '#4a9eff',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 2,
              textDecoration: 'none',
            }}
          >
            ← BACK TO DESKTOP
          </Link>
          <div style={{
            fontSize: 11,
            letterSpacing: 3,
            color: 'rgba(255,255,255,0.5)',
          }}>
            ACCOUNT SETTINGS
          </div>
        </div>

        {/* Clerk renders the full profile manager here. It uses its own
            styling internally — we just give it a container that's wide
            enough for the two-column layout on desktop. */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          <UserProfile
            path="/dashboard/admin/profile"
            routing="path"
            appearance={{
              elements: {
                rootBox: { width: '100%' },
                card: { boxShadow: 'none', border: 'none' },
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}