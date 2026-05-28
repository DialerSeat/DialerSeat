// app/api/gmail/send/route.ts
// =============================================================================
// POST /api/gmail/send
// Body: { to: string, cc?: string, bcc?: string, subject: string,
//         body: string, isHtml?: boolean,
//         replyToMessageId?: string, threadId?: string }
//
// Builds a minimal RFC 2822 message and submits it to /users/me/messages/send.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, gmailFetch, getStoredTokens, GmailAuthError } from '@/lib/gmail'

export const runtime = 'nodejs'

interface SendBody {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  isHtml?: boolean
  replyToMessageId?: string  // for In-Reply-To/References headers
  threadId?: string          // ties the send into an existing Gmail thread
}

function encodeBase64Url(s: string): string {
  return Buffer.from(s, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Build a minimal RFC 2822 message. For HTML we use a multipart/alternative
// with both a plain-text fallback (stripped tags) and HTML body so recipients
// without HTML support still see something readable.
function buildRawMessage(args: {
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  isHtml: boolean
  replyToMessageId?: string
}): string {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
  const headers: string[] = [
    `From: ${args.from}`,
    `To: ${args.to}`,
  ]
  if (args.cc) headers.push(`Cc: ${args.cc}`)
  if (args.bcc) headers.push(`Bcc: ${args.bcc}`)
  headers.push(`Subject: ${encodeHeaderValue(args.subject)}`)
  headers.push('MIME-Version: 1.0')
  if (args.replyToMessageId) {
    headers.push(`In-Reply-To: ${args.replyToMessageId}`)
    headers.push(`References: ${args.replyToMessageId}`)
  }

  if (!args.isHtml) {
    headers.push('Content-Type: text/plain; charset="UTF-8"')
    return `${headers.join('\r\n')}\r\n\r\n${args.body}`
  }

  // multipart/alternative
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
  const plainFallback = stripHtmlToPlain(args.body)
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    plainFallback,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    args.body,
    `--${boundary}--`,
  ]
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`
}

// If the subject contains non-ASCII chars, encode it. Simple RFC 2047
// encoding — works for any unicode subject without picking a charset war.
function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value
  const b64 = Buffer.from(value, 'utf-8').toString('base64')
  return `=?UTF-8?B?${b64}?=`
}

function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

export async function POST(req: NextRequest) {
  try {
    const clerkId = await requireAuth()
    const data = (await req.json().catch(() => ({}))) as SendBody

    if (!data.to || !data.subject || !data.body) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 })
    }

    const row = await getStoredTokens(clerkId)
    if (!row) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 })
    }

    const raw = buildRawMessage({
      from: row.email,
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      subject: data.subject,
      body: data.body,
      isHtml: !!data.isHtml,
      replyToMessageId: data.replyToMessageId,
    })

    const payload: { raw: string; threadId?: string } = { raw: encodeBase64Url(raw) }
    if (data.threadId) payload.threadId = data.threadId

    const r = await gmailFetch(clerkId, '/users/me/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      return NextResponse.json({ error: 'send_failed', detail }, { status: r.status })
    }
    const result = (await r.json()) as { id: string; threadId: string }
    return NextResponse.json({ ok: true, id: result.id, threadId: result.threadId })
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json({ error: err.reason }, { status: 401 })
    }
    console.error('[gmail/send] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}