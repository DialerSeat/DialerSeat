import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner creates a new code for one of their teams.
 *
 * Body:
 *   teamId: uuid (required)
 *   code: string (optional — owner-chosen vanity; if omitted, server generates random)
 *   codeType: 'seat' | 'recruit' (required)
 *
 * Code rules:
 *   - 4-32 chars, alphanumeric + dash + underscore
 *   - Stored as uppercase for display, but matched case-insensitively at redeem time
 *   - Unique platform-wide (across all teams, all owners)
 *
 * No tier gate — owner verification is implicit in team_id ownership check.
 */

const CODE_PATTERN = /^[A-Z0-9_-]{4,32}$/

function generateRandomCode(length = 8): string {
  // Excluded chars that look alike: 0/O, 1/I/L
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
    const { teamId, code: rawCode, codeType } = body

    if (!teamId) {
      return NextResponse.json({ success: false, error: 'teamId required' }, { status: 400 })
    }

    if (!codeType || !['seat', 'recruit'].includes(codeType)) {
      return NextResponse.json(
        { success: false, error: 'codeType must be "seat" or "recruit"' },
        { status: 400 }
      )
    }

    // Verify the user owns this team
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }

    if (team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can create codes' },
        { status: 403 }
      )
    }

    // Determine final code
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
      // Generate random code, retry on collision (very rare)
      let attempts = 0
      do {
        code = generateRandomCode(8)
        const { data: existing } = await supabaseAdmin
          .from('team_codes')
          .select('id')
          .eq('code', code)
          .maybeSingle()
        if (!existing) break
        attempts++
      } while (attempts < 10)

      if (attempts >= 10) {
        return NextResponse.json(
          { success: false, error: 'Failed to generate unique code, try again' },
          { status: 500 }
        )
      }
    }

    // Insert (will 23505 if vanity code already exists)
    const { data, error } = await supabaseAdmin
      .from('team_codes')
      .insert({
        team_id: teamId,
        code,
        code_type: codeType,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: `Code "${code}" is already taken — pick another` },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, code: data })
  } catch (error: any) {
    console.error('Code create error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}