# Evenfield audit against the new standard, and the redesign specification

Written 17 Nov 2026. Leira rejected the live UI/UX outright on 17 Nov 2026
("jelek banget"); the X post stays held until the look is worthy. This
document is the audit of the CURRENT live build
(https://leira-ai.github.io/evenfield/, Slice A as shipped 17 Nov 2026)
against the new permanent standard
(`~/workspace/custom-skills/web-product-engineering/SKILL.md`, gates cited
as G0-G12), plus a redesign specification ready to build from. The live
site is NOT changed by this document. Evidence: the build's own probe
screenshots (shot-1 home, shot-2 coin, shot-3 passport, shot-4 money,
shot-5 home ID, shot-6 mobile, shot-7 snapshot-only, shot-8 graduated),
viewed directly; src/style.css, src/main.ts, src/money.ts, src/chain.ts,
index.html, package.json; dist measurements; contrast ratios computed
with the WCAG relative-luminance formula.

## What is NOT defective (keep, do not rebuild)

The data layer is genuinely good and the redesign must not touch its
behaviour: the merged 7-factory index (133 launches, 42 creators), the
verdict engine with evidence drawers and explorer links, protocol-test
classification, the Glean money engine with planner-first + fallback +
simulation, the transport discipline (no batching, backoff, concurrency
3, cache successes only), the snapshot + 20s-budget delta design, the
three-state honesty in copy, EN/ID per-locale templates, and bundle-hash
equality between local build and live site. Every defect below is in
presentation, theming, states, wallet, performance or hardening. The
product failed as a designed object, not as an engine.

## Defects, worst first

### F1 (G0, G1) The visual direction is the generic AI default, item for item
The shipped look is warm cream #FFF7EA, one card type with one 18px
radius and a 2px tan border on everything, one soft visual weight from
hero to footer, no elevation system, no shadows, no surface layering.
This is precisely the "warm cream + SaaS-card kit" combination the
frontend-design skill lists as the most recognisable generated look, and
blueprint B6.3's own attempt to avoid the two previous rejections landed
in it because "bright and friendly" was specified as colours and card
shape, not as a system (no token scale, no elevation model, no density
variation). On screen the result reads as an outline drawing of an app:
every region is a bordered box of equal importance, so nothing is
important. The hero, the verdict and the claim buttons all carry the same
visual weight as a footer note.

### F2 (G1) There is no dark theme at all, and no theme system
One hard-coded light palette in :root; no data-theme, no color-scheme,
no prefers-color-scheme handling, no toggle, manifest theme-color fixed
to the cream. Leira's order (dark + light, dark default) is unmet in
full. Because colours are component-level values rather than semantic
tokens, adding a theme later means touching every rule; the CSS has no
layer structure either (single 142-line file, no @layer, no container
queries, one 640px breakpoint).

### F3 (G7) The money center prints raw wei-scale numbers and offers claims on dust
Screenshot shot-4: the totals line repeats "0.000000000000000001 WETH"
seven times; the Creator leftover and Pool revenue panels list 1-wei
rows (0.000000000000000001 WETH) each with a live coral Claim button, and
0.00002-unit rows beside them in the same format. No magnitude formatting,
no grouping by token, no dust threshold, no "worth less than the gas to
claim it" state. This violates the product's own copy rule (no number
without its meaning) in the most literal way and is the single most
amateur screen in the product. It is also a safety smell: a Claim button
that costs more than it returns trains users to sign without reading.

### F4 (G1, G4) Measured contrast failures in the current palette
Computed ratios (WCAG formula) for the shipped tokens:
- White text on the primary button coral #FF5C38: 3.07:1. Button text is
  bold 16px, which is NOT large text by the WCAG definition, so it needs
  4.5:1. FAIL. (The hover state #D63D1E passes at 4.62:1; the resting
  state is the failing one.)
- Link colour coral-dark #D63D1E on cream: 4.34:1. FAIL (needs 4.5:1).
- Focus indicator: 3px outline in amber #E8A13A on cream: 2.06:1 against
  adjacent colours. FAIL (needs 3:1, WCAG 1.4.11).
- Card/input border #EAD9BD on cream: 1.30:1. As pure decoration this is
  tolerable; as the ONLY boundary of inputs and cards it fails 1.4.11's
  3:1 for component boundaries, and visually it is why everything looks
  washed out.
- Passing: ink on cream 16.74:1, dim ink 5.87:1, ink on amber chip
  8.13:1, ink on green tint 15.67:1. The failures are concentrated in
  exactly the interactive colours: buttons, links, focus, borders.

### F5 (G2, G3) Mobile is an afterthought that its own QA could not see
The render check tested only 1100px and 390px. In the 390px screenshot
the header wraps into three rows (brand+nav, chain badge, language
toggle) and consumes roughly a quarter of the first screen before the
headline; the search input's placeholder is visibly truncated ("...wallet
addres"); the blueprint's own mobile rule (three stage lanes as a
horizontal swipe with position markers) was never implemented, stages
stack vertically instead. Nothing was tested at 320px (small Android,
fold cover), 360px (mainstream Android), 430px, tablets, or any foldable
posture. No bottom navigation, no safe-area handling, no throttled
low-end run.

### F6 (G8) Wallet connect is a stub that excludes mobile and multi-wallet users
src/money.ts connectWallet(): raw window.ethereum only. No EIP-6963
discovery (breaks or picks arbitrarily with several extensions), no
WalletConnect (every regular mobile browser user is locked out), no
in-app-browser consideration, no four-state UI (the button just throws
coded errors: NO_WALLET and friends), no accountsChanged/chainChanged
handling, no reconnect persistence, and connect exists only inside the
money center rather than as a global header element with chain and
wrong-network states. It force-switches chains inside a try/catch and
adds the chain from a hard-coded profile, which happens to be safe here
only because the profile is ours; the pattern has no attested-catalog
check and no user-facing wrong-network explanation.

### F7 (G5) Performance: the bundle and the triple-shipped snapshot
dist JS is 898,459 bytes raw / 217,410 gzip (over the 200KB gate), CSS
6.8KB. snapshot.json (258,758 bytes) is shipped three times: public/,
dist/, and embedded as src/fallback-snapshot.json inside the JS bundle,
~776KB of identical data. First paint is a plain text "Loading
Evenfield..." inside a lone <main>; there is no prerendered HTML for any
route, so LCP waits on the full bundle and no-JS visitors and crawlers
get nothing. Fonts load from the Google Fonts CDN as a render-blocking
stylesheet (third-party dependency, no self-hosting, no subsetting).

### F8 (G7) No designed loading, skeleton, or progress states
No skeleton anywhere. The board pops in when the snapshot lands; the
money center's cold sweep (measured ~7 minutes in a fresh browser) shows
a single progress line above a wall of panels that fill in place, with no
per-panel skeleton and no time expectation set. Empty states exist as
copy (good) but were never given a designed form: dashed-border box, same
as every other box (see F1).

### F9 (G6) Security hardening gaps for a page that asks for signatures
- No CSP anywhere (no header possible on GitHub Pages, and no meta CSP
  either), no Referrer-Policy meta, no _headers file shipped for a
  future host. For a page whose money center requests wallet signatures,
  a single DOM injection would have no second wall.
- XSS posture rests entirely on a hand-rolled esc() used across 30+
  innerHTML template writes in main.ts. It held in review, but it is one
  missed interpolation away from failure, and token names/symbols are
  attacker-controlled strings by design. No audit list of raw-HTML sinks
  exists.
- viem is declared as ^2.33.0 (a caret range) in package.json while the
  SDK is pinned exact; the lockfile currently saves this, but the
  declared policy contradicts the pin-everything rule.
- The service worker caches same-origin GETs cache-first under the fixed
  name 'evenfield-v1' and the shell list includes snapshot.json; without
  a per-release cache bump, a returning visitor can be pinned to a stale
  build, and the SW becomes a persistence risk if the origin is ever
  compromised.
- Address display truncates to first 6 + last 4 (0x25e0...7926) with no
  one-tap full-address view, under the address-poisoning evidence bar.

### F10 (G11) Sharing and SEO are absent
No Open Graph or Twitter card tags at all, no per-route titles (one
global title), no prerendered coin/creator pages, so the blueprint's own
share-card plan produces naked links. No canonical. theme-color ignores
any future dark theme.

### F11 (G0, G1) Typography and spacing are unscaled
Type sizes in the CSS: 24, 22, 20, 19, 18, 17, 16, 14, 13.5, 13, 12.5px,
chosen per component, not from a ratio; weights jump between 600/700/800
without roles. Spacing values include 6, 10, 12, 14, 18, 34px, off any
grid. Headings are the same 800 weight at several sizes, so hierarchy is
carried by size accidents rather than a system; the coin page's key facts
("Where this coin stands") render as an undifferentiated stack of plain
text lines inside a bordered box, with no data treatment at all (no
stat blocks, no tabular numerals role, no chart of the curve the page
exists to show).

### F12 (G10) Product surfaces the blueprint promised are visually missing
Watchlist exists in localStorage plumbing but has no designed presence;
the weekly recap is a stats line, not a surface; the chain badge is a
pill that wraps the header (F5) instead of a designed trust element; the
verdict drawer, the product's best idea, is visually indistinguishable
from every other bordered box, so the "receipts" moment has no stage.

---

# Redesign specification (build-ready; do not start without Leira's go)

## R1 Direction in one paragraph
"Field at dusk": a deep green-tinted charcoal product with layered
surfaces, one bright mint action colour, warm signal colours kept for
verdicts only, Jakarta Sans set on a strict scale, cards that separate by
surface lightness instead of outlines, and exactly one theatrical
element: the verdict moment (chip + evidence drawer) gets the glow and
the space. The light theme is the same field at noon: warm paper, white
surfaces, deep green ink, the same mint darkened for contrast. Friendly
comes from words, spacing and the avatar/illustration system, not from
cream and roundness.

## R2 Tokens (computed pairs verified 17 Nov 2026; the Gate 1 script must re-verify at build)

Dark (DEFAULT):
- canvas #0D130F; surface.1 #141D17 (cards); surface.2 #1B2820 (raised,
  hover); surface.3 #24352A (menus, drawers); overlay #2C4234 (modals)
- border.subtle #26362B (decorative separation only, 1.47:1 by design;
  never the sole boundary of an interactive element);
  border.interactive #54755F (inputs, chips: 3.36:1 on surface.1,
  3.66:1 on canvas)
- text.1 #EDF4EE (16.81:1 on canvas); text.2 #AEC2B2 (9.99:1 canvas,
  9.16:1 surface.1); text.3 #7E937F (5.70:1 canvas; large/disabled only)
- action #2FD68A with text #052418 (8.73:1); action.hover #4BE39E;
  link #6FE3AC (10.89:1 on surface.1); focus ring #8CF0BC (12.57:1)
- success #3ECF7B (8.55:1); warning text #F0B24A (9.17:1), warning fill
  #F0B24A with ink #1C1710 (9.47:1); danger text #FF9D85 on danger tint
  #3A1D16 (7.62:1), danger plain #FF7A5C (6.73:1)

Light:
- canvas #F6F4EC; surface.1 #FFFFFF; surface.2 #FBFAF5; surface.3
  #F0EEE3; border.subtle #E0DCCE (decorative only); border.interactive
  #8A8567 (3.39:1 on canvas; on white use #7A755C, 4.64:1)
- text.1 #16211A (15.06:1); text.2 #4E5D52 (6.97:1 on white); text.3
  reserved for large text only (best candidate 4.46:1, so never body)
- action #0B7A55 with white text (5.34:1); hover #09684A; link #0B6B4A
  (5.93:1); success #177A46 (4.88:1); danger #C93A1E (4.64:1); warning
  fill #F5C15C with ink #3A2A05 (8.37:1); focus #0B7A55 (4.85:1)

Type: Plus Jakarta Sans, self-hosted subset, weights 400/500/600/700/800.
Scale (1.25): caption 12/16, small 14/20, body 16/24, lead 20/28,
h3 24/30, h2 30/36, display 39/44 (clamp 30-39 fluid). Numerals tabular
via font-variant-numeric; addresses and hashes in ui-monospace (Decision
D7 security exception). Spacing tokens 4/8/12/16/24/32/48/64 only.
Radius: sm 8 (inputs, chips inner), md 12 (buttons, small cards), lg 16
(cards), xl 24 (hero panels, drawers), pill 999 (chips, primary buttons).
Elevation: dark = surface steps above + 1px border.subtle; light = the
same borders + shadow.1 0 1px 2px rgba(22,33,26,.06), shadow.2 0 8px 24px
rgba(22,33,26,.08) for drawers/modals only.

## R3 Layout system
- Page width 1200px, gutters 16 (mobile) / 24 (desktop). Header: one row,
  56px, sticky, blur surface.3 at 92% opacity; contains brand, primary
  nav (Board, Money, Chain check, More), chain badge (compact, icon +
  "GIWA Sepolia 91342"), theme toggle, language toggle, and the global
  wallet button (Gate 8 four states).
- Mobile: header collapses to brand + wallet + menu; primary nav becomes
  a bottom tab bar (Board, Money, Chain, Verdicts info, More) with
  safe-area padding; primary actions anchor above it.
- Board: stage sections as container-query grids (cards 1 col < 560px
  container, 2 col < 900, 3 col above), section headers carry the stage
  name, a one-line meaning, and a count; density alternates (board grid,
  then a full-width recap band on surface.2, then passports strip).
- Coin page: two columns >= 1024px (main: verdict stage, curve chart,
  evidence, passport summary; sticky rail 360px: quote card, sell-back,
  creator chip); single column on mobile with the quote card first after
  the verdict chip. The curve gets a real SVG price/progress chart from
  snapshot data; "Where this coin stands" becomes stat blocks (label,
  tabular value, one-line meaning), never a text stack.
- Verdict stage: the drawer is a surface.3 panel with a left accent rule
  in the verdict colour, each evidence row = claim sentence + mono hash
  link + explorer icon; opening animates height (reduced-motion safe).

## R4 Component list (each with all Gate 7 states designed)
AppHeader, BottomTabBar, ChainBadge, ThemeToggle, LangToggle,
WalletButton (4 states) + WalletSheet (picker: 6963 list, WalletConnect
QR/deep link, wrong-network panel), SearchBox (with results popover),
StageSection, CoinCard (avatar with generated identicon from curve
address, stage pill, verdict chip, reason sentence, progress meter,
buyers line), VerdictChip (icon + label, 5 kinds), VerdictStage +
EvidenceDrawer, StatBlock, QuoteCard (input, live quote, sell-back,
block stamp, timeout fallback state), PassportCard + PassportPage,
MoneyRow (grouped by token, magnitude-formatted, dust state with
disabled action), MoneyPanel (per-stream skeleton rows), ChainChecker
(three verdict panels), RecapBand, SkeletonCard/SkeletonRow, EmptyState,
ErrorState, StaleBanner, ToastRegion, DisputeForm, CorrectionLog,
ShareCard templates (OG 1200x630 per route type).

## R5 Wallet, security, performance work the redesign must include
- Replace connectWallet with the Gate 8 stack (wagmi current + connectors,
  EIP-6963 + WalletConnect, custom UI in our tokens); move connect to the
  header; implement the four states and event handling; testnet action
  test in a mobile in-app browser and a WalletConnect session.
- Meta CSP + Referrer-Policy + shipped _headers; replace esc()-and-pray
  with escaped-by-default templating and a written sink audit; pin viem
  exact; SW cache name per release + kill-switch; full-address view on
  every truncated address.
- Split the bundle: route-level code splitting so first load <= 200KB
  gzip; snapshot fetched once (the in-bundle fallback is dropped; the
  service worker's cached snapshot is the offline copy, and the stale
  banner covers the gap); prerender home + coin + passport HTML (also
  delivers OG tags per route); self-host fonts.
- Money center: group claimables by token, magnitude formatting per
  Gate 7, dust threshold = estimated claim gas at current gas price,
  per-panel skeletons and an honest expected-duration line for cold
  sweeps ("a first full check takes a few minutes; results stay cached").

## R6 The QA matrix the rebuild must pass (Gate 2 applied)
Playwright against the live URL, bundle hash verified: widths 320, 360,
390, 430, 768, 1024, 1280, 1440, 1920 plus fold pair (344 cover, 717
open); dark at all widths, light at 390/768/1280 minimum; every
screenshot viewed by the builder; flows: home (snapshot, snapshot-only
with RPC blocked, delta pending), coin (live quote, quote timeout,
no-quote), verdict drawer open, passport (rich + thin), money (cold
sweep progress, dust state, connected claim simulation), chain checker
(91342 / 9134 / unknown), wrong-network connect, EN and ID at 320px;
axe-core zero critical/serious; throttled mobile run (4x CPU, Fast 3G)
on home and coin; keyboard-only pass on the demo path. Any failure is
reported to Leira by gate number before anything else.

## R7 Sequencing note
R2-R4 are one build (theme + layout + components). R5 wallet and
hardening can land in the same pass because the header changes anyway.
Phase 1B features (Launchparty wizard, Potluck designer) are built AFTER
this redesign passes, directly in the new system; building them into the
current CSS would double the work and repeat the rejection.
