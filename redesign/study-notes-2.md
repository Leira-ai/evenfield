# Study notes, round 2: usability first (filters, mobile craft, comprehension)

Compiled 17 Nov 2026, after Leira rejected Evenfield 2.0's UI a second time:
still ugly, and worse, users are confused about how to use it. Her priority
order for this round: (1) user ease and security first, (2) build things that
make the user's life easier, filters and everything beyond filters, (3) the
mobile display specifically (mobile, iOS, PC each), (4) the full base order
re-verified, (5) improvise beyond the list, (6) permanent skill.

Method per Leira's standing rule: newest web sources first, but newest is not
automatically best. Every major choice has a decision note (D11-D16,
continuing round 1's D1-D10) with options, pick, reason, and the condition
under which the alternative wins. Round-1 notes stay in study-notes.md; this
file only adds, and corrects where dated evidence says so. The permanent
skill gains Gates 13-16 and dated amendments to Gates 2, 3 and 8.

---

## 1. Usability engineering: confusion is measurable, not a vibe

- The ten heuristics (Nielsen, 1994, still the current NN/g reference set)
  applied as an audit instrument, not a poster: visibility of system
  status, match with the real world, user control and freedom, consistency,
  error prevention, recognition rather than recall, flexibility, aesthetic
  and minimalist design, error recovery, help at the moment of need. Round
  2's audit of Evenfield (ux-spec-v2.md) names the heuristic each confusion
  point violates. (NN/g 10 heuristics, current page; NN/g filter category
  guidance, nngroup.com/articles/filter-categories-values.)
- Progressive disclosure (Nielsen, 1995; NN/g revisions through 2024):
  defer advanced and rarely used features to a secondary layer; it improves
  learnability, efficiency and error rate together, and NN/g-cited studies
  put task-time improvement at 20-40% with better comprehension. Failure
  mode to avoid: burying frequently needed information several layers deep
  (click fatigue). Verification standard worth adopting: at least 90% of
  first-time users complete the primary task without opening any secondary
  layer; experts reach deep controls in at most 3 interactions. (arc42
  quality model, progressive disclosure entry, published 2026-11-14;
  digia.tech progressive disclosure in mobile UX, 2026, citing NN/g and
  Chameleon interaction data: contextual, behaviour-triggered hints
  complete at ~75% vs ~53% for linear upfront tours.)
- Time to first value (TTFV): the first session decides retention.
  Benchmarks collected 2026: products whose aha moment lands under ~5
  minutes show ~40% higher 30-day retention than those needing 15+
  (Reforge 2025, via 2026 SaaS benchmark roundups); for a read-only
  discovery product the honest translation is stricter: first value means
  seeing the first interesting, judged item, target under 30 seconds from
  open, with zero setup before it. A wallet connect, a tour, or a hero
  that pushes the first item below the fold all spend that budget.
  (nostr-ux onboarding research sources, 2026; sanjaydey SaaS UX
  benchmarks, 2026.)
- Cognitive load discipline that follows: one primary action per screen
  region; defaults chosen so the common case needs no decisions; every
  decision the UI forces before first value is a defect to justify.
- Interaction cost is the metric: taps + scrolls + decisions + waiting,
  counted per core job. The audit in ux-spec-v2.md counts them for
  Evenfield's four core jobs; Gate 13 turns the counting into a release
  requirement with budgets.

## 2. Filters and discovery: the researched pattern set

This is the single largest gap in Evenfield 2.0 (it has no filters at all)
and the area with the deepest published evidence, mostly from Baymard
Institute's large-scale testing (330+ sites) and NN/g.

- Facet counts are the highest-impact filter improvement: show the result
  count next to every filter value, computed against the OTHER applied
  filters (within a facet values combine OR, across facets AND), and
  disable or hide values that would return zero. Counts set expectations
  before the tap and prevent dead ends. (Baymard PLP UX guide, updated
  Aug 2026; Baymard filter UI guide, 2026; ux.detroit3d search and
  filtering encyclopedia, updated Jul 2026.)
- Applied filters must be visible as removable chips above the results,
  with a Clear all; 28% of sites fail to show them at all and users then
  cannot diagnose why results look wrong. Filter state must survive
  product-to-list back navigation. (Baymard, 2026.)
- Labels decide whether filters get used: 25% of desktop and 40% of
  mobile sites use filter labels users don't understand, and users simply
  skip filters they can't parse. Categories must be appropriate,
  predictable, jargon-free and prioritised; a filter must exist for every
  key attribute shown on the list item. (NN/g filter categories and
  values; Baymard via tweakwise filtering guide, Nov 2026.)
- Application model differs by device (Decision D12): instant apply is
  the desktop expectation; in a mobile overlay/sheet, batch selection
  with a live-updating "Show N results" button wins, because it avoids
  layout churn behind the sheet and lets users compose several facets
  before committing. The count on the button is mandatory in both.
  (Baymard; uiuxatlas filtering and sorting pattern guide, 2026; UXPin
  filter UI guide, 2026, on Airbnb's panel.)
- Mobile containers: a sticky "Filters" trigger showing the active-filter
  count, opening a bottom sheet or full-screen panel; a horizontal chip
  row for the few highest-signal facets, each chip opening a focused
  sheet for that facet, plus a "More" chip for the full set. Never
  collapse a desktop sidebar into a cramped accordion. (NN/g bottom sheet
  guidelines, 2025; uiuxatlas, 2026; humanstandards search and discovery
  patterns, Nov 2026.)
- Presets beat raw facets for first-time users: one-tap bundles named by
  intent ("Safe only", "Graduating soon") are the consumer form of the
  same machinery. Airbnb's discovery redesign is the canonical case:
  filters framed around what users want (categories of experience) rather
  than database fields, with a reported ~15% booking lift for
  non-traditional types in year one; its filter panel shows counts per
  option and a result-count apply button. Tokopedia/Shopee follow the
  same grammar on mobile: sticky filter bar, chips for the common facets,
  full sheet behind "Filter", counts everywhere. (appcues UX examples,
  2026; UXPin, 2026.)
- Search is part of the same system: suggestions users pick in ~23% of
  searches when offered (NN/g e-commerce study), grouped by type, with
  recents; the query stays in the box on the results view (a third of
  desktop and 40% of mobile sites clear it, killing iteration); zero-
  result pages need a designed recovery (loosen a filter, show nearest
  matches), never a blank. (orbix search UX guide, Nov 2026; Baymard
  search benchmarks via ux.detroit3d.)
- What the crypto screeners actually do (checked Nov 2026): Axiom Pulse
  splits the feed into New Pairs / Final Stretch / Migrated (the same
  three lifecycle lanes Evenfield has) and filters by age, top-10 holder
  %, dev holding %, snipers %, insiders %, bundle %, holders, liquidity,
  volume, market cap, tx counts, with buy on the same screen. GMGN's
  Trenches feed labels bundle %, dev/sniper/insider wallets, and its
  token page carries a security panel plus creator rug history.
  DexScreener's new-pairs lists filter by liquidity, age and market cap.
  Lessons: (a) the lanes are table stakes, the FILTERS on risk attributes
  are the product; (b) every screener puts the risk signal on the row
  itself, not one page deeper; (c) their density serves experts, and
  their own reviewers note GMGN's density "slows down someone who buys a
  few coins a week", which is exactly Evenfield's audience, so we take
  the filter machinery and the on-row signals, not the density.
  (solbotrank screener ranking, Oct 2026; jumpbit Axiom vs GMGN, checked
  23 Oct 2026; defined.fi terminal comparison, 7 Nov 2026, from official
  docs.)

## 3. Beyond filters: everything else that eases the user

- A verdict is not understood until it answers "what does this mean for
  me". Pattern adopted: every judgement renders in three parts, label,
  key fact, consequence line in second person ("If you buy, you are
  trusting a creator who sold most of their own coins in the first hour.
  Most careful buyers skip coins like this."). Labels must read correctly
  at face value: a caution state may not be named with words that sound
  like praise (Evenfield's "Worth a careful look" fails this; see audit).
- Safe defaults are a feature: hide what the product itself judges noise
  (protocol test launches, stopped coins, dust amounts) by default, say
  how many are hidden, and offer the toggle in place. The blueprint
  already excludes test launches from verdicts; showing them as the
  majority of the default board contradicts the product's own promise.
- Relative time, never raw chain units, in user-facing copy: "launched 3
  hours ago", "last trade 2 days ago"; block heights belong in the
  evidence drawer, where they function as receipts. (Recognition over
  recall; match with the real world.)
- One-thumb primary actions: the money action on a coin page (quote) is a
  sticky bottom bar on mobile with amount presets, not a card four
  screens down. Confirm sheets for anything that signs: decoded effect,
  amounts, recipient, and the fee, in words, with the dangerous option
  never pre-selected (extends Gate 9 into a UX shape).
- Paste safety as a designed flow: address fields validate on paste
  (checksum, length), warn when the pasted address differs from the
  connected wallet, and offer "Use my connected wallet" as the primary
  path so most users never paste at all. QR scan for addresses on mobile
  where the camera is available.
- Claim flows: a plain summary first ("About 0.49 AUICON + ANRCON worth
  claiming; 11 smaller amounts are dust"), claim-all per group where one
  call covers it, and identical dust treatment in every panel. An enabled
  action whose cost exceeds its return is a defect (Gate 16).
- Guided first run: a 20-second, dismissible, in-context orientation
  (three coach marks tied to the core loop: the preset chips, a verdict's
  meaning line, the money summary), never a blocking tour and never
  before first value. Contextual help lives at the point of doubt (a
  one-line explainer under each money panel's title is worth more than a
  help page).
- Empty states teach: a filtered view with no results names the filters
  that emptied it and offers the one-tap loosening (Baymard zero-result
  recovery), instead of a dashed box.

## 4. Mobile craft: iOS and Android are different countries

- Viewport units: never 100vh for anything with a bottom edge (it is
  pinned to the large viewport and hides content under browser chrome).
  Shells use 100dvh with a 100vh fallback line before it; sheets and
  anything that must be fully visible in the worst case cap at ~92svh.
  (OpenReplay mobile papercuts, 2026; stagestack mobile UX field guide,
  Aug 2026, caniuse-checked.)
- Safe areas: viewport-fit=cover is only safe together with
  env(safe-area-inset-*) padding on the tab bar, sticky bars and sheets;
  insets are 0 on desktop, so the rules are free insurance. Bottom sheets
  need a visible close (X or "Close"), not grab-handle-only dismissal,
  and must not stack. (NN/g bottom sheet guidelines, 2025; field guide
  above.)
- iOS zoom-on-focus: Safari zooms any focused input under 16px and does
  not zoom back. Rule: inputs are 16px on coarse pointers (media query on
  pointer, not width, so desktop density survives); never
  user-scalable=no (breaks WCAG zoom and iOS ignores it anyway). The
  on-screen keyboard covers fixed footers on iOS (visual viewport
  resizes, layout does not): sticky action bars must tolerate the
  keyboard, and sheets use absolute positioning within a dvh shell.
  (web-developpeur mobile CSS best practices 2026, Oct 2026; field guide
  Aug 2026.)
- Scroll behaviour: overscroll-behavior: contain on every sheet and
  inner scroller (stops scroll chaining into the page behind); momentum
  scrolling is default in modern engines; pull patterns must not fight
  the browser's own gestures.
- Thumb zones: the comfortable zone is the bottom third; Airbnb's
  2022-23 redesign (their largest since launch) moved filtering, saving
  and booking initiation into the bottom half after observing ~67% of
  users browsing one-handed, and reported double-digit engagement and
  booking movement. Bottom navigation: at most 5 slots, only core jobs,
  labels always visible; reference pages (methodology, disputes) do not
  earn slots. (whennotesfly mobile UX principles, Nov 2026, citing
  Airbnb's redesign and earnings reporting; webdesignerindia thumb-zone
  study roundup, 2026, weaker sourcing, used only for direction.)
- Cheap Android is the real test device: 4x CPU + Fast 3G throttling
  (already Gate 3) plus a rule that filter and sort operations on local
  data complete without a network round trip and without dropping scroll
  position.
- Text sizes: body 16px on mobile is the floor that also solves the
  zoom problem; tab labels and chip text never below 12px and never
  truncated (a truncated label is a failed screenshot, Gate 2 amendment).

## 5. PC craft: density, keyboard, scanning

- Desktop earns its width: persistent filter rail (instant apply),
  optional list/table density for scanning many rows, hover used only as
  enhancement (every hover reveal must exist in the tap path too).
- Keyboard: "/" focuses search, "f" opens filters, number keys hit the
  presets, "w" toggles watch on a focused card, Esc closes sheets and
  returns focus. Shortcuts are listed in a "?" sheet; a shortcut nobody
  can discover is a feature for the developer only. (Terminal products
  like GMGN ship hotkeys for the same reason.)
- Multi-column scanning: sort and filter state shared identically with
  mobile (same URL parameters), so a link or a device switch keeps the
  user's place.

## 6. Re-verification of round-1 base topics (checked 17 Nov 2026)

- GIWA: mainnet STILL not launched. Upbit issued another impersonation
  warning on 2 Nov 2026 (fake mainnet-launch and token claims circulating;
  GIWA is testnet-only, no launch date). GIWA Sepolia took Upgrade 20 on
  11 Nov 2026 (fault-proof alignment, L1 contracts only, no node action).
  Gate 8's reserved-chain wording stands unchanged. (Upbit notice via
  ChainCatcher and TokenPost, 22 Oct-2 Nov 2026; chainreport Upgrade 20,
  Nov 2026; argusnodes GIWA sheet, reviewed Sep 2026, crawled Nov 2026.)
- Ammora SDK: still 0.3.9 (npm registry, modified 2026-11-05). No
  migration. The exact pin stands.
- wagmi: 3.7.11 is current (round 1 saw 3.7.6/3.7.7). Same major, no
  breaking note affecting Gate 8. @wagmi/connectors 8.2.4.
- Reown AppKit: npm's latest tag for @reown/appkit and
  @reown/appkit-adapter-wagmi is now 2.0.0 (round 1 saw only the
  2.0.0-wagmi-3.0 beta tag). BUT Reown's own wagmi-3 migration doc,
  crawled 15 Nov 2026, still says "AppKit support for Wagmi 3.0 is in
  beta. Test your app thoroughly before shipping to production." A
  version number going quiet-stable while the vendor's support wording
  stays beta is exactly the newest-is-not-best case: Decision D11 keeps
  D3 unchanged.
- WalletConnect licensing weather (new since round 1): the wagmi team
  has deprecated its own walletConnect connector because @wagmi/connectors
  hard-depends on @walletconnect/ethereum-provider, which pulls the
  Community-Licensed AppKit; downstream projects (e.g. OpenZeppelin
  adapters, Nov 2026 changelog) are stripping WalletConnect entirely
  rather than accept the licence terms, and at least one DeFi frontend
  (Monarch, Oct 2026) replaced AppKit with RainbowKit + wagmi connectors
  for the same reason. For us: the standalone
  @walletconnect/ethereum-provider (current 2.26.0, MIT) used directly is
  the path that avoids the AppKit licence surface; pin it exactly and
  re-check deprecation and licence at every build (Gate 8 amendment).
  (OpenZeppelin adapters changelog, Nov 2026; Monarch commit, Oct 2026;
  npm registry, 17 Nov 2026.)
- Theming, WCAG, Core Web Vitals, OWASP 2025, Baseline statuses: no
  superseding publication found since round 1 (checked via the round-2
  searches above); round-1 positions stand.

## 7. Improvised beyond the brief

- The confusion audit as a release ritual: every screen must answer three
  questions at a glance, in the screenshot, without scrolling: What is
  this? What can I do here? What happens if I do it? A screen that needs
  its own documentation open in another tab fails. This is now Gate 13.
- Information scent on cards: a card must carry the signal the user is
  scanning FOR (verdict + meaning + progress), not the data that was
  easiest to fetch (raw block numbers, repeated boilerplate). Duplicated
  sentences across sections of one page are treated as defects: each
  section must add information or be cut.
- Feedback timing: filter and search results update within ~100ms from
  local data or show the count first; skeletons keep the geometry of the
  final list so results do not jump (skeleton honesty, extends Gate 7).
- Saved views: presets the user builds (a filter combination) can be
  named and pinned next to the built-in presets, stored locally; the
  watchlist is a saved view over the same machinery, not a separate
  system.
- A "Why am I seeing this?" line on any default-filtered view, naming
  the active defaults and what they hide, with counts. Defaults that hide
  things silently are how products get accused of censorship; defaults
  that announce themselves are a feature.

## 8. Decision notes, round 2 (D11-D16)

- D11 Wallet kit, revisited. Options: (a) switch to Reown AppKit 2.0.0
  now that its npm latest tag looks stable, (b) keep round 1's D3 (wagmi
  + @wagmi/connectors, own UI) with the WalletConnect leg on the
  standalone @walletconnect/ethereum-provider. Pick: (b). Reason: the
  vendor's own migration doc still labels wagmi-3 support beta; the
  wagmi team is deprecating its WalletConnect connector over AppKit's
  Community Licence; two independent downstream projects removed AppKit
  in Oct-Nov 2026 over the same terms. The newest artifact contradicts
  the newest documentation, and documentation about support status is
  the evidence that matters for a support decision. Alternative wins:
  AppKit when Reown's docs drop the beta label for wagmi 3 AND the
  licence ceiling (500 MAU) is either lifted or irrelevant because the
  product has paying scale to negotiate.
- D12 Filter application model. Options: instant apply everywhere;
  batch apply everywhere; hybrid. Pick: hybrid. Preset chips and the
  desktop rail apply instantly; the mobile filter sheet composes in
  batch behind a live "Show N coins" button. Reason: Baymard/NN/g
  evidence splits exactly this way (instant is the desktop expectation;
  batch prevents churn behind a modal and supports multi-facet
  composition on small screens); the live count on the button is what
  makes batch safe. Alternative wins: instant-in-sheet only if the sheet
  is a half-sheet over a live list the user can watch change (Airbnb's
  map pattern); our list is the whole screen, so batch.
- D13 Default board. Options: (a) raw stage lanes, everything shown
  (current), (b) stage lanes with safe defaults applied (test launches
  and stopped coins hidden, announced, toggle in place). Pick: (b).
  Reason: the product's promise is curation ("the good ones, the sketchy
  ones, and the receipts"); a default view where the plurality of cards
  are the protocol team's own test tokens breaks the promise in the
  first viewport and contradicts the blueprint's own test-launch rule.
  Alternative wins: (a) for a future pro/terminal mode aimed at
  Axiom/GMGN switchers, where completeness is the promise; that mode is
  a toggle, not the default.
- D14 Hero. Options: keep the brand hero (current), compress to a
  two-line header, remove entirely. Pick: compress. One promise line +
  one live fact line, then the filter bar, then coins; first coin cards
  visible in the first viewport on phone and desktop. Reason: TTFV
  evidence (section 1) and the unanimous benchmark behaviour (Axiom,
  GMGN, DexScreener, pump.fun all open on data, not slogans). This
  deliberately does NOT follow the brand-storytelling hero pattern that
  current marketing-site fashion (and our own round-1 spec) favours;
  fashion is the newest source here and it loses to task evidence.
  Alternative wins: a landing page whose job is persuasion for people
  who cannot use the product yet (pre-launch waitlist); Evenfield is
  usable today, so it is not that page.
- D15 Bottom tab composition. Options: current five (Board, Money,
  Chain checker, How verdicts work, Dispute a record); job-based five
  (Board, Watchlist, Money, Chain check, More). Pick: job-based five.
  Reason: tab slots are the scarcest resource in the product; two of the
  current five are reference pages with no recurring job, while the
  watchlist (a blueprint core loop) has no slot at all. Methodology and
  dispute move to More and to contextual links on the verdict itself,
  where the doubt actually occurs. Alternative wins: none for tabs;
  reference content in tabs is a category error, not a style choice.
- D16 Default sort. Options: Newest first (screener convention), Closest
  to graduation, Most buyers. Pick: Closest to graduation within each
  lane, with Newest one tap away in the sort control. Reason: the core
  job is "worth attention", and progress-to-graduation is the product's
  own measure of momentum; recency is how raw screeners sort because
  their job is flow, not judgement. Alternative wins: Newest in the
  "New today" preset, where recency is the intent the user just stated.

## Sources, round 2 (all checked 17 Nov 2026; dates as published)

- NN/g: 10 usability heuristics (current); filter categories and values
  (nngroup.com/articles/filter-categories-values); bottom sheet
  guidelines (2025); progressive disclosure (Nielsen 1995, NN/g
  revisions through 2024); search suggestions study (~23% pick rate).
- Baymard Institute: product listing page UX (updated 20 Aug 2026);
  ecommerce filter UI (2026); filtering research via tweakwise guide
  (Nov 2026) and NexorAIQ summary (28 Oct 2026): counts per value,
  applied-filter chips (28% of sites fail), label clarity (25% desktop /
  40% mobile unclear), multi-select, zero-result recovery.
- Filter pattern syntheses: ux.detroit3d search and filtering (updated
  22 Jul 2026); uiuxatlas filtering and sorting (2026); UXPin filter UI
  and UX (2026, Airbnb panel); humanstandards search and discovery
  (Nov 2026); orbix search UX design (11 Nov 2026).
- Progressive disclosure and TTFV: arc42 quality model (14 Nov 2026);
  digia.tech mobile progressive disclosure (2026); nostr-ux onboarding
  research sources (2026); sanjaydey SaaS UX best practices 2026
  (Reforge 2025 aha-moment data; Amplitude 2025).
- Mobile craft: OpenReplay, 5 mobile web papercuts (2026); stagestack
  mobile UX and touch field guide (Aug 2026, caniuse-verified);
  web-developpeur mobile CSS best practices 2026 (Oct 2026); NN/g bottom
  sheets (2025); Airbnb one-handed redesign via whennotesfly mobile UX
  principles (Nov 2026).
- Crypto screeners: solbotrank best Solana memecoin screeners (Oct
  2026); jumpbit Axiom vs GMGN (checked 23 Oct 2026, from official
  docs); defined.fi multi-chain terminal comparison (7 Nov 2026);
  GMGN and Axiom official docs as cited therein.
- Wallet and chains re-verification: npm registry (17 Nov 2026: wagmi
  3.7.11, @wagmi/connectors 8.2.4, @reown/appkit latest 2.0.0,
  @walletconnect/ethereum-provider 2.26.0, @ammora-protocol/sdk 0.3.9
  modified 2026-11-05); Reown wagmi-3 migration doc (crawled 15 Nov
  2026, still labels support beta); OpenZeppelin adapters changelog
  (Nov 2026, WalletConnect removal over Reown relicence); Monarch
  AppKit replacement commit (Oct 2026).
- GIWA: Upbit impersonation warning (2 Nov 2026, via ChainCatcher and
  TokenPost); GIWA Sepolia Upgrade 20 (11 Nov 2026, via chainreport);
  argusnodes GIWA chain sheet (reviewed 16 Sep 2026).
- Local evidence: Evenfield 2.0 live crawl (17 Nov 2026, board lanes and
  card mix), probe/qa screenshots (home/coin/money, dark, 390 and 1280),
  round-1 study-notes.md and audit-and-redesign-spec.md, blueprint v2.
