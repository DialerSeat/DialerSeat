import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getServiceClient } from '@/lib/supabase'
import { getAreaCodeInfo, extractAreaCode } from '@/lib/areaCode'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/sync')

// =============================================================================
// POOL SYNC (Telnyx) — bulk reconcile Telnyx's owned numbers against our pool
// =============================================================================
// Admin tool: pulls every number Telnyx says we own and reconciles it
// against phone_numbers — importing anything missing, and flagging
// "orphans" (rows in our pool that Telnyx no longer shows as owned,
// e.g. released outside this app). Same job as the SignalWire version,
// rewritten against GET /v2/phone_numbers with page[size]/page[number]
// pagination (confirmed against Telnyx's own number-search/list docs
// during the build) instead of SignalWire's IncomingPhoneNumbers.json +
// next_page_uri cursor style.
// =============================================================================

export async function POST() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    const apiKey = process.env.TELNYX_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'TELNYX_API_KEY not set' }, { status: 500 })
    }

    const telnyxNumbers: Array<{ id: string; phone_number: string; created_at?: string }> = []
    let page = 1
    const pageSize = 250
    const maxPages = 40 // 40 * 250 = 10,000 numbers, generous ceiling

    while (page <= maxPages) {
      const params = new URLSearchParams({ 'page[size]': String(pageSize), 'page[number]': String(page) })
      const res = await fetch(`https://api.telnyx.com/v2/phone_numbers?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({
          error: `Telnyx fetch failed (${res.status}): ${text}`,
        }, { status: 500 })
      }
      const data = await res.json()
      const batch: Array<{ id: string; phone_number: string; created_at?: string }> = data.data || []
      telnyxNumbers.push(...batch)

      if (batch.length < pageSize) break // last page
      page++
    }

    const { data: existingPool } = await supabase
      .from('phone_numbers')
      .select('phone_number, signalwire_sid, status')

    // Column is still named signalwire_sid in this shared schema — holds
    // Telnyx's own number id here, same reasoning as
    // lib/telnyxProvision.ts's other writes to this column.
    const existingIds = new Set((existingPool ?? []).map((n) => n.signalwire_sid))
    const existingPhones = new Set((existingPool ?? []).map((n) => n.phone_number))

    const results: Array<{
      phone_number: string
      id: string
      action: 'imported' | 'already_in_pool' | 'failed'
      area_code?: string
      state?: string | null
      region?: string | null
      error?: string
    }> = []

    for (const tn of telnyxNumbers) {
      const phoneNumber = tn.phone_number
      const id = tn.id

      if (existingIds.has(id) || existingPhones.has(phoneNumber)) {
        results.push({
          phone_number: phoneNumber,
          id,
          action: 'already_in_pool',
        })
        continue
      }

      const areaCode = extractAreaCode(phoneNumber)
      const info = areaCode ? getAreaCodeInfo(areaCode) : null

      const { error: insertErr } = await supabase
        .from('phone_numbers')
        .insert({
          phone_number: phoneNumber,
          area_code: areaCode || '???',
          state: info?.state ?? null,
          region: info?.region ?? null,
          signalwire_sid: id,
          status: 'active',
          daily_call_count: 0,
          daily_cap: 50,
          lifetime_call_count: 0,
          monthly_cost_cents: 100,
          acquired_at: tn.created_at
            ? new Date(tn.created_at).toISOString()
            : new Date().toISOString(),
        })

      if (insertErr) {
        results.push({
          phone_number: phoneNumber,
          id,
          action: 'failed',
          error: insertErr.message,
        })
      } else {
        results.push({
          phone_number: phoneNumber,
          id,
          action: 'imported',
          area_code: areaCode || undefined,
          state: info?.state,
          region: info?.region,
        })
      }
    }

    const telnyxIds = new Set(telnyxNumbers.map((n) => n.id))
    const orphans = (existingPool ?? [])
      .filter((p) => p.status !== 'released' && !telnyxIds.has(p.signalwire_sid))
      .map((p) => p.phone_number)

    const summary = {
      telnyx_total: telnyxNumbers.length,
      pool_total: existingPool?.length ?? 0,
      imported: results.filter((r) => r.action === 'imported').length,
      already_in_pool: results.filter((r) => r.action === 'already_in_pool').length,
      failed: results.filter((r) => r.action === 'failed').length,
      orphans: orphans.length,
      orphan_numbers: orphans,
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
    })
  } catch (err: any) {
    console.error('[pool/sync] error:', err)
    return apiError(err, { route: 'admin/pool/sync' })
  }
}
