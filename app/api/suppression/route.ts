import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'
import { addSuppression, addSuppressionBulk } from '@/lib/suppression'
import { normalizeToE164 } from '@/lib/phoneNormalize'

export const dynamic = 'force-dynamic'

// =============================================================================
// SUPPRESSION LIST — the account's own do-not-call numbers
// =============================================================================
// Scoped hard to the caller. A user can only ever read, add or remove rows in
// their own list: one tenant's opt-outs are not another tenant's business, and
// a shared list would leak who they have been calling.
//
// Platform-scope rows (litigators, known complainants, a future registry feed)
// are enforced on every dial but are NOT exposed here — they're not the user's
// to see or edit.
// =============================================================================

const supabase = getServiceClient('suppression-api')

/** Cap on a single upload. Above this, the request body itself is the problem. */
const MAX_UPLOAD = 50_000

export async function GET(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') || '').trim()
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500)

    let query = supabase
      .from('suppression_list')
      .select('id, phone_e164, reason, source, created_at', { count: 'exact' })
      .eq('scope', 'user')
      .eq('user_id', gate.userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (search) {
      // Match on the normalized form when the search term is a real number,
      // so "(336) 555-0142" finds the row stored as +13365550142.
      const normalized = normalizeToE164(search)
      query = normalized
        ? query.eq('phone_e164', normalized)
        : query.ilike('phone_e164', `%${search.replace(/\D/g, '')}%`)
    }

    const { data, count, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, entries: data ?? [], total: count ?? 0 })
  } catch (err) {
    return apiError(err, { route: 'suppression:GET' })
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response

    let body: { phone?: unknown; phones?: unknown; reason?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    // Bulk path — a pasted or uploaded scrub list.
    if (Array.isArray(body.phones)) {
      const phones = body.phones.filter((p): p is string => typeof p === 'string')
      if (phones.length === 0) {
        return NextResponse.json({ success: false, error: 'No numbers provided' }, { status: 400 })
      }
      if (phones.length > MAX_UPLOAD) {
        return NextResponse.json(
          { success: false, error: `Too many at once, split into batches of ${MAX_UPLOAD.toLocaleString()}` },
          { status: 413 }
        )
      }
      const { added, invalid } = await addSuppressionBulk(phones, gate.userId)
      // Invalid rows are reported, never silently dropped: someone uploading a
      // scrub list has to know which numbers didn't take, or they'll believe
      // they're covered when they aren't.
      return NextResponse.json({
        success: true,
        added,
        invalid_count: invalid.length,
        invalid_sample: invalid.slice(0, 20),
      })
    }

    if (typeof body.phone !== 'string') {
      return NextResponse.json({ success: false, error: 'phone or phones required' }, { status: 400 })
    }

    const result = await addSuppression({
      phone: body.phone,
      userId: gate.userId,
      scope: 'user',
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
      source: 'manual',
    })

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(err, { route: 'suppression:POST' })
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    // Both scope and user_id in the predicate: without them, an id from
    // another account — or a platform row — would be deletable by guessing.
    const { error } = await supabase
      .from('suppression_list')
      .delete()
      .eq('id', id)
      .eq('scope', 'user')
      .eq('user_id', gate.userId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(err, { route: 'suppression:DELETE' })
  }
}
