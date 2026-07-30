'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser, SignOutButton } from '@clerk/nextjs'

// ─────────────────────────────────────────────────────────────────────────
// Settings — Apple-style admin settings app.
// Notifications section: master toggle + one switch per Logs event type
// (signups, new subs, resubs, renewals, cancels), backed by real storage
// in admin_notification_prefs (see /api/admin/push/prefs). Also handles
// the one-time "enable push on this device" flow, which registers the
// service worker, requests permission, and saves the resulting browser
// subscription via /api/admin/push/subscribe.
// ─────────────────────────────────────────────────────────────────────────

const IOS_BLUE = '#0A84FF'
const IOS_GREEN = '#30D158'
const IOS_RED = '#FF453A'
const GROUP_BG = '#000000'
const CARD_BG = '#1C1C1E'
const CARD_BG_ELEVATED = '#242426'
const LABEL_PRIMARY = '#FFFFFF'
const LABEL_SECONDARY = '#98989F'
const LABEL_TERTIARY = '#6C6C70'
const SEPARATOR = 'rgba(84, 84, 88, 0.55)'
const CHEVRON = '#5C5C60'

const SF_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif'

type NotifKey = 'signup' | 'account_deleted' | 'new_sub' | 'resub' | 'renewal' | 'cancel'

interface NotifRow {
  key: NotifKey
  label: string
  description: string
}

const NOTIF_ROWS: NotifRow[] = [
  { key: 'signup', label: 'New Sign-Ups', description: 'Someone creates a DialerSeat account' },
  { key: 'account_deleted', label: 'Account Deletions', description: 'Someone deletes their DialerSeat account (rare)' },
  { key: 'new_sub', label: 'New Subscriptions', description: 'A first-time paid subscription starts' },
  { key: 'resub', label: 'Resubscriptions', description: 'A lapsed customer subscribes again' },
  { key: 'renewal', label: 'Renewals', description: 'A weekly subscription payment goes through' },
  { key: 'cancel', label: 'Cancellations', description: 'A customer cancels their subscription' },
]

interface PrefsResponse {
  master_enabled: boolean
  signup: boolean
  account_deleted: boolean
  new_sub: boolean
  resub: boolean
  renewal: boolean
  cancel: boolean
}

const DEFAULT_PREFS: PrefsResponse = {
  master_enabled: true,
  signup: true,
  account_deleted: true,
  new_sub: true,
  resub: true,
  renewal: true,
  cancel: true,
}

// Standard base64url -> Uint8Array conversion the Push API requires for
// the VAPID public key when calling pushManager.subscribe().
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

type PushDeviceStatus = 'unknown' | 'unsupported' | 'not_subscribed' | 'subscribed' | 'denied' | 'stale'

function IOSSwitch({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        appearance: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: 51,
        height: 31,
        borderRadius: 999,
        background: on ? IOS_GREEN : 'rgba(120,120,128,0.32)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.2s ease',
        outlineOffset: 2,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          width: 27,
          height: 27,
          borderRadius: '50%',
          background: '#fff',
          boxShadow:
            '0 3px 8px rgba(0,0,0,0.15), 0 3px 1px rgba(0,0,0,0.06)',
          transition: 'left 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)',
        }}
      />
    </button>
  )
}

function TickerText({ text, color = '#fff' }: { text: string; color?: string }) {
  // News-ticker style: text scrolls continuously right-to-left. Rendered
  // twice back to back so the loop has no visible seam/gap when the first
  // copy exits — the second copy is already in place to take over.
  return (
    <div style={{ overflow: 'hidden', width: '100%' }}>
      <style>{`
        @keyframes ds-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation: 'ds-ticker-scroll 22s linear infinite',
        }}
      >
        {[0, 1].map(i => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              paddingRight: 64,
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: 0.2,
              color,
            }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}

function SettingsRow({
  title,
  subtitle,
  right,
  isLast,
}: {
  title: string
  subtitle?: string
  right: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '11px 16px',
        borderBottom: isLast ? 'none' : `0.5px solid ${SEPARATOR}`,
        minHeight: 44,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15.5,
            color: LABEL_PRIMARY,
            fontWeight: 400,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12.5,
              color: LABEL_SECONDARY,
              marginTop: 1,
              letterSpacing: -0.1,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  )
}

function NavRow({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
  isLast,
}: {
  icon: string
  iconBg: string
  title: string
  subtitle?: string
  onClick: () => void
  isLast?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        boxSizing: 'border-box',
        gap: 16,
        padding: '9px 16px',
        cursor: 'pointer',
        minHeight: 44,
        borderBottom: isLast ? 'none' : `0.5px solid ${SEPARATOR}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div
          aria-hidden
          style={{
            width: 29,
            height: 29,
            borderRadius: 7,
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 15.5, letterSpacing: -0.2, color: LABEL_PRIMARY }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12.5, color: LABEL_SECONDARY, marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <span style={{ color: CHEVRON, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>›</span>
    </button>
  )
}

function SearchField({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(118, 118, 128, 0.12)',
        borderRadius: 10,
        padding: '8px 10px',
        marginBottom: 18,
      }}
    >
      <span style={{ fontSize: 15, color: LABEL_SECONDARY, flexShrink: 0 }} aria-hidden>
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search"
        style={{
          all: 'unset',
          flex: 1,
          fontSize: 15.5,
          fontFamily: SF_STACK,
          color: LABEL_PRIMARY,
          letterSpacing: -0.2,
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: LABEL_SECONDARY,
            fontSize: 13,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'rgba(120,120,128,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            all: 'unset',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'pointer',
            color: IOS_BLUE,
            fontSize: 17,
            padding: '4px 4px 4px 0',
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>‹</span>
          Settings
        </button>
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.4, margin: '0 0 16px 2px' }}>
        {title}
      </h1>
    </>
  )
}

function GroupedCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: CARD_BG,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 0 0 0.5px rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: LABEL_SECONDARY,
        textTransform: 'uppercase',
        letterSpacing: 0.2,
        padding: '0 16px',
        marginBottom: 6,
        marginTop: 20,
        fontWeight: 400,
      }}
    >
      {children}
    </div>
  )
}

type SettingsPane =
  | 'root'
  | 'general'
  | 'notifications'
  | 'dialer'
  | 'team'
  | 'branding'
  | 'numbers'
  | 'billing'
  | 'integrations'
  | 'privacy'
  | 'advanced'
  | 'about'

interface EmptyPaneDef {
  pane: SettingsPane
  title: string
  icon: string
  iconBg: string
  subtitle: string
  blurb: string
}

// Simple category tabs with nothing built yet. Each renders the standard
// iOS "nothing here" empty state via <EmptyPane />. Fill these in later —
// no scaffolding needed beyond adding the real content where noted.
const EMPTY_PANES: EmptyPaneDef[] = [
  {
    pane: 'dialer',
    title: 'Dialer & Calling',
    icon: '📞',
    iconBg: `linear-gradient(135deg, ${IOS_GREEN}, #248A3D)`,
    subtitle: 'Pacing, dispositions, recordings',
    blurb: 'Controls for dialing modes, call pacing, dispositions, and recording will live here.',
  },
  {
    pane: 'team',
    title: 'Team & Access',
    icon: '👥',
    iconBg: 'linear-gradient(135deg, #5AC8FA, #007AFF)',
    subtitle: 'Roles, permissions, seats',
    blurb: 'Manage teammate roles, permissions, and seat assignments from here.',
  },
  {
    pane: 'branding',
    title: 'Branding & White Label',
    icon: '🎨',
    iconBg: 'linear-gradient(135deg, #FF9F0A, #FF6200)',
    subtitle: 'Logo, colors, custom domain',
    blurb: 'White label branding, custom domains, and theme controls will live here.',
  },
  {
    pane: 'numbers',
    title: 'Numbers & Compliance',
    icon: '🔢',
    iconBg: 'linear-gradient(135deg, #BF5AF2, #8944AB)',
    subtitle: 'Provisioning, area codes, STIR/SHAKEN',
    blurb: 'Phone number provisioning and compliance settings will live here.',
  },
  {
    pane: 'billing',
    title: 'Billing',
    icon: '💳',
    iconBg: 'linear-gradient(135deg, #34C759, #248A3D)',
    subtitle: 'Plan, invoices, payment method',
    blurb: 'Subscription plan, invoices, and payment details will live here.',
  },
  {
    pane: 'integrations',
    title: 'Integrations',
    icon: '🔗',
    iconBg: 'linear-gradient(135deg, #64D2FF, #0A84FF)',
    subtitle: 'Gmail, webhooks, API keys',
    blurb: 'Connected accounts, webhooks, and API keys will live here.',
  },
  {
    pane: 'privacy',
    title: 'Privacy & Security',
    icon: '🔒',
    iconBg: 'linear-gradient(135deg, #8E8E93, #636366)',
    subtitle: 'Sessions, access logs',
    blurb: 'Session management, admin access logs, and similar controls will live here.',
  },
  {
    pane: 'advanced',
    title: 'Advanced',
    icon: '🛠️',
    iconBg: 'linear-gradient(135deg, #8E8E93, #636366)',
    subtitle: 'Logs, diagnostics, developer options',
    blurb: 'Developer and diagnostic options will live here.',
  },
  {
    pane: 'about',
    title: 'About',
    icon: 'ℹ️',
    iconBg: 'linear-gradient(135deg, #8E8E93, #48484A)',
    subtitle: 'Version, legal',
    blurb: 'App version, changelog, and legal information will live here.',
  },
]

function Sidebar({
  pane,
  setPane,
  search,
  setSearch,
  displayName,
  displayEmail,
  userLoaded,
  userImageUrl,
  notifSubtitle,
}: {
  pane: SettingsPane
  setPane: (p: SettingsPane) => void
  search: string
  setSearch: (s: string) => void
  displayName: string
  displayEmail: string
  userLoaded: boolean
  userImageUrl?: string | null
  notifSubtitle: string
}) {
  const q = search.trim().toLowerCase()
  const matches = (title: string, subtitle?: string) =>
    !q || title.toLowerCase().includes(q) || (subtitle || '').toLowerCase().includes(q)

  const items: { pane: SettingsPane; icon: string; iconBg: string; title: string; subtitle: string }[] = [
    { pane: 'general', icon: '⚙️', iconBg: 'linear-gradient(135deg, #8E8E93, #636366)', title: 'General', subtitle: 'Account, sign out' },
    { pane: 'notifications', icon: '🔔', iconBg: `linear-gradient(135deg, ${IOS_RED}, #C41E1E)`, title: 'Notifications', subtitle: notifSubtitle },
    ...EMPTY_PANES.map(def => ({ pane: def.pane, icon: def.icon, iconBg: def.iconBg, title: def.title, subtitle: def.subtitle })),
  ]
  const filtered = items.filter(i => matches(i.title, i.subtitle))

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        borderRight: `0.5px solid ${SEPARATOR}`,
        padding: '20px 14px 40px',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.3, margin: '0 0 14px 6px' }}>Settings</h1>
      <SearchField value={search} onChange={setSearch} />

      <button
        type="button"
        onClick={() => setPane('general')}
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 8px',
          cursor: 'pointer',
          borderRadius: 9,
          marginBottom: 14,
          background: pane === 'general' ? IOS_BLUE : 'transparent',
        }}
      >
        {userLoaded && userImageUrl ? (
          <img src={userImageUrl} alt="" aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
        ) : (
          <div
            aria-hidden
            style={{
              width: 34, height: 34, borderRadius: '50%', background: '#48484A', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: LABEL_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userLoaded ? displayName : 'Loading…'}
          </div>
          <div style={{ fontSize: 11, color: pane === 'general' ? 'rgba(255,255,255,0.75)' : LABEL_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayEmail || 'Admin account'}
          </div>
        </div>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filtered.filter(i => i.pane !== 'general').map(i => {
          const active = pane === i.pane
          return (
            <button
              key={i.pane}
              type="button"
              onClick={() => setPane(i.pane)}
              style={{
                all: 'unset',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                boxSizing: 'border-box',
                padding: '7px 8px',
                cursor: 'pointer',
                borderRadius: 7,
                background: active ? IOS_BLUE : 'transparent',
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 24, height: 24, borderRadius: 6, background: i.iconBg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                }}
              >
                {i.icon}
              </div>
              <span style={{ fontSize: 13.5, color: LABEL_PRIMARY, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i.title}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '20px 8px', color: LABEL_SECONDARY, fontSize: 12.5, textAlign: 'center' }}>
            No results
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyPane({ def, onBack }: { def: EmptyPaneDef; onBack: () => void }) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px 60px' }}>
      <BackHeader title={def.title} onBack={onBack} />
      <GroupedCard>
        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
          <div
            aria-hidden
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              background: def.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              margin: '0 auto 14px',
            }}
          >
            {def.icon}
          </div>
          <div style={{ fontSize: 15.5, color: LABEL_PRIMARY, fontWeight: 500, marginBottom: 6 }}>
            Nothing here yet
          </div>
          <div style={{ fontSize: 12.5, color: LABEL_SECONDARY, lineHeight: 1.5, maxWidth: 380, margin: '0 auto' }}>
            {def.blurb}
          </div>
        </div>
      </GroupedCard>
    </div>
  )
}

interface DialerDownSectionProps {
  loading: boolean
  enabled: boolean
  liveMessage: string
  hasPassword: boolean
  updatedAt: string | null
  draftMessage: string
  setDraftMessage: (v: string) => void
  password: string
  setPassword: (v: string) => void
  newPassword: string
  setNewPassword: (v: string) => void
  busy: boolean
  error: string | null
  notice: string | null
  showPasswordSetup: boolean
  setShowPasswordSetup: (v: boolean) => void
  onPublish: () => void
  onRemove: () => void
  onSetPassword: () => void
}

function DialerDownSection(props: DialerDownSectionProps) {
  const {
    loading, enabled, liveMessage, hasPassword, updatedAt,
    draftMessage, setDraftMessage, password, setPassword,
    newPassword, setNewPassword, busy, error, notice,
    showPasswordSetup, setShowPasswordSetup,
    onPublish, onRemove, onSetPassword,
  } = props

  const inputStyle: React.CSSProperties = {
    all: 'unset',
    width: '100%',
    boxSizing: 'border-box',
    background: '#2C2C2E',
    border: `0.5px solid ${SEPARATOR}`,
    borderRadius: 9,
    padding: '10px 12px',
    fontSize: 14.5,
    fontFamily: SF_STACK,
    color: LABEL_PRIMARY,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: LABEL_SECONDARY,
    marginBottom: 6,
    fontWeight: 500,
  }

  return (
    <>
      <GroupLabel>Dialer Down — Emergency Banner</GroupLabel>
      <GroupedCard>
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontSize: 12.5, color: LABEL_SECONDARY, lineHeight: 1.5, marginBottom: 14 }}>
            A sitewide warning banner shown only to signed-in Pro and Manager+ users,
            only inside dashboard apps — never on the landing page, never to signed-out
            visitors. Use it for real technical difficulty notices only: outages,
            planned maintenance, or similar. It requires the publish/remove password
            below every time, and is completely invisible to everyone until you turn it on here.
          </div>

          {/* Live status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 9,
              background: enabled ? 'rgba(255,69,58,0.14)' : 'rgba(120,120,128,0.16)',
              marginBottom: 16,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: enabled ? IOS_RED : '#8E8E93',
                boxShadow: enabled ? `0 0 0 3px rgba(255,69,58,0.25)` : 'none',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: LABEL_PRIMARY }}>
                {loading ? 'Checking status…' : enabled ? 'Banner is LIVE' : 'Banner is off'}
              </div>
              {enabled && liveMessage && (
                <div style={{ fontSize: 12, color: LABEL_SECONDARY, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  “{liveMessage}”
                </div>
              )}
            </div>
          </div>

          {/* Live preview of the scrolling ticker */}
          {draftMessage.trim() && (
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Preview</div>
              <div
                style={{
                  background: IOS_RED,
                  borderRadius: 9,
                  padding: '9px 0',
                  overflow: 'hidden',
                }}
              >
                <TickerText text={`⚠ DIALER DOWN — ${draftMessage.trim()}  ⚠`} />
              </div>
            </div>
          )}

          {/* Message field */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Message</div>
            <textarea
              value={draftMessage}
              onChange={e => setDraftMessage(e.target.value)}
              placeholder="e.g. Dialing is temporarily down while we roll out an update. Expected back up by 3:00 PM ET."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.4 }}
            />
          </div>

          {/* Password field — required for publish/remove */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Publish / Remove Password</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={hasPassword ? 'Enter password' : 'Set a password below first'}
              autoComplete="off"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12.5, color: IOS_RED, marginBottom: 12, lineHeight: 1.4 }}>{error}</div>
          )}
          {notice && !error && (
            <div style={{ fontSize: 12.5, color: IOS_GREEN, marginBottom: 12, lineHeight: 1.4 }}>{notice}</div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onPublish}
              disabled={busy || !hasPassword}
              style={{
                all: 'unset', background: IOS_RED, color: '#fff', fontSize: 13.5,
                fontWeight: 600, padding: '9px 16px', borderRadius: 8,
                cursor: (busy || !hasPassword) ? 'default' : 'pointer',
                opacity: (busy || !hasPassword) ? 0.5 : 1,
              }}
            >
              {busy ? 'Working…' : enabled ? 'Update & Republish' : 'Publish Banner'}
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={busy || !hasPassword || !enabled}
              style={{
                all: 'unset', background: '#3A3A3C', color: LABEL_PRIMARY, fontSize: 13.5,
                fontWeight: 500, padding: '9px 16px', borderRadius: 8,
                cursor: (busy || !hasPassword || !enabled) ? 'default' : 'pointer',
                opacity: (busy || !hasPassword || !enabled) ? 0.5 : 1,
              }}
            >
              Remove Banner
            </button>
          </div>

          {updatedAt && (
            <div style={{ fontSize: 11, color: LABEL_TERTIARY, marginTop: 10 }}>
              Last changed {new Date(updatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </GroupedCard>

      {/* Password setup / change — separate card, tucked below */}
      <GroupLabel>&nbsp;</GroupLabel>
      <GroupedCard>
        <button
          type="button"
          onClick={() => setShowPasswordSetup(!showPasswordSetup)}
          style={{
            all: 'unset',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 16px',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          <span style={{ fontSize: 15.5, color: IOS_BLUE }}>
            {hasPassword ? 'Change Password' : 'Set Publish/Remove Password'}
          </span>
          <span style={{ color: CHEVRON, fontSize: 14, transform: showPasswordSetup ? 'rotate(90deg)' : 'none' }}>›</span>
        </button>

        {showPasswordSetup && (
          <div style={{ padding: '0 16px 16px' }}>
            {hasPassword && (
              <div style={{ marginBottom: 10 }}>
                <div style={labelStyle}>Current Password</div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>New Password (min. 8 characters)</div>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="off"
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={onSetPassword}
              disabled={busy}
              style={{
                all: 'unset', background: IOS_BLUE, color: '#fff', fontSize: 13.5,
                fontWeight: 600, padding: '9px 16px', borderRadius: 8,
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Saving…' : hasPassword ? 'Change Password' : 'Set Password'}
            </button>
          </div>
        )}
      </GroupedCard>
    </>
  )
}


interface PromoBannerSectionProps {
  loading: boolean
  enabled: boolean
  liveMessage: string
  updatedAt: string | null
  draftMessage: string
  setDraftMessage: (v: string) => void
  textColor: string
  setTextColor: (v: string) => void
  bgColor: string
  setBgColor: (v: string) => void
  busy: boolean
  error: string | null
  notice: string | null
  onPublish: () => void
  onRemove: () => void
}

const PROMO_PRESETS: { label: string; bg: string; text: string }[] = [
  { label: 'Blue', bg: '#0A84FF', text: '#FFFFFF' },
  { label: 'Green', bg: '#30D158', text: '#FFFFFF' },
  { label: 'Purple', bg: '#BF5AF2', text: '#FFFFFF' },
  { label: 'Gold', bg: '#FF9F0A', text: '#1C1C1E' },
  { label: 'Pink', bg: '#FF375F', text: '#FFFFFF' },
  { label: 'Black', bg: '#1C1C1E', text: '#FFFFFF' },
]

function PromoBannerSection(props: PromoBannerSectionProps) {
  const {
    loading, enabled, liveMessage, updatedAt,
    draftMessage, setDraftMessage, textColor, setTextColor, bgColor, setBgColor,
    busy, error, notice, onPublish, onRemove,
  } = props

  const inputStyle: React.CSSProperties = {
    all: 'unset',
    width: '100%',
    boxSizing: 'border-box',
    background: '#2C2C2E',
    border: `0.5px solid ${SEPARATOR}`,
    borderRadius: 9,
    padding: '10px 12px',
    fontSize: 14.5,
    fontFamily: SF_STACK,
    color: LABEL_PRIMARY,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: LABEL_SECONDARY,
    marginBottom: 6,
    fontWeight: 500,
  }

  return (
    <>
      <GroupLabel>Promo Banner</GroupLabel>
      <GroupedCard>
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontSize: 12.5, color: LABEL_SECONDARY, lineHeight: 1.5, marginBottom: 14 }}>
            A customizable announcement banner — holiday promos, discount codes,
            product news, anything you like. Same audience as Dialer Down: only
            signed-in Pro and Manager+ users, only inside dashboard apps, never
            the landing page. No password required, so you can publish and edit
            it whenever you like.
          </div>

          {/* Live status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 9,
              background: enabled ? 'rgba(48,209,88,0.14)' : 'rgba(120,120,128,0.16)',
              marginBottom: 16,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: enabled ? IOS_GREEN : '#8E8E93',
                boxShadow: enabled ? `0 0 0 3px rgba(48,209,88,0.25)` : 'none',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: LABEL_PRIMARY }}>
                {loading ? 'Checking status…' : enabled ? 'Banner is LIVE' : 'Banner is off'}
              </div>
              {enabled && liveMessage && (
                <div style={{ fontSize: 12, color: LABEL_SECONDARY, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  “{liveMessage}”
                </div>
              )}
            </div>
          </div>

          {/* Live preview of the scrolling ticker */}
          {draftMessage.trim() && (
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Preview</div>
              <div
                style={{
                  background: bgColor,
                  borderRadius: 9,
                  padding: '9px 0',
                  overflow: 'hidden',
                }}
              >
                <TickerText text={draftMessage.trim()} color={textColor} />
              </div>
            </div>
          )}

          {/* Message field */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Message</div>
            <textarea
              value={draftMessage}
              onChange={e => setDraftMessage(e.target.value)}
              placeholder="e.g. 🎉 Holiday Sale — 20% off all plans with code HOLIDAY20, now through Jan 5!"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.4 }}
            />
          </div>

          {/* Color presets */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Color</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {PROMO_PRESETS.map(p => {
                const active = p.bg.toLowerCase() === bgColor.toLowerCase() && p.text.toLowerCase() === textColor.toLowerCase()
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setBgColor(p.bg); setTextColor(p.text) }}
                    title={p.label}
                    aria-label={p.label}
                    style={{
                      all: 'unset',
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: p.bg,
                      cursor: 'pointer',
                      boxShadow: active ? `0 0 0 2px ${GROUP_BG}, 0 0 0 4px ${IOS_BLUE}` : `0 0 0 0.5px rgba(255,255,255,0.15)`,
                    }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>Background</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={e => setBgColor(e.target.value)}
                    style={{ width: 30, height: 30, padding: 0, border: 'none', borderRadius: 7, background: 'none', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={e => setBgColor(e.target.value)}
                    style={{ ...inputStyle, fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>Text</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={textColor}
                    onChange={e => setTextColor(e.target.value)}
                    style={{ width: 30, height: 30, padding: 0, border: 'none', borderRadius: 7, background: 'none', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={e => setTextColor(e.target.value)}
                    style={{ ...inputStyle, fontSize: 13 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12.5, color: IOS_RED, marginBottom: 12, lineHeight: 1.4 }}>{error}</div>
          )}
          {notice && !error && (
            <div style={{ fontSize: 12.5, color: IOS_GREEN, marginBottom: 12, lineHeight: 1.4 }}>{notice}</div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onPublish}
              disabled={busy}
              style={{
                all: 'unset', background: IOS_BLUE, color: '#fff', fontSize: 13.5,
                fontWeight: 600, padding: '9px 16px', borderRadius: 8,
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? 'Working…' : enabled ? 'Update Banner' : 'Publish Banner'}
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={busy || !enabled}
              style={{
                all: 'unset', background: '#3A3A3C', color: LABEL_PRIMARY, fontSize: 13.5,
                fontWeight: 500, padding: '9px 16px', borderRadius: 8,
                cursor: (busy || !enabled) ? 'default' : 'pointer',
                opacity: (busy || !enabled) ? 0.5 : 1,
              }}
            >
              Remove Banner
            </button>
          </div>

          {updatedAt && (
            <div style={{ fontSize: 11, color: LABEL_TERTIARY, marginTop: 10 }}>
              Last changed {new Date(updatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </GroupedCard>
    </>
  )
}

export default function SettingsApp() {
  const { user, isLoaded: userLoaded } = useUser()
  const [pane, setPane] = useState<SettingsPane>('root')
  const [search, setSearch] = useState('')

  // ── Responsive "layers" ─────────────────────────────────────────────────
  // This app has no access to the desktop window's pixel size via props
  // (AppWindow renders <Component /> with nothing passed in), so we track
  // our own container width directly. Below the breakpoint it's the
  // single-column iPhone Settings look from the reference screenshot.
  // At or above it, we switch to a two-layer iPad/macOS System Settings
  // layout: a persistent sidebar list of categories on the left, and the
  // selected category's detail floating as its own card on the right —
  // both visible at once, so nothing changes about the underlying panes.
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(760)
  const isWide = containerWidth >= 720

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [prefs, setPrefs] = useState<PrefsResponse>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())

  const [deviceStatus, setDeviceStatus] = useState<PushDeviceStatus>('unknown')
  const [deviceBusy, setDeviceBusy] = useState(false)
  const [deviceError, setDeviceError] = useState<string | null>(null)

  const [diagBusy, setDiagBusy] = useState(false)
  const [diagResults, setDiagResults] = useState<{ step: string; ok: boolean; detail: string }[] | null>(null)
  const [diagSendResults, setDiagSendResults] = useState<{ subscriptionId: string; ok: boolean; detail: string; statusCode?: number }[] | null>(null)

  // ── Dialer Down emergency banner ────────────────────────────────────────
  const [ddLoading, setDdLoading] = useState(true)
  const [ddEnabled, setDdEnabled] = useState(false)
  const [ddLiveMessage, setDdLiveMessage] = useState('')     // what's actually published
  const [ddHasPassword, setDdHasPassword] = useState(false)
  const [ddUpdatedAt, setDdUpdatedAt] = useState<string | null>(null)
  const [ddDraftMessage, setDdDraftMessage] = useState('')   // editable field
  const [ddPassword, setDdPassword] = useState('')
  const [ddNewPassword, setDdNewPassword] = useState('')
  const [ddBusy, setDdBusy] = useState(false)
  const [ddError, setDdError] = useState<string | null>(null)
  const [ddNotice, setDdNotice] = useState<string | null>(null)
  const [ddShowPasswordSetup, setDdShowPasswordSetup] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/dialer-down')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled || !data?.status) return
        setDdEnabled(data.status.enabled)
        setDdLiveMessage(data.status.message || '')
        setDdDraftMessage(data.status.message || '')
        setDdHasPassword(data.status.hasPassword)
        setDdUpdatedAt(data.status.updatedAt)
      } catch (err) {
        console.error('[Settings] failed to load dialer-down status:', err)
      } finally {
        if (!cancelled) setDdLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function ddCallApi(payload: Record<string, unknown>) {
    setDdBusy(true)
    setDdError(null)
    setDdNotice(null)
    try {
      const res = await fetch('/api/admin/dialer-down', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return data
    } finally {
      setDdBusy(false)
    }
  }

  async function ddPublish() {
    if (!ddDraftMessage.trim()) {
      setDdError('Add a message before publishing.')
      return
    }
    if (!ddPassword) {
      setDdError('Enter the publish/remove password.')
      return
    }
    try {
      await ddCallApi({ action: 'publish', message: ddDraftMessage.trim(), password: ddPassword })
      setDdEnabled(true)
      setDdLiveMessage(ddDraftMessage.trim())
      setDdUpdatedAt(new Date().toISOString())
      setDdPassword('')
      setDdNotice('Banner published.')
    } catch (err) {
      setDdError(err instanceof Error ? err.message : 'Failed to publish banner.')
    }
  }

  async function ddRemove() {
    if (!ddPassword) {
      setDdError('Enter the publish/remove password.')
      return
    }
    try {
      await ddCallApi({ action: 'remove', password: ddPassword })
      setDdEnabled(false)
      setDdUpdatedAt(new Date().toISOString())
      setDdPassword('')
      setDdNotice('Banner removed.')
    } catch (err) {
      setDdError(err instanceof Error ? err.message : 'Failed to remove banner.')
    }
  }

  async function ddSetPassword() {
    if (ddNewPassword.trim().length < 8) {
      setDdError('New password must be at least 8 characters.')
      return
    }
    try {
      await ddCallApi({ action: 'set-password', password: ddPassword, newPassword: ddNewPassword.trim() })
      setDdHasPassword(true)
      setDdPassword('')
      setDdNewPassword('')
      setDdShowPasswordSetup(false)
      setDdNotice(ddHasPassword ? 'Password changed.' : 'Password set.')
    } catch (err) {
      setDdError(err instanceof Error ? err.message : 'Failed to set password.')
    }
  }

  // ── Promo / announcement banner ─────────────────────────────────────────
  const [pbLoading, setPbLoading] = useState(true)
  const [pbEnabled, setPbEnabled] = useState(false)
  const [pbLiveMessage, setPbLiveMessage] = useState('')
  const [pbUpdatedAt, setPbUpdatedAt] = useState<string | null>(null)
  const [pbDraftMessage, setPbDraftMessage] = useState('')
  const [pbTextColor, setPbTextColor] = useState('#FFFFFF')
  const [pbBgColor, setPbBgColor] = useState('#0A84FF')
  const [pbBusy, setPbBusy] = useState(false)
  const [pbError, setPbError] = useState<string | null>(null)
  const [pbNotice, setPbNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/promo-banner')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled || !data?.status) return
        setPbEnabled(data.status.enabled)
        setPbLiveMessage(data.status.message || '')
        setPbDraftMessage(data.status.message || '')
        setPbTextColor(data.status.textColor || '#FFFFFF')
        setPbBgColor(data.status.bgColor || '#0A84FF')
        setPbUpdatedAt(data.status.updatedAt)
      } catch (err) {
        console.error('[Settings] failed to load promo banner status:', err)
      } finally {
        if (!cancelled) setPbLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function pbCallApi(payload: Record<string, unknown>) {
    setPbBusy(true)
    setPbError(null)
    setPbNotice(null)
    try {
      const res = await fetch('/api/admin/promo-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return data
    } finally {
      setPbBusy(false)
    }
  }

  async function pbPublish() {
    if (!pbDraftMessage.trim()) {
      setPbError('Add a message before publishing.')
      return
    }
    try {
      await pbCallApi({ action: 'publish', message: pbDraftMessage.trim(), textColor: pbTextColor, bgColor: pbBgColor })
      setPbEnabled(true)
      setPbLiveMessage(pbDraftMessage.trim())
      setPbUpdatedAt(new Date().toISOString())
      setPbNotice('Banner published.')
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to publish banner.')
    }
  }

  async function pbRemove() {
    try {
      await pbCallApi({ action: 'remove' })
      setPbEnabled(false)
      setPbUpdatedAt(new Date().toISOString())
      setPbNotice('Banner removed.')
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to remove banner.')
    }
  }

  const notifState: Record<NotifKey, boolean> = {
    signup: prefs.signup,
    account_deleted: prefs.account_deleted,
    new_sub: prefs.new_sub,
    resub: prefs.resub,
    renewal: prefs.renewal,
    cancel: prefs.cancel,
  }
  const enabledCount = Object.values(notifState).filter(Boolean).length

  const displayName = user
    ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Admin')
    : 'Admin'
  const displayEmail = user?.primaryEmailAddress?.emailAddress || ''

  // ── Load saved prefs on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/push/prefs')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled && data?.prefs) setPrefs(data.prefs)
      } catch (err) {
        if (!cancelled) setLoadError('Could not load saved notification settings.')
        console.error('[Settings] failed to load prefs:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Check current push subscription status on mount ───────────────────
  useEffect(() => {
    ;(async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setDeviceStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setDeviceStatus('denied')
        return
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        const existing = await reg?.pushManager.getSubscription()
        if (!existing) {
          setDeviceStatus('not_subscribed')
          return
        }
        // Browser believes it's subscribed — confirm the server still
        // has this exact endpoint on file before trusting that. If a
        // previous send to this device ever got a 404/410 back,
        // sendAdminPush() would have quietly deleted the row server-side
        // with no way for the browser to find out on its own.
        try {
          const res = await fetch(`/api/admin/push/subscribe?endpoint=${encodeURIComponent(existing.endpoint)}`)
          const data = await res.json()
          setDeviceStatus(res.ok && data.exists ? 'subscribed' : 'stale')
        } catch {
          // Couldn't reach the server to confirm — assume the browser's
          // local state is right rather than falsely alarming the user
          // over what might just be a network blip.
          setDeviceStatus('subscribed')
        }
      } catch {
        setDeviceStatus('not_subscribed')
      }
    })()
  }, [])

  // ── Save a single pref field, optimistic with rollback on failure ─────
  const savePref = useCallback(async (patch: Partial<PrefsResponse>) => {
    const prevPrefs = prefs
    setPrefs(p => ({ ...p, ...patch }))
    setSavingKeys(prev => {
      const next = new Set(prev)
      Object.keys(patch).forEach(k => next.add(k))
      return next
    })
    try {
      const res = await fetch('/api/admin/push/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data?.prefs) setPrefs(data.prefs)
    } catch (err) {
      console.error('[Settings] failed to save prefs, rolling back:', err)
      setPrefs(prevPrefs)
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev)
        Object.keys(patch).forEach(k => next.delete(k))
        return next
      })
    }
  }, [prefs])

  function toggleNotif(key: NotifKey, next: boolean) {
    savePref({ [key]: next } as Partial<PrefsResponse>)
  }

  function toggleAll(next: boolean) {
    savePref({ signup: next, account_deleted: next, new_sub: next, resub: next, renewal: next, cancel: next })
  }

  function toggleMaster(next: boolean) {
    savePref({ master_enabled: next })
  }

  // ── Enable push on this device ─────────────────────────────────────────
  async function enablePushOnDevice() {
    setDeviceError(null)
    setDeviceBusy(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setDeviceStatus(permission === 'denied' ? 'denied' : 'not_subscribed')
        setDeviceBusy(false)
        return
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        setDeviceError('Push isn\u2019t configured on the server yet (missing VAPID key).')
        setDeviceBusy(false)
        return
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const json = subscription.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } }
      if (!json.keys) throw new Error('Subscription missing encryption keys')

      const res = await fetch('/api/admin/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgentLabel: navigator.userAgent,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setDeviceStatus('subscribed')
    } catch (err) {
      console.error('[Settings] enablePushOnDevice failed:', err)
      setDeviceError('Something went wrong enabling push on this device.')
    } finally {
      setDeviceBusy(false)
    }
  }

  async function runDiagnostic(sendTest: boolean) {
    setDiagBusy(true)
    setDiagResults(null)
    setDiagSendResults(null)
    try {
      const res = await fetch('/api/admin/push/diagnose', { method: sendTest ? 'POST' : 'GET' })
      const data = await res.json()
      setDiagResults(data.results || [])
      setDiagSendResults(data.sendResults ?? null)
    } catch (err) {
      console.error('[Settings] runDiagnostic failed:', err)
      setDiagResults([{ step: 'Run diagnostic', ok: false, detail: 'Failed to reach the diagnostic endpoint itself — check your network connection.' }])
    } finally {
      setDiagBusy(false)
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: GROUP_BG,
        fontFamily: SF_STACK,
        WebkitFontSmoothing: 'antialiased',
        color: LABEL_PRIMARY,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {isWide && (
        <Sidebar
          pane={pane}
          setPane={setPane}
          search={search}
          setSearch={setSearch}
          displayName={displayName}
          displayEmail={displayEmail}
          userLoaded={userLoaded}
          userImageUrl={user?.imageUrl}
          notifSubtitle={ddEnabled ? '🔴 Dialer Down banner is live' : pbEnabled ? '📣 Promo banner is live' : (prefs.master_enabled ? `${enabledCount} of ${NOTIF_ROWS.length} on` : 'Off')}
        />
      )}

      <div style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto' }}>
      {pane === 'root' && isWide && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 15, color: LABEL_SECONDARY }}>Choose a category from the sidebar</div>
        </div>
      )}
      {pane === 'root' && !isWide && (() => {
        const q = search.trim().toLowerCase()
        const matches = (title: string, subtitle?: string) =>
          !q || title.toLowerCase().includes(q) || (subtitle || '').toLowerCase().includes(q)

        const rowDefs: { icon: string; iconBg: string; title: string; subtitle: string; onClick: () => void }[] = [
          { icon: '⚙️', iconBg: 'linear-gradient(135deg, #8E8E93, #636366)', title: 'General', subtitle: 'Account, sign out', onClick: () => setPane('general') },
          { icon: '🔔', iconBg: `linear-gradient(135deg, ${IOS_RED}, #C41E1E)`, title: 'Notifications', subtitle: ddEnabled ? '🔴 Dialer Down banner is live' : pbEnabled ? '📣 Promo banner is live' : (prefs.master_enabled ? `${enabledCount} of ${NOTIF_ROWS.length} on` : 'Off'), onClick: () => setPane('notifications') },
          ...EMPTY_PANES.map(def => ({
            icon: def.icon,
            iconBg: def.iconBg,
            title: def.title,
            subtitle: def.subtitle,
            onClick: () => setPane(def.pane),
          })),
        ]

        // Real iOS groups items loosely by theme rather than one long list.
        const groupA = rowDefs.filter(r => ['General', 'Notifications', 'Privacy & Security', 'Advanced'].includes(r.title))
        const groupB = rowDefs.filter(r => ['Dialer & Calling', 'Team & Access', 'Numbers & Compliance'].includes(r.title))
        const groupC = rowDefs.filter(r => ['Branding & White Label', 'Billing', 'Integrations'].includes(r.title))
        const groupD = rowDefs.filter(r => r.title === 'About')

        const renderGroup = (rows: typeof rowDefs) => {
          const filtered = rows.filter(r => matches(r.title, r.subtitle))
          if (filtered.length === 0) return null
          return (
            <GroupedCard>
              {filtered.map((r, i) => (
                <NavRow
                  key={r.title}
                  icon={r.icon}
                  iconBg={r.iconBg}
                  title={r.title}
                  subtitle={r.subtitle}
                  onClick={r.onClick}
                  isLast={i === filtered.length - 1}
                />
              ))}
            </GroupedCard>
          )
        }

        const accountVisible = !q || matches(displayName, displayEmail)
        const noResults =
          q &&
          !accountVisible &&
          [groupA, groupB, groupC, groupD].every(g => g.filter(r => matches(r.title, r.subtitle)).length === 0)

        return (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px 60px' }}>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: -0.4,
                margin: '0 0 16px 2px',
              }}
            >
              Settings
            </h1>

            <SearchField value={search} onChange={setSearch} />

            {!q && (
              <>
                {/* Account card — top of the list, iOS "Apple ID" style */}
                <GroupedCard>
                  <button
                    type="button"
                    onClick={() => setPane('general')}
                    style={{
                      all: 'unset',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      minHeight: 64,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      {userLoaded && user?.imageUrl ? (
                        <img
                          src={user.imageUrl}
                          alt=""
                          aria-hidden
                          style={{ width: 50, height: 50, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          aria-hidden
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: '50%',
                            background: '#48484A',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            color: '#fff',
                          }}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {userLoaded ? displayName : 'Loading…'}
                        </div>
                        <div style={{ fontSize: 12.5, color: LABEL_SECONDARY, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayEmail || 'Admin account'}
                        </div>
                      </div>
                    </div>
                    <span style={{ color: CHEVRON, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>›</span>
                  </button>
                </GroupedCard>
                <GroupLabel>&nbsp;</GroupLabel>
              </>
            )}

            {noResults ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: LABEL_SECONDARY, fontSize: 14.5 }}>
                No results for “{search}”
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {q && accountVisible && (
                  <GroupedCard>
                    <NavRow
                      icon="👤"
                      iconBg="linear-gradient(135deg, #8E8E93, #636366)"
                      title={displayName}
                      subtitle={displayEmail || 'Admin account'}
                      onClick={() => setPane('general')}
                      isLast
                    />
                  </GroupedCard>
                )}
                {renderGroup(groupA.filter(r => r.title !== 'General' || q))}
                {renderGroup(groupB)}
                {renderGroup(groupC)}
                {renderGroup(groupD)}
              </div>
            )}
          </div>
        )
      })()}

      {pane === 'notifications' && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px 60px' }}>
          <BackHeader title="Notifications" onBack={() => setPane('root')} />

          {loadError && (
            <div
              style={{
                background: 'rgba(255,69,58,0.12)',
                border: `1px solid rgba(255,69,58,0.35)`,
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: IOS_RED,
                marginBottom: 14,
              }}
            >
              {loadError}
            </div>
          )}

          <PromoBannerSection
            loading={pbLoading}
            enabled={pbEnabled}
            liveMessage={pbLiveMessage}
            updatedAt={pbUpdatedAt}
            draftMessage={pbDraftMessage}
            setDraftMessage={setPbDraftMessage}
            textColor={pbTextColor}
            setTextColor={setPbTextColor}
            bgColor={pbBgColor}
            setBgColor={setPbBgColor}
            busy={pbBusy}
            error={pbError}
            notice={pbNotice}
            onPublish={pbPublish}
            onRemove={pbRemove}
          />

          <DialerDownSection
            loading={ddLoading}
            enabled={ddEnabled}
            liveMessage={ddLiveMessage}
            hasPassword={ddHasPassword}
            updatedAt={ddUpdatedAt}
            draftMessage={ddDraftMessage}
            setDraftMessage={setDdDraftMessage}
            password={ddPassword}
            setPassword={setDdPassword}
            newPassword={ddNewPassword}
            setNewPassword={setDdNewPassword}
            busy={ddBusy}
            error={ddError}
            notice={ddNotice}
            showPasswordSetup={ddShowPasswordSetup}
            setShowPasswordSetup={setDdShowPasswordSetup}
            onPublish={ddPublish}
            onRemove={ddRemove}
            onSetPassword={ddSetPassword}
          />

          <GroupLabel>Push Notifications</GroupLabel>
          <GroupedCard>
            <SettingsRow
              title="Allow Notifications"
              subtitle="Turn off to silence every alert below"
              isLast
              right={
                <IOSSwitch
                  on={prefs.master_enabled}
                  label="Allow Notifications"
                  onChange={next => toggleMaster(next)}
                />
              }
            />
          </GroupedCard>

          <GroupLabel>This Device</GroupLabel>
          <GroupedCard>
            <SettingsRow
              title={
                deviceStatus === 'subscribed' ? 'Push Enabled'
                : deviceStatus === 'stale' ? 'Push Stopped Working'
                : deviceStatus === 'denied' ? 'Notifications Blocked'
                : deviceStatus === 'unsupported' ? 'Not Supported'
                : 'Push Not Enabled'
              }
              subtitle={
                deviceStatus === 'subscribed'
                  ? 'This device will receive alerts, even when DialerSeat is closed.'
                : deviceStatus === 'stale'
                  ? 'This device was subscribed, but the server no longer recognizes it (often after being unused for a while). Tap Enable to reconnect.'
                : deviceStatus === 'denied'
                  ? 'Notifications are blocked for this app in your phone\u2019s Settings.'
                : deviceStatus === 'unsupported'
                  ? 'This browser doesn\u2019t support push. Add DialerSeat to your Home Screen first.'
                : deviceError || 'Tap Enable to allow push on this phone.'
              }
              isLast
              right={
                deviceStatus === 'subscribed' ? (
                  <span style={{ color: IOS_GREEN, fontSize: 14.5, fontWeight: 500 }}>On</span>
                ) : deviceStatus === 'denied' || deviceStatus === 'unsupported' ? null : (
                  <button
                    type="button"
                    onClick={enablePushOnDevice}
                    disabled={deviceBusy}
                    style={{
                      all: 'unset',
                      background: IOS_BLUE,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 500,
                      padding: '6px 14px',
                      borderRadius: 999,
                      cursor: deviceBusy ? 'default' : 'pointer',
                      opacity: deviceBusy ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {deviceBusy ? 'Enabling…' : 'Enable'}
                  </button>
                )
              }
            />
          </GroupedCard>

          <GroupLabel>Diagnostics</GroupLabel>
          <GroupedCard>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 13, color: LABEL_SECONDARY, marginBottom: 10, lineHeight: 1.4 }}>
                Checks every step notifications depend on — VAPID configuration, saved
                preferences, and which devices are subscribed — then optionally sends
                one real test push to confirm delivery end to end.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => runDiagnostic(false)}
                  disabled={diagBusy}
                  style={{
                    all: 'unset', background: '#3A3A3C', color: LABEL_PRIMARY, fontSize: 13.5,
                    fontWeight: 500, padding: '7px 14px', borderRadius: 8,
                    cursor: diagBusy ? 'default' : 'pointer', opacity: diagBusy ? 0.6 : 1,
                  }}
                >
                  {diagBusy ? 'Checking…' : 'Run Checks'}
                </button>
                <button
                  type="button"
                  onClick={() => runDiagnostic(true)}
                  disabled={diagBusy}
                  style={{
                    all: 'unset', background: IOS_BLUE, color: '#fff', fontSize: 13.5,
                    fontWeight: 500, padding: '7px 14px', borderRadius: 8,
                    cursor: diagBusy ? 'default' : 'pointer', opacity: diagBusy ? 0.6 : 1,
                  }}
                >
                  {diagBusy ? 'Sending…' : 'Send Real Test Push'}
                </button>
              </div>

              {diagResults && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {diagResults.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 8,
                        background: r.ok ? 'rgba(48,209,88,0.14)' : 'rgba(255,69,58,0.14)',
                      }}
                    >
                      <span style={{ fontSize: 15, lineHeight: 1.3 }}>{r.ok ? '✅' : '❌'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: LABEL_PRIMARY }}>{r.step}</div>
                        <div style={{ fontSize: 12, color: LABEL_SECONDARY, marginTop: 2, lineHeight: 1.4 }}>{r.detail}</div>
                      </div>
                    </div>
                  ))}
                  {diagSendResults && diagSendResults.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, color: LABEL_SECONDARY, marginTop: 4, fontWeight: 600 }}>
                        Test push results:
                      </div>
                      {diagSendResults.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 8,
                            background: r.ok ? 'rgba(48,209,88,0.14)' : 'rgba(255,69,58,0.14)',
                          }}
                        >
                          <span style={{ fontSize: 15, lineHeight: 1.3 }}>{r.ok ? '✅' : '❌'}</span>
                          <div style={{ fontSize: 12, color: LABEL_SECONDARY, lineHeight: 1.4 }}>{r.detail}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </GroupedCard>

          <GroupLabel>Log Events</GroupLabel>
          <div
            style={{
              opacity: prefs.master_enabled && !loading ? 1 : 0.4,
              pointerEvents: prefs.master_enabled && !loading ? 'auto' : 'none',
              transition: 'opacity 0.2s ease',
            }}
          >
            <GroupedCard>
              {NOTIF_ROWS.map((row, i) => (
                <SettingsRow
                  key={row.key}
                  title={row.label}
                  subtitle={row.description}
                  isLast={i === NOTIF_ROWS.length - 1}
                  right={
                    <IOSSwitch
                      on={notifState[row.key]}
                      label={row.label}
                      onChange={next => toggleNotif(row.key, next)}
                    />
                  }
                />
              ))}
            </GroupedCard>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 16,
              paddingLeft: 2,
            }}
          >
            <button
              type="button"
              onClick={() => toggleAll(true)}
              style={{
                all: 'unset',
                color: IOS_BLUE,
                fontSize: 14.5,
                cursor: 'pointer',
              }}
            >
              Turn On All
            </button>
            <span style={{ color: SEPARATOR }}>|</span>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              style={{
                all: 'unset',
                color: IOS_BLUE,
                fontSize: 14.5,
                cursor: 'pointer',
              }}
            >
              Turn Off All
            </button>
          </div>

          <p
            style={{
              fontSize: 12,
              color: LABEL_SECONDARY,
              margin: '18px 4px 0',
              lineHeight: 1.5,
            }}
          >
            These switches control which Logs events ding your phone. They mirror
            the same signup, subscription, renewal, and cancellation events already
            tracked in the Logs app.
          </p>
        </div>
      )}

      {pane === 'general' && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px 60px' }}>
          <BackHeader title="General" onBack={() => setPane('root')} />

          <GroupLabel>Account</GroupLabel>
          <GroupedCard>
            <SettingsRow
              title="Name"
              right={
                <span style={{ color: LABEL_SECONDARY, fontSize: 14.5 }}>
                  {userLoaded ? displayName : '—'}
                </span>
              }
            />
            <SettingsRow
              title="Email"
              isLast
              right={
                <span style={{ color: LABEL_SECONDARY, fontSize: 14.5 }}>
                  {userLoaded ? (displayEmail || '—') : '—'}
                </span>
              }
            />
          </GroupedCard>

          <GroupLabel>&nbsp;</GroupLabel>
          <GroupedCard>
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                style={{
                  all: 'unset',
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 16px',
                  cursor: 'pointer',
                  minHeight: 44,
                  color: IOS_RED,
                  fontSize: 15.5,
                  textAlign: 'center',
                }}
              >
                Sign Out
              </button>
            </SignOutButton>
          </GroupedCard>
        </div>
      )}

      {EMPTY_PANES.filter(def => def.pane === pane).map(def => (
        <EmptyPane key={def.pane} def={def} onBack={() => setPane('root')} />
      ))}
      </div>
    </div>
  )
}
