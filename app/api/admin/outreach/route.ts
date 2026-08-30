import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'
import { parseContacts, normalizeEmail, isPlausibleEmail, isRoleAccount } from '@/lib/outreach'

const supabase = getServiceClient('admin/outreach')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/outreach
// =============================================================================
// The list and the opt-outs. NOT the sending — every transactional provider
// (Resend, SendGrid, Mailgun, SES) prohibits cold email in their terms, so
// sending belongs to a tool built for it, connected to mailboxes on a domain
// that is not dialerseat.com.
//
// Which is exactly why suppression lives here instead of there. A vendor's
// unsubscribe list dies with the vendor, and the day you switch is the day you
// would re-mail everyone who already said no — the fastest possible route to a
// complaint rate you cannot recover from.
// =============================================================================

const VALID_REASONS = ['unsubscribed', 'bounced', 'complained', 'manual', 'role_account'] as const

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'all'
    const search = (url.searchParams.get('q') || '').trim().toLowerCase()

    let q = supabase
      .from('outreach_contacts')
      .select('id, email, name, company, source, status, times_sent, last_sent_at, created_at, unsubscribe_token')
      .order('created_at', { ascending: false })
      .limit(2000)

    if (status !== 'all') q = q.eq('status', status)
    if (search) q = q.ilike('email', `%${search}%`)

    const { data: contacts, error } = await q
    if (error) throw error

    // Counts come from the table rather than from the page above, which is
    // capped — a stat that silently means "of the first 2000" is worse than no
    // stat, because it looks authoritative.
    const countFor = async (s?: string) => {
      let c = supabase.from('outreach_contacts').select('id', { count: 'exact', head: true })
      if (s) c = c.eq('status', s)
      const { count } = await c
      return count ?? 0
    }
    const { count: suppressed } = await supabase
      .from('outreach_suppression').select('email', { count: 'exact', head: true })

    const [total, fresh, sent, unsubscribed, bounced] = await Promise.all([
      countFor(), countFor('new'), countFor('sent'), countFor('unsubscribed'), countFor('bounced'),
    ])

    return NextResponse.json({
      ok: true,
      contacts: contacts ?? [],
      truncated: (contacts?.length ?? 0) >= 2000,
      stats: { total, new: fresh, sent, unsubscribed, bounced, suppressed: suppressed ?? 0 },
    })
  } catch (err) {
    return apiError(err, { route: 'admin/outreach' })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    // ── IMPORT ────────────────────────────────────────────────────────────
    // Every rejection is counted and reported rather than silently dropped.
    // "1,400 imported" hides that 300 were role accounts and 40 were already
    // suppressed, and those two numbers are the ones that decide whether the
    // next send gets you flagged.
    if (action === 'import') {
      const text = String(body.text || '')
      if (!text.trim()) return NextResponse.json({ error: 'Nothing to import' }, { status: 400 })
      if (text.length > 2_000_000) {
        return NextResponse.json({ error: 'Paste is too large — split it up' }, { status: 400 })
      }
      const source = String(body.source || '').trim().slice(0, 100) || 'paste'
      const keepRoleAccounts = body.keepRoleAccounts === true

      const { contacts, unreadable } = parseContacts(text)

      const invalid: string[] = []
      const roleAccounts: string[] = []
      const candidates = new Map<string, { email: string; name?: string; company?: string }>()

      for (const c of contacts) {
        const email = normalizeEmail(c.email)
        if (!isPlausibleEmail(email)) { invalid.push(email); continue }
        if (!keepRoleAccounts && isRoleAccount(email)) { roleAccounts.push(email); continue }
        candidates.set(email, { ...c, email })
      }

      const emails = [...candidates.keys()]
      if (emails.length === 0) {
        return NextResponse.json({
          ok: true,
          report: {
            parsed: contacts.length, imported: 0, duplicates: 0,
            suppressed: 0, roleAccounts: roleAccounts.length,
            invalid: invalid.length, unreadable: unreadable.length,
            samples: { unreadable: unreadable.slice(0, 5), roleAccounts: roleAccounts.slice(0, 5) },
          },
        })
      }

      // Suppression wins over everything. Re-importing someone who opted out
      // must not quietly put them back in the sending pool, which is what a
      // plain upsert would do.
      const suppressedHits = new Set<string>()
      const existing = new Set<string>()
      for (let i = 0; i < emails.length; i += 500) {
        const chunk = emails.slice(i, i + 500)
        const [{ data: sup }, { data: have }] = await Promise.all([
          supabase.from('outreach_suppression').select('email').in('email', chunk),
          supabase.from('outreach_contacts').select('email').in('email', chunk),
        ])
        for (const r of sup ?? []) suppressedHits.add(r.email)
        for (const r of have ?? []) existing.add(r.email)
      }

      const toInsert = emails
        .filter(e => !suppressedHits.has(e) && !existing.has(e))
        .map(e => {
          const c = candidates.get(e)!
          return { email: e, name: c.name ?? null, company: c.company ?? null, source }
        })

      let imported = 0
      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500)
        const { data, error } = await supabase
          .from('outreach_contacts')
          .upsert(chunk, { onConflict: 'email', ignoreDuplicates: true })
          .select('id')
        if (error) throw error
        imported += data?.length ?? 0
      }

      return NextResponse.json({
        ok: true,
        report: {
          parsed: contacts.length,
          imported,
          duplicates: existing.size,
          suppressed: suppressedHits.size,
          roleAccounts: roleAccounts.length,
          invalid: invalid.length,
          unreadable: unreadable.length,
          samples: {
            unreadable: unreadable.slice(0, 5),
            roleAccounts: roleAccounts.slice(0, 5),
            invalid: invalid.slice(0, 5),
          },
        },
      })
    }

    // ── SUPPRESS ──────────────────────────────────────────────────────────
    // Manual opt-outs: someone replies "take me off", a bounce report comes
    // back from the sending tool. Accepts a paste so a bounce list can go in
    // the same way the contacts did.
    if (action === 'suppress') {
      const reason = String(body.reason || 'manual')
      if (!(VALID_REASONS as readonly string[]).includes(reason)) {
        return NextResponse.json({ error: `reason must be one of ${VALID_REASONS.join(', ')}` }, { status: 400 })
      }
      const { contacts } = parseContacts(String(body.text || ''))
      const emails = contacts.map(c => normalizeEmail(c.email)).filter(isPlausibleEmail)
      if (!emails.length) return NextResponse.json({ error: 'No addresses found' }, { status: 400 })

      let added = 0
      for (let i = 0; i < emails.length; i += 500) {
        const chunk = emails.slice(i, i + 500).map(email => ({ email, reason, source: 'admin' }))
        const { data, error } = await supabase
          .from('outreach_suppression')
          .upsert(chunk, { onConflict: 'email', ignoreDuplicates: true })
          .select('email')
        if (error) throw error
        added += data?.length ?? 0
      }
      return NextResponse.json({ ok: true, added, submitted: emails.length })
    }

    // ── MARK SENT ─────────────────────────────────────────────────────────
    // Called after a batch actually goes out, so the next export does not
    // re-send to the same people.
    if (action === 'markSent') {
      const list = Array.isArray(body.emails) ? body.emails : []
      const emails = list.map((e: unknown) => normalizeEmail(String(e))).filter(isPlausibleEmail)
      if (!emails.length) return NextResponse.json({ error: 'No addresses given' }, { status: 400 })

      const now = new Date().toISOString()
      let updated = 0
      for (let i = 0; i < emails.length; i += 500) {
        const chunk = emails.slice(i, i + 500)
        // Only 'new' and 'sent' move. An unsubscribed or bounced row must not
        // be dragged back into the sending pool by a careless batch mark.
        const { data, error } = await supabase
          .from('outreach_contacts')
          .update({ status: 'sent', last_sent_at: now })
          .in('email', chunk)
          .in('status', ['new', 'sent'])
          .select('email')
        if (error) throw error
        updated += data?.length ?? 0
      }
      return NextResponse.json({ ok: true, updated })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    return apiError(err, { route: 'admin/outreach' })
  }
}
