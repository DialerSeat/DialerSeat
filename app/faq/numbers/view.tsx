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


export default function NumbersFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/numbers')} activeHref="/faq/numbers">
        <FaqTheme />
        <style>{`
/* WHY IT HAPPENS CALLOUT (problem framing) */
          .num-problem {
            margin: 28px 0; padding: 26px 28px; background: ${SITE.surface};
            border: 1px solid ${SITE.border}; border-inline-start: 3px solid ${SITE.red};
            border-radius: 6px;
          }
          .num-problem-title {
            font-size: 11px; letter-spacing: 3px; color: ${SITE.red};
            font-weight: bold; margin-bottom: 12px;
          }
          .num-problem p { font-size: 15px; line-height: 1.7; margin: 0 0 10px 0; }
          .num-problem p:last-child { margin-bottom: 0; }

          /* PROTECTION LAYER CARDS */
          .num-layers { display: flex; flex-direction: column; gap: 14px; margin: 24px 0 8px; }
          .num-layer {
            display: flex; gap: 18px; background: ${SITE.surface}; border: 1px solid ${SITE.border};
            border-radius: 8px; padding: 20px 22px; align-items: flex-start;
          }
          .num-layer-num {
            flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
            background: ${SITE.ink}; color: #7ab8ff; font-size: 14px; font-weight: 800;
            display: flex; align-items: center; justify-content: center;
          }
          .num-layer-body h4 { font-size: 16px; margin: 0 0 6px 0; font-weight: 700; }
          .num-layer-body p { font-size: 14.5px; line-height: 1.65; margin: 0; color: ${SITE.muted}; }

          /* POOL MATH */
          .num-math {
            margin: 28px 0; padding: 24px 28px;
            background: ${SITE.surface}; border: 1px solid ${SITE.border};
            border-inline-start: 3px solid ${SITE.green}; border-radius: 6px;
          }
          .num-math-title {
            font-size: 11px; letter-spacing: 3px; color: ${SITE.green};
            font-weight: bold; margin-bottom: 14px;
          }
          .num-math-row {
            display: flex; justify-content: space-between; align-items: baseline;
            padding: 6px 0; font-size: 15px; border-bottom: 1px dashed ${SITE.border};
          }
          .num-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
          .num-math-label { color: ${SITE.muted}; }
          .num-math-val { font-family: monospace; font-weight: 600; color: ${SITE.text}; }

          /* VS TABLE */
          .num-vs-table { margin: 24px 0 8px; border: 1px solid ${SITE.border}; border-radius: 8px; overflow: hidden; background: ${SITE.surface}; }
          .num-vs-row { display: grid; grid-template-columns: 1fr 1fr; }
          .num-vs-row + .num-vs-row { border-top: 1px solid ${SITE.border}; }
          .num-vs-row.head { background: ${SITE.ink}; }
          .num-vs-cell { padding: 14px 18px; font-size: 14px; line-height: 1.6; }
          .num-vs-cell.label {
            font-weight: 700; color: ${SITE.text}; background: ${SITE.surface};
            border-inline-end: 1px solid ${SITE.border}; font-size: 13px;
          }
          .num-vs-row.head .num-vs-cell {
            color: white; font-size: 11px; letter-spacing: 2px; font-weight: bold;
            border-inline-end: 1px solid rgba(255,255,255,0.1);
          }
          .num-vs-cell.us { color: ${SITE.green}; font-weight: 600; }
          .num-vs-cell.them { color: ${SITE.red}; }@media (max-width: 768px) {
            .num-layer { flex-direction: column; gap: 10px; }
            .num-vs-cell { font-size: 12.5px; padding: 10px 12px; }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">{t("▸ PHONE NUMBERS & CALLER ID")}</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>

          <h1 className="faq-h1">
            {t("Unlimited numbers means nothing if they all get")}{" "}<em>{t("flagged.")}</em>
          </h1>

          <p className="faq-deck">
            {t("Every dialer says “unlimited numbers” on the pricing page. Almost none explain what actually keeps those numbers from showing up as “Spam Likely” on your prospect's screen within a week. Here's exactly what DialerSeat does on the carrier side, and what's genuinely still on you.")}</p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">{t("STIR/SHAKEN A-ATTESTATION")}</span>
            <span className="faq-badge">{t("CNAM + FREE CALLER REGISTRY")}</span>
            <span className="faq-badge">{t("LOCAL PRESENCE DIALING")}</span>
            <span className="faq-badge">{t("INCLUDED IN EVERY $35/WK SEAT")}</span>
          </div>

          {/* ── WHY THIS HAPPENS ───────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHY LEGITIMATE CALLS GET FLAGGED IN THE FIRST PLACE")}</h2>
            <p>
              {t("“Spam Likely” and “Scam Likely” labels aren't applied by the FCC or by us, they're generated by third-party carrier analytics engines (Hiya, First Orion, TNS, and each major carrier's own filter) that score every outbound number based on calling patterns. The label is generated outside your dialer, it refreshes every few hours, and it compounds: once people start declining a number, the carrier's model logs that as more evidence, and the score gets worse.")}</p>

            <div className="num-problem">
              <div className="num-problem-title">{t("THE PATTERNS THAT GET NUMBERS FLAGGED")}</div>
              <p>{t("Unregistered numbers dialing at volume: no STIR/SHAKEN attestation, no CNAM, nothing telling the carrier this is a real, verified business.")}</p>
              <p>{t("Shared number pools where one bad actor's behavior burns the reputation of every other business dialing from the same numbers.")}</p>
              <p>{t("Sudden volume spikes, a number going from zero calls to hundreds in a day looks identical to a scam operation spinning up a fresh line.")}</p>
              <p>{t("Low answer rates and short call durations compounding over time, which every major carrier model treats as a spam signal.")}</p>
            </div>

            <p className="muted">
              {t("None of this is DialerSeat-specific, it's true of every outbound calling platform on the market. The difference is in what a platform actually does about it at the infrastructure level, versus just telling you to “dial responsibly.”")}</p>
          </section>

          {/* ── WHAT WE DO ─────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT DIALERSEAT ACTUALLY DOES ABOUT IT")}</h2>
            <p>
              {t("This isn't optional add-on infrastructure you have to ask for or pay extra to unlock. It's the default on every number in the pool, on every $35/week seat.")}</p>

            <div className="num-layers">
              <div className="num-layer">
                <div className="num-layer-num">1</div>
                <div className="num-layer-body">
                  <h4>{t("STIR/SHAKEN A-ATTESTATION")}</h4>
                  <p>{t("Every outbound call is cryptographically signed at the carrier level confirming the number is verified, owned, and authorized to call from, the FCC-mandated framework carriers use to separate legitimate businesses from spoofed robocall traffic. A-Level is the highest attestation tier; calls without it get automatically deprioritized by carrier filtering.")}</p>
                </div>
              </div>
              <div className="num-layer">
                <div className="num-layer-num">2</div>
                <div className="num-layer-body">
                  <h4>{t("CNAM & FREE CALLER REGISTRY REGISTRATION")}</h4>
                  <p>{t("Numbers are registered so your business identity: not just a raw number: pushes to caller ID displays and to the reputation databases used by Hiya, First Orion, and TNS. An unregistered number calling at volume is the single most common reason a legitimate business gets treated like a scam operation.")}</p>
                </div>
              </div>
              <div className="num-layer">
                <div className="num-layer-num">3</div>
                <div className="num-layer-body">
                  <h4>{t("LOCAL PRESENCE DIALING")}</h4>
                  <p>{t("Calls route from a number matching your lead's area code by default. Local numbers get answered at meaningfully higher rates than out-of-area numbers, and they read as less suspicious to both the person receiving the call and the carrier's filtering model.")}</p>
                </div>
              </div>
              <div className="num-layer">
                <div className="num-layer-num">4</div>
                <div className="num-layer-body">
                  <h4>{t("DAILY CAPS AND LOAD SPREADING, NOT ONE NUMBER FOREVER")}</h4>
                  <p>{t("DialerSeat maintains a live pool of numbers sized to actual account volume, not a fixed number per seat. No number places more than 60 calls a day, and past 40 it drops to the back of the queue, so load spreads across the pool before any single number runs hot. A number answering far below its peers is slowed to 15 calls a day rather than pulled, then restored automatically once it recovers.")}{" "}<Link href="/faq/why-we-dont-rest-flagged-numbers">{t("Why we slow numbers down instead of resting them.")}</Link></p>
                </div>
              </div>
            </div>

            <p style={{ marginTop: 8 }}>
              {t("Every one of these normally shows up as a separate paid add-on stack elsewhere in the industry, reputation monitoring, branded calling, local presence, each sold and billed on its own. Here it's just what “unlimited numbers” means.")}</p>
          </section>

          {/* ── HOW THE POOL SCALES ────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ HOW THE NUMBER POOL ACTUALLY SCALES")}</h2>
            <p>
              {t("“Unlimited numbers” doesn't mean one giant shared bucket everyone pulls from forever. The pool sizes itself against real, active usage, as the platform's active seat count grows, the pool grows to match it, with a floor so there's always spare inventory sitting ready.")}</p>

            <div className="num-math">
              <div className="num-math-title">{t("HOW A NUMBER MOVES THROUGH THE POOL")}</div>
              <div className="num-math-row">
                <span className="num-math-label">{t("1. Added")}</span>
                <span className="num-math-val">{t("Purchased into an area code matching demand")}</span>
              </div>
              <div className="num-math-row">
                <span className="num-math-label">{t("2. Active")}</span>
                <span className="num-math-val">{t("In rotation, dialing under A-attestation + CNAM")}</span>
              </div>
              <div className="num-math-row">
                <span className="num-math-label">{t("3. Monitored")}</span>
                <span className="num-math-val">{t("Capped at 60 a day, answer rate checked daily against the pool")}</span>
              </div>
              <div className="num-math-row">
                <span className="num-math-label">{t("4. Released (if surplus)")}</span>
                <span className="num-math-val">{t("Least-used numbers go first, never one just bought")}</span>
              </div>
            </div>

            <p className="muted">
              {t("You never see or manage any of this directly, it happens automatically in the background. What you experience is just “the numbers keep working,” which is the actual point.")}</p>
          </section>

          {/* ── VS INDUSTRY ────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ HOW THIS COMPARES TO THE TYPICAL SETUP")}</h2>

            <div className="num-vs-table">
              <div className="num-vs-row head">
                <div className="num-vs-cell label">&nbsp;</div>
                <div className="num-vs-cell">{t("TYPICAL DIALER")}</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">{t("STIR/SHAKEN attestation")}</div>
                <div className="num-vs-cell them">{t("Varies by provider: often B or C-level, sometimes not disclosed at all")}</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">{t("CNAM / registry registration")}</div>
                <div className="num-vs-cell them">{t("Frequently a paid add-on, or left to the customer to handle themselves")}</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">{t("Local presence dialing")}</div>
                <div className="num-vs-cell them">{t("Common as a separate line-item feature with its own monthly cost")}</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">{t("Reputation monitoring")}</div>
                <div className="num-vs-cell them">{t("Usually a third-party tool you subscribe to separately and check yourself")}</div>
              </div>
            </div>

            <div className="num-vs-table" style={{ marginTop: 16 }}>
              <div className="num-vs-row head">
                <div className="num-vs-cell label">&nbsp;</div>
                <div className="num-vs-cell">DIALERSEAT</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">{t("STIR/SHAKEN attestation")}</div>
                <div className="num-vs-cell us">{t("A-Level, on every number, by default")}</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">{t("CNAM / registry registration")}</div>
                <div className="num-vs-cell us">{t("Included, every outbound number is carrier-registered")}</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">{t("Local presence dialing")}</div>
                <div className="num-vs-cell us">{t("Default behavior, no separate toggle or fee")}</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">{t("Reputation monitoring")}</div>
                <div className="num-vs-cell us">{t("Every number checked daily against the pool, struggling ones slowed automatically")}</div>
              </div>
            </div>
          </section>

          {/* ── WHAT'S STILL ON YOU ────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT'S STILL ON YOU")}</h2>
            <p>
              {t("Infrastructure removes the carrier-level causes of flagging. It doesn't remove the behavioral ones, those come from how a campaign is actually run, and no dialer can fix them for you:")}</p>
            <ul>
              <li><strong>{t("List quality.")}</strong> {t("Unverified, stale, or scraped data drives down answer rates, and low answer rates are one of the strongest spam signals carriers score against.")}</li>
              <li><strong>{t("Consumer complaint flags.")}</strong> {t("Apps like Hiya, YouMail, and Truecaller let individual recipients manually mark a number as spam, enough of those on one number and it gets flagged regardless of attestation.")}</li>
              <li><strong>{t("Abandon rate.")}</strong> {t("Predictive dialing that regularly approaches the legal abandon-rate ceiling reads as spam-like behavior to carrier models, independent of TCPA compliance. See")}{" "}<Link href="/faq/how-we-keep-compliance">{t("how we keep compliance")}</Link> {t("for how DialerSeat's auto-degrade keeps this in check.")}</li>
              <li><strong>{t("DNC scrubbing.")}</strong> {t("As covered on")}{" "}<Link href="/faq/how-we-keep-compliance">{t("the compliance page")}</Link>{t(", national DNC list scrubbing is still the seller's responsibility, calling numbers on the registry drives complaint-based flagging fast.")}</li>
            </ul>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>{t("One honest note:")}{" "}</strong> {t("no infrastructure, ours or anyone else's, makes a number permanently immune to flagging. Carrier scoring models evolve constantly, and even a fully registered, A-attested number can pick up a label if it's dialed hard enough against a bad list. What A-attestation, CNAM registration, and per-number caps do is remove the infrastructure-level causes so the only variable left is how the campaign is actually run, which is genuinely within your control.")}</p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">{t("▸ RELATED READING")}</div>
            <div className="faq-related-links">
              <Link href="/faq/how-we-keep-compliance">{t("How we keep compliance")}</Link>
              <Link href="/faq/why-is-compliance-important">{t("Why compliance is important")}</Link>
              <Link href="/faq/why-we-charge">{t("Why we charge what we charge")}</Link>
              <Link href="/faq/leads">{t("Uploading & managing leads")}</Link>
              <Link href="/faq">{t("FAQ")}</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">{t("▸ DIAL FROM NUMBERS THAT ACTUALLY GET ANSWERED")}</div>
            <h3 className="faq-cta-h">{t("$35/week. A-attestation, CNAM, and local presence included.")}</h3>
            <p>
              {t("No separate reputation-monitoring subscription, no add-on fee for local presence. It's the default on every seat.")}</p>
            <a href={isSignedIn ? '/dashboard/dialer' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? t("GO TO DIALER →") : t("GET STARTED →")}
            </a>
          </div>
        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}
