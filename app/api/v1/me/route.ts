import type { NextRequest } from 'next/server'
import { withV1, v1Json } from '@/lib/developers/v1'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** The quickest way to check a key works: which platform, which environment, can it dial. */
export async function GET(req: NextRequest) {
  return withV1(req, async ({ platform, env, key }) => v1Json({
    object: 'platform',
    id: platform.id,
    name: platform.name,
    livemode: env === 'live',
    key: { id: key.id, name: key.name, last4: key.last4 },
    can_dial: env === 'test' ? 'simulated' : platform.live_status === 'active',
    live_status: platform.live_status,
    dial_modes: { default: platform.default_dial_mode, allowed: platform.allowed_dial_modes, seats_may_choose: platform.seats_may_choose_mode },
    billing_model: platform.billing_model,
  }))
}
