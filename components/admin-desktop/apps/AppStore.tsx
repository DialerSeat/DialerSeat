'use client'
import { useState } from 'react'
import { APPS } from '../registry'
import {
  STORE_APP_IDS,
  APP_STORE_ID,
  isBaseApp,
  useDesktopServices,
} from '../desktopServices'
import type { AppId } from '../types'

// =============================================================================
// APP STORE — desktop app
// =============================================================================
// v1.1 changes vs v1:
// - Lives at components/admin-desktop/apps/AppStore.tsx — imports adjusted
//   to ../registry, ../desktopServices, ../types
// - Descriptions read from the registry's AppDefinition.description (the
//   separate APP_DESCRIPTIONS map is gone)
//
// Two tabs:
//   STORE     — downloadable apps (registry apps listed in STORE_APP_IDS).
//               DOWNLOAD installs; installed store apps show OPEN + UNINSTALL.
//   INSTALLED — every installed app (base + downloaded). Each row offers
//               OPEN, ADD TO DESKTOP / REMOVE FROM DESKTOP, and UNINSTALL
//               (store apps only — base apps, including this App Store,
//               can never be uninstalled).
// Talks to the Desktop shell through DesktopServicesContext.
// =============================================================================

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
}

type Tab = 'store' | 'installed'

export default function AppStoreApp() {
  const services = useDesktopServices()
  const [tab, setTab] = useState<Tab>('store')
  const [downloading, setDownloading] = useState<string | null>(null)

  if (!services) {
    return (
      <div style={{
        width: '100%', height: '100%', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Futura PT, Futura, sans-serif',
        fontSize: 11, letterSpacing: 3, color: T.muted,
      }}>
        APP STORE REQUIRES THE DESKTOP SHELL
      </div>
    )
  }

  const {
    installedAppIds, hiddenAppIds,
    installApp, uninstallApp, addToDesktop, removeFromDesktop, openApp,
  } = services

  const isInstalled = (id: AppId) => isBaseApp(id) || installedAppIds.includes(id)
  const isOnDesktop = (id: AppId) => isInstalled(id) && !hiddenAppIds.includes(id)

  const storeApps = APPS.filter(a => STORE_APP_IDS.includes(a.id))
  const installedApps = APPS.filter(a => isInstalled(a.id))

  const handleDownload = (id: AppId) => {
    setDownloading(id)
    // Brief delay purely for download feel — install is instant
    setTimeout(() => {
      installApp(id)
      setDownloading(null)
    }, 700)
  }

  const btnStyle = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: 9, letterSpacing: 2, fontWeight: 'bold',
    fontFamily: 'Futura PT, Futura, sans-serif',
    borderRadius: 4, cursor: 'pointer',
    border: '1px solid ' + (variant === 'danger' ? T.red : variant === 'primary' ? T.accent : T.border),
    background: variant === 'primary' ? T.accent : 'transparent',
    color: variant === 'primary' ? 'white' : variant === 'danger' ? T.red : T.text,
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg,
      display: 'flex', flexDirection: 'column', overflow: 'auto',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <div style={{
        background: T.dark, padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
        display: 'flex', alignItems: 'center', gap: 16,
        justifyContent: 'space-between', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
          APP STORE
        </span>
        <div style={{
          display: 'flex', gap: 4, padding: 3, borderRadius: 4,
          background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2c34',
        }}>
          {(['store', 'installed'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '5px 12px', border: 'none', borderRadius: 3,
                background: tab === t ? T.blue : 'transparent',
                color: tab === t ? 'white' : '#8888aa',
                fontSize: 9, letterSpacing: 2, fontWeight: 'bold',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
              }}
            >
              {t === 'store' ? 'STORE' : `INSTALLED (${installedApps.length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tab === 'store' && (
          storeApps.length === 0 ? (
            <div style={{
              padding: 48, textAlign: 'center',
              background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 4,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🛍️</div>
              <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: T.muted, marginBottom: 6 }}>
                NOTHING IN THE STORE YET
              </div>
              <div style={{ fontSize: 11, color: T.muted, maxWidth: 380, margin: '0 auto', lineHeight: 1.5 }}>
                Downloadable apps appear here. Register the app in registry.tsx, then add its id to STORE_APP_IDS in desktopServices.tsx.
              </div>
            </div>
          ) : (
            storeApps.map(app => {
              const installed = isInstalled(app.id)
              const busy = downloading === app.id
              return (
                <div key={app.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: 14, background: T.surface,
                  border: `1px solid ${T.border}`, borderRadius: 4,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, background: app.iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                  }}>{app.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: T.text }}>
                      {app.name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                      {app.description}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {installed ? (
                      <>
                        <button style={btnStyle('ghost')} onClick={() => openApp(app.id)}>OPEN</button>
                        <button style={btnStyle('danger')} onClick={() => uninstallApp(app.id)}>UNINSTALL</button>
                      </>
                    ) : (
                      <button
                        style={{ ...btnStyle('primary'), opacity: busy ? 0.7 : 1 }}
                        onClick={() => !busy && handleDownload(app.id)}
                      >
                        {busy ? 'DOWNLOADING...' : 'DOWNLOAD'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )
        )}

        {tab === 'installed' && (
          installedApps.map(app => {
            const base = isBaseApp(app.id)
            const onDesktop = isOnDesktop(app.id)
            return (
              <div key={app.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 14, background: T.surface,
                border: `1px solid ${T.border}`, borderRadius: 4,
                flexWrap: 'wrap',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 8, background: app.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                }}>{app.icon}</div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: T.text }}>
                      {app.name.toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: 8, letterSpacing: 2, fontWeight: 'bold',
                      padding: '2px 6px', borderRadius: 3,
                      background: base ? '#363647' : T.accent, color: 'white',
                    }}>
                      {base ? 'BASE' : 'STORE'}
                    </span>
                    <span style={{
                      fontSize: 8, letterSpacing: 2, fontWeight: 'bold',
                      padding: '2px 6px', borderRadius: 3,
                      border: `1px solid ${onDesktop ? T.green : T.border}`,
                      color: onDesktop ? T.green : T.muted,
                    }}>
                      {onDesktop ? 'ON DESKTOP' : 'NOT ON DESKTOP'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                    {app.description}
                    {app.id === APP_STORE_ID && ' — cannot be uninstalled.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={btnStyle('ghost')} onClick={() => openApp(app.id)}>OPEN</button>
                  {onDesktop ? (
                    <button style={btnStyle('ghost')} onClick={() => removeFromDesktop(app.id)}>
                      REMOVE FROM DESKTOP
                    </button>
                  ) : (
                    <button style={btnStyle('primary')} onClick={() => addToDesktop(app.id)}>
                      ADD TO DESKTOP
                    </button>
                  )}
                  {!base && (
                    <button style={btnStyle('danger')} onClick={() => uninstallApp(app.id)}>UNINSTALL</button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}