import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { isReservedSubdomain } from '@/lib/reservedSubdomains'

const supabase = getServiceClient('whitelabel/check-subdomain')

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const slug = (req.nextUrl.searchParams.get('slug') || '').toLowerCase().trim()

  if (!slug) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }
  if (slug.length < 3) {
    return NextResponse.json({ available: false, reason: 'too_short' })
  }
  if (slug.length > 30) {
    return NextResponse.json({ available: false, reason: 'too_long' })
  }
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }
  if (isReservedSubdomain(slug)) {
    return NextResponse.json({ available: false, reason: 'reserved' })
  }

  const { data: existing } = await supabase
    .from('white_label_tenants')
    .select('id, owner_clerk_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (existing) {

    if (existing.owner_clerk_id === userId) {
      return NextResponse.json({ available: true, current: true })
    }
    return NextResponse.json({ available: false, reason: 'taken' })
  }

  const { data: redirecting } = await supabase
    .from('subdomain_history')
    .select('id, tenant_id')
    .eq('old_slug', slug)
    .gt('redirects_until', new Date().toISOString())
    .maybeSingle()

  if (redirecting) {
    return NextResponse.json({ available: false, reason: 'redirecting' })
  }

  return NextResponse.json({ available: true })
}