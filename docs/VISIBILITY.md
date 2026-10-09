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
Cons"; the homepage tab title stays "DialerSeat, Dial Smarter. Close Faster.";
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
4. **IndexNow**: `node scripts/indexnow-submit.mjs` (the key file is committed
   in `public/`, so no env variable is needed; the script checks the key file
   first, then submits every sitemap URL).
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
(`organizationSchema`). `sameAs` is empty for now: the old
`linkedin.com/in/dialerseat` was a personal-profile URL, and the site carries
the company name only.

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
- **WebMCP origin trial.** The two calculators register WebMCP tools
  (section 9), but Chrome only exposes `document.modelContext` to ordinary
  visitors on sites with an origin-trial token. Registering is free at
  developer.chrome.com/origintrials (WebMCP) with a Google account; the token
  then goes in a `<meta http-equiv="origin-trial">` tag. Without it the tools
  are dormant and cost nothing.
- **"AMD always on" in the comparison tables.** Nine rows in the /vs tables
  (lib/competitorFeatures.ts, /vs/everyone, /vs/hookedcrm) say DialerSeat's
  answering-machine detection is always on. It is a per-campaign setting, on
  by default for progressive and predictive (app/api/campaigns/create). The
  tables were left untouched on your instruction; "AMD voicemail filter
  included" would be accurate.
- **Clerk on public pages.** About 208 KB of the ~430 KB of JavaScript on a
  marketing page is Clerk's sign-in UI, loaded for anonymous visitors.
  Loading it only where someone signs in is the largest speed win left, and
  an auth change worth doing carefully.
- **Cold starts.** Every page renders on request; the first visit after idle
  waited 4 to 7 seconds in two crawls (warm: 0.25 s). Pre-rendering the
  marketing pages per language would remove it, at the cost of reworking how
  the language cookie serves unprefixed addresses.
- **Futura from fonts.cdnfonts.com.** A third-party host, and Futura is a
  commercial typeface; check the licence or self-host a licensed copy.
- **Description and title lengths.** Measured on 2026-10-05: 95 of the 143
  English pages in the sitemap have meta descriptions over 160 characters (the
  longest, `/faq/white-label-mobile`, is 282), and 56 titles run past 65
  characters, where Google starts cutting them. Descriptions are not a ranking
  factor and Google rewrites most of them anyway, but Bing's SEO report flags
  them and the cut-off tail never shows. Shortening them changes the English
  text every language translates from, so it is a rewrite-and-retranslate job.
  Titles carry more weight: change them a few at a time and watch Search
  Console, rather than all at once.

---

## 9. Tags, previews, languages and AI agents (2026-10-05)

What the primary sources say, and what changed on the site because of it.

| Finding | Source | What changed |
|---|---|---|
| Shared links showed no image: `og:image` was missing or 404 on every page, and `robots.txt` blocked the image routes | Checked live with curl as `facebookexternalhit`, `Twitterbot`, `LinkedInBot` | `/og` draws a signed 1200×630 card per page title (`lib/shareImage.ts`, `app/og/route.tsx`); `withShareImage()` puts it on every page in every language; robots no longer blocks image routes; Meta's crawler named in robots |
| Google ignores the meta keywords tag; Bing treats a long one as a spam signal | Google Search Central ("Google does not use the keywords meta tag in web ranking", 2009); Bing Webmaster guidance on keyword stuffing | Every `keywords` tag removed |
| Google rewrites most titles that are long or padded with boilerplate, and most meta descriptions | Zyppy title-rewrite study (80,959 titles); Ahrefs: 62.78% of descriptions rewritten | Titles lead with the query and end in one `\| DialerSeat`; homepage keeps "DialerSeat, Dial Smarter. Close Faster." |
| Ranking leans on anchors, body text and user clicks ("ABC" signals, Navboost) | US v. Google trial record: HJ Kim exhibit, Pandu Nayak testimony; the May 2024 Content Warehouse API leak | No change needed: internal links already use descriptive anchors (rails, footer, `/resources`). Clicks come from people choosing the result, which is what the titles above are for |
| hreflang must point at pages that exist, return 200 and are self-canonical | Google Search Central, "Tell Google about localized versions of your page" | hreflang only on paths `/es/…` actually serves (`isLocalizablePath`, kept in step with `MARKETING_ONLY_PATHS` in `proxy.ts`) |
| The language URLs in the sitemap served English | Checked live | 17 pages and their data (industry pages, 15 country pages, pricing table, calculators) translated into Spanish, Portuguese, French, Arabic, Italian and German: 7,498 strings each. Titles, descriptions, preview images, FAQ and breadcrumb structured data follow the page's language |
| Language pages had no internal links: every link on `/es/…` pointed at the English address. Visitors were fine (the language cookie serves their language at either URL), but crawlers carry no cookie | Checked live as Googlebot; Google Search Central's multilingual-sites guide (link the language versions to each other; hreflang is a signal, not a link) | `components/LocaleLink.tsx` keeps links in the page's language: 9,978 of 9,978 links on the language versions of the 32 checked pages now stay in that language. English links unchanged |
| Structured data helps LLM-based search understand a page; IndexNow gets changes seen fast | Microsoft Bing (Fabrice Canel) on schema and LLMs; IndexNow docs | FAQ and breadcrumb JSON-LD translated per language; changed URLs submitted through IndexNow after each deploy |
| Anthropic runs three crawlers with separate purposes | Anthropic crawler docs: `ClaudeBot`, `Claude-SearchBot`, `Claude-User` | All three allowed in `robots.txt` |
| Agents in the browser can call a page's functions instead of scraping it | WebMCP, W3C Draft Community Group Report (2 Oct 2026); Chrome's WebMCP imperative API docs (`document.modelContext.registerTool`, origin trial) | `/tools/abandon-rate-calculator` registers `check_abandoned_call_rate` and `/tools/dialer-cost-calculator` registers `compare_dialer_cost` (`lib/webmcpTools.ts`), computed by the same function the page shows |
| Full crawl, 1,030 URLs as Googlebot (2026-10-08): no broken links, redirects, orphans, duplicate titles or missing descriptions; sitemap index lastmod was always "now"; sitemap alternates lacked x-default; cross-links pointed at four non-canonical pages; glossary and /vs/manual-dialing had 3 and 1 inbound links | Own crawler | All fixed; the glossary and manual-dialing comparison now sit in rails shown on ~140 and ~68 pages |
| llms.txt named none of the 29 competitor comparisons | Own check | Generated from lib/competitors.ts and lib/countryRules.ts: every /vs page with price and "best for", every mode page, all 15 country pages |
| The site said multi-line predictive needs 8+ agents; the code gives every agent 2 or 3 lines | lib/predictive/pacing, docs/PREDICTIVE.md | Corrected on every page, all languages; hidden FAQ markup on /dialing-modes (not visible, partly wrong) removed |
| "Parallel dialer" searches had no page | Google autocomplete, 1,134 suggestions mined | /faq/what-is-a-parallel-dialer, with a computed table of abandoned-call shares by lines and pickup rate |
| Assistants cite comparison and "best of" lists heavily | Ahrefs: 43.8% of ChatGPT citations go to best-of lists | Section 4's list outreach stays the top off-site task |
