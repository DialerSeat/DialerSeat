import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServiceClient } from '@/lib/supabase'
import { sendAdminPush } from '@/lib/pushNotify'

// =============================================================================
// POST /api/suggestions — the "Ask us directly" box on /vs and /faq
// =============================================================================
// Public and unauthenticated on purpose: the whole point is that somebody who
// has not signed up can ask a question. That makes every field here hostile
// input, so the route validates and truncates before it touches the database,
// and the table itself has no RLS policies — only this route's service client
// can write to it.
//
// What it does NOT do: send email, accept attachments, or echo anything back
// into a page. A suggestion lands in the admin desktop's Suggestions app and
// buzzes a phone. That is the entire contract.
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KINDS = new Set(['question', 'suggestion', 'comparison', 'other'])

const MAX_MESSAGE = 4000
const MAX_EMAIL = 254
const MAX_PATH = 512

/** Submissions allowed from one IP inside the window. */
const RATE_LIMIT = 5
const RATE_WINDOW_MINUTES = 10

/**
 * The IP is hashed, never stored.
 *
 * Rate limiting needs to know "was this the same sender", which a hash answers
 * just as well as the address does. Keeping the raw IP would turn a marketing
 * feedback form into a table of personal data with a retention question
 * attached, for no gain.
 */
function hashIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for') || ''
  const ip = fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || ''
  if (!ip) return null
  const salt = process.env.SUGGESTION_IP_SALT || 'dialerseat-suggestions'
  return createHash('sha256').update(salt + ip).digest('hex').slice(0, 32)
}

/** Loose on purpose. A wrong-looking address is the sender's problem, not a 400. */
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().slice(0, MAX_EMAIL)
  if (!email) return null
  if (!email.includes('@') || email.includes(' ')) return null
  return email
}

export async function POST(req: NextRequest) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 })
  }

  const body = (payload ?? {}) as Record<string, unknown>

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ error: 'Please write a message.' }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Please keep it under ${MAX_MESSAGE} characters.` },
      { status: 400 },
    )
  }

  const kind = typeof body.kind === 'string' && KINDS.has(body.kind) ? body.kind : 'question'
  const email = normalizeEmail(body.email)
  const sourcePath =
    typeof body.sourcePath === 'string' ? body.sourcePath.slice(0, MAX_PATH) : null

  const supabase = getServiceClient('api/suggestions')
  const ipHash = hashIp(req)

  // ── RATE LIMIT ────────────────────────────────────────────────────────────
  // Counted in the database rather than in memory, because this runs
  // serverless: two submissions can land on two instances that each believe
  // they are the first. A miss here costs one extra row, not an outage, so a
  // failed count is allowed through rather than blocking a genuine sender.
  if (ipHash) {
    const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString()
    const { count, error: countErr } = await supabase
      .from('suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', windowStart)

    if (!countErr && (count ?? 0) >= RATE_LIMIT) {
      return NextResponse.json(
        { error: 'That is a lot of messages at once. Try again in a few minutes.' },
        { status: 429 },
      )
    }
  }

  const { data, error } = await supabase
    .from('suggestions')
    .insert({
      kind,
      message,
      email,
      source_path: sourcePath,
      ip_hash: ipHash,
      user_agent: (req.headers.get('user-agent') || '').slice(0, 512) || null,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[suggestions] insert failed:', error)
    return NextResponse.json(
      { error: 'Something went wrong saving that. Please try again.' },
      { status: 500 },
    )
  }

  // ── NOTIFY ────────────────────────────────────────────────────────────────
  // Deliberately after the insert and deliberately not awaited into the
  // response path's failure modes: the suggestion is already saved, and a
  // notification problem must never turn a successful submission into an error
  // for the person who wrote it.
  try {
    const preview = message.length > 140 ? `${message.slice(0, 140)}…` : message
    const from = email ? ` from ${email}` : ' (no email given)'
    await sendAdminPush('suggestion', `${preview}${from}`, {
      title: kind === 'suggestion' ? '💬 New Suggestion' : '💬 New Question',
      url: '/dashboard/admin/desktop?app=suggestions',
    })
  } catch (pushErr) {
    console.error('[suggestions] push failed (row was saved):', pushErr)
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null })
}
