import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('calls/check')

// =============================================================================
// CHECK — polled by the dialer page (startHangupPolling) to detect when a
// live call has ended, and to read the AMD result for the isNotHuman()
// auto-skip logic.
// =============================================================================
// REWRITTEN FOR TELNYX, USING ONLY EXISTING COLUMNS (no schema changes):
//   - Ownership: was call_rooms (now unused under the direct-bridge
//     design — see TELNYX-MIGRATION-DESIGN.md), now the `calls` table
//     directly, keyed by the same signalwire_call_id column that holds
//     the Telnyx call_control_id.
//   - "Is this call over": the old version made a live GET request to
//     SignalWire's Calls API and read back a `status` string
//     (queued/ringing/in-progress/completed/...). Telnyx's native Call
//     Control GET /v2/calls/{id} has no equivalent status string (just
//     is_alive/timestamps) — but we don't need a live API call at all:
//     app/api/calls/events/route.ts's handleHangup already writes a real
//     `duration` the moment call.hangup fires (see that file). duration
//     stays 0 while the call is in-flight (same "0 = in-flight" sentinel
//     dialerPacing.ts already relies on elsewhere in this codebase) and
//     becomes a real positive number the instant it's over. So `check`
//     just reads our own DB — faster, and avoids depending on Telnyx API
//     availability every single poll tick.
//   - status field: the frontend only checks `d.status === 'completed' ||
//     'canceled' || 'failed'` (see app/dashboard/dialer/page.tsx
//     startHangupPolling). We return 'completed' once duration > 0,
//     'in-progress' otherwise — sufficient for that check without needing
//     to distinguish canceled/failed separately (the frontend treats all
//     three identically).
// =============================================================================

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sid = searchParams.get('sid')

    if (!sid) {
      return NextResponse.json({ success: false, error: 'No SID' }, { status: 400 })
    }

    const { data: callRow } = await supabase
      .from('calls')
      .select('user_id, duration, amd_result, disposition')
      .eq('signalwire_call_id', sid)
      .maybeSingle()

    if (!callRow || callRow.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const isOver = !!callRow.duration && callRow.duration > 0
    const status = isOver ? 'completed' : 'in-progress'

    // amd_result is written directly by handleAmdResult in
    // app/api/calls/events/route.ts using Telnyx's native vocabulary
    // (human/machine/not_sure) — no inference needed the way the old
    // SignalWire version had to infer from a NO_ANSWER_AMD disposition,
    // since that disposition path doesn't exist anymore (AMD-machine is a
    // silent skip with no disposition at all — see events/route.ts).
    return NextResponse.json({
      success: true,
      status,
      amd_result: callRow.amd_result || null,
      duration: callRow.duration || 0,
    })
  } catch (error: any) {
    return apiError(error, { route: 'calls/check' })
  }
}
