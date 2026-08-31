'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'

const T = {
  bg: '#0a0a14',
  surface: '#1a1a2e',
  surface2: '#2a2a4a',
  border: '#2a2a4a',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#ffffff',
  muted: '#8888aa',
  accent: '#4a9eff',
  blue: '#4a9eff',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
}

export default function LeadsFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <div
        style={{
          flex: 1,
          background: T.bg,
          minHeight: 'calc(100vh - 64px)',
          fontFamily: 'Futura PT, Futura, sans-serif',
          color: T.text,
        }}
      >
        <FaqTheme />

        <article className="faq-root">
          <div className="faq-eyebrow">▸ UPLOADING &amp; MANAGING LEADS</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            Drop in a spreadsheet. It figures out the columns <em>itself.</em>
          </h1>

          <p className="faq-deck">
            There&apos;s no template to download, no exact header names to
            match, and no import wizard to click through. Upload a
            campaign&apos;s worth of leads and the columns get detected
            automatically — here&apos;s exactly how, what&apos;s required,
            and what happens to a lead once it&apos;s in the queue.
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">NO TEMPLATE REQUIRED</span>
            <span className="faq-badge">AUTO-DETECTED COLUMNS</span>
            <span className="faq-badge">UNLIMITED LEADS UPLOADED</span>
            <span className="faq-badge">3-ATTEMPT RETRY BUILT IN</span>
          </div>

          {/* ── WHAT'S REQUIRED ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ THE ONLY THING A LEAD ACTUALLY NEEDS</h2>
            <p>
              One field is required: a value with at least 10 digits once
              everything except numbers is stripped out. That&apos;s it.
              Any row without something matching that gets skipped on
              upload rather than silently corrupting your campaign — you&apos;ll
              get a count of exactly how many rows made it in.
            </p>
            <p>
              Everything else — name, email, state, custom fields — is
              optional and additive. A file with nothing but a column of
              phone numbers is a valid upload.
            </p>
          </section>

          {/* ── HOW COLUMNS GET DETECTED ───────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ HOW COLUMN DETECTION ACTUALLY WORKS</h2>
            <p>
              The importer checks a list of common header spellings for
              each field, case-insensitive. If your file uses one of these,
              it gets mapped automatically — no manual field-matching step:
            </p>

            <div className="faq-fieldtable">
              <div className="faq-fieldrow head">
                <div className="faq-fieldcell">FIELD</div>
                <div className="faq-fieldcell">RECOGNIZED HEADERS</div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">Phone <span className="req">REQUIRED</span></div>
                <div className="faq-fieldcell"><code>phone</code>, <code>Phone</code>, <code>phone_number</code>, <code>Phone Number</code>, <code>mobile</code>, <code>cell</code> — or, if none of those match, the first column with at least 10 digits in it.</div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">First name</div>
                <div className="faq-fieldcell"><code>first_name</code>, <code>First Name</code>, <code>firstname</code>, <code>first</code>, <code>name</code></div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">Last name</div>
                <div className="faq-fieldcell"><code>last_name</code>, <code>Last Name</code>, <code>lastname</code>, <code>last</code></div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">Email</div>
                <div className="faq-fieldcell"><code>email</code>, <code>Email</code></div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">State</div>
                <div className="faq-fieldcell"><code>state</code>, <code>State</code></div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">Consent date</div>
                <div className="faq-fieldcell"><code>consent_date</code>, <code>consent date</code>, <code>consentdate</code></div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">Consent source</div>
                <div className="faq-fieldcell"><code>consent_source</code>, <code>consent source</code></div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">Consent text</div>
                <div className="faq-fieldcell"><code>consent_description</code>, <code>consent text</code>, <code>consent_text</code></div>
              </div>
              <div className="faq-fieldrow">
                <div className="faq-fieldcell name">Consent proof</div>
                <div className="faq-fieldcell"><code>consent_proof_url</code>, <code>consent_proof</code>, <code>proof_url</code></div>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 16 }}>
              Anything in your file that doesn&apos;t match a recognized
              header isn&apos;t discarded — it&apos;s kept on the lead
              record as extra data, so custom columns specific to your
              business (policy type, property value, whatever you track)
              survive the import even without a dedicated field.
            </p>
          </section>

          {/* ── CONSENT FIELDS ─────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ THE CONSENT COLUMNS ARE OPTIONAL BUT WORTH USING</h2>
            <p>
              If your leads come with documented consent — a web form
              opt-in, a signed agreement, a call recording where consent
              was given — the four consent columns above let you attach
              that proof directly to each lead at upload time: when consent
              was given, where it came from, what it said, and a link to
              supporting documentation.
            </p>
            <p>
              None of this is required to dial a lead. But if a consent
              dispute ever comes up, having the record attached to the lead
              itself — rather than buried in a separate spreadsheet
              somewhere — is the difference between answering the question
              in thirty seconds and not being able to answer it at all. See{' '}
              <Link href="/faq/how-we-keep-compliance">how we keep
              compliance</Link> for the fuller picture of what DialerSeat
              enforces automatically versus what depends on records like
              these.
            </p>
          </section>

          {/* ── LIFECYCLE ──────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHAT HAPPENS TO A LEAD AFTER IT&apos;S UPLOADED</h2>
            <p>
              A lead isn&apos;t just dialed once and forgotten if nobody
              answers. There&apos;s a built-in retry cycle before a lead
              gets set aside for good:
            </p>

            <div className="faq-flow">
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>UNCALLED</h4>
                  <p>Fresh in the queue, never dialed. This is every lead&apos;s starting status right after upload.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>NO ANSWER / SKIPPED</h4>
                  <p>Dialed but not connected, or manually skipped by the agent. Goes back into the queue automatically — up to 3 total attempts.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>MAXED</h4>
                  <p>Hit 3 attempts without a connection. Removed from the active dial queue so agents stop wasting time on it, but the record and history stay intact — nothing is deleted.</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>CALLED / APPOINTMENT / CLOSED / DNC</h4>
                  <p>Set by whatever disposition the agent selects after a connected call. A &ldquo;Do Not Call&rdquo; disposition removes the lead from future dialing immediately, campaign-wide.</p>
                </div>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 20 }}>
              Every attempt is timestamped and logged against the lead, so
              a manager reviewing a campaign can see exactly how many times
              a given number was tried and what happened each time — not
              just the final outcome.
            </p>
          </section>

          {/* ── PRACTICAL NOTES ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ A FEW PRACTICAL NOTES</h2>
            <ul>
              <li><strong>Duplicate phone numbers aren&apos;t rejected at upload</strong> — if your source data has the same number twice, both rows come in. Clean lists in are clean lists dialed; the importer won&apos;t catch what your source data doesn&apos;t already handle.</li>
              <li><strong>Every upload is scoped to one campaign.</strong> There&apos;s no &ldquo;global&rdquo; lead pool shared across campaigns — leads live where you put them.</li>
              <li><strong>Uploads are additive, not a replace.</strong> Running a second upload into a campaign that already has leads adds to the existing list rather than overwriting it.</li>
              <li><strong>DNC scrubbing against the national registry is still on you before upload</strong> — the importer accepts what you give it. See <Link href="/faq/how-we-keep-compliance">how we keep compliance</Link> for the full split of what&apos;s enforced automatically versus what&apos;s the seller&apos;s responsibility.</li>
            </ul>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>One practical tip —</strong> if a file has a column
              named something unexpected — say <code>Telephone</code>{' '}
              instead of <code>Phone</code> — the fallback detection (first
              column with 10+ digits) usually catches it anyway, but the
              safest move is renaming your phone column to one of the
              recognized headers above before uploading, especially on
              large files where you want to be certain every row mapped
              correctly.
            </p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/how-we-keep-compliance">How we keep compliance</Link>
              <Link href="/faq/numbers">Phone numbers &amp; caller ID</Link>
              <Link href="/faq/dialer-modes">Dialer modes explained</Link>
              <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ UPLOAD YOUR FIRST CAMPAIGN</div>
            <h3 className="faq-cta-h">$35/week. Unlimited leads uploaded, no per-record fee.</h3>
            <p>
              Sign up, create a campaign, and drop in a spreadsheet — no
              template, no import wizard.
            </p>
            <a href={isSignedIn ? '/dashboard/campaigns' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO CAMPAIGNS →' : 'START FREE 7 DAYS →'}
            </a>
          </div>
        </article>
      </div>
      <SiteFooter />
    </>
  )
}
