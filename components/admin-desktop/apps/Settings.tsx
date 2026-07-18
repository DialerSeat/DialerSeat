'use client'
import { useState, useEffect, useCallback } from 'react'
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

const IOS_BLUE = '#007AFF'
const IOS_GREEN = '#34C759'
const IOS_RED = '#FF3B30'
const GROUP_BG = '#F2F2F7'
const CARD_BG = '#FFFFFF'
const LABEL_PRIMARY = '#000000'
const LABEL_SECONDARY = '#8E8E93'
const SEPARATOR = 'rgba(60, 60, 67, 0.29)'

const SF_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif'

type NotifKey = 'signup' | 'new_sub' | 'resub' | 'renewal' | 'cancel'

interface NotifRow {
  key: NotifKey
  label: string
  description: string
}

const NOTIF_ROWS: NotifRow[] = [
  { key: 'signup', label: 'New Sign-Ups', description: 'Someone creates a DialerSeat account' },
  { key: 'new_sub', label: 'New Subscriptions', description: 'A first-time paid subscription starts' },
  { key: 'resub', label: 'Resubscriptions', description: 'A lapsed customer subscribes again' },
  { key: 'renewal', label: 'Renewals', description: 'A weekly subscription payment goes through' },
  { key: 'cancel', label: 'Cancellations', description: 'A customer cancels their subscription' },
]

interface PrefsResponse {
  master_enabled: boolean
  signup: boolean
  new_sub: boolean
  resub: boolean
  renewal: boolean
  cancel: boolean
}

const DEFAULT_PREFS: PrefsResponse = {
  master_enabled: true,
  signup: true,
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

type PushDeviceStatus = 'unknown' | 'unsupported' | 'not_subscribed' | 'subscribed' | 'denied'

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
      <span style={{ color: '#C7C7CC', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>›</span>
    </button>
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
        boxShadow: '0 0 0 0.5px rgba(0,0,0,0.04)',
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

type SettingsPane = 'root' | 'general' | 'notifications' | 'privacy'

export default function SettingsApp() {
  const { user, isLoaded: userLoaded } = useUser()
  const [pane, setPane] = useState<SettingsPane>('root')

  const [prefs, setPrefs] = useState<PrefsResponse>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())

  const [deviceStatus, setDeviceStatus] = useState<PushDeviceStatus>('unknown')
  const [deviceBusy, setDeviceBusy] = useState(false)
  const [deviceError, setDeviceError] = useState<string | null>(null)

  const notifState: Record<NotifKey, boolean> = {
    signup: prefs.signup,
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
        setDeviceStatus(existing ? 'subscribed' : 'not_subscribed')
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
    savePref({ signup: next, new_sub: next, resub: next, renewal: next, cancel: next })
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

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: GROUP_BG,
        fontFamily: SF_STACK,
        WebkitFontSmoothing: 'antialiased',
        overflowY: 'auto',
        color: LABEL_PRIMARY,
      }}
    >
      {pane === 'root' && (
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
                      background: '#D1D1D6',
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
              <span style={{ color: '#C7C7CC', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>›</span>
            </button>
          </GroupedCard>

          <GroupLabel>&nbsp;</GroupLabel>
          <GroupedCard>
            <NavRow
              icon="⚙️"
              iconBg={`linear-gradient(135deg, #8E8E93, #636366)`}
              title="General"
              subtitle="Account, sign out"
              onClick={() => setPane('general')}
            />
            <NavRow
              icon="🔔"
              iconBg={`linear-gradient(135deg, ${IOS_RED}, #C41E1E)`}
              title="Notifications"
              subtitle={prefs.master_enabled ? `${enabledCount} of ${NOTIF_ROWS.length} on` : 'Off'}
              onClick={() => setPane('notifications')}
            />
            <NavRow
              icon="🔒"
              iconBg="linear-gradient(135deg, #8E8E93, #636366)"
              title="Privacy & Security"
              subtitle="Coming soon"
              onClick={() => setPane('privacy')}
              isLast
            />
          </GroupedCard>
        </div>
      )}

      {pane === 'notifications' && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px 60px' }}>
          <BackHeader title="Notifications" onBack={() => setPane('root')} />

          {loadError && (
            <div
              style={{
                background: '#FFF3F2',
                border: `1px solid ${IOS_RED}33`,
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
                : deviceStatus === 'denied' ? 'Notifications Blocked'
                : deviceStatus === 'unsupported' ? 'Not Supported'
                : 'Push Not Enabled'
              }
              subtitle={
                deviceStatus === 'subscribed'
                  ? 'This device will receive alerts, even when DialerSeat is closed.'
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

      {pane === 'privacy' && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px 60px' }}>
          <BackHeader title="Privacy & Security" onBack={() => setPane('root')} />

          <GroupedCard>
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
              <div style={{ fontSize: 15, color: LABEL_PRIMARY, fontWeight: 500, marginBottom: 4 }}>
                Nothing to configure yet
              </div>
              <div style={{ fontSize: 12.5, color: LABEL_SECONDARY, lineHeight: 1.5 }}>
                This section is reserved for upcoming controls — session management,
                admin access logs, and similar. Nothing here does anything yet, so
                there's nothing to toggle on this screen for now.
              </div>
            </div>
          </GroupedCard>
        </div>
      )}
    </div>
  )
}
