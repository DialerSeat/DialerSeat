import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// Admin control surface for the promo/announcement banner.
//
// Same shape as /api/admin/dialer-down, but simpler: no password gate.
// This banner is for non-emergency announcements (promos, holiday codes,
// etc.), so admins can publish and edit it freely — only requireAdmin()
// stands between a signed-in admin and changing it.
//
// GET  — current status for the Settings app.
// POST — action: 'publish' { message, textColor, bgColor }
//        action: 'update'  { message?, textColor?, bgColor? }  (banner stays live)
//        action: 'remove'  {}
// ─────────────────────────────────────────────────────────────────────────

const supabase = getServiceClient('admin/promo-banner')

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

interface StatusRow {
  enabled: boolean
  message: string
  text_color: string
  bg_color: string
  updated_at: string
  updated_by: string | null
}

async function loadRow(): Promise<StatusRow | null> {
  const { data, error } = await supabase
    .from('promo_banner_status')
    .select('enabled, message, text_color, bg_color, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data as StatusRow | null
}

function toResponseShape(row: StatusRow | null) {
  return {
    enabled: row?.enabled ?? false,
    message: row?.message ?? '',
    textColor: row?.text_color ?? '#FFFFFF',
    bgColor: row?.bg_color ?? '#0A84FF',
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  }
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const row = await loadRow()
    return NextResponse.json({ success: true, status: toResponseShape(row) })
  } catch (err) {
    return apiError(err, { route: 'admin/promo-banner GET' })
  }
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    const gate = await requireAdmin()
    userId = gate.userId
  } catch (res) {
    return res as Response
  }

  let body: { action?: string; message?: string; textColor?: string; bgColor?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body

  try {
    if (action === 'remove') {
      const { error } = await supabase
        .from('promo_banner_status')
        .upsert({ id: 1, enabled: false, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: 'id' })
      if (error) throw error
      return NextResponse.json({ success: true, status: { enabled: false } })
    }

    if (action === 'publish' || action === 'update') {
      const row = await loadRow()

      const message = body.message !== undefined ? body.message.trim() : row?.message ?? ''
      const textColor = body.textColor !== undefined ? body.textColor : row?.text_color ?? '#FFFFFF'
      const bgColor = body.bgColor !== undefined ? body.bgColor : row?.bg_color ?? '#0A84FF'

      if (action === 'publish' && !message) {
        return NextResponse.json({ success: false, error: 'Add a message before publishing.' }, { status: 400 })
      }
      if (!HEX_RE.test(textColor) || !HEX_RE.test(bgColor)) {
        return NextResponse.json({ success: false, error: 'Colors must be valid hex codes, e.g. #FFAA00.' }, { status: 400 })
      }

      const enabled = action === 'publish' ? true : (row?.enabled ?? false)

      const { error } = await supabase
        .from('promo_banner_status')
        .upsert(
          { id: 1, enabled, message, text_color: textColor, bg_color: bgColor, updated_at: new Date().toISOString(), updated_by: userId },
          { onConflict: 'id' }
        )
      if (error) throw error
      return NextResponse.json({ success: true, status: { enabled, message, textColor, bgColor } })
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return apiError(err, { route: 'admin/promo-banner POST', context: { action } })
  }
}
