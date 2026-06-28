// app/api/whitelabel/custom-themes/route.ts
// =============================================================================
// CUSTOM THEMES — saved per-user color/logo presets for the WL onboarding page
// =============================================================================
// REWRITTEN. The previous file in this folder was an accidental copy of
// /api/whitelabel/onboarding/route.ts. The save-as-new button was POSTing
// here with { name, colors, logo_url } but the onboarding code validated
// `brand_name`, which doesn't exist on theme requests — hence the
// permanent "Brand name must be 2–60 characters" error.
//
// Endpoints:
//   GET    /api/whitelabel/custom-themes
//     → { themes: SavedTheme[] }
//
//   POST   /api/whitelabel/custom-themes
//     Body: { name, sidebar_color, header_bg_color, primary_color,
//             page_bg_color, logo_url? }
//     → { theme: SavedTheme }
//     Enforces 15-theme/user limit.
//
//   PUT    /api/whitelabel/custom-themes?id=xxx
//     Body: any subset of { name, sidebar_color, header_bg_color,
//             primary_color, page_bg_color, logo_url }
//     → { theme: SavedTheme }
//     Used by the "Overwrite this theme" flow when the user has a saved
//     theme loaded and modifies it.
//
//   DELETE /api/whitelabel/custom-themes?id=xxx
//     → { success: true }
//
// All write paths verify the theme's user_id matches the caller's clerk_id.
// The user_id column on custom_themes is the Clerk ID, matching how
// other tables (users.clerk_id, white_label_tenants.owner_clerk_id) key off it.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('whitelabel/custom-themes')

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const MAX_THEMES_PER_USER = 15
const NAME_MIN = 1
const NAME_MAX = 40

const SELECT_COLS =
  'id, name, primary_color, sidebar_color, header_bg_color, page_bg_color, logo_url, created_at'

// =============================================================================
// GET — list saved themes for the current user
// =============================================================================

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('custom_themes')
    .select(SELECT_COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('custom_themes list error:', error)
    return NextResponse.json(
      { error: 'db_error', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ themes: data || [] })
}

// =============================================================================
// POST — create a new saved theme
// =============================================================================

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 })
  }

  // ── Field extraction (theme schema — name NOT brand_name) ─────────
  const name = String(body.name || '').trim()
  const primaryColor = String(body.primary_color || '').trim()
  const sidebarColor = String(body.sidebar_color || '').trim()
  const headerBgColor = String(body.header_bg_color || '').trim()
  const pageBgColor = String(body.page_bg_color || '').trim()
  const rawLogoUrl = body.logo_url
  const logoUrl =
    typeof rawLogoUrl === 'string' && rawLogoUrl.trim() ? rawLogoUrl.trim() : null

  // ── Validation ────────────────────────────────────────────────────
  if (!name || name.length < NAME_MIN || name.length > NAME_MAX) {
    return NextResponse.json(
      { error: 'invalid_name', detail: `Theme name must be ${NAME_MIN}–${NAME_MAX} characters.` },
      { status: 400 }
    )
  }
  if (!HEX_RE.test(primaryColor)) {
    return NextResponse.json(
      { error: 'invalid_primary_color', detail: 'Primary color must be #RRGGBB.' },
      { status: 400 }
    )
  }
  if (!HEX_RE.test(sidebarColor)) {
    return NextResponse.json(
      { error: 'invalid_sidebar_color', detail: 'Sidebar color must be #RRGGBB.' },
      { status: 400 }
    )
  }
  if (!HEX_RE.test(headerBgColor)) {
    return NextResponse.json(
      { error: 'invalid_header_bg_color', detail: 'Header color must be #RRGGBB.' },
      { status: 400 }
    )
  }
  if (!HEX_RE.test(pageBgColor)) {
    return NextResponse.json(
      { error: 'invalid_page_bg_color', detail: 'Page background color must be #RRGGBB.' },
      { status: 400 }
    )
  }

  // ── 15-theme per-user limit ───────────────────────────────────────
  const { count: existingCount, error: countErr } = await supabase
    .from('custom_themes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countErr) {
    console.error('count error:', countErr)
    return NextResponse.json(
      { error: 'db_error', detail: countErr.message },
      { status: 500 }
    )
  }
  if ((existingCount || 0) >= MAX_THEMES_PER_USER) {
    return NextResponse.json(
      {
        error: 'limit_reached',
        detail: `You've hit the ${MAX_THEMES_PER_USER}-theme limit. Delete one to save another.`,
      },
      { status: 400 }
    )
  }

  // ── Insert ─────────────────────────────────────────────────────────
  const { data, error: insErr } = await supabase
    .from('custom_themes')
    .insert({
      user_id: userId,
      name,
      primary_color: primaryColor,
      sidebar_color: sidebarColor,
      header_bg_color: headerBgColor,
      page_bg_color: pageBgColor,
      logo_url: logoUrl,
    })
    .select(SELECT_COLS)
    .single()

  if (insErr || !data) {
    console.error('custom_themes insert error:', insErr)
    return NextResponse.json(
      { error: 'db_error', detail: insErr?.message || 'insert failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ theme: data })
}

// =============================================================================
// PUT — overwrite an existing saved theme
// =============================================================================

export async function PUT(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 })
  }

  // Verify ownership
  const { data: existing, error: fetchErr } = await supabase
    .from('custom_themes')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) {
    return NextResponse.json(
      { error: 'db_error', detail: fetchErr.message },
      { status: 500 }
    )
  }
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (existing.user_id !== userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Build updates from whitelisted fields only
  const updates: Record<string, any> = {}

  if ('name' in body) {
    const v = String(body.name || '').trim()
    if (!v || v.length < NAME_MIN || v.length > NAME_MAX) {
      return NextResponse.json(
        { error: 'invalid_name', detail: `Theme name must be ${NAME_MIN}–${NAME_MAX} characters.` },
        { status: 400 }
      )
    }
    updates.name = v
  }
  if ('primary_color' in body) {
    const v = String(body.primary_color || '').trim()
    if (!HEX_RE.test(v)) {
      return NextResponse.json(
        { error: 'invalid_primary_color', detail: 'Primary color must be #RRGGBB.' },
        { status: 400 }
      )
    }
    updates.primary_color = v
  }
  if ('sidebar_color' in body) {
    const v = String(body.sidebar_color || '').trim()
    if (!HEX_RE.test(v)) {
      return NextResponse.json(
        { error: 'invalid_sidebar_color', detail: 'Sidebar color must be #RRGGBB.' },
        { status: 400 }
      )
    }
    updates.sidebar_color = v
  }
  if ('header_bg_color' in body) {
    const v = String(body.header_bg_color || '').trim()
    if (!HEX_RE.test(v)) {
      return NextResponse.json(
        { error: 'invalid_header_bg_color', detail: 'Header color must be #RRGGBB.' },
        { status: 400 }
      )
    }
    updates.header_bg_color = v
  }
  if ('page_bg_color' in body) {
    const v = String(body.page_bg_color || '').trim()
    if (!HEX_RE.test(v)) {
      return NextResponse.json(
        { error: 'invalid_page_bg_color', detail: 'Page background color must be #RRGGBB.' },
        { status: 400 }
      )
    }
    updates.page_bg_color = v
  }
  if ('logo_url' in body) {
    const v = body.logo_url
    if (v === null || v === '') {
      updates.logo_url = null
    } else if (typeof v === 'string') {
      updates.logo_url = v.trim()
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error: updErr } = await supabase
    .from('custom_themes')
    .update(updates)
    .eq('id', id)
    .select(SELECT_COLS)
    .single()

  if (updErr || !data) {
    console.error('custom_themes update error:', updErr)
    return NextResponse.json(
      { error: 'db_error', detail: updErr?.message || 'update failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ theme: data })
}

// =============================================================================
// DELETE — remove a saved theme
// =============================================================================

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 })
  }

  // Verify ownership before delete
  const { data: existing, error: fetchErr } = await supabase
    .from('custom_themes')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) {
    return NextResponse.json(
      { error: 'db_error', detail: fetchErr.message },
      { status: 500 }
    )
  }
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (existing.user_id !== userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error: delErr } = await supabase
    .from('custom_themes')
    .delete()
    .eq('id', id)

  if (delErr) {
    console.error('custom_themes delete error:', delErr)
    return NextResponse.json(
      { error: 'db_error', detail: delErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}