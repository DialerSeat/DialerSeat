import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPoolConfig } from '@/lib/numberPool'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/config')

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

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
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })
  const userId = gate.clerkId

  const { data: u } = await supabase
    .from('users').select('email').eq('clerk_id', userId).maybeSingle()

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
  updates.updated_by = u?.email ?? userId

  const { data, error } = await supabase
    .from('pool_config')
    .update(updates)
    .eq('id', 1)
    .select()
    .single()

  if (error) return apiError(error, { route: 'admin/pool/config' })

  return NextResponse.json({ success: true, config: data })
}