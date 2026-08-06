import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import {
  getPlatformConfig,
  invalidatePlatformConfig,
  PLATFORM_CONFIG_DEFAULTS,
  type PlatformConfig,
} from '@/lib/platformConfig'

export const dynamic = 'force-dynamic'

// =============================================================================
// PLATFORM CONFIG — admin read/write for the global operational levers
// =============================================================================
// These are the switches that stop something platform-wide without a deploy:
// AMD off (it bills per CALL, so on a heavy day it can exceed the talk-time
// cost), recording off (legal exposure in two-party-consent states), number
// buying frozen (a runaway ratio loop is a bill that grows until noticed), and
// a predictive line ceiling.
//
// WRITES ARE WHITELISTED AND RANGE-CHECKED. This row feeds the dial path; a
// bad value here degrades every call on the platform, so nothing arbitrary
// from a request body reaches the table.
// =============================================================================

const supabase = getServiceClient('admin/platform-config')

type Validator = (v: unknown) => boolean | number | null

/**
 * One entry per writable field. A key absent from here cannot be written,
 * which is what stops a request body from setting, say, an id or a column
 * this route was never meant to touch.
 */
const FIELDS: Record<keyof PlatformConfig, Validator> = {
  amd_enabled_global:        v => typeof v === 'boolean' ? v : null,
  recording_enabled_global:  v => typeof v === 'boolean' ? v : null,
  number_buying_frozen:      v => typeof v === 'boolean' ? v : null,
  // Bounded by the DB CHECK constraint on predictive_lines_per_agent.
  predictive_line_ceiling:   v => intInRange(v, 1, 5),
  // Floors exist because a too-low poll interval turns every active dialer
  // into a request flood against our own API — the setting most capable of
  // causing the outage it's meant to prevent.
  poll_interval_ms:          v => intInRange(v, 500, 10_000),
  hangup_poll_interval_ms:   v => intInRange(v, 500, 15_000),
  pool_capacity_alert_pct:   v => intInRange(v, 1, 100),
  webhook_silence_minutes:   v => intInRange(v, 5, 240),
  agent_leg_refusal_alert_count: v => intInRange(v, 1, 500),
  // The carrier's own account limit, mirrored so it can be raised the instant
  // Telnyx raises theirs. NOT a way to buy capacity: set above what the
  // carrier allows and dials get rejected by them rather than refused cleanly
  // by us, which is strictly worse for the agent watching it happen.
  concurrency_budget:        v => intInRange(v, 1, 5000),
  // Small on purpose. Headroom for a human pressing dial, not a pool.
  concurrency_reserve:       v => intInRange(v, 0, 100),
}

function intInRange(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const n = Math.round(v)
  if (n < min || n > max) return null
  return n
}

async function requireAdmin(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, res: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (!data?.is_admin) {
    return { ok: false, res: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function GET() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res

    const config = await getPlatformConfig()
    return NextResponse.json({ success: true, config, defaults: PLATFORM_CONFIG_DEFAULTS })
  } catch (err) {
    return apiError(err, { route: 'admin/platform-config:GET' })
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const updates: Record<string, boolean | number> = {}
    const rejected: string[] = []

    for (const [key, raw] of Object.entries(body)) {
      const validate = FIELDS[key as keyof PlatformConfig]
      if (!validate) {
        rejected.push(`${key} (not a settable field)`)
        continue
      }
      const value = validate(raw)
      if (value === null) {
        rejected.push(`${key} (value out of range or wrong type)`)
        continue
      }
      updates[key] = value
    }

    // All-or-nothing. A partial apply would leave the admin looking at a UI
    // where some toggles took and some didn't, with no indication which.
    if (rejected.length > 0) {
      return NextResponse.json(
        { success: false, error: `Rejected: ${rejected.join(', ')}` },
        { status: 400 }
      )
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await supabase
      .from('platform_config')
      .update(updates)
      .eq('id', 1)

    if (error) throw error

    // Drop this instance's cache immediately. Other serverless instances keep
    // their own copy for up to the 30s TTL, so a flip is not instantaneous
    // fleet-wide — worth knowing when watching for a change to take effect.
    invalidatePlatformConfig()

    const config = await getPlatformConfig()
    console.warn('[admin/platform-config] updated:', JSON.stringify(updates))
    return NextResponse.json({ success: true, config, applied: Object.keys(updates) })
  } catch (err) {
    return apiError(err, { route: 'admin/platform-config:PATCH' })
  }
}
