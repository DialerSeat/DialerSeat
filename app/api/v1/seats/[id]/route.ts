import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson, str, seatOut } from '@/lib/developers/v1'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type P = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params
  return withV1(req, async ({ platform, env, store }) => {
    const seat = await store.getSeat(platform.id, id)
    if (!seat || seat.env !== env) return v1Error('not_found', `No seat ${id} in ${env} mode.`)
    const ex = (await store.listExceptions(platform.id)).find(e => e.scope === 'seat' && e.external_id === seat.external_user_id) || null
    return v1Json({ ...seatOut(seat), dial_mode_exception: ex ? { dial_mode: ex.dial_mode, allowed_modes: ex.allowed_modes } : null })
  })
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params
  return withV1(req, async ({ platform, env, store }) => {
    const seat = await store.getSeat(platform.id, id)
    if (!seat || seat.env !== env) return v1Error('not_found', `No seat ${id} in ${env} mode.`)
    const r = await readJson(req); if ('res' in r) return r.res
    const b = r.body
    const patch: { name?: string | null; email?: string | null; billed_to?: 'user' | 'platform' } = {}
    if ('name' in b) patch.name = str(b.name, 120)
    if ('email' in b) patch.email = str(b.email, 200)
    if ('billed_to' in b) {
      if (b.billed_to !== 'user' && b.billed_to !== 'platform') return v1Error('invalid_request', 'billed_to must be "user" or "platform".', 'billed_to')
      if (b.billed_to === 'platform' && platform.billing_model === 'user') return v1Error('forbidden', 'This platform bills users directly.', 'billed_to')
      patch.billed_to = b.billed_to
    }
    const out = await store.updateSeat(platform.id, id, patch)
    return v1Json(seatOut(out!))
  })
}

/** Stops the seat dialing. Its history stays. */
export async function DELETE(req: NextRequest, { params }: P) {
  const { id } = await params
  return withV1(req, async ({ platform, env, store }) => {
    const seat = await store.getSeat(platform.id, id)
    if (!seat || seat.env !== env) return v1Error('not_found', `No seat ${id} in ${env} mode.`)
    const out = await store.updateSeat(platform.id, id, { status: 'disabled' })
    return v1Json(seatOut(out!))
  })
}
