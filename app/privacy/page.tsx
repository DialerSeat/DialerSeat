import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'

// =============================================================================
// BUILD FIX — force-dynamic to bypass static-generation hang
// =============================================================================
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Privacy Policy — DialerSeat',
  description: 'How DialerSeat collects, uses, stores, and protects your data. Covers user accounts, lead data, call recordings, payment info, and your rights.',
  alternates: {
    canonical: 'https://dialerseat.com/privacy',
  },
  robots: {
    index: true,
    follow: true,
  },
}

// IMPORTANT: This is a static date reflecting when the policy was actually
// last revised. Do NOT make this auto-update. Users need to know what version
// of the policy they agreed to.
//
// When you make material changes to this policy, update this constant manually
// and email registered users at least 30 days before changes take effect (as
// stated in section 12 of the policy itself).
const LAST_UPDATED = 'May 20, 2026'

export default function PrivacyPolicyPage() {
  return (
    <>
      <SiteHeader />
      <main style={{
        background: '#f0f1f4',
        minHeight: '100vh',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: '#1a1c24',
      }}>
        <style>{`
          .privacy-root * { box-sizing: border-box; }
          .privacy-hero {
            background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
            color: white;
            padding: 80px 32px 60px;
            text-align: center;
          }
          .privacy-hero h1 {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: -1px;
            margin: 0 0 16px 0;
          }
          .privacy-hero p {
            font-size: 14px;
            color: rgba(255,255,255,0.6);
            letter-spacing: 2px;
            margin: 0;
          }
          .privacy-body {
            max-width: 840px;
            margin: 0 auto;
            padding: 60px 32px 80px;
            background: white;
            border-left: 1px solid #c4c8d0;
            border-right: 1px solid #c4c8d0;
          }
          .privacy-body h2 {
            font-size: 22px;
            font-weight: 800;
            color: #1a1c24;
            margin: 48px 0 16px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #c4c8d0;
          }
          .privacy-body h2:first-of-type { margin-top: 0; }
          .privacy-body h3 {
            font-size: 16px;
            font-weight: 800;
            color: #2a4a8a;
            margin: 24px 0 12px 0;
          }
          .privacy-body p, .privacy-body li {
            font-size: 15px;
            line-height: 1.7;
            color: #1a1c24;
            margin: 0 0 14px 0;
          }
          .privacy-body ul {
            margin: 0 0 16px 0;
            padding-left: 24px;
          }
          .privacy-body li { margin-bottom: 8px; }
          .privacy-body strong { font-weight: 800; color: #1a1c24; }
          .privacy-body a { color: #2a4a8a; text-decoration: underline; }
          .privacy-body code {
            background: #f0f1f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 13px;
            font-family: monospace;
            color: #2a4a8a;
          }
          .privacy-body .meta-row {
            background: #f0f1f4;
            border-left: 3px solid #2a4a8a;
            padding: 14px 18px;
            margin: 16px 0 24px 0;
            border-radius: 4px;
            font-size: 13px;
            color: #5a5e6a;
          }
          .privacy-body .meta-row strong { color: #1a1c24; }
          .privacy-body .toc {
            background: #f0f1f4;
            padding: 24px 28px;
            border-radius: 8px;
            margin-bottom: 48px;
          }
          .privacy-body .toc h3 { margin-top: 0; }
          .privacy-body .toc ol {
            margin: 0;
            padding-left: 20px;
            font-size: 14px;
            line-height: 1.9;
          }
          .privacy-body .toc a {
            color: #1a1c24;
            text-decoration: none;
          }
          .privacy-body .toc a:hover {
            color: #2a4a8a;
            text-decoration: underline;
          }
          @media (max-width: 768px) {
            .privacy-hero { padding: 56px 20px 40px; }
            .privacy-hero h1 { font-size: 32px; }
            .privacy-body { padding: 40px 20px 60px; }
            .privacy-body h2 { font-size: 19px; }
          }
        `}</style>

        <div className="privacy-root">
          <div className="privacy-hero">
            <h1>Privacy Policy</h1>
            <p>LAST UPDATED · {LAST_UPDATED.toUpperCase()}</p>
          </div>

          <div className="privacy-body">
            <div className="meta-row">
              <strong>The short version:</strong> DialerSeat™ is software you use to make outbound calls. We store the information you give us — your account, your leads, your call records — to run the product for you. We don't sell your data, we don't train AI on your data, and we don't share it with advertisers. Full details below.
            </div>

            <div className="toc">
              <h3>Contents</h3>
              <ol>
                <li><a href="#who-we-are">Who we are</a></li>
                <li><a href="#what-we-collect">What we collect</a></li>
                <li><a href="#how-we-use">How we use your data</a></li>
                <li><a href="#who-we-share">Who we share it with (subprocessors)</a></li>
                <li><a href="#call-recordings">Call recordings and consent</a></li>
                <li><a href="#data-retention">Data retention</a></li>
                <li><a href="#security">Security</a></li>
                <li><a href="#your-rights">Your rights</a></li>
                <li><a href="#cookies">Cookies and tracking</a></li>
                <li><a href="#children">Children</a></li>
                <li><a href="#international">International users</a></li>
                <li><a href="#changes">Changes to this policy</a></li>
                <li><a href="#contact">Contact us</a></li>
              </ol>
            </div>

            <h2 id="who-we-are">1. Who we are</h2>
            <p>
              DialerSeat™ ("we", "us", "our") is an outbound calling platform for sales teams,
              call centers, and solo agents. We operate the website <strong>dialerseat.com</strong> and
              the DialerSeat application. This Privacy Policy explains how we handle information
              when you visit our website, sign up for an account, or use our platform.
            </p>
            <p>
              When you use DialerSeat, you act as the <strong>data controller</strong> for the lead
              information you upload — you decide what to collect, why, and how long to keep it.
              We act as the <strong>data processor</strong>, storing and processing that data on
              your behalf according to your instructions.
            </p>

            <h2 id="what-we-collect">2. What we collect</h2>

            <h3>Account information</h3>
            <p>When you sign up, we collect:</p>
            <ul>
              <li>Your email address</li>
              <li>Your name (if provided)</li>
              <li>Your password (handled by our authentication provider Clerk — we never see or store passwords directly)</li>
              <li>Your IP address and browser user-agent (for session security)</li>
            </ul>

            <h3>Payment information</h3>
            <p>
              Payments are processed by <strong>Stripe</strong>. We never see or store your full
              card number. Stripe gives us back a customer ID, subscription status, and the last
              four digits of your card for display purposes only. Card data is handled entirely
              by Stripe under their PCI DSS Level 1 certification.
            </p>

            <h3>Lead and contact data you upload</h3>
            <p>When you upload a CSV or add leads to a campaign, we store:</p>
            <ul>
              <li>Contact names, phone numbers, email addresses, mailing addresses</li>
              <li>Any custom fields you include in your CSV (notes, tags, statuses, etc.)</li>
              <li>The campaign and team the leads belong to</li>
            </ul>
            <p>
              <strong>You are responsible for the legality of the lead data you upload.</strong> You
              must have a lawful basis (consent, legitimate interest, prior business relationship, etc.)
              to call the people on your lists. DialerSeat enforces TCPA calling-window rules on
              outbound calls, but consent and DNC compliance for the leads themselves is your
              responsibility.
            </p>

            <h3>Call activity data</h3>
            <p>When you make calls through DialerSeat, we store:</p>
            <ul>
              <li>The phone number dialed</li>
              <li>The outbound caller-ID number used</li>
              <li>Call start time, duration, and disposition</li>
              <li>Agent who made the call</li>
              <li>Any notes you add to the call</li>
              <li>Call recordings (see <a href="#call-recordings">Section 5</a>)</li>
            </ul>

            <h3>Usage and technical data</h3>
            <p>
              We collect technical information to operate and improve the service:
            </p>
            <ul>
              <li>Pages you visit on dialerseat.com</li>
              <li>Buttons clicked and features used in the application</li>
              <li>Browser type, device type, screen resolution</li>
              <li>Errors and crash reports (via Sentry)</li>
              <li>IP address (for security and rate limiting)</li>
            </ul>

            <h2 id="how-we-use">3. How we use your data</h2>
            <p>We use the data we collect to:</p>
            <ul>
              <li><strong>Operate the product:</strong> Place outbound calls, store your campaigns and dispositions, render dashboards, send your invoices.</li>
              <li><strong>Authenticate you:</strong> Log you in, keep your session secure, enforce subscription access.</li>
              <li><strong>Bill you:</strong> Charge your card for your weekly subscription, send receipts, handle refunds.</li>
              <li><strong>Support you:</strong> Respond when you email us, investigate bugs you report.</li>
              <li><strong>Improve the product:</strong> Aggregate, anonymized usage data informs what we build next. We do not analyze individual user behavior for marketing purposes.</li>
              <li><strong>Comply with the law:</strong> Respond to lawful subpoenas, court orders, and government requests.</li>
            </ul>
            <p>We <strong>do not</strong>:</p>
            <ul>
              <li>Sell your data to anyone, ever</li>
              <li>Share your data with advertisers</li>
              <li>Train AI models on your call recordings or lead data</li>
              <li>Use your data to compete with you</li>
              <li>Read your call recordings unless you specifically ask us to for support</li>
            </ul>

            <h2 id="who-we-share">4. Who we share data with (subprocessors)</h2>
            <p>
              We use a small number of trusted providers to run DialerSeat. Each one only receives
              the minimum data needed to perform their role:
            </p>
            <ul>
              <li><strong>Supabase</strong> (database hosting) — stores all your account, lead, and call data. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Privacy policy</a></li>
              <li><strong>Vercel</strong> (application hosting) — runs the DialerSeat web application. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy policy</a></li>
              <li><strong>Clerk</strong> (authentication) — handles login, sessions, and password storage. <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy policy</a></li>
              <li><strong>Stripe</strong> (payments) — processes your subscription billing. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Privacy policy</a></li>
              <li><strong>SignalWire</strong> (telephony) — connects your outbound calls and stores call recordings. <a href="https://signalwire.com/privacy" target="_blank" rel="noopener noreferrer">Privacy policy</a></li>
              <li><strong>Sentry</strong> (error monitoring) — receives error reports with stack traces. PII is scrubbed before transmission. <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer">Privacy policy</a></li>
            </ul>
            <p>
              We may add or change subprocessors as we grow. Material changes will be reflected on this page.
              We do not share your data with any third party not listed here without your explicit consent or a
              legal obligation to do so.
            </p>

            <h2 id="call-recordings">5. Call recordings and consent</h2>
            <p>
              DialerSeat records outbound calls by default. Recordings are stored in SignalWire's
              infrastructure and accessible to you in your dashboard.
            </p>
            <p>
              <strong>You are responsible for obtaining consent</strong> to record calls in
              accordance with the laws of the jurisdictions you and your contacts are in.
              The United States has both one-party-consent and two-party-consent states.
              International jurisdictions have varying requirements (the EU generally requires
              two-party consent under GDPR).
            </p>
            <p>
              We recommend that your call scripts include an early disclosure such as: "This call
              may be monitored or recorded for quality and training purposes." If a contact requests
              that recording be stopped, you must comply.
            </p>
            <p>
              Recordings are retained for <strong>30 days</strong> by default, then automatically deleted.
              You can download recordings before that period expires. We do not analyze the content
              of your recordings.
            </p>

            <h2 id="data-retention">6. Data retention</h2>
            <p>Different types of data have different retention rules:</p>
            <ul>
              <li><strong>Account data:</strong> Retained as long as your account is active. If you cancel and don't resubscribe, your data is preserved (we call this "lapsed user data preservation") so you can return later. You can request full deletion at any time — see <a href="#your-rights">Your rights</a>.</li>
              <li><strong>Lead and call data:</strong> Same as account data — preserved through cancellation, deleted on your request.</li>
              <li><strong>Call recordings:</strong> 30 days, then automatically deleted.</li>
              <li><strong>Billing records:</strong> Retained for 7 years as required by tax law.</li>
              <li><strong>Error logs and security logs:</strong> Retained for 90 days then automatically purged.</li>
            </ul>

            <h2 id="security">7. Security</h2>
            <p>We protect your data with:</p>
            <ul>
              <li><strong>Encryption in transit:</strong> All data flows over TLS 1.3.</li>
              <li><strong>Encryption at rest:</strong> Supabase encrypts all stored data at rest using AES-256.</li>
              <li><strong>Authentication:</strong> Clerk-managed sessions with industry-standard security.</li>
              <li><strong>Access controls:</strong> Only you (and team members you authorize) can access your account data.</li>
              <li><strong>Webhook signature verification:</strong> All inbound webhooks (Stripe, SignalWire) are signature-verified to prevent forgery.</li>
              <li><strong>PII scrubbing in error reports:</strong> Sentry receives stack traces but not request bodies or headers containing tokens.</li>
              <li><strong>Idempotent payment processing:</strong> Stripe events are deduplicated to prevent double-charging.</li>
            </ul>
            <p>
              No system is perfectly secure. If we become aware of a data breach affecting your
              data, we will notify you without undue delay as required by applicable law.
            </p>

            <h2 id="your-rights">8. Your rights</h2>
            <p>Depending on where you live, you may have the following rights regarding your data:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the data we hold about you.</li>
              <li><strong>Correction:</strong> Ask us to correct inaccurate data.</li>
              <li><strong>Deletion:</strong> Ask us to delete your account and all associated data.</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format (CSV export of leads and calls is built into the dashboard).</li>
              <li><strong>Objection:</strong> Object to specific uses of your data.</li>
              <li><strong>Withdrawal of consent:</strong> Withdraw any consent you previously gave.</li>
            </ul>
            <p>
              To exercise any of these rights, email us at <a href="mailto:privacy@dialerseat.com">privacy@dialerseat.com</a>.
              We'll respond within 30 days. We may need to verify your identity before processing
              certain requests.
            </p>
            <p>
              <strong>California residents (CCPA):</strong> You have the right to know what categories
              of personal information we collect, the right to delete it, and the right to opt out of
              its "sale" (we don't sell data, so this last right is moot — but it's still your right).
            </p>
            <p>
              <strong>EU/EEA/UK residents (GDPR):</strong> You have the same rights listed above plus
              the right to lodge a complaint with a supervisory authority.
            </p>

            <h2 id="cookies">9. Cookies and tracking</h2>
            <p>
              We use cookies sparingly. The cookies set by dialerseat.com are:
            </p>
            <ul>
              <li><strong>Authentication cookies (Clerk):</strong> Required to keep you logged in. Cannot be disabled without logging out.</li>
              <li><strong>Functional preferences:</strong> Stored in localStorage (not cookies) to remember your campaign selection, sidebar state, etc.</li>
            </ul>
            <p>
              We do <strong>not</strong> use third-party advertising cookies. We do <strong>not</strong> use Google Analytics, Meta Pixel, or other ad-network trackers on our marketing pages. Internal product analytics are server-side only.
            </p>

            <h2 id="children">10. Children</h2>
            <p>
              DialerSeat is a business tool. It is not directed to children under 16. We do not knowingly
              collect personal information from anyone under 16. If we learn that we have collected such
              information, we will delete it. If you believe a minor has used DialerSeat, please contact
              us at <a href="mailto:privacy@dialerseat.com">privacy@dialerseat.com</a>.
            </p>

            <h2 id="international">11. International users</h2>
            <p>
              DialerSeat is operated from the United States. If you access the service from outside
              the US, your data will be transferred to and processed in the US. By using DialerSeat,
              you consent to this transfer.
            </p>
            <p>
              For EU/EEA/UK users, transfers rely on either Standard Contractual Clauses
              with our subprocessors or the user's explicit consent under GDPR Article 49.
            </p>

            <h2 id="changes">12. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we'll update the
              "Last updated" date at the top of this page. Material changes will be communicated
              by email to registered users at least 30 days before they take effect.
            </p>
            <p>
              Your continued use of DialerSeat after a policy update constitutes acceptance of
              the updated terms.
            </p>

            <h2 id="contact">13. Contact us</h2>
            <p>
              Questions about this Privacy Policy, or want to exercise a data right? Email us at
              <a href="mailto:privacy@dialerseat.com"> privacy@dialerseat.com</a>.
            </p>
            <p>
              For general support, email <a href="mailto:support@dialerseat.com">support@dialerseat.com</a>.
            </p>
            <p>
              See also: <Link href="/terms">Terms of Service</Link>.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}