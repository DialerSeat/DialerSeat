import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('voicemail-messages')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/voicemail-messages — the user's own voicemail drop recordings
// =============================================================================
// When AMD detects a machine, the agent's leg is released immediately (exactly
// as today) and the LEAD's leg stays up to play one of these, then hangs up.
//
// The message is always the USER'S. FCC rules require a prerecorded
// telemarketing message to identify the business and give a callback number, so
// a generic "someone tried to call you" recording carries MORE exposure than a
// real one, not less. That is why this is a library of named, user-recorded
// messages rather than a system-generated clip.
// =============================================================================

const BUCKET = 'voicemail-messages'

/**
 * Per-user ceiling. Not a licensing lever — it stops one account filling the
 * bucket, and twenty distinct messages is already far more than anyone
 * maintains. The cap is enforced here rather than in the database because the
 * upload has to be rejected before the audio is written to storage, otherwise
 * a refused row leaves an orphaned file behind.
 */
const MAX_MESSAGES_PER_USER = 20

const MAX_BYTES = 10 * 1024 * 1024

// Extension by mime, so a file recorded in the browser (webm/mp4 depending on
// the platform) and a file uploaded from a desktop both land with something
// Telnyx will play.
const EXT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
}

export async function GET() {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response

    const { data, error } = await supabase
      .from('voicemail_messages')
      .select('id, name, audio_url, duration_seconds, created_at')
      .eq('user_id', gate.userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      messages: data ?? [],
      max: MAX_MESSAGES_PER_USER,
      remaining: Math.max(0, MAX_MESSAGES_PER_USER - (data?.length ?? 0)),
    })
  } catch (err) {
    return apiError(err, { route: 'voicemail-messages:GET' })
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response
    const userId = gate.userId

    const form = await req.formData()
    const file = form.get('file')
    const rawName = form.get('name')
    const durationRaw = form.get('duration_seconds')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No audio file was included.' },
        { status: 400 }
      )
    }

    const name = typeof rawName === 'string' && rawName.trim()
      ? rawName.trim().slice(0, 80)
      : `Voicemail ${new Date().toLocaleDateString('en-US')}`

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'That recording is empty. Try recording again.' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'That file is over 10MB. A voicemail message should be a few seconds long.' },
        { status: 400 }
      )
    }

    // Browsers append codec parameters — "audio/webm;codecs=opus" — which never
    // match a bare mime lookup. Compare on the type alone.
    const mime = (file.type || '').split(';')[0].trim().toLowerCase()
    const ext = EXT_BY_MIME[mime]
    if (!ext) {
      return NextResponse.json(
        { success: false, error: `That file type (${mime || 'unknown'}) isn't supported. Use MP3, WAV, M4A or record in the browser.` },
        { status: 400 }
      )
    }

    // Checked BEFORE the upload: a rejection after writing would leave an
    // orphaned object in the bucket that nothing ever cleans up.
    const { count, error: countErr } = await supabase
      .from('voicemail_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (countErr) throw countErr

    if ((count ?? 0) >= MAX_MESSAGES_PER_USER) {
      return NextResponse.json(
        {
          success: false,
          error: `You've saved the maximum of ${MAX_MESSAGES_PER_USER} voicemail messages. Delete one to record another.`,
        },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    // The uuid is the whole reason a public bucket is acceptable here: Telnyx
    // fetches this URL itself during a call, so it cannot be signed or expiring,
    // and an unguessable path is what keeps it private in practice.
    const path = `${userId}/${id}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: mime, cacheControl: '3600', upsert: false })

    if (upErr) {
      console.error('[voicemail-messages] upload failed:', upErr)
      return NextResponse.json(
        { success: false, error: 'Upload failed. Try again.' },
        { status: 500 }
      )
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const duration =
      typeof durationRaw === 'string' && Number.isFinite(Number(durationRaw))
        ? Math.max(0, Math.round(Number(durationRaw)))
        : null

    const { data: row, error: insErr } = await supabase
      .from('voicemail_messages')
      .insert({
        id,
        user_id: userId,
        name,
        audio_url: pub.publicUrl,
        storage_path: path,
        duration_seconds: duration,
      })
      .select('id, name, audio_url, duration_seconds, created_at')
      .single()

    if (insErr) {
      // Roll the file back rather than leaving audio with no row pointing at
      // it — nothing else would ever find it to clean up.
      await supabase.storage.from(BUCKET).remove([path])
      throw insErr
    }

    return NextResponse.json({ success: true, message: row })
  } catch (err) {
    return apiError(err, { route: 'voicemail-messages:POST' })
  }
}

/**
 * Rename a saved message.
 *
 * The name chosen while recording is a guess at what the message will be used
 * for. Without this the campaign picker fills with "Voicemail 3" and nobody
 * can tell which is which — the only way to relabel would be to delete the
 * audio and record it again.
 */
export async function PATCH(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : null
    const rawName = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!id) {
      return NextResponse.json({ success: false, error: 'No id given' }, { status: 400 })
    }
    if (!rawName) {
      return NextResponse.json(
        { success: false, error: 'A voicemail needs a name so you can find it in the campaign picker.' },
        { status: 400 }
      )
    }

    // Scoped to the caller, so an id from another account cannot be renamed.
    const { data, error } = await supabase
      .from('voicemail_messages')
      .update({ name: rawName.slice(0, 80), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', gate.userId)
      .select('id, name')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: data })
  } catch (err) {
    return apiError(err, { route: 'voicemail-messages:PATCH' })
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id) {
      return NextResponse.json({ success: false, error: 'No id given' }, { status: 400 })
    }

    // Scoped to the caller so an id from another account cannot be deleted.
    const { data: row, error: findErr } = await supabase
      .from('voicemail_messages')
      .select('id, storage_path')
      .eq('id', id)
      .eq('user_id', gate.userId)
      .maybeSingle()
    if (findErr) throw findErr
    if (!row) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    // Row first. campaigns.voicemail_message_id is ON DELETE SET NULL, so any
    // campaign using this message quietly stops dropping voicemail rather than
    // dialing against a file that no longer exists.
    const { error: delErr } = await supabase
      .from('voicemail_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', gate.userId)
    if (delErr) throw delErr

    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.storage_path])
    if (rmErr) {
      // Not fatal: the row is gone so nothing can dial it. Logged because an
      // accumulating orphan is worth knowing about.
      console.warn('[voicemail-messages] row deleted but storage remove failed:', rmErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(err, { route: 'voicemail-messages:DELETE' })
  }
}
