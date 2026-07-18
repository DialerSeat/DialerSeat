import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { sendAdminPush } from '@/lib/pushNotify'

// ─────────────────────────────────────────────────────────────────────────
// Clerk webhook endpoint. Point Clerk's dashboard (Configure > Webhooks) at
// POST https://<your-domain>/api/webhooks/clerk, subscribed to at least
// `user.created`. Requires CLERK_WEBHOOK_SIGNING_SECRET (from the same
// dashboard screen) — verifyWebhook() throws without it or on a bad
// signature, and we 400 in that case.
//
// This fills a real gap: prior to this route, no code in this repo ever
// inserted a row into `users` — after an exhaustive search (no other
// webhook, no middleware, no schema trigger), account creation appears to
// have relied on something outside this codebase, or wasn't guaranteed at
// all. This route makes that explicit and reliable, and is also the
// trigger point for the "New Sign-Ups" push notification.
//
// Upsert (not insert) on clerk_id so this is safe to re-run — e.g. if
// Clerk redelivers a webhook, or if some other path already created the
// row before this endpoint existed.
// ─────────────────────────────────────────────────────────────────────────

const supabase = getServiceClient('webhooks/clerk')

export async function POST(req: NextRequest) {
  let evt
  try {
    evt = await verifyWebhook(req)
  } catch (err) {
    console.error('[webhooks/clerk] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (evt.type !== 'user.created') {
    // We only act on user.created today. Other event types (user.updated,
    // user.deleted, etc.) are received and acknowledged but intentionally
    // no-ops for now — add cases here if/when those need handling.
    return NextResponse.json({ ok: true, skipped: evt.type })
  }

  const data = evt.data
  const clerkId = data.id
  const email =
    data.email_addresses?.find(e => e.id === data.primary_email_address_id)?.email_address ||
    data.email_addresses?.[0]?.email_address ||
    null
  const phone = data.phone_numbers?.[0]?.phone_number || null

  const { error } = await supabase
    .from('users')
    .upsert(
      {
        clerk_id: clerkId,
        email,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        phone,
        username: data.username || null,
      },
      { onConflict: 'clerk_id' }
    )

  if (error) {
    console.error('[webhooks/clerk] failed to upsert users row:', error)
    return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 })
  }

  const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || email?.split('@')[0] || 'Someone'
  await sendAdminPush('signup', `${name} just created a DialerSeat account.`)

  return NextResponse.json({ ok: true })
}
