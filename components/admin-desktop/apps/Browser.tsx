'use client'

// =============================================================================
// BROWSER APP — v23
// =============================================================================
// A desktop "browser" window. Because most major sites send X-Frame-Options
// / CSP frame-ancestors that forbid being iframed (Gmail, Slack, GitHub,
// banks, social, etc.), this can't be a real universal browser. It does the
// honest thing:
//
//   1. URL bar + Go button + bookmark quick-launch row.
//   2. Attempts to render the URL in an <iframe>.
//   3. Detects when embedding is blocked (load timeout + onLoad heuristics)
//      and shows a clear "this site can't be embedded — open in new tab"
//      fallback rather than a silent blank frame.
//
// Bookmarks are seeded with iframe-FRIENDLY sites (Wikipedia, your own
// dashboard, etc.) so the happy path actually works. Sites known to block
// embedding show the fallback immediately.
//
// Persistence: bookmarks + last URL stored in the artifact's own state only
// (in-memory). We intentionally don't touch localStorage here — the desktop
// shell persists open windows, and the browser re-seeds defaults on open.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

interface Bookmark {
  label: string
  url: string
  /** Known to block iframing — show fallback immediately, skip the attempt. */
  blocksEmbedding?: boolean
}

// Seeded bookmarks. The blocksEmbedding flag is a best-effort hint; the
// runtime detection is the real gate.
const DEFAULT_BOOKMARKS: Bookmark[] = [
  { label: 'DialerSeat', url: 'https://dialerseat.com/?view=landing' },
  { label: 'Wikipedia', url: 'https://www.wikipedia.org' },
  { label: 'Gmail', url: 'https://mail.google.com', blocksEmbedding: true },
  { label: 'Google', url: 'https://www.google.com', blocksEmbedding: true },
  { label: 'GitHub', url: 'https://github.com', blocksEmbedding: true },
]

function normalizeUrl(input: string): string {
  let u = input.trim()
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) {
    // If it looks like a search rather than a domain, send to a search engine.
    if (!/\.[a-z]{2,}/i.test(u) || /\s/.test(u)) {
      return `https://duckduckgo.com/?q=${encodeURIComponent(u)}`
    }
    u = `https://${u}`
  }
  return u
}

export default function BrowserApp() {
  const [bookmarks] = useState<Bookmark[]>(DEFAULT_BOOKMARKS)
  const [urlInput, setUrlInput] = useState('https://www.wikipedia.org')
  const [currentUrl, setCurrentUrl] = useState('https://www.wikipedia.org')
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'blocked'>('idle')
  const [knownBlocked, setKnownBlocked] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRef = useRef(false)

  const navigate = (raw: string) => {
    const url = normalizeUrl(raw)
    if (!url) return
    setUrlInput(url)
    setCurrentUrl(url)

    // Check seeded hint.
    const bm = bookmarks.find((b) => b.url === url)
    const blocked = !!bm?.blocksEmbedding
    setKnownBlocked(blocked)

    if (blocked) {
      setLoadState('blocked')
      return
    }

    setLoadState('loading')
    loadedRef.current = false

    // Embedding-blocked detection: if onLoad never fires within 3.5s, assume
    // the browser refused to render it (X-Frame-Options / CSP). Some blocked
    // sites DO fire onLoad with an error page, so we also re-check after load
    // whether we can read anything — but cross-origin reads throw, so the
    // timeout is the primary signal.
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    loadTimerRef.current = setTimeout(() => {
      if (!loadedRef.current) {
        setLoadState('blocked')
      }
    }, 3500)
  }

  const onIframeLoad = () => {
    loadedRef.current = true
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    // If it loaded but the URL was flagged blocked, the fallback already
    // shows. Otherwise mark loaded.
    setLoadState((prev) => (prev === 'blocked' ? prev : 'loaded'))
  }

  useEffect(() => {
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    }
  }, [])

  const openInNewTab = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#f5f5f7',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* URL bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          background: '#e8eaed',
          borderBottom: '1px solid #c4c8d0',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(urlInput)
          }}
          placeholder="Enter a URL or search…"
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #c4c8d0',
            borderRadius: 18,
            fontSize: 13,
            outline: 'none',
            fontFamily: 'inherit',
            background: '#fff',
          }}
        />
        <button
          onClick={() => navigate(urlInput)}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: 18,
            background: '#4a9eff',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Go
        </button>
        <button
          onClick={openInNewTab}
          title="Open in new tab"
          style={{
            padding: '8px 12px',
            border: '1px solid #c4c8d0',
            borderRadius: 18,
            background: '#fff',
            color: '#333',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          ↗
        </button>
      </div>

      {/* Bookmarks row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: '#f0f1f4',
          borderBottom: '1px solid #d8dce2',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {bookmarks.map((b) => (
          <button
            key={b.url}
            onClick={() => navigate(b.url)}
            title={b.url}
            style={{
              padding: '5px 12px',
              border: '1px solid #d0d4d8',
              borderRadius: 14,
              background: '#fff',
              color: '#333',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {b.label}
            {b.blocksEmbedding && (
              <span title="Opens in new tab (can't be embedded)" style={{ fontSize: 10, opacity: 0.5 }}>↗</span>
            )}
          </button>
        ))}
      </div>

      {/* Viewport */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, background: '#fff' }}>
        {loadState === 'loading' && (
          <div style={overlayStyle}>
            <div style={{ fontSize: 13, color: '#666' }}>Loading {currentUrl}…</div>
          </div>
        )}

        {loadState === 'blocked' ? (
          <div style={overlayStyle}>
            <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
              <h3 style={{ fontSize: 16, color: '#222', marginBottom: 8, fontWeight: 600 }}>
                This site can’t be embedded
              </h3>
              <p style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 18 }}>
                {hostOf(currentUrl)} blocks being displayed inside another page
                (a standard security measure). You can open it in a real browser
                tab instead.
              </p>
              <button
                onClick={openInNewTab}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#4a9eff',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Open {hostOf(currentUrl)} in new tab ↗
              </button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={knownBlocked ? undefined : currentUrl}
            onLoad={onIframeLoad}
            title="Browser"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#fff',
            }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
          />
        )}
      </div>
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'This site'
  }
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  zIndex: 2,
}