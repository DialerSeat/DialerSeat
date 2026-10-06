'use client'
import Link from '@/components/LocaleLink'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import GutsShell from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { SITE } from '@/lib/siteTheme'
import { t } from '@/lib/i18n/client'


export default function CampaignsFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/campaigns')} activeHref="/faq/campaigns">
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
          <div className="faq-eyebrow">{t("▸ SETTING UP A CAMPAIGN")}</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>

          <h1 className="faq-h1">
            {t("A campaign is just a mode, a list, and a script.")}{" "}<em>{t("That's it.")}</em>
          </h1>

          <p className="faq-deck">
            {t("No wizard, no required setup flow, no fields you're forced to fill in before you can dial. Create one, it's active immediately, and every setting below has a sane default so you can start dialing before you've touched a single toggle.")}</p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">{t("ACTIVE THE MOMENT YOU CREATE IT")}</span>
            <span className="faq-badge">{t("EVERY SETTING HAS A DEFAULT")}</span>
            <span className="faq-badge">{t("EDITABLE ANY TIME")}</span>
          </div>

          {/* ── THE SETTINGS ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ THE ACTUAL SETTINGS ON A CAMPAIGN")}</h2>
            <p>
              {t("This is the complete list, nothing hidden behind a “advanced” tab you have to go find:")}</p>

            <div className="cmp-settings-table">
              <div className="cmp-settings-row head">
                <div className="cmp-settings-cell">{t("SETTING")}</div>
                <div className="cmp-settings-cell">{t("WHAT IT CONTROLS")}</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">{t("Name")}</div>
                <div className="cmp-settings-cell">{t("Whatever you want. Leave it blank and it becomes “Untitled,” “Untitled (1),” and so on, never a blank or duplicate name.")}</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">{t("Dialer mode")}</div>
                <div className="cmp-settings-cell"><code>preview</code>, <code>power</code>, <code>progressive</code>{t(", or")}{" "}<code>predictive</code>{t(". Defaults to")}{" "}<strong>{t("power")}</strong> {t("if you don't set one. See")}{" "}<Link href="/faq/dialer-modes">{t("dialer modes explained")}</Link>.</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">{t("AMD toggle")}</div>
                <div className="cmp-settings-cell">{t("On or off, your choice, on every mode. Defaults on for progressive and predictive, off for power and preview: a starting point, not a restriction. See")}{" "}<Link href="/faq/how-does-amd-work">{t("how AMD works")}</Link>.</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">{t("Lines per agent")}</div>
                <div className="cmp-settings-cell">{t("Predictive-only. A multiplier between")}{" "}<code>1.0</code> {t("and")}{" "}<code>3.0</code>{t(", defaulting to")}{" "}<code>1.5</code>{t(". Higher means more aggressive pacing; the abandon-rate auto-degrade still applies regardless of where you set it.")}</div>
              </div>
              <div className="cmp-settings-row">
                <div className="cmp-settings-cell name">{t("Status")}</div>
                <div className="cmp-settings-cell"><code>active</code> {t("or")}{" "}<code>inactive</code>{t(". New campaigns start active, there's no draft state you have to publish out of.")}</div>
              </div>
            </div>
          </section>

          {/* ── AMD DEFAULTS ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ THE AMD DEFAULT, MODE BY MODE")}</h2>
            <p>
              {t("AMD is a toggle available on every dialer mode, it's never locked on or locked off. What changes by mode is only the starting position when you first create a campaign:")}</p>

            <div className="cmp-amd-grid">
              <div className="cmp-amd-card">
                <div className="cmp-amd-mode">{t("PREVIEW")}</div>
                <span className="cmp-amd-state off">{t("OFF BY DEFAULT")}</span>
              </div>
              <div className="cmp-amd-card">
                <div className="cmp-amd-mode">{t("POWER")}</div>
                <span className="cmp-amd-state off">{t("OFF BY DEFAULT")}</span>
              </div>
              <div className="cmp-amd-card">
                <div className="cmp-amd-mode">{t("PROGRESSIVE")}</div>
                <span className="cmp-amd-state on">{t("ON BY DEFAULT")}</span>
              </div>
              <div className="cmp-amd-card">
                <div className="cmp-amd-mode">{t("PREDICTIVE")}</div>
                <span className="cmp-amd-state on">{t("ON BY DEFAULT")}</span>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 16 }}>
              {t("Flip it either direction on any campaign, any time, the defaults exist so a fresh campaign starts in a sensible state, not because a mode requires a specific setting.")}</p>
          </section>

          {/* ── HOW A CAMPAIGN COMES TOGETHER ──────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ THE ACTUAL ORDER MOST PEOPLE SET ONE UP")}</h2>

            <div className="faq-flow">
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>{t("1. CREATE THE CAMPAIGN")}</h4>
                  <p>{t("Name it, pick a mode (or leave it on power). It's live immediately.")}</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>{t("2. UPLOAD LEADS")}</h4>
                  <p>{t("Drop in a spreadsheet, see")}{" "}<Link href="/faq/leads">{t("uploading & managing leads")}</Link> {t("for the full field reference.")}</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>{t("3. ATTACH A SCRIPT (OPTIONAL)")}</h4>
                  <p>{t("Toggle on any script you or your team already wrote, see")}{" "}<Link href="/faq/scripts">{t("call scripts")}</Link>{t(". Skip this step entirely if you don't use scripts.")}</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>{t("4. ADJUST MODE-SPECIFIC SETTINGS")}</h4>
                  <p>{t("AMD toggle, and lines-per-agent if predictive. Both optional, both editable later.")}</p>
                </div>
              </div>
              <div className="faq-flow-step">
                <div className="faq-flow-body">
                  <h4>{t("5. DIAL")}</h4>
                  <p>{t("Select the campaign from the dialer terminal and go available. Nothing else is required.")}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>{t("One thing worth knowing,")}{" "}</strong> {t("every setting on this page is editable after the fact, including dialer mode. Switching a live campaign from power to predictive mid-run doesn't require pausing it or re-uploading leads, the leads already in the queue just start getting dialed under the new mode's pacing rules.")}</p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">{t("▸ RELATED READING")}</div>
            <div className="faq-related-links">
              <Link href="/faq/dialer-modes">{t("Dialer modes explained")}</Link>
              <Link href="/faq/leads">{t("Uploading & managing leads")}</Link>
              <Link href="/faq/scripts">{t("Call scripts")}</Link>
              <Link href="/faq/how-does-amd-work">{t("How AMD works")}</Link>
              <Link href="/faq">{t("FAQ")}</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">{t("▸ CREATE YOUR FIRST CAMPAIGN")}</div>
            <h3 className="faq-cta-h">{t("$35/week. No setup wizard, no required fields.")}</h3>
            <p>
              {t("Name it or don't, you'll be dialing in under a minute either way.")}</p>
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
