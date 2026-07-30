import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { hashDialerDownPassword, verifyDialerDownPassword } from '@/lib/dialerDown'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// Admin control surface for the Dialer Down emergency banner.
//
// GET  — current status for the Settings app (enabled, message, whether a
//        password has ever been set). Never returns the hash/salt.
// POST — three actions, each requiring the current publish/remove
//        password (except set-password, which requires it only when a
//        password already exists — first-time setup has none to check):
//          action: 'publish'      { message, password }
//          action: 'remove'       { password }
//          action: 'set-password' { password, newPassword }
//
// This route is for the admin desktop Settings app only. The
// customer-facing dashboard reads a completely separate, narrower
// endpoint — /api/dashboard/dialer-down — which never exposes the
// password fields and only responds to signed-in Pro/Manager+ users.
// ─────────────────────────────────────────────────────────────────────────

const supabase = getServiceClient('admin/dialer-down')

interface StatusRow {
  enabled: boolean
  message: string
  password_hash: string | null
  password_salt: string | null
  updated_at: string
  updated_by: string | null
}

async function loadRow(): Promise<StatusRow | null> {
  const { data, error } = await supabase
    .from('dialer_down_status')
    .select('enabled, message, password_hash, password_salt, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data as StatusRow | null
}

export async function GET() {
  let userId: string
  try {
    const gate = await requireAdmin()
    userId = gate.userId
  } catch (res) {
    return res as Response
  }
  void userId

  try {
    const row = await loadRow()
    return NextResponse.json({
      success: true,
      status: {
        enabled: row?.enabled ?? false,
        message: row?.message ?? '',
        hasPassword: !!row?.password_hash,
        updatedAt: row?.updated_at ?? null,
        updatedBy: row?.updated_by ?? null,
      },
    })
  } catch (err) {
    return apiError(err, { route: 'admin/dialer-down GET' })
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

  let body: { action?: string; message?: string; password?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body

  try {
    const row = await loadRow()

    // ── First-time password setup / change ────────────────────────────
    if (action === 'set-password') {
      const newPassword = (body.newPassword || '').trim()
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 })
      }
      // If a password already exists, changing it requires the current one.
      if (row?.password_hash) {
        const ok = await verifyDialerDownPassword(body.password || '', row.password_hash, row.password_salt)
        if (!ok) {
          return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 403 })
        }
      }
      const { hash, salt } = await hashDialerDownPassword(newPassword)
      const { error } = await supabase
        .from('dialer_down_status')
        .upsert({ id: 1, password_hash: hash, password_salt: salt, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: 'id' })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Publish and remove both require a password to already be set — the
    // banner can't be turned on/off by anyone until an admin has
    // deliberately configured a password for it first.
    if (!row?.password_hash) {
      return NextResponse.json(
        { success: false, error: 'Set a publish/remove password first, before publishing or removing the banner.' },
        { status: 400 }
      )
    }

    const passwordOk = await verifyDialerDownPassword(body.password || '', row.password_hash, row.password_salt)
    if (!passwordOk) {
      return NextResponse.json({ success: false, error: 'Incorrect password.' }, { status: 403 })
    }

    if (action === 'publish') {
      const message = (body.message || '').trim()
      if (!message) {
        return NextResponse.json({ success: false, error: 'Add a message before publishing.' }, { status: 400 })
      }
      const { error } = await supabase
        .from('dialer_down_status')
        .upsert({ id: 1, enabled: true, message, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: 'id' })
      if (error) throw error
      return NextResponse.json({ success: true, status: { enabled: true, message } })
    }

    if (action === 'remove') {
      const { error } = await supabase
        .from('dialer_down_status')
        .upsert({ id: 1, enabled: false, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: 'id' })
      if (error) throw error
      return NextResponse.json({ success: true, status: { enabled: false } })
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return apiError(err, { route: 'admin/dialer-down POST', context: { action } })
  }
}
