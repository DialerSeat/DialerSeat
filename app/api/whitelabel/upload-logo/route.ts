// app/api/whitelabel/upload-logo/route.ts
// =============================================================================
// UPLOAD WHITE-LABEL LOGO — cache-busting via unique filename
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
// Storage path: tenants/{clerk_id}/logo-{timestamp}.{png|svg}
//
// CACHE-BUSTING: every upload uses a unique filename (millisecond timestamp).
// Previously the path was a fixed `logo.png` and re-uploads returned the
// same public URL. Browsers + Supabase's CDN cached the old image and the
// new logo never appeared for up to an hour even though storage had been
// updated. With unique filenames, the public URL changes every save, so
// the new image is fetched fresh.
//
// Storage cleanup: before uploading the new file, all prior logo-*
// files in this user's folder are deleted. Result is exactly one logo
// file per user at any moment — no orphan growth over time.
//
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

const MAX_BYTES = 200 * 1024
const REQUIRED_W = 512
const REQUIRED_H = 148
const ASPECT_TOLERANCE = 0.02

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null
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
  if (w && h) {
    return { width: parseFloat(w[1]), height: parseFloat(h[1]) }
  }
  return null
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', detail: `Max ${MAX_BYTES / 1024} KB. Yours is ${Math.round(file.size / 1024)} KB.` },
      { status: 400 }
    )
  }

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

  const arrayBuf = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuf)

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

  const baseFolder = `tenants/${userId}`

  // ── Cleanup: remove all prior logo files for this user ──────────────
  // List the user's folder and delete anything matching logo* (both legacy
  // logo.png/logo.svg AND any previously-uploaded timestamped logos).
  // Filter ensures we don't accidentally remove other tenant assets that
  // may live in this folder in the future (favicons, hero images, etc).
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
    // List/remove errors are non-fatal — if cleanup fails, we still upload
    // the new file. Worst case: a few orphans accumulate, which is harmless.
    console.warn('logo cleanup failed (non-fatal):', e)
  }

  // ── Upload with unique filename ─────────────────────────────────────
  const filename = `logo-${Date.now()}.${ext}`
  const path = `${baseFolder}/${filename}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: ext === 'png' ? 'image/png' : 'image/svg+xml',
      cacheControl: '3600',
      // Not strictly needed since the path is unique each time, but harmless.
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
  const publicUrl = pub.publicUrl

  return NextResponse.json({
    url: publicUrl,
    width,
    height,
    format: ext,
  })
}