import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE SETTINGS PANES ACTUALLY KNOW
//
// Seven panes in the Settings app were "coming soon" placeholders. The
// temptation with a screen like that is to fill it with plausible-looking
// controls — a toggle for a feature that does not exist, a retention slider
// wired to nothing. A control that appears to work and does not is worse than
// an empty state, because an empty state is honest.
//
// So every number here is read from something real: a table, an environment
// variable's PRESENCE, a constant in the code. Where a pane has no lever, it
// reports rather than pretends, and points at the app that does own the lever.
//
// ONE ENDPOINT, NOT SEVEN. These panes are read-once-and-display, they are
// opened rarely, and seven routes each doing three counts is seven places for
// the same auth check to drift.
//
// NO SECRET VALUES, EVER. Integration status is a boolean per key — whether
// something is configured, never what it is set to. An admin screen that
// prints an API key is an API key in a browser history, a screenshot, and a
// screen-share.
// ─────────────────────────────────────────────────────────────────────────

const CRON_SCHEDULE: Array<{ path: string; job: string; does: string }> = [
  { path: '/api/cron/pool-maintenance', job: 'Number pool top-up', does: 'Buys and retires caller IDs to keep the pool healthy' },
  { path: '/api/cron/pool-reset', job: 'Pool daily reset', does: 'Clears per-number daily call counts' },
  { path: '/api/cron/number-health', job: 'Number health', does: 'Checks pool numbers for answer-rate collapse' },
  { path: '/api/cron/stale-call-reaper', job: 'Stale call reaper', does: 'Closes call rows the webhooks never finished' },
  { path: '/api/cron/seat-billing-enforcement', job: 'Seat billing', does: 'Retries failed seat charges, suspends past the grace window, reconciles discounts' },
  { path: '/api/cron/billing-retry', job: 'Subscription retry', does: 'Chases failed personal subscription payments' },
  { path: '/api/cron/recording-retention', job: 'Recording retention', does: 'Deletes recordings past their retention window' },
  { path: '/api/cron/data-retention', job: 'Data retention', does: 'Rolls up and prunes old analytics rows' },
  { path: '/api/cron/ops-health', job: 'Ops health', does: 'Watches database size and webhook silence, and alerts' },
]

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const count = async (table: string, build?: (q: any) => any) => {
      let q = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
      if (build) q = build(q)
      const { count: n } = await q
      return n || 0
    }

    // ── BRANDING ─────────────────────────────────────────────────────────
    const { data: tenants } = await supabaseAdmin
      .from('white_label_tenants')
      .select('slug, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    // ── NUMBERS ──────────────────────────────────────────────────────────
    const { data: numbers } = await supabaseAdmin
      .from('phone_numbers')
      .select('status')
      .limit(2000)

    const numbersByStatus: Record<string, number> = {}
    for (const n of numbers || []) {
      const k = (n as any).status || 'unknown'
      numbersByStatus[k] = (numbersByStatus[k] || 0) + 1
    }

    // ── BILLING ──────────────────────────────────────────────────────────
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('plan, status')
      .eq('status', 'active')

    const activeByPlan: Record<string, number> = {}
    for (const s of subs || []) {
      const k = (s as any).plan || 'unknown'
      activeByPlan[k] = (activeByPlan[k] || 0) + 1
    }

    // Seats that are genuinely billed: not self-funded, not covered by
    // another of the same owner's seats, not suspended.
    const paidSeats = await count('team_seat_charges', q => q.eq('status', 'paid'))

    // ── PRIVACY ──────────────────────────────────────────────────────────
    const admins = await count('users', q => q.eq('is_admin', true))
    const excluded = await count('users', q => q.eq('exclude_from_analytics', true))
    const suppressed = await count('suppression_list')

    // ── INTEGRATIONS ─────────────────────────────────────────────────────
    // Presence only. Never the value.
    const configured = {
      telnyx: !!process.env.TELNYX_API_KEY && !!process.env.TELNYX_CONNECTION_ID,
      telnyxSip: !!process.env.TELNYX_SIP_USERNAME && !!process.env.TELNYX_SIP_PASSWORD,
      stripe: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID,
      stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
      clerk: !!process.env.CLERK_SECRET_KEY,
      clerkWebhook: !!process.env.CLERK_WEBHOOK_SIGNING_SECRET,
      supabase: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      sentry: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      gmail: !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      pushVapid: !!process.env.VAPID_PRIVATE_KEY,
      cronSecret: !!process.env.CRON_SECRET,
    }

    // Last time each inbound webhook actually delivered. Silence here is the
    // symptom that matters — a webhook that stops arriving breaks talk time,
    // AMD and recordings with nothing on screen to say so.
    const lastOf = async (table: string, col = 'created_at') => {
      const { data } = await supabaseAdmin
        .from(table)
        .select(col)
        .order(col, { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data as any)?.[col] ?? null
    }

    const lastTelnyxEvent = await lastOf('call_events')
    const lastStripeEvent = await lastOf('stripe_events')

    // ── ABOUT ────────────────────────────────────────────────────────────
    const sha = process.env.VERCEL_GIT_COMMIT_SHA || null
    const about = {
      version: process.env.npm_package_version || '0.1.0',
      commit: sha ? sha.slice(0, 7) : null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      region: process.env.VERCEL_REGION || null,
      node: process.version,
    }

    return NextResponse.json({
      success: true,
      branding: {
        tenants: (tenants || []).map((t: any) => ({
          slug: t.slug,
          active: !!t.is_active,
          createdAt: t.created_at,
        })),
        total: (tenants || []).length,
        active: (tenants || []).filter((t: any) => t.is_active).length,
      },
      numbers: {
        total: (numbers || []).length,
        byStatus: numbersByStatus,
        suppressed,
      },
      billing: {
        activeByPlan,
        activeTotal: (subs || []).length,
        paidSeats,
      },
      privacy: { admins, excludedFromAnalytics: excluded },
      integrations: { configured, lastTelnyxEvent, lastStripeEvent },
      crons: CRON_SCHEDULE,
      about,
    })
  } catch (error: any) {
    return apiError(error, { route: 'admin/settings-overview' })
  }
}
