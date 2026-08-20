import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { apiError } from '@/lib/apiError'
import { summariseSeatTier } from '@/lib/seatTiers'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// SEAT & TEAM REPORT — A RECORD, NOT A DASHBOARD
//
// This is the one thing in the product that may end up in front of an
// accountant, so it obeys a stricter rule than anything else here: every
// figure is a real settled charge, read from team_seat_charges and the
// subscriptions table. Nothing is estimated, nothing is projected, and nothing
// is rounded up to look better.
//
// PAID AND UNPAID ARE REPORTED SEPARATELY, and only paid money is totalled. A
// pending or failed charge is not an expense — including it would inflate a
// deduction with money that never left the account, which is the single
// worst thing this document could do to somebody.
//
// A period with no seat charges simply does not exist as a report. Generating
// an empty statement for a month somebody was not trading invites them to file
// it as though it meant something.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every period a statement can cover.
 *
 * Quarters and halves are here because that is how tax actually happens —
 * estimated payments are quarterly, and an accountant asking "what did you
 * spend in Q2" should not be handed three monthly statements to add up. Adding
 * them by hand is where transcription errors get into a return.
 *
 *   YYYY        full calendar year
 *   YYYY-H1/H2  half
 *   YYYY-Q1..Q4 quarter
 *   YYYY-MM     month
 */
function monthBounds(period: string): { start: Date; end: Date; label: string } | null {
  if (/^\d{4}$/.test(period)) {
    const y = Number(period)
    return {
      start: new Date(Date.UTC(y, 0, 1)),
      end: new Date(Date.UTC(y + 1, 0, 1)),
      label: `Calendar year ${y}`,
    }
  }

  const h = /^(\d{4})-H([12])$/.exec(period)
  if (h) {
    const y = Number(h[1])
    const half = Number(h[2])
    const startMonth = half === 1 ? 0 : 6
    return {
      start: new Date(Date.UTC(y, startMonth, 1)),
      end: new Date(Date.UTC(y, startMonth + 6, 1)),
      label: half === 1 ? `January – June ${y}` : `July – December ${y}`,
    }
  }

  const q = /^(\d{4})-Q([1-4])$/.exec(period)
  if (q) {
    const y = Number(q[1])
    const quarter = Number(q[2])
    const startMonth = (quarter - 1) * 3
    const startD = new Date(Date.UTC(y, startMonth, 1))
    const endD = new Date(Date.UTC(y, startMonth + 3, 1))
    const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
    const lastMonth = new Date(Date.UTC(y, startMonth + 2, 1))
    return {
      start: startD,
      end: endD,
      label: `Q${quarter} ${y} · ${fmt(startD)} – ${fmt(lastMonth)}`,
    }
  }

  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  if (mo < 0 || mo > 11) return null
  const start = new Date(Date.UTC(y, mo, 1))
  const end = new Date(Date.UTC(y, mo + 1, 1))
  return {
    start,
    end,
    label: start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }
}

/**
 * The comparable period immediately before this one.
 *
 * Like for like, always: a quarter compares against the previous quarter, never
 * against a month. Comparing a three-month total to a one-month total would
 * print a 200% collapse in spending that never happened.
 */
function previousPeriod(period: string): string | null {
  if (/^\d{4}$/.test(period)) return String(Number(period) - 1)

  const h = /^(\d{4})-H([12])$/.exec(period)
  if (h) {
    const y = Number(h[1])
    return Number(h[2]) === 1 ? `${y - 1}-H2` : `${y}-H1`
  }

  const q = /^(\d{4})-Q([1-4])$/.exec(period)
  if (q) {
    const y = Number(q[1])
    const quarter = Number(q[2])
    return quarter === 1 ? `${y - 1}-Q4` : `${y}-Q${quarter - 1}`
  }

  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = new Date(Date.UTC(y, mo - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

interface ChargeRow {
  id: string
  team_id: string | null
  agent_id: string
  amount_cents: number
  status: string
  period_start: string
  period_end: string
  created_at: string
  stripe_invoice_id: string | null
}

async function totalsFor(
  ownerId: string,
  start: Date,
  end: Date
): Promise<{ paidCents: number; paidCount: number; seatCount: number; rows: ChargeRow[] }> {
  const { data } = await supabaseAdmin
    .from('team_seat_charges')
    .select('id, team_id, agent_id, amount_cents, status, period_start, period_end, created_at, stripe_invoice_id')
    .eq('owner_id', ownerId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: true })
    .limit(5000)

  const rows = (data || []) as ChargeRow[]
  const paid = rows.filter(r => r.status === 'paid')
  return {
    paidCents: paid.reduce((n, r) => n + (r.amount_cents || 0), 0),
    paidCount: paid.length,
    seatCount: new Set(paid.map(r => r.agent_id)).size,
    rows,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const period = req.nextUrl.searchParams.get('period')

    // ── WHICH PERIODS EXIST ──────────────────────────────────────────────
    // Derived from real charges rather than from a calendar. A month only
    // appears once a seat was actually billed in it.
    if (!period) {
      const { data: allCharges } = await supabaseAdmin
        .from('team_seat_charges')
        .select('created_at, status')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(5000)

      const months = new Set<string>()
      const years = new Set<string>()
      for (const c of allCharges || []) {
        const d = new Date(c.created_at)
        months.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
        years.add(String(d.getUTCFullYear()))
      }

      // This year is always offered, even before the first seat is billed — an
      // owner checking mid-January should see an honest empty year rather than
      // a page that looks broken.
      const thisYear = new Date().getUTCFullYear()
      years.add(String(thisYear))

      // Quarters and halves for every year that has any activity, plus the
      // current one. Offered whether or not a given quarter has charges in it:
      // an accountant asking for Q2 needs a Q2 statement that says "nothing"
      // rather than an absence they have to interpret.
      const quarters: string[] = []
      const halves: string[] = []
      for (const y of Array.from(years).sort().reverse()) {
        for (const q of [4, 3, 2, 1]) quarters.push(`${y}-Q${q}`)
        for (const hh of [2, 1]) halves.push(`${y}-H${hh}`)
      }

      return NextResponse.json({
        success: true,
        months: Array.from(months).sort().reverse(),
        quarters,
        halves,
        years: Array.from(years).sort().reverse(),
      })
    }

    const bounds = monthBounds(period)
    if (!bounds) {
      return NextResponse.json({ success: false, error: 'Bad period' }, { status: 400 })
    }

    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('clerk_id, email, first_name, last_name, stripe_customer_id, report_legal_name, report_address, report_tax_id_note')
      .eq('clerk_id', userId)
      .maybeSingle()

    const current = await totalsFor(userId, bounds.start, bounds.end)

    // ── STRUCTURE AS IT STANDS TODAY ─────────────────────────────────────
    // Explicitly a snapshot, not a reconstruction of what the account looked
    // like during the period. Said plainly on the report, because a reader
    // would otherwise reasonably assume these counts are historical.
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name, created_at')
      .eq('owner_id', userId)

    const teamIds = (teams || []).map((t: any) => t.id)

    let membersByTeam: Record<string, number> = {}
    let campaignsByTeam: Record<string, number> = {}
    if (teamIds.length > 0) {
      const { data: members } = await supabaseAdmin
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds)
        .eq('status', 'active')
      for (const m of members || []) {
        membersByTeam[m.team_id] = (membersByTeam[m.team_id] || 0) + 1
      }

      const { data: tcs } = await supabaseAdmin
        .from('team_campaigns')
        .select('team_id')
        .in('team_id', teamIds)
      for (const t of tcs || []) {
        campaignsByTeam[t.team_id] = (campaignsByTeam[t.team_id] || 0) + 1
      }
    }

    // Agent names for the line items. A statement listing anonymous ids is
    // not something anybody can check against their own records.
    const agentIds = Array.from(new Set(current.rows.map(r => r.agent_id)))
    const agentName: Record<string, string> = {}
    if (agentIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('clerk_id, email, first_name, last_name')
        .in('clerk_id', agentIds)
      for (const u of users || []) {
        const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
        agentName[u.clerk_id] = full || u.email || u.clerk_id
      }
    }

    const teamName: Record<string, string> = {}
    for (const t of teams || []) teamName[t.id] = t.name

    // ── THEIR OWN PLAN ───────────────────────────────────────────────────
    // A Pro or Manager+ subscription is as much a business expense as the
    // seats are, and leaving it off would understate the deduction.
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, plan, status, amount_cents, created_at, current_period_end')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    // ── PAYMENT METHOD ───────────────────────────────────────────────────
    // Brand and last four only. A statement needs to identify which card paid;
    // it does not need — and must never carry — anything more than that.
    let paymentMethods: Array<{ brand: string; last4: string; expMonth: number; expYear: number }> = []
    if (owner?.stripe_customer_id) {
      try {
        const cards = await stripe.paymentMethods.list({
          customer: owner.stripe_customer_id,
          type: 'card',
          limit: 3,
        })
        paymentMethods = cards.data
          .filter(pm => pm.card)
          .map(pm => ({
            brand: pm.card!.brand,
            last4: pm.card!.last4,
            expMonth: pm.card!.exp_month,
            expYear: pm.card!.exp_year,
          }))
      } catch (e) {
        console.error('[seat-report] payment method lookup failed', e)
      }
    }

    // ── GROWTH ───────────────────────────────────────────────────────────
    // Against the period immediately before. Returned as raw previous values
    // alongside the current ones so the page can show both — a percentage on
    // its own hides the fact that a 200% rise was one seat becoming three.
    const prevKey = previousPeriod(period)
    let previous: any = null
    if (prevKey) {
      const pb = monthBounds(prevKey)
      if (pb) {
        const p = await totalsFor(userId, pb.start, pb.end)
        previous = {
          period: prevKey,
          label: pb.label,
          paidCents: p.paidCents,
          paidCount: p.paidCount,
          seatCount: p.seatCount,
        }
      }
    }

    // ── RECONCILED AGAINST WHAT ACTUALLY LEFT THE ACCOUNT ────────────────
    // amount_cents is what DialerSeat INTENDED to charge. A deduction has to be
    // what was actually paid, and the two differ the moment any discount,
    // proration or partial refund is involved — a volume discount would make
    // every line on this statement overstate the expense by the discounted
    // amount.
    //
    // So where a Stripe invoice exists it is the authority, and the difference
    // is reported as a discount rather than quietly absorbed. Lines that could
    // not be confirmed are marked as such instead of being presented with the
    // same confidence as the ones that were: a reader deciding what to file
    // needs to know which figures were verified against the processor.
    const RECONCILE_LIMIT = 250
    const reconciled = new Map<string, { paidCents: number; discountCents: number }>()
    let reconcileAttempted = 0
    let reconcileFailed = 0

    for (const r of current.rows) {
      if (!r.stripe_invoice_id) continue
      if (reconcileAttempted >= RECONCILE_LIMIT) break
      reconcileAttempted++
      try {
        const inv = await stripe.invoices.retrieve(r.stripe_invoice_id)
        const paid = typeof inv.amount_paid === 'number' ? inv.amount_paid : 0
        const discount = Math.max((r.amount_cents || 0) - paid, 0)
        reconciled.set(r.id, { paidCents: paid, discountCents: discount })
      } catch (e) {
        reconcileFailed++
      }
    }

    const lineItems = current.rows.map(r => {
      const rec = reconciled.get(r.id)
      return {
        id: r.id,
        date: r.created_at,
        agentName: agentName[r.agent_id] || r.agent_id,
        teamName: r.team_id ? (teamName[r.team_id] || 'Team') : '—',
        serviceStart: r.period_start,
        serviceEnd: r.period_end,
        // Listed rate, then what was actually taken, then the difference.
        // Showing all three is what makes a discount checkable rather than
        // something the reader has to take on trust.
        listCents: r.amount_cents,
        amountCents: rec ? rec.paidCents : r.amount_cents,
        discountCents: rec ? rec.discountCents : 0,
        reconciled: !!rec,
        status: r.status,
        invoiceId: r.stripe_invoice_id,
      }
    })

    const unpaid = current.rows.filter(r => r.status !== 'paid')

    // Recompute the paid total from reconciled figures where we have them, so
    // the headline number is money that genuinely moved.
    const paidLineItems = lineItems.filter(li => li.status === 'paid')
    const reconciledPaidCents = paidLineItems.reduce((n, li) => n + li.amountCents, 0)
    const totalDiscountCents = paidLineItems.reduce((n, li) => n + li.discountCents, 0)
    const listTotalCents = paidLineItems.reduce((n, li) => n + li.listCents, 0)

    // Standing at the time this report was generated. Deliberately labelled as
    // current rather than historical: it describes the account today, and a
    // discount shown beside a past period would imply it applied then.
    const activeSeatsNow = Object.values(membersByTeam).reduce((a, b) => a + b, 0)
    const tierNow = summariseSeatTier(activeSeatsNow, activeSeatsNow)

    return NextResponse.json({
      success: true,
      period,
      periodLabel: bounds.label,
      // ── A STABLE, HUMAN-READABLE NAME ────────────────────────────────
      // The same statement always carries the same reference, so a filed copy
      // and a re-downloaded one are visibly the same document rather than two
      // that have to be compared line by line. Built from the account holder
      // and the period, which is exactly how somebody would describe it out
      // loud: "my DialerSeat statement for March".
      documentRef: [
        (owner?.report_legal_name
          || [owner?.first_name, owner?.last_name].filter(Boolean).join(' ').trim()
          || owner?.email
          || 'ACCOUNT'
        ).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, ''),
        'DIALERSEAT',
        period.replace('-', '/'),
      ].join(' '),
      isYear: /^\d{4}$/.test(period),
      generatedAt: new Date().toISOString(),
      account: {
        // The legal name wins when it is set. A statement filed as a business
        // expense has to name the entity that incurred it, and the personal
        // name is only a fallback for somebody trading as themselves.
        name: owner?.report_legal_name
          || [owner?.first_name, owner?.last_name].filter(Boolean).join(' ').trim()
          || null,
        legalName: owner?.report_legal_name || null,
        address: owner?.report_address || null,
        reference: owner?.report_tax_id_note || null,
        email: owner?.email || null,
        customerId: owner?.stripe_customer_id || null,
      },
      // ── THE OTHER PARTY ────────────────────────────────────────────────
      // A receipt names both sides. Without a supplier on it this is a page of
      // numbers rather than evidence that a transaction happened between two
      // businesses — which is the whole point of keeping it.
      supplier: {
        name: 'DialerSeat',
        service: 'Cloud outbound dialing platform — per-seat software subscription',
        contact: 'support@dialerseat.com',
        site: 'dialerseat.com',
      },
      structure: {
        teamCount: (teams || []).length,
        teams: (teams || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          members: membersByTeam[t.id] || 0,
          campaigns: campaignsByTeam[t.id] || 0,
          createdAt: t.created_at,
        })),
        totalMembers: Object.values(membersByTeam).reduce((a, b) => a + b, 0),
        totalCampaigns: Object.values(campaignsByTeam).reduce((a, b) => a + b, 0),
      },
      billing: {
        // What actually left the account, after any discount.
        paidCents: reconciledPaidCents,
        // What it would have been at list. Equal to paidCents when nothing was
        // discounted, which is the honest way to show "no discount applied".
        listCents: listTotalCents,
        discountCents: totalDiscountCents,
        paidCount: current.paidCount,
        distinctSeats: current.seatCount,
        lineItems,
        // Reported, never totalled into the expense figure — a charge that
        // failed is not money spent.
        unpaidCount: unpaid.length,
        unpaidCents: unpaid.reduce((n, r) => n + (r.amount_cents || 0), 0),
        reconciliation: {
          attempted: reconcileAttempted,
          confirmed: reconciled.size,
          failed: reconcileFailed,
          // True only when every paid line was confirmed against Stripe.
          complete: paidLineItems.length > 0 && paidLineItems.every(li => li.reconciled),
        },
      },
      // Current standing, not the standing during the period.
      tier: {
        activeSeats: activeSeatsNow,
        label: tierNow.tier.label,
        percentOff: tierNow.percentOff,
      },
      subscriptions: (subs || []).map((s: any) => ({
        plan: s.plan,
        status: s.status,
        amountCents: s.amount_cents,
        startedAt: s.created_at,
      })),
      paymentMethods,
      previous,
    })
  } catch (error: any) {
    console.error('Seat report error:', error)
    return apiError(error, { route: 'reports/seat-report' })
  }
}
