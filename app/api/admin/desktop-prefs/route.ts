import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// ADMIN DESKTOP PREFS (v3)
// =============================================================================
// v3 changes vs v2:
// - GET returns DEFAULT_HIDDEN_APPS (currently ['clerk-profile']) as the
//   hiddenApps default when the user has no prefs row yet, so the Account
//   app stays off the desktop by default for brand-new users. Existing rows
//   were backfilled by migration 014. Once a row exists, whatever the client
//   PUTs is the truth — ADD TO DESKTOP un-hides it permanently.
//
// Row shape per clerk_id:
//   icon_positions — { "<appId>": { x, y } } grid-snapped pixel positions
//   background     — { type: 'preset'|'solid'|'image', value: string } | null
//   installed_apps — string[] of downloaded store-app ids
//   hidden_apps    — string[] of app ids removed from the desktop
// =============================================================================

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

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('admin_desktop_prefs')
    .select('icon_positions, background, installed_apps, hidden_apps')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[admin/desktop-prefs] GET failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to load prefs' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    prefs: {
      iconPositions: data?.icon_positions ?? {},
      background: (data?.background as BgSetting | null) ?? null,
      installedApps: Array.isArray(data?.installed_apps) ? data.installed_apps : [],
      // v3: no row yet → default-hidden apps apply
      hiddenApps: data
        ? (Array.isArray(data.hidden_apps) ? data.hidden_apps : [])
        : DEFAULT_HIDDEN_APPS,
    },
  })
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
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
    .from('admin_desktop_prefs')
    .upsert({
      clerk_id: userId,
      icon_positions: iconPositions,
      background,
      installed_apps: installedApps,
      hidden_apps: hiddenApps,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clerk_id' })

  if (error) {
    console.error('[admin/desktop-prefs] PUT failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to save prefs' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}