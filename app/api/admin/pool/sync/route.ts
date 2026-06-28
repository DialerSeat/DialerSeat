import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getServiceClient } from '@/lib/supabase'
import { getAreaCodeInfo, extractAreaCode } from '@/lib/areaCode'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/sync')

const PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID!
const API_TOKEN = process.env.SIGNALWIRE_API_TOKEN!
const SPACE_URL = process.env.SIGNALWIRE_SPACE_URL!

/**
 * Admin endpoint: scans the entire SignalWire account for owned numbers,
 * compares against the phone_numbers table, and imports any missing ones.
 *
 * Use cases:
 *   - Import the legacy SIGNALWIRE_PHONE_NUMBER on first run
 *   - Sync numbers bought directly in the SignalWire dashboard (not via BUY NOW)
 *   - Repair drift if the pool table got out of sync somehow
 *
 * Idempotent — re-running just confirms everything is in sync.
 *
 * Usage from DevTools console while logged in as admin:
 *   fetch('/api/admin/pool/sync', { method: 'POST' }).then(r => r.json()).then(console.log)
 */
export async function POST() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    const authHeader = 'Basic ' + Buffer.from(`${PROJECT_ID}:${API_TOKEN}`).toString('base64')

    // -------------------------------------------------------------
    // Step 1: Fetch ALL numbers owned in SignalWire (paginated)
    // -------------------------------------------------------------
    const swNumbers: any[] = []
    let nextPageUrl: string | null =
      `https://${SPACE_URL}/api/laml/2010-04-01/Accounts/${PROJECT_ID}/IncomingPhoneNumbers.json?PageSize=100`

    while (nextPageUrl) {
      const res: Response = await fetch(nextPageUrl, {
        headers: { Authorization: authHeader },
      })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({
          error: `SignalWire fetch failed (${res.status}): ${text}`,
        }, { status: 500 })
      }
      const data = await res.json()
      swNumbers.push(...(data.incoming_phone_numbers || []))
      // SignalWire's LaML API returns next_page_uri as a relative path
      nextPageUrl = data.next_page_uri
        ? `https://${SPACE_URL}${data.next_page_uri}`
        : null
    }

    // -------------------------------------------------------------
    // Step 2: Fetch all numbers we already have in the pool
    // -------------------------------------------------------------
    const { data: existingPool } = await supabase
      .from('phone_numbers')
      .select('phone_number, signalwire_sid, status')

    // Build lookup sets — match by SID first (canonical), fall back to phone number
    const existingSids = new Set((existingPool ?? []).map((n) => n.signalwire_sid))
    const existingPhones = new Set((existingPool ?? []).map((n) => n.phone_number))

    // -------------------------------------------------------------
    // Step 3: Identify missing numbers and insert them
    // -------------------------------------------------------------
    const results: Array<{
      phone_number: string
      sid: string
      action: 'imported' | 'already_in_pool' | 'failed'
      area_code?: string
      state?: string | null
      region?: string | null
      error?: string
    }> = []

    for (const sw of swNumbers) {
      const phoneNumber = sw.phone_number
      const sid = sw.sid

      if (existingSids.has(sid) || existingPhones.has(phoneNumber)) {
        results.push({
          phone_number: phoneNumber,
          sid,
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
          signalwire_sid: sid,
          status: 'active',
          daily_call_count: 0,
          daily_cap: 50,
          lifetime_call_count: 0,
          monthly_cost_cents: 100,
          acquired_at: sw.date_created
            ? new Date(sw.date_created).toISOString()
            : new Date().toISOString(),
        })

      if (insertErr) {
        results.push({
          phone_number: phoneNumber,
          sid,
          action: 'failed',
          error: insertErr.message,
        })
      } else {
        results.push({
          phone_number: phoneNumber,
          sid,
          action: 'imported',
          area_code: areaCode || undefined,
          state: info?.state,
          region: info?.region,
        })
      }
    }

    // -------------------------------------------------------------
    // Step 4: Detect orphans (in pool but not in SignalWire)
    // These shouldn't normally exist but flag them so admin can investigate.
    // We don't auto-delete — that'd be destructive.
    // -------------------------------------------------------------
    const swSids = new Set(swNumbers.map((n) => n.sid))
    const orphans = (existingPool ?? [])
      .filter((p) => p.status !== 'released' && !swSids.has(p.signalwire_sid))
      .map((p) => p.phone_number)

    const summary = {
      signalwire_total: swNumbers.length,
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