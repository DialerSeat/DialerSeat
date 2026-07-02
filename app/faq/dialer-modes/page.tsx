import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Dialer Modes (TL;DR) — Preview, Power, Progressive, Predictive | DialerSeat',
  description:
    'The four DialerSeat dialing modes in plain English. Preview, power, progressive, and predictive — what each one does and when to use it, summarized simply.',
  alternates: { canonical: 'https://dialerseat.com/faq/dialer-modes' },
  openGraph: {
    title: 'Dialer Modes — The Simple Version',
    description:
      'Preview, power, progressive, predictive — all four dialing modes summarized in plain terms.',
    url: 'https://dialerseat.com/faq/dialer-modes',
    type: 'article',
  },
}

const MODES = [
  {
    key: 'preview',
    label: 'PREVIEW',
    color: '#5a5e6a',
    tagline: 'See the lead first, then dial.',
    body:
      'The dialer shows you each lead before anything rings. You read their info, get ready, and press dial when you want to. One call at a time, fully at your pace.',
    best: 'Best for high-value or complex calls where prep matters more than speed.',
    href: '/faq/what-is-a-preview-dialer',
  },
  {
    key: 'power',
    label: 'POWER',
    color: '#2a4a8a',
    tagline: 'Auto-dials the next lead the moment you hang up.',
    body:
      'One line per agent. The instant you finish a call, it dials the next lead automatically — no clicking between calls. You control the pace by toggling available / unavailable.',
    best: 'Best for clean lists when you want steady, hands-free volume.',
    href: '/faq/what-is-a-power-dialer',
  },
  {
    key: 'progressive',
    label: 'PROGRESSIVE',
    color: '#1a6a1a',
    tagline: 'Power, but it skips the voicemails for you.',
    body:
      'Same auto-dialing as power, except it listens to each pickup with answering-machine detection and quietly drops voicemails and dead air — only connecting you to real people.',
    best: 'Best when you want power-style volume without wasting time on machines.',
    href: '/faq/what-is-a-progressive-dialer',
  },
  {
    key: 'predictive',
    label: 'PREDICTIVE',
    color: '#8a1a1a',
    tagline: 'Dials several lines at once, connects you to live humans.',
    body:
      'The highest-volume mode. It dials multiple lines per agent and uses pacing math to hand you a call only when a real person answers. A built-in abandon-rate cap keeps it compliant.',
    best: 'Best for big, well-staffed campaigns focused on maximum live conversations.',
    href: '/faq/what-is-a-predictive-dialer',
  },
]

const ACCENT = '#2a4a8a'

export default function DialerModesTldrPage() {
  return (
    <>
      <SiteHeader />
      <main className="dmt-root">
        <style>{`
          .dmt-root, .dmt-root * { box-sizing: border-box; }
          .dmt-root {
            background: #f0f1f4;
            min-height: 100vh;
            font-family: 'Futura PT', Futura, sans-serif;
            color: #1a1c24;
          }
          .dmt-hero {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 84px 32px 64px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .dmt-hero::before {
            content: '';
            position: absolute; inset: 0;
            background: radial-gradient(circle at 30% 30%, ${ACCENT}44 0%, transparent 55%);
          }
          .dmt-hero-inner { position: relative; max-width: 760px; margin: 0 auto; }
          .dmt-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: ${ACCENT}33;
            border: 1px solid ${ACCENT};
            border-radius: 4px;
            color: #9ab4e0;
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 22px;
          }
          .dmt-hero h1 {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: -1px;
            line-height: 1.05;
            margin: 0 0 18px 0;
          }
          .dmt-lead {
            font-size: 17px;
            line-height: 1.55;
            color: #c4c8d8;
            max-width: 600px;
            margin: 0 auto;
          }
          .dmt-grid {
            max-width: 880px;
            margin: 0 auto;
            padding: 56px 24px 24px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }
          .dmt-card {
            background: white;
            border: 1px solid #e4e6ec;
            border-top: 4px solid var(--mc);
            border-radius: 10px;
            padding: 24px 24px 20px;
            display: flex;
            flex-direction: column;
          }
          .dmt-pill {
            display: inline-block;
            align-self: flex-start;
            font-size: 11px;
            letter-spacing: 2px;
            font-weight: 800;
            color: white;
            background: var(--mc);
            border-radius: 4px;
            padding: 4px 10px;
            margin-bottom: 12px;
          }
          .dmt-tagline {
            font-size: 17px;
            font-weight: 800;
            letter-spacing: -0.2px;
            margin: 0 0 10px 0;
            color: #1a1c24;
          }
          .dmt-body {
            font-size: 14px;
            line-height: 1.65;
            color: #3a3f4a;
            margin: 0 0 12px 0;
          }
          .dmt-best {
            font-size: 13px;
            line-height: 1.55;
            color: var(--mc);
            font-weight: 600;
            margin: 0 0 16px 0;
          }
          .dmt-link {
            margin-top: auto;
            font-size: 11px;
            letter-spacing: 1.5px;
            font-weight: bold;
            color: var(--mc);
            text-decoration: none;
          }
          .dmt-link:hover { text-decoration: underline; }
          .dmt-note {
            max-width: 880px;
            margin: 0 auto;
            padding: 8px 24px 64px;
            text-align: center;
            font-size: 13px;
            color: #5a5e6a;
            line-height: 1.6;
          }
          @media (max-width: 720px) {
            .dmt-hero h1 { font-size: 34px; }
            .dmt-grid { grid-template-columns: 1fr; padding: 36px 18px 18px; }
          }
        `}</style>

        <section className="dmt-hero">
          <div className="dmt-hero-inner">
            <div className="dmt-eyebrow">DIALER MODES · TL;DR</div>
            <h1>The four modes, in plain English.</h1>
            <p className="dmt-lead">
              DialerSeat has four ways to dial. Here&apos;s the simple version of
              what each one does and when to pick it. You can change a
              campaign&apos;s mode any time.
            </p>
          </div>
        </section>

        <div className="dmt-grid">
          {MODES.map(m => (
            <div key={m.key} className="dmt-card" style={{ ['--mc' as any]: m.color }}>
              <span className="dmt-pill">{m.label}</span>
              <h2 className="dmt-tagline">{m.tagline}</h2>
              <p className="dmt-body">{m.body}</p>
              <p className="dmt-best">{m.best}</p>
              <Link href={m.href} className="dmt-link">FULL BREAKDOWN ↗</Link>
            </div>
          ))}
        </div>

        <div className="dmt-note">
          Not sure which to choose? Power is the safe default — clean, steady, and
          compliant out of the box. Switch to progressive to skip voicemails, or
          predictive once you have a team and want maximum volume.
        </div>

        <DialingModeCTA
          headline="Every account gets every mode."
          description="Pick one, start dialing, and change your mind any time. $35/week per seat, no contract."
        />
      </main>
      <SiteFooter />
    </>
  )
}
