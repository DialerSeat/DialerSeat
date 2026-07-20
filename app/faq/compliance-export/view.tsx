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

export default function ComplianceExportFaqView() {
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
        .cex-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .cex-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .cex-h1 {
          font-size: 42px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .cex-h1 em { font-style: normal; color: ${T.amber}; }
        .cex-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }
        .cex-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .cex-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .cex-badge.hi { background: ${T.dark}; color: #ffcf7a; border-color: ${T.dark}; }

        .cex-section { margin: 56px 0; }
        .cex-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .cex-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .cex-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .cex-section p.muted { color: ${T.muted}; font-size: 15px; }
        .cex-section strong { color: ${T.text}; font-weight: 700; }
        .cex-section em { font-style: italic; color: ${T.accent}; }
        .cex-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .cex-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }
        .cex-section code {
          background: ${T.surface}; padding: 1px 6px; border-radius: 3px;
          font-size: 13.5px; font-family: monospace;
        }

        /* CSV MOCKUP */
        .cex-csv {
          margin: 24px 0; background: ${T.dark}; border-radius: 8px; overflow-x: auto;
          padding: 20px 22px; box-shadow: 0 20px 50px rgba(20,20,40,0.18);
        }
        .cex-csv-title { font-size: 10px; letter-spacing: 2px; color: #ffcf7a; font-weight: bold; margin-bottom: 12px; }
        .cex-csv table { border-collapse: collapse; width: 100%; min-width: 640px; }
        .cex-csv th {
          text-align: left; font-size: 10.5px; letter-spacing: 0.5px; color: #8a8ea8;
          font-weight: 700; padding: 6px 12px 6px 0; border-bottom: 1px solid #2a2c48;
          font-family: monospace;
        }
        .cex-csv td {
          font-size: 12px; color: #d8dae8; padding: 8px 12px 8px 0;
          font-family: monospace; white-space: nowrap;
        }
        .cex-csv tr:not(:last-child) td { border-bottom: 1px solid #1f2140; }

        /* FIELD TABLE */
        .cex-field-table { margin: 20px 0 8px; border: 1px solid ${T.border}; border-radius: 8px; overflow: hidden; background: white; }
        .cex-field-row { display: grid; grid-template-columns: 160px 1fr; }
        .cex-field-row + .cex-field-row { border-top: 1px solid ${T.border}; }
        .cex-field-row.head { background: ${T.dark}; }
        .cex-field-cell { padding: 12px 16px; font-size: 13.5px; line-height: 1.6; }
        .cex-field-row.head .cex-field-cell {
          color: white; font-size: 10.5px; letter-spacing: 2px; font-weight: bold;
        }
        .cex-field-cell.name { font-weight: 700; color: ${T.text}; background: ${T.surface}; font-size: 12.5px; }
        .cex-field-cell code { background: transparent; padding: 0; font-size: 12px; }

        .cex-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.amber}; border-radius: 4px;
        }
        .cex-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .cex-callout strong { color: ${T.accent}; }

        .cex-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .cex-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .cex-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .cex-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .cex-related-links a:hover { border-bottom-color: ${T.accent}; }

        .cex-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .cex-cta-box .cex-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: #ffcf7a;
          font-weight: bold; margin-bottom: 14px;
        }
        .cex-cta-box .cex-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .cex-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .cex-cta-box .cex-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #ffb84a, #e08a1a);
          border: none; border-radius: 6px; color: #1a1a2e;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(255,184,74,0.25);
        }

        @media (max-width: 768px) {
          .cex-root { padding: 48px 20px 80px; }
          .cex-h1 { font-size: 26px; }
          .cex-deck { font-size: 16px; }
          .cex-section h3 { font-size: 19px; }
          .cex-section p, .cex-section li { font-size: 15px; }
          .cex-field-row { grid-template-columns: 110px 1fr; }
          .cex-field-cell { font-size: 12px; padding: 10px 12px; }
          .cex-cta-box { padding: 32px 24px; }
          .cex-cta-box .cex-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="cex-root">
        <div className="cex-eyebrow">▸ COMPLIANCE EXPORT</div>

        <h1 className="cex-h1">
          Don&apos;t just tell an auditor you&apos;re compliant. <em>Show them.</em>
        </h1>

        <p className="cex-deck">
          Every campaign can generate a real, downloadable compliance
          record for any date range — AMD results, abandon flags,
          dispositions, call duration, and a link to the recording, one
          row per call. This is the actual tool behind everything the{' '}
          <Link href="/faq/how-we-keep-compliance">compliance pages</Link>{' '}
          describe.
        </p>

        <div className="cex-badge-row">
          <span className="cex-badge hi">DOWNLOADABLE CSV</span>
          <span className="cex-badge">ANY DATE RANGE</span>
          <span className="cex-badge">PHONE REDACTION ON BY DEFAULT</span>
          <span className="cex-badge">INCLUDED, NO EXTRA COST</span>
        </div>

        {/* ── WHAT YOU GET ───────────────────────────────────────────────── */}
        <section className="cex-section">
          <h2>▸ WHAT&apos;S ACTUALLY IN THE FILE</h2>
          <p>
            Pick a campaign and a date range, and DialerSeat generates a
            CSV — nine columns, one row per call. Here&apos;s a real
            excerpt of the format:
          </p>

          <div className="cex-csv">
            <div className="cex-csv-title">DIALERSEAT-COMPLIANCE-[CAMPAIGN]-[START]-TO-[END].CSV</div>
            <table>
              <thead>
                <tr>
                  <th>call_id</th>
                  <th>timestamp_utc</th>
                  <th>agent</th>
                  <th>lead_phone</th>
                  <th>amd_result</th>
                  <th>was_abandoned</th>
                  <th>disposition</th>
                  <th>duration_seconds</th>
                  <th>recording_url</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>a3f9c2e1...</td>
                  <td>2026-07-14T15:32:01Z</td>
                  <td>Jane Smith</td>
                  <td>+1713XXXXXXX</td>
                  <td>human</td>
                  <td>false</td>
                  <td>appointment</td>
                  <td>184</td>
                  <td>https://...</td>
                </tr>
                <tr>
                  <td>b7e21d44...</td>
                  <td>2026-07-14T15:34:12Z</td>
                  <td>Jane Smith</td>
                  <td>+1713XXXXXXX</td>
                  <td>machine</td>
                  <td>false</td>
                  <td>voicemail</td>
                  <td>6</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="cex-field-table">
            <div className="cex-field-row head">
              <div className="cex-field-cell">COLUMN</div>
              <div className="cex-field-cell">WHAT IT SHOWS</div>
            </div>
            <div className="cex-field-row">
              <div className="cex-field-cell name">amd_result</div>
              <div className="cex-field-cell">Whether the call was answered by a human or a machine — the actual AMD verdict, per call, not a summary stat.</div>
            </div>
            <div className="cex-field-row">
              <div className="cex-field-cell name">was_abandoned</div>
              <div className="cex-field-cell">True/false flag for whether this specific call counted toward the abandon-rate calculation — the exact number regulators care about.</div>
            </div>
            <div className="cex-field-row">
              <div className="cex-field-cell name">disposition</div>
              <div className="cex-field-cell">What the agent marked the call as (appointment, not interested, DNC, voicemail, etc.)</div>
            </div>
            <div className="cex-field-row">
              <div className="cex-field-cell name">recording_url</div>
              <div className="cex-field-cell">Direct link to the call recording, when one exists — see <Link href="/faq/data-and-recordings">recordings &amp; your data</Link> for retention windows.</div>
            </div>
          </div>
        </section>

        {/* ── PHONE REDACTION ────────────────────────────────────────────── */}
        <section className="cex-section">
          <h2>▸ PHONE NUMBERS ARE MASKED BY DEFAULT</h2>
          <p>
            Every export redacts the lead&apos;s phone number automatically
            — area code visible, the rest masked (<code>+1713XXXXXXX</code>).
            This is the default specifically because a compliance export is
            often handed to someone outside your organization — a client,
            an auditor, a lead vendor — and there&apos;s rarely a reason
            that third party needs the full number to verify your calling
            behavior. Full, unmasked numbers can still be pulled when
            genuinely needed; masking is the default, not a hard limit.
          </p>
        </section>

        {/* ── WHO CAN PULL IT ────────────────────────────────────────────── */}
        <section className="cex-section">
          <h2>▸ WHO CAN GENERATE ONE</h2>
          <p>
            Only a campaign&apos;s owner can export its compliance
            record — the same permission boundary as every other
            campaign-level action. On a Manager+ team, that means the
            owner can pull a record for any campaign they created; it&apos;s
            not something an individual agent generates for a campaign
            they&apos;re just dialing on.
          </p>
        </section>

        {/* ── WHEN TO USE IT ────────────────────────────────────────────── */}
        <section className="cex-section">
          <h2>▸ WHEN THIS ACTUALLY GETS USED</h2>
          <ul>
            <li><strong>A lead vendor asking for proof.</strong> If you&apos;re buying leads under a contract that requires demonstrating TCPA-compliant handling, this is the receipt.</li>
            <li><strong>An internal audit before a busy quarter.</strong> Pull the last 30 days on a predictive campaign and check the abandon-rate column directly instead of trusting the dashboard summary alone.</li>
            <li><strong>A regulatory inquiry.</strong> If a complaint ever traces back to a specific call, the export gets you to the exact record — timestamp, disposition, and recording link — in minutes, not a support ticket.</li>
            <li><strong>Handing off to a client.</strong> Agencies running campaigns on behalf of a client can share a redacted record without exposing their client&apos;s full lead list.</li>
          </ul>
        </section>

        {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
        <div className="cex-callout">
          <p>
            <strong>What this isn&apos;t —</strong> the export shows you
            exactly what happened on every call. It doesn&apos;t retroactively
            fix a list that was never scrubbed against the National DNC
            Registry, and it doesn&apos;t generate consent that was never
            obtained. It&apos;s a record of behavior, not a compliance
            guarantee — see <Link href="/faq/how-we-keep-compliance">how
            we keep compliance</Link> for the full split of what&apos;s
            automated versus what&apos;s still the seller&apos;s
            responsibility.
          </p>
        </div>

        {/* ── RELATED ────────────────────────────────────────────────────── */}
        <div className="cex-related">
          <div className="cex-related-label">▸ RELATED READING</div>
          <div className="cex-related-links">
            <Link href="/faq/how-we-keep-compliance">How we keep compliance</Link>
            <Link href="/faq/why-is-compliance-important">Why compliance is important</Link>
            <Link href="/faq/numbers">Phone numbers &amp; caller ID</Link>
            <Link href="/faq/data-and-recordings">Recordings &amp; your data</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="cex-cta-box">
          <div className="cex-cta-eyebrow">▸ EVERY CAMPAIGN CAN GENERATE ONE</div>
          <h3 className="cex-cta-h">Included, no extra cost, no separate compliance-reporting add-on.</h3>
          <p>
            Pull a record for any campaign, any date range, whenever you
            actually need one.
          </p>
          <a href={isSignedIn ? '/dashboard/campaigns' : '/sign-up'} className="cex-cta-btn">
            {isSignedIn ? 'GO TO CAMPAIGNS →' : 'GET STARTED →'}
          </a>
        </div>
      </article>
    </div>
  )
}
