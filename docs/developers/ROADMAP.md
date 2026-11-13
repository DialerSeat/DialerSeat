# DialerSeat for Developers — roadmap

Status: **workshop**. Built on the local `developers` branch. Nothing here is live.
Owner: Joshua. Drafted 13 Nov 2026.

---

## 1. The product in one paragraph

A CRM or software platform puts DialerSeat inside its own product. Its users
click "Dial" on a list they already have in that CRM. The DialerSeat dialer opens
in a small panel (the **miniplayer**) right on the CRM's page. It dials with our
engine: progressive, power or predictive, AMD, voicemail drop, the number pool,
double-dial and calling hours. Every outcome goes back into the CRM through
webhooks, under the CRM's **own** dispositions and campaigns. The CRM stays the
system of record. On our side nothing changes: each of their users is a DialerSeat
user, every call is a `calls` row, and the admin desktop shows them the way it
shows anyone else dialing.

Site: `dev.dialerseat.com` (dark, its own landing page, docs and console).
API: `api.dialerseat.com/v1`. Embed: one script tag.

---

## 2. How it fits what already exists

The dialer engine does not move. The platform layer sits around it.

| Platform concept | Existing DialerSeat piece it reuses |
|---|---|
| Platform (the CRM company) | Same idea as `white_label_tenants`: an org that owns users |
| Platform's end user ("seat") | A normal `users` row, tagged with `platform_id` + `external_user_id` |
| Their campaign | A normal `campaigns` row with `platform_id` + `external_id` |
| Lead push | The same insert path as `/api/ingest/leads/[token]` (claim path untouched) |
| Their dispositions | The campaign's disposition list plus a map to our outcome classes |
| Dial mode policy | `campaigns.dialer_mode`, with platform defaults and per-seat exceptions |
| Calls, recordings, AMD | Unchanged `calls` rows. Webhooks read from them. |
| Admin view | Admin desktop, plus a new "Platforms" app that filters by `platform_id` |

**Rule:** no change to the claim path, the predictive tick or call control comes
in under this product. The miniplayer is the existing dialer UI in a compact frame.

---

## 3. How a platform integrates (the five steps the site sells)

1. **Create a platform** at dev.dialerseat.com. Test keys exist right away.
2. **Create a seat** for each user from your server:
   `POST /v1/seats { external_user_id, email, name }`.
3. **Mint a session** for that seat (`POST /v1/seats/{id}/sessions`). That gives
   a 15-minute token.
4. **Drop in the miniplayer**:
   ```html
   <script src="https://dev.dialerseat.com/embed/v1.js"></script>
   <div id="dialer"></div>
   <script>DialerSeat.mount('#dialer', { session: TOKEN })</script>
   ```
5. **Subscribe to webhooks** (`call.ended`, `call.dispositioned`, …). Write the
   results into your CRM.

Leads arrive in one of two ways. The platform pushes them
(`POST /v1/campaigns/{id}/leads`), or the miniplayer is handed a list at mount
(`DialerSeat.mount(el, { session, leads: [...] })`). In both cases the leads land
in a DialerSeat campaign tied to the platform's `external_id`.

---

## 3b. Accounts: one login, two independent accounts

- **Same login.** Anyone with a DialerSeat login can sign in at dev.dialerseat.com, and
  new people can sign up there.
- **First arrival** (new or existing): the page says *Welcome to DialerSeat for
  Developers*. Before anything is set up there are two choices:
  - **Activate developer account.** Free, one click.
  - **Not a developer? Go to dialerseat.com.** This goes back signed in. The main site's
    normal rules apply: the demo if not subscribed, the dashboard if subscribed.
- **A developer account is free and complete.** It includes the console, keys, the API,
  webhooks, the miniplayer, dial modes and dispositions, all in test mode. **Nothing dials
  until live dialing is paid for.** Live keys authenticate but return
  `402 live_dialing_inactive` on anything that would place a call.
- **The two accounts are independent.** Developer status lives only in the `dev_*`
  tables and only on the dev host. The main site never reads it, and the dev site
  never reads `subscriptions`. A paying subscriber who is also a developer dials on
  dialerseat.com as usual. A developer can subscribe to a personal dialer and own
  teams there like anyone else.
- In `proxy.ts`, the dev host returns before any of the main site's access gates
  (demo, paused, white-label onboarding), so neither side can affect the other.

---

## 4. Billing models (a toggle in the console)

**A. User-billed.** This is the flow in Joshua's brief: the user pays, the seat goes
live, and billing auto-drafts.
The first time a seat opens the miniplayer, it shows DialerSeat checkout. That is
the standard weekly plan, charged through Stripe. Payment activates the seat, and
it auto-drafts every week after that. The platform pays nothing and can earn a
revenue share. Access follows the existing rules: paid days only, no
double charge on resubscribe.

**B. Platform-billed.** The platform pays one weekly invoice for all its active
seats, plus usage, at a **negotiated** rate. It then charges its own customers
whatever it likes. Seats never see DialerSeat checkout.

**C. Mixed.** The default is set per platform, with per-seat exceptions (for
example, the platform pays for its internal team and users pay for themselves).

Prices are always stated **per week**. The site never shows a monthly
figure for DialerSeat.

### Pricing floor: what the negotiation cannot go below
Measured cost is **$0.0106 per dial** (Nov 2026, from the Telnyx balance). A
platform-billed rate has to cover that plus Stripe fees on every dial. Seat-only
pricing gets lost on heavy diallers. The negotiable structure is therefore:

> seat-week price **+** included dials per seat-week **+** a per-dial overage.

Volume and leverage move all three numbers. Sales sets them at
sales@dialerseat.com. The console shows the platform's agreed rate once it is set,
and a dash before then.

---

## 5. Tiers (what dev.dialerseat.com shows)

| Tier | Who | What | Price on the site |
|---|---|---|---|
| **Sandbox** | Anyone building | Test keys, simulated calls (no carrier), full webhooks, miniplayer in test mode | Free |
| **Launch** | Platforms going live | Live keys, user-billed seats at the standard weekly price, all dial modes, revenue share | Standard weekly seat price |
| **Scale** | Platforms with volume | Platform-billed, negotiated seat-week + per-dial rates, dial-mode policy + exceptions, priority support | Talk to sales |
| **Partner** | Large CRMs / OEM | Custom terms, white-label miniplayer, dedicated number pool, SLA, co-marketing | Talk to sales |

Joshua decides: the revenue-share % on Launch, and whether Sandbox has a
seat or dial cap.

---

## 6. The market

What was checked (13 Nov 2026), with sources at the end:

- **WAVV** is the closest direct competitor. It is a dialer that "embeds into
  HighLevel" and runs in HubSpot. Single Line costs $99 and Multi Line $149 per seat per
  month, and predictive needs Multi Line, plus $1 a month per number. Its developer
  page offers an API, real-time outcome webhooks and a programmable call queue
  (early access). Its dialer **SDK is listed as "Coming Soon"**. In other words, WAVV is
  embedded through partner deals, not through a self-serve developer product.
  That gap is the opening.
- **smrtPhone** is a subscription plus a dialer add-on ($50 single / $90 multi per seat
  per month) plus $0.03/min credits. Its CRM depth is in Podio and the REI CRMs.
- **CloudTalk** has an open API and 35+ CRM integrations, but dialers are paid add-ons
  per seat.
- **JustCall** has a CTI Dialer SDK for embedding (no predictive pacing published).
- **Allo** offers an iframe embed plus REST and webhooks.
- **Telnyx / Twilio** are the "build it yourself" option. The platform builds pacing,
  AMD handling, compliance, recording and number health itself. That is months
  of work, and it is the work we sell as already done.
- **"CloudVoice"**: no embedded-dialer product by that name turned up. The search
  found Cloud Voice & Data (a UK PBX with CRM connectors) and Enfonica Cloud Voice (a
  raw programmable voice API). **Ask the insider for the URL** before it goes on
  any page.

### Where DialerSeat wins
1. **Self-serve.** Keys in a minute, test mode, one script tag. WAVV's SDK is not
   out yet.
2. **Predictive is not an upsell.** Every dial mode is in every live tier, and the
   platform turns modes on and off itself.
3. **Weekly, not monthly.** Platforms can resell week by week, with no annual lock-in.
4. **The CRM keeps its data model.** Its campaigns and dispositions stay its own.
5. **Rates that negotiate down with volume**, with the floor kept honest
   (section 4).

---

## 7. SEO: dev.dialerseat.com as its own product

Separate sitemap, `robots.txt` and `llms.txt` for the subdomain. Pages target
the searches a platform team makes:

- Head terms: *dialer API*, *power dialer API*, *predictive dialer API*,
  *embedded dialer*, *dialer SDK*, *white label dialer API*, *add a dialer to
  your CRM*, *CTI dialer for CRM*, *click-to-call API for CRM*, *outbound calling
  API for SaaS*.
- Comparison pages: *WAVV alternative for developers*, *build vs buy: dialer
  on Telnyx/Twilio*, *JustCall SDK alternative*.
- Use-case pages per CRM vertical: real-estate CRMs, insurance agency
  platforms, solar, home services, lead-gen marketplaces, GoHighLevel agencies.
- Docs pages (quickstart, webhooks, embed, each endpoint). Docs are the
  pages developers link to.
- Changelog, plus IndexNow on publish (as on the main site).

---

## 8. Build phases

**Phase 0 — built on the `developers` branch, 13 Nov 2026 (local only, not pushed)**

Built and checked end to end on `localhost:3200/developers`:
- **Routing** (`proxy.ts` → `routeDeveloperSite`): `dev.dialerseat.com` serves `app/developers`,
  `api.dialerseat.com/v1/*` serves `app/api/v1`, and `dialerseat.com/developers/*` redirects (308)
  to the subdomain. The dev host returns before every main-site gate. `/api/developers` and
  `/api/v1` skip the subscription gates and authenticate themselves; every other `/api` path
  on the dev host still goes through the normal rules.
- **Landing** (dark): hero, five steps, what stays yours and what DialerSeat runs,
  capabilities, one login and two accounts, tiers, the three-ways comparison (by category,
  no named competitors), FAQ. The back-to-dialerseat.com bar sits on top, and the button
  is in the footer.
- **Accounts**: dev sign-in and sign-up on the same Clerk login. Welcome says *Welcome to
  DialerSeat for Developers* and offers **Activate** (free; the test keys are shown once) or
  **Not a developer? Take me to dialerseat.com**.
- **Console** (sidebar plus a "Find… CTRL K" search, after the Clerk and Telnyx screenshots):
  - **Overview**: setup checklist from real state, real counts, recent requests.
  - **API keys**: quick copy, test and live tabs, show-once secrets, revoke.
  - **Webhooks**: endpoints, signing secrets, send a signed test event, delivery log.
  - **Miniplayer**: the snippet carries the platform's publishable key; allowed origins.
  - **Dial modes**: platform policy plus seat and campaign exceptions.
  - **Dispositions** and **Seats**.
  - **Usage**: request log; live dials show a dash until measured.
  - **Billing**: live-dialing request, who pays, negotiated rates (dashes until set), tiers.
  - **Settings**.
- **Search**: stems, synonyms, typo tolerance, endpoint paths and status codes. It runs in
  the browser in milliseconds, and `tests/unit/developersSearch.test.ts` holds 34 obscure
  queries to their right answers.
- **Public API `/v1`**, live against the store:
  - Working: `GET /me`; seats (create or update, list, get, patch, disable); sessions
    (one-use 15-minute token, stored hashed); dispositions; campaigns, with the dial-mode
    policy and exceptions enforced.
  - Lead validation goes through the production lead normaliser, with a per-lead result.
  - DNC validation, `GET /calls` (empty until live), usage.
  - Rate limit, request log, and `402 live_dialing_inactive` for live keys.
- **Webhooks**: HMAC-SHA256 signing. A unit test runs the docs' own `verify()` against the
  signer. Checked against a local receiver: signed deliveries passed, and a wrong secret
  was rejected.
- **Docs**: 11 guides, the API reference and the events table. The site also has
  `robots.txt`, `sitemap.xml` and `llms.txt` of its own.
- **dialerseat.com**: "DEVELOPERS" in the landing nav and "DIALERSEAT FOR DEVELOPERS →" in the
  shared footer, so every page with a footer carries it. `developers` is now a reserved
  tenant subdomain.
- **Storage**: `lib/developers/store.ts` has two backends. Supabase uses the migration; a
  local JSON file is for building and is refused in production. The migration
  (`db/migrations/2026-11-13-developer-platform.sql`, 10 tables, all classified in
  `retention_policy`) was dry-run against production inside `begin … rollback`. It created
  10 tables with 0 unclassified, and the rollback left 0 behind. **Not applied.**

Not built yet, and exactly what the docs promise for launch:
- The miniplayer itself (`/embed/v1.js` plus the frame), which is Phase 3.
- Live lead insertion into `campaigns`/`leads`, and live DNC entries. Both return
  `501 not_available` on live keys today; test keys validate exactly as live will.
- `GET /calls` with real rows. This needs seats tied to `users` on their first live dial.
- Webhook events fired by real calls (the outbox). Only "Send test event" sends today.
- Stripe: miniplayer checkout for user-billed seats and the weekly platform invoice.
- Admin desktop "Platforms" app, and push alerts for developer sign-ups and live-dialing
  requests. Each push type needs a column in the admin push preferences table.

**Working on it locally.** Run the `developers` launch entry (port 3200). The
worktree's `.env.local` sets `DEV_PLATFORM_STORE=local` and `DEV_LOCAL_TEST_USER`, which
signs `next dev` in as one test user, because Clerk has production keys only and those
refuse localhost. `lib/developers/localAuth.ts` makes that impossible in any build: it
needs `NODE_ENV` other than production, no `VERCEL_ENV`, and the local store.

**Phase 1 — data and live API**
- Apply the migration. Tie a seat to a `users` row on its first live session.
  Insert live leads through the same path as `/api/ingest/leads/[token]`, so the
  claim path stays untouched. Read `/v1/calls` from `calls` by the seat's user.

**Phase 2 — webhooks from real calls**
- Fill `dev_webhook_deliveries` from call-end and disposition events. Add a retry
  cron with backoff for 72 h. Signing and the delivery log already exist.

**Phase 3 — miniplayer** *(touches the dialer UI: evening deploys only)*
- `/embed/v1.js` loader, then the `/embed/dialer` frame, then session-token sign-in
  (no Clerk prompt inside the CRM), then postMessage events (`ready`, `call`,
  `disposition`). `frame-ancestors` comes from each platform's allowed origins.

**Phase 4 — billing**
- User-billed: Stripe checkout inside the miniplayer, at the weekly price, plus a
  revenue-share ledger.
- Platform-billed: a Stripe invoice each week for active seat-weeks and metered dials.
- Admin desktop "Platforms" app: seats, dials, revenue, and cost per dial per platform.

**Phase 5 — launch**
- Add `dev.dialerseat.com` and `api.dialerseat.com` to the Vercel project. The DNS
  wildcard already points at Vercel, but the subdomain has no certificate until it is
  added. Then push, submit the sitemap to IndexNow and Bing, and have the sales inbox ready.

---

## 9. Decisions waiting on Joshua

1. Default billing model for a new platform: user-billed or platform-billed.
2. Revenue-share % on the Launch tier.
3. The negotiation floor: seat-week, included dials, and per-dial overage.
4. Sandbox limits (if any).
5. Which company "CloudVoice" is.
6. When to apply the ten `dev_` tables. Applying them before launch is invisible to
   users. The migration classifies them in `retention_policy`, so the daily check
   stays quiet.
7. The Launch tier shows $35 per seat per week, the standard dialerseat.com
   price, billed to the user. Confirm that, or set a different developer price.

---

## 10. Later project: an AI help chat (DialerSeat-only, free to run)

**What it should do:** answer questions about DialerSeat, and only DialerSeat, on both
sites. When it can't answer, or the person asks, it **opens a ticket** that
gets an email reply.

**How to keep it on-topic.** The model gets no general instructions to be
helpful. It is given only retrieved DialerSeat text: the docs in
`lib/developers/docs.ts`, the FAQ pages, pricing and the dialing-mode pages. It is told to
answer only from that text. Anything outside it gets *"I can only help with
DialerSeat — want me to open a ticket?"* The console search built on this branch
is the retrieval step, so the chat and the search can never disagree.

**Free.** Three ways to get there, cheapest first:
1. **No model at all (free forever).** A chat-shaped front end over the search
   index. It answers with the best-matching doc passages and links, plus
   "Open a ticket". This can ship first and costs nothing.
2. **A free-tier hosted model** (for example Cloudflare Workers AI, Google
   Gemini's free tier or Groq's free tier). **Before choosing one, check each
   vendor's current free limits and whether free-tier prompts are used for
   training.** Visitors' questions may contain customer details. None of these has
   been checked yet.
3. **An open-weight model we host.** It is only free if we already pay for the hardware.

**Tickets.** A `support_tickets` table (classified in `retention_policy` in
the same migration) with the conversation attached. Email goes out through
the mail path the site already uses. An admin desktop app answers it.

---

## 11. The long horizon: DialerSeat as infrastructure

Joshua's vision: DialerSeat grows from a dialer into a cloud communications and AI
infrastructure company. That means programmable voice and SIP trunking, messaging and
numbers, real-time voice AI at the edge, and IoT connectivity, all controlled from
dev.dialerseat.com.

**Why it matters to the business:** the biggest cost line is the carrier.
Measured cost is $0.0106 per dial, and most of it is billing terms that DialerSeat
does not control. Owning more of the stack turns that cost into margin.

**What this branch does about it now:** the developer API is designed so that
**DialerSeat is the abstraction, not Telnyx.** Seats, campaigns, calls and
dispositions are our objects, with our ids and our webhooks. No Telnyx id or
behavior leaks into the public API. Later, a call can ride Telnyx, a second
carrier, or our own SIP trunks and interconnects without one line changing for a
platform that built on us. That is the only part of the vision that costs
nothing today, and it is the part that is expensive to fix later.

**Rough order, each step capital-gated:**
1. A second carrier behind the same API (price leverage, failover).
2. Direct SIP trunking and least-cost routing across carriers.
3. Messaging (SMS/MMS) and number provisioning exposed in the console.
4. Our own interconnects, and the regulatory standing that requires.
5. Voice AI (STT/TTS/agents) running next to the media.

None of this goes on the public site until it exists.

**The precedent Joshua pointed to (13 Nov 2026).** Telnyx was founded in 2009 by
David Casem and Ian Reither. It started as a consultancy installing call-center
systems and grew into a licensed carrier and communications/AI platform. Third-party
databases put its outside funding at roughly $4.9M (CB Insights) to $11.1M
(PitchBook), its revenue near $100–112M (Growjo, ZoomInfo, RocketReach), and its
headcount at 300–415. Its founder has said in interviews that it reached a $1B+
valuation, which public filings do not confirm. These are estimates from those
sources, not verified figures. The lesson is the path, not the numbers: start as
an application on someone else's network, then own the infrastructure one layer
at a time, paid for by the business itself. That is the same order as the list
above.

---

### Sources
- WAVV developers: https://wavv.com/developers
- WAVV partner program: https://wavv.com/partner-program
- WAVV pricing via its GHL comparison and Capterra: https://wavv.com/post/is-kixie-or-wavv-better-for-your-gohighlevel-agency , https://www.capterra.com/p/10044366/WAVV-Dialer/
- smrtDialer pricing: https://www.smrtphone.io/smrtdialer-pricing/
- CloudTalk pricing / API: https://www.g2.com/products/cloudtalk/pricing
- JustCall CTI Dialer SDK: https://developer.justcall.io/docs/cti-dialer-sdk
- Allo embed: https://www.withallo.com/blog/set-an-ai-phone-system-inside-your-own-crm
- Cloud Voice & Data CRM integrations: https://cloudvoicedata.co.uk/services/voice/crm-integrations/
- Enfonica Cloud Voice: https://enfonica.com/products/cloud-voice
