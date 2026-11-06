'use client'
// ── BUILDING YOUR SUBDOMAIN ───────────────────────────────────────────────
// A new subdomain is a dead link until its certificate is issued, which takes
// anywhere from a few seconds to a minute or so. Sending someone straight there
// looked broken and took several refreshes. So they wait here: a countdown for
// the usual time, and a check that moves them on the moment it really answers.
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { t } from '@/lib/i18n/client'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const SANDBOX = process.env.NEXT_PUBLIC_SANDBOX === '1'
const SECONDS = 30
const GIVE_UP_AT = 180

function Building() {
  const slug = (useSearchParams().get('slug') || '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const host = `${slug}.${ROOT_DOMAIN}`
  const target = !slug || SANDBOX ? '/dashboard/teams' : `https://${host}/dashboard/teams`
  const [elapsed, setElapsed] = useState(0)
  const [ready, setReady] = useState(false)
  const going = useRef(false)

  useEffect(() => {
    const tick = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (!slug) { window.location.assign(target); return }
    let stopped = false
    const check = async () => {
      if (going.current || stopped) return
      const answer = SANDBOX
        ? { ready: performance.now() > 8000 }
        : await fetch(`/api/whitelabel/domain-ready?slug=${encodeURIComponent(slug)}`).then(r => r.json()).catch(() => ({ ready: false }))
      if (!answer.ready || stopped) return
      // This browser has to be able to reach it too, not only our server.
      if (!SANDBOX) {
        const reachable = await fetch(`https://${host}/sign-in`, { mode: 'no-cors', cache: 'no-store' }).then(() => true).catch(() => false)
        if (!reachable || stopped) return
      }
      going.current = true
      setReady(true)
      setTimeout(() => window.location.assign(target), 900)
    }
    void check()
    const poll = setInterval(check, 3000)
    return () => { stopped = true; clearInterval(poll) }
  }, [slug, host, target])

  const left = Math.max(0, SECONDS - elapsed)
  const stuck = elapsed >= GIVE_UP_AT
  return (
    <main style={{ minHeight: '100vh', background: '#0d0e14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: FUTURA }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#1a1c24', border: '1px solid #2a2c34', borderTop: '3px solid #4a9eff', borderRadius: 4, padding: 40, color: '#e0e2ea', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: '#4a9eff', marginBottom: 14 }}>
          {ready ? t("REDIRECTING NOW") : t("BUILDING YOUR SUBDOMAIN")}
        </div>
        <div style={{ fontSize: 15, marginBottom: 22, overflowWrap: 'anywhere' }}>{host}</div>
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, marginBottom: 22, fontVariantNumeric: 'tabular-nums' }}>{ready ? '✓' : left}</div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8acb8', margin: 0 }}>
          {ready ? t("Your subdomain is ready.")
            : stuck ? t("This is taking longer than usual. Your subdomain is saved, and it can take a few minutes to come online.")
            : left > 0 ? t("This usually takes about 30 seconds. Keep this page open and we will take you there automatically.")
            : t("Almost there. We will take you there as soon as it answers.")}
        </p>
        {stuck && !ready && (
          <a href={target} style={{ display: 'inline-block', marginTop: 20, padding: '11px 18px', borderRadius: 5, background: '#4a9eff', color: '#0d0e14', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textDecoration: 'none' }}>
            {t("TRY MY SUBDOMAIN")}
          </a>
        )}
      </div>
    </main>
  )
}

export default function BuildingPage() {
  return <Suspense fallback={null}><Building /></Suspense>
}
