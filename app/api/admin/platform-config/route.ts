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
  // The carrier's account limit, mirrored for the Live Ops gauge only.
  // Nothing enforces it — see lib/concurrency.ts.
  concurrency_budget:        v => intInRange(v, 1, 5000),
  // Only Telnyx's documented modes. An unrecognised value here would be
  // rejected at dial time, failing every call.
  amd_detector: v => (typeof v === 'string' &&
    ['detect', 'detect_beep', 'detect_words', 'greeting_end', 'premium'].includes(v))
    ? (v as unknown as number) : null,
  amd_tuning_enabled:        v => typeof v === 'boolean' ? v : null,
  // Floors and ceilings that keep a typo from making detection useless: too
  // short and it decides on nothing, too long and the agent waits.
  amd_total_analysis_ms:         v => intInRange(v, 1000, 30000),
  amd_after_greeting_silence_ms: v => intInRange(v, 200, 10000),
  amd_in_preview:            v => typeof v === 'boolean' ? v : null,
  amd_hangup_when_bridged:   v => typeof v === 'boolean' ? v : null,
  amd_max_seconds_after_answer: v => intInRange(v, 0, 60),
  amd_greeting_duration_ms:  v => intInRange(v, 1000, 30000),
  // Below ~6 and ordinary greetings trip it; above ~40 and a real voicemail
  // greeting stops tripping it.
  amd_max_words:             v => intInRange(v, 3, 40),
  amd_initial_silence_ms:    v => intInRange(v, 1000, 20000),
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
