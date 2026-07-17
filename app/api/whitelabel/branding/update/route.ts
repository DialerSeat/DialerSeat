import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { revalidateTag } from 'next/cache'
import { getServiceClient } from '@/lib/supabase'
import { userCacheTag } from '@/lib/tenant'

const supabase = getServiceClient('whitelabel/branding-update')

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// Ongoing branding editor for an already-onboarded tenant owner. This is
// intentionally narrow: only the visual fields (brand name, logo, colors)
// can change here. Subdomain, custom domain, and billing are all untouched
// by this route on purpose — those have their own real complexity
// (DNS, Vercel domain provisioning, existing bookmarked links) that a
// simple settings form shouldn't quietly touch.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tenant } = await supabase
    .from('white_label_tenants')
    .select('id')
    .eq('owner_clerk_id', userId)
    .eq('status', 'active')
    .eq('is_active', true)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ success: false, error: 'No active tenant found for this account' }, { status: 404 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed request' }, { status: 400 })
  }

  const updates: Record<string, string> = {}

  if (body.brand_name !== undefined) {
    const brandName = String(body.brand_name).trim()
    if (!brandName || brandName.length < 2 || brandName.length > 60) {
      return NextResponse.json(
        { success: false, error: 'Brand name must be 2–60 characters.' },
        { status: 400 }
      )
    }
    updates.brand_name = brandName
  }

  for (const field of ['primary_color', 'sidebar_color', 'header_bg_color', 'page_bg_color'] as const) {
    if (body[field] !== undefined) {
      const value = String(body[field]).trim()
      if (!HEX_RE.test(value)) {
        return NextResponse.json(
          { success: false, error: `${field.replace(/_/g, ' ')} must be #RRGGBB.` },
          { status: 400 }
        )
      }
      updates[field] = value
    }
  }

  if (body.logo_url !== undefined) {
    const logoUrl = String(body.logo_url).trim()
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      return NextResponse.json({ success: false, error: 'Invalid logo URL' }, { status: 400 })
    }
    updates.logo_url = logoUrl || null as any
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('white_label_tenants')
    .update(updates)
    .eq('id', tenant.id)
    .select('id, slug, brand_name, logo_url, primary_color, sidebar_color, header_bg_color, page_bg_color')
    .single()

  if (error) {
    console.error('branding update error:', error)
    return NextResponse.json({ success: false, error: 'Could not save changes' }, { status: 500 })
  }

  // So the owner's own next page load (and anyone whose active_tenant_id
  // points here) picks up the change immediately instead of a cached view.
  revalidateTag(userCacheTag(userId), { expire: 0 })

  return NextResponse.json({ success: true, tenant: updated })
}
