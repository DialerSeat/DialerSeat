import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// WHO THE STATEMENT IS ADDRESSED TO
//
// A statement filed as a business expense has to name the entity that incurred
// it. If the seats were bought by an LLC, the deduction belongs to the LLC, and
// a document addressed to a person's first name is the wrong document.
//
// Only a name and an address. DELIBERATELY NOT AN EIN OR SSN — DialerSeat has
// no need for a government tax identifier, storing one would create an
// obligation to protect it, and a statement does not require one to be valid.
// The free-text reference field exists so somebody can put their own internal
// account code on it if their bookkeeping wants one.
// ─────────────────────────────────────────────────────────────────────────

const MAX_LEN = 200
const MAX_ADDRESS = 400

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : ''
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    const reference = typeof body.reference === 'string' ? body.reference.trim() : ''

    if (legalName.length > MAX_LEN || reference.length > MAX_LEN || address.length > MAX_ADDRESS) {
      return NextResponse.json({ success: false, error: 'Too long' }, { status: 400 })
    }

    // Refuse anything shaped like a government identifier. Somebody typing an
    // EIN here is reasonable — it is what other billing tools ask for — so the
    // right response is to decline it and say why, not to quietly store it.
    const looksLikeTaxId = /\b\d{2}-?\d{7}\b|\b\d{3}-\d{2}-\d{4}\b/.test(reference)
    if (looksLikeTaxId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Leave out EINs and SSNs: DialerSeat does not store tax identifiers, and your statement does not need one to be valid.',
        },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        report_legal_name: legalName || null,
        report_address: address || null,
        report_tax_id_note: reference || null,
      })
      .eq('clerk_id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Report identity error:', error)
    return apiError(error, { route: 'reports/identity' })
  }
}
