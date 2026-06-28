import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/tenants')

// =============================================================================
// ADMIN TENANTS — collection route (v1, NEW)
// =============================================================================
// Backend for the WhiteLabel desktop app's Tenants + Branding sub-tabs.
//
//   GET  /api/admin/tenants   → { success, tenants: [...] } all tenants,
//                               newest first, full real-schema rows
//   POST /api/admin/tenants   → { success, tenant } creates a tenant
//
// Schema notes (the columns that actually exist on white_label_tenants):
//   Real theme tokens: primary_color, sidebar_color, header_bg_color,
//   page_bg_color. accent_color is the LEGACY alias for sidebar_color and is
//   MIRRORED on every write (pre-migration-002 code reads accent_color).
//   secondary_color / background_color / text_color are dead legacy columns —
//   never written here, never edited in the app.
//
// status text column + is_active boolean are kept in sync:
//   status 'active' ⇄ is_active true; 'suspended'/'cancelled' ⇄ false.
// =============================================================================

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/
const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'mail', 'smtp', 'ftp', 'blog',
  'docs', 'help', 'support', 'status', 'dev', 'staging', 'test', 'demo-internal',
  'clerk', 'stripe', 'assets', 'cdn', 'static',
])

const HEX_RE = /^#[0-9a-fA-F]{6}$/

const COLOR_DEFAULTS = {
  primary_color: '#4a9eff',
  sidebar_color: '#1a1a2e',
  header_bg_color: '#1a1a2e',
  page_bg_color: '#0a0a14',
}

export async function GET() {
  try {
    await requireAdmin()

    const { data, error } = await supabase
      .from('white_label_tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, tenants: data ?? [] })
  } catch (err: any) {
    console.error('[admin/tenants] GET failed:', err)
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load tenants' },
      { status }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json().catch(() => ({}))
    const slug = String(body.slug ?? '').trim().toLowerCase()
    const brandName = String(body.brand_name ?? '').trim()
    const ownerClerkId = String(body.owner_clerk_id ?? '').trim()
    const supportEmail = String(body.support_email ?? '').trim() || null
    const primaryColor = typeof body.primary_color === 'string' && HEX_RE.test(body.primary_color)
      ? body.primary_color
      : COLOR_DEFAULTS.primary_color

    // ── validation ───────────────────────────────────────────────────────
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        { success: false, error: 'Slug must be 1-40 chars, lowercase letters/numbers/hyphens, no leading or trailing hyphen' },
        { status: 400 }
      )
    }
    if (RESERVED_SLUGS.has(slug)) {
      return NextResponse.json(
        { success: false, error: `"${slug}" is a reserved slug` },
        { status: 400 }
      )
    }
    if (!brandName) {
      return NextResponse.json({ success: false, error: 'Brand name is required' }, { status: 400 })
    }
    if (!ownerClerkId.startsWith('user_')) {
      return NextResponse.json({ success: false, error: 'Owner must be a Clerk user id (user_...)' }, { status: 400 })
    }

    // Owner must exist in users table
    const { data: owner } = await supabase
      .from('users')
      .select('clerk_id')
      .eq('clerk_id', ownerClerkId)
      .maybeSingle()
    if (!owner) {
      return NextResponse.json(
        { success: false, error: `No user found with clerk_id ${ownerClerkId}` },
        { status: 400 }
      )
    }

    // Slug uniqueness
    const { data: existing } = await supabase
      .from('white_label_tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: false, error: `Slug "${slug}" is already taken` }, { status: 409 })
    }

    // ── insert (accent_color MIRRORS sidebar_color) ──────────────────────
    const { data: tenant, error } = await supabase
      .from('white_label_tenants')
      .insert({
        slug,
        brand_name: brandName,
        owner_clerk_id: ownerClerkId,
        support_email: supportEmail,
        status: 'active',
        is_active: true,
        primary_color: primaryColor,
        sidebar_color: COLOR_DEFAULTS.sidebar_color,
        accent_color: COLOR_DEFAULTS.sidebar_color, // legacy mirror
        header_bg_color: COLOR_DEFAULTS.header_bg_color,
        page_bg_color: COLOR_DEFAULTS.page_bg_color,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, tenant })
  } catch (err: any) {
    console.error('[admin/tenants] POST failed:', err)
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create tenant' },
      { status }
    )
  }
}