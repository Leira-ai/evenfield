# Evenfield 2.0 usability audit and UX redesign spec v2

Written 17 Nov 2026, after Leira rejected Evenfield 2.0's UI a second time:
still ugly, and users are confused about how to use it. Her priorities for
this round: user ease and security first; things that make the user's life
easier (filters and everything beyond them); the mobile display
specifically; all devices; dark default. This document audits the LIVE
2.0 build (https://leira-ai.github.io/evenfield/) as a new user on a
phone, counts the cost of the four core jobs, and specifies the redesign.
The live site is NOT changed by this document, and nothing here rebuilds
it. Evidence: live crawl of the board (17 Nov 2026), probe/qa screenshots
home-dark-390, home-dark-1280, coin-dark-390, money-dark-1280 (viewed),
round-2 study (study-notes-2.md), skill Gates 13-16. Counting convention:
from a cold open with the snapshot loaded; a "tap" is one deliberate
press/click; scrolls, decisions and waiting are counted separately
because users feel them separately.

## The headline finding

Evenfield 2.0 passes its engineering gates and fails its jobs. The data
engine is honest and the pages render correctly at every width, but a
new user cannot do the product's central job (find a coin worth
attention) at any number of taps, because the tool for it, filtering,
does not exist. What exists is a scroll: 133 cards in three lanes, of
which 39 are the protocol team's own test launches, presented in the
default view, unfiltered, unsortable, with the judgement signal split
between a chip and a sentence that answer different questions. Round 1
fixed how the product looks in a screenshot. The product was never
checked for whether a stranger can use it. Gate 13 now exists so this
cannot ship again.

## The four core jobs, walked as a new user on a phone (390px)

### Job 1: Find a coin worth attention. FAIL (task impossible, not just slow)

- First viewport contains zero coins: the hero (4 lines of headline,
  a paragraph, a fact line, a data-as-of line) plus the search field
  fill the screen; the first card is below the fold (home-dark-390).
- Scroll ~1.5 screens past the "This week" recap band (editorial, not
  the board) to reach "Just launched": 42 cards. From the live crawl,
  at least a third of the visible cards in this lane are "Protocol test
  launch"; across the board 39 of 133 cards are test launches, all
  shown by default, interleaved with real coins.
- There are no filters, no sort control, no stage tabs, no presets.
  Search exists but has no suggestions, and its placeholder is
  truncated at 390px ("...wallet addre:").
- The user's actual intent ("near graduation, from a creator who
  hasn't dumped before") cannot be expressed. The only strategy is
  opening coin pages one by one: realistically 4-6 page visits (8-12
  taps with backs) and minutes of scrolling to assemble a shortlist of
  three, with no guarantee the good candidates were even in the lane
  scrolled.
- Verdict on the walk: the job cannot be completed as specified. Cost:
  unbounded. This is the product's core loop failing, and it is why
  "users are confused": the interface offers no path that matches the
  question in the user's head.

### Job 2: Check whether a creator is trustworthy. PARTIAL (2 taps, wrong signals)

- The board card does not name the creator at all, so the question
  cannot even start from the board; the user must open the coin (tap 1).
- On the coin page the verdict stage is the first card (good), and "See
  their full record" reaches the passport (tap 2). Tap count is fine.
- The signals fight each other: the card chip says "Worth a careful
  look" while the card's reason sentence may say "Trading on this coin
  stopped." The chip is the CREATOR verdict; the sentence is the COIN's
  state; nothing labels which is which, so users read them as one
  contradictory message.
- The coin page then repeats the verdict paragraph word for word in a
  "Creator record" section further down (coin-dark-390), so the user
  reads the same text twice and trusts neither.

### Job 3: Understand the verdict. FAIL (the label misleads)

- "Worth a careful look" is the caution label, and at face value it
  reads as mild praise (worth looking at!). A first-time user
  systematically reads the caution state as a recommendation. The
  label fails Gate 13's face-value rule.
- The verdict paragraph gives facts without scale or consequence: "they
  sold 5.5% of what they bought in the first hours, in 1 transaction."
  Is 5.5% a lot? What should the user DO with this? No "what this means
  for you" line exists anywhere in the product.
- Full understanding requires "See the receipts" (tap) and ideally the
  methodology page, which sits in the bottom tab bar, away from the
  moment of doubt. Understanding is treated as a separate destination
  instead of a property of the verdict itself.

### Job 4: Find fees to claim. FAIL (front door is a 42-character address)

- Money center is one tap from the tab bar (good). The page then asks
  for an address. A new user must leave the product, open their wallet
  app, find and copy a 42-character address, return, paste, tap Check:
  2 in-product taps plus an external hunt, before anything is checked.
  The connected-wallet path exists in the header but the money page
  does not lead with it ("Use my connected wallet" is not the primary
  action; the QA screenshot shows a pasted address while the header
  still says "Connect wallet").
- The cold sweep then takes minutes (progress line exists; expectation
  copy exists) before any answer.
- The answer is six panels named in protocol jargon (Creator surplus,
  Creator leftover, Launch partner fees, ALMM referral fees, Pool
  revenue (ARL), Fee-sharing vaults). The totals line is an unreadable
  run-on: "<0.001 WETH · <0.001 KGPT · <0.001 PAG · ..." across two
  full lines (money-dark-1280).
- The dust rule is applied inconsistently: the leftover panel groups
  dust with claims disabled, but the ARL panel lists row after row of
  "<0.001 TOKEN" each with an ENABLED bright Claim button, the exact
  pattern Gate 7/Gate 16 forbid, and each row repeats "See the exact
  amounts" and the same pool-creator address as noise.
- There is no plain summary ("about X in 2 tokens is worth claiming;
  the rest is dust") and no claim-all; every claim is its own
  transaction hunt through the panels. First sensible claim: at least
  5 interactions plus minutes of waiting plus six panels of scrolling.

### Desktop walk (1280px), differences only

Same single column of cards at 1200px width; no filter rail, no list
density, no keyboard shortcuts; the hero is larger, not shorter. PC
users get the phone's scroll with more air around it. The platform's
advantages (width, keyboard, hover) are entirely unused.

## Confusion points, ranked (heuristic named per NN/g)

- C1. No path matches the user's question (Job 1). Violates: user
  control and freedom; flexibility and efficiency. Severity: fatal.
- C2. Zero product in the first viewport; the slogan is the interface.
  Violates: visibility (of the actual system state/content); TTFV
  budget (Gate 13). Severity: fatal for first impressions.
- C3. Test launches shown by default and dominating the lanes (39/133).
  The product's own curation promise is contradicted by its default
  view. Violates: match with the real world (the user's world has real
  coins and team tests; the board pretends they are the same list).
- C4. Verdict chip and card reason answer different questions,
  unlabelled (Job 2). Violates: consistency; error prevention (users
  will act on the wrong signal).
- C5. Verdict label reads as praise for a caution state; no consequence
  line; numbers without scale (Jobs 2-3). Violates: match with the
  real world; help at the moment of need.
- C6. Money center's front door is an address field; jargon panel
  names; unreadable totals; dust claims enabled in one panel and
  disabled in another (Job 4). Violates: recognition over recall;
  consistency; error prevention (an enabled dust Claim trains blind
  signing, a security failure, not only a UX one).
- C7. Bottom tab bar spends 2 of 5 slots on reference pages (How
  verdicts work, Dispute a record) while the watchlist, a core loop,
  has no slot; tab labels are small and dense at 390px. Violates:
  flexibility/efficiency; aesthetic and minimalist design.
- C8. Coin page buries the money action on mobile: verdict, curve, six
  stat blocks (one shows a raw block number, "Last trade 41,499,292",
  as its value; one repeats the curve caption verbatim), duplicated
  creator section, then the quote card ~4 screens down. Violates:
  recognition over recall (block numbers); minimalist design
  (duplication).
- C9. Search placeholder truncated at 390px in the shipped build, the
  defect Gate 2 was written to catch, surviving because QA checked
  rendering, not reading. No suggestions, no recents, no grouping.
- C10. Raw block heights as user-facing time everywhere ("Launched at
  block 41,498,424"). Users think in hours and days; blocks are
  receipt data. Violates: match with the real world.

## Redesign specification v2 (build-ready; do not start without Leira's go)

### S1 The filter system (the centerpiece)

Data basis: everything below computes client-side from the existing
snapshot (133 items; no new backend, no network round trip, scroll
position preserved).

Presets (one-tap chips, sticky row, each with its live count):
- Worth a look: verdict is Clean record or Caution-free AND (progress
  >= 25% OR buyers >= 3); test launches excluded.
- Graduating soon: progress >= 80% and still trading.
- New today: launched within 24h before the snapshot watermark.
- Clean creators: verdict Clean record only.
- Graduated: stage Graduated.
- Watching: the user's watchlist (same machinery, not a separate page
  system).
The default landing applies NO preset but DOES apply the safe defaults
(S3), and says so.

Facets (sheet on mobile, rail on desktop), all with live counts computed
against the other applied facets (OR within, AND across; zero-count
values disabled):
- Stage: Just launched / Close to graduation / Graduated.
- Verdict: Clean record / Caution / Too new to judge / Stopped.
- Creator: Has graduated a coin before / First launch / Sold early
  before (from passport aggregates).
- Activity: Has buyers / Traded in last 24h / Raised at least 0.1 WETH.
- Toggles: Show protocol test launches (default OFF), Show stopped
  coins (default OFF).

Sort (visible control beside the filter trigger): Closest to
graduation (default, Decision D16), Newest, Most buyers, Most raised.

Mechanics (Gate 14): applied filters render as removable chips above
the results with Clear all and the sentence "Showing N of 133 coins ·
39 test launches hidden by your defaults". Mobile sheet: facets in
labelled groups, sticky footer with Clear all and "Show N coins"
(live count), visible close. Desktop: left rail, instant apply. Filter
+ sort state in the URL and persisted; result-count changes announced
via aria-live. A filtered-empty view names the filters responsible and
offers the loosening tap. Named user presets can be saved locally and
pinned beside the built-in chips.

Search: suggestions grouped Coins / Creators / Addresses, each coin row
carrying its verdict chip; recents stored locally; query persists into
the results view; placeholder shortened to fit ("Search coins or
creators") and verified at 320px in EN and ID.

### S2 Home structure

Mobile (<= 768px):
1. Header (brand, chain badge compact, wallet button).
2. Promise line (one line) + live fact line (one line, includes data
   age as a sentence).
3. Sticky filter bar: preset chips row (scrollable, counts on chips) +
   Filter button with active count + sort control.
4. "Why am I seeing this?" line (active defaults + hidden counts).
5. Board lanes in stage order, cards per S4. First coin cards visible
   in the first viewport (Gate 13).
6. Recap band moves BELOW the board; passports strip after it.
7. Bottom tab bar per S5.

PC (>= 1024px): two-column shell: left filter rail (facets + saved
views, instant apply), main column with the same header lines, preset
chips and board; optional dense list view toggle; keyboard shortcuts
(/ search, f filters, 1-6 presets, w watch on focused card, ? opens
the shortcut sheet).

### S3 Safe defaults (Gate 16, Decision D13)

Test launches and stopped coins hidden by default on every list and in
every count a user sees, announced in the "Why am I seeing this?" line
with their counts and the in-place toggles. The verdict engine's
existing test-launch exclusion stays untouched; this extends the same
honesty to presentation.

### S4 Cards and verdicts (comprehension first)

- Card layout: coin name + symbol, creator name (new: the creator is
  named on the card, with their verdict chip beside THEIR name, so
  Job 2 starts on the board), stage pill, progress meter, buyers and
  raised in relative terms, reason sentence (coin state, labelled as
  the coin's, visually distinct from the creator chip).
- Verdict label set renamed to read correctly at face value: "Clean
  record so far", "Caution: sold early", "Caution: their coins
  stopped", "Too new to judge", plus the test-launch tag (not a
  verdict). Every verdict, on card and coin page, renders the three
  parts: label, key fact, and the meaning line ("What this means for
  you: ...") in second person, written per verdict kind in both
  locales. Example for Caution: sold early: fact "Sold 62% of the
  coins they bought in the first hour." Meaning: "If you buy, you are
  trusting someone who cashed out of their own launch almost
  immediately. Most careful buyers skip coins like this."
- Receipts stay one tap from the verdict, and the methodology link
  lives inside the verdict stage ("How we judge"), not in a tab.

### S5 Navigation

Bottom tab bar (mobile): Board, Watching, Money, Chain check, More.
How verdicts work and Dispute a record move into More AND into
contextual links (verdict stage, passport footer). Desktop nav mirrors
the same five jobs. Tab labels at readable size, icons + text, active
state unmistakable.

### S6 Coin page order (mobile)

Header (name, stage, Watch) → verdict stage (three-part verdict +
receipts + how-we-judge link) → sticky quote bar (amount presets
0.01 / 0.05 / 0.1 WETH + Get the quote; expands to the full quote card
with sell-back and block stamp) → curve chart → key stats (relative
times only; "Last trade 2 hours ago"; block heights move into the
evidence drawer) → creator summary (ONLY what the verdict stage did
not already say: their other coins and outcomes) → evidence. Desktop
keeps the two-column rail from spec R3, with the quote rail sticky and
the same content order in the main column. All duplicated sentences
from 2.0 are deleted, not moved.

### S7 Money center

- Lead with the wallet: if a wallet is connected, the check runs for
  it automatically on arrival (0 taps); if not, the primary button is
  "Connect wallet and check", and paste-an-address is the secondary
  path (validates on paste, warns when it differs from the connected
  wallet, QR scan offered on mobile).
- Summary card first, in plain words: "About 0.246888 AUICON and
  0.246888 ANRCON are waiting and worth claiming. 11 smaller amounts
  add up to less than the fee to claim them, so they are grouped as
  dust below." Then claim-all for the worth-claiming group (one
  confirm sheet per Gate 16, then signatures), then per-stream panels
  renamed to user language: "From coins you launched", "Leftovers from
  your launched coins", "Launch partner fees", "Referral fees from
  pools", "Pool revenue", "Fee-sharing vaults", each with its one-line
  explainer kept.
- Dust treatment identical in every panel: grouped, collapsed, claims
  disabled with the reason. No enabled Claim on any amount below the
  gas threshold, anywhere. The run-on totals line is deleted; the
  summary card replaces it.
- Cold-sweep expectation copy stays, plus per-panel skeletons (Gate 7).

### S8 What each screen answers at a glance (Gate 13 audit targets)

- Board: What: every Ammora coin, judged. Do: tap a preset or open a
  coin. Next: the shortlist changes / the coin page opens with its
  verdict first.
- Coin: What: this coin and the record of its creator. Do: read the
  verdict, get a quote. Next: the quote shows exactly what a buy
  returns and what selling straight back returns, before any wallet is
  involved.
- Passport: What: everything this creator has launched and how each
  coin ended. Do: open any coin, or dispute the record. Next: the
  coin page / the dispute form with the evidence attached.
- Money: What: fees waiting for your wallet, in plain totals. Do:
  claim what is worth claiming. Next: a confirm sheet in plain words,
  then your wallet asks you to sign.
- Chain check: What: whether the chain in front of you is the real
  GIWA. Do: paste or read the verdict for 91342 / 9134 / anything else.
  Next: the verdict says what to do (proceed / stop) in one line.

### S9 Acceptance checks (all must pass on the live build, Gate 2 matrix)

Task budgets (cold open, snapshot loaded; phone = 390px touch, PC =
1280px mouse+keyboard):

| Task | Phone budget | PC budget |
| --- | --- | --- |
| T1 First coin card visible | 0 taps, 0 scroll, first viewport | same |
| T2 Shortlist: near-graduation coins from clean/caution-free creators | <= 3 taps (preset + optional facet + Show N) | <= 3 clicks |
| T3 Creator trust answer readable | 0 taps from card (chip + meaning line); full record <= 1 tap | same |
| T4 Verdict meaning understood (tester can say what the verdict advises, in their own words) | 0 taps from coin page top | same |
| T5 Fees worth claiming identified | <= 1 tap after connect (auto-check + summary) | same |
| T6 First claim confirm sheet open | <= 3 taps after connect | same |
| T7 Recover from a zero-result filter | <= 1 tap (offered loosening) | same |
| T8 Return from a coin page with filters intact | automatic (state persisted) | same |

Comprehension checks: the 5-second test on Board, Coin and Money
screenshots (viewer states what the screen is and what they would do
next, unaided); the face-value test on every verdict label (viewer
states whether the label is good news or bad news; any label misread
by any tester fails).

Hallway protocol: 5 first-time users (no crypto-terminal experience
required for 3 of them), scripted T1-T7 on their own phones, no help,
taps counted from screen recordings; pass bar: at least 4 of 5 complete
each task unassisted within budget. Results (including failures) are
written into the build notes and reported to Leira by gate number
(Gate 12/Gate 13).

Screenshot additions to the Gate 2 matrix: board with a preset applied
(chips + counts + why-line visible), filter sheet open mid-composition
(Show N visible), zero-result state, coin page with sticky quote bar
mid-scroll, money summary card, all at 390 and 1280, both themes, plus
the sheet and tab bar on a foldable cover (344) and an iOS-class
viewport with safe-area insets visible.

### S10 Sequencing

S1+S3+S4 are one build (the board release). S5-S7 follow in the same
pass if the header/tab work is already open; S2's PC rail and S9's
hallway test gate the release. Phase 1B (Launchparty wizard, Potluck
designer) remains after this, and inherits the filter and verdict
components specified here.
