'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { ArrowLeft, ArrowRight, Check, Code2, TriangleAlert } from 'lucide-react'
import { DevLink, useDevHref, useMainSiteUrl } from './base'
import { DevLogo, api } from './ui'
import { ThemeToggle } from './theme'

/**
 * The first screen after signing in here. Two choices: activate the free
 * developer account (one click; the project and its survey come next), or
 * "Not a developer?", which goes back to dialerseat.com still signed in.
 */
export function WelcomeChoice({ email }: { email: string | null }) {
  const router = useRouter()
  const href = useDevHref()
  const main = useMainSiteUrl()
  const { signOut } = useClerk()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activate = async () => {
    setBusy(true); setError(null)
    try {
      const r = await api<{ next: string }>('/api/developers/activate', { method: 'POST' })
      router.push(href(r.next || '/new'))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <main className="dv-app" style={{ minHeight: '100vh', padding: '40px 16px 64px', background: 'var(--dv-bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 56 }}>
          <DevLink href="/"><DevLogo /></DevLink>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><ThemeToggle /><button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={() => signOut({ redirectUrl: href('/') })}>Sign out</button></span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: 0, fontWeight: 600, letterSpacing: '-.4px' }}>Welcome to DialerSeat for Developers</h1>
          <p className="dv-muted" style={{ fontSize: 16, margin: '14px auto 0', maxWidth: 620, lineHeight: 1.6 }}>
            {email ? <>You&apos;re signed in as <span style={{ color: 'var(--dv-text)' }}>{email}</span>. </> : null}
            This is where CRMs and platforms put the DialerSeat dialer inside their own product.
          </p>
        </div>

        <div className="dv-welcome-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 18 }}>
          <div className="dv-card" style={{ padding: 28, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--dv-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Code2 size={20} color="var(--dv-accent)" /></span>
            <h2 style={{ fontSize: 20, margin: '16px 0 6px', fontWeight: 600 }}>Activate your developer account</h2>
            <p className="dv-muted" style={{ fontSize: 14, margin: 0, lineHeight: 1.6, flex: 1 }}>
              Free. Next you create your first project: a few questions about what you are building, then your test keys and a guided setup. Nothing dials until you turn on live dialing.
            </p>
            {error && <div className="dv-alert dv-alert-amber" style={{ marginTop: 16 }}><TriangleAlert size={16} color="var(--dv-amber)" />{error}</div>}
            <button type="button" onClick={activate} className="dv-btn dv-btn-primary dv-btn-lg" disabled={busy} style={{ width: '100%', marginTop: 22 }}>
              {busy ? 'Activating…' : <>Activate developer account <ArrowRight size={16} /></>}
            </button>
            <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'grid', gap: 8, fontSize: 13 }} className="dv-muted">
              {['No card, no charge', 'Separate from your dialerseat.com account', 'Your own dialer on dialerseat.com is unaffected'].map(s => (
                <li key={s} style={{ display: 'flex', gap: 8 }}><Check size={14} color="var(--dv-green)" style={{ marginTop: 2 }} />{s}</li>
              ))}
            </ul>
          </div>

          <div className="dv-card" style={{ padding: 28, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--dv-panel-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={20} color="var(--dv-muted)" /></span>
            <h2 style={{ fontSize: 20, margin: '16px 0 6px', fontWeight: 600 }}>Not a developer?</h2>
            <p className="dv-muted" style={{ fontSize: 14, margin: 0, lineHeight: 1.6, flex: 1 }}>
              If you came to dial, you want dialerseat.com. You&apos;ll stay signed in. If you have a plan, you go straight to your dashboard. If not, you&apos;ll see the demo.
            </p>
            <a href={main} className="dv-btn dv-btn-lg" style={{ width: '100%', marginTop: 22 }}>Take me to dialerseat.com</a>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 820px) { .dv-welcome-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </main>
  )
}
