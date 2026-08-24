import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/rest')

// ─────────────────────────────────────────────────────────────────────────
// TAKING A NUMBER OUT OF COOLDOWN BY HAND
//
// number-health rests a number when its answer rate collapses, which is right
// far more often than it is wrong — but it is a heuristic over a rolling
// window, and a small window plus a bad afternoon can rest a number that is
// perfectly good. Until now nothing could undo that: the number sat resting
// until somebody edited the row in Supabase.
//
// Waking CLEARS the health window, not just the status. Leaving the old
// counters in place would let the next health pass read the same collapsed
// rate and rest it again within the day — the button would appear to work and
// then silently undo itself, which is the most annoying kind of broken.
//
// Resting by hand is the same endpoint in the other direction, because an
// operator who can see a number burning deserves to stop it without waiting
// for a cron.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const body = await req.json().catch(() => ({}))
  const numberId = String(body?.numberId ?? '').trim()
  const action = body?.action === 'rest' ? 'rest' : 'wake'

  if (!numberId) return NextResponse.json({ error: 'numberId required' }, { status: 400 })

  try {
    const { data: number } = await supabase
      .from('phone_numbers')
      .select('id, phone_number, status, rested_reason')
      .eq('id', numberId)
      .maybeSingle()

    if (!number) return NextResponse.json({ error: 'Number not found' }, { status: 404 })

    // A released number is gone from the provider. Waking it would put a row
    // back into rotation for a number this account no longer owns, and every
    // call on it would fail.
    if (number.status === 'released') {
      return NextResponse.json(
        { error: 'That number has been released. It would have to be bought again.' },
        { status: 400 }
      )
    }

    if (action === 'wake') {
      if (number.status !== 'resting') {
        return NextResponse.json(
          { error: `That number is ${number.status}, not resting.` },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('phone_numbers')
        .update({
          status: 'active',
          rested_reason: null,
          // Cleared, not kept. The next health pass would otherwise read the
          // same collapsed answer rate and rest it straight back.
          health_window_calls: 0,
          health_window_answered: 0,
          health_answer_rate: null,
          health_checked_at: new Date().toISOString(),
          // The flag is what rested it; leaving it set makes the number look
          // suspect on every screen that reads it.
          last_flagged_at: null,
          flag_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', numberId)

      if (error) throw error

      console.warn(
        `[admin/pool/rest] ${number.phone_number} woken by hand ` +
        `(was resting: ${number.rested_reason || 'unknown'})`
      )
      return NextResponse.json({ success: true, action, status: 'active' })
    }

    if (number.status === 'resting') {
      return NextResponse.json({ error: 'That number is already resting.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('phone_numbers')
      .update({
        status: 'resting',
        rested_reason: 'manual',
        updated_at: new Date().toISOString(),
      })
      .eq('id', numberId)

    if (error) throw error

    console.warn(`[admin/pool/rest] ${number.phone_number} rested by hand`)
    return NextResponse.json({ success: true, action, status: 'resting' })
  } catch (err: any) {
    return apiError(err, { route: 'admin/pool/rest' })
  }
}
