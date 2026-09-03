'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import { SITE } from '@/lib/siteTheme'


export default function CampaignsFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <div
        style={{
          flex: 1,
          background: SITE.bg,
          minHeight: 'calc(100vh - 64px)',
          fontFamily: 'Futura PT, Futura, sans-serif',
          color: SITE.text,
        }}
      >
        <FaqTheme />
        <style>{`
/* SETTINGS TABLE */
          .cmp-settings-table { margin: 20px 0 8px; border: 1px solid ${SITE.border}; border-radius: 8px; overflow: hidden; background: ${SITE.surface}; }
          .cmp-settings-row { display: grid; grid-template-columns: 180px 1fr; }
          .cmp-settings-row + .cmp-settings-row { border-top: 1px solid ${SITE.border}; }
          .cmp-settings-row.head { background: ${SITE.ink}; }
          .cmp-settings-cell { padding: 13px 16px; font-size: 14px; line-height: 1.6; }
          .cmp-settings-row.head .cmp-settings-cell {
            color: white; font-size: 10.5px; letter-spacing: 2px; font-weight: bold;
          }
          .cmp-settings-cell.name { font-weight: 700; color: ${SITE.text}; background: ${SITE.surface}; font-size: 13px; }
          .cmp-settings-cell code { background: transparent; padding: 0; font-size: 12.5px; }

          /* AMD DEFAULTS GRID */
          .cmp-amd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0 8px; }
          .cmp-amd-card { background: ${SITE.surface}; border: 1px solid ${SITE.border}; border-radius: 8px; padding: 16px 14px; text-align: center; }
          .cmp-amd-mode { font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; color: ${SITE.text}; }
          .cmp-amd-state { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 12px; display: inline-block; }
          .cmp-amd-state.on { background: #e8f5e8; color: ${SITE.green}; }
          .cmp-amd-state.off { background: ${SITE.bg}; color: ${SITE.muted}; }@media (max-width: 768px) {
            .cmp-settings-row { grid-template-columns: 130px 1fr; }
            .cmp-settings-cell { font-size: 12.5px; padding: 10px 12px; }
            .cmp-amd-grid { grid-template-columns: repeat(2, 1fr); }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">▸ SETTING UP A CAMPAIGN</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            A campaign is just a mode, a list, and a script. <em>That&apos;s it.</em>
          </h1>

          <p className="faq-deck">
            No wizard, no required setup flow, no fields you&apos;re forced
            to fill in before you can dial. Create one, it&apos;s active
            immediately, and every setting below has a sane default so you
            can start dialing before you&apos;ve touched a single toggle.
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">ACTIVE THE MOMENT YOU CREATE IT</span>
            <span className="faq-badge">EVERY SETTING HAS A DEFAULT</span>
            <span className="faq-badge">EDITABLE ANY TIME</span>
          </div>

          {/* ── THE SETTINGS ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ THE ACTUAL SETTINGS ON A CAMPAIGN</h2>
            <p>
              This is the complete list, nothing hidden behind a
              &ldquo;advanced&rdquo; tab you have to go find:
            </p>

            <div className="cmp-settings-table">
              <div className="cmp-settings-row head">
                <div className="cmp-settings-cell">SETTING</div>
                <div className="cmp-settings-cell">WHAT IT CONTROLS</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">Name</div>
                <div className="cmp-settings-cell">Whatever you want. Leave it blank and it becomes &ldquo;Untitled,&rdquo; &ldquo;Untitled (1),&rdquo; and so on, never a blank or duplicate name.</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">Dialer mode</div>
                <div className="cmp-settings-cell"><code>preview</code>, <code>power</code>, <code>progressive</code>, or <code>predictive</code>. Defaults to <strong>power</strong> if you don&apos;t set one. See <Link href="/faq/dialer-modes">dialer modes explained</Link>.</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">AMD toggle</div>
                <div className="cmp-settings-cell">On or off, your choice, on every mode. Defaults on for progressive and predictive, off for power and preview: a starting point, not a restriction. See <Link href="/faq/how-does-amd-work">how AMD works</Link>.</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">Lines per agent</div>
                <div className="cmp-settings-cell">Predictive-only. A multiplier between <code>1.0</code> and <code>3.0</code>, defaulting to <code>1.5</code>. Higher means more aggressive pacing; the abandon-rate auto-degrade still applies regardless of where you set it.</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">Status</div>
                <div className="cmp-settings-cell"><code>active</code> or <code>inactive</code>. New campaigns start active, there&apos;s no draft state you have to publish out of.</div>
              </div>
            </div>
          </section>

          {/* ── AMD DEFAULTS ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ THE AMD DEFAULT, MODE BY MODE</h2>
            <p>
              AMD is a toggle available on every dialer mode, it&apos;s
              never locked on or locked off. What changes by mode is only
              the starting position when you first create a campaign:
            </p>

            <div className="cmp-amd-grid">
              <div className="cmp-amd-card">
                <div className="cmp-amd-mode">PREVIEW</div>
                <span className="cmp-amd-state off">OFF BY DEFAULT</span>
              </div>
              <div className="cmp-amd-card">
                <div className="cmp-amd-mode">POWER</div>
                <span className="cmp-amd-state off">OFF BY DEFAULT</span>
              </div>
              <div className="cmp-amd-card">
                <div className="cmp-amd-mode">PROGRESSIVE</div>
                <span className="cmp-amd-state on">ON BY DEFAULT</span>
              </div>
              <div className="cmp-amd-card">
                <div className="cmp-amd-mode">PREDICTIVE</div>
                <span className="cmp-amd-state on">ON BY DEFAULT</span>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 16 }}>
              Flip it either direction on any campaign, any time, the
              defaults exist so a fresh campaign starts in a sensible state,
              not because a mode requires a specific setting.
            </p>
          </section>

          {/* ── HOW A CAMPAIGN COMES TOGETHER ──────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ THE ACTUAL ORDER MOST PEOPLE SET ONE UP</h2>

            <div className="faq-flow">
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>1. CREATE THE CAMPAIGN</h4>
                  <p>Name it, pick a mode (or leave it on power). It&apos;s live immediately.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>2. UPLOAD LEADS</h4>
                  <p>Drop in a spreadsheet, see <Link href="/faq/leads">uploading &amp; managing leads</Link> for the full field reference.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>3. ATTACH A SCRIPT (OPTIONAL)</h4>
                  <p>Toggle on any script you or your team already wrote, see <Link href="/faq/scripts">call scripts</Link>. Skip this step entirely if you don&apos;t use scripts.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>4. ADJUST MODE-SPECIFIC SETTINGS</h4>
                  <p>AMD toggle, and lines-per-agent if predictive. Both optional, both editable later.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>5. DIAL</h4>
                  <p>Select the campaign from the dialer terminal and go available. Nothing else is required.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>One thing worth knowing, </strong> every setting on
              this page is editable after the fact, including dialer mode.
              Switching a live campaign from power to predictive mid-run
              doesn&apos;t require pausing it or re-uploading leads, the
              leads already in the queue just start getting dialed under
              the new mode&apos;s pacing rules.
            </p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/dialer-modes">Dialer modes explained</Link>
              <Link href="/faq/leads">Uploading &amp; managing leads</Link>
              <Link href="/faq/scripts">Call scripts</Link>
              <Link href="/faq/how-does-amd-work">How AMD works</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ CREATE YOUR FIRST CAMPAIGN</div>
            <h3 className="faq-cta-h">$35/week. No setup wizard, no required fields.</h3>
            <p>
              Name it or don&apos;t, you&apos;ll be dialing in under a
              minute either way.
            </p>
            <a href={isSignedIn ? '/dashboard/campaigns' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO CAMPAIGNS →' : 'GET STARTED →'}
            </a>
          </div>
        </article>
      </div>
      <SiteFooter />
    </>
  )
}
