import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('whitelabel/upload-logo')

const BUCKET = process.env.NEXT_PUBLIC_TENANT_ASSETS_BUCKET || 'tenant-assets'

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null
  if (
    buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47 ||
    buf[4] !== 0x0d || buf[5] !== 0x0a || buf[6] !== 0x1a || buf[7] !== 0x0a
  ) {
    return null
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function parseSvgDimensions(text: string): { width: number; height: number } | null {
  const m = text.match(/<svg\b[^>]*>/i)
  if (!m) return null
  const tag = m[0]
  const vb = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i)
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
      return { width: parts[2], height: parts[3] }
    }
  }
  const w = tag.match(/\bwidth\s*=\s*["']?([\d.]+)/i)
  const h = tag.match(/\bheight\s*=\s*["']?([\d.]+)/i)
  if (w && h) return { width: parseFloat(w[1]), height: parseFloat(h[1]) }
  return null
}

function deriveExt(mime: string, filename: string): string {
  const m = mime.toLowerCase()
  if (m === 'image/png') return 'png'
  if (m === 'image/svg+xml' || m === 'image/svg') return 'svg'
  if (m === 'image/gif') return 'gif'
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/avif') return 'avif'
  if (m === 'image/bmp') return 'bmp'
  if (m === 'image/x-icon' || m === 'image/vnd.microsoft.icon') return 'ico'
  const fname = (filename || '').toLowerCase()
  const dot = fname.lastIndexOf('.')
  if (dot >= 0 && dot < fname.length - 1) {
    const ext = fname.slice(dot + 1).replace(/[^a-z0-9]/g, '')
    if (ext.length > 0 && ext.length <= 5) return ext
  }
  return 'bin'
}

function filenameFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    const last = parts[parts.length - 1]
    return last ? decodeURIComponent(last) : null
  } catch {

    const parts = url.split('/')
    const last = parts[parts.length - 1]
    return last ? last.split('?')[0] : null
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('wl_onboarding_status')
    .eq('clerk_id', userId)
    .single()

  if (!user || (user.wl_onboarding_status !== 'pending' && user.wl_onboarding_status !== 'complete')) {
    return NextResponse.json(
      { error: 'not_in_whitelabel_flow', detail: 'You must have an active white-label subscription to upload logos.' },
      { status: 403 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch (e: any) {
    return NextResponse.json({ error: 'malformed_form', detail: e.message }, { status: 400 })
  }

  const file = form.get('logo')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty_file' }, { status: 400 })
  }

  const mime = (file.type || '').toLowerCase()

  if (mime && !mime.startsWith('image/')) {
    return NextResponse.json(
      { error: 'bad_format', detail: 'Image files only.' },
      { status: 400 }
    )
  }

  const originalName = (file as any).name || ''
  const ext = deriveExt(mime, originalName)

  const arrayBuf = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuf)

  let width: number | null = null
  let height: number | null = null
  if (ext === 'png') {
    const dim = parsePngDimensions(buf)
    if (dim) { width = dim.width; height = dim.height }
  } else if (ext === 'svg') {
    try {
      const text = buf.toString('utf-8')
      const dim = parseSvgDimensions(text)
      if (dim) { width = dim.width; height = dim.height }
    } catch {}
  }

  const baseFolder = `tenants/${userId}`

  try {

    const protectedFilenames = new Set<string>()

    const { data: themes } = await supabase
      .from('custom_themes')
      .select('logo_url')
      .eq('user_id', userId)
      .not('logo_url', 'is', null)

    for (const t of themes || []) {
      const fname = filenameFromUrl(t.logo_url)
      if (fname) protectedFilenames.add(fname)
    }

    const { data: tenant } = await supabase
      .from('white_label_tenants')
      .select('logo_url')
      .eq('owner_clerk_id', userId)
      .maybeSingle()

    if (tenant?.logo_url) {
      const fname = filenameFromUrl(tenant.logo_url)
      if (fname) protectedFilenames.add(fname)
    }

    const { data: existing } = await supabase.storage.from(BUCKET).list(baseFolder)
    if (existing && existing.length > 0) {
      const oldLogoPaths = existing
        .filter(f =>
          (/^logo[-.]/.test(f.name) || f.name === 'logo.png' || f.name === 'logo.svg')
          && !protectedFilenames.has(f.name)
        )
        .map(f => `${baseFolder}/${f.name}`)
      if (oldLogoPaths.length > 0) {
        await supabase.storage.from(BUCKET).remove(oldLogoPaths)
      }
    }
  } catch (e) {
    console.warn('logo cleanup failed (non-fatal):', e)
  }

  const filename = `logo-${Date.now()}.${ext}`
  const path = `${baseFolder}/${filename}`

  const contentType = mime && mime.startsWith('image/')
    ? mime
    : (ext === 'png' ? 'image/png'
      : ext === 'svg' ? 'image/svg+xml'
      : ext === 'gif' ? 'image/gif'
      : ext === 'jpg' ? 'image/jpeg'
      : ext === 'webp' ? 'image/webp'
      : 'application/octet-stream')

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    })

  if (upErr) {
    console.error('logo upload failed:', upErr)
    return NextResponse.json(
      { error: 'upload_failed', detail: upErr.message },
      { status: 500 }
    )
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({
    url: pub.publicUrl,
    width,
    height,
    format: ext,
  })
}