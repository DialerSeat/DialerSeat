// app/api/whitelabel/onboarding/route.ts
// =============================================================================
// WHITE-LABEL ONBOARDING / EDIT — header/sidebar split (migration 004)
// =============================================================================
// v5 (migration 004): 3 colors → 4 colors
//   - Body now carries 4 colors: primary, sidebar, header_bg, page_bg
//   - All four validated as #RRGGBB hex
//   - INSERT/UPDATE write all 4 active columns
//   - GET selects and returns all 4
//
// v4 (migration 003): added page_bg_color (2 → 3 colors).
//
// v3 (Phase B3): trimmed body to active set + pre-002 safety mirroring.
//
// Pre-002 safety (preserved): INSERT still writes accent_color (mirrored
// from sidebar) and sensible defaults for secondary_color, background_color,
// text_color so NOT NULL constraints don't fire. These four lines become
// no-ops after Phase D migration 002 drops those columns; at that point
// we delete them. background_color (vestigial dark body bg) is NOT
// mirrored from page_bg_color — they're different concepts.
//
// Unchanged: slug regex, RESERVED set, 24h cooldown, 30-day redirect
// grace, subscription gate, support_email default, active_tenant_id
// auto-set on tenant creation, slug collision handling.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'support',
  'dashboard', 'billing', 'auth', 'docs', 'help', 'status',
  'staging', 'dev', 'test', 'preview', 'sandbox',
  'cdn', 'assets', 'static', 'media', 'images', 'files',
  'sip', 'voice', 'webhook', 'webhooks', 'signalwire',
  'stripe', 'clerk', 'supabase', 'vercel', 'sentry',
  'dialerseat', 'whitelabel', 'wl', 'onboarding',
  'manager', 'managers', 'pro', 'team', 'teams',
  'signin', 'signup', 'login', 'logout', 'account', 'settings',
  'terms', 'privacy', 'about', 'contact', 'pricing', 'faq',
  'home', 'blog', 'callback', 'oauth', 'saml',
  'referral', 'promo', 'public', 'upload',
])

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/

const SLUG_COOLDOWN_HOURS = 24
const SLUG_REDIRECT_DAYS = 30

// Sensible defaults for the vestigial Pass 1 columns we no longer expose.
// Used on INSERT to satisfy any NOT NULL constraints until migration 002
// drops these columns entirely.
const LEGACY_SECONDARY_DEFAULT = '#2a6eff'
const LEGACY_BACKGROUND_DEFAULT = '#0a0a0f'
const LEGACY_TEXT_DEFAULT = '#f0f0f5'

// =============================================================================
// GET — fetch current tenant for the edit form
// =============================================================================

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('email, wl_onboarding_status, wl_subscription_id, stripe_customer_id')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (!user) {
    return NextResponse.json({ status: 'not_started' })
  }

  const status = (user.wl_onboarding_status as 'not_started' | 'pending' | 'complete' | null) || 'not_started'

  if ((status === 'pending' || status === 'complete') && !user.wl_subscription_id) {
    return NextResponse.json({ status: 'not_started' })
  }

  if (status === 'complete') {
    // 4-color SELECT (migration 004).
    const { data: tenant } = await supabase
      .from('white_label_tenants')
      .select(`
        id, brand_name, slug, logo_url, slug_changed_at, is_active,
        primary_color, sidebar_color, header_bg_color, page_bg_color
      `)
      .eq('owner_clerk_id', userId)
      .maybeSingle()

    if (!tenant) {
      return NextResponse.json({ status: 'pending' })
    }

    let canChangeSlugAt: string | null = null
    if (tenant.slug_changed_at) {
      const lastChange = new Date(tenant.slug_changed_at).getTime()
      const cooldownEnd = lastChange + SLUG_COOLDOWN_HOURS * 60 * 60 * 1000
      if (cooldownEnd > Date.now()) {
        canChangeSlugAt = new Date(cooldownEnd).toISOString()
      }
    }

    return NextResponse.json({
      status: 'complete',
      existingSubdomain: tenant.slug,
      tenant: {
        brand_name: tenant.brand_name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        sidebar_color: tenant.sidebar_color,
        header_bg_color: tenant.header_bg_color,
        page_bg_color: tenant.page_bg_color,
      },
      canChangeSlugAt,
      isActive: tenant.is_active,
    })
  }

  return NextResponse.json({ status })
}

// =============================================================================
// POST — create or update tenant
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

  // ── Field extraction ──────────────────────────────────────────────
  const brandName = String(body.brand_name || '').trim()
  const subdomain = String(body.subdomain || '').toLowerCase().trim()
  const logoUrl = String(body.logo_url || '').trim()
  const primaryColor = String(body.primary_color || '').trim()
  const sidebarColor = String(body.sidebar_color || '').trim()
  const headerBgColor = String(body.header_bg_color || '').trim()
  const pageBgColor = String(body.page_bg_color || '').trim()

  // ── Validation ────────────────────────────────────────────────────
  if (!brandName || brandName.length < 2 || brandName.length > 60) {
    return NextResponse.json(
      { error: 'invalid_brand_name', detail: 'Brand name must be 2–60 characters.' },
      { status: 400 }
    )
  }
  if (!subdomain || !SLUG_RE.test(subdomain)) {
    return NextResponse.json(
      { error: 'invalid_subdomain', detail: 'Subdomain must be 3–30 chars, lowercase letters/digits/hyphens.' },
      { status: 400 }
    )
  }
  if (RESERVED.has(subdomain)) {
    return NextResponse.json({ error: 'reserved_subdomain' }, { status: 400 })
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
      { error: 'invalid_header_bg_color', detail: 'Header background color must be #RRGGBB.' },
      { status: 400 }
    )
  }
  if (!HEX_RE.test(pageBgColor)) {
    return NextResponse.json(
      { error: 'invalid_page_bg_color', detail: 'Page background color must be #RRGGBB.' },
      { status: 400 }
    )
  }
  if (!logoUrl) {
    return NextResponse.json(
      { error: 'missing_logo', detail: 'Upload your logo first.' },
      { status: 400 }
    )
  }

  // ── WL subscription gate ──────────────────────────────────────────
  const { data: user } = await supabase
    .from('users')
    .select('email, wl_onboarding_status, wl_subscription_id, stripe_customer_id')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (!user || !user.wl_subscription_id) {
    return NextResponse.json(
      { error: 'no_subscription', detail: 'Active white-label subscription required.', redirectTo: '/billing?plan=wl' },
      { status: 403 }
    )
  }

  const status = user.wl_onboarding_status || 'not_started'
  if (status !== 'pending' && status !== 'complete') {
    return NextResponse.json(
      { error: 'no_subscription', detail: 'Active white-label subscription required.', redirectTo: '/billing?plan=wl' },
      { status: 403 }
    )
  }

  // ── Subdomain uniqueness (excluding own) ──────────────────────────
  const { data: collision } = await supabase
    .from('white_label_tenants')
    .select('id, owner_clerk_id')
    .eq('slug', subdomain)
    .eq('is_active', true)
    .maybeSingle()

  if (collision && collision.owner_clerk_id !== userId) {
    return NextResponse.json({ error: 'taken' }, { status: 409 })
  }

  const { data: redirecting } = await supabase
    .from('subdomain_history')
    .select('id, tenant_id')
    .eq('old_slug', subdomain)
    .gt('redirects_until', new Date().toISOString())
    .maybeSingle()

  if (redirecting) {
    const { data: t } = await supabase
      .from('white_label_tenants')
      .select('owner_clerk_id')
      .eq('id', redirecting.tenant_id)
      .maybeSingle()
    if (!t || t.owner_clerk_id !== userId) {
      return NextResponse.json(
        { error: 'redirecting', detail: 'This subdomain is being redirected from a recent change.' },
        { status: 409 }
      )
    }
  }

  const now = new Date()

  // ── BRANCH: CREATE vs UPDATE ──────────────────────────────────────
  if (status === 'pending') {
    const { data: tenant, error: insErr } = await supabase
      .from('white_label_tenants')
      .insert({
        owner_clerk_id: userId,
        slug: subdomain,
        brand_name: brandName,
        logo_url: logoUrl,
        // Active columns (4-color, migration 004)
        primary_color: primaryColor,
        sidebar_color: sidebarColor,
        header_bg_color: headerBgColor,
        page_bg_color: pageBgColor,
        // Pre-002 safety: vestigial Pass 1 columns still exist on the
        // table. Mirror sidebar into accent_color to keep them in sync;
        // default the other three so any NOT NULL constraints don't
        // fire. background_color is NOT mirrored from page_bg_color —
        // they are different concepts (dark Pass 1 body vs Pass 2
        // themed page). These four lines all become no-ops after
        // migration 002 drops these columns from the table.
        accent_color: sidebarColor,
        secondary_color: LEGACY_SECONDARY_DEFAULT,
        background_color: LEGACY_BACKGROUND_DEFAULT,
        text_color: LEGACY_TEXT_DEFAULT,
        // Identity / billing
        support_email: user.email || 'support@dialerseat.com',
        stripe_customer_id: user.stripe_customer_id,
        stripe_subscription_id: user.wl_subscription_id,
        status: 'active',
        is_active: true,
        slug_changed_at: now.toISOString(),
      })
      .select('id, slug')
      .single()

    if (insErr || !tenant) {
      console.error('tenant insert failed:', insErr)
      if (insErr?.code === '23505') {
        return NextResponse.json({ error: 'taken' }, { status: 409 })
      }
      return NextResponse.json(
        { error: 'db_error', detail: insErr?.message },
        { status: 500 }
      )
    }

    // Mark onboarding complete AND auto-select this tenant.
    await supabase
      .from('users')
      .update({
        wl_onboarding_status: 'complete',
        active_tenant_id: tenant.id,
      })
      .eq('clerk_id', userId)

    return NextResponse.json({ success: true, subdomain: tenant.slug, created: true })
  }

  // ─── UPDATE existing tenant ────────────────────────────────────────
  const { data: existing } = await supabase
    .from('white_label_tenants')
    .select('id, slug, slug_changed_at')
    .eq('owner_clerk_id', userId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'tenant_missing' }, { status: 500 })
  }

  const slugChanged = existing.slug !== subdomain
  const updates: Record<string, any> = {
    brand_name: brandName,
    logo_url: logoUrl,
    primary_color: primaryColor,
    sidebar_color: sidebarColor,
    header_bg_color: headerBgColor,
    page_bg_color: pageBgColor,
    // Pre-002 safety: keep accent_color mirrored to sidebar_color.
    // Becomes a no-op after migration 002.
    accent_color: sidebarColor,
  }

  if (slugChanged) {
    if (existing.slug_changed_at) {
      const lastChange = new Date(existing.slug_changed_at).getTime()
      const cooldownEnd = lastChange + SLUG_COOLDOWN_HOURS * 60 * 60 * 1000
      if (cooldownEnd > Date.now()) {
        return NextResponse.json(
          {
            error: 'slug_cooldown',
            detail: `You can change your subdomain again on ${new Date(cooldownEnd).toLocaleString()}.`,
            availableAt: new Date(cooldownEnd).toISOString(),
          },
          { status: 429 }
        )
      }
    }

    const redirectsUntil = new Date(now.getTime() + SLUG_REDIRECT_DAYS * 24 * 60 * 60 * 1000)
    await supabase
      .from('subdomain_history')
      .insert({
        tenant_id: existing.id,
        old_slug: existing.slug,
        new_slug: subdomain,
        redirects_until: redirectsUntil.toISOString(),
      })

    updates.slug = subdomain
    updates.slug_changed_at = now.toISOString()
  }

  const { error: updErr } = await supabase
    .from('white_label_tenants')
    .update(updates)
    .eq('id', existing.id)

  if (updErr) {
    console.error('tenant update failed:', updErr)
    if (updErr.code === '23505') {
      return NextResponse.json({ error: 'taken' }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'db_error', detail: updErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, subdomain, updated: true })
}