import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import DialingModeCTA from '@/components/DialingModeCTA'
import { SITE } from '@/lib/siteTheme'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Dialer Modes (TL;DR): Preview, Power, Progressive, Predictive | DialerSeat',
  description:
    'The four DialerSeat dialing modes in plain English. Preview, power, progressive, and predictive: what each one does and when to use it, summarized simply.',
  alternates: { canonical: 'https://dialerseat.com/faq/dialer-modes' },
  openGraph: {
    title: 'Dialer Modes: The Simple Version',
    description:
      'Preview, power, progressive, predictive, all four dialing modes summarized in plain terms.',
    url: 'https://dialerseat.com/faq/dialer-modes',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialer Modes: The Simple Version',
    description: 'Preview, power, progressive, predictive, all four dialing modes summarized in plain terms.',
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
    color: '${SITE.deep}',
    tagline: 'Auto-dials the next lead the moment you hang up.',
    body:
      'One line per agent. The instant you finish a call, it dials the next lead automatically, no clicking between calls. You control the pace by toggling available / unavailable.',
    best: 'Best for clean lists when you want steady, hands-free volume.',
    href: '/faq/what-is-a-power-dialer',
  },
  {
    key: 'progressive',
    label: 'PROGRESSIVE',
    color: '#1a6a1a',
    tagline: 'Power, but it skips the voicemails for you.',
    body:
      'Same auto-dialing as power, except it listens to each pickup with answering-machine detection and quietly drops voicemails and dead air, only connecting you to real people.',
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

const ACCENT = '${SITE.deep}'

export default function DialerModesTldrPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Faq', url: '/faq' },
        { name: 'Dialer Modes (TL;DR)', url: '/faq/dialer-modes' },
      ])} />
      <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/dialer-modes')} activeHref="/faq/dialer-modes">
      <div className="dmt-root">
        <style>{`
          .dmt-root, .dmt-root * { box-sizing: border-box; }
          .dmt-root {
            background: ${SITE.bg};
            min-height: 100vh;
            font-family: 'Futura PT', Futura, sans-serif;
            color: ${SITE.text};
          }
          .dmt-hero {
            background: linear-gradient(135deg, ${SITE.bg} 0%, ${SITE.surface} 100%);
            color: ${SITE.text};
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
            color: ${SITE.deep};
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
            color: ${SITE.muted};
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
            background: ${SITE.surface};
            border: 1px solid ${SITE.border};
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
            color: ${SITE.text};
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
            color: ${SITE.text};
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
            color: ${SITE.muted};
            line-height: 1.6;
          }
          @media (max-width: 720px) {
            .dmt-hero h1 { font-size: 34px; }
            .dmt-grid { grid-template-columns: 1fr; padding: 36px 18px 18px; }
          }
        

          /* ── INSIDE THE ARTICLE CARD ─────────────────────────────────
             Written when this page WAS the column: its own hero gradient,
             its own centered 780px measure, its own page padding. The card
             owns all of that now, so those rules are unwound here and the
             sections take the blueprint's centered, hairline-separated
             shape. Content that is scanned rather than read goes back to
             left-aligned inside them. */
          .dmt-hero {
            background: transparent;
            padding: 52px 48px 44px;
            border-bottom: 1px solid #e2e4ea;
            overflow: visible;
          }
          .dmt-hero::before { display: none; }
          .dmt-hero-inner { max-width: none; }
          .dmt-hero h1 {
            font-size: 42px; font-weight: 800;
            letter-spacing: -1.4px; line-height: 1.08;
          }
          .dmt-lead {
            max-width: 660px; margin-left: auto; margin-right: auto;
            font-size: 15.5px; line-height: 1.75;
          }
          .dmt-eyebrow { letter-spacing: 3px; font-size: 10px; }

          .dmt-section {
            max-width: none;
            margin: 0;
            padding: 44px 48px;
            border-bottom: 1px solid #e2e4ea;
            text-align: center;
          }
          .dmt-section:last-of-type { border-bottom: none; }
          .dmt-section h2 {
            font-size: 27px; font-weight: 800;
            letter-spacing: -0.6px; line-height: 1.2;
          }
          /* Centered column, left-aligned prose: centered body text past about
             three lines makes the eye hunt for each line start. These pages have
             the longest paragraphs on the site. See components/GutsShell. */
          .dmt-section > p, .dmt-section .inner > p {
            max-width: 660px; margin-left: auto; margin-right: auto;
          }
          .dmt-section p { text-align: left; }
          .dmt-hero .dmt-lead { text-align: center; }
          .dmt-section a { color: #2a6eff; font-weight: 600; }

          /* Scanned, not read. */
          .dmt-section ul, .dmt-section ol, .dmt-section table,
          .dmt-bullets, .dmt-steps, .dmt-pullquote,
          .dmt-shines-grid, .dmt-shines-card,
          .dmt-other-grid, .dmt-other-card,
          .dmt-grid, .dmt-card, .dmt-note, .dmt-best {
            text-align: left;
          }

          .dmt-cta {
            margin: 0;
            padding: 44px 48px;
            border-top: 1px solid #e2e4ea;
            border-radius: 0;
          }

          @media (max-width: 700px) {
            .dmt-hero { padding: 34px 22px 30px; }
            .dmt-hero h1 { font-size: 29px; letter-spacing: -0.8px; }
            .dmt-section { padding: 32px 22px; }
            .dmt-section h2 { font-size: 22px; }
            .dmt-cta { padding: 32px 22px; }
          }
        `}</style>

        <section className="dmt-hero">
          <div className="dmt-hero-inner">
            <div className="dmt-eyebrow">DIALER MODES · TL;DR</div>
          <span style={{ fontSize: 11, color: "${SITE.muted}", letterSpacing: "2px", display: "block", marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>
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
          Not sure which to choose? Power is the safe default: clean, steady, and
          compliant out of the box. Switch to progressive to skip voicemails, or
          predictive once you have a team and want maximum volume.
        </div>

        <DialingModeCTA
          headline="Every account gets every mode."
          description="Pick one, start dialing, and change your mind any time. $35/week per seat, no contract."
        />
        </div>
      </GutsShell>
      <SiteFooter />
    </>
    </>
  )
}
