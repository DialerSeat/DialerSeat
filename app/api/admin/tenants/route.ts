import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { revalidateTag } from 'next/cache'
import { userCacheTag } from '@/lib/tenant'
import { addProjectDomain } from '@/lib/vercelDomains'

const supabase = getServiceClient('admin/tenants')

/** The column is NOT NULL with an email check, so a blank field cannot insert. */
const DEFAULT_SUPPORT_EMAIL = 'support@dialerseat.com'

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
    const supportEmail = String(body.support_email ?? '').trim() || DEFAULT_SUPPORT_EMAIL
    // A demo brand is never billed and is never switched off by a billing
    // event (see the white-label handlers in the Stripe webhook).
    const isDemo = !!body.is_demo
    const primaryColor = typeof body.primary_color === 'string' && HEX_RE.test(body.primary_color)
      ? body.primary_color
      : COLOR_DEFAULTS.primary_color

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

    const { data: existing } = await supabase
      .from('white_label_tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: false, error: `Slug "${slug}" is already taken` }, { status: 409 })
    }

    const { data: tenant, error } = await supabase
      .from('white_label_tenants')
      .insert({
        slug,
        brand_name: brandName,
        owner_clerk_id: ownerClerkId,
        support_email: supportEmail,
        status: 'active',
        is_active: true,
        is_demo: isDemo,
        primary_color: primaryColor,
        sidebar_color: COLOR_DEFAULTS.sidebar_color,
        accent_color: COLOR_DEFAULTS.sidebar_color, // legacy mirror
        header_bg_color: COLOR_DEFAULTS.header_bg_color,
        page_bg_color: COLOR_DEFAULTS.page_bg_color,
      })
      .select('*')
      .single()

    if (error) throw error

    // ── THE SUBDOMAIN HAS TO EXIST TOO ─────────────────────────────────
    // There is no wildcard domain: each brand's slug.dialerseat.com is added
    // to the Vercel project one at a time, as self-serve onboarding does.
    // Without this an admin-made brand saved fine and its address did not
    // load. A failure is reported, not fatal: the brand exists either way.
    const domain = await addProjectDomain(slug)
    if (!domain.ok && !domain.skipped) {
      console.error(`[admin/tenants] domain provision failed for ${slug}:`, domain.error)
    }

    // The owner's brand switcher is cached for a minute; show it now.
    revalidateTag(userCacheTag(ownerClerkId), { expire: 0 })

    return NextResponse.json({ success: true, tenant, domainProvisioned: domain.ok, domainError: domain.ok ? null : domain.error ?? null })
  } catch (err: any) {
    console.error('[admin/tenants] POST failed:', err)
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create tenant' },
      { status }
    )
  }
}