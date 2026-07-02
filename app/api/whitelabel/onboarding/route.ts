import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import {
  addProjectDomain,
  removeProjectDomain,
  changeProjectDomain,
} from '@/lib/vercelDomains'
import { submitOnTenantLive } from '@/lib/indexnow'

const supabase = getServiceClient('whitelabel/onboarding')

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

const SLUG_CHANGE_LIMIT = 3
const SLUG_CHANGE_WINDOW_HOURS = 48
const SLUG_REDIRECT_DAYS = 30

const LEGACY_SECONDARY_DEFAULT = '#2a6eff'
const LEGACY_BACKGROUND_DEFAULT = '#0a0a0f'
const LEGACY_TEXT_DEFAULT = '#f0f0f5'

async function slugChangeAvailableAt(tenantId: string): Promise<string | null> {
  const windowStart = new Date(
    Date.now() - SLUG_CHANGE_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()

  const { data: recentChanges } = await supabase
    .from('subdomain_history')
    .select('created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true })

  if ((recentChanges?.length || 0) >= SLUG_CHANGE_LIMIT) {
    const oldest = new Date(recentChanges![0].created_at).getTime()
    return new Date(oldest + SLUG_CHANGE_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  }
  return null
}

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
        primary_color, sidebar_color, header_bg_color, page_bg_color,
        login_link_label, login_link_text, login_link_url
      `)
      .eq('owner_clerk_id', userId)
      .maybeSingle()

    if (!tenant) {
      return NextResponse.json({ status: 'pending' })
    }

    const canChangeSlugAt = await slugChangeAvailableAt(tenant.id)

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
        login_link_label: tenant.login_link_label,
        login_link_text: tenant.login_link_text,
        login_link_url: tenant.login_link_url,
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

  const brandName = String(body.brand_name || '').trim()
  const subdomain = String(body.subdomain || '').toLowerCase().trim()
  const logoUrl = String(body.logo_url || '').trim()
  const primaryColor = String(body.primary_color || '').trim()
  const sidebarColor = String(body.sidebar_color || '').trim()
  const headerBgColor = String(body.header_bg_color || '').trim()
  const pageBgColor = String(body.page_bg_color || '').trim()

  const loginLinkLabelRaw = String(body.login_link_label || '').trim()
  const loginLinkTextRaw = String(body.login_link_text || '').trim()
  const loginLinkUrlRaw = String(body.login_link_url || '').trim()

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

  let loginLinkLabel: string | null = null
  let loginLinkText: string | null = null
  let loginLinkUrl: string | null = null
  const wantsLink =
    loginLinkTextRaw.length > 0 ||
    loginLinkUrlRaw.length > 0 ||
    loginLinkLabelRaw.length > 0
  if (wantsLink) {
    if (!loginLinkTextRaw || !loginLinkUrlRaw) {
      return NextResponse.json(
        { error: 'invalid_login_link', detail: 'A login link needs both clickable text and a URL — or leave the link fields blank.' },
        { status: 400 }
      )
    }
    if (loginLinkTextRaw.length > 48) {
      return NextResponse.json(
        { error: 'invalid_login_link', detail: 'Link text must be 48 characters or fewer.' },
        { status: 400 }
      )
    }
    if (loginLinkLabelRaw.length > 40) {
      return NextResponse.json(
        { error: 'invalid_login_link', detail: 'Link heading must be 40 characters or fewer.' },
        { status: 400 }
      )
    }
    let parsed: URL
    try {
      parsed = new URL(loginLinkUrlRaw)
    } catch {
      return NextResponse.json(
        { error: 'invalid_login_link', detail: 'Link URL must be a full URL, e.g. https://yoursite.com.' },
        { status: 400 }
      )
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'invalid_login_link', detail: 'Link URL must start with http:// or https://.' },
        { status: 400 }
      )
    }
    loginLinkText = loginLinkTextRaw
    loginLinkUrl = parsed.toString()
    loginLinkLabel = loginLinkLabelRaw || null
  }

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
        login_link_label: loginLinkLabel,
        login_link_text: loginLinkText,
        login_link_url: loginLinkUrl,
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

    await supabase
      .from('users')
      .update({
        wl_onboarding_status: 'complete',
        active_tenant_id: tenant.id,
      })
      .eq('clerk_id', userId)

    const domain = await addProjectDomain(tenant.slug)
    if (!domain.ok && !domain.skipped) {
      console.error(`[onboarding] domain provision failed for ${tenant.slug}:`, domain.error)
    }

    void submitOnTenantLive(tenant.slug)

    return NextResponse.json({
      success: true,
      subdomain: tenant.slug,
      created: true,
      domainProvisioned: domain.ok,
    })
  }

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
    login_link_label: loginLinkLabel,
    login_link_text: loginLinkText,
    login_link_url: loginLinkUrl,
    accent_color: sidebarColor,
  }

  if (slugChanged) {

    const availableAt = await slugChangeAvailableAt(existing.id)
    if (availableAt) {
      return NextResponse.json(
        {
          error: 'slug_rate_limited',
          detail: `You've changed your subdomain ${SLUG_CHANGE_LIMIT} times in the last ${SLUG_CHANGE_WINDOW_HOURS} hours. You can change it again on ${new Date(availableAt).toLocaleString()}.`,
          availableAt,
          changeLimit: SLUG_CHANGE_LIMIT,
          windowHours: SLUG_CHANGE_WINDOW_HOURS,
        },
        { status: 429 }
      )
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

  let domainSwapped: boolean | undefined
  if (slugChanged) {
    const swap = await changeProjectDomain(existing.slug, subdomain)
    domainSwapped = swap.added.ok
    if (!swap.added.ok && !swap.added.skipped) {
      console.error(`[onboarding] domain swap add failed ${existing.slug}→${subdomain}:`, swap.added.error)
    }

    void submitOnTenantLive(subdomain)
    void submitOnTenantLive(existing.slug)
  }

  return NextResponse.json({
    success: true,
    subdomain,
    updated: true,
    ...(slugChanged ? { domainSwapped } : {}),
  })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {

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