import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { addNumberByAreaCode } from '@/lib/numberPool'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/seed')

// Default seed list: 10 major metros across the US, intentionally diverse
// area codes so local-presence works for most callers out of the gate.
const DEFAULT_SEED = [
  { areaCode: '212', metro: 'New York' },
  { areaCode: '213', metro: 'Los Angeles' },
  { areaCode: '312', metro: 'Chicago' },
  { areaCode: '281', metro: 'Houston' },
  { areaCode: '602', metro: 'Phoenix' },
  { areaCode: '215', metro: 'Philadelphia' },
  { areaCode: '210', metro: 'San Antonio' },
  { areaCode: '619', metro: 'San Diego' },
  { areaCode: '214', metro: 'Dallas' },
  { areaCode: '408', metro: 'San Jose' },
]

// Admin-only one-shot endpoint. Buys 10 numbers and inserts them into the pool.
// Skips area codes that already have a number in the pool, so it's safe to
// re-run if some purchases failed mid-batch.
export async function POST(req: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    // Optional body: { areaCodes: ['212', '213'] } to override the default list.
    // No body = use the default 10-metro list.
    let seedList = DEFAULT_SEED
    try {
      const body = await req.json().catch(() => ({}))
      if (Array.isArray(body?.areaCodes) && body.areaCodes.length > 0) {
        seedList = body.areaCodes.map((ac: string) => ({
          areaCode: String(ac).trim(),
          metro: 'custom',
        }))
      }
    } catch {
      // No body, use default
    }

    // Find which area codes already have a number in the pool — skip those
    const { data: existing } = await supabase
      .from('phone_numbers')
      .select('area_code')
      .eq('status', 'active')

    const existingAreaCodes = new Set((existing ?? []).map((n) => n.area_code))

    const results: Array<{
      areaCode: string
      metro: string
      success: boolean
      phoneNumber?: string
      error?: string
      skipped?: boolean
    }> = []

    for (const { areaCode, metro } of seedList) {
      if (existingAreaCodes.has(areaCode)) {
        results.push({ areaCode, metro, success: true, skipped: true })
        continue
      }

      try {
        const purchased = await addNumberByAreaCode(areaCode)
        if (purchased) {
          results.push({
            areaCode,
            metro,
            success: true,
            phoneNumber: purchased.phone_number,
          })
        } else {
          results.push({
            areaCode,
            metro,
            success: false,
            error: 'No numbers available in this area code',
          })
        }
      } catch (err: any) {
        results.push({
          areaCode,
          metro,
          success: false,
          error: err.message,
        })
      }

      // Tiny delay between purchases so we don't hammer SignalWire's API
      await new Promise((r) => setTimeout(r, 250))
    }

    const purchased = results.filter((r) => r.success && !r.skipped).length
    const skipped = results.filter((r) => r.skipped).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      summary: { purchased, skipped, failed, total: seedList.length },
      results,
    })
  } catch (err: any) {
    console.error('[admin/pool/seed] error:', err)
    return apiError(err, { route: 'admin/pool/seed' })
  }
}