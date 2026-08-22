import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE OWNER CALLS SOMEBODY
//
// A roster of "Jonathan Mitchell" and "teamtest 2" is a list of Clerk
// profiles, not a list of the people an owner actually works with. Agents
// sign up with whatever name they felt like typing, and an owner running
// forty of them needs to find one at a glance.
//
// The nickname lives on the MEMBERSHIP, not on the user. Two consequences,
// both wanted: the same person can be "Big Mike" on one team and "Michael" on
// another, and nothing an owner types here reaches the person's own account.
// An owner is labelling their roster, not editing somebody's identity.
//
// Owner only, and the ownership is re-checked here rather than trusted from
// the caller — the sidebar hides the option for a non-owner, but hiding a
// button is a UI convenience and never an access rule.
// ─────────────────────────────────────────────────────────────────────────

const MAX_LENGTH = 60

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : ''
    const rawNickname = typeof body?.nickname === 'string' ? body.nickname : ''

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'Which member?' }, { status: 400 })
    }

    // Empty clears it, which is how somebody goes back to their real name.
    // Stored as null rather than '' so every reader can treat "no nickname"
    // as one thing instead of two.
    const nickname = rawNickname.trim().slice(0, MAX_LENGTH) || null

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ success: false, error: 'That member no longer exists.' }, { status: 404 })
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id')
      .eq('id', member.team_id)
      .maybeSingle()

    if (!team || team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can rename a member.' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('team_members')
      .update({ nickname })
      .eq('id', memberId)

    if (error) throw error

    return NextResponse.json({ success: true, memberId, nickname })
  } catch (error: any) {
    return apiError(error, { route: 'teams/members/nickname' })
  }
}
