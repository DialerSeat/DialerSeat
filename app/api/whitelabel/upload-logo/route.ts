// app/api/whitelabel/upload-logo/route.ts
// =============================================================================
// UPLOAD WHITE-LABEL LOGO
// =============================================================================
// POST /api/whitelabel/upload-logo
// Body: multipart/form-data with `logo` file field
//
// Validation (all server-side; client checks are advisory only):
//   - Auth: signed in
//   - WL onboarding status: 'pending' OR 'complete' (so users can re-upload
//     during edits)
//   - File: PNG or SVG only
//   - Size: ≤ 200KB
//   - Dimensions: PNG must be EXACTLY 512×148. SVG must have a viewBox
//     with aspect ratio 256:74 (±2% tolerance).
//
// Storage path: tenants/{clerk_id}/logo.{png|svg}
// (Old logo at this path is replaced — we don't keep versions; the user
// just re-uploads if they made a mistake.)
//
// Returns: { url: 'https://.../tenants/{id}/logo.png', width, height }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = process.env.NEXT_PUBLIC_TENANT_ASSETS_BUCKET || 'tenant-assets'

const MAX_BYTES = 200 * 1024            // 200 KB
const REQUIRED_W = 512
const REQUIRED_H = 148
const ASPECT_TOLERANCE = 0.02           // 2% wiggle for SVG viewBox

// ─────────────────────────────────────────────────────────────────────
// PNG dimension parser (manual, no sharp dependency)
// ─────────────────────────────────────────────────────────────────────
// PNG file structure:
//   bytes 0-7:    PNG signature (89 50 4E 47 0D 0A 1A 0A)
//   bytes 8-15:   IHDR chunk length+type (00 00 00 0D 49 48 44 52)
//   bytes 16-19:  width (big-endian uint32)
//   bytes 20-23:  height (big-endian uint32)
// We just read 24 bytes and extract width/height.
function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null
  // Magic check
  if (
    buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47 ||
    buf[4] !== 0x0d || buf[5] !== 0x0a || buf[6] !== 0x1a || buf[7] !== 0x0a
  ) {
    return null
  }
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  return { width, height }
}

// ─────────────────────────────────────────────────────────────────────
// SVG dimension parser — looks at viewBox first, falls back to width/height
// ─────────────────────────────────────────────────────────────────────
function parseSvgDimensions(text: string): { width: number; height: number } | null {
  // Only look at the opening <svg ...> tag, not the whole document
  const m = text.match(/<svg\b[^>]*>/i)
  if (!m) return null
  const tag = m[0]

  // Prefer viewBox: gives us the aspect ratio we care about
  const vb = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i)
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
      return { width: parts[2], height: parts[3] }
    }
  }

  // Fallback: width + height attrs (strip 'px' if present)
  const w = tag.match(/\bwidth\s*=\s*["']?([\d.]+)/i)
  const h = tag.match(/\bheight\s*=\s*["']?([\d.]+)/i)
  if (w && h) {
    return { width: parseFloat(w[1]), height: parseFloat(h[1]) }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Gate: user must be in WL flow
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

  // Read the multipart body
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

  // Size check
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty_file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', detail: `Max ${MAX_BYTES / 1024} KB. Yours is ${Math.round(file.size / 1024)} KB.` },
      { status: 400 }
    )
  }

  // MIME / extension check
  const mime = (file.type || '').toLowerCase()
  let ext: 'png' | 'svg'
  if (mime === 'image/png') {
    ext = 'png'
  } else if (mime === 'image/svg+xml' || mime === 'image/svg') {
    ext = 'svg'
  } else {
    return NextResponse.json(
      { error: 'bad_format', detail: 'PNG or SVG only.' },
      { status: 400 }
    )
  }

  // Read body
  const arrayBuf = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuf)

  // Dimension validation
  let width: number | null = null
  let height: number | null = null

  if (ext === 'png') {
    const dim = parsePngDimensions(buf)
    if (!dim) {
      return NextResponse.json({ error: 'invalid_png' }, { status: 400 })
    }
    width = dim.width
    height = dim.height
    if (width !== REQUIRED_W || height !== REQUIRED_H) {
      return NextResponse.json(
        {
          error: 'wrong_dimensions',
          detail: `Logo must be exactly ${REQUIRED_W}×${REQUIRED_H} pixels. Yours is ${width}×${height}.`,
          required: { width: REQUIRED_W, height: REQUIRED_H },
          actual: { width, height },
        },
        { status: 400 }
      )
    }
  } else {
    const text = buf.toString('utf-8')
    if (!/<svg\b/i.test(text)) {
      return NextResponse.json({ error: 'invalid_svg' }, { status: 400 })
    }
    const dim = parseSvgDimensions(text)
    if (!dim) {
      return NextResponse.json(
        { error: 'svg_no_dimensions', detail: 'SVG must declare viewBox or width+height.' },
        { status: 400 }
      )
    }
    width = dim.width
    height = dim.height
    const requiredAspect = REQUIRED_W / REQUIRED_H
    const actualAspect = width / height
    const diff = Math.abs(actualAspect - requiredAspect) / requiredAspect
    if (diff > ASPECT_TOLERANCE) {
      return NextResponse.json(
        {
          error: 'wrong_aspect',
          detail: `SVG aspect ratio must be ${REQUIRED_W}:${REQUIRED_H} (≈${requiredAspect.toFixed(2)}:1). Yours is ${actualAspect.toFixed(2)}:1.`,
        },
        { status: 400 }
      )
    }
  }

  // Cleanup: remove any prior logo for this user (both extensions)
  const baseFolder = `tenants/${userId}`
  await supabase.storage.from(BUCKET).remove([
    `${baseFolder}/logo.png`,
    `${baseFolder}/logo.svg`,
  ]).catch(() => { /* missing files are fine */ })

  // Upload
  const path = `${baseFolder}/logo.${ext}`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: ext === 'png' ? 'image/png' : 'image/svg+xml',
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

  // Build public URL
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  return NextResponse.json({
    url: publicUrl,
    width,
    height,
    format: ext,
  })
}