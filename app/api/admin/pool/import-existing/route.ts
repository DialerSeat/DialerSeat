import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getServiceClient } from '@/lib/supabase'
import { getAreaCodeInfo, extractAreaCode } from '@/lib/areaCode'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/import-existing')

// =============================================================================
// IMPORT EXISTING NUMBER (Telnyx)
// =============================================================================
// Admin one-off tool: rescue a number that's already owned on the Telnyx
// account (purchased outside this app's normal pool flow, or left over
// from manual testing) into the phone_numbers pool table.
//
// REWRITTEN FOR TELNYX — the whole premise changed, not just the API
// calls: the SignalWire version looked up a number in a SignalWire
// account that no longer exists for this app at all (this repo is 100%
// Telnyx — see TELNYX-MIGRATION-DESIGN.md). This version looks the
// number up among Telnyx's OWNED numbers (GET /v2/phone_numbers) instead
// of SignalWire's IncomingPhoneNumbers.
//
// MATCHING APPROACH: Telnyx's v2 owned-numbers filter parameter for exact
// phone-number matching wasn't confirmed precisely enough during the
// build to rely on blindly, so this fetches the account's numbers and
// matches the target number client-side by exact string equality —
// slower for accounts with very large pools, but always correct
// regardless of filter param naming, and this is a rarely-run admin tool
// where that tradeoff is fine.
// =============================================================================

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    const body = await req.json().catch(() => ({}))
    const targetNumber: string | undefined = body?.phone_number || process.env.TELNYX_PHONE_NUMBER

    if (!targetNumber) {
      return NextResponse.json({
        error: 'No phone_number provided in request body and TELNYX_PHONE_NUMBER env var not set',
      }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('phone_number', targetNumber)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyImported: true,
        number: existing,
      })
    }

    const apiKey = process.env.TELNYX_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'TELNYX_API_KEY not set' }, { status: 500 })
    }

    // Page through owned numbers looking for an exact match. Telnyx pages
    // at up to 250/request; a real account's owned-number count is small
    // enough that a handful of pages comfortably covers it for an admin
    // tool run occasionally, not on a hot path.
    let telnyxNumber: { id: string; phone_number: string; created_at?: string } | null = null
    let page = 1
    const maxPages = 20
    while (page <= maxPages && !telnyxNumber) {
      const params = new URLSearchParams({ 'page[size]': '250', 'page[number]': String(page) })
      const res = await fetch(`https://api.telnyx.com/v2/phone_numbers?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({
          error: `Telnyx lookup failed (${res.status}): ${text}`,
        }, { status: 500 })
      }
      const json = await res.json()
      const numbers: Array<{ id: string; phone_number: string; created_at?: string }> = json.data || []
      if (numbers.length === 0) break

      telnyxNumber = numbers.find(n => n.phone_number === targetNumber) || null
      page++
    }

    if (!telnyxNumber) {
      return NextResponse.json({
        error: `Number ${targetNumber} not found among your Telnyx account's owned numbers`,
      }, { status: 404 })
    }

    const areaCode = extractAreaCode(targetNumber)
    const info = areaCode ? getAreaCodeInfo(areaCode) : null

    const { data: inserted, error: insertErr } = await supabase
      .from('phone_numbers')
      .insert({
        phone_number: targetNumber,
        area_code: areaCode,
        state: info?.state ?? null,
        region: info?.region ?? null,
        // Telnyx's own number id, same as every other write to this column
        // (see lib/telnyxProvision.ts).
        provider_number_id: telnyxNumber.id,
        status: 'active',
        daily_call_count: 0,
        daily_cap: 125,
        lifetime_call_count: 0,
        monthly_cost_cents: 100,
        acquired_at: telnyxNumber.created_at
          ? new Date(telnyxNumber.created_at).toISOString()
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
      message: `Successfully imported ${targetNumber} (${info?.state || '?'} · ${info?.region || 'unknown'}) into the pool.`,
    })
  } catch (err: any) {
    console.error('[pool/import-existing] error:', err)
    return apiError(err, { route: 'admin/pool/import-existing' })
  }
}
