'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { ArrowLeft, ArrowRight, Check, Code2, KeyRound, TriangleAlert } from 'lucide-react'
import { DevLink, useDevHref, useMainSiteUrl } from './base'
import { CopyButton, DevLogo, api } from './ui'
import { ThemeToggle } from './theme'

export function WelcomeChoice({ email }: { email: string | null }) {
  const router = useRouter()
  const href = useDevHref()
  const main = useMainSiteUrl()
  const { signOut } = useClerk()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keys, setKeys] = useState<{ secret_key: string; publishable_key: string } | null>(null)
  const [saved, setSaved] = useState(false)

  const activate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await api<{ secret_key: string; publishable_key: string }>('/api/developers/activate', { method: 'POST', body: { name, website } })
      setKeys(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="dv-app" style={{ minHeight: '100vh', padding: '40px 16px 64px', background: 'radial-gradient(900px 400px at 50% -10%, rgba(74,158,255,.15), transparent 70%), var(--dv-bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 56 }}>
          <DevLink href="/"><DevLogo /></DevLink>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><ThemeToggle /><button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={() => signOut({ redirectUrl: href('/') })}>Sign out</button></span>
        </div>

        {!keys ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: 0, fontWeight: 600, letterSpacing: '-.4px' }}>Welcome to DialerSeat for Developers</h1>
              <p className="dv-muted" style={{ fontSize: 16, margin: '14px auto 0', maxWidth: 620, lineHeight: 1.6 }}>
                {email ? <>You&apos;re signed in as <span style={{ color: 'var(--dv-text)' }}>{email}</span>. </> : null}
                This is where CRMs and platforms put the DialerSeat dialer inside their own product.
              </p>
            </div>

            <div className="dv-welcome-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 18 }}>
              <form onSubmit={activate} className="dv-card" style={{ padding: 28 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--dv-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Code2 size={20} color="var(--dv-accent)" /></span>
                <h2 style={{ fontSize: 20, margin: '16px 0 6px', fontWeight: 600 }}>Activate your developer account</h2>
                <p className="dv-muted" style={{ fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
                  Free. You get test keys now and every part of the console and API. Nothing dials until you activate live dialing.
                </p>
                <div className="dv-stack">
                  <div>
                    <label className="dv-label" htmlFor="pname">Platform or company name</label>
                    <input id="pname" className="dv-input" value={name} onChange={e => setName(e.target.value)} placeholder="Acme CRM" required maxLength={80} autoFocus />
                  </div>
                  <div>
                    <label className="dv-label" htmlFor="pweb">Website <span className="dv-dim">(optional)</span></label>
                    <input id="pweb" className="dv-input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://acme.com" maxLength={200} />
                  </div>
                </div>
                {error && <div className="dv-alert dv-alert-amber" style={{ marginTop: 16 }}><TriangleAlert size={16} color="var(--dv-amber)" />{error}</div>}
                <button type="submit" className="dv-btn dv-btn-primary dv-btn-lg" disabled={busy || !name.trim()} style={{ width: '100%', marginTop: 22 }}>
                  {busy ? 'Activating…' : <>Activate developer account <ArrowRight size={16} /></>}
                </button>
                <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'grid', gap: 8, fontSize: 13 }} className="dv-muted">
                  {['No card, no charge', 'Separate from your dialerseat.com account', 'Your own dialer on dialerseat.com is unaffected'].map(s => (
                    <li key={s} style={{ display: 'flex', gap: 8 }}><Check size={14} color="var(--dv-green)" style={{ marginTop: 2 }} />{s}</li>
                  ))}
                </ul>
              </form>

              <div className="dv-card" style={{ padding: 28, display: 'flex', flexDirection: 'column' }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--dv-panel-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={20} color="var(--dv-muted)" /></span>
                <h2 style={{ fontSize: 20, margin: '16px 0 6px', fontWeight: 600 }}>Not a developer?</h2>
                <p className="dv-muted" style={{ fontSize: 14, margin: 0, lineHeight: 1.6, flex: 1 }}>
                  If you came to dial, you want dialerseat.com. You&apos;ll stay signed in. If you have a plan, you go straight to your dashboard. If not, you&apos;ll see the demo.
                </p>
                <a href={main} className="dv-btn dv-btn-lg" style={{ width: '100%', marginTop: 22 }}>Take me to dialerseat.com</a>
              </div>
            </div>
          </>
        ) : (
          <div className="dv-card" style={{ maxWidth: 640, margin: '0 auto', padding: 32 }}>
            <span className="dv-badge dv-badge-green"><span className="dv-dot" /> Developer account active</span>
            <h1 style={{ fontSize: 26, margin: '16px 0 8px', fontWeight: 600 }}>Your test keys</h1>
            <p className="dv-muted" style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }}>
              Copy the secret key now and keep it on your server. <strong style={{ color: 'var(--dv-text)' }}>It will not be shown again.</strong> You can make new keys any time in the console.
            </p>
            <KeyRow label="Secret key" value={keys.secret_key} secret />
            <KeyRow label="Publishable key" value={keys.publishable_key} />
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, margin: '22px 0 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#4a9eff' }} />
              I&apos;ve saved my secret key somewhere safe
            </label>
            <button type="button" className="dv-btn dv-btn-primary dv-btn-lg" disabled={!saved} style={{ width: '100%', marginTop: 20 }} onClick={() => { router.push(href('/console')); router.refresh() }}>
              Open the console <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
      <style>{`@media (max-width: 820px) { .dv-welcome-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </main>
  )
}

function KeyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="dv-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><KeyRound size={13} /> {label}</div>
      <div className="dv-inset" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 12px', borderColor: secret ? 'rgba(251,191,36,.35)' : undefined }}>
        <code style={{ flex: 1, fontSize: 13, overflowX: 'auto', whiteSpace: 'nowrap' }}>{value}</code>
        <CopyButton text={value} label="Copy" />
      </div>
    </div>
  )
}
