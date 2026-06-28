import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { getManagerTenant } from '@/lib/manager'

// =============================================================================
// MANAGER DESKTOP PREFS — mirror of /api/admin/desktop-prefs (v3)
// =============================================================================
// Backed by manager_desktop_prefs (same shape as admin_desktop_prefs). This is
// the route the Desktop component already calls for role "manager"
// (prefsApiBaseFor → /api/manager/desktop-prefs). Before it existed, those
// fetches failed soft and the manager desktop persisted to localStorage only —
// so the wallpaper/background was DEVICE-LOCAL and did not follow the user
// across devices (the reported bug). With this route the full prefs blob
// persists per-user (clerk_id) and follows them everywhere, like admin's does.
//
// AUTH: signed-in AND a Manager+ tenant owner (getManagerTenant) — the same
// guard the /dashboard/manager/desktop page uses. A non-owner can't read or
// write a manager desktop.
//
// Validation mirrors the admin route exactly: typed/bounded background
// (image must be http(s), no data:/javascript:), bounded icon positions,
// sanitized id arrays, and DEFAULT_HIDDEN_APPS for brand-new rows.
//
// Row shape per clerk_id:
//   icon_positions — { "<appId>": { x, y } } grid-snapped pixel positions
//   background     — { type: 'preset'|'solid'|'image', value: string } | null
//   installed_apps — string[] of downloaded store-app ids
//   hidden_apps    — string[] of app ids removed from the desktop
// =============================================================================

export const dynamic = 'force-dynamic'

const supabase = getServiceClient('manager/desktop-prefs')

type BgSetting = { type: 'preset' | 'solid' | 'image'; value: string }

// Keep in sync with DEFAULT_HIDDEN_APP_IDS in components/admin-desktop/desktopServices.tsx
const DEFAULT_HIDDEN_APPS = ['clerk-profile']

function sanitizeIdArray(input: any): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const v of input) {
    if (typeof v === 'string' && v.length > 0 && v.length <= 64 && !out.includes(v)) {
      out.push(v)
    }
    if (out.length >= 200) break
  }
  return out
}

// Auth gate: signed-in Manager+ tenant owner. Returns the clerk userId or null.
async function requireManagerUserId(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const tenant = await getManagerTenant()
  if (!tenant) return null
  return userId
}

export async function GET() {
  const userId = await requireManagerUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('manager_desktop_prefs')
    .select('icon_positions, background, installed_apps, hidden_apps')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[manager/desktop-prefs] GET failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to load prefs' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    prefs: {
      iconPositions: data?.icon_positions ?? {},
      background: (data?.background as BgSetting | null) ?? null,
      installedApps: Array.isArray(data?.installed_apps) ? data.installed_apps : [],
      // no row yet → default-hidden apps apply
      hiddenApps: data
        ? (Array.isArray(data.hidden_apps) ? data.hidden_apps : [])
        : DEFAULT_HIDDEN_APPS,
    },
  })
}

export async function PUT(req: NextRequest) {
  const userId = await requireManagerUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Validate icon positions: only { string: { x: number, y: number } } ──
  const iconPositions: Record<string, { x: number; y: number }> = {}
  if (body.iconPositions && typeof body.iconPositions === 'object' && !Array.isArray(body.iconPositions)) {
    for (const [key, val] of Object.entries(body.iconPositions)) {
      if (key.length > 64) continue
      const v = val as any
      if (v && typeof v.x === 'number' && typeof v.y === 'number' &&
          Number.isFinite(v.x) && Number.isFinite(v.y)) {
        iconPositions[key] = {
          x: Math.max(0, Math.min(10000, Math.round(v.x))),
          y: Math.max(0, Math.min(10000, Math.round(v.y))),
        }
      }
    }
  }

  // ── Validate background: known type + bounded string value, or null ─────
  let background: BgSetting | null = null
  const b = body.background
  if (b && typeof b === 'object' &&
      (b.type === 'preset' || b.type === 'solid' || b.type === 'image') &&
      typeof b.value === 'string' && b.value.length > 0 && b.value.length <= 2000) {
    if (b.type === 'image') {
      // Image backgrounds must be plain http(s) URLs — no data: or javascript:
      const v = b.value.trim()
      if (/^https?:\/\//i.test(v)) {
        background = { type: 'image', value: v.replace(/["\\]/g, '') }
      }
    } else {
      background = { type: b.type, value: b.value }
    }
  }

  // ── App lists ────────────────────────────────────────────────────────────
  const installedApps = sanitizeIdArray(body.installedApps)
  const hiddenApps = sanitizeIdArray(body.hiddenApps)

  const { error } = await supabase
    .from('manager_desktop_prefs')
    .upsert({
      clerk_id: userId,
      icon_positions: iconPositions,
      background,
      installed_apps: installedApps,
      hidden_apps: hiddenApps,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clerk_id' })

  if (error) {
    console.error('[manager/desktop-prefs] PUT failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to save prefs' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}