import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getManagerTenant } from '@/lib/manager'

// =============================================================================
// MANAGER DESKTOP WALLPAPER UPLOAD — /api/manager/desktop-prefs/wallpaper
// =============================================================================
// Drag-and-drop file wallpapers on the manager desktop POST here (see
// Desktop.tsx onRootDrop → `${prefsApiBaseFor(role)}/wallpaper`). The route
// accepts a multipart FormData "file", stores it in the public tenant-assets
// bucket under a per-user wallpaper path, and returns the public URL. The
// desktop then sets background = { type:'image', value:url } and the existing
// /api/manager/desktop-prefs PUT persists that choice — so the uploaded
// wallpaper follows the user across devices like every other pref.
//
// Contract (matches Desktop.tsx): POST FormData{ file } → { success, url }.
//
// AUTH: signed-in Manager+ tenant owner (getManagerTenant) — same guard as the
// prefs route and the desktop page.
//
// Storage: bucket "tenant-assets" (public), path
//   desktop-wallpapers/manager/<clerkId>/<timestamp>.<ext>
// upsert:true so re-uploads don't 409. A stable-ish per-user folder keeps the
// user's wallpapers grouped; we timestamp the filename so the public URL
// changes on each upload (avoids CDN caching the old image).
//
// Limits: images only, 8MB cap. Rejects anything that isn't image/*.
// =============================================================================

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const BUCKET = 'tenant-assets'
const MAX_BYTES = 8 * 1024 * 1024 // 8MB

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

async function requireManagerUserId(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const tenant = await getManagerTenant()
  if (!tenant) return null
  return userId
}

export async function POST(req: NextRequest) {
  const userId = await requireManagerUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  const blob = file as File
  const mime = blob.type || ''
  if (!mime.startsWith('image/') || !EXT_BY_MIME[mime]) {
    return NextResponse.json(
      { success: false, error: 'File must be a JPG, PNG, WEBP, GIF, or AVIF image' },
      { status: 400 }
    )
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Image must be 8MB or smaller' },
      { status: 400 }
    )
  }

  const ext = EXT_BY_MIME[mime]
  const path = `desktop-wallpapers/manager/${userId}/${Date.now()}.${ext}`

  let bytes: ArrayBuffer
  try {
    bytes = await blob.arrayBuffer()
  } catch {
    return NextResponse.json({ success: false, error: 'Could not read file' }, { status: 400 })
  }

  const { error: uploadError } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: '3600',
    })

  if (uploadError) {
    console.error('[manager/desktop-prefs/wallpaper] upload failed:', uploadError)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl
  if (!url) {
    return NextResponse.json({ success: false, error: 'Could not resolve public URL' }, { status: 500 })
  }

  return NextResponse.json({ success: true, url })
}