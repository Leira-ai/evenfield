# Evenfield changelog

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
