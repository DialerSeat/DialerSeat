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

export default function DataRecordingsFaqView() {
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
        .drc-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .drc-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .drc-h1 {
          font-size: 42px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .drc-h1 em { font-style: normal; color: ${T.accent}; }
        .drc-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }
        .drc-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .drc-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .drc-badge.hi { background: ${T.dark}; color: #a8b8ff; border-color: ${T.dark}; }

        .drc-section { margin: 56px 0; }
        .drc-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .drc-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .drc-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .drc-section p.muted { color: ${T.muted}; font-size: 15px; }
        .drc-section strong { color: ${T.text}; font-weight: 700; }
        .drc-section em { font-style: italic; color: ${T.accent}; }
        .drc-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .drc-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }
        .drc-section code {
          background: ${T.surface}; padding: 1px 6px; border-radius: 3px;
          font-size: 13.5px; font-family: monospace;
        }

        /* EXPORT TABLE INCLUDED */
        .drc-export-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 20px 0 8px; }
        .drc-export-item {
          background: white; border: 1px solid ${T.border}; border-radius: 6px;
          padding: 10px 12px; font-size: 12.5px; font-weight: 600; color: ${T.text};
          text-align: center;
        }

        /* DELETE FLOW */
        .drc-flow { display: flex; flex-direction: column; gap: 0; margin: 24px 0 8px; }
        .drc-flow-step {
          display: flex; gap: 16px; padding: 14px 0; align-items: flex-start;
          border-left: 2px solid ${T.border}; padding-left: 22px; margin-left: 15px;
          position: relative;
        }
        .drc-flow-step::before {
          content: ''; position: absolute; left: -7px; top: 18px;
          width: 12px; height: 12px; border-radius: 50%;
          background: ${T.red}; border: 2px solid white;
        }
        .drc-flow-step:last-child { border-left: 2px solid transparent; }
        .drc-flow-body h4 { font-size: 15px; margin: 0 0 4px 0; font-weight: 700; }
        .drc-flow-body p { font-size: 14px; line-height: 1.6; margin: 0; color: ${T.muted}; }

        .drc-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.blue}; border-radius: 4px;
        }
        .drc-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .drc-callout strong { color: ${T.accent}; }

        .drc-warn {
          margin: 28px 0; padding: 24px 26px; background: white;
          border: 1px solid ${T.border}; border-left: 3px solid ${T.red};
          border-radius: 6px;
        }
        .drc-warn-title {
          font-size: 11px; letter-spacing: 3px; color: ${T.red};
          font-weight: bold; margin-bottom: 10px;
        }
        .drc-warn p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }

        .drc-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .drc-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .drc-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .drc-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .drc-related-links a:hover { border-bottom-color: ${T.accent}; }

        .drc-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .drc-cta-box .drc-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: #a8b8ff;
          font-weight: bold; margin-bottom: 14px;
        }
        .drc-cta-box .drc-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .drc-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .drc-cta-box .drc-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #6a7aff, #4a5aff);
          border: none; border-radius: 6px; color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(90,100,255,0.3);
        }

        @media (max-width: 768px) {
          .drc-root { padding: 48px 20px 80px; }
          .drc-h1 { font-size: 28px; }
          .drc-deck { font-size: 16px; }
          .drc-section h3 { font-size: 19px; }
          .drc-section p, .drc-section li { font-size: 15px; }
          .drc-export-grid { grid-template-columns: repeat(2, 1fr); }
          .drc-cta-box { padding: 32px 24px; }
          .drc-cta-box .drc-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="drc-root">
        <div className="drc-eyebrow">▸ RECORDINGS &amp; YOUR DATA</div>

        <h1 className="drc-h1">
          Your recordings. Your data. Actually <em>yours</em> to take or delete.
        </h1>

        <p className="drc-deck">
          Two separate things live on this page: how call recordings work
          day to day, and the account-level tools for getting everything
          out or deleting it for good. Both are self-serve — no support
          ticket required for either.
        </p>

        <div className="drc-badge-row">
          <span className="drc-badge hi">FULL ACCOUNT EXPORT, ONE CLICK</span>
          <span className="drc-badge">30-DAY RECORDING RETENTION</span>
          <span className="drc-badge">DELETE REQUIRES TYPING &ldquo;DELETE&rdquo;</span>
        </div>

        {/* ── RECORDINGS ─────────────────────────────────────────────────── */}
        <section className="drc-section">
          <h2>▸ HOW RECORDINGS ACTUALLY WORK</h2>
          <p>
            Every call is recorded server-side automatically — there&apos;s
            no per-call toggle to remember to turn on. Recordings show up
            in your dashboard shortly after the call ends, playable
            directly in the browser or downloadable as a file.
          </p>
          <ul>
            <li><strong>Retention is 30 days.</strong> After that, a recording ages out automatically. Call metadata — timestamp, disposition, AMD result — is kept separately for longer; see <Link href="/faq/how-we-keep-compliance">how we keep compliance</Link> for the full retention split.</li>
            <li><strong>You can delete one early, any time.</strong> Deleting a recording removes it from the carrier directly, not just from your view of it — it&apos;s a real delete, not a hide.</li>
            <li><strong>Only the account that made the call can access its recording.</strong> On a Manager+ team, that means the owner sees recordings for calls made under campaigns they own; an individual agent&apos;s own dials are theirs.</li>
          </ul>
        </section>

        {/* ── FULL ACCOUNT EXPORT ────────────────────────────────────────── */}
        <section className="drc-section">
          <h2>▸ EXPORTING YOUR ENTIRE ACCOUNT</h2>
          <p>
            Beyond individual recordings, there&apos;s a single export
            that pulls literally everything tied to your account into one
            JSON file — not a marketing &ldquo;contact us for your
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
            skip — your desktop app icon layout and window preferences are
            in there too. Downloaded as a single dated file, ready to
            archive or hand to another system.
          </p>
        </section>

        {/* ── ACCOUNT DELETION ───────────────────────────────────────────── */}
        <section className="drc-section">
          <h2>▸ DELETING YOUR ACCOUNT FOR REAL</h2>
          <p>
            This is a genuine, permanent delete — not a deactivation that
            quietly keeps your data around. It&apos;s built with enough
            friction that it&apos;s hard to trigger by accident, but no
            harder than that.
          </p>

          <div className="drc-flow">
            <div className="drc-flow-step">
              <div className="drc-flow-body">
                <h4>1. DRY RUN BY DEFAULT</h4>
                <p>Requesting deletion without explicit confirmation runs a dry run — it tells you exactly what would be deleted and how many records, without touching anything.</p>
              </div>
            </div>
            <div className="drc-flow-step">
              <div className="drc-flow-body">
                <h4>2. TYPE &ldquo;DELETE&rdquo; TO CONFIRM</h4>
                <p>The actual deletion only runs when the confirmation matches exactly — no single-click accidental deletes.</p>
              </div>
            </div>
            <div className="drc-flow-step">
              <div className="drc-flow-body">
                <h4>3. BLOCKED WHILE A SUBSCRIPTION IS ACTIVE</h4>
                <p>You can&apos;t delete an account with an active subscription without explicitly overriding that check first — cancel or downgrade, then delete, is the intended path.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── HONEST WARNING ────────────────────────────────────────────── */}
        <div className="drc-warn">
          <div className="drc-warn-title">THIS IS NOT REVERSIBLE</div>
          <p>
            Once confirmed, deletion is permanent — campaigns, leads, call
            history, scripts, everything on the export list above. If
            there&apos;s any chance you&apos;ll want the data later, run
            the full export first and keep the file somewhere safe before
            confirming deletion.
          </p>
        </div>

        {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
        <div className="drc-callout">
          <p>
            <strong>Worth knowing —</strong> the export and delete tools
            work on your own account&apos;s data. On a Manager+ team, an
            owner deleting their account doesn&apos;t silently wipe their
            agents&apos; individual accounts — each agent&apos;s own data
            and login are separate from the owner&apos;s.
          </p>
        </div>

        {/* ── RELATED ────────────────────────────────────────────────────── */}
        <div className="drc-related">
          <div className="drc-related-label">▸ RELATED READING</div>
          <div className="drc-related-links">
            <Link href="/faq/how-we-keep-compliance">How we keep compliance</Link>
            <Link href="/faq/compliance-export">Compliance export</Link>
            <Link href="/faq/billing">Billing &amp; cancellation</Link>
            <Link href="/faq/leads">Uploading &amp; managing leads</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="drc-cta-box">
          <div className="drc-cta-eyebrow">▸ YOUR DATA, ON YOUR TERMS</div>
          <h3 className="drc-cta-h">Export everything, or delete everything. No ticket required.</h3>
          <p>
            Both live in your account settings, ready whenever you need
            them.
          </p>
          <a href={isSignedIn ? '/dashboard/settings' : '/sign-up'} className="drc-cta-btn">
            {isSignedIn ? 'GO TO SETTINGS →' : 'GET STARTED →'}
          </a>
        </div>
      </article>
    </div>
  )
}
