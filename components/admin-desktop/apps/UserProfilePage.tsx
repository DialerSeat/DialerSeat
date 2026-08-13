'use client'

import AnalyticsPage from '@/app/dashboard/analytics/page'

// =============================================================================
// USER PROFILE — the user's OWN analytics dashboard, as an admin sees it
// =============================================================================
// This renders app/dashboard/analytics/page.tsx itself, not a reimplementation
// of it. That is the whole point: "word for word" is only true on the day it
// ships if it's a copy, and permanently true if it's the same component.
//
// A previous version of this file was a bespoke admin view — different cards,
// different charts, percentile bars that existed nowhere else in the product.
// It answered questions an admin might have; it did not answer "what is this
// person actually looking at", which is the question that matters when someone
// writes in about their numbers.
//
// Two props do the work. AnalyticsPage scopes every request to targetUserId,
// and swaps its "WELCOME BACK, X." greeting for the plain name.
//
// ACCESS IS ENFORCED SERVER-SIDE, NOT HERE. lib/analyticsScope.ts honours
// ?user_id only for admins; a non-admin who somehow rendered this would get
// their own numbers back. Nothing on the client grants anything.
// =============================================================================

interface UserRow {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
}

function nameFor(u: UserRow): string {
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return full || u.email?.split('@')[0] || 'Unknown'
}

export default function UserProfilePage({
  user,
  onBack,
}: {
  user: UserRow
  onBack: () => void
}) {
  return (
    // ── OWN SCROLL CONTAINER ────────────────────────────────────────────────
    // This was a bare <div>, which meant it had no scrolling of its own and
    // relied on an ancestor to provide it. The ancestor is the app window,
    // which is overflow:hidden — so everything below the fold was clipped with
    // no way to reach it. Invisible on a desktop monitor where the whole page
    // happens to fit, and total on a phone, where almost none of it does.
    //
    // min-height:0 is the load-bearing half. A flex child defaults to
    // min-height:auto and refuses to shrink below its content, so overflow-y
    // never engages and the parent just clips. Same fix as .ut-scroll in
    // UserTracker, which is why that one already scrolled and this didn't.
    //
    // The sticky header below stays sticky: it now sticks to THIS element,
    // which is what a sticky position needs — a scrolling ancestor.
    <div style={{
      height: '100%',
      minHeight: 0,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* The only chrome added on top of their dashboard. Sticky so it stays
          reachable — the analytics page is long, and an admin who scrolls to
          the campaign table shouldn't have to scroll back up to leave. */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        background: 'var(--brand-page-bg, #f0f1f4)',
        borderBottom: '1px solid var(--brand-card-border, #c4c8d0)',
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent',
            border: '1px solid var(--brand-card-border, #c4c8d0)',
            borderRadius: 4, padding: '6px 12px', cursor: 'pointer',
            fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5,
            color: 'var(--brand-muted-text, #5a5e6a)',
            fontFamily: "'Futura PT', Futura, sans-serif",
          }}
        >
          ‹ ALL USERS
        </button>
        <span style={{
          fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
          color: 'var(--brand-muted-text, #5a5e6a)',
          fontFamily: "'Futura PT', Futura, sans-serif",
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          VIEWING · {user.email}
        </span>
      </div>

      <AnalyticsPage
        targetUserId={user.clerk_id}
        displayNameOverride={nameFor(user)}
      />
    </div>
  )
}
