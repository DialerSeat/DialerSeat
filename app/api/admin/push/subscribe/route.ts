import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/push/subscribe')

// Body shape matches PushSubscriptionJSON from the browser's Push API,
// plus an optional user-agent label for display in a future "devices"
// list (not built yet — the column exists so we don't need another
// migration when that gets added).
interface SubscribeBody {
  endpoint: string
  keys: { p256dh: string; auth: string }
  userAgentLabel?: string
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    const gate = await requireAdmin()
    userId = gate.userId
  } catch (res) {
    return res as Response
  }

  let body: SubscribeBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Missing endpoint or keys' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        clerk_id: userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: body.userAgentLabel || null,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('[admin/push/subscribe] upsert failed:', error)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  let body: { endpoint?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body?.endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)

  if (error) {
    console.error('[admin/push/subscribe] delete failed:', error)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
