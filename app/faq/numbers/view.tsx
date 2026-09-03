'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import FaqTheme from '@/components/faq-theme'
import { SITE } from '@/lib/siteTheme'


export default function NumbersFaqView() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <div
        style={{
          flex: 1,
          background: SITE.bg,
          minHeight: 'calc(100vh - 64px)',
          fontFamily: 'Futura PT, Futura, sans-serif',
          color: SITE.text,
        }}
      >
        <FaqTheme />
        <style>{`
/* WHY IT HAPPENS CALLOUT (problem framing) */
          .num-problem {
            margin: 28px 0; padding: 26px 28px; background: ${SITE.surface};
            border: 1px solid ${SITE.border}; border-left: 3px solid ${SITE.red};
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
            border-left: 3px solid ${SITE.green}; border-radius: 6px;
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
            border-right: 1px solid ${SITE.border}; font-size: 13px;
          }
          .num-vs-row.head .num-vs-cell {
            color: white; font-size: 11px; letter-spacing: 2px; font-weight: bold;
            border-right: 1px solid rgba(255,255,255,0.1);
          }
          .num-vs-cell.us { color: ${SITE.green}; font-weight: 600; }
          .num-vs-cell.them { color: ${SITE.red}; }@media (max-width: 768px) {
            .num-layer { flex-direction: column; gap: 10px; }
            .num-vs-cell { font-size: 12.5px; padding: 10px 12px; }
          }
        `}</style>

        <article className="faq-root">
          <div className="faq-eyebrow">▸ PHONE NUMBERS &amp; CALLER ID</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>LAST UPDATED 07/28/2026</span>

          <h1 className="faq-h1">
            Unlimited numbers means nothing if they all get <em>flagged.</em>
          </h1>

          <p className="faq-deck">
            Every dialer says &ldquo;unlimited numbers&rdquo; on the pricing
            page. Almost none explain what actually keeps those numbers from
            showing up as &ldquo;Spam Likely&rdquo; on your prospect&apos;s
            screen within a week. Here&apos;s exactly what DialerSeat does
            on the carrier side, and what&apos;s genuinely still on you.
          </p>

          <div className="faq-badge-row">
            <span className="faq-badge hi">STIR/SHAKEN A-ATTESTATION</span>
            <span className="faq-badge">CNAM + FREE CALLER REGISTRY</span>
            <span className="faq-badge">LOCAL PRESENCE DIALING</span>
            <span className="faq-badge">INCLUDED IN EVERY $35/WK SEAT</span>
          </div>

          {/* ── WHY THIS HAPPENS ───────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHY LEGITIMATE CALLS GET FLAGGED IN THE FIRST PLACE</h2>
            <p>
              &ldquo;Spam Likely&rdquo; and &ldquo;Scam Likely&rdquo; labels
              aren&apos;t applied by the FCC or by us — they&apos;re
              generated by third-party carrier analytics engines (Hiya,
              First Orion, TNS, and each major carrier&apos;s own filter)
              that score every outbound number based on calling patterns.
              The label is generated outside your dialer, it refreshes every
              few hours, and it compounds: once people start declining a
              number, the carrier&apos;s model logs that as more evidence,
              and the score gets worse.
            </p>

            <div className="num-problem">
              <div className="num-problem-title">THE PATTERNS THAT GET NUMBERS FLAGGED</div>
              <p>Unregistered numbers dialing at volume — no STIR/SHAKEN attestation, no CNAM, nothing telling the carrier this is a real, verified business.</p>
              <p>Shared number pools where one bad actor&apos;s behavior burns the reputation of every other business dialing from the same numbers.</p>
              <p>Sudden volume spikes — a number going from zero calls to hundreds in a day looks identical to a scam operation spinning up a fresh line.</p>
              <p>Low answer rates and short call durations compounding over time, which every major carrier model treats as a spam signal.</p>
            </div>

            <p className="muted">
              None of this is DialerSeat-specific — it&apos;s true of every
              outbound calling platform on the market. The difference is in
              what a platform actually does about it at the infrastructure
              level, versus just telling you to &ldquo;dial responsibly.&rdquo;
            </p>
          </section>

          {/* ── WHAT WE DO ─────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHAT DIALERSEAT ACTUALLY DOES ABOUT IT</h2>
            <p>
              This isn&apos;t optional add-on infrastructure you have to ask
              for or pay extra to unlock. It&apos;s the default on every
              number in the pool, on every $35/week seat.
            </p>

            <div className="num-layers">
              <div className="num-layer">
                <div className="num-layer-num">1</div>
                <div className="num-layer-body">
                  <h4>STIR/SHAKEN A-ATTESTATION</h4>
                  <p>Every outbound call is cryptographically signed at the carrier level confirming the number is verified, owned, and authorized to call from — the FCC-mandated framework carriers use to separate legitimate businesses from spoofed robocall traffic. A-Level is the highest attestation tier; calls without it get automatically deprioritized by carrier filtering.</p>
                </div>
              </div>
              <div className="num-layer">
                <div className="num-layer-num">2</div>
                <div className="num-layer-body">
                  <h4>CNAM &amp; FREE CALLER REGISTRY REGISTRATION</h4>
                  <p>Numbers are registered so your business identity — not just a raw number — pushes to caller ID displays and to the reputation databases used by Hiya, First Orion, and TNS. An unregistered number calling at volume is the single most common reason a legitimate business gets treated like a scam operation.</p>
                </div>
              </div>
              <div className="num-layer">
                <div className="num-layer-num">3</div>
                <div className="num-layer-body">
                  <h4>LOCAL PRESENCE DIALING</h4>
                  <p>Calls route from a number matching your lead&apos;s area code by default. Local numbers get answered at meaningfully higher rates than out-of-area numbers — and they read as less suspicious to both the person receiving the call and the carrier&apos;s filtering model.</p>
                </div>
              </div>
              <div className="num-layer">
                <div className="num-layer-num">4</div>
                <div className="num-layer-body">
                  <h4>POOL ROTATION, NOT ONE NUMBER FOREVER</h4>
                  <p>DialerSeat maintains a live pool of numbers sized to actual account volume, not a fixed number per seat. When usage on a given number climbs, rotation spreads dial volume instead of hammering one DID until it burns. Numbers pulled from rotation sit through a cooldown period before being reused, rather than going straight back into the pool hot.</p>
                </div>
              </div>
            </div>

            <p style={{ marginTop: 8 }}>
              Every one of these normally shows up as a separate paid
              add-on stack elsewhere in the industry — reputation
              monitoring, branded calling, local presence, each sold and
              billed on its own. Here it&apos;s just what &ldquo;unlimited
              numbers&rdquo; means.
            </p>
          </section>

          {/* ── HOW THE POOL SCALES ────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ HOW THE NUMBER POOL ACTUALLY SCALES</h2>
            <p>
              &ldquo;Unlimited numbers&rdquo; doesn&apos;t mean one giant
              shared bucket everyone pulls from forever. The pool sizes
              itself against real, active usage — as the platform&apos;s
              active seat count grows, the pool grows to match it, with a
              floor so there&apos;s always spare inventory sitting ready.
            </p>

            <div className="num-math">
              <div className="num-math-title">HOW A NUMBER MOVES THROUGH THE POOL</div>
              <div className="num-math-row">
                <span className="num-math-label">1. Added</span>
                <span className="num-math-val">Purchased into an area code matching demand</span>
              </div>
              <div className="num-math-row">
                <span className="num-math-label">2. Active</span>
                <span className="num-math-val">In rotation, dialing under A-attestation + CNAM</span>
              </div>
              <div className="num-math-row">
                <span className="num-math-label">3. Monitored</span>
                <span className="num-math-val">Volume tracked per number, not left unmanaged</span>
              </div>
              <div className="num-math-row">
                <span className="num-math-label">4. Released (if surplus)</span>
                <span className="num-math-val">Cold numbers cycle out on a cooldown, not reused hot</span>
              </div>
            </div>

            <p className="muted">
              You never see or manage this rotation directly — it happens
              automatically in the background. What you experience is just
              &ldquo;the numbers keep working,&rdquo; which is the actual
              point.
            </p>
          </section>

          {/* ── VS INDUSTRY ────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ HOW THIS COMPARES TO THE TYPICAL SETUP</h2>

            <div className="num-vs-table">
              <div className="num-vs-row head">
                <div className="num-vs-cell label">&nbsp;</div>
                <div className="num-vs-cell">TYPICAL DIALER</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">STIR/SHAKEN attestation</div>
                <div className="num-vs-cell them">Varies by provider — often B or C-level, sometimes not disclosed at all</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">CNAM / registry registration</div>
                <div className="num-vs-cell them">Frequently a paid add-on, or left to the customer to handle themselves</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">Local presence dialing</div>
                <div className="num-vs-cell them">Common as a separate line-item feature with its own monthly cost</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">Reputation monitoring</div>
                <div className="num-vs-cell them">Usually a third-party tool you subscribe to separately and check yourself</div>
              </div>
            </div>

            <div className="num-vs-table" style={{ marginTop: 16 }}>
              <div className="num-vs-row head">
                <div className="num-vs-cell label">&nbsp;</div>
                <div className="num-vs-cell">DIALERSEAT</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">STIR/SHAKEN attestation</div>
                <div className="num-vs-cell us">A-Level, on every number, by default</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">CNAM / registry registration</div>
                <div className="num-vs-cell us">Included — every outbound number is carrier-registered</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">Local presence dialing</div>
                <div className="num-vs-cell us">Default behavior, no separate toggle or fee</div>
              </div>
              <div className="num-vs-row">
                <div className="num-vs-cell label">Reputation monitoring</div>
                <div className="num-vs-cell us">Handled at the pool level — rotation and cooldown built in</div>
              </div>
            </div>
          </section>

          {/* ── WHAT'S STILL ON YOU ────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>▸ WHAT&apos;S STILL ON YOU</h2>
            <p>
              Infrastructure removes the carrier-level causes of flagging.
              It doesn&apos;t remove the behavioral ones — those come from
              how a campaign is actually run, and no dialer can fix them
              for you:
            </p>
            <ul>
              <li><strong>List quality.</strong> Unverified, stale, or scraped data drives down answer rates, and low answer rates are one of the strongest spam signals carriers score against.</li>
              <li><strong>Consumer complaint flags.</strong> Apps like Hiya, YouMail, and Truecaller let individual recipients manually mark a number as spam — enough of those on one number and it gets flagged regardless of attestation.</li>
              <li><strong>Abandon rate.</strong> Predictive dialing that regularly approaches the legal abandon-rate ceiling reads as spam-like behavior to carrier models, independent of TCPA compliance. See <Link href="/faq/how-we-keep-compliance">how we keep compliance</Link> for how DialerSeat&apos;s auto-degrade keeps this in check.</li>
              <li><strong>DNC scrubbing.</strong> As covered on <Link href="/faq/how-we-keep-compliance">the compliance page</Link>, national DNC list scrubbing is still the seller&apos;s responsibility — calling numbers on the registry drives complaint-based flagging fast.</li>
            </ul>
          </section>

          {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>One honest note —</strong> no infrastructure,
              ours or anyone else&apos;s, makes a number permanently
              immune to flagging. Carrier scoring models evolve constantly,
              and even a fully registered, A-attested number can pick up a
              label if it&apos;s dialed hard enough against a bad list.
              What A-attestation, CNAM registration, and pool rotation do is
              remove the infrastructure-level causes so the only variable
              left is how the campaign is actually run — which is
              genuinely within your control.
            </p>
          </div>

          {/* ── RELATED ────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">▸ RELATED READING</div>
            <div className="faq-related-links">
              <Link href="/faq/how-we-keep-compliance">How we keep compliance</Link>
              <Link href="/faq/why-is-compliance-important">Why compliance is important</Link>
              <Link href="/faq/why-we-charge">Why we charge what we charge</Link>
              <Link href="/faq/leads">Uploading &amp; managing leads</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────────────  */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">▸ DIAL FROM NUMBERS THAT ACTUALLY GET ANSWERED</div>
            <h3 className="faq-cta-h">$35/week. A-attestation, CNAM, and local presence included.</h3>
            <p>
              No separate reputation-monitoring subscription, no add-on
              fee for local presence. It&apos;s the default on every seat.
            </p>
            <a href={isSignedIn ? '/dashboard/dialer' : '/sign-up'} className="faq-cta-btn">
              {isSignedIn ? 'GO TO DIALER →' : 'GET STARTED →'}
            </a>
          </div>
        </article>
      </div>
      <SiteFooter />
    </>
  )
}
