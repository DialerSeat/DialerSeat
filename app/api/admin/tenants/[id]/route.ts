import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { revalidateTag } from 'next/cache'
import { userCacheTag } from '@/lib/tenant'
import { changeProjectDomain, removeProjectDomain } from '@/lib/vercelDomains'

const supabase = getServiceClient('admin/tenants/[id]')

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/
const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'mail', 'smtp', 'ftp', 'blog',
  'docs', 'help', 'support', 'status', 'dev', 'staging', 'test', 'demo-internal',
  'clerk', 'stripe', 'assets', 'cdn', 'static',
])
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const STATUSES = new Set(['active', 'suspended', 'cancelled'])

const TEXT_FIELDS = ['brand_name', 'support_email', 'footer_text'] as const
const URL_FIELDS = ['logo_url', 'favicon_url', 'custom_domain'] as const
const COLOR_FIELDS = ['primary_color', 'sidebar_color', 'header_bg_color', 'page_bg_color'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const { data: current, error: loadErr } = await supabase
      .from('white_label_tenants')
      .select('id, slug, owner_clerk_id')
      .eq('id', id)
      .maybeSingle()
    if (loadErr) throw loadErr
    if (!current) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const update: Record<string, any> = {}

    for (const f of TEXT_FIELDS) {
      if (f in body) {
        const v = body[f] === null ? null : String(body[f]).trim()
        if (f === 'brand_name' && !v) {
          return NextResponse.json({ success: false, error: 'Brand name cannot be empty' }, { status: 400 })
        }
        update[f] = v || null
        if (f === 'brand_name') update[f] = v
      }
    }

    for (const f of URL_FIELDS) {
      if (f in body) {
        const v = body[f] === null ? null : String(body[f]).trim()
        if (v && v.length > 2000) {
          return NextResponse.json({ success: false, error: `${f} is too long` }, { status: 400 })
        }
        if (v && f !== 'custom_domain' && !/^https?:\/\//i.test(v)) {
          return NextResponse.json({ success: false, error: `${f} must be an http(s) URL` }, { status: 400 })
        }
        update[f] = v || null
      }
    }

    for (const f of COLOR_FIELDS) {
      if (f in body) {
        const v = String(body[f] ?? '').trim()
        if (!HEX_RE.test(v)) {
          return NextResponse.json({ success: false, error: `${f} must be a #rrggbb hex color` }, { status: 400 })
        }
        update[f] = v
      }
    }

    if ('sidebar_color' in update) {
      update.accent_color = update.sidebar_color
    }

    if ('is_demo' in body) {
      update.is_demo = !!body.is_demo
    }

    // ── ASSIGN TO A USER ──────────────────────────────────────────────────
    // Ownership is what puts a brand in somebody's switcher and lets them
    // edit it. One person can own any number (lib/tenant, proxy.ts).
    if ('owner_clerk_id' in body) {
      const owner = String(body.owner_clerk_id ?? '').trim()
      if (!owner.startsWith('user_')) {
        return NextResponse.json({ success: false, error: 'Owner must be a Clerk user id (user_...)' }, { status: 400 })
      }
      const { data: ownerRow } = await supabase
        .from('users').select('clerk_id').eq('clerk_id', owner).maybeSingle()
      if (!ownerRow) {
        return NextResponse.json({ success: false, error: `No user found with clerk_id ${owner}` }, { status: 400 })
      }
      update.owner_clerk_id = owner
    }

    if ('status' in body) {
      const s = String(body.status ?? '').trim()
      if (!STATUSES.has(s)) {
        return NextResponse.json(
          { success: false, error: 'status must be active, suspended, or cancelled' },
          { status: 400 }
        )
      }
      update.status = s
      update.is_active = s === 'active'
    }

    if ('slug' in body) {
      const newSlug = String(body.slug ?? '').trim().toLowerCase()
      if (newSlug !== current.slug) {
        if (!SLUG_RE.test(newSlug)) {
          return NextResponse.json(
            { success: false, error: 'Slug must be 1-40 chars, lowercase letters/numbers/hyphens' },
            { status: 400 }
          )
        }
        if (RESERVED_SLUGS.has(newSlug)) {
          return NextResponse.json({ success: false, error: `"${newSlug}" is a reserved slug` }, { status: 400 })
        }
        const { data: taken } = await supabase
          .from('white_label_tenants')
          .select('id')
          .eq('slug', newSlug)
          .neq('id', id)
          .maybeSingle()
        if (taken) {
          return NextResponse.json({ success: false, error: `Slug "${newSlug}" is already taken` }, { status: 409 })
        }
        update.slug = newSlug
        update.slug_changed_at = new Date().toISOString()
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }
    update.updated_at = new Date().toISOString()

    const { data: tenant, error } = await supabase
      .from('white_label_tenants')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    // A new slug needs its subdomain on the Vercel project, and the old one
    // freed, or the brand's address stops loading.
    if (update.slug && update.slug !== current.slug) {
      const swap = await changeProjectDomain(current.slug, update.slug)
      if (!swap.added.ok && !swap.added.skipped) {
        console.error(`[admin/tenants/:id] domain move failed ${current.slug} -> ${update.slug}:`, swap.added.error)
      }
    }

    // Both owners' switchers are cached for a minute; refresh them now.
    revalidateTag(userCacheTag(current.owner_clerk_id), { expire: 0 })
    if (update.owner_clerk_id && update.owner_clerk_id !== current.owner_clerk_id) {
      revalidateTag(userCacheTag(update.owner_clerk_id), { expire: 0 })
      // The previous owner may have had this brand selected.
      await supabase.from('users').update({ active_tenant_id: null })
        .eq('clerk_id', current.owner_clerk_id).eq('active_tenant_id', id)
    }

    return NextResponse.json({ success: true, tenant })
  } catch (err: any) {
    console.error('[admin/tenants/:id] PATCH failed:', err)
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update tenant' },
      { status }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const { data: tenant } = await supabase
      .from('white_label_tenants')
      .select('id, slug, owner_clerk_id')
      .eq('id', id)
      .maybeSingle()
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const { count, error: countErr } = await supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id)
    if (countErr) throw countErr
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${count} team${count === 1 ? '' : 's'} still belong to "${tenant.slug}". Reassign or remove them before deleting the tenant.`,
        },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('white_label_tenants')
      .delete()
      .eq('id', id)
    if (error) throw error

    // Free the subdomain, and drop the brand from anyone who had it selected.
    const removed = await removeProjectDomain(tenant.slug)
    if (!removed.ok && !removed.skipped && !removed.notFound) {
      console.error(`[admin/tenants/:id] domain remove failed for ${tenant.slug}:`, removed.error)
    }
    await supabase.from('users').update({ active_tenant_id: null }).eq('active_tenant_id', id)
    revalidateTag(userCacheTag(tenant.owner_clerk_id), { expire: 0 })

    return NextResponse.json({ success: true, deleted: id })
  } catch (err: any) {
    console.error('[admin/tenants/:id] DELETE failed:', err)
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete tenant' },
      { status }
    )
  }
}