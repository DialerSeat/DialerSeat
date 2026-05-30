// app/api/whitelabel/onboarding/route.ts
// =============================================================================
// WHITE-LABEL ONBOARDING / EDIT
// =============================================================================
// GET  /api/whitelabel/onboarding
//   Returns the user's current onboarding state. Used by the page to
//   decide: (a) redirect to /billing if not paid, (b) show empty form
//   for first-time setup, (c) show populated form for editing.
//
//   Response:
//     {
//       status: 'not_started' | 'pending' | 'complete',
//       existingSubdomain?: string,
//       tenant?: {
//         brand_name, slug, primary_color, accent_color, logo_url
//       },
//       canChangeSlugAt?: ISO date     // null if can change now
//     }
//
// POST /api/whitelabel/onboarding
//   Body (JSON):
//     {
//       brand_name: string,
//       subdomain: string,
//       primary_color: '#RRGGBB',
//       accent_color: '#RRGGBB',
//       logo_url: string       // from /api/whitelabel/upload-logo
//     }
//
//   First call (status === 'pending'): creates tenant row, sets onboarding
//   status to 'complete'.
//
//   Subsequent calls (status === 'complete'): updates the tenant row.
//   If subdomain changed, writes a subdomain_history entry for 30-day
//   grace period and updates slug_changed_at (enforces 24h cooldown).
//
//   Returns: { success: true, subdomain }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Same list as check-subdomain — keep in sync
const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'support',
  'dashboard', 'billing', 'auth', 'docs', 'help', 'status',
  'staging', 'dev', 'test', 'demo', 'preview', 'sandbox',
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

// =============================================================================
// GET — status check (and existing config for edits)
// =============================================================================
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('wl_onboarding_status, wl_subscription_id')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (!user) {
    return NextResponse.json({ status: 'not_started' })
  }

  const status = (user.wl_onboarding_status as 'not_started' | 'pending' | 'complete' | null) || 'not_started'

  // Sanity check: if status is 'pending' or 'complete' but no subscription id, something's
  // off — treat as not_started so they get bounced back to billing.
  if ((status === 'pending' || status === 'complete') && !user.wl_subscription_id) {
    return NextResponse.json({ status: 'not_started' })
  }

  if (status === 'complete') {
    const { data: tenant } = await supabase
      .from('white_label_tenants')
      .select('id, brand_name, slug, primary_color, accent_color, logo_url, slug_changed_at, is_active')
      .eq('owner_clerk_id', userId)
      .maybeSingle()

    if (!tenant) {
      // status says complete but no tenant row — they hit an edge case.
      // Treat as 'pending' so they can finish onboarding.
      return NextResponse.json({ status: 'pending' })
    }

    // Compute slug-change cooldown
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
        primary_color: tenant.primary_color,
        accent_color: tenant.accent_color,
        logo_url: tenant.logo_url,
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

  // ── Field validation ──────────────────────────────────────────────
  const brandName = String(body.brand_name || '').trim()
  const subdomain = String(body.subdomain || '').toLowerCase().trim()
  const primaryColor = String(body.primary_color || '').trim()
  const accentColor = String(body.accent_color || '').trim()
  const logoUrl = String(body.logo_url || '').trim()

  if (!brandName || brandName.length < 2 || brandName.length > 60) {
    return NextResponse.json({ error: 'invalid_brand_name', detail: 'Brand name must be 2–60 characters.' }, { status: 400 })
  }
  if (!subdomain || !SLUG_RE.test(subdomain)) {
    return NextResponse.json({ error: 'invalid_subdomain', detail: 'Subdomain must be 3–30 chars, lowercase letters/digits/hyphens.' }, { status: 400 })
  }
  if (RESERVED.has(subdomain)) {
    return NextResponse.json({ error: 'reserved_subdomain' }, { status: 400 })
  }
  if (!HEX_RE.test(primaryColor)) {
    return NextResponse.json({ error: 'invalid_primary_color', detail: 'Primary color must be #RRGGBB.' }, { status: 400 })
  }
  if (!HEX_RE.test(accentColor)) {
    return NextResponse.json({ error: 'invalid_accent_color', detail: 'Accent color must be #RRGGBB.' }, { status: 400 })
  }
  if (!logoUrl) {
    return NextResponse.json({ error: 'missing_logo', detail: 'Upload your logo first.' }, { status: 400 })
  }

  // ── WL subscription gate ──────────────────────────────────────────
  const { data: user } = await supabase
    .from('users')
    .select('wl_onboarding_status, wl_subscription_id, stripe_customer_id')
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

  // Also check active redirects
  const { data: redirecting } = await supabase
    .from('subdomain_history')
    .select('id, tenant_id')
    .eq('old_slug', subdomain)
    .gt('redirects_until', new Date().toISOString())
    .maybeSingle()

  if (redirecting) {
    // Owned redirect? (the user is editing back to a recent slug they had)
    const { data: t } = await supabase
      .from('white_label_tenants')
      .select('owner_clerk_id')
      .eq('id', redirecting.tenant_id)
      .maybeSingle()
    if (!t || t.owner_clerk_id !== userId) {
      return NextResponse.json({ error: 'redirecting', detail: 'This subdomain is being redirected from a recent change.' }, { status: 409 })
    }
  }

  const now = new Date()

  // ── BRANCH: CREATE vs UPDATE ──────────────────────────────────────
  if (status === 'pending') {
    // ─── CREATE new tenant row ─────────────────────────────────────
    const { data: tenant, error: insErr } = await supabase
      .from('white_label_tenants')
      .insert({
        owner_clerk_id: userId,
        slug: subdomain,
        brand_name: brandName,
        logo_url: logoUrl,
        primary_color: primaryColor,
        accent_color: accentColor,
        // Other color fields use schema defaults
        support_email: '',  // schema requires NOT NULL but we don't ask user; empty for now
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
      // Unique-violation handler — race condition where slug was claimed
      // between our check and the insert
      if (insErr?.code === '23505') {
        return NextResponse.json({ error: 'taken' }, { status: 409 })
      }
      return NextResponse.json({ error: 'db_error', detail: insErr?.message }, { status: 500 })
    }

    // Mark onboarding complete
    await supabase
      .from('users')
      .update({ wl_onboarding_status: 'complete' })
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
    accent_color: accentColor,
  }

  if (slugChanged) {
    // Enforce 24-hour cooldown
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

    // Write a 30-day redirect from the old slug to the new one
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
    return NextResponse.json({ error: 'db_error', detail: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, subdomain, updated: true })
}