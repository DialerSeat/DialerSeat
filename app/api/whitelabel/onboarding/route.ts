// app/api/whitelabel/onboarding/route.ts
// =============================================================================
// WHITE-LABEL ONBOARDING / EDIT — 5-color support
// =============================================================================
// Fixes a bug where the POST only read/wrote primary_color + accent_color.
// The frontend always sent all 5 colors (primary, secondary, accent=surface,
// background, text) but only 2 of them ever hit the DB. Result: editing
// presets in onboarding visibly updated the sidebar (primary) and chrome
// (accent) but nothing else changed because secondary/background/text
// silently stayed at their old values.
//
// This version:
//   - GET selects all 5 color columns so the edit form loads correctly
//   - POST validates all 5 colors as valid hex
//   - POST INSERT writes all 5 columns
//   - POST UPDATE writes all 5 columns
//   - Other behavior unchanged (active_tenant_id auto-set on create,
//     support_email defaults to user.email, slug cooldown, etc.)
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
    // Select ALL 5 color columns so the edit form pre-fills correctly.
    const { data: tenant } = await supabase
      .from('white_label_tenants')
      .select(`
        id, brand_name, slug, logo_url, slug_changed_at, is_active,
        primary_color, secondary_color, accent_color, background_color, text_color
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
        secondary_color: tenant.secondary_color,
        accent_color: tenant.accent_color,
        background_color: tenant.background_color,
        text_color: tenant.text_color,
      },
      canChangeSlugAt,
      isActive: tenant.is_active,
    })
  }

  return NextResponse.json({ status })
}

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
  const secondaryColor = String(body.secondary_color || '').trim()
  const accentColor = String(body.accent_color || '').trim()
  const backgroundColor = String(body.background_color || '').trim()
  const textColor = String(body.text_color || '').trim()

  // ── Validation ────────────────────────────────────────────────────
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
  if (!HEX_RE.test(secondaryColor)) {
    return NextResponse.json({ error: 'invalid_secondary_color', detail: 'Secondary color must be #RRGGBB.' }, { status: 400 })
  }
  if (!HEX_RE.test(accentColor)) {
    return NextResponse.json({ error: 'invalid_accent_color', detail: 'Surface (accent) color must be #RRGGBB.' }, { status: 400 })
  }
  if (!HEX_RE.test(backgroundColor)) {
    return NextResponse.json({ error: 'invalid_background_color', detail: 'Background color must be #RRGGBB.' }, { status: 400 })
  }
  if (!HEX_RE.test(textColor)) {
    return NextResponse.json({ error: 'invalid_text_color', detail: 'Text color must be #RRGGBB.' }, { status: 400 })
  }
  if (!logoUrl) {
    return NextResponse.json({ error: 'missing_logo', detail: 'Upload your logo first.' }, { status: 400 })
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
      return NextResponse.json({ error: 'redirecting', detail: 'This subdomain is being redirected from a recent change.' }, { status: 409 })
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
        // All 5 colors written on create.
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        background_color: backgroundColor,
        text_color: textColor,
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
      return NextResponse.json({ error: 'db_error', detail: insErr?.message }, { status: 500 })
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
    // All 5 colors written on every update.
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    accent_color: accentColor,
    background_color: backgroundColor,
    text_color: textColor,
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
    return NextResponse.json({ error: 'db_error', detail: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, subdomain, updated: true })
}