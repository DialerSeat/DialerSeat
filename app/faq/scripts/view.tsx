'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'


export default function ScriptsFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/scripts')} activeHref="/faq/scripts">
        <FaqTheme />
        <style>{`
/* OWNERSHIP CARDS */
          .scr-owner-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0 8px; }
          .scr-owner-card { background: ${SITE.surface}; border: 1px solid ${SITE.border}; border-radius: 8px; padding: 22px 22px; }
          .scr-owner-card h4 { font-size: 15px; margin: 0 0 8px 0; font-weight: 700; color: ${SITE.deep}; }
          .scr-owner-card p { font-size: 14px; line-height: 1.65; margin: 0; color: ${SITE.muted}; }

          /* MOCKUP CARD */
          .scr-mockup {
            margin: 28px 0; background: ${SITE.ink}; border-radius: 10px; overflow: hidden;
            box-shadow: 0 20px 50px rgba(20,20,40,0.18);
          }
          .scr-mockup-bar { display: flex; gap: 6px; padding: 12px 16px; background: #111225; }
          .scr-mockup-dot { width: 10px; height: 10px; border-radius: 50%; }
          .scr-mockup-body { padding: 4px 20px 20px; }
          .scr-mockup-tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
          .scr-mockup-tab {
            padding: 6px 14px; border-radius: 5px; font-size: 11px; font-weight: 700;
            letter-spacing: 0.5px; color: #8a8ea8; background: #1f2140;
          }
          .scr-mockup-tab.active { background: #4a5aff; color: white; }
          .scr-mockup-text {
            color: #d8dae8; font-size: 14px; line-height: 1.7; font-family: monospace;
            background: #14162a; border-radius: 6px; padding: 16px 18px;
          }@media (max-width: 768px) {
            .scr-owner-grid { grid-template-columns: 1fr; }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">▸ CALL SCRIPTS</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            Write it once. See it on <em>every</em> call, without alt-tabbing.
          </h1>

          <p className="faq-deck">
            Scripts live inside the dialer itself, right next to the lead
            profile, not in a separate doc you keep switching to mid-call.
            Write as many as you want, attach them to whichever campaigns
            need them, and control which one shows first.
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">INCLUDED ON EVERY PLAN</span>
            <span className="faq-badge">PERSONAL OR TEAM-SHARED</span>
            <span className="faq-badge">MULTIPLE SCRIPTS PER CAMPAIGN</span>
            <span className="faq-badge">REORDERABLE</span>
          </div>

          {/* ── WHAT IT LOOKS LIKE ─────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHAT AN AGENT ACTUALLY SEES</h2>
            <p>
              The active script for a campaign shows up in the lead profile
              panel, right there during the call. If a campaign has more
              than one script attached: say, different angles for
              different lead types, they show as tabs an agent can flip
              between without breaking their flow.
            </p>

            <div className="scr-mockup">
              <div className="scr-mockup-bar">
                <div className="scr-mockup-dot" style={{ background: '#ff5f56' }} />
                <div className="scr-mockup-dot" style={{ background: '#ffbd2e' }} />
                <div className="scr-mockup-dot" style={{ background: '#27c93f' }} />
              </div>
              <div className="scr-mockup-body">
                <div className="scr-mockup-tabs">
                  <span className="scr-mockup-tab">LIFE</span>
                  <span className="scr-mockup-tab">HEALTH</span>
                  <span className="scr-mockup-tab active">REAL ESTATE</span>
                  <span className="scr-mockup-tab">SOLAR</span>
                </div>
                <div className="scr-mockup-text">
                  &quot;Hi (client), this is (your name), I saw you were
                  curious what your home might be worth.
                  <br /><br />
                  I can get you a real number today, and if you ever decide
                  to sell, walk...&quot;
                </div>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              This is a real script layout, not a mockup, tabbed by
              vertical, plain text, no formatting to fight with.
            </p>
          </section>

          {/* ── PERSONAL VS TEAM ───────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ PERSONAL SCRIPTS VS. TEAM SCRIPTS</h2>
            <p>
              Every script belongs to either you personally or to a team you
              own, there&apos;s no separate &ldquo;company library&rdquo;
              concept beyond that.
            </p>

            <div className="scr-owner-grid">
              <div className="scr-owner-card">
                <h4>PERSONAL SCRIPT</h4>
                <p>Belongs to your account. Only you can attach it to your own campaigns. Anyone can write these, Pro or Manager+.</p>
              </div>
              <div className="scr-owner-card">
                <h4>TEAM SCRIPT</h4>
                <p>Belongs to a team you own (Manager+ required to own a team). Every agent on that team can see and use it on campaigns it&apos;s attached to: write it once, the whole floor is on the same script.</p>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 16 }}>
              Only the team owner can create a script scoped to the team.
              Individual agents on a team can still write their own personal
              scripts for their own campaigns; they just can&apos;t publish
              one to the whole team unless they own it.
            </p>
          </section>

          {/* ── ATTACHING TO CAMPAIGNS ─────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ HOW SCRIPTS ATTACH TO CAMPAIGNS</h2>
            <p>
              A script and a campaign are two separate things until you
              link them. One script can be attached to several campaigns at
              once, and one campaign can have several scripts attached, it&apos;s
              a many-to-many relationship, not a strict one-to-one.
            </p>

            <div className="faq-flow">
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>1. WRITE THE SCRIPT</h4>
                  <p>Create it once, name it, save it. It exists independently of any campaign until you attach it somewhere.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>2. TOGGLE IT ONTO A CAMPAIGN</h4>
                  <p>Turn it on for whichever campaign(s) should use it. Turning it off removes the link without deleting the script itself.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>3. REORDER IF MORE THAN ONE IS ATTACHED</h4>
                  <p>Whichever script sits first in the order is what agents see by default on that campaign, drag to reorder any time.</p>
                </div>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 20 }}>
              Only a campaign&apos;s owner can attach or detach scripts on
              it, and you can only attach a script you actually have access
              to: your own, or one shared by a team you&apos;re an active
              member of.
            </p>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>Keep it simple: </strong> scripts are plain text, on
              purpose. No rich formatting, no branching logic, no
              conditional paths based on lead answers. If your process needs
              that level of complexity, most teams keep the DialerSeat
              script as the opening hook and lean on the{' '}
              <Link href="/faq/leads">lead record</Link> itself: name,
              state, custom fields from your upload, for the rest of the
              call.
            </p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/campaigns">Setting up a campaign</Link>
              <Link href="/faq/leads">Uploading &amp; managing leads</Link>
              <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
              <Link href="/faq/dialer-modes">Dialer modes explained</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ WRITE YOUR FIRST SCRIPT</div>
            <h3 className="faq-cta-h">Included on every seat. No extra cost.</h3>
            <p>
              Scripts live in the dialer, not in a separate tab you have to
              keep switching to.
            </p>
            <a href={isSignedIn ? '/dashboard/dialer' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO DIALER →' : 'GET STARTED →'}
            </a>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}
