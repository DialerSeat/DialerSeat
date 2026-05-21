import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'

// =============================================================================
// BUILD FIX — force-dynamic to bypass static-generation hang
// =============================================================================
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'FAQ — DialerSeat',
  description: 'Frequently asked questions about DialerSeat: pricing, dialing modes, compliance, billing, team management, and more.',
  alternates: {
    canonical: 'https://dialerseat.com/faq',
  },
  robots: {
    // index: false until we have actual content
    index: false,
    follow: true,
  },
}

export default function FaqPage() {
  return (
    <>
      <SiteHeader />
      <main style={{
        background: '#f0f1f4',
        minHeight: '100vh',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: '#1a1c24',
      }}>
        <style>{`
          .faq-root * { box-sizing: border-box; }
          .faq-hero {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 100px 32px 80px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .faq-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 30% 30%, rgba(74,158,255,0.15) 0%, transparent 50%);
          }
          .faq-hero-inner { position: relative; max-width: 720px; margin: 0 auto; }
          .faq-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.15);
            border: 1px solid #4a9eff;
            border-radius: 4px;
            color: #4a9eff;
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .faq-hero h1 {
            font-size: 56px;
            font-weight: 800;
            letter-spacing: -1px;
            line-height: 1.05;
            margin: 0 0 20px 0;
          }
          .faq-hero p {
            font-size: 17px;
            line-height: 1.55;
            color: #c4c8d8;
            max-width: 580px;
            margin: 0 auto;
          }
          .faq-body {
            max-width: 760px;
            margin: 0 auto;
            padding: 80px 32px;
            text-align: center;
          }
          .faq-placeholder {
            background: white;
            border: 1px dashed #c4c8d0;
            border-radius: 12px;
            padding: 60px 32px;
            color: #5a5e6a;
          }
          .faq-placeholder-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .faq-placeholder h2 {
            font-size: 22px;
            font-weight: 800;
            color: #1a1c24;
            margin: 0 0 12px 0;
            letter-spacing: -0.3px;
          }
          .faq-placeholder p {
            font-size: 15px;
            line-height: 1.7;
            color: #5a5e6a;
            margin: 0 0 24px 0;
          }
          .faq-cta-row {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .faq-btn-primary {
            padding: 14px 28px;
            background: linear-gradient(135deg, #4a9eff, #2a6eff);
            color: white;
            font-size: 12px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
          }
          .faq-btn-secondary {
            padding: 14px 28px;
            background: transparent;
            color: #1a1c24;
            border: 1px solid #c4c8d0;
            font-size: 12px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
          }
          @media (max-width: 768px) {
            .faq-hero { padding: 64px 20px 56px; }
            .faq-hero h1 { font-size: 36px; }
            .faq-hero p { font-size: 15px; }
            .faq-body { padding: 56px 20px; }
            .faq-placeholder { padding: 40px 24px; }
            .faq-btn-primary, .faq-btn-secondary { width: 100%; box-sizing: border-box; }
          }
        `}</style>

        <div className="faq-root">
          <div className="faq-hero">
            <div className="faq-hero-inner">
              <div className="faq-eyebrow">FREQUENTLY ASKED QUESTIONS</div>
              <h1>Got questions?</h1>
              <p>
                Answers to the most common questions about DialerSeat™ — pricing,
                dialing modes, compliance, billing, and team setup.
              </p>
            </div>
          </div>

          <div className="faq-body">
            <div className="faq-placeholder">
              <div className="faq-placeholder-icon">🚧</div>
              <h2>Coming soon</h2>
              <p>
                We're putting together a proper FAQ. In the meantime, check the
                feature comparisons or just sign up — you can cancel any time.
              </p>
              <div className="faq-cta-row">
                <Link href="/sign-up" className="faq-btn-primary">START DIALING →</Link>
                <Link href="/vs" className="faq-btn-secondary">SEE COMPARISONS</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}