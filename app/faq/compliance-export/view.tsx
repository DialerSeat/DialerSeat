'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'


export default function ComplianceExportFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/compliance-export')} activeHref="/faq/compliance-export">
        <FaqTheme />
        <style>{`
/* CSV MOCKUP */
          .cex-csv {
            margin: 24px 0; background: ${SITE.ink}; border-radius: 8px; overflow-x: auto;
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
          .cex-field-table { margin: 20px 0 8px; border: 1px solid ${SITE.border}; border-radius: 8px; overflow: hidden; background: ${SITE.surface}; }
          .cex-field-row { display: grid; grid-template-columns: 160px 1fr; }
          .cex-field-row + .cex-field-row { border-top: 1px solid ${SITE.border}; }
          .cex-field-row.head { background: ${SITE.ink}; }
          .cex-field-cell { padding: 12px 16px; font-size: 13.5px; line-height: 1.6; }
          .cex-field-row.head .cex-field-cell {
            color: white; font-size: 10.5px; letter-spacing: 2px; font-weight: bold;
          }
          .cex-field-cell.name { font-weight: 700; color: ${SITE.text}; background: ${SITE.surface}; font-size: 12.5px; }
          .cex-field-cell code { background: transparent; padding: 0; font-size: 12px; }@media (max-width: 768px) {
            .cex-field-row { grid-template-columns: 110px 1fr; }
            .cex-field-cell { font-size: 12px; padding: 10px 12px; }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">▸ COMPLIANCE EXPORT</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            Don&apos;t just tell an auditor you&apos;re compliant. <em>Show them.</em>
          </h1>

          <p className="faq-deck">
            Every campaign can generate a real, downloadable compliance
            record for any date range: AMD results, abandon flags,
            dispositions, call duration, and a link to the recording, one
            row per call. This is the actual tool behind everything the{' '}
            <Link href="/faq/how-we-keep-compliance">compliance pages</Link>{' '}
            describe.
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">DOWNLOADABLE CSV</span>
            <span className="faq-badge">ANY DATE RANGE</span>
            <span className="faq-badge">PHONE REDACTION ON BY DEFAULT</span>
            <span className="faq-badge">INCLUDED, NO EXTRA COST</span>
          </div>

          {/* ── WHAT YOU GET ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHAT&apos;S ACTUALLY IN THE FILE</h2>
            <p>
              Pick a campaign and a date range, and DialerSeat generates a
              CSV: nine columns, one row per call. Here&apos;s a real
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
                <div className="cex-field-cell">Whether the call was answered by a human or a machine: the actual AMD verdict, per call, not a summary stat.</div>
              </div>
              <div className="cex-field-row">
                <div className="cex-field-cell name">was_abandoned</div>
                <div className="cex-field-cell">True/false flag for whether this specific call counted toward the abandon-rate calculation, the exact number regulators care about.</div>
              </div>
              <div className="cex-field-row">
                <div className="cex-field-cell name">disposition</div>
                <div className="cex-field-cell">What the agent marked the call as (appointment, not interested, DNC, voicemail, etc.)</div>
              </div>
              <div className="cex-field-row">
                <div className="cex-field-cell name">recording_url</div>
                <div className="cex-field-cell">Direct link to the call recording, when one exists, see <Link href="/faq/data-and-recordings">recordings &amp; your data</Link> for retention windows.</div>
              </div>
            </div>
          </section>

          {/* ── PHONE REDACTION ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ PHONE NUMBERS ARE MASKED BY DEFAULT</h2>
            <p>
              Every export redacts the lead&apos;s phone number automatically
 area code visible, the rest masked (<code>+1713XXXXXXX</code>).
              This is the default specifically because a compliance export is
              often handed to someone outside your organization: a client,
              an auditor, a lead vendor, and there&apos;s rarely a reason
              that third party needs the full number to verify your calling
              behavior. Full, unmasked numbers can still be pulled when
              genuinely needed; masking is the default, not a hard limit.
            </p>
          </section>

          {/* ── WHO CAN PULL IT ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHO CAN GENERATE ONE</h2>
            <p>
              Only a campaign&apos;s owner can export its compliance
              record, the same permission boundary as every other
              campaign-level action. On a Manager+ team, that means the
              owner can pull a record for any campaign they created; it&apos;s
              not something an individual agent generates for a campaign
              they&apos;re just dialing on.
            </p>
          </section>

          {/* ── WHEN TO USE IT ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHEN THIS ACTUALLY GETS USED</h2>
            <ul>
              <li><strong>A lead vendor asking for proof.</strong> If you&apos;re buying leads under a contract that requires demonstrating TCPA-compliant handling, this is the receipt.</li>
              <li><strong>An internal audit before a busy quarter.</strong> Pull the last 30 days on a predictive campaign and check the abandon-rate column directly instead of trusting the dashboard summary alone.</li>
              <li><strong>A regulatory inquiry.</strong> If a complaint ever traces back to a specific call, the export gets you to the exact record: timestamp, disposition, and recording link: in minutes, not a support ticket.</li>
              <li><strong>Handing off to a client.</strong> Agencies running campaigns on behalf of a client can share a redacted record without exposing their client&apos;s full lead list.</li>
            </ul>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>What this isn&apos;t, </strong> the export shows you
              exactly what happened on every call. It doesn&apos;t retroactively
              fix a list that was never scrubbed against the National DNC
              Registry, and it doesn&apos;t generate consent that was never
              obtained. It&apos;s a record of behavior, not a compliance
              guarantee, see <Link href="/faq/how-we-keep-compliance">how
              we keep compliance</Link> for the full split of what&apos;s
              automated versus what&apos;s still the seller&apos;s
              responsibility.
            </p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/how-we-keep-compliance">How we keep compliance</Link>
              <Link href="/faq/why-is-compliance-important">Why compliance is important</Link>
              <Link href="/faq/numbers">Phone numbers &amp; caller ID</Link>
              <Link href="/faq/data-and-recordings">Recordings &amp; your data</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ EVERY CAMPAIGN CAN GENERATE ONE</div>
            <h3 className="faq-cta-h">Included, no extra cost, no separate compliance-reporting add-on.</h3>
            <p>
              Pull a record for any campaign, any date range, whenever you
              actually need one.
            </p>
            <a href={isSignedIn ? '/dashboard/campaigns' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO CAMPAIGNS →' : 'GET STARTED →'}
            </a>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}
