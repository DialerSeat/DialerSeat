import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { sendAdminPush } from '@/lib/pushNotify'
import { logBillingEvent } from '@/lib/billingEvents'

// ─────────────────────────────────────────────────────────────────────────
// Clerk webhook endpoint. Point Clerk's dashboard (Configure > Webhooks) at
// POST https://<your-domain>/api/webhooks/clerk, subscribed to at least
// `user.created` and `user.deleted`. Requires CLERK_WEBHOOK_SIGNING_SECRET
// (from the same dashboard screen) — verifyWebhook() throws without it or
// on a bad signature, and we 400 in that case.
//
// This fills a real gap: prior to this route, no code in this repo ever
// inserted a row into `users` — after an exhaustive search (no other
// webhook, no middleware, no schema trigger), account creation appears to
// have relied on something outside this codebase, or wasn't guaranteed at
// all. This route makes that explicit and reliable, and is also the
// trigger point for the "New Sign-Ups" and "Account Deletions" push
// notifications.
//
// user.deleted: this only fires if an account is deleted directly through
// Clerk (dashboard/API), bypassing DialerSeat's own UI entirely. The more
// common path — someone using DialerSeat's own "delete my account" flow —
// goes through lib/deleteAccount.ts instead, which hard-deletes the users
// row (and everything else keyed to it) rather than going through Clerk
// first. Both paths call logBillingEvent('account_deleted', ...) so the
// audit trail and notification fire the same way regardless of which
// route someone's deletion took. Neither path relies on a `deleted_at`
// column on `users` — deleteAccount() genuinely removes that row, so
// anything living only on that row can't survive it; billing_events has
// no foreign key to `users` for exactly this reason.
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

  if (evt.type === 'user.deleted') {
    // Clerk's deletion payload only has { id, deleted, external_id? } — the
    // name/email are already gone from Clerk by the time this fires, so
    // look up whatever DialerSeat still has on file (the users row itself
    // is untouched by a Clerk-side deletion — only deleteAccount() removes
    // that row, and this webhook is a different path from that).
    const clerkId = evt.data.id
    if (!clerkId) {
      return NextResponse.json({ ok: true, skipped: 'no id on delete payload' })
    }

    const { data: existing } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    const name =
      `${existing?.first_name || ''} ${existing?.last_name || ''}`.trim() ||
      existing?.email?.split('@')[0] ||
      'A user'

    await sendAdminPush('account_deleted', `${name} deleted account.`)
    await logBillingEvent({
      event_type: 'account_deleted',
      clerk_id: clerkId,
      user_name: name,
      user_email: existing?.email ?? null,
    })

    return NextResponse.json({ ok: true })
  }

  if (evt.type !== 'user.created') {
    // Other event types (user.updated, etc.) are received and acknowledged
    // but intentionally no-ops for now — add cases here if/when those need
    // handling.
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
  await sendAdminPush('signup', `${name} created account.`)
  await logBillingEvent({
    event_type: 'account_created',
    clerk_id: clerkId,
    user_name: name,
    user_email: email,
  })

  return NextResponse.json({ ok: true })
}
