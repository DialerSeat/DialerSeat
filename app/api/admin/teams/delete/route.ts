import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

/**
 * Admin force-delete a team.
 * Requires typed "remove" confirmation in body (matches owner endpoint pattern).
 *
 * Admin can delete teams with active paid seat charges. The UI warns but the
 * endpoint doesn't block — admin has final authority. Stripe seat-charge rows
 * are preserved via FK SET NULL for billing audit trail. CASCADE handles
 * team_codes, team_members, team_campaigns.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin()

    const body = await req.json().catch(() => ({}))
    const { teamId, confirm } = body

    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'teamId required' },
        { status: 400 }
      )
    }

    if (confirm !== 'remove') {
      return NextResponse.json(
        { success: false, error: 'Type "remove" to confirm' },
        { status: 400 }
      )
    }

    // Verify team exists + collect a summary before we wipe
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    // Count what we're about to delete for the response summary
    const [{ count: memberCount }, { count: campaignCount }, { count: activeSeatCount }] = await Promise.all([
      supabaseAdmin.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
      supabaseAdmin.from('team_campaigns').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
      supabaseAdmin.from('team_seat_charges').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'paid'),
    ])

    // Wipe team — CASCADE handles team_codes, team_members, team_campaigns
    // team_seat_charges.team_id is SET NULL (audit trail preserved)
    const { error } = await supabaseAdmin
      .from('teams')
      .delete()
      .eq('id', teamId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      deleted: {
        teamId: team.id,
        teamName: team.name,
        ownerId: team.owner_id,
        membersRemoved: memberCount || 0,
        campaignsDetached: campaignCount || 0,
        activeSeatChargesOrphaned: activeSeatCount || 0,
      },
    })
  } catch (error: any) {
    // requireAdmin() throws Response objects — re-return them
    if (error instanceof Response) return error
    console.error('Admin team delete error:', error)
    return apiError(error, { route: 'admin/teams/delete' })
  }
}