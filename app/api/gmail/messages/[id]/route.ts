// app/api/gmail/messages/[id]/route.ts
// =============================================================================
// GET   /api/gmail/messages/:id  → full message with body
// PATCH /api/gmail/messages/:id  → modify labels (mark read, trash, archive, star)
//
// The PATCH body accepts:
//   { addLabelIds?: string[], removeLabelIds?: string[] }
// or convenience flags the UI can use:
//   { markRead?: boolean, markUnread?: boolean,
//     star?: boolean, unstar?: boolean,
//     trash?: boolean, untrash?: boolean,
//     archive?: boolean }
// These get translated to the appropriate label add/remove arrays.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, gmailFetch, GmailAuthError } from '@/lib/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface MessagePart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: { name: string; value: string }[]
  body?: { size?: number; data?: string; attachmentId?: string }
  parts?: MessagePart[]
}

interface FullMessage {
  id: string
  threadId: string
  snippet?: string
  internalDate?: string
  labelIds?: string[]
  payload?: MessagePart
}

function getHeader(headers: { name: string; value: string }[] | undefined, name: string): string {
  if (!headers) return ''
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h?.value ?? ''
}

// Walks the MIME tree picking the best body to display.
// Preference: text/html > text/plain. Returns { html, text } so the UI
// can decide which to render.
function extractBody(payload?: MessagePart): { html: string; text: string } {
  const out = { html: '', text: '' }
  if (!payload) return out

  function walk(node: MessagePart) {
    const mime = node.mimeType ?? ''
    if (mime === 'text/html' && node.body?.data) {
      out.html = decodeBase64Url(node.body.data)
    } else if (mime === 'text/plain' && node.body?.data) {
      // Don't overwrite html if we have one; just hold onto text.
      out.text = decodeBase64Url(node.body.data)
    }
    if (node.parts) {
      for (const child of node.parts) walk(child)
    }
  }
  walk(payload)
  return out
}

function decodeBase64Url(data: string): string {
  // Gmail uses URL-safe base64 with possible missing padding.
  const padded = data.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  try {
    return Buffer.from(padded + pad, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireAuth()
    const { id } = await ctx.params
    if (!id) {
      return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    }

    const r = await gmailFetch(clerkId, `/users/me/messages/${id}?format=full`)
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      return NextResponse.json({ error: 'fetch_failed', detail: body }, { status: r.status })
    }
    const data = (await r.json()) as FullMessage

    const headers = data.payload?.headers ?? []
    const body = extractBody(data.payload)
    const labels = data.labelIds ?? []

    return NextResponse.json({
      id: data.id,
      threadId: data.threadId,
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      cc: getHeader(headers, 'Cc'),
      subject: getHeader(headers, 'Subject'),
      date: data.internalDate ? new Date(parseInt(data.internalDate, 10)).toISOString() : '',
      snippet: data.snippet ?? '',
      bodyHtml: body.html,
      bodyText: body.text,
      labels,
      unread: labels.includes('UNREAD'),
      starred: labels.includes('STARRED'),
    })
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json({ error: err.reason }, { status: 401 })
    }
    console.error('[gmail/messages/:id GET] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

interface PatchBody {
  addLabelIds?: string[]
  removeLabelIds?: string[]
  markRead?: boolean
  markUnread?: boolean
  star?: boolean
  unstar?: boolean
  trash?: boolean
  untrash?: boolean
  archive?: boolean
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await requireAuth()
    const { id } = await ctx.params
    if (!id) {
      return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    }
    const body = (await req.json().catch(() => ({}))) as PatchBody

    const add = new Set<string>(body.addLabelIds ?? [])
    const remove = new Set<string>(body.removeLabelIds ?? [])
    if (body.markRead) remove.add('UNREAD')
    if (body.markUnread) add.add('UNREAD')
    if (body.star) add.add('STARRED')
    if (body.unstar) remove.add('STARRED')
    if (body.archive) remove.add('INBOX')

    // Trash/untrash use dedicated endpoints, not label modify.
    if (body.trash) {
      const r = await gmailFetch(clerkId, `/users/me/messages/${id}/trash`, { method: 'POST' })
      if (!r.ok) {
        const detail = await r.text().catch(() => '')
        return NextResponse.json({ error: 'trash_failed', detail }, { status: r.status })
      }
      return NextResponse.json({ ok: true })
    }
    if (body.untrash) {
      const r = await gmailFetch(clerkId, `/users/me/messages/${id}/untrash`, { method: 'POST' })
      if (!r.ok) {
        const detail = await r.text().catch(() => '')
        return NextResponse.json({ error: 'untrash_failed', detail }, { status: r.status })
      }
      return NextResponse.json({ ok: true })
    }

    if (add.size === 0 && remove.size === 0) {
      return NextResponse.json({ ok: true, noop: true })
    }

    const r = await gmailFetch(clerkId, `/users/me/messages/${id}/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addLabelIds: Array.from(add),
        removeLabelIds: Array.from(remove),
      }),
    })
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      return NextResponse.json({ error: 'modify_failed', detail }, { status: r.status })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json({ error: err.reason }, { status: 401 })
    }
    console.error('[gmail/messages/:id PATCH] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}