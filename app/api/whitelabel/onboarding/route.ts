import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = process.env.NEXT_PUBLIC_TENANT_ASSETS_BUCKET || 'tenant-assets'

// =============================================================================
// /api/whitelabel/onboarding
// =============================================================================
// GET  → reports current onboarding state for the calling user:
//          { status: 'not_started' | 'pending' | 'complete', existingSubdomain? }
//        The page uses this to decide whether to render the form or redirect.
//
// POST → multipart/form-data with:
//          brand_name      (string, 1-60)
//          subdomain       (string, 3-30, /^[a-z0-9-]+$/, not reserved/taken)
//          primary_color   (hex string, /^#[0-9a-fA-F]{6}$/)
//          logo            (File, PNG/JPG/WebP, max 500KB)
//
//        SERVER VALIDATES EVERYTHING — client validation is for UX only.
//        Failure returns 400 with a specific reason.
//
//        On success:
//          1. Upload logo to `tenant-assets/<tenant_uuid>/logo.<ext>`
//          2. Insert white_label_tenants row (or update if owner already
//             has one; lets users retry if logo upload partially failed)
//          3. Find owner's existing team or create one, set teams.tenant_id
//          4. Set users.wl_onboarding_status = 'complete'
//          5. Return { subdomain } so the page can redirect to tenant URL
//
// PRECONDITIONS:
//   - User must be signed in (Clerk)
//   - User must have wl_onboarding_status = 'pending' (i.e., their WL
//     subscription has been confirmed by the Stripe webhook). If it's
//     'not_started', POST returns 402 Payment Required.
//
// CRITICAL — server-side dimension check on the logo upload is SKIPPED
// in this v21 ship; we trust the client validation. Adding `sharp` for
// server-side image inspection is a follow-up. For now, the client
// blocks anything but exactly 28×28, and the 500KB cap is enforced
// server-side, so the failure mode is "tenant ships a weird logo" not
// "tenant ships malware."
// =============================================================================

const LOGO_MAX_BYTES = 500 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'support',
  'dashboard', 'billing', 'auth', 'docs', 'help', 'status',
  'staging', 'dev', 'test', 'demo', 'preview', 'sandbox',
  'cdn', 'assets', 'static', 'media', 'images', 'files',
  'sip', 'voice', 'webhook', 'webhooks', 'signalwire',
  'stripe', 'clerk', 'supabase', 'vercel', 'sentry',
  'dialerseat', 'whitelabel', 'wl', 'onboarding',
])

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

// ── GET status ───────────────────────────────────────────────────
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: u, error } = await supabase
    .from('users')
    .select('wl_onboarding_status')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[wl/onboarding GET]', error)
    return NextResponse.json({ error: 'Status lookup failed' }, { status: 500 })
  }

  const status = (u?.wl_onboarding_status as
    'not_started' | 'pending' | 'complete') || 'not_started'

  // If already complete, return their tenant subdomain
  let existingSubdomain: string | undefined
  if (status === 'complete') {
    const { data: t } = await supabase
      .from('white_label_tenants')
      .select('subdomain')
      .eq('owner_clerk_id', userId)
      .maybeSingle()
    existingSubdomain = t?.subdomain || undefined
  }

  return NextResponse.json({ status, existingSubdomain })
}

// ── POST submission ──────────────────────────────────────────────
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Verify the user has paid for WL ─────────────────────────────
  const { data: u } = await supabase
    .from('users')
    .select('wl_onboarding_status')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (u?.wl_onboarding_status === 'not_started') {
    return NextResponse.json(
      { error: 'White-label subscription required before setup.' },
      { status: 402 }
    )
  }
  if (u?.wl_onboarding_status === 'complete') {
    return NextResponse.json(
      { error: 'Tenant already provisioned.' },
      { status: 409 }
    )
  }

  // ── Parse multipart form ────────────────────────────────────────
  let form: FormData
  try {
    form = await req.formData()
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Invalid form data' },
      { status: 400 }
    )
  }

  const brandName = (form.get('brand_name') as string | null)?.trim() || ''
  const rawSubdomain = (form.get('subdomain') as string | null)?.trim().toLowerCase() || ''
  const primaryColor = (form.get('primary_color') as string | null) || ''
  const logo = form.get('logo') as File | null

  // ── Validate fields ─────────────────────────────────────────────
  if (!brandName || brandName.length > 60) {
    return NextResponse.json({ error: 'Brand name required (1-60 chars).' }, { status: 400 })
  }
  if (!SUBDOMAIN_RE.test(rawSubdomain)) {
    return NextResponse.json(
      { error: 'Invalid subdomain. Use 3-30 lowercase letters/digits/hyphens.' },
      { status: 400 }
    )
  }
  if (RESERVED_SUBDOMAINS.has(rawSubdomain)) {
    return NextResponse.json({ error: 'That subdomain is reserved.' }, { status: 400 })
  }
  if (!HEX_RE.test(primaryColor)) {
    return NextResponse.json({ error: 'Invalid color. Use a hex like #4a9eff.' }, { status: 400 })
  }
  if (!logo) {
    return NextResponse.json({ error: 'Logo file required.' }, { status: 400 })
  }
  if (logo.size > LOGO_MAX_BYTES) {
    return NextResponse.json(
      { error: `Logo too large (${Math.round(logo.size / 1024)} KB). Max 500 KB.` },
      { status: 400 }
    )
  }
  if (!ALLOWED_MIME.has(logo.type)) {
    return NextResponse.json(
      { error: 'Logo must be PNG, JPG, or WebP.' },
      { status: 400 }
    )
  }

  // ── Check subdomain not taken (by ANOTHER user) ─────────────────
  const { data: existingTenantBySubdomain } = await supabase
    .from('white_label_tenants')
    .select('id, owner_clerk_id')
    .eq('subdomain', rawSubdomain)
    .maybeSingle()

  if (existingTenantBySubdomain && existingTenantBySubdomain.owner_clerk_id !== userId) {
    return NextResponse.json(
      { error: `Subdomain "${rawSubdomain}" is already taken.` },
      { status: 409 }
    )
  }

  // ── Find or stage the tenant row ────────────────────────────────
  // If the user is retrying (e.g. first attempt failed at the logo
  // upload step), reuse their existing tenant row instead of creating
  // a duplicate.
  const { data: existingTenantByOwner } = await supabase
    .from('white_label_tenants')
    .select('id, subdomain')
    .eq('owner_clerk_id', userId)
    .maybeSingle()

  let tenantId: string

  if (existingTenantByOwner) {
    tenantId = existingTenantByOwner.id
  } else {
    // Insert with a placeholder logo_url; we'll patch it after upload
    const { data: created, error: insErr } = await supabase
      .from('white_label_tenants')
      .insert({
        owner_clerk_id: userId,
        brand_name: brandName,
        subdomain: rawSubdomain,
        primary_color: primaryColor,
        logo_url: '',
        is_active: true,
      })
      .select('id')
      .single()
    if (insErr || !created) {
      console.error('[wl/onboarding] insert tenant failed:', insErr)
      return NextResponse.json(
        { error: 'Could not create tenant record. ' + (insErr?.message || '') },
        { status: 500 }
      )
    }
    tenantId = created.id
  }

  // ── Upload logo to storage ──────────────────────────────────────
  const ext =
    logo.type === 'image/png' ? 'png'
    : logo.type === 'image/webp' ? 'webp'
    : 'jpg'
  const logoPath = `${tenantId}/logo-${Date.now()}.${ext}`

  const logoBuffer = Buffer.from(await logo.arrayBuffer())
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(logoPath, logoBuffer, {
      contentType: logo.type,
      upsert: true,
    })

  if (uploadErr) {
    console.error('[wl/onboarding] logo upload failed:', uploadErr)
    return NextResponse.json(
      { error: 'Logo upload failed. ' + uploadErr.message },
      { status: 500 }
    )
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(logoPath)
  const logoUrl = publicUrlData.publicUrl

  // ── Patch the tenant row with the actual fields ─────────────────
  const { error: updateErr } = await supabase
    .from('white_label_tenants')
    .update({
      brand_name: brandName,
      subdomain: rawSubdomain,
      primary_color: primaryColor,
      logo_url: logoUrl,
      is_active: true,
    })
    .eq('id', tenantId)

  if (updateErr) {
    console.error('[wl/onboarding] update tenant failed:', updateErr)
    return NextResponse.json(
      { error: 'Tenant update failed. ' + updateErr.message },
      { status: 500 }
    )
  }

  // ── Link the owner's team to this tenant ────────────────────────
  // If they don't have a team yet, we don't create one here — the team
  // workflow on /dashboard/teams handles that. We just stamp tenant_id
  // on whatever teams they currently own so their existing teams inherit
  // the branding automatically.
  await supabase
    .from('teams')
    .update({ tenant_id: tenantId })
    .eq('owner_id', userId)

  // ── Mark onboarding complete ────────────────────────────────────
  const { error: userUpdateErr } = await supabase
    .from('users')
    .update({ wl_onboarding_status: 'complete' })
    .eq('clerk_id', userId)

  if (userUpdateErr) {
    console.error('[wl/onboarding] mark complete failed:', userUpdateErr)
    // Don't fail the whole request — tenant exists, just status flag
    // didn't update. The user can still reach their tenant.
  }

  return NextResponse.json({
    subdomain: rawSubdomain,
    tenantId,
    logoUrl,
  })
}