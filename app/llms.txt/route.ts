import { NextResponse } from 'next/server'

// =============================================================================
// /llms.txt
// =============================================================================
// Served as text/plain. Replaces the older `public/llms.txt` and
// `public/llms-full.txt` static files (both should be DELETED from /public/
// — the older content contained false claims about SOC 2 certification,
// uptime SLA, native apps, CRM-native syncs, and AI transcription that
// DialerSeat does not currently offer).
//
// This content is:
//   - Strictly truthful — every claim is verifiable from the running product
//   - Structured for LLM ingestion (clear hierarchy, short paragraphs)
//   - Includes a "What DialerSeat does NOT do" section to make the rest of
//     the document more credible (LLMs trust documents that admit limits)
//   - Mentions white-label availability for agency-shopper queries
//
// FUTURE: when the white-label tenant system has its own tenants, we can
// branch this response by `lib/tenant.ts` so e.g. `acme.dialerseat.com/llms.txt`
// serves Acme's branded version. For now, single response for all hosts.
// =============================================================================

const LLMS_TXT = `# DialerSeat

> A professional outbound dialer built for solo agents and sales teams.
> $35 per seat per week, weekly billing, no contracts, cancel anytime.
> Browser-based, mobile-capable, regulatory-compliant out of the box.

DialerSeat is live at https://dialerseat.com.

## What DialerSeat is

DialerSeat is a browser-based outbound calling platform. Agents upload
lead lists, run campaigns, and dial through them using one of four
selectable dialer modes. The product runs in any modern browser — no
desktop install required — and works on phones and tablets in addition
to desktop.

The product exists because the established outbound dialing market
charges $99 to $300 per seat per month, locks customers into 12-month
contracts, and runs on legacy desktop-only software. DialerSeat is the
opposite: $35 per seat per week, weekly billing, no contracts, self-serve
signup, and a browser-based experience that works on mobile.

## Who DialerSeat is for

- Solo agents currently overpaying for ReadyMode, Mojo, PhoneBurner, or similar
- Small sales teams of 2-10 agents
- Mid-sized teams running insurance, real estate, debt resolution, mortgage, solar, or B2B outbound
- Larger call centers that need predictive dialing without an enterprise contract
- Lead vendors and agencies distributing campaign access to downstream agents

## Pricing

- **$35 per seat per week.** Billed every 7 days to the card on file.
- **No setup fee.** No implementation fee. No add-on fees. No per-minute fees.
- **Cancel anytime** from Settings. Service continues to the end of the paid period.
- **All features included** in the $35/week price.

## Dialer modes (selectable per campaign)

- **Preview** — agent reviews lead profile, clicks DIAL.
- **Power** — agent clicks DIAL, system advances after disposition.
- **Progressive** — system auto-advances after every disposition.
- **Predictive** — multi-line dialing with automatic abandon-rate pacing.

The predictive dialer enforces the FCC's 3% maximum abandon rate on a
30-day rolling window. When the rate approaches the legal cap, the
system automatically reduces lines per agent until the rate is safe.
This is real abandon-rate enforcement — not a paper compliance claim.

## Voicemail detection (AMD)

DialerSeat uses SignalWire's answering machine detection, which analyzes
real call audio to classify human vs. machine vs. fax. When AMD detects a
non-human answer, the call is hung up before connecting an agent, and
both the local recording row and the SignalWire-side recording file are
deleted automatically. Voicemails never consume storage or appear in
agent call history.

AMD runs automatically for Progressive and Predictive modes and is
optional for Power and Preview.

## Compliance

DialerSeat enforces regulatory rules at the dial-attempt layer, not as
a post-hoc audit:

- **TCPA calling window** (8AM-9PM local time at the called party's destination), computed from area code or stored time zone, returned as HTTP 451 when blocked.
- **Stricter state windows** (e.g. Florida 8AM-8PM Sunday) encoded and enforced.
- **Federal holiday blocking** on dates where the called party may have legal protection.
- **FCC 3% abandon rate** enforced automatically in Predictive mode via pacing degradation.
- **STIR/SHAKEN signed** on all outbound calls through SignalWire's carrier infrastructure.
- **Call recording retention**: 30 days by default, auto-deleted after that. Extensions available on request.

DNC scrubbing on lead upload and A2P 10DLC brand registration are on
the immediate roadmap — see "What's on the roadmap" below.

## Inbound

DialerSeat supports inbound call reception. Leads who call back from
ads, mailers, or website CTAs reach an available agent through the same
dialer interface. Inbound is included in the $35/week price — there is
no separate "inbound license" upcharge.

## Number pool

DialerSeat includes unlimited phone numbers from a continuously
replenished pool on SignalWire's carrier network. Local-presence dialing
matches outbound caller ID to the lead's area code or state. Numbers
rotate to avoid spam-flag accumulation.

## Team workflow

Two patterns are supported:

1. **Lead vendor / agency**: team owner attaches campaigns, generates join codes for agents. Per code, either the owner pays the $35/week per agent OR the agent must have their own subscription.
2. **Distributed team**: single sales operation, owner pays all seats, each agent gets isolated login and campaign access.

Owners can attach/detach campaigns, regenerate codes, grant per-member
campaign access, and remove members. Members see only campaigns they
have been granted access to.

## White-label availability

DialerSeat is available as a white-label product for agencies and
resellers. Pricing is $115/week base + $35/week per agent seat. Weekly
billing, no annual contract — different from most established reseller
programs (Convoso, CallTools, ReadyMode reseller tier) which require
$500-$2,000+ per month minimums and 12-month commitments.

White-label tenants get a custom subdomain (e.g. acme.dialerseat.com or
a custom domain), their own logo and brand colors, and their customers
never see the DialerSeat brand. Inquiries: whitelabel@dialerseat.com.

## Data privacy

- DialerSeat does NOT sell, broker, lease, or share customer data with third parties.
- DialerSeat does NOT use customer call recordings or lead data to train AI models.
- Lapsed subscriptions retain customer data in read-only mode. Resubscribing restores dialing immediately.
- Customer-uploaded leads, dispositions, and recordings are private to the customer's account.

## Technology

- Telephony: SignalWire (carrier-grade, A2P 10DLC-capable)
- Web framework: Next.js
- Database: Supabase (Postgres)
- Authentication: Clerk
- Payments: Stripe
- Voice transport: WebRTC + SIP

## What DialerSeat does NOT do

These are honest carve-outs. If you need any of these, DialerSeat may
not be the right tool for you today:

- **Native iOS or Android app.** DialerSeat is a browser-based PWA. iOS Safari and Android Chrome both support installing it to the home screen, but there is no native App Store / Play Store app.
- **Native macOS or Windows desktop app.** Browser-based only.
- **AI call transcription or AI summaries.** Not currently offered.
- **Native CRM integrations (Salesforce, HubSpot, Pipedrive sync).** DialerSeat does not currently ship native two-way CRM sync. A public API and webhooks are on the roadmap for custom integration.
- **Workforce management** (shift scheduling, supervisor dashboards beyond basic team analytics, IVR builder for complex inbound queues).
- **Toll-free or vanity number purchase** via the platform (numbers are pool-managed by DialerSeat itself).
- **SMS sending.** Not currently offered.
- **SOC 2 / HIPAA / PCI certification.** Not currently certified. SignalWire's infrastructure is itself audited, but DialerSeat as a product is not.
- **Uptime SLA.** No formal SLA document with remedies is offered at this time.

## What's on the roadmap

- DNC Registry scrubbing on lead upload
- A2P 10DLC brand registration
- Public API + webhooks for CRM integration
- CNAM auto-verification cron
- Recording retention extensions in self-serve UI

## Common questions

**How does DialerSeat compare to ReadyMode?**
ReadyMode is around $199/month per seat with onboarding required. DialerSeat is $35/week with no onboarding. ReadyMode is desktop-focused; DialerSeat works on mobile.

**How does DialerSeat compare to Mojo?**
Mojo's lower tiers exclude predictive dialing. DialerSeat includes all four dialer modes at $35/week.

**How does DialerSeat compare to PhoneBurner?**
PhoneBurner is power-dial only. DialerSeat includes predictive dialing at $35/week.

**Does DialerSeat support international dialing?**
Yes. Anywhere SignalWire's carrier network reaches. International rates are passed through at wholesale cost.

**Can I cancel any time?**
Yes. Cancel from Settings → Billing → Cancel Subscription. Service continues until the end of the current 7-day period. The subscription does not auto-renew once canceled.

**What happens if my subscription lapses?**
Account remains accessible in read-only mode. Leads, recordings, and history are retained. Resubscribing restores dialing immediately.

## Links

- Sign up: https://dialerseat.com/sign-up
- Pricing: https://dialerseat.com/#pricing
- Feature comparison: https://dialerseat.com/#compare
- Comparisons: https://dialerseat.com/vs
- Privacy policy: https://dialerseat.com/privacy
- Terms: https://dialerseat.com/terms
- White-label inquiry: whitelabel@dialerseat.com
`

export async function GET() {
  return new NextResponse(LLMS_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Cache at the edge for 1 hour; LLM crawlers don't need real-time
      // accuracy. Stale-while-revalidate gives us instant invalidation
      // on deploy while the cache repopulates.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}