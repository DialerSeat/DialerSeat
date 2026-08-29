import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/register')

// =============================================================================
// RECORDING THAT NUMBERS WERE FILED
// =============================================================================
// This used to set phone_numbers.is_registered directly -- one boolean, set by
// hand, meaning "registered" without saying with whom. Registration is three
// filings, not one: First Orion feeds T-Mobile, Hiya feeds AT&T, TNS feeds
// Verizon. It now writes number_registrations instead, and a trigger keeps
// is_registered in sync as "filed with all three", so every existing reader
// keeps working.
//
// The request shape is unchanged on purpose (numberId / registerAll /
// registered), because the admin app's toggle and its Register All button
// already speak it. Marking through this route means a Free Caller Registry
// upload, which reaches all three engines at once -- so with no explicit
// provider, all three are written.
//
// 'submitted', never 'confirmed'. FCR acknowledges nothing, so claiming a
// filing succeeded would rebuild the exact dishonesty this replaced.
// =============================================================================

const ALL_PROVIDERS = ['first_orion', 'hiya', 'tns'] as const
type Provider = typeof ALL_PROVIDERS[number]

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  let body: {
    numberId?: string
    registerAll?: boolean
    registered?: boolean
    providers?: string[]
    batchLabel?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Bad JSON' }, { status: 400 })
  }

  const registered = body.registered !== false // default true if omitted

  const providers: Provider[] = Array.isArray(body.providers) && body.providers.length > 0
    ? body.providers.filter((p): p is Provider =>
        (ALL_PROVIDERS as readonly string[]).includes(p))
    : [...ALL_PROVIDERS]

  if (providers.length === 0) {
    return NextResponse.json(
      { success: false, error: `providers must be any of: ${ALL_PROVIDERS.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    // Which numbers to touch. registerAll walks the live pool; released
    // numbers are excluded because filing a number we no longer hold is both
    // pointless and, on the LOA, untrue.
    let targetIds: string[]
    if (body.registerAll) {
      const { data, error } = await supabase
        .from('phone_numbers')
        .select('id')
        .neq('status', 'released')
      if (error) throw error
      targetIds = (data ?? []).map(n => n.id)
    } else {
      const id = body.numberId?.trim()
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'numberId or registerAll required' },
          { status: 400 }
        )
      }
      const { data, error } = await supabase
        .from('phone_numbers').select('id').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) {
        return NextResponse.json({ success: false, error: 'Number not found' }, { status: 404 })
      }
      targetIds = [data.id]
    }

    const now = new Date().toISOString()
    const rows = targetIds.flatMap(numberId =>
      providers.map(provider => ({
        number_id: numberId,
        provider,
        status: registered ? 'submitted' : 'unsubmitted',
        submitted_at: registered ? now : null,
        // Un-marking clears any confirmation too: it means "this filing did
        // not happen", and a confirmation of a filing that did not happen is
        // not a thing that can survive.
        confirmed_at: null,
        batch_label: registered ? (body.batchLabel?.trim() || 'Free Caller Registry') : null,
        updated_at: now,
      }))
    )

    if (rows.length === 0) {
      return NextResponse.json({ success: true, updated: 0, registered })
    }

    const { error: upsertError } = await supabase
      .from('number_registrations')
      .upsert(rows, { onConflict: 'number_id,provider' })
    if (upsertError) throw upsertError

    // Read back through the number, so the response says what the UI needs to
    // paint rather than what we hoped we wrote.
    if (!body.registerAll) {
      const { data: number } = await supabase
        .from('phone_numbers')
        .select('id, phone_number, is_registered')
        .eq('id', targetIds[0])
        .maybeSingle()
      return NextResponse.json({ success: true, number, providers })
    }

    return NextResponse.json({
      success: true,
      updated: targetIds.length,
      registered,
      providers,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/pool/register' })
  }
}
