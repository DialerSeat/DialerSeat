import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { memberId } = body

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'memberId required' }, { status: 400 })
    }

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, status, teams!inner(owner_id)')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    if ((member as any).teams.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can reject members' },
        { status: 403 }
      )
    }

    if (member.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Member is ${member.status}, not pending` },
        { status: 400 }
      )
    }

    await supabaseAdmin
      .from('team_members')
      .update({
        status: 'removed',
        removed_at: new Date().toISOString(),
      })
      .eq('id', memberId)

    await supabaseAdmin
      .from('team_campaign_access')
      .delete()
      .eq('team_member_id', memberId)
      .eq('is_active', false)

    await supabaseAdmin
      .from('team_seat_charges')
      .update({ status: 'voided' })
      .eq('team_member_id', memberId)
      .eq('status', 'pending')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Reject member error:', error)
    return apiError(error, { route: 'teams/members/reject' })
  }
}