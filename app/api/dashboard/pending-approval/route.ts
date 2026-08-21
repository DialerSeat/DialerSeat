import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// "WHY CAN'T I SEE THE CAMPAIGN I WAS INVITED TO?"
//
// An agent who redeems an approval-mode code becomes a PENDING member. They
// have a DialerSeat account and can move around the product, but the team's
// campaigns stay shut until the owner accepts them in Requests.
//
// Until now the only thing that said so was a single toast on the Teams page,
// shown once, at redemption. Navigate away and there was nothing — so the
// experience of being pending was indistinguishable from the product being
// broken: you were invited, you joined, and the campaign simply is not there.
//
// The wait is legitimate. Being uninformed about it is not, and it converts a
// normal approval delay into a support message.
//
// Scoped to the caller's own memberships only. It returns team NAMES, which
// the user was invited to and already saw when they redeemed — nothing here is
// information they did not already have.
// ─────────────────────────────────────────────────────────────────────────

const supabase = getServiceClient('dashboard/pending-approval')

const EMPTY = { success: true, pending: false, teams: [] as string[] }

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('team_members')
      .select('team_id, teams!inner(name)')
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (error) {
      // A banner that cannot load must not become a banner that lies. Failing
      // closed means the worst case is the old behaviour, not a false alarm.
      console.error('[dashboard/pending-approval]', error)
      return NextResponse.json(EMPTY)
    }

    const teams = (data || [])
      .map((r: any) => r?.teams?.name)
      .filter((n: any): n is string => typeof n === 'string' && n.length > 0)

    return NextResponse.json({
      success: true,
      pending: teams.length > 0,
      teams,
    })
  } catch (err) {
    console.error('[dashboard/pending-approval] unexpected', err)
    return NextResponse.json(EMPTY)
  }
}
