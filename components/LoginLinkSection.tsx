'use client'
// =============================================================================
// LoginLinkSection — onboarding form block for the optional subdomain-login
// link, with a collapsible LIVE PREVIEW of the branded login page.
// =============================================================================
// v2: chrome (card, inputs, labels, borders, text) now uses the same CSS theme
// vars as the rest of onboarding (--surface, --background, --border,
// --text-primary, --text-muted, --brand-primary) so it no longer renders as a
// white block. The LIVE PREVIEW area intentionally keeps the partner's literal
// primaryColor / pageBgColor props, because that box is meant to depict the
// TENANT's brand, not the dashboard theme.
//
// Drop this into the white-label onboarding/edit wizard. It owns three fields:
//   login_link_label — optional small heading ("New to TPI?")
//   login_link_text  — the clickable phrase ("Visit our agent portal")
//   login_link_url   — destination (https://…)
//
// Collapsed by default behind a single "▸ Login page link OPTIONAL" toggle.
// Controlled component: pass current values + onChange handlers, plus
// brandName/logoUrl/primaryColor/pageBgColor so the preview reflects the theme.
// =============================================================================

import { useState } from 'react'

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

export interface LoginLinkSectionProps {
  brandName: string
  logoUrl?: string | null
  primaryColor: string
  pageBgColor: string
  /** Text color for the brand name in the PREVIEW (over the tenant page bg). */
  onPageTextColor?: string
  /** Muted text color for the PREVIEW's "DialerSeat" half + heading. */
  previewMutedColor?: string

  label: string
  text: string
  url: string
  onLabelChange: (v: string) => void
  onTextChange: (v: string) => void
  onUrlChange: (v: string) => void
}

function ExternalLinkIcon({ color }: { color: string }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flexShrink: 0, marginLeft: 6, transform: 'translateY(0.5px)' }}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export default function LoginLinkSection({
  brandName,
  logoUrl,
  primaryColor,
  pageBgColor,
  onPageTextColor = '#1a1c24',
  previewMutedColor = '#5a5e6a',
  label,
  text,
  url,
  onLabelChange,
  onTextChange,
  onUrlChange,
}: LoginLinkSectionProps) {
  const hasAnyValue = !!(label || text || url)
  const [open, setOpen] = useState(hasAnyValue)

  // The link only "shows" in preview once it has clickable text + a url, which
  // mirrors the server rule and the real login component.
  const previewShowsLink = !!(text.trim() && url.trim())
  // Light validity hint for the URL field (non-blocking; server is source of truth).
  const urlLooksValid = !url.trim() || /^https?:\/\/.+/i.test(url.trim())

  // ── Chrome styles — use theme vars so this matches the rest of onboarding ──
  const labelCss: React.CSSProperties = {
    display: 'block', fontSize: 9, letterSpacing: 2, color: 'var(--text-muted)',
    fontWeight: 700, marginBottom: 6, textTransform: 'uppercase',
  }
  const inputCss: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 6,
    fontFamily: FUTURA, fontSize: 13, color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: FUTURA,
        background: 'var(--surface)',
      }}
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FUTURA,
          textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            ▸ Login page link
            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-muted)' }}>
              OPTIONAL
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, letterSpacing: 0.3 }}>
            Add one link under your sign-in mark — your site, agent portal, or lead packages.
          </div>
        </div>
        <span
          aria-hidden="true"
          style={{
            fontSize: 16, color: 'var(--text-muted)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s', flexShrink: 0,
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div style={{ padding: '4px 16px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Fields */}
          <div>
            <label style={labelCss}>Clickable text</label>
            <input
              type="text"
              value={text}
              maxLength={48}
              placeholder="Visit our agent portal"
              onChange={(e) => onTextChange(e.target.value)}
              style={inputCss}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              The words people click. Required if you add a link.
            </div>
          </div>

          <div>
            <label style={labelCss}>Link URL</label>
            <input
              type="url"
              value={url}
              placeholder="https://yoursite.com"
              onChange={(e) => onUrlChange(e.target.value)}
              style={{
                ...inputCss,
                borderColor: urlLooksValid ? 'var(--border)' : 'var(--color-error, #c0392b)',
              }}
            />
            {!urlLooksValid && (
              <div style={{ fontSize: 10, color: 'var(--color-error, #c0392b)', marginTop: 4 }}>
                Must start with http:// or https://
              </div>
            )}
          </div>

          <div>
            <label style={labelCss}>Heading <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="text"
              value={label}
              maxLength={40}
              placeholder="New to your brand?"
              onChange={(e) => onLabelChange(e.target.value)}
              style={inputCss}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              A small line above the link. Leave blank to show just the link.
            </div>
          </div>

          {/* ── LIVE PREVIEW — keeps the partner's LITERAL brand colors ──────── */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
              ▸ Live preview
            </div>
            <div
              style={{
                background: pageBgColor || '#f0f1f4',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {/* mark */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain' }} />
                ) : (
                  <div style={{
                    width: 40, height: 40, borderRadius: 9,
                    background: primaryColor || '#4a9eff', opacity: 0.25,
                  }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase' }}>
                  <span style={{ color: onPageTextColor }}>{brandName || 'Your brand'}</span>
                  <span style={{ color: primaryColor || '#4a9eff', fontSize: 14, fontWeight: 400, transform: 'translateY(-1px)' }}>×</span>
                  <span style={{ color: previewMutedColor }}>DialerSeat</span>
                </div>
              </div>

              {/* faux sign-in field, so the partner sees the link in context */}
              <div style={{
                width: '100%', maxWidth: 240, height: 36, borderRadius: 6,
                background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', paddingLeft: 12,
              }}>
                <span style={{ fontSize: 11, color: '#9aa0aa' }}>Email address</span>
              </div>
              <div style={{
                width: '100%', maxWidth: 240, height: 36, borderRadius: 6,
                background: primaryColor || '#4a9eff', opacity: 0.92,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#fff', textTransform: 'uppercase' }}>Sign in</span>
              </div>

              {/* the link itself */}
              {previewShowsLink ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  {label.trim() ? (
                    <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', color: previewMutedColor }}>
                      {label}
                    </div>
                  ) : null}
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
                      color: primaryColor || '#4a9eff',
                      borderBottom: `1px solid ${primaryColor || '#4a9eff'}73`,
                      paddingBottom: 1, lineHeight: 1.3,
                    }}
                  >
                    {text}
                    <ExternalLinkIcon color={primaryColor || '#4a9eff'} />
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: previewMutedColor, fontStyle: 'italic', marginTop: 2, opacity: 0.8 }}>
                  Your link appears here once it has text and a URL.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}