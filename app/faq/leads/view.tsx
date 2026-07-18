'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

export default function LeadsFaqView() {
  const { isSignedIn } = useUser()

  return (
    <div
      style={{
        flex: 1,
        background: T.bg,
        minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: T.text,
      }}
    >
      <style>{`
        .lead-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .lead-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .lead-h1 {
          font-size: 42px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .lead-h1 em { font-style: normal; color: ${T.green}; }
        .lead-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }
        .lead-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .lead-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .lead-badge.hi { background: ${T.dark}; color: #8fd18f; border-color: ${T.dark}; }

        .lead-section { margin: 56px 0; }
        .lead-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .lead-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .lead-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .lead-section p.muted { color: ${T.muted}; font-size: 15px; }
        .lead-section strong { color: ${T.text}; font-weight: 700; }
        .lead-section em { font-style: italic; color: ${T.accent}; }
        .lead-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .lead-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }
        .lead-section code {
          background: ${T.surface}; padding: 1px 6px; border-radius: 3px;
          font-size: 13.5px; font-family: monospace;
        }

        /* FIELD TABLE */
        .lead-field-table { margin: 20px 0 8px; border: 1px solid ${T.border}; border-radius: 8px; overflow: hidden; background: white; }
        .lead-field-row { display: grid; grid-template-columns: 160px 1fr; }
        .lead-field-row + .lead-field-row { border-top: 1px solid ${T.border}; }
        .lead-field-row.head { background: ${T.dark}; }
        .lead-field-cell { padding: 13px 16px; font-size: 14px; line-height: 1.6; }
        .lead-field-row.head .lead-field-cell {
          color: white; font-size: 10.5px; letter-spacing: 2px; font-weight: bold;
        }
        .lead-field-cell.name { font-weight: 700; color: ${T.text}; background: ${T.surface}; font-size: 13.5px; }
        .lead-field-cell code { background: transparent; padding: 0; font-size: 12.5px; }
        .lead-field-cell.req { color: ${T.red}; font-weight: 600; font-size: 12px; }
        .lead-field-cell.opt { color: ${T.muted}; font-size: 12px; }

        /* LIFECYCLE FLOW */
        .lead-flow { display: flex; flex-direction: column; gap: 0; margin: 24px 0 8px; }
        .lead-flow-step {
          display: flex; gap: 16px; padding: 16px 0; align-items: flex-start;
          border-left: 2px solid ${T.border}; padding-left: 22px; margin-left: 15px;
          position: relative;
        }
        .lead-flow-step::before {
          content: ''; position: absolute; left: -7px; top: 22px;
          width: 12px; height: 12px; border-radius: 50%;
          background: ${T.accent}; border: 2px solid white;
        }
        .lead-flow-step:last-child { border-left: 2px solid transparent; }
        .lead-flow-body h4 { font-size: 15px; margin: 0 0 4px 0; font-weight: 700; }
        .lead-flow-body p { font-size: 14px; line-height: 1.6; margin: 0; color: ${T.muted}; }

        .lead-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.blue}; border-radius: 4px;
        }
        .lead-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .lead-callout strong { color: ${T.accent}; }

        .lead-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .lead-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .lead-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .lead-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .lead-related-links a:hover { border-bottom-color: ${T.accent}; }

        .lead-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .lead-cta-box .lead-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: #8fd18f;
          font-weight: bold; margin-bottom: 14px;
        }
        .lead-cta-box .lead-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .lead-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .lead-cta-box .lead-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #2fd16a, #1a8a4a);
          border: none; border-radius: 6px; color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(47,209,106,0.25);
        }

        @media (max-width: 768px) {
          .lead-root { padding: 48px 20px 80px; }
          .lead-h1 { font-size: 28px; }
          .lead-deck { font-size: 16px; }
          .lead-section h3 { font-size: 19px; }
          .lead-section p, .lead-section li { font-size: 15px; }
          .lead-field-row { grid-template-columns: 110px 1fr; }
          .lead-field-cell { font-size: 12.5px; padding: 10px 12px; }
          .lead-cta-box { padding: 32px 24px; }
          .lead-cta-box .lead-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="lead-root">
        <div className="lead-eyebrow">▸ UPLOADING &amp; MANAGING LEADS</div>

        <h1 className="lead-h1">
          Drop in a spreadsheet. It figures out the columns <em>itself.</em>
        </h1>

        <p className="lead-deck">
          There&apos;s no template to download, no exact header names to
          match, and no import wizard to click through. Upload a
          campaign&apos;s worth of leads and the columns get detected
          automatically — here&apos;s exactly how, what&apos;s required,
          and what happens to a lead once it&apos;s in the queue.
        </p>

        <div className="lead-badge-row">
          <span className="lead-badge hi">NO TEMPLATE REQUIRED</span>
          <span className="lead-badge">AUTO-DETECTED COLUMNS</span>
          <span className="lead-badge">UNLIMITED LEADS UPLOADED</span>
          <span className="lead-badge">3-ATTEMPT RETRY BUILT IN</span>
        </div>

        {/* ── WHAT'S REQUIRED ────────────────────────────────────────────── */}
        <section className="lead-section">
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
        <section className="lead-section">
          <h2>▸ HOW COLUMN DETECTION ACTUALLY WORKS</h2>
          <p>
            The importer checks a list of common header spellings for
            each field, case-insensitive. If your file uses one of these,
            it gets mapped automatically — no manual field-matching step:
          </p>

          <div className="lead-field-table">
            <div className="lead-field-row head">
              <div className="lead-field-cell">FIELD</div>
              <div className="lead-field-cell">RECOGNIZED HEADERS</div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">Phone <span className="req">REQUIRED</span></div>
              <div className="lead-field-cell"><code>phone</code>, <code>Phone</code>, <code>phone_number</code>, <code>Phone Number</code>, <code>mobile</code>, <code>cell</code> — or, if none of those match, the first column with at least 10 digits in it.</div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">First name</div>
              <div className="lead-field-cell"><code>first_name</code>, <code>First Name</code>, <code>firstname</code>, <code>first</code>, <code>name</code></div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">Last name</div>
              <div className="lead-field-cell"><code>last_name</code>, <code>Last Name</code>, <code>lastname</code>, <code>last</code></div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">Email</div>
              <div className="lead-field-cell"><code>email</code>, <code>Email</code></div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">State</div>
              <div className="lead-field-cell"><code>state</code>, <code>State</code></div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">Consent date</div>
              <div className="lead-field-cell"><code>consent_date</code>, <code>consent date</code>, <code>consentdate</code></div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">Consent source</div>
              <div className="lead-field-cell"><code>consent_source</code>, <code>consent source</code></div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">Consent text</div>
              <div className="lead-field-cell"><code>consent_description</code>, <code>consent text</code>, <code>consent_text</code></div>
            </div>
            <div className="lead-field-row">
              <div className="lead-field-cell name">Consent proof</div>
              <div className="lead-field-cell"><code>consent_proof_url</code>, <code>consent_proof</code>, <code>proof_url</code></div>
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
        <section className="lead-section">
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
        <section className="lead-section">
          <h2>▸ WHAT HAPPENS TO A LEAD AFTER IT&apos;S UPLOADED</h2>
          <p>
            A lead isn&apos;t just dialed once and forgotten if nobody
            answers. There&apos;s a built-in retry cycle before a lead
            gets set aside for good:
          </p>

          <div className="lead-flow">
            <div className="lead-flow-step">
              <div className="lead-flow-body">
                <h4>UNCALLED</h4>
                <p>Fresh in the queue, never dialed. This is every lead&apos;s starting status right after upload.</p>
              </div>
            </div>
            <div className="lead-flow-step">
              <div className="lead-flow-body">
                <h4>NO ANSWER / SKIPPED</h4>
                <p>Dialed but not connected, or manually skipped by the agent. Goes back into the queue automatically — up to 3 total attempts.</p>
              </div>
            </div>
            <div className="lead-flow-step">
              <div className="lead-flow-body">
                <h4>MAXED</h4>
                <p>Hit 3 attempts without a connection. Removed from the active dial queue so agents stop wasting time on it, but the record and history stay intact — nothing is deleted.</p>
              </div>
            </div>
            <div className="lead-flow-step">
              <div className="lead-flow-body">
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
        <section className="lead-section">
          <h2>▸ A FEW PRACTICAL NOTES</h2>
          <ul>
            <li><strong>Duplicate phone numbers aren&apos;t rejected at upload</strong> — if your source data has the same number twice, both rows come in. Clean lists in are clean lists dialed; the importer won&apos;t catch what your source data doesn&apos;t already handle.</li>
            <li><strong>Every upload is scoped to one campaign.</strong> There&apos;s no &ldquo;global&rdquo; lead pool shared across campaigns — leads live where you put them.</li>
            <li><strong>Uploads are additive, not a replace.</strong> Running a second upload into a campaign that already has leads adds to the existing list rather than overwriting it.</li>
            <li><strong>DNC scrubbing against the national registry is still on you before upload</strong> — the importer accepts what you give it. See <Link href="/faq/how-we-keep-compliance">how we keep compliance</Link> for the full split of what&apos;s enforced automatically versus what&apos;s the seller&apos;s responsibility.</li>
          </ul>
        </section>

        {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
        <div className="lead-callout">
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
        <div className="lead-related">
          <div className="lead-related-label">▸ RELATED READING</div>
          <div className="lead-related-links">
            <Link href="/faq/how-we-keep-compliance">How we keep compliance</Link>
            <Link href="/faq/numbers">Phone numbers &amp; caller ID</Link>
            <Link href="/faq/dialer-modes">Dialer modes explained</Link>
            <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="lead-cta-box">
          <div className="lead-cta-eyebrow">▸ UPLOAD YOUR FIRST CAMPAIGN</div>
          <h3 className="lead-cta-h">$35/week. Unlimited leads uploaded, no per-record fee.</h3>
          <p>
            Sign up, create a campaign, and drop in a spreadsheet — no
            template, no import wizard.
          </p>
          <a href={isSignedIn ? '/dashboard/campaigns' : '/sign-up'} className="lead-cta-btn">
            {isSignedIn ? 'GO TO CAMPAIGNS →' : 'GET STARTED →'}
          </a>
        </div>
      </article>
    </div>
  )
}
