'use client'

import { useEffect, useState } from 'react'
import TeamFloor from '@/components/teams/TeamFloor'

// =============================================================================
// /dashboard/teams/floor — the rebuilt Teams surface, live but not yet the
// default.
// =============================================================================
// Deliberately its own route while the rebuild finishes. TeamsManager still
// owns join codes, attached campaigns, billing history and team creation, and
// swapping the page over before those have a home here would delete working
// features to ship a nicer layout. This lets the new surface be used and
// judged with nothing at risk.
// =============================================================================

export default function TeamFloorPage() {
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null)
  const [state, setState] = useState<'loading' | 'none' | 'ready' | 'error'>('loading')

  useEffect(() => {
    fetch('/api/teams/list')
      .then(r => r.json())
      .then(d => {
        // Shape is { teams: { owned, member } }. Owner-first: the floor is a
        // manager's view, so if someone owns a team that is the one they mean,
        // even when they are also a member of others.
        const owned = (d?.teams?.owned ?? []) as any[]
        const member = (d?.teams?.member ?? []) as any[]
        const first = owned[0] ?? member[0] ?? null
        if (first?.id) {
          setTeam({ id: first.id, name: first.name || 'Team' })
          setState('ready')
        } else {
          setState('none')
        }
      })
      .catch(() => setState('error'))
  }, [])

  if (state === 'loading') {
    return <Msg>LOADING…</Msg>
  }
  if (state === 'error') {
    return <Msg>Could not load your teams.</Msg>
  }
  if (state === 'none' || !team) {
    return <Msg>You are not on a team yet. Create one from the Teams page first.</Msg>
  }

  return <TeamFloor teamId={team.id} teamName={team.name} />
}

function Msg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: 40, fontSize: 12, letterSpacing: 1.5,
      color: 'var(--brand-muted-text)',
    }}>{children}</div>
  )
}
