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


























export default function View() {
  const { isSignedIn } = useUser()

  return (
    <>
      <SiteHeader />
      <GutsShell rail={faqRail('/faq/white-label')} activeHref="/faq/white-label">
        <FaqTheme />
        <style>{`
/* Price card up top, sets context immediately */
          .wl-price {
            margin: 0 0 56px 0;
            padding: 28px 32px;
            background: ${SITE.surface};
            border: 1px solid ${SITE.border};
            border-top: 3px solid ${SITE.amber};
            border-radius: 8px;
            display: flex; align-items: center; gap: 24px;
            flex-wrap: wrap;
          }
          .wl-price-amount {
            font-size: 38px; font-weight: 700; color: ${SITE.text};
            letter-spacing: -1px; line-height: 1;
          }
          .wl-price-amount .wl-price-unit {
            font-size: 14px; color: ${SITE.muted}; font-weight: 500;
            letter-spacing: 1px; margin-inline-start: 4px;
          }
          .wl-price-strike {
            font-size: 14px; color: ${SITE.muted};
            text-decoration: line-through; margin-inline-start: 12px;
          }
          .wl-price-text {
            flex: 1; min-width: 240px;
            font-size: 14px; line-height: 1.6; color: ${SITE.muted};
          }
          .wl-price-text strong { color: ${SITE.text}; }

          /* Included / not included two-column */
          .wl-included {
            margin: 28px 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          .wl-included-col {
            padding: 22px 24px;
            background: ${SITE.surface};
            border: 1px solid ${SITE.border};
            border-radius: 6px;
          }
          .wl-included-col.yes { border-inline-start: 3px solid ${SITE.green}; }
          .wl-included-col.no  { border-inline-start: 3px solid ${SITE.amber}; }
          .wl-included-col h4 {
            font-size: 11px; letter-spacing: 3px; font-weight: bold;
            margin: 0 0 12px 0;
          }
          .wl-included-col.yes h4 { color: ${SITE.green}; }
          .wl-included-col.no h4  { color: ${SITE.amber}; }
          .wl-included-col ul { margin: 0; padding-inline-start: 18px; }
          .wl-included-col li {
            font-size: 14px; line-height: 1.65; margin-bottom: 6px;
            color: ${SITE.text};
          }

          .wl-math {
            margin: 28px 0; padding: 24px 28px;
            background: ${SITE.surface};
            border: 1px solid ${SITE.border};
            border-inline-start: 3px solid ${SITE.green};
            border-radius: 6px;
          }
          .wl-math-title {
            font-size: 11px; letter-spacing: 3px; color: ${SITE.green};
            font-weight: bold; margin-bottom: 14px;
          }
          .wl-math-row {
            display: flex; justify-content: space-between; align-items: baseline;
            padding: 6px 0; font-size: 15px;
            border-bottom: 1px dashed ${SITE.border};
          }
          .wl-math-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 4px; }
          .wl-math-row.total {
            border-top: 2px solid ${SITE.border}; border-bottom: none;
            padding-top: 12px; margin-top: 8px;
            font-size: 17px; font-weight: 700;
          }
          .wl-math-row.total .wl-math-val { color: ${SITE.green}; }
          .wl-math-label { color: ${SITE.muted}; }
          .wl-math-val { font-family: monospace; font-weight: 600; color: ${SITE.text}; }

          .wl-promo {
            margin: 56px 0 32px;
            padding: 20px 24px;
            background: ${SITE.surface};
            border: 1px dashed ${SITE.amber};
            border-radius: 6px;
            font-size: 14px; line-height: 1.7;
            color: ${SITE.muted}; font-style: italic;
          }
          .wl-promo strong {
            font-style: normal; color: ${SITE.amber};
            letter-spacing: 1px;
          }
          .wl-cta-secondary {
            display: inline-block; margin-top: 16px;
            color: #888a92; font-size: 11px; letter-spacing: 2px;
            text-decoration: none;
          }
          .wl-cta-secondary:hover { color: ${SITE.muted}; }@media (max-width: 768px) {
            .wl-math { padding: 18px 20px; }
            .wl-price { padding: 22px 22px; }
            .wl-price-amount { font-size: 30px; }
            .wl-included { grid-template-columns: 1fr; }
          }
        `}</style>

        <article className="faq-root">

          <div className="faq-eyebrow">{t("▸ WHITE-LABEL")}</div>
          <span style={{ fontSize: 11, color: '#8888aa', letterSpacing: '2px', display: 'block', marginBottom: 16 }}>{t("LAST UPDATED 07/28/2026")}</span>

          <h1 className="faq-h1">
            {t("Your brand. Your domain.")}{" "}<em>{t("Your dialer.")}</em>
          </h1>

          <p className="faq-deck">
            {t("Run DialerSeat as if you built it. Your logo at the top, your colors throughout, your agents logging in at your domain. They never see \"DialerSeat\" anywhere. This is for managers who want the product to feel like theirs, not someone else's tool they happen to resell.")}</p>

          {/* ── PRICE CARD ─────────────────────────────────────────────────── */}
          <div className="wl-price">
            <div>
              <div className="wl-price-amount">
                $75<span className="wl-price-unit">{t("/week")}</span>
              </div>
            </div>
            <div className="wl-price-text">
              <strong>{t("Replaces your $35/week Pro subscription")}</strong>{t(", not on top of it. Includes everything in Pro plus full re-branding. No setup fees. No contracts. Cancel anytime.")}</div>
          </div>

          {/* ── WHY ─────────────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("WHY YOU'D WANT THIS")}</h2>

            <p>
              {t("If you're reselling DialerSeat to your agents, through manager mode, with seat codes, with your own pricing on top there's a moment when your agents look at the URL bar and see \"dialerseat.com\" and the friction starts. They wonder why they're paying you instead of going direct. They forward the link to their friends. They mention it to other agents in your Slack and now those agents know your stack.")}</p>

            <p>
              {t("White-label fixes that.")}{" "}<strong>{t("The dialer becomes yours.")}</strong>{' '}
              {t("Your domain (say,")}{" "}<em>{t("premierleads.com/dialer")}</em>{t("). Your logo top-left. Your color scheme on every button, every gradient, every accent. Your support email on the contact page. Your company name in the browser tab. Your agents sign up, get their recordings emailed, see disposition reports, and every piece of it carries your brand, not mine.")}</p>

            <p>
              {t("Anyone you onboard sees what looks like a polished proprietary product. The fact that DialerSeat exists doesn't matter to them. To them, you built this.")}</p>
          </section>

          {/* ── THE MATH ─────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("THE MATH AGAINST THE ALTERNATIVES")}</h2>

            <p>
              {t("White-label is $75/week. Roughly $3,900 a year. Compare that to your actual options:")}</p>

            <div className="wl-math">
              <div className="wl-math-title">{t("OPTION 1, BUILD YOUR OWN DIALER")}</div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("Engineering (1 senior, 6-12 mo)")}</span>
                <span className="wl-math-val">$150,000-$300,000</span>
              </div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("Telnyx / Twilio infrastructure")}</span>
                <span className="wl-math-val">{t("$2,000+/mo ongoing")}</span>
              </div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("Maintenance, bug fixes, compliance")}</span>
                <span className="wl-math-val">{t("forever")}</span>
              </div>
              <div className="wl-math-row total">
                <span>{t("Year-one total")}</span>
                <span className="wl-math-val">$175,000+</span>
              </div>
            </div>

            <div className="wl-math">
              <div className="wl-math-title">{t("OPTION 2, LICENSE A WHITE-LABEL DIALER FROM ELSEWHERE")}</div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("Typical platform license")}</span>
                <span className="wl-math-val">{t("$500-$2,000/mo")}</span>
              </div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("+ per-seat fees on top")}</span>
                <span className="wl-math-val">{t("$50-$150/seat/mo")}</span>
              </div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("+ setup / onboarding fees")}</span>
                <span className="wl-math-val">{t("$1,000-$5,000 upfront")}</span>
              </div>
              <div className="wl-math-row total">
                <span>{t("Year-one total (10 seats)")}</span>
                <span className="wl-math-val">$25,000+</span>
              </div>
            </div>

            <div className="wl-math">
              <div className="wl-math-title">{t("OPTION 3, DIALERSEAT WHITE-LABEL")}</div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("Your platform subscription")}</span>
                <span className="wl-math-val">{t("$75/wk = $3,900/yr")}</span>
              </div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("+ per active seat")}</span>
                <span className="wl-math-val">{t("$35/wk per seat")}</span>
              </div>
              <div className="wl-math-row">
                <span className="wl-math-label">{t("Setup, onboarding, infrastructure")}</span>
                <span className="wl-math-val">$0</span>
              </div>
              <div className="wl-math-row total">
                <span>{t("Year-one total (10 seats)")}</span>
                <span className="wl-math-val">~$22,100</span>
              </div>
            </div>

            <p className="muted">
              {t("And every dollar an agent pays you above the $35/seat passthrough is yours. Same margin math as standard manager mode, just with your brand on top.")}</p>
          </section>

          {/* ── WHAT'S INCLUDED ────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ WHAT'S BRANDED, WHAT ISN'T")}</h2>

            <p>
              {t("White-label means a lot of things at different companies, so here's the honest list of what we've actually built and what's still pending. We don't lock features behind a white-label gate and then forget to ship them.")}</p>

            <div className="wl-included">
              <div className="wl-included-col yes">
                <h4>{t("✓ INCLUDED")}</h4>
                <ul>
                  <li>{t("Custom subdomain or full custom domain (CNAME)")}</li>
                  <li>{t("Your logo in the dashboard header")}</li>
                  <li>{t("Primary + accent color theming across the whole UI")}</li>
                  <li>{t("Branded login & signup screens")}</li>
                  <li>{t("Your company name in browser tab, page titles, meta tags")}</li>
                  <li>{t("Branded transactional emails (recordings ready, receipts, alerts)")}</li>
                  <li>{t("Custom support email displayed throughout")}</li>
                  <li>{t("Hidden \"Powered by DialerSeat\" your agents never see us")}</li>
                  <li>{t("Full mobile branding via installable PWA: home-screen icon, theme, and login screen all carry your brand. See")}{" "}<Link href="/faq/white-label-mobile">{t("how it works on mobile")}</Link></li>
                  <li>{t("Everything in standard Pro + manager mode")}</li>
                </ul>
              </div>
              <div className="wl-included-col no">
                <h4>{t("▸ NOT YET")}</h4>
                <ul>
                  <li>{t("Custom Stripe Connect, agents still pay DialerSeat directly for their $35 seat (we're building this)")}</li>
                  <li>{t("Custom Telnyx trunks, outbound calls go through our infrastructure")}</li>
                  <li>{t("Per-region custom domain SSL (we handle SSL automatically; advanced cert pinning isn't available)")}</li>
                </ul>
              </div>
            </div>

            <p>
              {t("The honest truth:")}{" "}<strong>{t("everything visual is branded today, on desktop and mobile alike.")}</strong> {t("The infrastructure-level white-label (custom call trunks, custom payment routing) is on the roadmap. If those matter to you specifically, email me and we'll talk about timeline.")}</p>
          </section>

          {/* ── MOBILE ─────────────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("▸ IT ALSO WORKS ON MOBILE")}</h2>
            <p>
              {t("Your theme doesn't stop at the browser tab. Agents install DialerSeat straight to their phone's home screen as a Progressive Web App: no App Store listing, no separate native build, and the branding carries all the way through: your logo, your colors, your login screen.")}</p>
            <p>
              {t("See")}{" "}<Link href="/faq/white-label-mobile">{t("the full mobile breakdown")}</Link> {t("for real screenshots of the same account running two completely different themes, and why most white-label dialers don't bother offering this on mobile at all.")}</p>
          </section>

          {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
          <section className="faq-section">
            <h2>{t("HOW THE SETUP ACTUALLY WORKS")}</h2>

            <p>
              {t("You upgrade your account to white-label in /billing. You're now at $75/week. The white-label config panel appears in your settings.")}</p>

            <p>
              {t("You upload your logo (we'll auto-generate variants, light mode, dark mode, favicon, social-share). You pick your two colors. You set your custom domain, we generate a CNAME record you point at us, and SSL provisioning happens automatically in ~10 minutes.")}</p>

            <p>
              {t("From that point on, every agent you onboard via a team code or signup link lands in")}{" "}<em>{t("your")}</em> {t("branded version of the product. They sign up at your domain. They never see \"DialerSeat\" anywhere in the chrome, the emails, the URL, or the browser tab. To them, this is your platform.")}</p>

            <p>
              {t("You can still log into your manager view exactly the same way. You see your team, your codes, your campaigns, your agents' metrics. Everything works identically, it just looks like your brand now.")}</p>
          </section>

          {/* ── HONEST CALLOUT ─────────────────────────────────────────────── */}
          <div className="faq-callout">
            <p>
              <strong>{t("One honest thing")}</strong>{t(": even with white-label, DialerSeat still processes the $35/seat charges directly with your agents. They pay us for their seat; you charge them separately for whatever your bundle costs above that. The line-item \"DialerSeat\" will appear on their card statement until we ship Stripe Connect routing, which is in the queue but not live yet. Some of our white-label customers handle this by simply telling agents up front: \"the seat charge appears as DialerSeat because that's our compliance and call-routing partner, everything else routes through us.\"")}</p>
          </div>

          {/* ── PROMO PARAGRAPH ────────────────────────────────────────────── */}
          <div className="wl-promo">
            <p style={{ margin: 0 }}>
              <strong>{t("ONE MORE THING.")}</strong> {t(" If you're operating at real scale: meaningful seat counts, established brand, volume that meaningfully expands the platform, the door's open to talk about discounted white-label pricing, co-marketing arrangements, and other terms that reflect what you're bringing to the table. Email me. Those conversations happen one at a time.")}</p>
          </div>

          {/* ── CTA ─────────────────────────────────────────────────────────── */}
          <div className="faq-cta">
            <div className="faq-cta-eyebrow">{t("▸ READY TO BRAND IT")}</div>
            <div className="faq-cta-h">
              {t("Run the dialer as your own product.")}</div>
            <p>
              {t("$75/week, all-inclusive. No setup fees. No contracts.")}<br/>
              {t("Custom domain, logo, colors, branded emails.")}</p>
            <Link
              href={isSignedIn ? '/billing?plan=whitelabel' : '/sign-up?plan=whitelabel'}
              className="faq-cta-btn"
            >
              {isSignedIn ? t("UPGRADE TO WHITE-LABEL →") : t("GET STARTED →")}
            </Link>
            <div>
              <a
                href="mailto:hello@dialerseat.com?subject=White-label, let's talk"
                className="wl-cta-secondary"
              >
                {t("OR EMAIL ME FIRST →")}</a>
            </div>
          </div>

          {/* ── RELATED ─────────────────────────────────────────────────────── */}
          <div className="faq-related">
            <div className="faq-related-label">{t("▸ RELATED READING")}</div>
            <div className="faq-related-links">
              <Link href="/faq/manager-plus">{t("What Manager+ adds over Pro")}</Link>
              <Link href="/faq/white-label-mobile">{t("White-label on mobile")}</Link>
              <Link href="/faq/managers">{t("Manager mode for agency owners")}</Link>
              <Link href="/faq/why-dialerseat">{t("Why I built DialerSeat")}</Link>
              <Link href="/dialing-modes">{t("Dialing modes explained")}</Link>
              <Link href="/faq">{t("FAQ")}</Link>
              <Link href="/faq/why-we-charge">{t("Pricing")}</Link>
            </div>
          </div>

        </article>
      </GutsShell>
      <SiteFooter />
    </>
  )
}