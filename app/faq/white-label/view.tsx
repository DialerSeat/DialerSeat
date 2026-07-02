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
  gold: '#ffaa3e',
}

export default function View() {
  const { isSignedIn } = useUser()

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      fontFamily: 'Futura PT, Futura, sans-serif',
      color: T.text,
    }}>
      <style>{`
        .wl-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .wl-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.gold};
          font-weight: bold; margin-bottom: 18px;
        }
        .wl-h1 {
          font-size: 44px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .wl-h1 em {
          font-style: normal; color: ${T.gold};
        }
        .wl-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 56px; max-width: 680px;
        }
        .wl-section { margin: 56px 0; }
        .wl-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .wl-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .wl-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .wl-section p.muted { color: ${T.muted}; font-size: 15px; }
        .wl-section strong { color: ${T.text}; font-weight: 700; }
        .wl-section em { font-style: italic; color: ${T.accent}; }
        .wl-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .wl-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }

        /* Price card up top — sets context immediately */
        .wl-price {
          margin: 0 0 56px 0;
          padding: 28px 32px;
          background: white;
          border: 1px solid ${T.border};
          border-top: 3px solid ${T.gold};
          border-radius: 8px;
          display: flex; align-items: center; gap: 24px;
          flex-wrap: wrap;
        }
        .wl-price-amount {
          font-size: 38px; font-weight: 700; color: ${T.text};
          letter-spacing: -1px; line-height: 1;
        }
        .wl-price-amount .wl-price-unit {
          font-size: 14px; color: ${T.muted}; font-weight: 500;
          letter-spacing: 1px; margin-left: 4px;
        }
        .wl-price-strike {
          font-size: 14px; color: ${T.muted};
          text-decoration: line-through; margin-left: 12px;
        }
        .wl-price-text {
          flex: 1; min-width: 240px;
          font-size: 14px; line-height: 1.6; color: ${T.muted};
        }
        .wl-price-text strong { color: ${T.text}; }

        /* Included / not included two-column */
        .wl-included {
          margin: 28px 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .wl-included-col {
          padding: 22px 24px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 6px;
        }
        .wl-included-col.yes { border-left: 3px solid ${T.green}; }
        .wl-included-col.no  { border-left: 3px solid ${T.amber}; }
        .wl-included-col h4 {
          font-size: 11px; letter-spacing: 3px; font-weight: bold;
          margin: 0 0 12px 0;
        }
        .wl-included-col.yes h4 { color: ${T.green}; }
        .wl-included-col.no h4  { color: ${T.amber}; }
        .wl-included-col ul { margin: 0; padding-left: 18px; }
        .wl-included-col li {
          font-size: 14px; line-height: 1.65; margin-bottom: 6px;
          color: ${T.text};
        }

        .wl-math {
          margin: 28px 0; padding: 24px 28px;
          background: white;
          border: 1px solid ${T.border};
          border-left: 3px solid ${T.green};
          border-radius: 6px;
        }
        .wl-math-title {
          font-size: 11px; letter-spacing: 3px; color: ${T.green};
          font-weight: bold; margin-bottom: 14px;
        }
        .wl-math-row {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 6px 0; font-size: 15px;
          border-bottom: 1px dashed ${T.border};
        }
        .wl-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
        .wl-math-row.total {
          border-top: 2px solid ${T.border}; border-bottom: none;
          padding-top: 12px; margin-top: 8px;
          font-size: 17px; font-weight: 700;
        }
        .wl-math-row.total .wl-math-val { color: ${T.green}; }
        .wl-math-label { color: ${T.muted}; }
        .wl-math-val { font-family: monospace; font-weight: 600; color: ${T.text}; }

        .wl-callout {
          margin: 32px 0; padding: 22px 26px;
          background: ${T.surface};
          border-left: 3px solid ${T.blue};
          border-radius: 4px;
        }
        .wl-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .wl-callout strong { color: ${T.accent}; }

        .wl-promo {
          margin: 56px 0 32px;
          padding: 20px 24px;
          background: white;
          border: 1px dashed ${T.amber};
          border-radius: 6px;
          font-size: 14px; line-height: 1.7;
          color: ${T.muted}; font-style: italic;
        }
        .wl-promo strong {
          font-style: normal; color: ${T.amber};
          letter-spacing: 1px;
        }

        .wl-cta-box {
          margin-top: 56px;
          padding: 40px 36px;
          background: ${T.dark};
          border-radius: 8px;
          text-align: center;
        }
        .wl-cta-box .wl-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: ${T.gold};
          font-weight: bold; margin-bottom: 14px;
        }
        .wl-cta-box .wl-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .wl-cta-box p {
          font-size: 15px; color: #c0c2ca; line-height: 1.6;
          margin: 0 0 28px 0;
        }
        .wl-cta-box .wl-cta-btn {
          display: inline-block;
          padding: 16px 36px;
          background: linear-gradient(135deg, #ffaa3e, #d07020);
          border: none; border-radius: 6px;
          color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none;
          font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(255,170,62,0.3);
        }
        .wl-cta-secondary {
          display: inline-block; margin-top: 16px;
          color: #888a92; font-size: 11px; letter-spacing: 2px;
          text-decoration: none;
        }
        .wl-cta-secondary:hover { color: #c0c2ca; }

        .wl-related {
          margin-top: 48px;
          padding-top: 28px;
          border-top: 1px solid ${T.border};
        }
        .wl-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .wl-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .wl-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .wl-related-links a:hover { border-bottom-color: ${T.accent}; }

        @media (max-width: 768px) {
          .wl-root { padding: 48px 20px 80px; }
          .wl-h1 { font-size: 30px; }
          .wl-deck { font-size: 16px; }
          .wl-section h3 { font-size: 19px; }
          .wl-section p, .wl-section li { font-size: 15px; }
          .wl-math { padding: 18px 20px; }
          .wl-price { padding: 22px 22px; }
          .wl-price-amount { font-size: 30px; }
          .wl-included { grid-template-columns: 1fr; }
          .wl-cta-box { padding: 32px 24px; }
          .wl-cta-box .wl-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="wl-root">

        <div className="wl-eyebrow">▸ WHITE-LABEL</div>

        <h1 className="wl-h1">
          Your brand. Your domain. <em>Your dialer.</em>
        </h1>

        <p className="wl-deck">
          Run DialerSeat as if you built it. Your logo at the top, your
          colors throughout, your agents logging in at your domain.
          They never see &quot;DialerSeat&quot; anywhere. This is for managers
          who want the product to feel like theirs, not someone else&apos;s
          tool they happen to resell.
        </p>

        {/* ── PRICE CARD ─────────────────────────────────────────────────── */}
        <div className="wl-price">
          <div>
            <div className="wl-price-amount">
              $75<span className="wl-price-unit">/week</span>
            </div>
          </div>
          <div className="wl-price-text">
            <strong>Replaces your $35/week Pro subscription</strong> — not on
            top of it. Includes everything in Pro plus full re-branding.
            No setup fees. No contracts. Cancel anytime.
          </div>
        </div>

        {/* ── WHY ─────────────────────────────────────────────────────────── */}
        <section className="wl-section">
          <h2>WHY YOU&apos;D WANT THIS</h2>

          <p>
            If you&apos;re reselling DialerSeat to your agents — through
            manager mode, with seat codes, with your own pricing on top —
            there&apos;s a moment when your agents look at the URL bar and
            see &quot;dialerseat.com&quot; and the friction starts. They
            wonder why they&apos;re paying you instead of going direct.
            They forward the link to their friends. They mention it to other
            agents in your Slack and now those agents know your stack.
          </p>

          <p>
            White-label fixes that. <strong>The dialer becomes yours.</strong>{' '}
            Your domain (say, <em>premierleads.com/dialer</em>). Your logo
            top-left. Your color scheme on every button, every gradient,
            every accent. Your support email on the contact page. Your
            company name in the browser tab. Your agents sign up, get their
            recordings emailed, see disposition reports — and every piece of
            it carries your brand, not mine.
          </p>

          <p>
            Anyone you onboard sees what looks like a polished proprietary
            product. The fact that DialerSeat exists doesn&apos;t matter to
            them. To them, you built this.
          </p>
        </section>

        {/* ── THE MATH ─────────────────────────────────────────────────── */}
        <section className="wl-section">
          <h2>THE MATH AGAINST THE ALTERNATIVES</h2>

          <p>
            White-label is $75/week. Roughly $3,900 a year. Compare that to
            your actual options:
          </p>

          <div className="wl-math">
            <div className="wl-math-title">OPTION 1 — BUILD YOUR OWN DIALER</div>
            <div className="wl-math-row">
              <span className="wl-math-label">Engineering (1 senior, 6–12 mo)</span>
              <span className="wl-math-val">$150,000–$300,000</span>
            </div>
            <div className="wl-math-row">
              <span className="wl-math-label">SignalWire / Twilio infrastructure</span>
              <span className="wl-math-val">$2,000+/mo ongoing</span>
            </div>
            <div className="wl-math-row">
              <span className="wl-math-label">Maintenance, bug fixes, compliance</span>
              <span className="wl-math-val">forever</span>
            </div>
            <div className="wl-math-row total">
              <span>Year-one total</span>
              <span className="wl-math-val">$175,000+</span>
            </div>
          </div>

          <div className="wl-math">
            <div className="wl-math-title">OPTION 2 — LICENSE A WHITE-LABEL DIALER FROM ELSEWHERE</div>
            <div className="wl-math-row">
              <span className="wl-math-label">Typical platform license</span>
              <span className="wl-math-val">$500–$2,000/mo</span>
            </div>
            <div className="wl-math-row">
              <span className="wl-math-label">+ per-seat fees on top</span>
              <span className="wl-math-val">$50–$150/seat/mo</span>
            </div>
            <div className="wl-math-row">
              <span className="wl-math-label">+ setup / onboarding fees</span>
              <span className="wl-math-val">$1,000–$5,000 upfront</span>
            </div>
            <div className="wl-math-row total">
              <span>Year-one total (10 seats)</span>
              <span className="wl-math-val">$25,000+</span>
            </div>
          </div>

          <div className="wl-math">
            <div className="wl-math-title">OPTION 3 — DIALERSEAT WHITE-LABEL</div>
            <div className="wl-math-row">
              <span className="wl-math-label">Your platform subscription</span>
              <span className="wl-math-val">$75/wk = $3,900/yr</span>
            </div>
            <div className="wl-math-row">
              <span className="wl-math-label">+ per active seat</span>
              <span className="wl-math-val">$35/wk per seat</span>
            </div>
            <div className="wl-math-row">
              <span className="wl-math-label">Setup, onboarding, infrastructure</span>
              <span className="wl-math-val">$0</span>
            </div>
            <div className="wl-math-row total">
              <span>Year-one total (10 seats)</span>
              <span className="wl-math-val">~$22,100</span>
            </div>
          </div>

          <p className="muted">
            And every dollar an agent pays you above the $35/seat passthrough
            is yours. Same margin math as standard manager mode — just with
            your brand on top.
          </p>
        </section>

        {/* ── WHAT'S INCLUDED ────────────────────────────────────────────── */}
        <section className="wl-section">
          <h2>▸ WHAT&apos;S BRANDED, WHAT ISN&apos;T</h2>

          <p>
            White-label means a lot of things at different companies, so
            here&apos;s the honest list of what we&apos;ve actually built and
            what&apos;s still pending. We don&apos;t lock features behind a
            white-label gate and then forget to ship them.
          </p>

          <div className="wl-included">
            <div className="wl-included-col yes">
              <h4>✓ INCLUDED</h4>
              <ul>
                <li>Custom subdomain or full custom domain (CNAME)</li>
                <li>Your logo in the dashboard header</li>
                <li>Primary + accent color theming across the whole UI</li>
                <li>Branded login & signup screens</li>
                <li>Your company name in browser tab, page titles, meta tags</li>
                <li>Branded transactional emails (recordings ready, receipts, alerts)</li>
                <li>Custom support email displayed throughout</li>
                <li>Hidden &quot;Powered by DialerSeat&quot; — your agents never see us</li>
                <li>Everything in standard Pro + manager mode</li>
              </ul>
            </div>
            <div className="wl-included-col no">
              <h4>▸ NOT YET</h4>
              <ul>
                <li>Custom Stripe Connect — agents still pay DialerSeat directly for their $35 seat (we&apos;re building this)</li>
                <li>Custom Twilio/SignalWire trunks — outbound calls go through our infrastructure</li>
                <li>Custom mobile app icon (web-only for now)</li>
                <li>Per-region custom domain SSL (we handle SSL automatically; advanced cert pinning isn&apos;t available)</li>
              </ul>
            </div>
          </div>

          <p>
            The honest truth: <strong>everything visual is branded
            today.</strong> The infrastructure-level white-label (custom call
            trunks, custom payment routing) is on the roadmap. If those
            matter to you specifically, email me and we&apos;ll talk about
            timeline.
          </p>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <section className="wl-section">
          <h2>HOW THE SETUP ACTUALLY WORKS</h2>

          <p>
            You upgrade your account to white-label in /billing. You&apos;re
            now at $75/week. The white-label config panel appears in your
            settings.
          </p>

          <p>
            You upload your logo (we&apos;ll auto-generate variants — light
            mode, dark mode, favicon, social-share). You pick your two
            colors. You set your custom domain — we generate a CNAME record
            you point at us, and SSL provisioning happens automatically in
            ~10 minutes.
          </p>

          <p>
            From that point on, every agent you onboard via a team code or
            signup link lands in <em>your</em> branded version of the
            product. They sign up at your domain. They never see
            &quot;DialerSeat&quot; anywhere in the chrome, the emails, the
            URL, or the browser tab. To them, this is your platform.
          </p>

          <p>
            You can still log into your manager view exactly the same way.
            You see your team, your codes, your campaigns, your agents&apos;
            metrics. Everything works identically — it just looks like your
            brand now.
          </p>
        </section>

        {/* ── HONEST CALLOUT ─────────────────────────────────────────────── */}
        <div className="wl-callout">
          <p>
            <strong>One honest thing</strong> — even with white-label,
            DialerSeat still processes the $35/seat charges directly with
            your agents. They pay us for their seat; you charge them
            separately for whatever your bundle costs above that. The
            line-item &quot;DialerSeat&quot; will appear on their card
            statement until we ship Stripe Connect routing, which is in
            the queue but not live yet. Some of our white-label customers
            handle this by simply telling agents up front: &quot;the seat
            charge appears as DialerSeat because that&apos;s our compliance
            and call-routing partner — everything else routes through us.&quot;
          </p>
        </div>

        {/* ── PROMO PARAGRAPH ────────────────────────────────────────────── */}
        <div className="wl-promo">
          <p style={{ margin: 0 }}>
            <strong>ONE MORE THING.</strong> &nbsp;If you&apos;re operating
            at real scale — meaningful seat counts, established brand,
            volume that meaningfully expands the platform — the door&apos;s
            open to talk about discounted white-label pricing, co-marketing
            arrangements, and other terms that reflect what you&apos;re
            bringing to the table. Email me. Those conversations happen one
            at a time.
          </p>
        </div>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <div className="wl-cta-box">
          <div className="wl-cta-eyebrow">▸ READY TO BRAND IT</div>
          <div className="wl-cta-h">
            Run the dialer as your own product.
          </div>
          <p>
            $75/week, all-inclusive. No setup fees. No contracts.<br/>
            Custom domain, logo, colors, branded emails.
          </p>
          <Link
            href={isSignedIn ? '/billing?plan=whitelabel' : '/signup?plan=whitelabel'}
            className="wl-cta-btn"
          >
            {isSignedIn ? 'UPGRADE TO WHITE-LABEL →' : 'GET STARTED →'}
          </Link>
          <div>
            <a
              href="mailto:hello@dialerseat.com?subject=White-label — let's talk"
              className="wl-cta-secondary"
            >
              OR EMAIL ME FIRST →
            </a>
          </div>
        </div>

        {/* ── RELATED ─────────────────────────────────────────────────────── */}
        <div className="wl-related">
          <div className="wl-related-label">▸ RELATED READING</div>
          <div className="wl-related-links">
            <Link href="/managers">Manager mode for agency owners</Link>
            <Link href="/faq/why-dialerseat">Why I built DialerSeat</Link>
            <Link href="/dialing-modes">Dialing modes explained</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
        </div>

      </article>
    </div>
  )
}