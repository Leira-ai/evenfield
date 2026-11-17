# Evenfield perfection audit (self-driven, no feedback from Leira)

Written 17 Nov 2026 after Leira rejected v3.0.0 as "not worthy yet" and
explicitly refused to give feedback: Muse claimed it can learn on its
own, so this audit finds the flaws itself. Method: benchmark side by
side (Axiom Pulse, GMGN Trenches/token page, pump.fun pattern,
DexScreener pattern, Linear as the non-crypto polish reference), pixel
level review of the v3 screenshots in probe/qa/ (all viewed, not just
listed), a data substance audit against public/snapshot.json itself
(counts computed from the shipped file, 17 Nov 2026), and the blueprint
v2 promises checked against what actually shipped. Every finding cites
a screenshot region, a measured number, or a quoted UI string. Nothing
in this document was supplied by Leira.

Verdict up front: v3 fixed the jobs' mechanics (filters exist, tasks
pass) and shipped a product that is still not credible as a trust
product, for one structural reason the gates never measured: **the
verdict engine almost never has anything good to say, and when it says
something bad, its own numbers contradict its words.** Polish problems
sit on top of that. A reviewer from the Ammora team opening this today
sees a careful, honest, well engineered board where every real coin is
flagged or unknown, the flagship presets read zero, and the same
warning paragraph is pasted under 24 different coins. That reads as a
demo of a verdict system, not a verdict system.

---

## Part 1. The five harshest findings

### F1. The verdict contradicts itself in its own numbers (trust destroying)

Evidence, v3-home-1280-dark.png, first card (Giwamora / GMORA):
chip "Caution: sold early", fact line "they sold 0.2% of what they
bought in the first hours after launch, in 1 transaction", meaning
line "you are trusting someone who cashed out of their own launch
almost immediately."

0.2% is not "cashing out almost immediately". The fact and the meaning
line describe two different events. The meaning line is a fixed
template per verdict kind; it is not scaled to the measured fact. On
the second card (DANISUKALANANG) the same meaning paragraph appears
word for word under a different fact ("sold early on 1 of their 9
launches"). Snapshot check: verdict kind "careful" covers 69 of 133
launches, and every one of them renders this same paragraph. A trust
product whose strongest sentence is provably disproportionate to its
own evidence, repeated verbatim 69 times, trains users to ignore the
verdict entirely. This is worse than v2's misleading label: v2
mislabelled, v3 overclaims with receipts attached.

Root cause: verdict thresholds are binary (any early sell above zero
= caution) and the copy is templated at kind level, not generated from
the measured magnitude. Blueprint G3/G12 demanded verdicts be built
from named evidence fields with published thresholds; the thresholds
were published, but no severity banding was ever defined, so 0.2% and
90% receive the same words.

### F2. The product has no positive signal at all (the promise is unfulfilled)

Evidence, computed from the shipped snapshot.json (builtAt
2026-11-16T19:07Z): verdict distribution over 133 launches is
careful 69, test 39, too new 25, **clean 0**. Not one coin in the
index carries a positive verdict. Consequences visible in the
screenshots: preset chips "Clean creators 0" and "Graduating soon 0"
(v3-home-1280-dark.png), facet "Clean record 0" in the filter rail.
The two flagship one-tap intents a new user would try first both lead
to an empty board. "Worth a look 2" resolves to two "too new to judge"
coins, i.e. the product's only recommendation is "we don't know yet".

A board that can only warn or shrug cannot fulfil its own headline
("Every Ammora coin, judged" / "spot the coins worth your money").
Users do not return to a tool that never says yes. Benchmark contrast:
GMGN's security panel is mostly green checks with explicit pass
thresholds (Top10 hold "Yes" = top ten under 30% of supply); Axiom's
Pulse lets a user's own filter template define "tradeable" and rows
visibly clear the bar. Both systems say yes constantly, with the
evidence next to the yes. Evenfield's taxonomy has no yes.

Root cause: "clean" was defined as the absence of every negative
signal across a creator's whole history, on a testnet where most
creators are the protocol team or one-launch experiments, so the bar
is unreachable by construction. There is no graded positive tier
("no red flags found in N launches, M trades checked").

### F3. Cards carry no price, no chart, no market signal (it is not a coin board yet)

Evidence, every board screenshot: a card shows name, symbol, stage
pill, creator address fragment, verdict chip, a 3 to 5 line verdict
paragraph, one "This coin:" line (buyers, raised, last trade), and a
progress bar. There is no price anywhere on the board or the card, no
sparkline, no change indicator, no market cap proxy. The single most
scanned field in every benchmark (Axiom Pulse rows: market cap, age,
change; GMGN Trenches cards: market cap, volume, txns, holder and dev
percentages, age counter; DexScreener rows: price, change, liquidity,
volume) is absent. Evenfield removed the unreliable sqrtPrice-derived
spot in v2 for honesty reasons and never replaced it with the honest
alternative that exists in its own data: quote-derived price sampled
at snapshot build time, labelled with its block, exactly like the coin
page's verified live quote but cached. The result: the board reads as
a list of warnings about coins whose basic market facts are invisible.
A user cannot even tell which of the 47 visible coins is big, active,
or dead without opening each one.

Compounding detail: card height is dominated by the verdict paragraph
(~9 lines on desktop, v3-home-1280-dark.png), so the board fits 2
cards per row and roughly 4 cards per 1280px viewport, against Axiom
Pulse's three live columns of compact rows and GMGN's dense cards.
Density is not a style preference here; scanning 47 coins at 4 per
screen is the "users are confused / bored" feeling Leira reported.

### F4. Desktop is a stretched phone, and 1920 is empty (PC craft still absent)

Evidence: v3-home-1280-dark.png shows content capped near 1150px with
two card columns; the 1920 matrix shot shows the same column floating
in a field of empty dark canvas on both sides (roughly 60% of the
1920 width carries no information). The filter rail is a vertical
stack of full-width pill buttons ("Has graduated a coin before 25" as
a 270px wide pill) instead of the compact checkbox/radio rows every
benchmark uses; it consumes ~290px to say what Axiom's filter panel
says in a grid of small labelled inputs. There is no table/dense mode
in the shipped build a scanner can switch to, no price column to sort
by, and the sort control offers four options where the data supports
at least seven meaningful ones (most buyers, most raised, most trades,
highest progress, newest, oldest, most active in 24h). Keyboard
shortcuts exist per Gate 15 but nothing on screen advertises them
except the "?" pattern a first timer will never press.

### F5. The money center summary repeats the exact failure v2 was rebuilt to kill

Evidence, v3-money-summary-1280.png: the summary card's headline is
"About <0.001 WETH · 0.012002 GLPD · 0.010002 BLDRC · 0.246888 AUICON
· 0.246888 ANRCON are waiting and worth claiming." That is the run-on
amounts line from 2.0, promoted to a headline. It leads with a dust
amount ("<0.001 WETH") inside a sentence about what is "worth
claiming", gives five amounts in four different tokens with no total
and no per-token grouping, and is followed by a bare fragment line
"Read now." and, directly under the Claim all button, the alarming
unexplained sentence "Some corners of the chain could not be read in
this sweep, so a missing line is not proof of zero." The honesty is
correct; its placement (immediately after the call to action, with no
indication of which corners or whether the shown amounts are affected)
reads as "this total might be wrong", undercutting the one action the
page exists for. Benchmark contrast: Linear and every mature fintech
summary lead with one number and one sentence; detail and caveats live
one layer down, attached to the rows they qualify.

---

## Part 2. Benchmark side by side (what each reference does better, concretely)

### Axiom Pulse (desktop discovery)
- Three synchronised live columns (New Pairs / Final Stretch /
  Migrated) visible simultaneously; Evenfield stacks its three stages
  as one long scroll, so "Close to graduation" is screens away.
- Fourteen filters with min/max numeric inputs (top-10 holders %,
  dev %, snipers %, insiders %, bundle %, holders, liquidity, volume,
  market cap, txns, buys, sells, age). Evenfield's facets are
  categorical only; the numeric questions traders actually ask ("at
  least 10 buyers", "raised at least 0.05") cannot be expressed even
  though the snapshot holds the numbers.
- Every row carries market cap, age ticking live, and change; rows are
  one line tall, so a screen holds 20+ candidates. Evenfield: ~4.
- Quick Buy sits in the same position on every row; the hand learns
  it. Evenfield's per-card action is a star icon at inconsistent
  vertical positions (card heights vary with paragraph length).

### GMGN (Trenches + token page)
- Token page security grid: a compact 4-column grid of labelled
  metrics with pass/fail colour discipline (Top 10, DEV, Holders,
  Snipers / Insiders, Phishing, Bundler, Dex Paid / NoMint, No
  Blacklist, Burnt, Rug %). Ten seconds to read. Evenfield's coin page
  verdict is a prose paragraph inside a big rounded panel; the same
  information as a grid would scan in a third of the space and a third
  of the time.
- Thresholds are printed next to the metric ("Top10 hold: Yes" means
  under 30%), so a number always arrives with its scale. Evenfield
  prints scale only inside the prose, and (F1) sometimes wrongly.
- Holder list with wallet tags (smart money, sniper, dev, bundler)
  and "first 70 buyers, still holding?" Evenfield's snapshot already
  stores holders for 75 of 133 launches and creator buy/sell detail;
  none of it is rendered as a holder view anywhere.
- Trenches cards carry an age counter that ticks; freshness is felt,
  not stated. Evenfield states "Refreshed 4 hours ago" as its most
  prominent freshness signal (see Part 4).

### pump.fun (pattern reference)
- One action per card, enormous touch targets, the progress bar IS
  the card's visual identity, and graduation is an event the whole UI
  celebrates. Evenfield's progress bar is the last and smallest
  element on its card, under ~9 lines of text.
- Comment/activity social proof on the coin page creates the feeling
  of a living market. Evenfield has real activity data (85 launches
  with swaps, max 338 swaps on one curve) and shows none of it as
  activity; the board feels static because its most alive data is
  hidden in aggregates.

### DexScreener (pattern reference)
- A boring, perfect table: sortable columns, numbers right-aligned in
  tabular figures, sparklines inline, chain and pair age always
  visible. Its lesson for Evenfield is not the aesthetic; it is that
  number typography is a feature. Evenfield's numbers sit inside
  prose sentences ("2 buyers so far · raised 0.0139 WETH · launched
  21 hours ago" wraps mid-phrase across two lines on desktop cards),
  so nothing aligns and nothing can be compared down a column.

### Linear (non-crypto polish reference)
- One accent colour, used only for state and the single primary
  action; everything else is a disciplined grey ramp. Evenfield uses
  its mint accent for the Connect button, the progress bars, the
  active tab, links, the claim button and decorative dots; the amber
  caution chip is the loudest element on every card, louder than the
  coin's name. Accent discipline would invert that: name and price
  loudest, verdict chip quiet until it matters.
- Type hierarchy by weight and size steps you can feel (one display
  size, one title, one body, one caption, used consistently). See
  Part 3 for Evenfield's drift.
- Motion is 100-200ms, ease-out, and only on state change. Evenfield
  has effectively no motion language at all (no transition on filter
  apply, no skeleton-to-content crossfade), so the app feels inert
  where Linear feels responsive, at identical data speeds.

### Indonesian fintech reference point (pattern, from study-notes-2 benchmarks)
Tokopedia/Shopee filter sheets put the result count on the apply
button and keep the active filter summary above the results in the
user's own words. Evenfield's v3 sheet does the count; its board
still summarises state as "Showing 47 of 133 coins" with no sentence
about what the 47 are (the why-line naming hidden test/stopped coins
exists but sits below the lane header on mobile, v3-home-390-dark.png,
where the first viewport ends before it).

---

## Part 3. Visual craft audit (pixel level, v3 screenshots)

V1. **Card sameness vs hierarchy.** Every card is the same radius,
same border, same padding, same internal order, regardless of whether
the coin raised 0.0001 WETH or is 99% to graduation. Nothing on the
board is visually promoted: no "closest to graduation" hero row, no
size difference for the 2 "Worth a look" coins. Hierarchy exists only
in text weight. Fix direction in backlog P2/P4.

V2. **The verdict paragraph is the card.** ~55% of each desktop card's
area is the three-part verdict prose (fact + meaning + this-coin
line). The meaning sentence is identical across cards (F1), so the
board's dominant visual texture is repeated boilerplate. Cards should
carry the verdict as chip + one fact line; the meaning line belongs
on the coin page and in an expandable "Why" on the card.

V3. **Type scale drift in practice.** On v3-home-1280-dark.png the
lane title "Just launched" (~30px) is larger than the coin names
(~20px) inside the cards it introduces; the page H1 (~36px), lane
titles, card names, filter rail heading "Filters" (~24px) and panel
headings on Money ("Or check any address", ~24px) all sit within a
few px of each other, so the eye gets four competing title levels.
Money page: H1 "Money center" is immediately followed by a two-line
dek at body size and a status line, three text blocks before the
first card, the same above-the-fold tax the board paid in v2.

V4. **Number typography.** Amounts use proportional figures inside
prose ("0.246888 AUICON"), wrap mid-number-group in the money
headline, and mix precisions on one card (0.2%, 0.0139 WETH, 27.7%).
No tabular figures anywhere; nothing aligns vertically. On the coin
page the quote presets (0.01 / 0.05 / 0.1) render as three identical
pills with the primary "Get the quote" button clipped off the right
edge of the 390px viewport in v3-coin-390-dark.png ("Get th..."): the
sticky quote bar, the page's money action, does not fit its own
screen at the width the QA matrix centres on. (The task probe measured
the bar as present and sticky; nobody measured that its label is cut.)

V5. **Iconography.** Coin avatars are generated pixel identicons in
clashing palettes (cyan checker, orange, purple) with no relationship
to the theme; tab bar icons are a mixed set (grid, star, diamond, a
"88" like glyph for Chain check, ellipsis) at inconsistent visual
weights; the caution chip's warning triangle is the only icon doing
semantic work. There is no icon system: sizes, stroke weights and
metaphor choices vary by where the icon was needed. Benchmarks use
one drawn set (GMGN) or none and let typography work (Linear).

V6. **Colour discipline.** Dark theme: canvas and card surfaces are
close enough that cards read as outlines on a void; the mint accent
appears as progress bar, active tab, links, primary buttons and the
chain dot simultaneously, so "green" means five things. Amber caution
chips are the highest-saturation element on every card and repeat in
a wall (24 caution creators in the default 47), producing a board
whose dominant colour signal is alarm. Light theme
(v3-home-390-light.png): warm paper canvas with white cards is the
closest any Evenfield build has come to the AI-default catalogue
Gate 0 warns against (cream + one accent + uniform cards); elevation
is nearly invisible, the bottom tab bar's cream-on-cream boundary is
a hairline, and the caution chip keeps its dark-theme amber fill,
which on cream reads as a highlighter pen. Light feels inverted, not
designed: same layout, same chip fills, shadows too soft to structure
anything.

V7. **Desktop density and the 1920 problem.** See F4. Additionally at
1280 the filter rail's facet pills wrap their labels awkwardly
("Has graduated a coin before 25" on one long pill), counts inside
pills are the same size and weight as labels, and disabled facets
("Close to graduation 0", "Stopped 0") render as greyed full rows
that read as broken controls rather than honest zeros.

V8. **Mobile thumb ergonomics beyond the gates.** The star (watch)
target sits top-right of each card, the furthest point from a right
thumb holding the phone at the bottom tab bar; the sort select and
Filters button are in a bar that is sticky (good) but the preset
chips, the highest-value control, are NOT in the sticky bar on mobile
(they scroll away with the hero; v3-home-390-dark.png shows only
Search + Filters + Sort in the sticky panel). A user mid-scroll who
wants "Worth a look" must scroll back to the top. On the coin page,
Watch is a full pill under the header while the quote bar competes
with the tab bar at the bottom edge, two sticky layers plus the
verdict panel make the first viewport ~70% chrome and panels, ~30%
content.

V9. **Charts.** The coin page curve is a progress visualisation, not
a price chart (spot price was removed in v2 for honesty). What
remains communicates one number (progress %) that the bar on the card
already shows. There is no time dimension anywhere in the product: no
activity timeline, no buys/sells over time, although the index holds
first/last swap blocks per launch. A coin page without any time
series looks empty next to any benchmark and wastes the one visual
that could show "this coin is alive".

V10. **Empty and zero states as designed objects.** "Graduating soon
0" and "Clean creators 0" as tappable chips promise a destination
that is an empty lane. The zero-result view exists (v3-zero-390) and
names its cause, but the product leads users into it from its two
most prominent chips. Zero-count presets should render as honest
status lines ("Nothing is close to graduation right now; the closest
is X at 62%"), not as doors to emptiness.

---

## Part 4. Product substance audit

### What the verdict knows, and what the chain knows that it doesn't use

Snapshot evidence fields per launch (verified in the shipped file):
swapCount, uniqueBuyers, first/last swap block + last swap tx,
creatorBuys/creatorSells with amounts, creatorSoldEarly,
creatorTransferred, currentCreator, holders (non-null for 75 of 133),
plus curve state (reserves, progress, status). Creator aggregates:
launch counts by outcome, early-sell counts.

Already computed but NOT surfaced anywhere in the UI:
- **Holder concentration.** holders data exists for 75 launches; no
  top-holder share, no holder count trend, no "top 10 hold X%" metric
  exists in the product. This is the single most standard trust number
  in every benchmark (GMGN prints its threshold) and the index is
  already paying the read cost for over half the board.
- **Buy/sell pressure.** swapCount and uniqueBuyers exist; the split
  of buys vs sells for non-creator wallets is not stored (only creator
  sells are itemised), so "3 buys, 0 sells in the last day" cannot be
  shown. The per-swap scan already walks these events in the builder;
  storing aggregate buy/sell counts per launch per window is a builder
  change, not a new data source.
- **Creator's other launches' outcomes as a timeline.** The passport
  aggregates counts (graduated / trading / stopped) but the coin page
  verdict never says the comparative sentence users actually need:
  "their last 3 coins all stopped within a day" vs "2 of their 4
  coins graduated". The data is in the creators table; the sentence is
  not generated.
- **Bundle meter.** Blueprint Phase 1B item, still missing: share of
  supply bought in the first blocks by non-creator wallets, from the
  same swap index. On this testnet it would mostly read near zero,
  which is itself a publishable, checkable fact; on mainnet it is the
  metric the whole category trades on (Axiom and GMGN both lead with
  it).
- **Time patterns.** First swap block and last swap block per launch
  allow "went quiet 3 days after launch" and activity sparklines;
  neither is rendered (V9).

What the verdict gets right and must not lose: test launches excluded
from negative framing, every claim traceable to an explorer link,
three-state honesty (read / zero / unreadable), no invented spot
price. The gap is depth and calibration, not integrity.

### Freshness: the quiet credibility leak

The snapshot in the screenshots was built 2026-11-16T19:07Z and the
hero says "Refreshed 4 hours ago. Live checks are catching up." CI
rebuilds every 6 hours; delta sync runs in the background with a 20s
budget. For a product whose demo script promises "spot the coins
worth your money", a 4 to 6 hour old board with a catching-up caveat
as its second line is a weak first impression, and the phrase "Live
checks are catching up" never resolves into a visible state change a
user can point to. Benchmarks feel live because ages tick and rows
flash on update. Cheap honest wins available: show per-lane newest
item age ("Newest launch: 12 minutes ago" from snapshot data), tick
relative times live, and give the delta sync a visible completion
state ("Caught up to block N just now") instead of a permanent
present-tense promise. Structural fix (a real indexer) stays deferred
per blueprint G4, but the communication gap is fixable now.

### Why would anyone come back daily, honestly?

On today's data: almost nothing changes daily. 133 launches total,
median swapCount 1, zero launches with 3+ unique buyers, 39 of 133
are the team's own tests. The weekly recap (feed.json already carries
newLaunches, newGraduations, weekly) is generated but the Telegram
channel it feeds is still not live (BUILD.md: "PREPARED, NOT LIVE",
blocked on a bot token and channel id that nobody has created). The
watchlist exists but has nothing to watch change: no
change-since-you-left, no progress alerts, no creator-watch. The
honest daily-return hooks this chain can actually feed are:
(1) graduation watch: 32 launches sit at 80%+ progress (mostly
graduated or test, but the near-graduation set is the liveliest
signal available), (2) new launch alerts (35 "New today" on the
screenshot day shows launch cadence is real), (3) the Monday recap
tied to Ammora's own weekly prize rhythm. All three are feed/Telegram
shaped, not dashboard shaped. The product's retention surface is the
feed file it already generates; shipping the channel is worth more
than any new page.

### Trust signals still missing

- Methodology is a page; it is not present at the moment of judgement.
  The verdict drawer links receipts, but the threshold that fired
  ("we flag any early sell above 0%") is never stated next to the
  verdict. GMGN prints the threshold beside the metric; Evenfield
  hides it one page away, which is how F1's disproportion shipped
  unnoticed.
- The correction log exists as a page pattern (dispute + public log)
  but carries no entries and is not linked from any verdict; a trust
  product should show "last corrected" proof of life.
- Share surfaces: OG cards exist for coins and creators (175 images),
  but there is no per-verdict share card ("this creator sold early on
  3 launches, receipts inside") which is the one artefact a user
  would actually post to warn others, and the format that made
  Lookout-style products spread in every prior study round.
- No "checked at block N" stamp on the verdict itself (the data-as-of
  line lives on the board, not on the claim).

---

## Part 5. Feature and non-feature opportunities, judged against this chain's data

### Worth building (full specs in the backlog)
1. **Calibrated verdicts with severity bands + a reachable positive
   tier.** Fixes F1/F2, the product's core promise. Data: already in
   snapshot. Highest value item in this audit.
2. **Snapshot-time price + sparkline on cards.** Price sampled from
   the verified quote path at snapshot build, stamped with its block;
   sparkline from swap-window aggregates the builder already walks.
   Fixes F3. Data: quote path proven live in v2/v3 coin page.
3. **Holder concentration line.** Top-holder share + holder count on
   coin page and as a card facet, for the 75 launches that have it,
   three-state honest for the rest. Data: already read, never shown.
4. **Watchlist with change-since-you-left + graduation watch.** The
   snapshot diff already exists implicitly (CI builds a new snapshot;
   feed.mjs already diffs for the feed). Local "since your last
   visit" from the stored previous snapshot costs no backend.
5. **Ship the Telegram channel.** feed.json/feed.txt generation and
   the workflow step exist; the missing piece is creating the bot and
   channel and adding the two secrets. This is an operations task,
   not a build, and it is the only retention surface that works while
   the user is not on the site. (Creation of external accounts needs
   Leira's go; flagged in the backlog as a decision item, not code.)
6. **Per-coin verdict share card.** One image: coin, verdict, key
   fact, receipts QR/link. Generated by the existing OG pipeline.
7. **Launchparty wizard + Potluck designer (Phase 1B).** Judged
   below; priority: after items 1-3, before 4-6 polish. They complete
   the blueprint's loop (create side) and the Builder submission
   story ("exchange or launchpad"), and both were proven simulatable
   in Phase 0. But shipping a launch wizard on top of a verdict users
   don't trust yet repeats the Slipway error of breadth before depth;
   they are P1, not P0.
8. **Compare two coins.** Cheap (two snapshot records side by side),
   genuinely useful for the shortlist job, and no benchmark at this
   scale offers it in plain language. P2.
9. **"Why this verdict" explainer layer.** Not a new page: the
   threshold sentence + the creator's comparative history sentence
   inside the existing evidence drawer. Mostly copy generated from
   data already present. P0-adjacent (ships with item 1).

### Judged NOT worth building now, with reasons
- **Real-time websocket-style live board.** The chain produces a
  handful of events per hour; theatre without events reads as broken.
  Delta sync + honest freshness copy covers the real need.
- **A proprietary trust SCORE (0-100).** The blueprint deliberately
  chose receipts over scores (G12 definitions are thresholds, not a
  black box). A single number would hide exactly the evidence that
  differentiates this product, and calibrating it on 42 creators
  would be fiction. Bands and facts, not a score.
- **Portfolio / PnL tracking.** Zero launches have 3+ unique buyers;
  there is no user trading population to track on this chain yet.
  Mainnet phase, as the blueprint already says.
- **Comments / social layer.** No moderation capacity, no users to
  comment; pump.fun's social proof works at pump.fun's volume.
- **Native apps / deeper PWA push.** Push needs a backend the
  blueprint deferred on purpose; install polish is fine (backlog
  Foundations) but push is not.
- **More themes / theme customisation.** Two designed themes are the
  gate; a third theme is decoration budget spent against F1-F5.
- **AI-written coin summaries.** The verdict copy problem (F1) is a
  calibration problem; generating prose with an LLM over the same
  thin data adds a new way to overclaim, against the product's
  evidence-only rule.

---

## Part 6. Ranked backlog (build-ready for the top items)

Impact = effect on a first-time user's quality judgement. Effort:
S (under a day), M (days), L (a week+). Risk = chance of breaking a
passing gate or the honesty rules.

### POLISH

**P-1 (P0) Verdict copy calibration.** Impact: critical (fixes F1).
Effort M. Risk: low.
- Severity bands for creator_sold_early, computed in the snapshot
  builder from creatorSellTotal / creatorBuyTotal per launch:
  band A under 1% ("sold a small part"), band B 1-25%, band C over
  25% ("sold most of what they bought"). Only bands B and C may carry
  the "Caution: sold early" chip; band A renders a neutral fact line
  with no chip and no meaning paragraph.
- Meaning lines become band-specific templates with the measured
  percentage interpolated, in EN and ID, e.g. band C: "They sold
  {pct}% of what they bought in the first hours. If you buy, you are
  trusting someone who cashed out of their own launch almost
  immediately." Band B names the fraction plainly without the
  "cashed out" claim.
- Acceptance: regenerate the board; no card may show a meaning line
  whose wording claims a larger action than its fact line's number;
  screenshot check on the three highest and three lowest caution
  cards; thresholds printed on the methodology page and linked from
  the evidence drawer ("Why am I seeing this?").

**P-2 (P0) Card redesign: signal first, prose last.** Impact: high
(fixes F3's density half, V2). Effort M. Risk: medium (Gate 13
comprehension re-test required).
- Card order becomes: name + symbol + stage pill; price line (from
  F-2 below) or "No live price yet" state; progress bar with %;
  one-line stats row in tabular figures (buyers · raised · last
  trade, relative); verdict chip + ONE fact line; creator line with
  name/address + their chip. The meaning paragraph leaves the card;
  a "Why" expander on the card opens the meaning + receipts inline.
- Card max height target: at 390px, at least 2 full cards plus the
  sticky bar visible per viewport; at 1280px, 3 columns x 3 rows of
  cards per viewport in comfortable density.
- Acceptance: Gate 2 matrix re-run; tap budgets T1-T8 unchanged or
  better; 5-second test on the new card (viewer can state price,
  progress, and verdict without opening anything).

**P-3 (P0) Sticky bar completeness on mobile.** Impact: high (V8).
Effort S. Risk: low.
- The preset chip row moves INTO the sticky bar on mobile (second
  row of the sticky panel, horizontally scrollable, active preset
  visible without scrolling back to top). Zero-count presets render
  as status text, not chips (V10): tapping is replaced by the
  "closest is X at N%" line where data allows.
- Acceptance: from mid-board scroll, applying "Worth a look" costs
  1 tap without scrolling; screenshot at 390 mid-scroll.

**P-4 (P1) Accent and hierarchy discipline pass.** Impact: medium-high
(V3, V6). Effort M. Risk: low.
- Mint accent reserved for: primary action per screen, progress
  bars, active navigation state. Links become text-coloured with
  underline; the chain dot becomes neutral. Caution chip loses its
  filled amber background at card level (icon + amber text on
  surface), keeping the filled treatment only on the coin page
  verdict stage. Coin names become the largest text on their card.
- Light theme: card surface moves off pure white to a tinted paper
  one step from canvas, tab bar gets a real boundary (shadow or
  border at 3:1), caution chip fill re-derived for light (pale amber
  wash, dark amber text), verified in the contrast table.
- Acceptance: contrast script re-run both themes; screenshot pair
  390/1280 both themes reviewed against Gate 0's AI-catalogue list.

**P-5 (P1) Money summary rewrite.** Impact: medium-high (F5).
Effort S. Risk: low.
- Summary card leads with ONE line: "{n} amounts worth claiming,
  biggest {amount} {token}." Amounts grouped per token as rows under
  it (tabular figures, one token per row, dust excluded). The
  partial-read caveat moves from under the Claim button into the
  affected panels, worded per panel ("Pool revenue could not be read
  in this sweep; the amounts above do not include it."). The stray
  "Read now." fragment is deleted or becomes a real status sentence
  with a timestamp.
- Acceptance: screenshot money-dark-1280 and money at 390; the
  summary contains no "<0.001" string and no more than one amount
  per line.

**P-6 (P1) Quote bar fit and finish.** Impact: medium (V4). Effort S.
- At 390 the sticky quote bar shows amount presets as a segmented
  control that fits (0.01 / 0.05 / 0.1 / custom) with the action
  button on its own full-width row when space runs out; no clipped
  labels at any matrix width (add a label-overflow assertion to the
  QA probe: every button's scrollWidth <= clientWidth).
- Acceptance: probe assertion passes at 320/360/390; screenshot
  v3-coin-390 re-taken.

**P-7 (P2) Motion and feedback language.** Impact: medium. Effort M.
- 120-180ms ease-out transitions on filter apply (list crossfade),
  sheet open/close, and skeleton-to-content; a brief highlight on
  rows whose data changed after delta sync ("updated just now").
  All disabled under prefers-reduced-motion (Gate 4 already).
- Acceptance: throttled run still passes Gate 3 budgets; no layout
  shift introduced (CLS re-measured).

**P-8 (P2) Desktop density mode.** Impact: medium (F4). Effort M.
- A List density toggle beside the board at >=1024px: true table
  (Coin · Price · Progress · Buyers · Raised · Last trade · Creator
  verdict), sortable columns, tabular figures, row click opens the
  coin. Cards remain the default.
- Acceptance: 1920 screenshot shows the table using the width;
  sorting by every column verified against snapshot values.

### FEATURES

**F-1 (P0) Reachable positive verdict tier.** Impact: critical (F2).
Effort M. Risk: medium (must not become a rubber stamp).
- New kind "No red flags found": creator has at least 1 non-test
  launch, zero early sells across their launches, zero stopped coins
  attributable to them, and the coin itself has at least 1 buyer or
  is graduated. Copy states exactly what was checked and how much
  data backs it: "We checked {n} launches and {m} trades by this
  creator and found no early selling and no stopped coins. That is a
  clean record so far, not a guarantee." Coins whose creators qualify
  but which are brand new stay "Too new to judge" with the creator
  line carrying the positive fact.
- The "Clean creators" preset and facet then resolve to this kind;
  if the count is still 0 on the live snapshot after the change, the
  definition is re-examined against the data and the discrepancy
  reported, not silently loosened.
- Acceptance: verdict distribution printed in build notes; every
  "No red flags" card's claims trace to snapshot fields; methodology
  page updated with the definition and its limits.

**F-2 (P0) Snapshot price + activity sparkline.** Impact: high (F3).
Effort M-L. Risk: medium (honesty rules).
- At snapshot build, for each trading curve, sample the verified
  quote path once (0.01 WETH in, as the coin page does) and store
  pricePerToken + block. Card and coin page show "Price at block N:
  X WETH" with the live quote still attempted first on the coin page
  and the snapshot value as its labelled fallback (replacing today's
  honest-but-empty no-quote state on the board, where no price shows
  at all).
- Sparkline: builder stores per-launch swap counts in fixed windows
  (the evidence already records window ranges); render a 12-point
  activity strip on the card for launches with any swaps, an honest
  flat "no trades yet" state otherwise. It is an activity chart and
  is labelled as one, never as price.
- Acceptance: sampled prices cross-checked against live quotes for 5
  coins at build time (tolerance recorded); no price renders without
  its block stamp; a curve whose quote reverts renders the no-price
  state, never a stale number from a previous snapshot.

**F-3 (P1) Holder concentration surface.** Impact: high. Effort M.
- Coin page gains a Holders block: holder count, top holder share,
  top 10 share (excluding the curve/pool address), each with the
  benchmark-style scale line ("Top 10 under 30% is the range careful
  buyers look for"), three-state honest when holders is null (58 of
  133 today). Card gains a facet "Holder data available" only if
  useful in testing; the coin page block is the commitment.
- A "First buyers" list (from the swap index the builder already
  walks) showing the earliest buyers and whether the creator was
  among them, capped at 10 rows with explorer links.
- Acceptance: figures for 3 hand-checked launches match an
  independent read; null-holder coins show the designed unreadable
  state, not zeros.

**F-4 (P1) Launchparty wizard (Phase 1B).** Impact: high for the
Builder story. Effort L. Risk: medium.
- Exactly per blueprint B3/B4: 3 steps (template in plain words,
  name + image, predicted address + simulated calldata), full demo
  mode, simulation timeout states per G5, share kit generated from
  the simulated launch. Inherits the v3 filter/verdict components
  for its "your coin will look like this" preview, which renders the
  actual board card (P-2 design) for the simulated coin.
- Acceptance: demo script run end to end on a phone viewport with
  RPC throttled; simulation failure branch screenshotted; no wallet
  required until the optional final step.

**F-5 (P1) Potluck designer (Phase 1B).** Impact: medium-high.
Effort M (the Phase 0 probe already proved the raw builder call and
predicted-address match). 
- Visual split designer (creator / designer / moderator / treasury
  presets), plan rendered as the actual DFS vault call, simulated,
  predicted vault address shown; community page for existing vaults
  from the money engine's verified reads.
- Acceptance: simulated plan for a 4-way split matches the Phase 0
  probe's predicted address method; the split is shown on the
  resulting coin's page design (badge + split summary).

**F-6 (P1) Watchlist change-since-you-left.** Impact: medium-high
(retention). Effort M.
- On load, the app keeps the previous snapshot's per-coin progress
  and verdict in localStorage; the Watching view opens with a
  "Since you were last here" strip: progress deltas, verdict
  changes, new launches by watched creators. No backend, no
  accounts; state is per device and says so.
- Acceptance: seeded two-snapshot test shows correct deltas;
  first-visit state explains the feature in one line.

**F-7 (P2) Verdict share card.** Impact: medium (distribution).
Effort S-M (OG pipeline exists).
- Per-coin share image: coin name, verdict chip, the calibrated fact
  line, "Receipts: evenfield / coin / {symbol}" and the Evenfield
  mark; generated in CI with the other OG images; a Share button on
  the coin page verdict stage copies the link with the card as its
  preview.
- Acceptance: card renders for the 3 verdict kinds; text never
  overflows the 1200x630 frame at max name length in EN and ID.

**F-8 (P2) Compare two coins.** Impact: medium. Effort S-M.
- From any card's overflow or the board's compare tray: pick 2 coins,
  get a two-column sheet of the P-2 card fields plus holder and
  verdict facts, differences highlighted only where data exists for
  both.
- Acceptance: compare of a graduated vs a stopped coin renders with
  no fabricated symmetry (missing data shows the honest state per
  column).

### FOUNDATIONS

**D-1 (P0) QA probe: read, don't just render.** The clipped quote
button (V4) and the v2 truncated placeholder both passed probes that
measured presence, not legibility. Add assertions: no button or chip
label overflows its box at any matrix width; no card text is cut by
overflow hidden; the first viewport's largest text element is the
page's H1 (hierarchy check); identical meaning-paragraph strings may
not appear on more than 3 cards in one board render (boilerplate
detector, would have caught F1's texture). Effort S. This is the
cheapest item in the backlog and prevents the next three audits.

**D-2 (P1) Freshness communication.** Per-lane newest-item age,
ticking relative times, delta-sync completion state ("Caught up to
block N"). Effort S-M. Acceptance: stale-state screenshot shows all
three; the phrase "catching up" no longer appears without a
completion or failure state following it.

**D-3 (P1) Telegram channel go-live (operations, needs Leira's
decision).** Create the bot and public channel, add
TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID as repo secrets, enable
the already-built workflow step, verify one feed post lands. Effort
S once decided. This is listed as a foundation because every
retention item (F-6, weekly recap) compounds on it.

**D-4 (P2) PWA install polish.** Install prompt after second visit,
offline board from the bundled snapshot already shipped, app icons
checked on iOS (maskable + apple-touch). Effort S. Acceptance:
Lighthouse installability pass; offline reload shows the board with
its stale badge.

**D-5 (P2) Icon set consolidation.** One drawn set (single stroke
weight, 24px grid) for tab bar, chips and panels, replacing the
mixed glyphs (V5); coin identicons keep their generated look but
move to a restrained two-hue-per-coin derivation from the existing
mint/amber palette family so the board stops looking like a sticker
sheet. Effort M.

---

## Part 7. What "perfect" can honestly mean here

Evenfield cannot be made a great trading terminal on this chain
today; there is almost no trading. What it can be, and what the
backlog above is ordered to achieve, is the most trustworthy reading
of this launchpad that exists: every claim calibrated to its number,
a positive signal that means something because it is hard to earn,
prices and holders shown with their stamps, and a create side
(Launchparty + Potluck) that lets a reviewer complete the whole loop
in one sitting. That is the version a reviewer remembers. The
remaining gap after this backlog is data volume, which only mainnet
brings, and the product should say so on its own About line rather
than perform liveliness it does not have.
