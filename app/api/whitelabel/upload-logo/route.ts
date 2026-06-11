// app/api/whitelabel/upload-logo/route.ts
// =============================================================================
// UPLOAD WHITE-LABEL LOGO — relaxed validation (testing mode)
// =============================================================================
// POST /api/whitelabel/upload-logo
// Body: multipart/form-data with `logo` file field
//
// CURRENT STATE: validation temporarily relaxed for JC's testing.
//   - File: any image/* mime accepted (png, svg, gif, jpeg, webp, etc.)
//   - Size: no max (storage will reject above its own limits)
//   - Dimensions: NOT checked
//   - SVG aspect: NOT checked
//
// ⚠ BACKLOG REMINDER (restore after testing):
//   - MAX_BYTES = 200 * 1024
//   - REQUIRED_W = 512, REQUIRED_H = 148
//   - SVG aspect tolerance 2%
//   - PNG/SVG only (image/png, image/svg+xml)
// All the helpers (parsePngDimensions, parseSvgDimensions) and the
// validation blocks are commented below for easy restoration.
//
// Preserved: auth gate, WL onboarding status check, storage cleanup of
// old logos, unique-filename cache busting, public URL return shape.
//
// Storage path: tenants/{clerk_id}/logo-{timestamp}.{ext}
// Returns: { url, width, height, format }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = process.env.NEXT_PUBLIC_TENANT_ASSETS_BUCKET || 'tenant-assets'

// ⚠ RESTORE LATER — production constants:
// const MAX_BYTES = 200 * 1024
// const REQUIRED_W = 512
// const REQUIRED_H = 148
// const ASPECT_TOLERANCE = 0.02

// Best-effort dimension parsers — kept so the response shape is
// unchanged for PNG/SVG. Other formats return null and that's fine.
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

// Derive a safe extension from the mime + filename. Falls back to 'bin'
// for unknown formats so the file still gets stored (just unrenderable).
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
  // Fall back to the original filename's extension when possible.
  const fname = (filename || '').toLowerCase()
  const dot = fname.lastIndexOf('.')
  if (dot >= 0 && dot < fname.length - 1) {
    const ext = fname.slice(dot + 1).replace(/[^a-z0-9]/g, '')
    if (ext.length > 0 && ext.length <= 5) return ext
  }
  return 'bin'
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

  // ⚠ RESTORE LATER — size cap:
  // if (file.size > MAX_BYTES) {
  //   return NextResponse.json(
  //     { error: 'too_large', detail: `Max ${MAX_BYTES / 1024} KB. Yours is ${Math.round(file.size / 1024)} KB.` },
  //     { status: 400 }
  //   )
  // }

  const mime = (file.type || '').toLowerCase()

  // Relaxed mime gate: accept anything image/*. If the browser didn't
  // send a mime at all (rare) we accept and let storage decide.
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

  // Best-effort dimension detection for PNG/SVG. Other formats: null.
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
    } catch {
      // ignore — SVG dimension extraction is best-effort only
    }
  }

  // ⚠ RESTORE LATER — dimension and aspect enforcement:
  // if (ext === 'png') {
  //   if (!width || !height || width !== REQUIRED_W || height !== REQUIRED_H) {
  //     return NextResponse.json({
  //       error: 'wrong_dimensions',
  //       detail: `Logo must be exactly ${REQUIRED_W}×${REQUIRED_H} pixels. Yours is ${width}×${height}.`,
  //       required: { width: REQUIRED_W, height: REQUIRED_H },
  //       actual: { width, height },
  //     }, { status: 400 })
  //   }
  // } else if (ext === 'svg') {
  //   if (!width || !height) {
  //     return NextResponse.json({ error: 'svg_no_dimensions', detail: 'SVG must declare viewBox or width+height.' }, { status: 400 })
  //   }
  //   const requiredAspect = REQUIRED_W / REQUIRED_H
  //   const actualAspect = width / height
  //   const diff = Math.abs(actualAspect - requiredAspect) / requiredAspect
  //   if (diff > ASPECT_TOLERANCE) {
  //     return NextResponse.json({
  //       error: 'wrong_aspect',
  //       detail: `SVG aspect ratio must be ${REQUIRED_W}:${REQUIRED_H}. Yours is ${actualAspect.toFixed(2)}:1.`,
  //     }, { status: 400 })
  //   }
  // }

  const baseFolder = `tenants/${userId}`

  // ── Cleanup: remove all prior logo files for this user ──────────────
  try {
    const { data: existing } = await supabase.storage.from(BUCKET).list(baseFolder)
    if (existing && existing.length > 0) {
      const oldLogoPaths = existing
        .filter(f => /^logo[-.]/.test(f.name) || f.name === 'logo.png' || f.name === 'logo.svg')
        .map(f => `${baseFolder}/${f.name}`)
      if (oldLogoPaths.length > 0) {
        await supabase.storage.from(BUCKET).remove(oldLogoPaths)
      }
    }
  } catch (e) {
    console.warn('logo cleanup failed (non-fatal):', e)
  }

  // ── Upload with unique filename ─────────────────────────────────────
  const filename = `logo-${Date.now()}.${ext}`
  const path = `${baseFolder}/${filename}`

  // Pick a content-type for storage. If the browser sent a usable mime,
  // honor it; otherwise reverse-engineer from the extension.
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