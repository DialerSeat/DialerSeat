






import { NextResponse } from 'next/server'
import { requireAuth, gmailFetch, GmailAuthError } from '@/lib/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Label {
  id: string
  name: string
  type: 'system' | 'user'
  messagesUnread?: number
  messagesTotal?: number
}

interface LabelsResponse {
  labels?: Label[]
}

export async function GET() {
  try {
    const clerkId = await requireAuth()
    const r = await gmailFetch(clerkId, '/users/me/labels')
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      return NextResponse.json({ error: 'list_failed', detail }, { status: r.status })
    }
    const data = (await r.json()) as LabelsResponse
    const labels = data.labels ?? []

    
    
    const PINNED = ['INBOX', 'STARRED', 'SENT', 'DRAFT', 'IMPORTANT', 'SPAM', 'TRASH']
    const pinned = PINNED.map((id) => labels.find((l) => l.id === id)).filter(
      (l): l is Label => !!l
    )
    const otherSystem = labels
      .filter((l) => l.type === 'system' && !PINNED.includes(l.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    const user = labels
      .filter((l) => l.type === 'user')
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      labels: [...pinned, ...otherSystem, ...user],
    })
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json({ error: err.reason }, { status: 401 })
    }
    console.error('[gmail/labels] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}