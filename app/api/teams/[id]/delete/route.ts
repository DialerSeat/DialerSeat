import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner deletes a team entirely.
 * Requires typed "remove" confirmation in body to match destructive-action pattern.
 *
 * Cascades to delete:
 *   - team_codes (FK CASCADE)
 *   - team_members (FK CASCADE)
 *   - team_campaigns (FK CASCADE)
 * Preserves (sets to null):
 *   - team_seat_charges (FK SET NULL — billing audit trail must survive)
 *   - team_agent_payments.team_id (FK CASCADE on team_id, but the row itself
 *     stays alive only for active billing references — handled in E2 batch 4)
 *
 * In E2 batch 4 we'll add Stripe cleanup here (cancel any open seat charges,
 * issue prorated refunds). For now, deletion just removes the team rows.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: teamId } = await params
    const body = await req.json().catch(() => ({}))
    const { confirm } = body

    if (confirm !== 'remove') {
      return NextResponse.json(
        { success: false, error: 'Type "remove" to confirm deletion' },
        { status: 400 }
      )
    }

    // Verify ownership before delete
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    if (team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can delete this team' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('teams')
      .delete()
      .eq('id', teamId)
      .eq('owner_id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Team delete error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}