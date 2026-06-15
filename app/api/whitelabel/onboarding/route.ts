// app/api/whitelabel/onboarding/route.ts
// =============================================================================
// WHITE-LABEL ONBOARDING / EDIT — header/sidebar split (migration 004)
// + VERCEL SUBDOMAIN PROVISIONING (v6)
// =============================================================================
// v6: programmatic Vercel domain lifecycle. Because we DON'T use a wildcard
// domain on Vercel (it won't verify on external Cloudflare DNS without moving
// nameservers), each tenant's <slug>.dialerseat.com is added to the Vercel
// project via the API at creation, swapped on slug change, and removed on
// deactivate. Cloudflare's wildcard CNAME (* -> cname.vercel-dns.com, grey
// cloud) makes each added subdomain verify + get SSL instantly.
//   - CREATE branch  → addProjectDomain(slug) after the row is inserted
//   - UPDATE + slug change → changeProjectDomain(oldSlug, newSlug)
//   - DELETE (new)   → deactivate tenant + removeProjectDomain(slug)
// All Vercel calls are non-fatal: the tenant row is the source of truth; a
// failed domain op is logged and can be reconciled, never blocks onboarding.
//
// v5 (migration 004): 3 colors → 4 colors (primary, sidebar, header_bg, page_bg)
// v4 (migration 003): added page_bg_color.
// v3 (Phase B3): trimmed body + pre-002 safety mirroring.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import {
  addProjectDomain,
  removeProjectDomain,
  changeProjectDomain,
} from '@/lib/vercelDomains'

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
        primary_color: primaryColor,
        sidebar_color: sidebarColor,
        header_bg_color: headerBgColor,
        page_bg_color: pageBgColor,
        accent_color: sidebarColor,
        secondary_color: LEGACY_SECONDARY_DEFAULT,
        background_color: LEGACY_BACKGROUND_DEFAULT,
        text_color: LEGACY_TEXT_DEFAULT,
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

    // ── VERCEL: provision <slug>.dialerseat.com ──────────────────────
    // Non-fatal: the tenant exists and is the source of truth. If Vercel is
    // briefly unreachable the subdomain can be reconciled later; we surface a
    // hint in the response so the UI can show "provisioning" if it wants.
    const domain = await addProjectDomain(tenant.slug)
    if (!domain.ok && !domain.skipped) {
      console.error(`[onboarding] domain provision failed for ${tenant.slug}:`, domain.error)
    }

    return NextResponse.json({
      success: true,
      subdomain: tenant.slug,
      created: true,
      domainProvisioned: domain.ok,
    })
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

  // ── VERCEL: swap subdomain on slug change ────────────────────────────
  // Adds the new subdomain BEFORE removing the old so there's never a gap;
  // the 30-day subdomain_history redirect covers the transition either way.
  // Non-fatal — the DB row already reflects the new slug.
  let domainSwapped: boolean | undefined
  if (slugChanged) {
    const swap = await changeProjectDomain(existing.slug, subdomain)
    domainSwapped = swap.added.ok
    if (!swap.added.ok && !swap.added.skipped) {
      console.error(`[onboarding] domain swap add failed ${existing.slug}→${subdomain}:`, swap.added.error)
    }
  }

  return NextResponse.json({
    success: true,
    subdomain,
    updated: true,
    ...(slugChanged ? { domainSwapped } : {}),
  })
}

// =============================================================================
// DELETE — deactivate tenant + remove its Vercel subdomain
// =============================================================================
// Soft-deactivates the caller's tenant (is_active=false, status='inactive')
// and removes <slug>.dialerseat.com from the Vercel project. The middleware
// already treats an inactive tenant as 'missing' and 307s to the apex, so the
// subdomain stops working immediately at the app layer even before Vercel
// finishes removing the domain. Vercel removal is non-fatal.
//
// Body: { confirm: 'deactivate' }  (guards against accidental calls)
// =============================================================================

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine; confirm check below will catch it
  }

  if (body?.confirm !== 'deactivate') {
    return NextResponse.json(
      { error: 'confirm_required', detail: 'Pass { confirm: "deactivate" } to deactivate.' },
      { status: 400 }
    )
  }

  const { data: tenant } = await supabase
    .from('white_label_tenants')
    .select('id, slug, is_active')
    .eq('owner_clerk_id', userId)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ error: 'tenant_missing' }, { status: 404 })
  }

  const { error: deErr } = await supabase
    .from('white_label_tenants')
    .update({ is_active: false, status: 'inactive' })
    .eq('id', tenant.id)

  if (deErr) {
    console.error('tenant deactivate failed:', deErr)
    return NextResponse.json({ error: 'db_error', detail: deErr.message }, { status: 500 })
  }

  // ── VERCEL: remove the subdomain (non-fatal) ─────────────────────────
  const removed = await removeProjectDomain(tenant.slug)
  if (!removed.ok && !removed.skipped) {
    console.error(`[onboarding] domain removal failed for ${tenant.slug}:`, removed.error)
  }

  return NextResponse.json({
    success: true,
    deactivated: true,
    slug: tenant.slug,
    domainRemoved: removed.ok,
  })
}