# Evenfield changelog

## 3.1.1, 17 Nov 2026: the unstyled-page hotfix

Leira opened the live site on her phone and got the page with
no styles at all (serif font, blue underlined links, frozen
prerender). Root cause, proven by reproduction: every deploy
force-pushes a fresh gh-pages tree and deletes the previous
build's hashed assets (all earlier entry chunks return 404),
while the service worker served its cached index.html
cache-first forever, so returning visitors were pinned to an
HTML whose CSS and JS no longer existed on the server. On a
~5 KB/s connection the same page also sat unstyled for
seconds, because the stylesheet was a separate file.

- The app stylesheet is now inlined into index.html at build
  time (prerender "finalize" step): first paint is styled as
  soon as the HTML arrives, whatever happens to asset files.
- Service worker rewritten and stamped per build (cache name
  derived from the entry chunk hash, so CI deploys roll it
  too): navigations are network-first, hashed assets are
  cache-first with runtime fill, snapshot.json is no longer
  precached, and activation purges legacy caches and
  navigates open windows once when a pre-fix cache is found,
  which heals users stuck on the broken shell.
- The CI deploy now preserves the previous generation's
  /assets/ files instead of deleting them all.
- Verified live: no unstyled phase at ~5 KB/s (first content
  arrives styled), page stays styled through a simulated
  asset wipe, the legacy broken state heals itself on a local
  mirror, and the full suites pass on the final build
  (qa-matrix 69/69, qa-tasks 48/48, qa-wallet-money 18/18,
  qa-readability 15/15). Full record in BUILD.md, "Hotfix
  3.1.1".

## 3.1.0 completed, 17 Nov 2026: the recovery run

The three fixes that sat uncommitted behind the sandbox write
guard are deployed, and the readability QA probe (written for
this release but never run) ran for the first time and found
more, all fixed in the same run:

- Money summary: claimable amounts under 0.001 now print their
  real significant digits (0.000296 WETH, never "<0.001").
- Clean-tier fact and the few-holders card line have correct
  singular forms ("We checked 1 launch and 1 trade", "Only 1
  holder read so far").
- Verdict meanings are now per-coin all the way down: clean
  meanings carry the coin's own buyers, trades and curve fill;
  too-new and caution meanings carry the coin's launch ordinal
  for its creator, so a serial creator's near-identical coins
  no longer repeat one identical sentence (worst repeat on the
  rendered board: 2, across 56 distinct meanings).
- 320px layout: the card header wraps instead of crushing the
  coin symbol next to the stage pill, and the snapshot price
  line can break its long decimal instead of truncating.
- Verified on the final deployed build: qa-matrix 69/69,
  qa-tasks 48/48, qa-wallet-money 18/18, qa-readability 15/15.

## 3.1.0, 17 Nov 2026: the perfection pass

Built from the self-audit (`redesign/perfection-audit.md`) after v3
was rejected without feedback. The audit's charges were calibration,
density, and honesty of presentation; the data engine and the 2.0.0
theme tokens are unchanged.

- Verdict calibration (audit P-1/F-1): early sells are banded by
  size. Under 1% of what the creator bought is a recorded fact and
  never raises a caution; 1-25% and over 25% raise cautions whose
  wording names the fraction and follows it exactly ("cashed out"
  is only said over 25%). Meaning lines are generated from each
  coin's and creator's own measured values, never pasted per kind.
  New positive tier "No red flags found" with a published, reachable
  definition and its boundary sentence (a clean record so far, not
  a guarantee), wired into the Clean creators preset and the
  methodology page.
- Signal-first cards (P-2): snapshot price sampled through the
  proven quote path at index build time, block-stamped and labelled
  with its age; an activity sparkline from indexed swap counts
  (labelled activity, never price); progress; one tabular stats
  line; verdict chip + one fact; the meaning behind a "Why"
  expander. Holder concentration (top holder, top 10) on the card
  and as its own panel with a scale line on the coin page (F-3).
- Empty doors removed (P-3): a preset whose live count is zero
  renders as status text ("Graduating soon: none yet, closest is X
  at N%"), never as a button to an empty board.
- Money center summary rewritten (P-5): plain words first (how many
  amounts are worth claiming, the biggest, per-token totals as
  rows); dust counted and named as dust in its own sentence, never
  inside the worth-claiming sentence; the partial-read honesty line
  moved to the end of the results with calmer wording, and each
  unread stream says so in its own panel.
- Desktop (P-8): content width 1760px, four-column card grid at
  wide containers, and the list density is now a true sortable
  table (Coin, Price, Progress, Buyers, Raised, Last trade,
  Creator verdict) with two new sorts (snapshot price, last trade).
- QA foundations (D-1): new probe `probe/qa-readability.mjs` with
  measured truncation assertions, an H1-largest check, a
  boilerplate detector (no meaning sentence on more than 3 cards),
  the zero-preset status check, a mid-scroll sticky-bar tap test,
  and the 1920 dense-mode checks; it runs in release QA.

## 3.0.0, 17 Nov 2026: the usability rebuild

Rebuilt around how people actually find and judge a coin, under the
skill's Gates 13-16 and `redesign/ux-spec-v2.md`. The data engine, its
verified numbers, and the 2.0.0 theme tokens are unchanged.

- Finding a coin: six one-tap presets with their own live counts
  (Worth a look, Graduating soon, New today, Clean creators,
  Graduated, Watching), facet filters (Stage, Verdict, Creator
  record, Activity) with cross-computed counts and zero-count values
  disabled, grouped search suggestions with verdict chips and
  recents. Sort defaults to Closest to graduation. Filter state
  lives in the URL and survives back navigation.
- Safe defaults, said out loud: protocol test launches and stopped
  coins start hidden; the board always says "Showing N of 133
  coins", and chips in the filter strip say how many the defaults
  are hiding, with the way to lift them built into the same chip.
- Mobile: compressed two-line hero, one sticky strip holding search,
  Filters, Sort, and the preset and verdict chips, so the first coin
  card is inside the first viewport at 390, 360, and 344 widths.
  Filters open as a bottom sheet whose button reads "Show N coins"
  and updates as you tap. Bottom tab bar: Board, Watching, Money,
  Chain check, More.
- Desktop: a left filter rail with instant apply and a list density
  toggle; keyboard shortcuts ( / search, f filters, 1-6 presets,
  w watch, ? help).
- Verdicts at face value: the caution chip reads "Caution: sold
  early" or "Caution: their coins stopped", never praise-shaped.
  Every card carries the creator and their labelled chip, the key
  fact, and a "What this means for you" line.
- Coin page: the verdict stage comes first (label, fact, meaning,
  receipts), then a sticky quote bar with 0.01 / 0.05 / 0.1 presets,
  then curve and stats. Times are relative everywhere; raw block
  heights are no longer shown as user-facing values.
- Money center: a connected wallet is checked on arrival; a
  plain-words summary card leads ("About X are waiting and worth
  claiming"), claim-all sits behind a "Before you sign" sheet that
  lists every amount and how many signatures it takes, and one dust
  rule applies in every panel, so no enabled Claim anywhere costs
  more than it returns. Paste any address as a checked fallback.
- WalletConnect: the leg now runs on the standalone
  @walletconnect/ethereum-provider package, pinned, loaded lazily,
  active only when a Reown project id is configured for this origin;
  the honest in-product note stays until then.

## 2.0.0, 17 Nov 2026: the "field at dusk" rebuild

Full frontend rebuild under the web-product-engineering skill gates
(G0-G12), from the audit and redesign spec in `redesign/`.

- One semantic token set, dark theme by default with a designed light
  pair, anti-flash bootstrap, Plus Jakarta Sans self-hosted, type scale
  1.25, 8pt spacing, elevation from surface lightness.
- All 64 computed contrast pairs pass (scripts/contrast-check.mjs;
  table in redesign/contrast-table.md). Two tokens adjusted during the
  rebuild to pass: dark border.interactive lightened to #597D65, light
  danger darkened to #C23418.
- Layout: one-line 56px header, bottom tab bar on mobile with safe
  areas, container-query grids, coin page two columns with a sticky
  quote rail and a real SVG bonding-curve chart, the verdict stage as
  the single theatrical element.
- Money center: amounts render by magnitude (never 18-decimal dust),
  dust below the claim's own gas cost is grouped, labelled, and its
  claim button disabled; claims simulate before signing (Gate 9);
  sweep shows its read block.
- Wallet rebuilt on wagmi v3 + @wagmi/connectors: EIP-6963 discovery
  with one connector per announced wallet, four states, wrong-network
  switch flow with EIP-3085 fallback, silent reconnect. WalletConnect
  activates when a Reown project id is configured for this origin.
- Chain checker: 9134 is now described as what it is, GIWA's reserved
  but unreleased mainnet chain id (the reason the September 2026 drain
  looked official).
- Performance: the snapshot ships once (the in-bundle fallback copy is
  removed; the service worker cache is the offline copy). Initial JS
  24.0 KB gzip, CSS 4.2 KB gzip.
- Security: CSP in meta plus a `_headers` file for hosts that honour
  it, dependencies pinned exactly, service worker cache versioned per
  release with a kill switch.
- Prerendered static home and per-coin / per-creator share pages with
  subject OG images.

Rollback: redeploy the previous gh-pages commit (Slice A build, from
source commit bf2c7c1) or revert this release on main and redeploy.

## 1.0.0, 17 Nov 2026: Slice A

First live build: board, coin pages, creator passports, money center,
chain checker, methodology and dispute pages over the 7-factory index.
