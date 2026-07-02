import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

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

    const [{ count: memberCount }, { count: campaignCount }, { count: activeSeatCount }] = await Promise.all([
      supabaseAdmin.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
      supabaseAdmin.from('team_campaigns').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
      supabaseAdmin.from('team_seat_charges').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'paid'),
    ])

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

    if (error instanceof Response) return error
    console.error('Admin team delete error:', error)
    return apiError(error, { route: 'admin/teams/delete' })
  }
}