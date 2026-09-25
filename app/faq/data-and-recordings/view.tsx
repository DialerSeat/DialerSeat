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
          <div className="faq-eyebrow">{t("▸ RECORDINGS & YOUR DATA")}</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>

          <h1 className="faq-h1">
            {t("Your recordings. Your data. Actually")}{" "}<em>{t("yours")}</em> {t("to take or delete.")}</h1>

          <p className="faq-deck">
            {t("Two separate things live on this page: how call recordings work day to day, and the account-level tools for getting everything out or deleting it for good. Both are self-serve, no support ticket required for either.")}</p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">{t("FULL ACCOUNT EXPORT, ONE CLICK")}</span>
            <span className="faq-badge">{t("30-DAY RECORDING RETENTION")}</span>
            <span className="faq-badge">{t("DELETE REQUIRES TYPING “DELETE”")}</span>
          </div>

          {/* ── RECORDINGS ─────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ HOW RECORDINGS ACTUALLY WORK")}</h2>
            <p>
              {t("Every call is recorded server-side automatically, there's no per-call toggle to remember to turn on. Recordings show up in your dashboard shortly after the call ends, playable directly in the browser or downloadable as a file.")}</p>
            <ul>
              <li><strong>{t("Retention is 30 days.")}</strong> {t("After that, a recording ages out automatically. Call metadata: timestamp, disposition, AMD result, is kept separately for longer; see")}{" "}<Link href="/faq/how-we-keep-compliance">{t("how we keep compliance")}</Link> {t("for the full retention split.")}</li>
              <li><strong>{t("You can delete one early, any time.")}</strong> {t("Deleting a recording clears it from your dashboard immediately and is no longer playable through DialerSeat. We also attempt to delete it from the carrier's storage at the same time; that provider-side step is best-effort depending on how the recording was stored.")}</li>
              <li><strong>{t("Only the account that made the call can access its recording.")}</strong> {t("On a Manager+ team, that means the owner sees recordings for calls made under campaigns they own; an individual agent's own dials are theirs.")}</li>
            </ul>
          </section>

          {/* ── FULL ACCOUNT EXPORT ────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ EXPORTING YOUR ENTIRE ACCOUNT")}</h2>
            <p>
              {t("Beyond individual recordings, there's a single export that pulls literally everything tied to your account into one JSON file, not a marketing “contact us for your data” process, an actual button that returns a file immediately.")}</p>

            <div className="drc-export-grid">
              <div className="drc-export-item">{t("Profile")}</div>
              <div className="drc-export-item">{t("Campaigns")}</div>
              <div className="drc-export-item">{t("Leads")}</div>
              <div className="drc-export-item">{t("Lead notes")}</div>
              <div className="drc-export-item">{t("Calls")}</div>
              <div className="drc-export-item">{t("Dial attempts")}</div>
              <div className="drc-export-item">{t("Scripts")}</div>
              <div className="drc-export-item">{t("Custom themes")}</div>
              <div className="drc-export-item">{t("Teams you own")}</div>
              <div className="drc-export-item">{t("Team memberships")}</div>
              <div className="drc-export-item">{t("Support history")}</div>
              <div className="drc-export-item">{t("Desktop app prefs")}</div>
            </div>

            <p className="muted" style={{ marginTop: 16 }}>
              {t("It's everything, including the smaller stuff most exports skip, your desktop app icon layout and window preferences are in there too. Downloaded as a single dated file, ready to archive or hand to another system.")}</p>
          </section>

          {/* ── ACCOUNT DELETION ───────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ DELETING YOUR ACCOUNT FOR REAL")}</h2>
            <p>
              {t("This is a genuine, permanent delete, not a deactivation that quietly keeps your data around. It's built with enough friction that it's hard to trigger by accident, but no harder than that.")}</p>

            <div className="faq-flow">
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>{t("1. DRY RUN BY DEFAULT")}</h4>
                  <p>{t("Requesting deletion without explicit confirmation runs a dry run: it tells you exactly what would be deleted and how many records, without touching anything.")}</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>{t("2. TYPE “DELETE” TO CONFIRM")}</h4>
                  <p>{t("The actual deletion only runs when the confirmation matches exactly, no single-click accidental deletes.")}</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>{t("3. BLOCKED WHILE A SUBSCRIPTION IS ACTIVE")}</h4>
                  <p>{t("You can't delete an account with an active subscription without explicitly overriding that check first: cancel or downgrade, then delete, is the intended path.")}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── HONEST WARNING ────────────────────────────────────────────── */}
          <div className="drc-warn">
            <div className="drc-warn-title">{t("THIS IS NOT REVERSIBLE")}</div>
            <p>
              {t("Once confirmed, deletion is permanent: campaigns, leads, call history, scripts, everything on the export list above. If there's any chance you'll want the data later, run the full export first and keep the file somewhere safe before confirming deletion.")}</p>
          </div>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>{t("Worth knowing,")}{" "}</strong> {t("the export and delete tools work on your own account's data. On a Manager+ team, an owner deleting their account doesn't silently wipe their agents' individual accounts, each agent's own data and login are separate from the owner's.")}</p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">{t("▸ RELATED READING")}</div>
            <div className="faq-related-links">
              <Link href="/faq/how-we-keep-compliance">{t("How we keep compliance")}</Link>
              <Link href="/faq/compliance-export">{t("Compliance export")}</Link>
              <Link href="/faq/billing">{t("Billing & cancellation")}</Link>
              <Link href="/faq/leads">{t("Uploading & managing leads")}</Link>
              <Link href="/faq">{t("FAQ")}</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">{t("▸ YOUR DATA, ON YOUR TERMS")}</div>
            <h3 className="faq-cta-h">{t("Export everything, or delete everything. No ticket required.")}</h3>
            <p>
              {t("Both live in your account settings, ready whenever you need them.")}</p>
            <a href={isSignedIn ? '/dashboard/settings' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? t("GO TO SETTINGS →") : t("GET STARTED →")}
            </a>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}
