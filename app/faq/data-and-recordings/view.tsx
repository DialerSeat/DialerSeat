'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'


export default function DataRecordingsFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/data-and-recordings')} activeHref="/faq/data-and-recordings">
        <FaqTheme />
        <style>{`
/* EXPORT TABLE INCLUDED */
          .drc-export-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 20px 0 8px; }
          .drc-export-item {
            background: ${SITE.surface}; border: 1px solid ${SITE.border}; border-radius: 6px;
            padding: 10px 12px; font-size: 12.5px; font-weight: 600; color: ${SITE.text};
            text-align: center;
          }

          .drc-warn {
            margin: 28px 0; padding: 24px 26px; background: ${SITE.surface};
            border: 1px solid ${SITE.border}; border-left: 3px solid ${SITE.red};
            border-radius: 6px;
          }
          .drc-warn-title {
            font-size: 11px; letter-spacing: 3px; color: ${SITE.red};
            font-weight: bold; margin-bottom: 10px;
          }
          .drc-warn p { font-size: 15px; line-height: 1.7; margin: 0; color: ${SITE.text}; }@media (max-width: 768px) {
            .drc-export-grid { grid-template-columns: repeat(2, 1fr); }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">▸ RECORDINGS &amp; YOUR DATA</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            Your recordings. Your data. Actually <em>yours</em> to take or delete.
          </h1>

          <p className="faq-deck">
            Two separate things live on this page: how call recordings work
            day to day, and the account-level tools for getting everything
            out or deleting it for good. Both are self-serve, no support
            ticket required for either.
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">FULL ACCOUNT EXPORT, ONE CLICK</span>
            <span className="faq-badge">30-DAY RECORDING RETENTION</span>
            <span className="faq-badge">DELETE REQUIRES TYPING &ldquo;DELETE&rdquo;</span>
          </div>

          {/* ── RECORDINGS ─────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ HOW RECORDINGS ACTUALLY WORK</h2>
            <p>
              Every call is recorded server-side automatically, there&apos;s
              no per-call toggle to remember to turn on. Recordings show up
              in your dashboard shortly after the call ends, playable
              directly in the browser or downloadable as a file.
            </p>
            <ul>
              <li><strong>Retention is 30 days.</strong> After that, a recording ages out automatically. Call metadata: timestamp, disposition, AMD result, is kept separately for longer; see <Link href="/faq/how-we-keep-compliance">how we keep compliance</Link> for the full retention split.</li>
              <li><strong>You can delete one early, any time.</strong> Deleting a recording clears it from your dashboard immediately and is no longer playable through DialerSeat. We also attempt to delete it from the carrier's storage at the same time; that provider-side step is best-effort depending on how the recording was stored.</li>
              <li><strong>Only the account that made the call can access its recording.</strong> On a Manager+ team, that means the owner sees recordings for calls made under campaigns they own; an individual agent&apos;s own dials are theirs.</li>
            </ul>
          </section>

          {/* ── FULL ACCOUNT EXPORT ────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ EXPORTING YOUR ENTIRE ACCOUNT</h2>
            <p>
              Beyond individual recordings, there&apos;s a single export
              that pulls literally everything tied to your account into one
              JSON file, not a marketing &ldquo;contact us for your
              data&rdquo; process, an actual button that returns a file
              immediately.
            </p>

            <div className="drc-export-grid">
              <div className="drc-export-item">Profile</div>
              <div className="drc-export-item">Campaigns</div>
              <div className="drc-export-item">Leads</div>
              <div className="drc-export-item">Lead notes</div>
              <div className="drc-export-item">Calls</div>
              <div className="drc-export-item">Dial attempts</div>
              <div className="drc-export-item">Scripts</div>
              <div className="drc-export-item">Custom themes</div>
              <div className="drc-export-item">Teams you own</div>
              <div className="drc-export-item">Team memberships</div>
              <div className="drc-export-item">Support history</div>
              <div className="drc-export-item">Desktop app prefs</div>
            </div>

            <p className="muted" style={{ marginTop: 16 }}>
              It&apos;s everything, including the smaller stuff most exports
              skip, your desktop app icon layout and window preferences are
              in there too. Downloaded as a single dated file, ready to
              archive or hand to another system.
            </p>
          </section>

          {/* ── ACCOUNT DELETION ───────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ DELETING YOUR ACCOUNT FOR REAL</h2>
            <p>
              This is a genuine, permanent delete, not a deactivation that
              quietly keeps your data around. It&apos;s built with enough
              friction that it&apos;s hard to trigger by accident, but no
              harder than that.
            </p>

            <div className="faq-flow">
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>1. DRY RUN BY DEFAULT</h4>
                  <p>Requesting deletion without explicit confirmation runs a dry run: it tells you exactly what would be deleted and how many records, without touching anything.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>2. TYPE &ldquo;DELETE&rdquo; TO CONFIRM</h4>
                  <p>The actual deletion only runs when the confirmation matches exactly, no single-click accidental deletes.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>3. BLOCKED WHILE A SUBSCRIPTION IS ACTIVE</h4>
                  <p>You can&apos;t delete an account with an active subscription without explicitly overriding that check first: cancel or downgrade, then delete, is the intended path.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── HONEST WARNING ────────────────────────────────────────────── */}
          <div className="drc-warn">
            <div className="drc-warn-title">THIS IS NOT REVERSIBLE</div>
            <p>
              Once confirmed, deletion is permanent: campaigns, leads, call
              history, scripts, everything on the export list above. If
              there&apos;s any chance you&apos;ll want the data later, run
              the full export first and keep the file somewhere safe before
              confirming deletion.
            </p>
          </div>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>Worth knowing, </strong> the export and delete tools
              work on your own account&apos;s data. On a Manager+ team, an
              owner deleting their account doesn&apos;t silently wipe their
              agents&apos; individual accounts, each agent&apos;s own data
              and login are separate from the owner&apos;s.
            </p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/how-we-keep-compliance">How we keep compliance</Link>
              <Link href="/faq/compliance-export">Compliance export</Link>
              <Link href="/faq/billing">Billing &amp; cancellation</Link>
              <Link href="/faq/leads">Uploading &amp; managing leads</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ YOUR DATA, ON YOUR TERMS</div>
            <h3 className="faq-cta-h">Export everything, or delete everything. No ticket required.</h3>
            <p>
              Both live in your account settings, ready whenever you need
              them.
            </p>
            <a href={isSignedIn ? '/dashboard/settings' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO SETTINGS →' : 'GET STARTED →'}
            </a>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}
