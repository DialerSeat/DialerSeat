'use client'

// =============================================================================
// GMAIL APP — three-pane mail client embedded in the admin desktop
// =============================================================================
// Layout:
//   Left:   labels/folders (INBOX, STARRED, SENT, DRAFT, custom labels)
//   Middle: message list for selected label, with search box
//   Right:  message detail (sender, subject, body), with reply/star/trash/archive
//
// State flows:
//   On mount → GET /api/gmail/status. If not connected, show big Connect button.
//   If connected → fetch labels + messages.
//   Click message → fetch full body, mark as read.
//   Compose → modal with to/subject/body inputs → POST /api/gmail/send.
//
// The app is wrapped by AppWindow (the Win7 frame), so we render only the
// inside. We own our own scroll containers — AppWindow's body wrapper is
// overflow:hidden per the v22.d contract.
// =============================================================================

import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'

interface Label {
  id: string
  name: string
  type: 'system' | 'user'
  messagesUnread?: number
}

interface MessageListItem {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  date: string
  unread: boolean
  starred: boolean
  labels: string[]
}

interface MessageFull {
  id: string
  threadId: string
  from: string
  to: string
  cc: string
  subject: string
  date: string
  snippet: string
  bodyHtml: string
  bodyText: string
  labels: string[]
  unread: boolean
  starred: boolean
}

// Friendly display names for system labels.
const LABEL_DISPLAY: Record<string, string> = {
  INBOX: 'Inbox',
  STARRED: 'Starred',
  SENT: 'Sent',
  DRAFT: 'Drafts',
  IMPORTANT: 'Important',
  SPAM: 'Spam',
  TRASH: 'Trash',
  CATEGORY_PERSONAL: 'Personal',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_UPDATES: 'Updates',
  CATEGORY_FORUMS: 'Forums',
}

function displayLabelName(l: Label): string {
  return LABEL_DISPLAY[l.id] ?? l.name
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

// Parses "Name <email@example.com>" into { name, email } for cleaner display.
function parseAddress(raw: string): { name: string; email: string } {
  if (!raw) return { name: '', email: '' }
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim(), email: m[2].trim() }
  return { name: '', email: raw.trim() }
}

export default function GmailApp() {
  const [status, setStatus] = useState<'loading' | 'disconnected' | 'connected' | 'error'>('loading')
  const [statusError, setStatusError] = useState<string>('')
  const [accountEmail, setAccountEmail] = useState<string>('')

  const [labels, setLabels] = useState<Label[]>([])
  const [selectedLabelId, setSelectedLabelId] = useState<string>('INBOX')
  const [messages, setMessages] = useState<MessageListItem[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string>('')
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [query, setQuery] = useState<string>('')
  const [queryInput, setQueryInput] = useState<string>('')

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<MessageFull | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string>('')

  const [composeOpen, setComposeOpen] = useState<false | 'new' | 'reply'>(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeReplyTo, setComposeReplyTo] = useState<{ messageId: string; threadId: string } | null>(null)
  const [composeSending, setComposeSending] = useState(false)
  const [composeError, setComposeError] = useState<string>('')

  const [isMobile, setIsMobile] = useState(false)
  // On mobile we use 2 visible panes max: list or detail (toggle).
  const [mobileView, setMobileView] = useState<'labels' | 'list' | 'detail'>('list')

  // ----- effects -----

  // Detect mobile.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const probe = () => setIsMobile(window.innerWidth < 760)
    probe()
    window.addEventListener('resize', probe)
    return () => window.removeEventListener('resize', probe)
  }, [])

  // On mount + after connect: status check.
  const refreshStatus = useCallback(async () => {
    setStatus('loading')
    try {
      const r = await fetch('/api/gmail/status', { cache: 'no-store' })
      const data = await r.json()
      if (data.connected) {
        setAccountEmail(data.email ?? '')
        setStatus('connected')
      } else {
        setStatus('disconnected')
      }
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  // Handle ?gmail=connected/error/denied returns from OAuth callback.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('gmail')
    if (!flag) return
    if (flag === 'connected') {
      refreshStatus()
    }
    // Clear the query so it doesn't trigger again on refresh.
    params.delete('gmail')
    params.delete('detail')
    const newSearch = params.toString()
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
    window.history.replaceState({}, '', newUrl)
  }, [refreshStatus])

  // Fetch labels once connected.
  useEffect(() => {
    if (status !== 'connected') return
    ;(async () => {
      try {
        const r = await fetch('/api/gmail/labels', { cache: 'no-store' })
        if (!r.ok) return
        const data = await r.json()
        setLabels(data.labels ?? [])
      } catch (e) {
        console.warn('[gmail] labels fetch failed', e)
      }
    })()
  }, [status])

  // Fetch messages when label or query changes.
  const loadMessages = useCallback(
    async (label: string, q: string, pageToken: string | null) => {
      setMessagesLoading(true)
      setMessagesError('')
      try {
        const params = new URLSearchParams({ label })
        if (q) params.set('q', q)
        if (pageToken) params.set('pageToken', pageToken)
        const r = await fetch(`/api/gmail/messages?${params.toString()}`, { cache: 'no-store' })
        const data = await r.json()
        if (!r.ok) {
          setMessagesError(data.detail || data.error || `HTTP ${r.status}`)
          if (pageToken == null) setMessages([])
          return
        }
        if (pageToken == null) {
          setMessages(data.messages ?? [])
        } else {
          setMessages((prev) => [...prev, ...(data.messages ?? [])])
        }
        setNextPageToken(data.nextPageToken ?? null)
      } catch (e) {
        setMessagesError(e instanceof Error ? e.message : String(e))
      } finally {
        setMessagesLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (status !== 'connected') return
    setSelectedMessageId(null)
    setSelectedMessage(null)
    loadMessages(selectedLabelId, query, null)
  }, [status, selectedLabelId, query, loadMessages])

  // Fetch full message when one is selected.
  useEffect(() => {
    if (!selectedMessageId) {
      setSelectedMessage(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError('')
    ;(async () => {
      try {
        const r = await fetch(`/api/gmail/messages/${selectedMessageId}`, { cache: 'no-store' })
        const data = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setDetailError(data.detail || data.error || `HTTP ${r.status}`)
          setSelectedMessage(null)
          return
        }
        setSelectedMessage(data)
        // Auto-mark-as-read if it was unread.
        if (data.unread) {
          fetch(`/api/gmail/messages/${selectedMessageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markRead: true }),
          }).then(() => {
            setMessages((prev) =>
              prev.map((m) => (m.id === selectedMessageId ? { ...m, unread: false } : m))
            )
          })
        }
      } catch (e) {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedMessageId])

  // ----- actions -----

  const connect = () => {
    window.location.href = '/api/gmail/auth'
  }

  const disconnect = async () => {
    if (!confirm('Disconnect Gmail? You can reconnect anytime.')) return
    try {
      await fetch('/api/gmail/disconnect', { method: 'POST' })
      setStatus('disconnected')
      setAccountEmail('')
      setMessages([])
      setLabels([])
      setSelectedMessage(null)
      setSelectedMessageId(null)
    } catch (e) {
      alert('Disconnect failed: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const runSearch = () => {
    setQuery(queryInput.trim())
  }

  const clearSearch = () => {
    setQueryInput('')
    setQuery('')
  }

  const openCompose = (kind: 'new' | 'reply') => {
    setComposeError('')
    if (kind === 'reply' && selectedMessage) {
      const fromAddr = parseAddress(selectedMessage.from)
      setComposeTo(fromAddr.email || fromAddr.name)
      const subj = selectedMessage.subject ?? ''
      setComposeSubject(subj.toLowerCase().startsWith('re:') ? subj : `Re: ${subj}`)
      setComposeBody(
        `\n\n\nOn ${new Date(selectedMessage.date).toLocaleString()}, ${selectedMessage.from} wrote:\n${selectedMessage.bodyText.split('\n').map((l) => `> ${l}`).join('\n')}`
      )
      setComposeReplyTo({ messageId: selectedMessage.id, threadId: selectedMessage.threadId })
    } else {
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setComposeReplyTo(null)
    }
    setComposeOpen(kind)
  }

  const sendCompose = async () => {
    setComposeSending(true)
    setComposeError('')
    try {
      const r = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          replyToMessageId: composeReplyTo?.messageId,
          threadId: composeReplyTo?.threadId,
        }),
      })
      const data = await r.json()
      if (!r.ok) {
        setComposeError(data.detail || data.error || `HTTP ${r.status}`)
        return
      }
      setComposeOpen(false)
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setComposeReplyTo(null)
      // Refresh current list to show sent message if we're in SENT.
      loadMessages(selectedLabelId, query, null)
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : String(e))
    } finally {
      setComposeSending(false)
    }
  }

  const modifyMessage = async (
    patch: { markRead?: boolean; markUnread?: boolean; star?: boolean; unstar?: boolean; trash?: boolean; archive?: boolean }
  ) => {
    if (!selectedMessage) return
    const id = selectedMessage.id
    try {
      const r = await fetch(`/api/gmail/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!r.ok) return
      // Optimistic local updates.
      if (patch.star) {
        setSelectedMessage((p) => (p ? { ...p, starred: true } : p))
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, starred: true } : m)))
      }
      if (patch.unstar) {
        setSelectedMessage((p) => (p ? { ...p, starred: false } : p))
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, starred: false } : m)))
      }
      if (patch.markUnread) {
        setSelectedMessage((p) => (p ? { ...p, unread: true } : p))
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: true } : m)))
      }
      if (patch.trash || patch.archive) {
        // Remove from current list.
        setMessages((prev) => prev.filter((m) => m.id !== id))
        setSelectedMessage(null)
        setSelectedMessageId(null)
        if (isMobile) setMobileView('list')
      }
    } catch (e) {
      console.warn('[gmail] modify failed', e)
    }
  }

  // ----- render -----

  if (status === 'loading') {
    return (
      <div style={loadingShellStyle}>
        <div style={{ fontSize: 14, color: '#666' }}>Loading Gmail…</div>
      </div>
    )
  }

  if (status === 'disconnected') {
    return (
      <div style={loadingShellStyle}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉</div>
          <h2 style={{ fontSize: 18, marginBottom: 8, color: '#222', fontWeight: 600 }}>
            Connect your Gmail
          </h2>
          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 20 }}>
            DialerSeat will request read, send, and label-modify permissions for the Gmail
            account you authorize. Tokens are stored encrypted in your account and used only
            to power this Gmail app. Disconnect anytime.
          </p>
          <button onClick={connect} style={primaryButtonStyle}>
            Connect Gmail
          </button>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={loadingShellStyle}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h2 style={{ fontSize: 16, color: '#c44', marginBottom: 8 }}>
            Couldn’t load Gmail status
          </h2>
          <code style={errorBoxStyle}>{statusError}</code>
          <button onClick={refreshStatus} style={{ ...primaryButtonStyle, marginTop: 16 }}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ----- connected: render three-pane layout -----

  const labelsPane = (
    <div style={labelsPaneStyle}>
      <div style={accountHeaderStyle}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Signed in as</div>
        <div style={{ fontSize: 12, color: '#222', wordBreak: 'break-all', fontWeight: 500 }}>
          {accountEmail}
        </div>
        <button onClick={disconnect} style={linkButtonStyle}>Disconnect</button>
      </div>
      <button onClick={() => openCompose('new')} style={composeButtonStyle}>
        ✎  Compose
      </button>
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {labels.map((l) => {
          const isSelected = l.id === selectedLabelId
          const unreadCount = l.messagesUnread ?? 0
          return (
            <button
              key={l.id}
              onClick={() => {
                setSelectedLabelId(l.id)
                if (isMobile) setMobileView('list')
              }}
              style={{
                ...labelButtonStyle,
                background: isSelected ? '#e8f0fe' : 'transparent',
                color: isSelected ? '#1a73e8' : '#333',
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>{displayLabelName(l)}</span>
              {unreadCount > 0 && (
                <span style={{ fontSize: 11, color: isSelected ? '#1a73e8' : '#888' }}>
                  {unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  const listPane = (
    <div style={listPaneStyle}>
      <div style={searchBarStyle}>
        <input
          type="text"
          placeholder="Search mail"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch()
            if (e.key === 'Escape') clearSearch()
          }}
          style={searchInputStyle}
        />
        {query && (
          <button onClick={clearSearch} style={searchClearStyle} aria-label="Clear search">
            ✕
          </button>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileView('labels')}
            style={{ ...iconButtonStyle, marginLeft: 8 }}
            aria-label="Labels"
          >
            ☰
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        {messagesLoading && messages.length === 0 && (
          <div style={emptyStateStyle}>Loading messages…</div>
        )}
        {!messagesLoading && messages.length === 0 && !messagesError && (
          <div style={emptyStateStyle}>No messages</div>
        )}
        {messagesError && (
          <div style={{ ...emptyStateStyle, color: '#c44' }}>
            Error: <code style={{ fontSize: 11 }}>{messagesError}</code>
          </div>
        )}
        {messages.map((m) => {
          const fromAddr = parseAddress(m.from)
          const isSelected = selectedMessageId === m.id
          return (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMessageId(m.id)
                if (isMobile) setMobileView('detail')
              }}
              style={{
                ...messageRowStyle,
                background: isSelected ? '#e8f0fe' : m.unread ? '#fff' : '#fafafa',
                fontWeight: m.unread ? 600 : 400,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, color: '#222', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fromAddr.name || fromAddr.email}
                </span>
                <span style={{ fontSize: 11, color: '#888', marginLeft: 8, flexShrink: 0 }}>
                  {formatDate(m.date)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                {m.starred && <span style={{ color: '#f5b400', marginRight: 4 }}>★</span>}
                {m.subject || '(no subject)'}
              </div>
              <div style={{ fontSize: 11, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, fontWeight: 400 }}>
                {m.snippet}
              </div>
            </button>
          )
        })}
        {nextPageToken && !messagesLoading && (
          <button
            onClick={() => loadMessages(selectedLabelId, query, nextPageToken)}
            style={loadMoreButtonStyle}
          >
            Load more
          </button>
        )}
        {messagesLoading && messages.length > 0 && (
          <div style={emptyStateStyle}>Loading more…</div>
        )}
      </div>
    </div>
  )

  const detailPane = (
    <div style={detailPaneStyle}>
      {!selectedMessage && !detailLoading && (
        <div style={detailEmptyStyle}>
          {isMobile && (
            <button
              onClick={() => setMobileView('list')}
              style={{ ...iconButtonStyle, position: 'absolute', top: 12, left: 12 }}
            >
              ← Back
            </button>
          )}
          <div style={{ color: '#888', fontSize: 13 }}>Select a message</div>
        </div>
      )}
      {detailLoading && <div style={detailEmptyStyle}>Loading…</div>}
      {detailError && (
        <div style={{ ...detailEmptyStyle, color: '#c44' }}>
          Error: <code style={{ fontSize: 11 }}>{detailError}</code>
        </div>
      )}
      {selectedMessage && (
        <>
          <div style={detailHeaderStyle}>
            {isMobile && (
              <button
                onClick={() => setMobileView('list')}
                style={{ ...iconButtonStyle, marginBottom: 8 }}
              >
                ← Back
              </button>
            )}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <button onClick={() => openCompose('reply')} style={actionButtonStyle}>
                Reply
              </button>
              <button
                onClick={() =>
                  modifyMessage(selectedMessage.starred ? { unstar: true } : { star: true })
                }
                style={{
                  ...actionButtonStyle,
                  color: selectedMessage.starred ? '#f5b400' : '#333',
                }}
              >
                {selectedMessage.starred ? '★ Starred' : '☆ Star'}
              </button>
              <button onClick={() => modifyMessage({ markUnread: true })} style={actionButtonStyle}>
                Mark unread
              </button>
              <button onClick={() => modifyMessage({ archive: true })} style={actionButtonStyle}>
                Archive
              </button>
              <button
                onClick={() => {
                  if (confirm('Move to Trash?')) modifyMessage({ trash: true })
                }}
                style={{ ...actionButtonStyle, color: '#c44' }}
              >
                Trash
              </button>
            </div>
            <h2 style={{ fontSize: 16, margin: '0 0 8px 0', color: '#222', fontWeight: 600 }}>
              {selectedMessage.subject || '(no subject)'}
            </h2>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
              <div><b>From:</b> {selectedMessage.from}</div>
              <div><b>To:</b> {selectedMessage.to}</div>
              {selectedMessage.cc && <div><b>Cc:</b> {selectedMessage.cc}</div>}
              <div><b>Date:</b> {new Date(selectedMessage.date).toLocaleString()}</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 16, WebkitOverflowScrolling: 'touch' }}>
            {selectedMessage.bodyHtml ? (
              <iframe
                srcDoc={selectedMessage.bodyHtml}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                style={{ width: '100%', minHeight: 400, border: 'none', background: '#fff' }}
                title="Message body"
              />
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: '#222', margin: 0 }}>
                {selectedMessage.bodyText || selectedMessage.snippet}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  )

  // ----- compose modal -----
  const composeModal = composeOpen && (
    <div style={composeBackdropStyle} onClick={() => !composeSending && setComposeOpen(false)}>
      <div style={composeModalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={composeHeaderStyle}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {composeOpen === 'reply' ? 'Reply' : 'New message'}
          </span>
          <button onClick={() => setComposeOpen(false)} style={composeCloseStyle}>✕</button>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
          <input
            type="text"
            placeholder="To"
            value={composeTo}
            onChange={(e) => setComposeTo(e.target.value)}
            style={composeInputStyle}
            disabled={composeSending}
          />
          <input
            type="text"
            placeholder="Subject"
            value={composeSubject}
            onChange={(e) => setComposeSubject(e.target.value)}
            style={composeInputStyle}
            disabled={composeSending}
          />
          <textarea
            placeholder="Write your message…"
            value={composeBody}
            onChange={(e) => setComposeBody(e.target.value)}
            style={composeTextareaStyle}
            disabled={composeSending}
          />
          {composeError && (
            <div style={{ fontSize: 12, color: '#c44' }}>{composeError}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => setComposeOpen(false)}
              style={secondaryButtonStyle}
              disabled={composeSending}
            >
              Cancel
            </button>
            <button onClick={sendCompose} style={primaryButtonStyle} disabled={composeSending}>
              {composeSending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={shellStyle}>
      {isMobile ? (
        <>
          {mobileView === 'labels' && labelsPane}
          {mobileView === 'list' && listPane}
          {mobileView === 'detail' && detailPane}
        </>
      ) : (
        <>
          {labelsPane}
          {listPane}
          {detailPane}
        </>
      )}
      {composeModal}
    </div>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const shellStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'row',
  background: '#f5f5f5',
  fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
  color: '#222',
  overflow: 'hidden',
}

const loadingShellStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
}

const labelsPaneStyle: CSSProperties = {
  width: 200,
  flexShrink: 0,
  background: '#f6f8fa',
  borderRight: '1px solid #d0d4d8',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
}

const accountHeaderStyle: CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #e5e8eb',
  background: '#fff',
}

const composeButtonStyle: CSSProperties = {
  margin: '10px 12px',
  padding: '10px 14px',
  background: '#1a73e8',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
}

const labelButtonStyle: CSSProperties = {
  width: '100%',
  padding: '8px 14px',
  background: 'transparent',
  border: 'none',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const listPaneStyle: CSSProperties = {
  width: 340,
  flexShrink: 0,
  background: '#fff',
  borderRight: '1px solid #d0d4d8',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: 'initial',
}

const searchBarStyle: CSSProperties = {
  padding: 10,
  borderBottom: '1px solid #e5e8eb',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: '#fafafa',
}

const searchInputStyle: CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  border: '1px solid #d0d4d8',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#fff',
  outline: 'none',
}

const searchClearStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: 14,
  cursor: 'pointer',
  color: '#888',
  padding: '4px 8px',
}

const messageRowStyle: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#fff',
  border: 'none',
  borderBottom: '1px solid #eef0f3',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  display: 'block',
}

const detailPaneStyle: CSSProperties = {
  flex: 1,
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  position: 'relative',
}

const detailHeaderStyle: CSSProperties = {
  padding: 16,
  borderBottom: '1px solid #e5e8eb',
}

const detailEmptyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#888',
  fontSize: 13,
  padding: 24,
}

const emptyStateStyle: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: '#888',
  fontSize: 13,
}

const loadMoreButtonStyle: CSSProperties = {
  width: '100%',
  padding: 12,
  background: 'transparent',
  border: 'none',
  borderTop: '1px solid #eef0f3',
  fontSize: 12,
  color: '#1a73e8',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const primaryButtonStyle: CSSProperties = {
  padding: '8px 16px',
  background: '#1a73e8',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const secondaryButtonStyle: CSSProperties = {
  padding: '8px 16px',
  background: '#fff',
  color: '#333',
  border: '1px solid #d0d4d8',
  borderRadius: 6,
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const linkButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#1a73e8',
  fontSize: 11,
  cursor: 'pointer',
  padding: 0,
  marginTop: 4,
  fontFamily: 'inherit',
}

const iconButtonStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #d0d4d8',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#333',
}

const actionButtonStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #d0d4d8',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#333',
}

const errorBoxStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  background: '#fef1f1',
  padding: 8,
  borderRadius: 4,
  color: '#c44',
  wordBreak: 'break-all',
}

const composeBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: 16,
}

const composeModalStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  width: '100%',
  maxWidth: 560,
  maxHeight: '90%',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
}

const composeHeaderStyle: CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid #e5e8eb',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: '#f6f8fa',
  borderTopLeftRadius: 8,
  borderTopRightRadius: 8,
}

const composeCloseStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: 16,
  cursor: 'pointer',
  color: '#666',
  padding: 4,
}

const composeInputStyle: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #d0d4d8',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
}

const composeTextareaStyle: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #d0d4d8',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  flex: 1,
  minHeight: 200,
  resize: 'vertical',
}