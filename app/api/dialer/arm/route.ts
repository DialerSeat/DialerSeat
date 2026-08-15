import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'

const supabase = getServiceClient('dialer/arm')

// =============================================================================
// ARM / DISARM THE PREDICTIVE ENGINE
// =============================================================================
// POST /api/dialer/arm   { armed: boolean }
//
// WHY THIS ENDPOINT EXISTS
//
// The predictive controller only fans out lead calls when the agent has
// explicitly started the sequence — that gate is what stops merely going
// Available from dialing anyone. The gate was correct; the value feeding it
// was not.
//
// predictive_armed used to be computed in the browser on every heartbeat, from
// React state. Predictive never placed a single call in this product's
// lifetime, and every investigation ended at the same place: the UI said the
// engine was running, the wire said armed=false. Three separate causes, all
// the same shape —
//
//   - the state is cleared by effects on campaign change, scope change and
//     going offline, any of which could fire after the agent armed it;
//   - a ref added to dodge that was mirrored FROM the state, so it copied the
//     clears faithfully;
//   - the mode half of the expression was captured by the heartbeat interval's
//     closure and went stale, because it derives from a campaign that loads
//     asynchronously.
//
// Instrumentation eventually proved the agent clicked, every guard passed, and
// the ref was set true — in the same payload that reported armed=false.
//
// A flag the browser recomputes twelve times a minute has twelve chances a
// minute to be wrong. This writes it once, when the agent acts, and the
// heartbeat reads it back from the row. There is no closure, no render, and no
// effect between the click and the gate.
//
// SAFETY: disarming is deliberately unconditional and never fails closed — if
// this call errors while turning the engine OFF, the client also stops sending
// dials and /api/dialer/abort sweeps the lines. Arming is the only direction
// that requires success, and the client only shows the engine as started once
// this returns ok.
// =============================================================================

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const armed: boolean = body?.armed === true

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 })
    }

    // Scoped to this user's own session row. The heartbeat owns creating it, so
    // arming before a single beat has landed is a no-op — which is correct:
    // there is no session to fan out for yet, and the next beat arrives in five
    // seconds. The client re-sends arm on its first beat after starting.
    const { data: updated, error } = await supabase
      .from('agent_sessions')
      .update({ predictive_armed: armed, updated_at: new Date().toISOString() })
      .eq('user_id', userRow.id)
      .select('id, predictive_armed')
      .maybeSingle()

    if (error) {
      return apiError(error, { route: 'dialer/arm' })
    }

    // Recorded because "when did this engine actually arm" is the first
    // question asked whenever predictive does not dial, and for its whole
    // existence there was no way to answer it after the fact.
    await logCallEvent({
      event_type: 'fanout_idle',
      user_id: clerkId,
      source: 'dialer',
      status: armed ? 'armed' : 'disarmed',
      detail: {
        reason: armed ? 'agent started the predictive sequence' : 'predictive sequence stopped',
        session_found: !!updated,
      },
    })

    return NextResponse.json({
      ok: true,
      armed: updated?.predictive_armed ?? armed,
      // False when no session row existed yet. The client uses this to know it
      // should re-arm once its first heartbeat has created one.
      session_found: !!updated,
    })
  } catch (error: any) {
    return apiError(error, { route: 'dialer/arm' })
  }
}
