import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

const CODE_PATTERN = /^[A-Z0-9_-]{4,32}$/

function generateRandomCode(length = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { codeId, newCode: rawCode } = body

    if (!codeId) {
      return NextResponse.json({ success: false, error: 'codeId required' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('team_codes')
      .select('id, team_id, code_type, campaign_id, payer, teams!inner(owner_id)')
      .eq('id', codeId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Code not found' }, { status: 404 })
    }

    const ownerCheck = (existing as any).teams?.owner_id
    if (ownerCheck !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can regenerate codes' },
        { status: 403 }
      )
    }

    let code: string
    if (rawCode && typeof rawCode === 'string' && rawCode.trim()) {
      code = rawCode.trim().toUpperCase().replace(/\s+/g, '')
      if (!CODE_PATTERN.test(code)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Code must be 4–32 chars, letters/numbers/dash/underscore only',
          },
          { status: 400 }
        )
      }
    } else {
      let attempts = 0
      do {
        code = generateRandomCode(8)
        const { data: collision } = await supabaseAdmin
          .from('team_codes')
          .select('id')
          .eq('code', code)
          .maybeSingle()
        if (!collision) break
        attempts++
      } while (attempts < 10)

      if (attempts >= 10) {
        return NextResponse.json(
          { success: false, error: 'Failed to generate unique code, try again' },
          { status: 500 }
        )
      }
    }

    const { error: delErr } = await supabaseAdmin
      .from('team_codes')
      .delete()
      .eq('id', codeId)

    if (delErr) throw delErr

    const { data: newRow, error: insErr } = await supabaseAdmin
      .from('team_codes')
      .insert({
        team_id: existing.team_id,
        code,
        code_type: existing.code_type,
        campaign_id: existing.campaign_id,
        payer: existing.payer,
        is_active: true,
      })
      .select()
      .single()

    if (insErr) {
      if (insErr.code === '23505') {
        return NextResponse.json(
          { success: false, error: `Code "${code}" is already taken — pick another` },
          { status: 409 }
        )
      }
      throw insErr
    }

    return NextResponse.json({ success: true, code: newRow })
  } catch (error: any) {
    console.error('Code regenerate error:', error)
    return apiError(error, { route: 'teams/codes/regenerate' })
  }
}