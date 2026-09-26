'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'
import { t } from '@/lib/i18n/client'


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
            text-align: start; font-size: 10.5px; letter-spacing: 0.5px; color: #8a8ea8;
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
          <div className="faq-eyebrow">{t("▸ COMPLIANCE EXPORT")}</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>

          <h1 className="faq-h1">
            {t("Don't just tell an auditor you're compliant.")}{" "}<em>{t("Show them.")}</em>
          </h1>

          <p className="faq-deck">
            {t("Every campaign can generate a real, downloadable compliance record for any date range: AMD results, abandon flags, dispositions, call duration, and a link to the recording, one row per call. This is the actual tool behind everything the")}{' '}
            <Link href="/faq/how-we-keep-compliance">{t("compliance pages")}</Link>{' '}
            {t("describe.")}</p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">{t("DOWNLOADABLE CSV")}</span>
            <span className="faq-badge">{t("ANY DATE RANGE")}</span>
            <span className="faq-badge">{t("PHONE REDACTION ON BY DEFAULT")}</span>
            <span className="faq-badge">{t("INCLUDED, NO EXTRA COST")}</span>
          </div>

          {/* ── WHAT YOU GET ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT'S ACTUALLY IN THE FILE")}</h2>
            <p>
              {t("Pick a campaign and a date range, and DialerSeat generates a CSV: nine columns, one row per call. Here's a real excerpt of the format:")}</p>

            <div className="cex-csv">
              <div className="cex-csv-title">{t("DIALERSEAT-COMPLIANCE-[CAMPAIGN]-[START]-TO-[END].CSV")}</div>
              <table>
                <thead>
                  <tr>
                    <th>{t("call_id")}</th>
                    <th>{t("timestamp_utc")}</th>
                    <th>{t("agent")}</th>
                    <th>{t("lead_phone")}</th>
                    <th>{t("amd_result")}</th>
                    <th>{t("was_abandoned")}</th>
                    <th>{t("disposition")}</th>
                    <th>{t("duration_seconds")}</th>
                    <th>{t("recording_url")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t("a3f9c2e1...")}</td>
                    <td>{t("2026-07-14T15:32:01Z")}</td>
                    <td>{t("Jane Smith")}</td>
                    <td>{t("+1713XXXXXXX")}</td>
                    <td>{t("human")}</td>
                    <td>{t("false")}</td>
                    <td>{t("appointment")}</td>
                    <td>184</td>
                    <td>https://...</td>
                  </tr>
                  <tr>
                    <td>{t("b7e21d44...")}</td>
                    <td>{t("2026-07-14T15:34:12Z")}</td>
                    <td>{t("Jane Smith")}</td>
                    <td>{t("+1713XXXXXXX")}</td>
                    <td>{t("machine")}</td>
                    <td>{t("false")}</td>
                    <td>{t("voicemail")}</td>
                    <td>6</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="cex-field-table">
              <div className="cex-field-row head">
                <div className="cex-field-cell">{t("COLUMN")}</div>
                <div className="cex-field-cell">{t("WHAT IT SHOWS")}</div>
              </div>
              <div className="cex-field-row">
                <div className="cex-field-cell name">{t("amd_result")}</div>
                <div className="cex-field-cell">{t("Whether the call was answered by a human or a machine: the actual AMD verdict, per call, not a summary stat.")}</div>
              </div>
              <div className="cex-field-row">
                <div className="cex-field-cell name">{t("was_abandoned")}</div>
                <div className="cex-field-cell">{t("True/false flag for whether this specific call counted toward the abandon-rate calculation, the exact number regulators care about.")}</div>
              </div>
              <div className="cex-field-row">
                <div className="cex-field-cell name">{t("disposition")}</div>
                <div className="cex-field-cell">{t("What the agent marked the call as (appointment, not interested, DNC, voicemail, etc.)")}</div>
              </div>
              <div className="cex-field-row">
                <div className="cex-field-cell name">{t("recording_url")}</div>
                <div className="cex-field-cell">{t("Direct link to the call recording, when one exists, see")}{" "}<Link href="/faq/data-and-recordings">{t("recordings & your data")}</Link> {t("for retention windows.")}</div>
              </div>
            </div>
          </section>

          {/* ── PHONE REDACTION ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ PHONE NUMBERS ARE MASKED BY DEFAULT")}</h2>
            <p>
              {t("Every export redacts the lead's phone number automatically area code visible, the rest masked (")}<code>+1713XXXXXXX</code>{t("). This is the default specifically because a compliance export is often handed to someone outside your organization: a client, an auditor, a lead vendor, and there's rarely a reason that third party needs the full number to verify your calling behavior. Full, unmasked numbers can still be pulled when genuinely needed; masking is the default, not a hard limit.")}</p>
          </section>

          {/* ── WHO CAN PULL IT ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHO CAN GENERATE ONE")}</h2>
            <p>
              {t("Only a campaign's owner can export its compliance record, the same permission boundary as every other campaign-level action. On a Manager+ team, that means the owner can pull a record for any campaign they created; it's not something an individual agent generates for a campaign they're just dialing on.")}</p>
          </section>

          {/* ── WHEN TO USE IT ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHEN THIS ACTUALLY GETS USED")}</h2>
            <ul>
              <li><strong>{t("A lead vendor asking for proof.")}</strong> {t("If you're buying leads under a contract that requires demonstrating TCPA-compliant handling, this is the receipt.")}</li>
              <li><strong>{t("An internal audit before a busy quarter.")}</strong> {t("Pull the last 30 days on a predictive campaign and check the abandon-rate column directly instead of trusting the dashboard summary alone.")}</li>
              <li><strong>{t("A regulatory inquiry.")}</strong> {t("If a complaint ever traces back to a specific call, the export gets you to the exact record: timestamp, disposition, and recording link: in minutes, not a support ticket.")}</li>
              <li><strong>{t("Handing off to a client.")}</strong> {t("Agencies running campaigns on behalf of a client can share a redacted record without exposing their client's full lead list.")}</li>
            </ul>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>{t("What this isn't,")}{" "}</strong> {t("the export shows you exactly what happened on every call. It doesn't retroactively fix a list that was never scrubbed against the National DNC Registry, and it doesn't generate consent that was never obtained. It's a record of behavior, not a compliance guarantee, see")}{" "}<Link href="/faq/how-we-keep-compliance">{t("how we keep compliance")}</Link> {t("for the full split of what's automated versus what's still the seller's responsibility.")}</p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">{t("▸ RELATED READING")}</div>
            <div className="faq-related-links">
              <Link href="/faq/how-we-keep-compliance">{t("How we keep compliance")}</Link>
              <Link href="/faq/why-is-compliance-important">{t("Why compliance is important")}</Link>
              <Link href="/faq/numbers">{t("Phone numbers & caller ID")}</Link>
              <Link href="/faq/data-and-recordings">{t("Recordings & your data")}</Link>
              <Link href="/faq">{t("FAQ")}</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">{t("▸ EVERY CAMPAIGN CAN GENERATE ONE")}</div>
            <h3 className="faq-cta-h">{t("Included, no extra cost, no separate compliance-reporting add-on.")}</h3>
            <p>
              {t("Pull a record for any campaign, any date range, whenever you actually need one.")}</p>
            <a href={isSignedIn ? '/dashboard/campaigns' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? t("GO TO CAMPAIGNS →") : t("GET STARTED →")}
            </a>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}
