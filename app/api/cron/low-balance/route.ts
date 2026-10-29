import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { sendAdminPush } from '@/lib/pushNotify'
import { getTelnyxBalance } from '@/lib/telnyxBalance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// LOW TELNYX BALANCE — push Joshua before the account runs dry
// =============================================================================
// Asked for 29 Oct 2026: a notification in the DialerSeat app when the Telnyx
// balance drops below $5 (platform_config.low_balance_alert_usd; 0 turns it
// off). Every five minutes, reading the balance from Telnyx itself, because the
// other readings only happen after calls and while an admin screen is open, so
// a quiet afternoon would otherwise go unwatched. Each reading also lands in
// telnyx_balance_snapshots, so the ledger gets denser for free.
//
// Once per drop. low_balance_alerted_at is stamped when the push goes out and
// cleared when the balance is back above the threshold plus REARM_MARGIN_USD,
// so a top-up re-arms it and a balance hovering at $4.99/$5.01 cannot alert
// every five minutes.
//
// The figure is available_credit: what Telnyx says can still be spent.
// =============================================================================

const REARM_MARGIN_USD = 1

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getServiceClient('cron/low-balance')
    const { data: cfg, error: cfgErr } = await db
      .from('platform_config')
      .select('id, low_balance_alert_usd, low_balance_alerted_at')
      .limit(1)
      .maybeSingle()
    if (cfgErr) throw cfgErr

    const threshold = Number(cfg?.low_balance_alert_usd ?? 5)
    if (!cfg || !Number.isFinite(threshold) || threshold <= 0) {
      return NextResponse.json({ success: true, skipped: 'threshold off' })
    }

    const bal = await getTelnyxBalance('cron:low-balance')
    // Unreachable is not low. Saying "$0" because a request failed would be
    // read as an empty account and acted on.
    if (!bal.authoritative || bal.availableCredit === null) {
      return NextResponse.json({ success: false, skipped: 'balance unavailable', error: bal.error }, { status: 503 })
    }
    const available = bal.availableCredit

    if (available >= threshold + REARM_MARGIN_USD) {
      if (cfg.low_balance_alerted_at) {
        await db.from('platform_config').update({ low_balance_alerted_at: null }).eq('id', cfg.id)
      }
      return NextResponse.json({ success: true, available, threshold, alerted: false })
    }

    if (available >= threshold || cfg.low_balance_alerted_at) {
      return NextResponse.json({ success: true, available, threshold, alerted: false, alreadyAlerted: !!cfg.low_balance_alerted_at })
    }

    // Claimed with the same condition the read used, so two overlapping runs
    // cannot both send.
    const { data: claimed } = await db
      .from('platform_config')
      .update({ low_balance_alerted_at: new Date().toISOString() })
      .eq('id', cfg.id)
      .is('low_balance_alerted_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ success: true, available, threshold, alerted: false, alreadyAlerted: true })
    }

    const currency = bal.currency && bal.currency !== 'USD' ? ` ${bal.currency}` : ''
    await sendAdminPush(
      'low_balance',
      `Telnyx balance is $${available.toFixed(2)}${currency}, under $${threshold.toFixed(2)}. Top up so dialing does not stop.`,
    )
    return NextResponse.json({ success: true, available, threshold, alerted: true })
  } catch (err) {
    return apiError(err, { route: 'cron/low-balance' })
  }
}
