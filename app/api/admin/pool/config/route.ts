import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getPoolConfig } from '@/lib/numberPool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Admin pool config — read (GET) or update (POST).
 *
 * Allows raising/lowering caps without redeploying. The "200 max" is just a
 * default; admin can change it from the pool dashboard. Sane bounds enforced
 * server-side so nothing too crazy goes through.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: u } = await supabase
    .from('users').select('is_admin').eq('clerk_id', userId).single()
  if (!u?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const config = await getPoolConfig()
  return NextResponse.json({ success: true, config })
}

const HARD_BOUNDS = {
  max_pool_size: { min: 10, max: 5000 },
  daily_buy_cap: { min: 1, max: 500 },
  utilization_trigger_pct: { min: 30, max: 99 },
  sustained_hours_required: { min: 1, max: 24 },
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: u } = await supabase
    .from('users').select('is_admin, email').eq('clerk_id', userId).single()
  if (!u?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, any> = {}

  for (const key of Object.keys(HARD_BOUNDS) as Array<keyof typeof HARD_BOUNDS>) {
    if (body[key] !== undefined) {
      const value = parseInt(body[key], 10)
      const bounds = HARD_BOUNDS[key]
      if (isNaN(value) || value < bounds.min || value > bounds.max) {
        return NextResponse.json({
          error: `${key} must be between ${bounds.min} and ${bounds.max}`,
        }, { status: 400 })
      }
      updates[key] = value
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()
  updates.updated_by = u.email ?? userId

  const { data, error } = await supabase
    .from('pool_config')
    .update(updates)
    .eq('id', 1)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, config: data })
}