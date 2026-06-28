import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'

const supabase = getServiceClient('admin/logs')

// =============================================================================
// ADMIN LOGS API (v1 — the backend the Logs app has been fetching)
// =============================================================================
// The Logs app (v21+) GETs /api/admin/logs expecting:
//   { entries: LogEntry[], counts: { signups, renewals, cancels }, window_days }
// This route never existed — that's why the app showed errors. It merges:
//   SIGNUP  — subscriptions created in the window (never-paid incomplete /
//             incomplete_expired excluded), amount = the plan's weekly price
//   CANCEL  — subscriptions with canceled_at in the window, with
//             retention_weeks = lifetime from created_at to canceled_at
//   RENEWAL — Stripe paid invoices with billing_reason 'subscription_cycle'
//             in the window, amount = invoice.amount_paid, mapped to users
//             via users.stripe_customer_id
// Exclusions match the analytics route: is_admin and exclude_from_analytics
// users never appear. Sorted newest-first, capped at 200 entries, 90-day
// window.
// =============================================================================

const WINDOW_DAYS = 90
const MAX_ENTRIES = 200
const NEVER_PAID_STATUSES = ['incomplete', 'incomplete_expired']

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || ''
const WL_PRICE_ID = process.env.STRIPE_PRICE_WL_BASE || ''
const PRO_WEEKLY_CENTS = 35 * 100
const WL_WEEKLY_CENTS = 75 * 100

interface LogEntry {
  id: string
  event_type: 'signup' | 'renewal' | 'cancel'
  user_name: string
  user_email: string | null
  amount_cents: number
  date_iso: string
  retention_weeks: number | null
  source: string
}

function weeklyCentsFor(priceId: string | null): number {
  if (priceId && priceId === WL_PRICE_ID) return WL_WEEKLY_CENTS
  if (priceId && priceId === PRO_PRICE_ID) return PRO_WEEKLY_CENTS
  return 0
}

function nameFor(u: { first_name?: string | null; last_name?: string | null; email?: string | null } | undefined): string {
  if (!u) return '(unknown)'
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return full || u.email?.split('@')[0] || '(unknown)'
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const now = Date.now()
  const day = 86400000
  const windowStart = now - WINDOW_DAYS * day

  try {
    // ── Users + exclusions ──────────────────────────────────────────────
    const { data: users } = await supabase
      .from('users')
      .select('clerk_id, email, first_name, last_name, stripe_customer_id, is_admin, exclude_from_analytics')

    const excluded = new Set<string>()
    const userByClerkId = new Map<string, any>()
    const userByCustomerId = new Map<string, any>()
    for (const u of users || []) {
      if (u.is_admin || u.exclude_from_analytics) {
        excluded.add(u.clerk_id)
        continue
      }
      userByClerkId.set(u.clerk_id, u)
      if (u.stripe_customer_id) userByCustomerId.set(u.stripe_customer_id, u)
    }

    // ── Subscriptions → signups + cancels ───────────────────────────────
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id, status, created_at, canceled_at, stripe_price_id, stripe_subscription_id')

    const entries: LogEntry[] = []
    let signups = 0
    let cancels = 0

    for (const s of subs || []) {
      if (excluded.has(s.user_id)) continue
      const u = userByClerkId.get(s.user_id)

      // SIGNUP — paid sub created in window
      if (!NEVER_PAID_STATUSES.includes(s.status)) {
        const created = new Date(s.created_at).getTime()
        if (created >= windowStart && created <= now) {
          signups++
          entries.push({
            id: `signup-${s.stripe_subscription_id || s.user_id + '-' + s.created_at}`,
            event_type: 'signup',
            user_name: nameFor(u),
            user_email: u?.email ?? null,
            amount_cents: weeklyCentsFor(s.stripe_price_id),
            date_iso: s.created_at,
            retention_weeks: null,
            source: 'supabase:subscriptions',
          })
        }
      }

      // CANCEL — canceled in window
      if (s.status === 'canceled' && s.canceled_at) {
        const canceled = new Date(s.canceled_at).getTime()
        if (canceled >= windowStart && canceled <= now) {
          cancels++
          const lifetimeMs = canceled - new Date(s.created_at).getTime()
          entries.push({
            id: `cancel-${s.stripe_subscription_id || s.user_id + '-' + s.canceled_at}`,
            event_type: 'cancel',
            user_name: nameFor(u),
            user_email: u?.email ?? null,
            amount_cents: 0,
            date_iso: s.canceled_at,
            retention_weeks: Math.max(0, Math.round((lifetimeMs / (7 * day)) * 10) / 10),
            source: 'supabase:subscriptions',
          })
        }
      }
    }

    // ── Stripe paid cycle invoices → renewals ────────────────────────────
    let renewals = 0
    try {
      const createdGte = Math.floor(windowStart / 1000)
      let startingAfter: string | undefined
      for (let page = 0; page < 3; page++) {
        const batch = await stripe.invoices.list({
          status: 'paid',
          created: { gte: createdGte },
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        })
        for (const inv of batch.data) {
          if (inv.billing_reason !== 'subscription_cycle') continue
          // Skip $0 renewals — fully-discounted/100%-coupon cycles aren't
          // revenue events and only clutter the stream. (JC, this push.)
          if ((inv.amount_paid ?? 0) <= 0) continue
          const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
          if (!customerId) continue
          const u = userByCustomerId.get(customerId)
          // Unknown customer → either an excluded user or stale data; skip
          // excluded users, keep genuinely unknown ones visible as (unknown)
          if (!u) {
            const isExcludedUser = (users || []).some(x =>
              x.stripe_customer_id === customerId && (x.is_admin || x.exclude_from_analytics)
            )
            if (isExcludedUser) continue
          }
          renewals++
          entries.push({
            id: `renewal-${inv.id}`,
            event_type: 'renewal',
            user_name: nameFor(u),
            user_email: u?.email ?? null,
            amount_cents: inv.amount_paid ?? 0,
            date_iso: new Date((inv.created as number) * 1000).toISOString(),
            retention_weeks: null,
            source: 'stripe:invoices',
          })
        }
        if (!batch.has_more || batch.data.length === 0) break
        startingAfter = batch.data[batch.data.length - 1].id
      }
    } catch (err) {
      // Renewals are additive — if Stripe is unreachable, still return the
      // Supabase-derived events rather than failing the whole endpoint.
      console.warn('[admin/logs] Stripe invoice fetch failed:', err)
    }

    entries.sort((a, b) => new Date(b.date_iso).getTime() - new Date(a.date_iso).getTime())

    return NextResponse.json({
      entries: entries.slice(0, MAX_ENTRIES),
      counts: { signups, renewals, cancels },
      window_days: WINDOW_DAYS,
    })
  } catch (err) {
    console.error('[admin/logs] failed:', err)
    return NextResponse.json({ error: 'Failed to build logs' }, { status: 500 })
  }
}