import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import GutsShell from '@/components/GutsShell'
import { legalRail } from '@/lib/gutsRail'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import { primeLocale, t } from '@/lib/i18n/server'




export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Terms of Service: DialerSeat',
  description: 'The agreement between DialerSeat and users. Covers acceptable use, subscription terms, refunds, TCPA compliance, and liability.',
  alternates: {
    canonical: 'https://dialerseat.com/terms',
  },
  openGraph: {
    title: 'Terms of Service: DialerSeat',
    description:
      'The agreement between DialerSeat and its users: acceptable use, subscription terms, refunds, TCPA compliance, and liability.',
    url: 'https://dialerseat.com/terms',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service: DialerSeat',
    description:
      'The agreement between DialerSeat and its users: acceptable use, subscription terms, refunds, TCPA compliance, and liability.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const LAST_UPDATED = 'July 17, 2026'

export default async function TermsPage() {
  await primeLocale()
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Terms of Service', url: '/terms' },
      ])} />
      <>
      <SiteHeader />
      <GutsShell rail={legalRail()} activeHref="/terms">
        <style>{`
          .tos-root * { box-sizing: border-box; }
          .tos-hero {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 80px 32px 60px;
            text-align: center;
          }
          .tos-hero h1 {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: -1px;
            margin: 0 0 16px 0;
          }
          .tos-hero p {
            font-size: 14px;
            color: rgba(255,255,255,0.6);
            letter-spacing: 2px;
            margin: 0;
          }
          .tos-body {
            max-width: 840px;
            margin: 0 auto;
            padding: 60px 32px 80px;
            background: white;
            border-left: 1px solid #c4c8d0;
            border-right: 1px solid #c4c8d0;
          }
          .tos-body h2 {
            font-size: 22px;
            font-weight: 800;
            color: #1a1c24;
            margin: 48px 0 16px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #c4c8d0;
          }
          .tos-body h2:first-of-type { margin-top: 0; }
          .tos-body h3 {
            font-size: 16px;
            font-weight: 800;
            color: #2a4a8a;
            margin: 24px 0 12px 0;
          }
          .tos-body p, .tos-body li {
            font-size: 15px;
            line-height: 1.7;
            color: #1a1c24;
            margin: 0 0 14px 0;
          }
          .tos-body ul {
            margin: 0 0 16px 0;
            padding-left: 24px;
          }
          .tos-body li { margin-bottom: 8px; }
          .tos-body strong { font-weight: 800; color: #1a1c24; }
          .tos-body a { color: #2a4a8a; text-decoration: underline; }
          .tos-body .meta-row {
            background: #f0f1f4;
            border-left: 3px solid #2a4a8a;
            padding: 14px 18px;
            margin: 16px 0 24px 0;
            border-radius: 4px;
            font-size: 13px;
            color: #5a5e6a;
          }
          .tos-body .meta-row strong { color: #1a1c24; }
          .tos-body .warning-row {
            background: #fdf4e8;
            border-left: 3px solid #8a6a1a;
            padding: 14px 18px;
            margin: 16px 0 24px 0;
            border-radius: 4px;
            font-size: 14px;
            color: #1a1c24;
          }
          .tos-body .warning-row strong { color: #8a6a1a; }
          .tos-body .toc {
            background: #f0f1f4;
            padding: 24px 28px;
            border-radius: 8px;
            margin-bottom: 48px;
          }
          .tos-body .toc h3 { margin-top: 0; }
          .tos-body .toc ol {
            margin: 0;
            padding-left: 20px;
            font-size: 14px;
            line-height: 1.9;
          }
          .tos-body .toc a {
            color: #1a1c24;
            text-decoration: none;
          }
          .tos-body .toc a:hover {
            color: #2a4a8a;
            text-decoration: underline;
          }
          @media (max-width: 768px) {
            .tos-hero { padding: 56px 20px 40px; }
            .tos-hero h1 { font-size: 32px; }
            .tos-body { padding: 40px 20px 60px; }
            .tos-body h2 { font-size: 19px; }
          }
        `}</style>

        <div className="tos-root">
          <div className="tos-hero">
            <h1>{t("Terms of Service")}</h1>
            <p>{t("LAST UPDATED ·")}{" "}{LAST_UPDATED.toUpperCase()}</p>
          </div>

          <div className="tos-body">
            <div className="meta-row">
              <strong>{t("The short version:")}</strong> {t("Pay $35/week per seat ($75/week for white-label Manager+). Don't use DialerSeat™ to break the law (TCPA, DNC, harassment). We can suspend accounts that abuse the service. Cancel anytime, no contract. Full terms below.")}</div>

            <div className="toc">
              <h3>{t("Contents")}</h3>
              <ol>
                <li><a href="#acceptance">{t("Acceptance of terms")}</a></li>
                <li><a href="#description">{t("Description of service")}</a></li>
                <li><a href="#account">{t("Account registration")}</a></li>
                <li><a href="#subscription">{t("Subscription, billing, and cancellation")}</a></li>
                <li><a href="#acceptable-use">{t("Acceptable use")}</a></li>
                <li><a href="#tcpa">{t("TCPA and telemarketing compliance")}</a></li>
                <li><a href="#your-content">{t("Your content and data")}</a></li>
                <li><a href="#our-ip">{t("Our intellectual property")}</a></li>
                <li><a href="#availability">{t("Service availability")}</a></li>
                <li><a href="#suspension">{t("Suspension and termination")}</a></li>
                <li><a href="#warranty">{t("Disclaimer of warranties")}</a></li>
                <li><a href="#liability">{t("Limitation of liability")}</a></li>
                <li><a href="#indemnification">{t("Indemnification")}</a></li>
                <li><a href="#governing-law">{t("Governing law and disputes")}</a></li>
                <li><a href="#changes">{t("Changes to these terms")}</a></li>
                <li><a href="#contact">{t("Contact us")}</a></li>
              </ol>
            </div>

            <h2 id="acceptance">{t("1. Acceptance of terms")}</h2>
            <p>
              {t("These Terms of Service (\"Terms\") form a binding agreement between you and DialerSeat™ (\"we\", \"us\", \"our\"). By creating an account, accessing, or using DialerSeat, you agree to these Terms and our")}{" "}<Link href="/privacy">{t("Privacy Policy")}</Link>.
            </p>
            <p>
              {t("If you don't agree to these Terms, don't use the service.")}</p>
            <p>
              {t("If you're using DialerSeat on behalf of an organization, you represent that you have authority to bind that organization to these Terms, and \"you\" refers to both you and that organization.")}</p>

            <h2 id="description">{t("2. Description of service")}</h2>
            <p>
              {t("DialerSeat is a cloud-based outbound calling platform. We provide:")}</p>
            <ul>
              <li>{t("A web-based dialer application for placing outbound calls")}</li>
              <li>{t("Storage and organization of lead lists and call records")}</li>
              <li>{t("Multiple dialing modes (Preview, Power, Progressive, Predictive)")}</li>
              <li>{t("Voicemail detection (AMD) and skip logic")}</li>
              <li>{t("Call recording and disposition tracking")}</li>
              <li>{t("Team management and seat-based access controls")}</li>
              <li>{t("Outbound phone number provisioning (where applicable)")}</li>
            </ul>
            <p>
              {t("We're not a telephony carrier. We use third-party carriers (currently Telnyx) to place calls. Carrier outages and limitations affect DialerSeat.")}</p>
            <p>
              {t("We're not a CRM. We integrate with your CRM via API and webhooks.")}</p>
            <p>
              <strong>{t("We are not your lawyer.")}</strong> {t("DialerSeat is software. You are responsible for complying with the laws that govern your outbound calling activity. We help by enforcing TCPA calling windows server-side, but compliance with TCPA, DNC, state-specific telemarketing laws, and any other applicable regulations remains your responsibility.")}</p>

            <h2 id="account">{t("3. Account registration")}</h2>
            <p>{t("To use DialerSeat, you must:")}</p>
            <ul>
              <li>{t("Be at least 18 years old")}</li>
              <li>{t("Provide accurate registration information")}</li>
              <li>{t("Keep your login credentials secure")}</li>
              <li>{t("Notify us promptly of any unauthorized access to your account")}</li>
            </ul>
            <p>
              {t("You are responsible for all activity on your account, including activity by team members you invite. If a team member misuses the service, your account may be suspended.")}</p>

            <h2 id="subscription">{t("4. Subscription, billing, and cancellation")}</h2>

            <h3>{t("Pricing")}</h3>
            <p>
              {t("DialerSeat costs")}{" "}<strong>{t("$35 per seat per week")}</strong>{t(", charged weekly to the payment method on file. We may change pricing with at least 30 days' notice; pricing changes don't affect the current billing period.")}</p>
            <p>
              {t("We also offer")}{" "}<strong>{t("Manager+")}</strong>{t(", a white-label tier priced at")}{' '}
              <strong>{t("$75 per week")}</strong>{t(", which provisions your own branded subdomain, logo, and brand colors in addition to the standard features. Manager+ is billed under the same weekly, no-contract terms described in this section, the higher price reflects the added white-label provisioning, not different cancellation, refund, or liability terms.")}</p>

            <h3>{t("Billing")}</h3>
            <p>
              {t("Payments are processed by Stripe. By providing payment information, you authorize us to charge your card weekly for active seats. Failed payments may result in service suspension after a brief grace period.")}</p>

            <h3>{t("Cancellation")}</h3>
            <p>
              {t("You can cancel at any time from your billing dashboard. Cancellation takes effect at the end of your current billing period, you keep access until then. No refund is issued for the unused portion of the current week.")}</p>
            <p>
              {t("When you cancel, your data is preserved. You can resubscribe later and pick up where you left off, or request permanent deletion of your account data (see")}{" "}<Link href="/privacy">{t("Privacy Policy")}</Link>{t(", Section 8).")}</p>

            <h3>{t("Refunds")}</h3>
            <p>
              {t("Refunds are only considered within 24 hours of the charge going through. Once that 24-hour window has passed, the charge is final, canceling afterward stops future billing (see Cancellation, above) but does not refund the period you're already in. Contact")}{" "}<a href="mailto:support@dialerseat.com">support@dialerseat.com</a> {t("with refund requests. And ONLY")}{"  "}<a href="mailto:support@dialerseat.com">support@dialerseat.com</a> {t("Any other email address is Fraudulent, And is not messaging you on our behalf.")}</p>

            <h3>{t("Taxes")}</h3>
            <p>
              {t("Prices shown do not include sales tax. We may collect applicable sales tax on top of the base subscription price depending on your billing address.")}</p>

            <h2 id="acceptable-use">{t("5. Acceptable use")}</h2>
            <p>{t("You agree not to use DialerSeat to:")}</p>
            <ul>
              <li>{t("Place calls in violation of the Telephone Consumer Protection Act (TCPA), the Telemarketing Sales Rule (TSR), the National Do Not Call Registry, state DNC lists, or any applicable telemarketing law")}</li>
              <li>{t("Harass, intimidate, threaten, or defraud any person")}</li>
              <li>{t("Place calls without a lawful basis (consent, established business relationship, or other recognized exception)")}</li>
              <li>{t("Spoof caller ID in a way that violates the Truth in Caller ID Act")}</li>
              <li>{t("Place robocalls to numbers without the recipient's prior express written consent where required")}</li>
              <li>{t("Place calls during prohibited hours in the recipient's local time")}</li>
              <li>{t("Engage in fraud, phishing, scams, or any deceptive practice")}</li>
              <li>{t("Sell or promote illegal products or services")}</li>
              <li>{t("Attempt to circumvent DialerSeat's TCPA enforcement, abandon-rate caps, or DNC checking")}</li>
              <li>{t("Resell DialerSeat's service without our written permission")}</li>
              <li>{t("Reverse-engineer, scrape, or attempt to extract DialerSeat's source code or proprietary algorithms")}</li>
              <li>{t("Interfere with or disrupt the service (DDoS, exploit attempts, etc.)")}</li>
              <li>{t("Upload lead lists you don't have lawful permission to call")}</li>
              <li>{t("Upload data containing children's personal information without consent")}</li>
            </ul>

            <div className="warning-row">
              <strong>{t("⚠ This is serious.")}</strong> {t("TCPA violations carry statutory damages of $500-$1,500 per call. We reserve the right to suspend or terminate accounts that we reasonably believe are engaged in unlawful telemarketing, even before formal legal proceedings. We will cooperate with law enforcement investigations and respond to lawful subpoenas.")}</div>

            <h2 id="tcpa">{t("6. TCPA and telemarketing compliance")}</h2>
            <p>
              {t("DialerSeat enforces certain TCPA-related guardrails automatically:")}</p>
            <ul>
              <li>{t("Calling-window restrictions per lead's local time (typically 8AM-9PM)")}</li>
              <li>{t("State-specific calling rule enforcement (Sunday bans where applicable)")}</li>
              <li>{t("Automated abandon-rate protections in predictive mode (FTC TSR 3% rule)")}</li>
              <li>{t("STIR/SHAKEN A-attestation on outbound calls where supported")}</li>
            </ul>
            <p>
              <strong>{t("These guardrails do not constitute legal compliance certification.")}</strong> {t("They reduce common compliance risks but do not absolve you of responsibility for:")}</p>
            <ul>
              <li>{t("Obtaining proper consent for the calls you place")}</li>
              <li>{t("Maintaining and respecting your own internal DNC list")}</li>
              <li>{t("Scrubbing your lists against the National DNC Registry")}</li>
              <li>{t("Complying with state-specific telemarketing laws beyond what we enforce")}</li>
              <li>{t("Identifying yourself and providing required disclosures on every call")}</li>
              <li>{t("Honoring opt-out requests during and after calls")}</li>
            </ul>
            <p>
              {t("If you're unsure about whether your calling practices comply with applicable law, consult a qualified attorney before using DialerSeat for outbound calling.")}</p>

            <h2 id="your-content">{t("7. Your content and data")}</h2>
            <p>
              {t("You retain all rights to the data you upload (leads, scripts, dispositions, etc.). By using DialerSeat, you grant us a limited license to store, process, and display your data")}{" "}<strong>{t("only as necessary to operate the service for you")}</strong>.
            </p>
            <p>{t("You represent and warrant that:")}</p>
            <ul>
              <li>{t("You have all necessary rights to the data you upload")}</li>
              <li>{t("Your use of the data complies with applicable privacy laws")}</li>
              <li>{t("You have a lawful basis to contact the people in your lead lists")}</li>
              <li>{t("You will not upload data that infringes intellectual property rights of others")}</li>
            </ul>
            <p>
              {t("We will not sell your data, share it with advertisers, or use it to train AI models. See our")}{" "}<Link href="/privacy">{t("Privacy Policy")}</Link> {t("for details on data handling.")}</p>

            <h2 id="our-ip">{t("8. Our intellectual property")}</h2>
            <p>
              {t("The DialerSeat™ name, logo, application code, designs, and documentation are our property. We grant you a non-exclusive, non-transferable, revocable license to use DialerSeat for your business purposes during the term of your subscription.")}</p>
            <p>{t("You may not:")}</p>
            <ul>
              <li>{t("Copy, modify, or create derivative works of DialerSeat")}</li>
              <li>{t("Sell, rent, or sublicense access to DialerSeat")}</li>
              <li>{t("Remove proprietary notices or branding from the service")}</li>
              <li>{t("Use our trademarks without our written permission")}</li>
            </ul>

            <h2 id="availability">{t("9. Service availability")}</h2>
            <p>
              {t("We aim for high uptime but do not promise specific availability levels. The service depends on third-party providers (Supabase, Vercel, Clerk, Stripe, Telnyx) whose outages affect DialerSeat. We will make reasonable efforts to notify you of planned maintenance and to resolve outages promptly.")}</p>
            <p>
              {t("We do not provide a Service Level Agreement (SLA) at the $35/week price point. Enterprise SLAs are available on request.")}</p>

            <h2 id="suspension">{t("10. Suspension and termination")}</h2>
            <p>{t("We may suspend or terminate your account if:")}</p>
            <ul>
              <li>{t("You violate these Terms or our")}{" "}<Link href="/privacy">{t("Privacy Policy")}</Link></li>
              <li>{t("You fail to pay your subscription on time")}</li>
              <li>{t("We reasonably believe your use of the service exposes us to legal risk")}</li>
              <li>{t("Required to do so by law, court order, or regulatory authority")}</li>
              <li>{t("Your account is inactive for an extended period (we'll notify you first)")}</li>
            </ul>
            <p>
              {t("We'll typically give notice before suspension or termination, except in cases of suspected fraud, abuse, or imminent legal risk to us or third parties.")}</p>
            <p>
              {t("You can terminate your account at any time by cancelling your subscription. See Section 4 for what happens to your data after cancellation.")}</p>

            <h2 id="warranty">{t("11. Disclaimer of warranties")}</h2>
            <p>
              {t("DialerSeat is provided")}{" "}<strong>{t("\"AS IS\" and \"AS AVAILABLE\"")}</strong> {t("without warranties of any kind, either express or implied. To the fullest extent permitted by law, we disclaim all warranties including warranties of merchantability, fitness for a particular purpose, non-infringement, and accuracy.")}</p>
            <p>
              {t("We do not warrant that:")}</p>
            <ul>
              <li>{t("The service will be uninterrupted, error-free, or completely secure")}</li>
              <li>{t("The service will meet your specific requirements")}</li>
              <li>{t("Call connection rates, answer rates, or conversion rates will reach any specific level")}</li>
              <li>{t("The TCPA enforcement features will catch every edge case (you are still responsible for compliance)")}</li>
              <li>{t("Voicemail detection will be 100% accurate")}</li>
            </ul>

            <h2 id="liability">{t("12. Limitation of liability")}</h2>
            <p>
              <strong>{t("To the fullest extent permitted by law:")}</strong>
            </p>
            <ul>
              <li>{t("We are not liable for any indirect, incidental, special, consequential, or punitive damages, including lost profits, lost revenue, lost data, or business interruption")}</li>
              <li>{t("Our total cumulative liability for any claim arising out of or related to these Terms or the service is limited to the amount you paid us in the 12 months preceding the claim")}</li>
              <li>{t("We are not liable for damages caused by third-party providers we use to deliver the service (Supabase, Vercel, Clerk, Stripe, Telnyx, etc.)")}</li>
              <li>{t("We are not liable for TCPA, DNC, or other telemarketing law violations committed using DialerSeat, even where our compliance features are involved")}</li>
            </ul>
            <p>
              {t("Some jurisdictions don't allow the exclusion of certain warranties or limitation of liability for incidental or consequential damages. In those jurisdictions, our liability is limited to the greatest extent permitted by law.")}</p>

            <h2 id="indemnification">{t("13. Indemnification")}</h2>
            <p>
              {t("You agree to indemnify, defend, and hold harmless DialerSeat and its officers, employees, and contractors from any claims, damages, losses, or expenses (including legal fees) arising from:")}</p>
            <ul>
              <li>{t("Your use of the service")}</li>
              <li>{t("Your violation of these Terms")}</li>
              <li>{t("Your violation of any law or regulation, including telemarketing laws")}</li>
              <li>{t("Any claim that your lead data or calling practices infringe the rights of a third party")}</li>
              <li>{t("Disputes between you and the people you call")}</li>
            </ul>

            <h2 id="governing-law">{t("14. Governing law and disputes")}</h2>
            <p>
              {t("These Terms are governed by the laws of the State of North Carolina, United States, without regard to its conflict-of-laws principles.")}</p>
            <p>
              {t("Any dispute arising out of or related to these Terms or the service shall be resolved by binding arbitration administered by a recognized arbitration body in North Carolina, except that either party may seek injunctive relief in court for intellectual property or confidentiality violations.")}</p>
            <p>
              <strong>{t("You agree to resolve disputes individually, not as part of a class action.")}</strong>
            </p>
            <p>
              <strong>{t("Opt-out of arbitration:")}</strong> {t("You may decline this arbitration agreement and class-action waiver by emailing")}{" "}<a href="mailto:legal@dialerseat.com">legal@dialerseat.com</a>{' '}
              {t("with your name, account email, and a clear statement that you opt out, within 30 days of the date you first agreed to these Terms (or, for existing users, within 30 days of the date this arbitration provision was added or updated). If you opt out, disputes between you and DialerSeat will be resolved in the courts described above rather than through arbitration, and the rest of these Terms remain in effect.")}</p>

            <h2 id="changes">{t("15. Changes to these terms")}</h2>
            <p>
              {t("We may update these Terms from time to time. Material changes will be communicated by email to registered users at least 30 days before they take effect. The \"Last updated\" date at the top of this page reflects the most recent revision.")}</p>
            <p>
              {t("Your continued use of DialerSeat after a Terms update constitutes acceptance of the updated Terms. If you don't accept the updated Terms, you must cancel your subscription before they take effect.")}</p>

            <h2 id="contact">{t("16. Contact us")}</h2>
            <p>
              {t("Questions about these Terms? Email")}{" "}<a href="mailto:legal@dialerseat.com">legal@dialerseat.com</a>.
            </p>
            <p>
              {t("For general support:")}{" "}<a href="mailto:support@dialerseat.com">support@dialerseat.com</a>.
            </p>
            <p>
              {t("For privacy questions:")}{" "}<a href="mailto:privacy@dialerseat.com">privacy@dialerseat.com</a>.
            </p>
            <p>
              {t("See also:")}{" "}<Link href="/privacy">{t("Privacy Policy")}</Link>.
            </p>
          </div>
        </div>
      </GutsShell>
      <SiteFooter />
    </>
    </>
  )
}