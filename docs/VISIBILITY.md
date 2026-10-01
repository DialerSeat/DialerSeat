# Visibility playbook: search, AI assistants, backlinks

What was built on 2026-09-25/26, what to do the day it deploys, and the
off-site work that turns it into rankings, citations and links. Everything on
the site is only as visible as the links into it and the places that confirm
DialerSeat exists; this is the list of those places.

---

## 1. What shipped

**Crawlability (the biggest fix).** `proxy.ts` sent every `.txt` and `.xml`
route through Clerk's `auth.protect()`, so in production `robots.txt`,
`llms.txt`, `llms-full.txt`, `sitemap-index.xml`, the IndexNow key, `/md/*`,
`/data/connect-rates` and `/status` all returned 404 to Googlebot. Verified with
curl on 2026-09-25. They are public now.

**New pages (all in the sitemap, rails, footer and llms files):**

| Page | Target searches | Why it earns links |
|---|---|---|
| `/pricing` | dialer pricing, predictive dialer pricing (+90%), auto dialer cost | The "a week costs a week" comparison, vendor by vendor |
| `/data/dialer-pricing` | "<vendor> pricing" for 27 vendors | The only side-by-side of the whole market; Dataset schema |
| `/data/calling-rules-by-country` + 15 country pages | "<country> telemarketing rules", "cold calling laws <country>" | Multi-country, dated, sourced; France opt-in (Aug 11, 2026) and Spain's 400 prefix (Oct 17, 2026) are barely covered elsewhere |
| `/tools/dialer-cost-calculator` | dialer cost calculator, auto dialer cost | Embeddable (`/embed/...`) with a credit link |
| `/tools/abandon-rate-calculator` | abandon rate calculator, 3% rule | Embeddable; compliance trainers link to calculators |
| `/faq/what-is-an-auto-dialer` | auto dialer (~3,600 US / 8,100 worldwide a month) | The head term had no page |
| `/faq/dialer-for-{real-estate, call-centers, mortgage, solar, debt-collection, b2b-sales, recruiters, fundraising}` | "dialer for <trade>" | Each carries that trade's own rules with sources (HPPA trigger leads, Reg F 7-in-7, 2024 TSR B2B change, one-to-one consent vacatur, charity DNC exemption) |
| `/resources` | outbound calling resources | The page outreach emails link to |
| `/about` | brand + trust | Who publishes, research method, corrections policy |

**On-page.** Comparison titles lead with "<vendor> Alternative: Pricing, Pros &
Cons"; the homepage title leads with "Predictive & Auto Dialer: $35 a Week";
every comparison page links to `/pricing` and the index; structured data is one
consistent entity (duplicate Organization/SoftwareApplication nodes merged);
`knowsAbout` added; the false "public API" claim corrected on the pages touched;
the insurance page's "carrier usage is charged separately" corrected (calling is
included); the sitemap lists real last-modified dates (`scripts/gen-page-dates.mjs`)
and no longer lists the four non-canonical `/faq/what-is-a-*` URLs.

---

## 2. Deploy day (in this order)

1. Deploy, then confirm the crawler files answer 200 for Googlebot:
   ```bash
   for p in robots.txt llms.txt llms-full.txt sitemap.xml sitemap-index.xml pricing data/dialer-pricing data/calling-rules-by-country/fr md/pricing; do curl -s -o /dev/null -w "%{http_code} /$p\n" -A "Googlebot" https://dialerseat.com/$p; done
   ```
2. **Google Search Console** (Domain property): submit `sitemap.xml` and
   `sitemap-index.xml`; URL Inspection → Request indexing for `/pricing`,
   `/data/dialer-pricing`, `/data/calling-rules-by-country`, `/faq/what-is-an-auto-dialer`,
   `/tools/dialer-cost-calculator`, `/vs/mojo`, `/vs/readymode`.
3. **Bing Webmaster Tools**: import from Search Console, submit both sitemaps.
4. **IndexNow**: `INDEXNOW_KEY=<prod key> node scripts/indexnow-submit.mjs`
   (checks the key file first; then submits every sitemap URL).
5. Run `/pricing`, `/data/dialer-pricing` and one `/faq/dialer-for-*` page through
   Google's Rich Results Test and validator.schema.org.
6. Before every later commit that touches marketing pages:
   `node scripts/gen-page-dates.mjs` so `<lastmod>` stays true. After the deploy:
   `node scripts/indexnow-submit.mjs --since <date>`.

---

## 3. Entity: make DialerSeat a thing, not a website

Search engines and assistants name a company confidently when several
independent places describe it the same way. Use `FACTS.oneLine` from
`lib/canonicalFacts.ts` word for word as the description everywhere.

Create or claim, then add each URL to `sameAs` in `lib/schema.ts`
(`organizationSchema`). Today `sameAs` holds only
`linkedin.com/in/dialerseat`, which is a personal-profile URL pattern.

| Profile | Why |
|---|---|
| LinkedIn **company** page (`linkedin.com/company/...`) | Primary entity signal; replace the `/in/` URL in sameAs |
| Crunchbase | Read by knowledge graphs and many AI tools |
| G2 (free profile) | Reviews + category grid; AI assistants cite it heavily |
| Capterra / Software Advice / GetApp (one vendor account since G2's Feb 2026 acquisition) | Free listing; categories Auto Dialer, Predictive Dialer, Power Dialer |
| TrustRadius, SaaSHub, AlternativeTo, SourceForge, Slashdot, SaaSworthy, SoftwareSuggest, Crozdesk | Free listings, "alternative to Mojo/ReadyMode" pages, followed links on several |
| Product Hunt | One launch day; durable link and profile |
| YouTube channel | ~23% of Google AI Overview citations are YouTube |
| X / Facebook page | Consistency of the entity; low effort |

Wikidata only once there is independent coverage (press, reviews) to cite;
an unsupported item gets deleted.

---

## 4. Backlinks, niche by niche

Lead every pitch with an asset, not the product. The asset is the reason to
link; the product is what they find when they arrive.

| Niche | Where the links are | Angle / asset to pitch |
|---|---|---|
| **Insurance** | IMO/FMO resource pages, agent-training blogs and YouTube, r/InsuranceAgent, agent Facebook groups | Abandon-rate calculator; calling hours by state; "Medicare calling: what a dialer does and doesn't cover" |
| **Real estate** | BiggerPockets (forum answers, blog pitches), wholesaling coaches, REI blogs with "best dialer" lists (REsimpli, RealEstateSkills, RealEstateBees, Prospeo, CallingAgency) | Scrubbing expireds/FSBO against DNC; cost calculator (weekly VA seats); `/vs/mojo` |
| **Mortgage** | National Mortgage Professional, Mortgage Professional America, loan-officer training blogs | HPPA trigger-lead explainer on `/faq/dialer-for-mortgage` (timely since March 5, 2026) |
| **Solar** | Setter/sales-training channels, solar sales communities | Consent after the one-to-one rule was vacated; seasonal seat cost |
| **Collections** | insideARM, ACA International member resources, collections compliance blogs | Reg F 7-in-7 explainer + abandon-rate calculator |
| **Call centers / BPO** | Outsource Accelerator (directory + news), Call Centre Helper (accepts contributed articles), CX Today, BPO association sites (IBPAP, BPrO, CEX) | Calling rules by country (France opt-in, Spain 400 prefix, Brazil 0303, Chile prefixes, India 140/1600) |
| **B2B / SDR** | RevGenius, Pavilion, cold-calling newsletters and podcasts | The 2024 TSR B2B change; the pricing index vs Orum/Nooks |
| **Offshore / VA** | Philippine and LatAm VA agencies' resource pages, Outsource Accelerator | Same seat price anywhere; per-lead calling windows; now in Spanish, Portuguese and French |
| **Recruiting / fundraising** | Staffing blogs, nonprofit-tech and fundraising association resource pages | Which DNC rules apply to candidates and donors |

**"Best dialer" list inclusion.** Articles that rank now and that assistants
read: Forbes Advisor, TechnologyAdvice, CROClub, Guideflow, Trellus, Spyne,
QuickSprout, Crazy Egg, Guru99, SoftwareSuggest, plus the real-estate lists
above. Lists written by competitors (CloudTalk, JustCall, Nooks, Allo) will not
include you. Pitch template:

> Subject: Weekly-billed dialer for your "best auto dialers" list
>
> Hi <name>, your <article title> is one of the most-read lists on dialers. One
> gap: every tool on it bills monthly or annually. DialerSeat is $35 per seat per
> week with predictive included and no contract, so a one-week project costs $35.
> We also maintain a pricing index of 27 dialers you are welcome to cite:
> https://dialerseat.com/data/dialer-pricing. Happy to give you an account to test.

**Digital PR.** Answer journalist requests on Qwoted, Featured.com, Help a B2B
Writer and SourceBottle. Newsworthy angles you own right now: France's opt-in
regime (Aug 11, 2026), Spain's 400 prefix (Oct 17, 2026), the HPPA trigger-lead
ban, and connect-rate data.

**Quarterly data report.** `/data/connect-rates` is the one asset no competitor
can copy. Each quarter, publish "Best time to cold call, by state and hour"
from it ("best time to cold call" is asked far more widely than any dialer
term; check the volume in Keyword Planner), send it to the niche lists above, and post the headline chart on
LinkedIn.

---

## 5. Communities and video

- **Reddit and BiggerPockets**: answer questions about dialers, DNC and calling
  hours with the relevant page when it genuinely answers them; always say you
  run DialerSeat. Reddit is ~47% of Perplexity's top-cited sources.
- **YouTube**, one video per high-intent search: "Mojo Dialer vs DialerSeat",
  "ReadyMode alternative", "Set up a predictive dialer in 5 minutes", "Is a
  predictive dialer legal? The 3% rule", "How to scrub a list against the Do
  Not Call Registry", "France cold calling rules 2026". Put the matching page in
  the first line of each description.

---

## 6. AI assistant visibility

The llms files, markdown mirrors and data pages are now reachable. What moves
assistants from there is corroboration: reviews, lists, Reddit, Bing.

Track monthly: ask ChatGPT, Perplexity, Gemini, Copilot and Claude the prompts
below; log whether DialerSeat is named and which URL is cited.

- best auto dialer for small business / for insurance agents / for real estate / for solar / for debt collection / for recruiters
- cheapest predictive dialer with no contract
- Mojo Dialer alternative / ReadyMode alternative / VICIdial alternative / Orum alternative
- how much does a predictive dialer cost
- is a predictive dialer legal / what is the 3% abandon rule
- telemarketing rules in France / Spain / Australia / Canada / UK
- best dialer for offshore agents calling US leads
- weekly billed dialer

Referrals from `chatgpt.com`, `perplexity.ai`, `gemini.google.com` and
`copilot.microsoft.com` show up in the page-view beacon's referrer column.

---

## 7. Keeping it true

- `lib/competitors.ts`: when a vendor changes price, change it here; every
  comparison, the pricing index, the llms files and the mirrors follow.
- `lib/weeklyBilling.ts`: the figures behind `/pricing` and the calculator; each
  has a `basis` saying where it is published.
- `lib/countryRules.ts`: re-verify quarterly and move `RULES_CHECKED`.
- `lib/verticals.ts`: re-verify each trade's `sources` quarterly.
- `node scripts/gen-page-dates.mjs` before committing marketing changes.

---

## 8. Decisions left for you

- **Public API claim.** Still in the `/vs/everyone` comparison table (a table,
  deliberately left untouched) and the orphaned `hookedcrm` view. Build the API
  or remove the row.
- **ReadyMode's price.** The homepage and structured data say "$199+/month";
  `lib/competitors.ts` says "quoted, with a $500-$2,000 setup fee". Both can be
  true; pick one phrasing for all surfaces.
- **Data licence.** The data pages say "free to cite with a link". Adding a
  formal licence (e.g. CC BY 4.0) to the Dataset schema makes Google Dataset
  Search and researchers more likely to use them.
- **Translations.** The new pages render English under `/es/`, `/pt-BR/`,
  `/fr/` until their strings are added to the i18n catalog.
