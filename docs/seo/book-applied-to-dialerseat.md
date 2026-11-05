# The RankHonestly book, applied to DialerSeat

Every chapter of the book checked against what DialerSeat already has, written as actions. Chapter numbers point into [rankhonestly-book-notes.md](rankhonestly-book-notes.md). The live audit is in [site-audit-2026-11-04.md](site-audit-2026-11-04.md); copy drafts awaiting approval are in [copy-review-2026-11-04.md](copy-review-2026-11-04.md).

Where DialerSeat stands on the book's own clock: most SEO pages shipped 25–26 Sept, so the site is in the window where traffic cannot tell working from failing (ch 2, 14, 32). Search referrals went 4 → 55 a week, which is the right shape and too small to read. **Decision date: late January 2027.** Until then, judge the inputs (pages indexed, links earned, launches done), not the traffic.

---

## Already done (4 Nov 2026)

- Hidden FAQ markup removed from 47 page templates (92 pages); FAQ markup kept only where the questions are visible.
- Every CNAM claim removed from pages, structured data, llms files and all 11 translations; the 10DLC page now answers "does DialerSeat handle CNAM?" truthfully.
- " | DialerSeat" dropped from every tab title in all 12 languages.
- Test tenants removed from the sitemap index.
- `scripts/seo-check.mjs`: the chapter 38 checklist as a script. Run `node scripts/seo-check.mjs` (or with a preview URL) before promoting a deploy; it exits 1 on a hidden FAQ, a bad canonical, a missing H1, noindex, broken JSON-LD or a fake rating.
- Brand `alternateName` ("Dialer Seat", "dialerseat", "dialerseat.com") on the Organization and WebSite structured data (ch 9, 10).
- **17 head-to-head pages people demonstrably search for** (Google autocomplete, 4 Nov), e.g. ReadyMode vs Mojo, PhoneBurner vs Mojo, WAVV vs Kixie, JustCall vs Dialpad, VICIdial vs 3CX. Built from existing verified data, so no new claims and nothing to translate (ch 4, 37).
- Measurement set up in [measurement.md](measurement.md): a dated change log with expected effects, six falsifiable predictions, the weekly per-channel query, the monthly Search Console and AI prompt-set routine. Baseline data saved in `baseline-2026-11-04/` for the re-run (ch 14, 15, 22, 33, 36, App. C, F).

## What the 4 Nov evidence pass found

**Autocomplete confirms demand for these tool ideas** (ch 1, 6), so they can go into the build queue as-is: telemarketing calling hours by state, "what time can telemarketers call", area code lookup, area code → time zone, phone number formatter / E.164 converter, call center staffing calculator, calls-per-hour calculator, best time to cold call (and "…to call insurance / real estate leads"), cold-calling scripts by industry (real estate, insurance, financial advisors), sales voicemail scripts, Do Not Call registry cost, spam likely checker, local presence dialer. **No demand showed** for "dialer cost calculator" (the page exists; leave it) or "how many agents do I need calculator" (use "call center staffing calculator" wording instead).

**Failure searches with real demand** (ch 4 step 4): "how to remove spam likely from my number", "my number is showing up as scam likely", "phone number flagged / marked / labeled as spam", "outbound calls not working". One page that answers "how to remove Spam Likely from my number" with the Free Caller Registry and carrier-portal steps is the clearest gap: business owners type it, and /faq/why-calls-show-spam-likely explains the cause but isn't built for the fix query.

**Integration searches** (ch 6): "power dialer for GoHighLevel / GHL", "dialer for HubSpot", "auto dialer for Zoho CRM", "dialer for Pipedrive", "dialer for Salesforce", "auto dialer for Twilio". DialerSeat's per-campaign lead webhook takes leads from these, so one honest page per CRM ("send GoHighLevel leads into a power dialer") fits, as long as it says webhook rather than native integration.

**Niches the site doesn't serve yet:** "dialer for truck dispatching", "dialer for VA", "power dialer for life insurance", "power dialer for one person", "dialer for BPO". Each fits the vertical-page pattern (`lib/verticals.ts`) if there's real substance to say.

**Competitors to add data for** (ch 4, 27): **Vulcan7** (searched against Mojo and REDX: "mojo dialer vs vulcan 7", "redx vs vulcan7") and **Nooks** ("orum vs nooks"). Both need sourced pricing before they can get a /vs page; never estimate a competitor's price.

**Matchups:** 9 of the 32 pairs already published appear in autocomplete; 23 don't. They stay; judge them on Search Console impressions after 120 days (ch 3: static pages cost nothing; ch 37: then kill or improve).

**dialer.io teardown, first pass** (ch 27): their homepage has a brand-led title and **no structured data at all**; DialerSeat now declares its entity, product and alternate names. Autocomplete finishes "dialer.io" with pricing, reviews and login, while "dialerseat" returns no suggestions yet: the brand isn't searched enough to autocomplete. Brand search is a leading indicator of word of mouth (ch 9).

**Spelling forks are all unregistered** (ch 10, RDAP checked 4 Nov): dialerseat.net, dialerseat.io, dialerseat.co, dialer-seat.com, dialerseats.com. The book's advice is to buy the forks people will actually type (dialer-seat.com and dialerseat.net first, about $11–13 a year each) and redirect them to dialerseat.com.

**An original-data headline** (ch 24): of the 29 dialers in the pricing index, **none bills weekly**. Every one is monthly, annual or quoted. Checkable by anyone on /data/dialer-pricing, and it backs the one sentence in gem 1. Other counts (how many require annual terms, how many hide the price behind sales) need a manual pass over the index before they're quoted anywhere.

**Deliberately not applied, because they wouldn't help today:** HowTo markup (Google retired HowTo rich results in 2023), FAQ markup beyond pages that visibly show their questions (FAQ results are now limited to government and health sites), and speakable (the book itself calls its benefit unproven).

---

## The gems: highest leverage, in order

### 1. Say one checkable sentence, everywhere, forever (ch 5, 13, 24, 26)
The book's single strongest finding: every earned link cited a claim a stranger could verify in one step, never the feature list. DialerSeat already has its structural claim, the thing incumbents' business model forbids:

> **A week of DialerSeat costs $35. A week of ReadyMode costs $199 and Mojo $149, because they bill by the month.**

Contract and demo-led dialers forecast revenue on monthly and annual commitments; weekly billing breaks their model, so they won't copy it. It's checkable at checkout in one step, and /pricing already says it.
- Make it the one sentence in `FACTS.oneLine` (`lib/canonicalFacts.ts`), the homepage, every pitch, every launch post and every community answer, word for word. A model learns a category↔phrase association only from a phrase that never varies (ch 13).
- Test it against the book's three questions: repeatable after one reading (yes), verifiable in one step (yes: the price at checkout), surprising to someone who knows dialers (yes: nobody bills weekly).

### 2. Lead outreach with the data nobody else has (ch 24, 28)
"Go and measure something" is the book's fallback for a product with no story, and DialerSeat has already measured three things:
- **/faq/why-we-dont-rest-flagged-numbers**: rested numbers came back worse than new ones, and cutting volume recovered them in days. A counterintuitive finding with data is exactly the "we measured something nobody has" shape.
- **/data/connect-rates**: live answer rates by state and hour from real calls. No competitor can copy it. Publish the quarterly "best time to cold call, by state" from it (`docs/VISIBILITY.md` §4).
- **/data/dialer-pricing**: 30 dialers' published prices, contract terms and minimums: the book's "test 50 tools" study, already done.

Pitch these, never the product. The rhythm: **3–5 targeted emails a day plus 2–3 genuine community answers a week**, aiming at 20–30 referring domains a quarter. Expect about 2 links per 50 emails; judge on an 8–12 week lag; stop a campaign only if 100 well-targeted emails produce nothing, which means the sentence needs work, not more emails. The book's biggest mistake was starting this in month seven. DialerSeat is in month three.

Targets that fit dialers (ch 28's "nobody pitches these"):
- "Best auto dialer / best dialer for real estate / insurance" listicles that already link to tools (search `"best auto dialer" -dialerseat`, `"mojo alternative"`, `"readymode alternative"`).
- Insurance IMO/FMO and real-estate-investor resource pages, BiggerPockets threads and wikis, collections compliance blogs.
- **Compliance trainers and call-center associations** for the two calculators. `/embed/[tool]` already exists with a credit link; offer the embed, it is the link.
- University professional-selling programs (sales labs, sales-competition sites) keep "tools for students" pages; rarely pitched.

### 3. More doors: small free tools, each checked for demand first (ch 3, 4, 6, 35, 37)
Two tools exist. The book's engine was many small, free, no-account pages, each fully doing one job a stranger searches for, each costing under two days, winners impossible to predict. For every candidate, run the ch 1 test first: does autocomplete finish the phrase? Build only those that pass; ship one or two a week, not ten at once, so the results stay readable.

Candidates (verify each before building):
- **"Can I call this number now?"**: paste numbers, get the lead's local time and whether it's inside the TCPA window for their state. Uses the server-side window logic already in the dialer.
- **Area code lookup / local presence finder**: area code → state, city, time zone, and whether DialerSeat has a local number for it.
- **Phone list cleaner**: paste or upload a CSV, get E.164-formatted, de-duplicated numbers and the rows that won't dial. A cold-calling job every list buyer has.
- **Agents / lines-per-agent calculator**: dials per hour and agents needed from answer rate and talk time; predictive pacing in reverse.
- **Best time to call, by state**: an interactive front end on /data/connect-rates.
- **Cold-calling and voicemail script templates by industry**: real estate, insurance, mortgage, solar, B2B.
- **DNC registry cost calculator**: area codes needed → annual fee, from the Oct 2026 price table already on the scrub page.

Rules from the book: no account and no email gate before it works; nothing uploaded where it can run in the browser, and say so (the checkable claim); mention DialerSeat once, at the bottom, after the tool has done its job (ch 35). Don't delete the losers; they cost nothing to keep (ch 3).

### 4. Win where supply is thin, not where volume is (ch 4, 21)
"Auto dialer", "predictive dialer" and "power dialer" are head terms owned by incumbents with ten-year domains. Keep those pages, budget nothing for them, and never measure success by them. Look for jobs the big sites skipped:
- **Failure searches**: "calls going straight to voicemail", "spam likely on my number", "scam likely fix", "abandon rate too high", "dialer dropping calls", "calls not connecting". /faq/why-calls-show-spam-likely is the model; build more of them.
- **Read the incumbents' sitemaps for what's missing** (ReadyMode, Mojo, PhoneBurner, BatchDialer): the absences are their revenue-bar decisions published on their own sites.
- **State-by-state calling rules**, the book's richest vein ("jobs named by law"): one page per state only where each has its own verified substance (state DNC list, registration or bond, mini-TCPA such as Florida's FTSA, state hours). A page that only swaps the state name is the thin-page pattern the book warns about (ch 37); five real ones beat fifty templated ones.
- Treat the US position as the authority scoreboard: it moves first when links start working (ch 21).

### 5. Launch now, where you can win (ch 25, 26)
A launch is the only channel with no settlement lag, and it works best with no traction. Pick a platform where a small product places (the case won Peerlist's Launchpad at 19 days old), not just the biggest. Product Hunt is fine once, prepared a week ahead. Copy structure, all present in DialerSeat's story:
- Open on a specific moment, not the product: an agent who needs a dialer for a two-week campaign and is quoted a monthly seat, an annual contract and a demo call.
- A specific villain (the annual contract, the "book a demo" button), plus the honest "just dial by hand" option.
- One checkable claim: the weekly price, visible at checkout.
- Four consistent screenshots (they exist on /screenshots), the stack named for technical audiences, and every comment answered on the day.

### 6. Make the name unambiguous (ch 9, 10, 25, 27)
/vs/dialer-io is the top non-brand search landing page, and assistants have shown dialer.io imagery for DialerSeat: the confusable-neighbour situation in ch 10 and ch 27, where the case lost its own brand query to a lower-authority site.
- `sameAs` with every real company profile (`lib/schema.ts`). `alternateName` is done.
- Claim Google Business Profile and Bing Places: entity registrations, not link sources.
- The ten real directories, once, over a weekend: Crunchbase, G2, Capterra/GetApp, SaaSHub, AlternativeTo, Clutch, GoodFirms, Product Hunt profile, TrustRadius, SourceForge. Same name, same one-line tagline, same three categories in every one. No badge walls, no bookmark networks (ch 25).
- Monthly: search "dialerseat", "dialer seat" and "dialerseat login" and note who ranks and who has sitelinks. A quarterly ch 27 teardown of dialer.io, ending in one sentence: "they beat us because ___".

### 7. Fix what happens after the click (ch 18, 19, 20)
The book calls this the cheapest growth available, and DialerSeat has no instrument for it: page_views records dwell time but not failed clicks, and about half of visits on both desktop and mobile end in under 10 seconds.
- A first-party dead-click log that fits the privacy stance already in `app/api/analytics/pageview`: record only the clicked element's tag and a class path when a click changes nothing, with no text, no identity, no recording. Then fix the top five targets.
- Add INP and CLS from real visitors to the same table (the `web-vitals` package, a few lines). Lab numbers flatter (ch 11).
- Define the activation event and measure the share of sign-ups that reach it: first campaign started, or first call placed. The Sept funnel finding (every real non-payer stalled at billing) says the first leak is billing, not search.
- Acknowledge every action within 100 ms: spinner, disabled state, progress bar (ch 19).

### 8. Measure the way the book does (ch 13, 14, 15, 16, 22, 23, 33, App. A–D)
- **Weekly, per channel, looking for zeros**: Google, Bing, social, AI, direct. A blended total hides a dead channel (Bing sat near zero all autumn).
- **28-day windows only** at this volume; never compare days. Set the action threshold before looking (for example, a 20% change held for 14 days).
- **Search Console export monthly** (Queries.csv, Pages.csv, longest range), kept on disk. With it: split brand from non-brand, build DialerSeat's own position→CTR curve, list pages over 5,000 impressions and under 1% CTR, and classify each page as on-page, snippet or authority (ch 23) before planning a quarter.
- **AI prompt set monthly**: ten fixed buyer questions (for example "best dialer for insurance agents", "dialer without a contract", "ReadyMode alternatives"), asked in fresh sessions to ChatGPT, Claude, Gemini, Perplexity and Copilot. Record named or not, and the phrase used. If the phrase isn't the weekly-billing sentence, fix the sentence, not the volume. The referrer count is a floor (zero so far), not a measurement.
- **Dated change log with predictions**: CHANGES.md already exists; add one line per SEO change saying what it should move, by when. Never bundle a resubmit with a big change: the resubmit will take the credit (ch 22).
- **Cliff vs slope**: a channel at zero is technical (console, sitemap, reindex, then infrastructure, cheapest first); a gradual fall is ranking (wait).

---

## Smaller things that still help

- **Titles and descriptions**: 22 titles and 98 descriptions drafted in the copy review, waiting for your yes. Low on page one, a title that names the searcher's fear ("no contract", "weekly", "no setup fee") clicks about 8× more (ch 7).
- **Direct answers**: 84 pages open with fewer than 40 words before the detail. Each should answer its query in 40–80 self-contained words right under the H1, with no "as above". It's the passage snippets and AI answers lift (ch 7 Field 1, ch 12). The country-page version needs no new translation (copy review).
- **One accuracy check left**: /faq/numbers says "A-Level, on every number, by default", while every other page says A-attestation "where supported". Pick one wording; a trust product can't carry two (ch 29).
- **Comparison pages are the right content type** (ch 29 lists "X vs Y" among the ten posts worth writing). Keep them; give each one an honest "when the other tool is the better choice" section (ch 7 Field 8c), which the book found earns trust and links.
- **The 32 generated matchup pages** (/vs/x-vs-y) had 9 visits in ten weeks. Too early to judge. After 120 days, split them by impressions: none means no demand (leave or merge); plenty with no clicks means rewrite the title (ch 37).
- **Translated results**: check Search Console → Search appearance for a "Translated results" row (ch 21). Twelve languages are live; add no more until one market shows authority. Keep sentences short and literal, since that's what translates.
- **Marketing pages render per request** (no-store, behind Clerk). Serving them statically or with ISR would cut server work and protect speed under load (ch 11). Minor at this traffic.
- **llms.txt**: keep it as is; no more investment (ch 12).
- **Re-run the audit when the data doubles**, with the same script (ch 36). `scripts/seo-check.mjs` is that script for the page checks.

---

## What the book says not to do

- No bookmark-network or badge-exchange link building, no paid links, no invented ratings or testimonials (ch 25, 29).
- Don't rewrite pages to escape positions 6–10: past page one's bottom the constraint is authority, and two rounds of on-page work moved nothing in the case (ch 23).
- Don't chase Domain Rating; it can be manufactured and doesn't predict rankings (ch 25, 27).
- Don't start a blog that competes with the FAQ and tool pages for the same queries (ch 6, 29).
- Don't judge on traffic before late January, and don't check the dashboard daily (ch 14, 15).
- Don't build pages for queries nobody types, or that the page only half answers (ch 1, 31, 37).

---

## Needs you

| | Why it's yours |
|---|---|
| Add `www.dialerseat.com` in Vercel → dialer-seat → Settings → Domains → **Add Domain**, then choose "Redirect to dialerseat.com" (308). Don't edit the existing dialerseat.com row: that's where "a domain cannot redirect to itself" comes from. | Needs your Vercel login; the change was blocked for me. |
| Approve or edit the copy review (titles, descriptions, country openers). | Your copy. |
| Create the company profiles and directory listings; send me the URLs for `sameAs`. | Your accounts. |
| Bing Webmaster Tools is set up (confirmed by Joshua, 4 Nov). Bing still sends about 6% as many visits as Google: check Site Explorer for how many URLs Bing has indexed, and claim Bing Places. Export Search Console monthly. | Your Google and Microsoft logins. |
| Pick the launch platform and date. | Your call, and your account. |
| Say yes to the dead-click log and real-user vitals. | It adds first-party measurement to a site with a stated no-tracking stance. |

---

## Every chapter, and where DialerSeat stands

**Done** = shipped or in place. **Yours** = needs your account, money or approval. **Queued** = evidence gathered, ready to build. **Waiting** = needs time or Search Console data first. **N/A** = doesn't apply to this business.

| Ch | Lesson | Status |
|---|---|---|
| 1 | Intercept existing demand; verify phrases in autocomplete | Done: 4 Nov autocomplete pass, saved in `baseline-2026-11-04/` |
| 2 | First 90 days: instrument first, watch impressions, don't judge early | Done (Search Console verified, page views tracked); decision date late Jan 2027 |
| 3 | You can't pick the winner; make attempts cheap; keep the losers | Done: losers kept; matchups added cheaply from existing data |
| 4 | Lose the head term; win where supply is thin | Queued: failure searches, integrations, niches, Vulcan7/Nooks |
| 5 | The moat is what their business model forbids | Done: weekly billing identified; needs repeating everywhere (gem 1) |
| 6 | Sixty doors: one job, one page, no account | Queued: autocomplete-confirmed tool list |
| 7 | The page spec, built backwards | Partly: suffix and canonicals done; titles, descriptions and direct answers drafted (Yours to approve) |
| 8 | Schema changes screen space, not rank | Done: standalone breadcrumbs, free WebApplication, no fake ratings, no hidden FAQ |
| 9 | The name is a distribution channel | Partly: alternateName done; sameAs profiles, GBP, Bing Places (Yours) |
| 10 | Choose a name you can own; buy the forks | Yours: forks unregistered (dialer-seat.com, dialerseat.net…) |
| 11 | Acquisition surface should be finished HTML | Done: every page serves full HTML; the per-request rendering cost is minor |
| 12 | Answer engines lift self-contained direct answers | Queued: 84 pages need 40–80-word openers (copy, Yours) |
| 13 | Be in the training data: one sentence, measured | Done: prompt set written; the posting itself is Yours |
| 14 | The dashboard is three months old | Done: change log and decision date in measurement.md |
| 15 | What noise looks like: 28-day windows, thresholds | Done: weekly routine |
| 16 | Falling CTR is growth; segment brand first | Waiting: Search Console export |
| 17 | Impressions aren't traffic; find high-impression, low-click pages | Waiting: Search Console export |
| 18 | The half you can't see: activation, bots | Yours: define the activation event; bot filter already exists |
| 19 | Dead clicks are the cheapest growth | Yours: first-party dead-click log needs your yes |
| 20 | Averages describe nobody: segment by device | Done for page views; Search Console split Waiting |
| 21 | Rank is set by competition per country; translated results | Done: no new languages; translated-results check Waiting |
| 22 | Channels die silently; register Bing; cheapest fix first | Yours: confirm Bing Webmaster Tools; weekly zero check Done |
| 23 | Position 8 is an authority problem | Waiting: classify pages from Search Console; links (gem 2) |
| 24 | Be linkable: one interesting, checkable sentence; original data | Done: sentence and three data assets identified, plus the "none bill weekly" headline |
| 25 | Directories buy a number; editorial links buy positions | Yours: the real-directory weekend; no badge walls |
| 26 | Launch with nothing, on a platform you can win | Yours: platform and date |
| 27 | Teardown of the competitor that beats you | Partly: dialer.io first pass done; full quarterly teardown Waiting |
| 28 | Outreach: 3–5 emails a day, measured on a lag | Yours: targets listed in gem 2 |
| 29 | Credibility compounds; no fake numbers | Done: CNAM removed; one wording conflict left on /faq/numbers (Yours) |
| 30 | Decide how you charge before you grow | N/A: already paid, weekly |
| 31 | The long tail ranks better and pays less | Waiting: sort the tail by clicks once exported |
| 32 | No data on day one: four binary questions | Done: crawlable, indexed (Google), demand checked |
| 33 | Measuring answer engines: a floor, not a number | Done: referrer segment query and prompt set |
| 34 | What it costs to charge money | N/A: billing already live on Vercel Pro and Stripe |
| 35 | The tools are the marketing | Queued: tool list; embeds already exist |
| 36 | Re-run the analysis when data doubles | Done: baseline saved, same-script rule written |
| 37 | Programmatic pages: verify demand, prove the template | Done: 17 verified pairs added; 23 unverified waiting 120 days |
| 38 | The page, assembled | Done: `scripts/seo-check.mjs` |
| A | Check the denominator of every percentage | Done: noted in measurement.md routine |
| B | Five-day diagnostic | Done: demand, supply, decomposition, differentiator, instruments |
| C | Change log with predictions | Done: measurement.md |
| D | Your own position→CTR curve | Waiting: Search Console export |
| E | Glossary | N/A |
| F | Dated predictions | Done: six in measurement.md |
