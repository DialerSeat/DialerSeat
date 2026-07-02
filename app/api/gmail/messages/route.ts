













import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, gmailFetch, GmailAuthError } from '@/lib/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

interface ListResponse {
  messages?: { id: string; threadId: string }[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

interface MetadataResponse {
  id: string
  threadId: string
  snippet?: string
  internalDate?: string
  labelIds?: string[]
  payload?: {
    headers?: { name: string; value: string }[]
  }
}

function getHeader(headers: { name: string; value: string }[] | undefined, name: string): string {
  if (!headers) return ''
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h?.value ?? ''
}

export async function GET(req: NextRequest) {
  try {
    const clerkId = await requireAuth()
    const url = req.nextUrl
    const label = url.searchParams.get('label') ?? 'INBOX'
    const q = url.searchParams.get('q') ?? ''
    const pageToken = url.searchParams.get('pageToken') ?? ''

    
    const listParams = new URLSearchParams({
      maxResults: String(PAGE_SIZE),
      labelIds: label,
    })
    if (q) listParams.set('q', q)
    if (pageToken) listParams.set('pageToken', pageToken)

    const listRes = await gmailFetch(clerkId, `/users/me/messages?${listParams.toString()}`)
    if (!listRes.ok) {
      const body = await listRes.text().catch(() => '')
      return NextResponse.json({ error: 'list_failed', detail: body }, { status: listRes.status })
    }
    const listData = (await listRes.json()) as ListResponse
    const ids = listData.messages?.map((m) => m.id) ?? []

    
    
    
    const metas = await Promise.all(
      ids.map(async (id) => {
        const params = new URLSearchParams({
          format: 'metadata',
        })
        
        ;['From', 'Subject', 'Date', 'To'].forEach((h) =>
          params.append('metadataHeaders', h)
        )
        const r = await gmailFetch(clerkId, `/users/me/messages/${id}?${params.toString()}`)
        if (!r.ok) return null
        return (await r.json()) as MetadataResponse
      })
    )

    const messages = metas
      .filter((m): m is MetadataResponse => m !== null)
      .map((m) => {
        const from = getHeader(m.payload?.headers, 'From')
        const subject = getHeader(m.payload?.headers, 'Subject')
        const date = m.internalDate ? new Date(parseInt(m.internalDate, 10)).toISOString() : ''
        const labels = m.labelIds ?? []
        return {
          id: m.id,
          threadId: m.threadId,
          from,
          subject,
          snippet: m.snippet ?? '',
          date,
          unread: labels.includes('UNREAD'),
          starred: labels.includes('STARRED'),
          labels,
        }
      })

    return NextResponse.json({
      messages,
      nextPageToken: listData.nextPageToken ?? null,
      resultSizeEstimate: listData.resultSizeEstimate ?? messages.length,
    })
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json({ error: err.reason }, { status: 401 })
    }
    console.error('[gmail/messages] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}