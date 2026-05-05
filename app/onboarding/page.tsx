'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

const SLIDES = [
  {
    eyebrow: '01 / 03',
    headline: 'IMPORT YOUR LIST IN SECONDS',
    icon: '📥',
    body: `Got a list of leads in a spreadsheet? Drop the CSV in and you are done. We auto-detect the names, phones, and any extra info you want to see during the call. No setup wizard. No "import templates." No tutorials to watch.`,
    sub: 'Works with any CSV. Unlimited leads. Add as many lists as you want.',
  },
  {
    eyebrow: '02 / 03',
    headline: 'CLICK ONE BUTTON. START DIALING.',
    icon: '📞',
    body: `Calls come through your browser. No headset software, no phone app, no PBX, no setup fees. Just plug in a microphone and you are live. We dial. They pick up. You talk. That is the whole thing.`,
    sub: 'Skips voicemails. Marks bad numbers. Keeps you talking, not waiting.',
  },
  {
    eyebrow: '03 / 03',
    headline: 'KNOW EXACTLY WHAT IS WORKING',
    icon: '📊',
    body: `Tag every call in one tap — Closed, Appointment, Not Interested, Do Not Call. Your dashboard tells you which campaigns convert, what your connect rate is, and where your time is best spent. No spreadsheet wrangling. Built in.`,
    sub: 'Every call recorded. Every disposition saved. Yours forever.',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push('/sign-in')
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        if (index < SLIDES.length - 1) setIndex(index + 1)
        else router.push('/billing')
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault()
        setIndex(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, router])

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--background, #0a0a0f)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ds-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ds-onboarding-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 40% at 50% 0%, rgba(74,158,255,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(42,110,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .ds-slide-card {
          animation: ds-fade-up 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .ds-onboarding-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 64px;
          align-items: center;
        }
        @media (min-width: 900px) {
          .ds-onboarding-grid {
            grid-template-columns: 1fr 1fr;
            gap: 80px;
          }
        }
        .ds-icon-stage {
          aspect-ratio: 1 / 1;
          max-width: 360px;
          width: 100%;
          margin: 0 auto;
          border-radius: 32px;
          background: linear-gradient(135deg, rgba(74,158,255,0.08), rgba(42,110,255,0.04));
          border: 1px solid rgba(74,158,255,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 140px;
          box-shadow: 0 20px 80px rgba(74,158,255,0.15), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        @media (min-width: 900px) {
          .ds-icon-stage {
            max-width: 440px;
            font-size: 180px;
          }
        }
        .ds-eyebrow {
          font-size: 11px;
          letter-spacing: 6px;
          color: var(--accent-blue, #4a9eff);
          font-weight: 700;
          margin-bottom: 28px;
        }
        .ds-headline {
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 1.1;
          color: var(--text-primary, #fff);
          margin-bottom: 24px;
        }
        @media (min-width: 900px) {
          .ds-headline { font-size: 48px; letter-spacing: -1.5px; }
        }
        .ds-body {
          font-size: 16px;
          line-height: 1.7;
          color: var(--text-secondary, #a8aab2);
          margin-bottom: 24px;
        }
        @media (min-width: 900px) {
          .ds-body { font-size: 17px; }
        }
        .ds-sub {
          font-size: 12px;
          letter-spacing: 2px;
          color: var(--accent-blue, #4a9eff);
          font-weight: 700;
          padding: 10px 16px;
          background: rgba(74,158,255,0.08);
          border: 1px solid rgba(74,158,255,0.25);
          border-radius: 8px;
          display: inline-block;
        }
        .ds-dots {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .ds-dot {
          width: 32px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.12);
          transition: all 0.3s;
          cursor: pointer;
          border: none;
          padding: 0;
        }
        .ds-dot.active {
          background: var(--accent-blue, #4a9eff);
          box-shadow: 0 0 16px rgba(74,158,255,0.5);
        }
        .ds-cta {
          padding: 18px 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #4a9eff, #2a6eff);
          color: white;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 4px;
          border: none;
          cursor: pointer;
          box-shadow: 0 10px 40px rgba(74,158,255,0.35);
          transition: transform 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .ds-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 50px rgba(74,158,255,0.5);
        }
        .ds-cta:active {
          transform: translateY(0);
        }
        .ds-back-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary, #888a92);
          padding: 18px 24px;
          border-radius: 14px;
          font-size: 12px;
          letter-spacing: 3px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .ds-back-btn:hover {
          color: var(--text-primary, #fff);
          border-color: rgba(255,255,255,0.25);
        }
        .ds-reassurance {
          margin-top: 20px;
          font-size: 11px;
          letter-spacing: 3px;
          color: var(--text-secondary, #666870);
          text-align: center;
        }
        .ds-reassurance strong {
          color: var(--text-primary, #c0c2ca);
          font-weight: 700;
        }
      `}</style>

      <div className="ds-onboarding-bg" />

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 1100,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        {/* SLIDE CONTENT */}
        <div key={index} className="ds-slide-card">
          <div className="ds-onboarding-grid">
            {/* LEFT: ICON STAGE */}
            <div className="ds-icon-stage">
              <span style={{ filter: 'drop-shadow(0 8px 24px rgba(74,158,255,0.4))' }}>
                {slide.icon}
              </span>
            </div>

            {/* RIGHT: COPY */}
            <div>
              <div className="ds-eyebrow">{slide.eyebrow}</div>
              <h1 className="ds-headline">{slide.headline}</h1>
              <p className="ds-body">{slide.body}</p>
              <div className="ds-sub">{slide.sub}</div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div style={{ marginTop: 64 }}>
          {/* DOTS */}
          <div style={{ marginBottom: 32 }}>
            <div className="ds-dots">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  className={`ds-dot ${i === index ? 'active' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* BUTTONS */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            {index > 0 && (
              <button
                className="ds-back-btn"
                onClick={() => setIndex(index - 1)}
                aria-label="Previous slide"
              >
                ← BACK
              </button>
            )}

            {!isLast ? (
              <button
                className="ds-cta"
                onClick={() => setIndex(index + 1)}
              >
                NEXT →
              </button>
            ) : (
              <button
                className="ds-cta"
                onClick={() => router.push('/billing')}
              >
                GET STARTED →
              </button>
            )}
          </div>

          {/* REASSURANCE LINE — only on last slide */}
          {isLast && (
            <div className="ds-reassurance">
              <strong>$35/WEEK</strong> · CANCEL ANYTIME · NO CONTRACTS
            </div>
          )}
        </div>
      </div>
    </main>
  )
}