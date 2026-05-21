'use client'
import { UserButton, useUser } from '@clerk/nextjs'

// =============================================================================
// LANDING NAV PROFILE
// =============================================================================
// Right-hand side of the landing page nav when a user is signed in.
// Renders the Clerk UserButton (dropdown) plus the user's display name.
//
// Lives in its own client component because the landing page is a server
// component (it uses auth() to decide whether to redirect). Server components
// can't render Clerk's UserButton — it relies on client-side React context —
// so we isolate that single piece here and let the rest of landing stay server.
//
// Display name: first + last from Clerk; falls back to email username; falls
// back to empty. Matches the rendering rule in components/site-header.tsx so
// the user sees a consistent name across pages.
// =============================================================================

export default function LandingNavProfile() {
  const { user, isLoaded } = useUser()

  const displayName = (() => {
    if (!user) return ''
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    if (fullName) return fullName
    const email = user.primaryEmailAddress?.emailAddress || ''
    return email.split('@')[0] || ''
  })()

  // Render an empty placeholder while Clerk loads to avoid layout shift.
  if (!isLoaded) {
    return (
      <div style={{
        height: 32,
        width: 120,
      }} />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'flex-end',
      }}
    >
      <UserButton
        appearance={{
          elements: {
            avatarBox: {
              width: 32,
              height: 32,
            },
            userButtonPopoverCard: {
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            },
          },
        }}
      />
      {displayName && (
        <span
          className="ds-nav-username"
          style={{
            fontSize: 12,
            fontWeight: 'bold',
            color: 'var(--text-primary)',
            letterSpacing: 1.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 180,
          }}
        >
          {displayName}
        </span>
      )}
      <style>{`
        @media (max-width: 640px) {
          .ds-nav-username {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}