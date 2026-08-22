import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// THE ORDER AN OWNER PUT THEIR SIDEBAR IN
//
// The tree was sorted by created_at, which is the order things happened to be
// made in and has nothing to do with how anybody works. An owner running six
// teams wants the one they are dialing today at the top, and the seasonal one
// at the bottom, and no amount of renaming achieves that.
//
// TWO SHAPES, ONE ENDPOINT. Teams among themselves, and campaigns within one
// team. They are the same operation on different rows and splitting them into
// two routes would mean writing the ownership check twice.
//
// POSITIONS ARE REWRITTEN WHOLE, not patched. The client sends the full list
// in its new order and every row is stamped with its index. Sending "move this
// one to position 3" would need the server to reason about what the client was
// looking at, and any drift between the two produces an order neither of them
// chose.
// ─────────────────────────────────────────────────────────────────────────

const MAX_ITEMS = 300

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const kind = body?.kind === 'campaigns' ? 'campaigns' : body?.kind === 'teams' ? 'teams' : null
    const teamId = typeof body?.teamId === 'string' ? body.teamId : ''
    const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : []
    const ids = rawIds
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .slice(0, MAX_ITEMS)

    if (!kind) {
      return NextResponse.json(
        { success: false, error: "kind must be 'teams' or 'campaigns'" },
        { status: 400 }
      )
    }
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to order' }, { status: 400 })
    }

    if (kind === 'teams') {
      // Only their own teams get touched. Filtering by owner_id on the write
      // rather than trusting the list means a crafted request reorders
      // nothing it does not own — it just silently affects no rows.
      const { data: owned } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('owner_id', userId)
        .in('id', ids)

      const ownedIds = new Set((owned || []).map(t => t.id))
      const ordered = ids.filter(id => ownedIds.has(id))

      for (let i = 0; i < ordered.length; i++) {
        await supabaseAdmin
          .from('teams')
          .update({ sort_order: i })
          .eq('id', ordered[i])
          .eq('owner_id', userId)
      }

      return NextResponse.json({ success: true, kind, ordered: ordered.length })
    }

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'teamId required when ordering campaigns' },
        { status: 400 }
      )
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (!team || team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can reorder its campaigns.' },
        { status: 403 }
      )
    }

    const { data: attached } = await supabaseAdmin
      .from('team_campaigns')
      .select('campaign_id')
      .eq('team_id', teamId)
      .in('campaign_id', ids)

    const attachedIds = new Set((attached || []).map(r => r.campaign_id))
    const ordered = ids.filter(id => attachedIds.has(id))

    for (let i = 0; i < ordered.length; i++) {
      await supabaseAdmin
        .from('team_campaigns')
        .update({ sort_order: i })
        .eq('team_id', teamId)
        .eq('campaign_id', ordered[i])
    }

    return NextResponse.json({ success: true, kind, teamId, ordered: ordered.length })
  } catch (error: any) {
    console.error('Reorder error:', error)
    return apiError(error, { route: 'teams/reorder' })
  }
}
