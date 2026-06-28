import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getServiceClient } from '@/lib/supabase'
import { getAreaCodeInfo, extractAreaCode } from '@/lib/areaCode'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/import-existing')

const PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID!
const API_TOKEN = process.env.SIGNALWIRE_API_TOKEN!
const SPACE_URL = process.env.SIGNALWIRE_SPACE_URL!

/**
 * One-shot admin endpoint: imports the legacy SIGNALWIRE_PHONE_NUMBER (the
 * single number that existed before the pool was built) into the phone_numbers
 * table so it shows up on the dashboard and gets full pool tracking.
 *
 * Idempotent — re-running just confirms it's already imported, doesn't error.
 *
 * Usage (one time, from DevTools console while logged in as admin):
 *   fetch('/api/admin/pool/import-existing', { method: 'POST' })
 *     .then(r => r.json()).then(console.log)
 */
export async function POST() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    const legacyNumber = process.env.SIGNALWIRE_PHONE_NUMBER
    if (!legacyNumber) {
      return NextResponse.json({
        error: 'SIGNALWIRE_PHONE_NUMBER env var not set',
      }, { status: 400 })
    }

    // Idempotency: if we already imported it, just return the existing row
    const { data: existing } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('phone_number', legacyNumber)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyImported: true,
        number: existing,
      })
    }

    // Look up the number in SignalWire to get the SID and metadata
    const authHeader = 'Basic ' + Buffer.from(`${PROJECT_ID}:${API_TOKEN}`).toString('base64')
    const lookupUrl = `https://${SPACE_URL}/api/laml/2010-04-01/Accounts/${PROJECT_ID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(legacyNumber)}`

    const lookupRes = await fetch(lookupUrl, {
      headers: { Authorization: authHeader },
    })

    if (!lookupRes.ok) {
      const text = await lookupRes.text()
      return NextResponse.json({
        error: `SignalWire lookup failed (${lookupRes.status}): ${text}`,
      }, { status: 500 })
    }

    const lookupData = await lookupRes.json()
    const numbers = lookupData.incoming_phone_numbers || []

    if (numbers.length === 0) {
      return NextResponse.json({
        error: `Number ${legacyNumber} not found in your SignalWire account`,
      }, { status: 404 })
    }

    const swNumber = numbers[0]
    const areaCode = extractAreaCode(legacyNumber)
    const info = areaCode ? getAreaCodeInfo(areaCode) : null

    // Insert the pool row with all metadata derived from area code lookup
    const { data: inserted, error: insertErr } = await supabase
      .from('phone_numbers')
      .insert({
        phone_number: legacyNumber,
        area_code: areaCode,
        state: info?.state ?? null,
        region: info?.region ?? null,
        signalwire_sid: swNumber.sid,
        status: 'active',
        daily_call_count: 0,
        daily_cap: 50,
        lifetime_call_count: 0,
        monthly_cost_cents: 100,
        // We don't know the real acquired_at, use SignalWire's date_created if available
        acquired_at: swNumber.date_created
          ? new Date(swNumber.date_created).toISOString()
          : new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({
        error: `DB insert failed: ${insertErr.message}`,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      imported: true,
      number: inserted,
      areaCodeInfo: info,
      message: `Successfully imported ${legacyNumber} (${info?.state || '?'} · ${info?.region || 'unknown'}) into the pool.`,
    })
  } catch (err: any) {
    console.error('[pool/import-existing] error:', err)
    return apiError(err, { route: 'admin/pool/import-existing' })
  }
}