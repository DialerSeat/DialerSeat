import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner deletes a code permanently.
 * Requires typed "remove" confirmation per destructive-action pattern.
 *
 * Once deleted, the code can never be redeemed. Existing members who joined
 * via this code stay on the team — their `team_members.joined_via_code` is
 * a denormalized text field for audit, not a foreign key.
 *
 * Body:
 *   codeId: uuid (required)
 *   confirm: 'remove' (required)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { codeId, confirm } = body

    if (!codeId) {
      return NextResponse.json({ success: false, error: 'codeId required' }, { status: 400 })
    }

    if (confirm !== 'remove') {
      return NextResponse.json(
        { success: false, error: 'Type "remove" to confirm deletion' },
        { status: 400 }
      )
    }

    // Verify ownership through the team
    const { data: existing } = await supabaseAdmin
      .from('team_codes')
      .select('id, teams!inner(owner_id)')
      .eq('id', codeId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Code not found' }, { status: 404 })
    }

    const ownerCheck = (existing as any).teams?.owner_id
    if (ownerCheck !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can delete codes' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('team_codes')
      .delete()
      .eq('id', codeId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Code delete error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}