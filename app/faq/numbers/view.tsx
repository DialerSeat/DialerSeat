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

export default function NumbersFaqView() {
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
        .num-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .num-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .num-h1 {
          font-size: 42px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .num-h1 em { font-style: normal; color: ${T.red}; }
        .num-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }
        .num-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .num-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .num-badge.hi { background: ${T.dark}; color: #7ab8ff; border-color: ${T.dark}; }

        .num-section { margin: 56px 0; }
        .num-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .num-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .num-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .num-section p.muted { color: ${T.muted}; font-size: 15px; }
        .num-section strong { color: ${T.text}; font-weight: 700; }
        .num-section em { font-style: italic; color: ${T.accent}; }
        .num-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .num-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }

        /* WHY IT HAPPENS CALLOUT (problem framing) */
        .num-problem {
          margin: 28px 0; padding: 26px 28px; background: white;
          border: 1px solid ${T.border}; border-left: 3px solid ${T.red};
          border-radius: 6px;
        }
        .num-problem-title {
          font-size: 11px; letter-spacing: 3px; color: ${T.red};
          font-weight: bold; margin-bottom: 12px;
        }
        .num-problem p { font-size: 15px; line-height: 1.7; margin: 0 0 10px 0; }
        .num-problem p:last-child { margin-bottom: 0; }

        /* PROTECTION LAYER CARDS */
        .num-layers { display: flex; flex-direction: column; gap: 14px; margin: 24px 0 8px; }
        .num-layer {
          display: flex; gap: 18px; background: white; border: 1px solid ${T.border};
          border-radius: 8px; padding: 20px 22px; align-items: flex-start;
        }
        .num-layer-num {
          flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
          background: ${T.dark}; color: #7ab8ff; font-size: 14px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }
        .num-layer-body h4 { font-size: 16px; margin: 0 0 6px 0; font-weight: 700; }
        .num-layer-body p { font-size: 14.5px; line-height: 1.65; margin: 0; color: ${T.muted}; }

        /* POOL MATH */
        .num-math {
          margin: 28px 0; padding: 24px 28px;
          background: white; border: 1px solid ${T.border};
          border-left: 3px solid ${T.green}; border-radius: 6px;
        }
        .num-math-title {
          font-size: 11px; letter-spacing: 3px; color: ${T.green};
          font-weight: bold; margin-bottom: 14px;
        }
        .num-math-row {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 6px 0; font-size: 15px; border-bottom: 1px dashed ${T.border};
        }
        .num-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
        .num-math-label { color: ${T.muted}; }
        .num-math-val { font-family: monospace; font-weight: 600; color: ${T.text}; }

        /* VS TABLE */
        .num-vs-table { margin: 24px 0 8px; border: 1px solid ${T.border}; border-radius: 8px; overflow: hidden; background: white; }
        .num-vs-row { display: grid; grid-template-columns: 1fr 1fr; }
        .num-vs-row + .num-vs-row { border-top: 1px solid ${T.border}; }
        .num-vs-row.head { background: ${T.dark}; }
        .num-vs-cell { padding: 14px 18px; font-size: 14px; line-height: 1.6; }
        .num-vs-cell.label {
          font-weight: 700; color: ${T.text}; background: ${T.surface};
          border-right: 1px solid ${T.border}; font-size: 13px;
        }
        .num-vs-row.head .num-vs-cell {
          color: white; font-size: 11px; letter-spacing: 2px; font-weight: bold;
          border-right: 1px solid rgba(255,255,255,0.1);
        }
        .num-vs-cell.us { color: ${T.green}; font-weight: 600; }
        .num-vs-cell.them { color: ${T.red}; }

        .num-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.amber}; border-radius: 4px;
        }
        .num-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .num-callout strong { color: ${T.accent}; }

        .num-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .num-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .num-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .num-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .num-related-links a:hover { border-bottom-color: ${T.accent}; }

        .num-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .num-cta-box .num-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: #7ab8ff;
          font-weight: bold; margin-bottom: 14px;
        }
        .num-cta-box .num-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .num-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .num-cta-box .num-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #4a9eff, #2a6eff);
          border: none; border-radius: 6px; color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(74,158,255,0.3);
        }

        @media (max-width: 768px) {
          .num-root { padding: 48px 20px 80px; }
          .num-h1 { font-size: 28px; }
          .num-deck { font-size: 16px; }
          .num-section h3 { font-size: 19px; }
          .num-section p, .num-section li { font-size: 15px; }
          .num-layer { flex-direction: column; gap: 10px; }
          .num-vs-cell { font-size: 12.5px; padding: 10px 12px; }
          .num-cta-box { padding: 32px 24px; }
          .num-cta-box .num-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="num-root">
        <div className="num-eyebrow">▸ PHONE NUMBERS &amp; CALLER ID</div>

        <h1 className="num-h1">
          Unlimited numbers means nothing if they all get <em>flagged.</em>
        </h1>

        <p className="num-deck">
          Every dialer says &ldquo;unlimited numbers&rdquo; on the pricing
          page. Almost none explain what actually keeps those numbers from
          showing up as &ldquo;Spam Likely&rdquo; on your prospect&apos;s
          screen within a week. Here&apos;s exactly what DialerSeat does
          on the carrier side, and what&apos;s genuinely still on you.
        </p>

        <div className="num-badge-row">
          <span className="num-badge hi">STIR/SHAKEN A-ATTESTATION</span>
          <span className="num-badge">CNAM + FREE CALLER REGISTRY</span>
          <span className="num-badge">LOCAL PRESENCE DIALING</span>
          <span className="num-badge">INCLUDED IN EVERY $35/WK SEAT</span>
        </div>

        {/* ── WHY THIS HAPPENS ───────────────────────────────────────────── */}
        <section className="num-section">
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
        <section className="num-section">
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
        <section className="num-section">
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
        <section className="num-section">
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
        <section className="num-section">
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
        <div className="num-callout">
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
        <div className="num-related">
          <div className="num-related-label">▸ RELATED READING</div>
          <div className="num-related-links">
            <Link href="/faq/how-we-keep-compliance">How we keep compliance</Link>
            <Link href="/faq/why-is-compliance-important">Why compliance is important</Link>
            <Link href="/faq/why-we-charge">Why we charge what we charge</Link>
            <Link href="/faq/leads">Uploading &amp; managing leads</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="num-cta-box">
          <div className="num-cta-eyebrow">▸ DIAL FROM NUMBERS THAT ACTUALLY GET ANSWERED</div>
          <h3 className="num-cta-h">$35/week. A-attestation, CNAM, and local presence included.</h3>
          <p>
            No separate reputation-monitoring subscription, no add-on
            fee for local presence. It&apos;s the default on every seat.
          </p>
          <a href={isSignedIn ? '/dashboard/dialer' : '/sign-up'} className="num-cta-btn">
            {isSignedIn ? 'GO TO DIALER →' : 'GET STARTED →'}
          </a>
        </div>
      </article>
    </div>
  )
}
