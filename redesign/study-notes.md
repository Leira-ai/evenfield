# Study notes: how to build web products properly (UI/UX, frontend, backend, security, wallet, GIWA)

Compiled 17 Nov 2026 on Leira's order after she rejected Evenfield's UI/UX.
Method per her standing rule (17 Nov 2026): current web sources first, built-in
knowledge second. Every section lists sources with dates/versions, and flags
where a current source contradicts older built-in knowledge. The permanent
skill `~/workspace/custom-skills/web-product-engineering/SKILL.md` distills
these notes into hard gates; rule numbers there trace back to sections here.

---

## 1. Design systems, tokens, hierarchy, type, spacing

- A design is a token system, not a pile of CSS values. Tokens are named by
  function (`color.text.secondary`), never by appearance (`color.grey-500`
  used directly in components). (Wavespace design-system guide, 2026;
  ForgeHouse visual design foundations, 2026.)
- Modular type scale: pick a ratio, derive every size. Major Third 1.25 from
  a 16px base gives 12, 14, 16, 20, 24, 30, 36, 48. Most interfaces need
  only 6-8 sizes. Line height 1.4-1.6 for body, 1.1-1.3 for headings.
  (uxatom visual design basics, Nov 2026; thedigilearners hierarchy
  blueprint, 10 Nov 2026.)
- 8-point spacing grid with a 4px half-step: 4, 8, 12, 16, 24, 32, 48, 64.
  Every margin, padding and gap is one of these. Arbitrary values (10, 14,
  18, 34) are the visible signature of an undesigned page. Proximity rule:
  space inside a group is tighter (8-16) than space between groups (24-40);
  heading top margin is 2-3x its bottom margin. (Same sources as above.)
- 60-30-10 colour distribution: ~60% neutral background, ~30% secondary
  surfaces, ~10% accent, reserved for actions and key states. Kept, tonally
  inverted, in dark mode. (ForgeHouse, 2026.)
- Hierarchy tools, strongest to weakest: size, weight/contrast, colour,
  position, whitespace. Secondary text steps back by colour token, not by
  shrinking below readable size. (uxatom, Nov 2026.)
- Section density must vary down the page; no two consecutive sections at
  the same visual weight, and never one card type carpeted across the whole
  page. Mix at least three component primitives. (ForgeHouse, 2026.)
- Local skill `frontend-design` adds the failure catalogue this study keeps
  confirming from the outside: the warm-cream background (#F4F1EA family)
  with clay accent is now the single most recognisable AI-generated look;
  so is the SaaS-card kit (identical rounded cards, one radius everywhere,
  same soft shadow), tracked-out ALL-CAPS eyebrows, and mono fonts for data
  labels. Evenfield's shipped palette (cream #FFF7EA, one 18px radius, one
  card type) is that catalogue, item for item.

## 2. Theming: dark and light from one token set

- Never pure black (#000000) as a dark canvas and never pure white text on
  it: 21:1 contrast causes halation and eye fatigue, and pure black leaves
  no room to go deeper for shadows or overlays. Industry baseline canvas is
  dark charcoal #121212, tinted 2-5% toward the brand hue. (Material Design
  dark theme guidance, summarised in ColourIntell dark mode guide, 2026;
  colorpickerweb dark mode masterclass, 2026.)
- Dark elevation is lightness, not shadow (shadows are invisible on dark):
  base #121212 + white overlay steps of about 5% (cards, #1E1E1E), 9%
  (menus, #272727), 15% (modals, #353535). Higher surface = lighter.
  (ColourIntell, 2026; MD3 surface tables in Intense-Visions dark-mode
  skill, 2026.)
- Accents must be re-derived for dark: reduce saturation 10-20% and raise
  lightness 15-25% (or pick the 300-400 step of the same hue scale). The
  light-mode brand colour used raw on dark vibrates and usually fails
  contrast. (ColourIntell, 2026; usetoolsuite dark palette guide, 2026.)
- Dark text tiers by opacity: primary 87% white, secondary 60%, disabled
  38%; primary then exceeds 7:1, secondary exceeds 4.5:1. (Material tiers,
  via Intense-Visions, 2026.)
- Mechanism in current CSS: one semantic token set, two value maps.
  `color-scheme: light dark` plus the `light-dark()` function is Baseline
  Newly Available (Chrome 123, Firefox 120, Safari 17.5); a
  `[data-theme="dark"]` attribute override on top of tokens is the robust
  pattern, with a pre-paint inline bootstrap script (hashed into the CSP)
  so a saved dark choice never flashes light. Default for our products is
  dark (Leira's standing order, 17 Nov 2026); a stored manual override
  beats the default; `prefers-color-scheme` is honoured only as the
  first-visit tiebreak on products where no default has been ordered.
  The choice between mechanisms is recorded as Decision D1 in section 14.
  (Baseline status: webstatus.dev via Wunderlandmedia Baseline 2026
  roundup, Oct 2026; mdskill modern-css, mid-2026.)

## 3. Accessibility: WCAG 2.2 AA is the current floor

- WCAG 2.2 is the current Recommendation (W3C, 5 Oct 2023; also published
  as ISO/IEC 40500:2025). WCAG 3.0 is still a Working Draft (10 Sep 2026)
  and is NOT a conformance target. Older habit of citing "WCAG 2.1" is out
  of date. (W3C via chwezi-design-engine WCAG 2.2 criteria reference, 2026.)
- Contrast (1.4.3 AA): body text 4.5:1; large text (>=24px, or >=18.66px at
  weight >=700) 3:1. Non-text (1.4.11 AA): UI component boundaries, input
  borders, meaningful icons, focus indicators 3:1 against adjacent colours.
- Target size: 2.5.8 (new in 2.2, AA) floor is 24x24 CSS px, but Apple HIG
  44pt and Material 48dp remain the practical touch standard; ship 44px
  minimum for primary touch targets. (WCAG 2.2 references above; uxbyissa
  WCAG thresholds table, 2026.)
- Focus: 2.4.7 visible indicator (AA); 2.4.11 Focus Not Obscured (new in
  2.2, AA): a sticky header must never fully hide the focused element, fix
  with `scroll-padding-top`. 2.4.13 Focus Appearance (AAA) sets the quality
  bar worth adopting: >=2px perimeter, >=3:1 against the unfocused state.
- Meaning never by colour alone (1.4.1): pair every status colour with an
  icon and a text label. `prefers-reduced-motion` disables non-essential
  animation. Every interactive element reachable and operable by keyboard,
  in a logical order (2.1.1, 2.4.3).

## 4. Performance: Core Web Vitals, unchanged thresholds, hard budgets

- Thresholds are unchanged and confirmed current in Oct 2026 roundups:
  LCP <= 2.5s, INP <= 200ms (INP replaced FID on 12 Mar 2024), CLS <= 0.1,
  judged at the 75th percentile of real visits, mobile and desktop
  separately. (web.dev / Search Central, via involvedigital CWV guide,
  updated 30 Sep 2026, and digitalmatters CWV reference, Oct 2026.)
- Reality check: only 48% of mobile sites pass all three (HTTP Archive Web
  Almanac 2025, CrUX July 2025 data). LCP is the usual failure (62% good).
- Product budgets we adopt (stricter than "passing", because our pages are
  small): initial JS <= 200KB gzip, CSS <= 30KB gzip, total first-load
  transfer <= 600KB excluding snapshot data; snapshot/data JSON <= 300KB
  and never duplicated inside the JS bundle; LCP element is server-rendered
  or static HTML, never waiting on the JS bundle; fonts self-hosted or
  `font-display: swap` with a metric-matched fallback to hold CLS at 0.
- Evenfield today, measured from its own dist: JS 898,459 bytes raw /
  217,410 gzip (over budget), and snapshot.json (258,758 bytes) shipped
  three times: as public/snapshot.json, in dist, and embedded as
  src/fallback-snapshot.json inside the bundle. That is ~776KB of the same
  data before the app does anything.

## 5. Modern CSS and frontend engineering (Baseline status checked Nov 2026)

- Container queries: Baseline Widely Available since 14 Aug 2025. Cards
  should respond to their container, not the viewport; this replaces most
  breakpoint-per-component hacks. (Wunderlandmedia Baseline 2026, verified
  against api.webstatus.dev, Oct 2026.)
- Cascade layers (@layer): Widely Available since 14 Sep 2024. Declare the
  layer order once (reset, base, theme, components, utilities) and
  specificity wars end structurally. Native nesting, :has(), subgrid:
  Widely Available. (Same source; zvoque CSS playbook, verified June 2026.)
- View Transitions: same-document transitions became Baseline Newly
  Available 14 Oct 2025 (Firefox 144 was the last engine). Cross-document
  transitions are NOT in Firefox: progressive enhancement only, behind
  @supports, never load-bearing. One 2026 source loosely calls
  same-document transitions "widely available"; the dated Baseline record
  says Newly Available, and we follow the dated record.
- Scroll-driven animations: still Limited (no Firefox). Enhancement only.
- @scope and style queries: Newly Available Dec 2025 / May 2026. Optional.
- CONTRADICTION with older built-in knowledge: container queries, @layer,
  :has() and nesting were "experimental, avoid" in older training data.
  Current Baseline says ship them unguarded. Follow Baseline.
- Semantic HTML first: header/nav/main/footer landmarks, one h1 per view,
  real buttons and links, lists for lists. Evenfield renders its whole app
  into a single <main id="app"> with JS template strings, so no-JS and
  pre-hydration states show only "Loading Evenfield..." and crawlers see
  nothing. Prerendered static HTML per route (the blueprint already wanted
  prerendered coin/creator pages for OG previews) fixes SEO, LCP and the
  no-JS state at once.
- State management discipline for vanilla apps: a single render-from-state
  function per view is fine at our scale; what is not fine is 30+
  innerHTML writes with hand-rolled escaping as the only XSS defence (see
  section 7). Prefer DOM building (createElement/textContent) or a tiny
  templating helper that escapes by default and makes raw HTML an explicit,
  reviewed exception.
- Tooling floor: TypeScript strict, Vite (current 5.x/6.x line at build
  time; pin exact), lockfile committed, `npm ci` in CI, Playwright e2e +
  screenshot (visual regression) suite, axe-core accessibility scan in CI,
  Lighthouse CI budget assertions. A build that passes tsc but is never
  rendered is not verified (the standing lesson from Slipway and Glean).

## 6. All-device support

- Viewport matrix we test (Playwright devices + real CSS widths): 320
  (small Android, Galaxy Fold cover ~344), 360 (mainstream Android), 390
  (iPhone 14/15), 430 (iPhone Pro Max), 768 (iPad portrait), 1024 (iPad
  landscape / small laptop), 1280, 1440, 1920, 2560 (ultrawide). Foldables:
  test both postures (cover ~344px and open ~717-1812px); a layout that
  only knows "phone" and "desktop" breaks in the open posture.
- Evenfield's own render check used only 1100px and 390px. Two widths is
  not a device matrix; defects at 320 (truncated search placeholder,
  visible in its own mobile screenshot) shipped anyway.
- Touch: 44px minimum targets (section 3), 8px minimum gaps between
  targets, no hover-only interactions, thumb-reach primary actions on
  mobile (bottom navigation or bottom-anchored actions, not a 3-row
  wrapped top bar).
- Low-end reality: throttle checks at 4x CPU slowdown + Fast 3G (Lighthouse
  mobile preset) on the heaviest view; long tasks under 50ms; lists over
  ~100 rows virtualised or paginated. Slow-network behaviour is a designed
  state (section 10), not an accident.
- Browser coverage: current Chrome/Edge, Firefox, Safari (Baseline
  engines). Anything beyond Baseline Widely Available ships as progressive
  enhancement behind @supports.

## 7. Security: OWASP Top 10:2025 (the list changed; update every checklist)

- The current list is OWASP Top 10:2025, finalised late 2025 (eighth
  edition; final commit 24 Dec 2025). CONTRADICTION with older knowledge:
  most training data and most internet checklists still cite the 2021
  numbering. The 2025 list: A01 Broken Access Control (now absorbs SSRF),
  A02 Security Misconfiguration (up from #5; missing security headers are
  named explicitly), A03 Software Supply Chain Failures (up from A06 and
  much wider: poisoned packages and build/distribution compromise, not
  just outdated components), A04 Cryptographic Failures, A05 Injection
  (includes XSS), A06 Insecure Design, A07 Authentication Failures,
  A08 Software or Data Integrity Failures, A09 Security Logging and
  Alerting Failures, A10 Mishandling of Exceptional Conditions (NEW: code
  that fails open or leaks detail in errors). (OWASP via Imperva OWASP Top
  10:2025 guide, Oct 2026; Scanverra and sechb change logs, Sep-Oct 2026.)
- Applied to a static-plus-API product like ours:
  - A05/XSS: all chain data is untrusted input. Token names, symbols and
    creator metadata come from anyone's contract and are the classic DOM
    XSS vector in Web3 frontends. Escape by default; audit every raw-HTML
    sink; a CSP is the second wall, not the first.
  - A02/headers on GitHub Pages: Pages cannot send custom response
    headers at all. A <meta> CSP works EXCEPT frame-ancestors, report-uri
    and sandbox (ignored in meta); Referrer-Policy works as meta; HSTS,
    X-Frame-Options, X-Content-Type-Options, Permissions-Policy are
    header-only and impossible on Pages (Pages does force HTTPS and sends
    its own HSTS on *.github.io). Pages also fixes Cache-Control:
    max-age=600 on everything. The real fix when headers matter:
    Cloudflare in front (Transform Rules) or a host that reads a _headers
    file (Cloudflare Pages, Netlify). Ship the _headers file anyway so the
    posture moves with the host. (indie.pi3.in security headers field
    guide, Oct 2026; yourlocalunemployed GitHub Pages migration post,
    Jul 2026; everything-free deployment docs, Sep 2026.)
  - A03/supply chain: pin every dependency exactly (--save-exact), commit
    the lockfile, npm audit in CI, no install scripts from strangers,
    verify the deployed bundle hash equals the local build (Evenfield
    already does this; keep it). The Bybit loss (Feb 2025, ~$1.5B) was a
    frontend supply-chain injection into Safe{Wallet}'s hosted JS that
    swapped the transaction payload at signing time; contracts were fine.
    (Chainalysis 2025 figures via crypto.myprivacy.blog, 2026; Oak Security
    browser and wallet hardening guide, Jun 2026.)
  - A10/fail closed: on any error the product degrades to a labelled stale
    or read-only state, never to a fabricated zero or an optimistic
    success. (This is also our blueprint's three-state honesty rule.)
  - Secrets: none in the repo, none in the bundle, none in localStorage
    beyond non-secret preferences. WalletConnect project IDs are public
    identifiers, not secrets, but must be origin-locked in Reown Cloud.
  - Service worker: a stale or poisoned SW is a persistence mechanism for
    an attacker. Version the cache, never cache wallet responses or POSTs,
    and ship a kill-switch path (a new SW that clears caches) with every
    release. Evenfield's SW caches same-origin GETs cache-first with cache
    name 'evenfield-v1'; if the name is not bumped per release, returning
    visitors can be pinned to an old build indefinitely.

## 8. Web3 frontend security (2025 loss data, not folklore)

- Most real losses come from signatures, not contract bugs. Scam Sniffer
  counted $83.85M lost to wallet-drainer phishing in 2025 (106,106
  victims); Permit / Permit2 and other EIP-712 off-chain signatures caused
  38% of losses in cases over $1M. (Scam Sniffer 2025 annual data, via
  crypto.myprivacy.blog, 2026.)
- Address poisoning: a USENIX Security 2025 study found 270M poisoning
  attempts against 17M victims on Ethereum and BNB Chain, >=$83.8M lost.
  Frontend duties: never truncate an address so aggressively that first4/
  last4 lookalikes pass (Evenfield shows 0x25e0...7926 in its coin page),
  always offer full-address copy/verify, and warn when a pasted address
  differs from the connected one. (USENIX 2025 via pixelwebsolutions
  wallet features reference, 2026.)
- Blind signing is the failure mode: if the UI cannot decode and display
  what a signature does, the user is trusting the page, and the page is
  what an attacker compromises. Product rules: simulate every transaction
  (eth_call) and show the decoded effect in plain words before any signing
  request; exact-amount approvals by default, unlimited approval only
  behind an extra explicit warning; never request eth_sign; typed data
  shown structured, never as raw hex. (Oak Security hardening guide, Jun
  2026; on_chain_safety_rails skill, local.)
- Untrusted RPC data: a public RPC is an untrusted input source. Validate
  shapes and ranges before rendering (Evenfield already bounds a quote
  estimate by total supply after a real defect), cross-check critical
  numbers (balances, claimables) on a second read path when they drive a
  claim button, and label the block height of every figure.

## 9. Wallet connect, current state (Nov 2026)

- Discovery: EIP-6963 (Multi Injected Provider Discovery) is the standard.
  Wallets announce via `eip6963:announceProvider`; the dApp listens and
  offers a picker. Assuming `window.ethereum` is the wallet is the old
  habit and breaks with multiple extensions installed. wagmi v2+ discovers
  6963 providers automatically (`multiInjectedProviderDiscovery`, default
  true). (Trust Wallet developer docs, 2026; cryptoskills frontend-ux
  production patterns, 2026; Sky Mavis/Ronin EIP-6963 tutorial, 2026.)
- Connection is a four-state machine, not a button: disconnected,
  connecting, connected, wrong-network. Each state has its own UI; the
  wrong-network state names the required chain and offers the switch.
  (cryptoskills frontend-ux, 2026.)
- Chain management: `wallet_switchEthereumChain` (EIP-3326) first; on
  error 4902 (chain unknown to the wallet) fall back to
  `wallet_addEthereumChain` (EIP-3085) with name, RPC, explorer, currency
  from our own verified chain profile, then switch again. Listen to
  `accountsChanged` and `chainChanged`; persist the last connector (not
  the address as a credential) for silent reconnect; a real Disconnect
  clears it. (EIP-3326/3085 as implemented across wallet docs above.)
- Mobile is a different product surface: on mobile the wallet is often the
  browser (in-app browsers inject a provider), or the connection goes
  through WalletConnect v2 (Reown) with QR on desktop and deep links on
  mobile. A connect flow that only handles injected desktop providers
  silently excludes most mobile users. Test inside MetaMask Mobile's
  in-app browser before calling mobile done. (cryptoskills, 2026.)
- Current stack versions, checked Nov 2026: wagmi 3.7.x is the current
  line (3.7.6/3.7.7 in Oct-Nov 2026 integration docs), viem 2.55/2.56.x.
  wagmi v3 breaking note: `useBalance` no longer returns `formatted`;
  format with viem `formatUnits`. Connect kits: RainbowKit 2.2.11
  (May 2026) still supports wagmi v2 ONLY; ConnectKit 1.9.2 (Mar 2026)
  also wagmi v2 with a v3 version in progress; Reown AppKit 1.8.x is the
  WalletConnect house kit, wagmi v3 support only in beta
  (2.0.0-wagmi-3.0), and AppKit is source-available under the Reown
  Community License (free up to 500 monthly active users), not open
  source. (wyllet.dev connect-kit comparison, Oct 2026; Reown wagmi-3
  migration doc, Nov 2026; Whitechain docs pinned-version table, updated
  26 Oct 2026.)
- SIWE (EIP-4361) is for proving account control to a backend session; a
  read-only or chain-only product does not need it, and asking for a
  signature "just to browse" is an anti-pattern that trains users to blind
  sign. Only request signatures for actions.
- Evenfield today: `connectWallet()` in src/money.ts uses raw
  `window.ethereum` only. No EIP-6963, no WalletConnect, no mobile path,
  no accountsChanged/chainChanged handling, no reconnect persistence, no
  wrong-network state (it force-switches or throws), and the connect
  button exists only inside the money center. By the four-state standard
  this is a demo stub, not a connect implementation.

## 10. Backend, data pipeline, APIs for products like ours

- Our shape is static-plus-pipeline: the chain is the database of record,
  a CI-built snapshot is the read model, the browser delta-syncs. This is
  a legitimate architecture at testnet scale IF its limits are engineered:
  snapshot carries block watermark + build time; publish is atomic (a
  failed build never replaces the last good snapshot); the client treats
  snapshot age as UI, not as a debug detail. Evenfield does most of this;
  its gap is operational (a full build took ~19-45 min under RPC load in
  CI's 6h cadence) and presentational (staleness copy exists, design does
  not honour it).
- RPC discipline is documented by the protocol itself now: Ammora's
  official examples set `AMMORA_RPC_INTERVAL_MS=600`, serialising public
  calls against the GIWA public RPC. Our proven transport rules (no viem
  batch:true, concurrency ~3, exponential backoff + jitter, cache only
  successes, 10,000-block getLogs chunks) match the primary source.
  (Ammora partner quickstart, ammora-docs, Nov 2026.)
- When a real backend arrives (mainnet phase), the non-negotiables:
  API keys/secrets server-side only; per-IP and per-address rate limits;
  idempotency keys on any POST that can be retried; sessions as httpOnly,
  Secure, SameSite cookies, never localStorage tokens; structured logs
  with request IDs and alerting on error-rate change (OWASP A09:2025);
  daily backups with a tested restore; health endpoint + uptime check;
  CORS allowlist of exact origins; every list endpoint paginated with a
  hard max page size.
- Caching strategy by layer: hashed static assets immutable (the host
  limits this on GitHub Pages, section 7), snapshot JSON short-cache with
  watermark validation, browser cache of chain reads keyed by
  (address, block) so a number is never shown without the height it was
  true at.

## 11. GIWA and Ammora: current state, checked Nov 2026

- GIWA mainnet is STILL not live. GIWA's official account posted on
  27 Sep 2026 "We DO NOT have our mainnet running currently"; docs list
  only GIWA Sepolia (chain 91342, RPC https://sepolia-rpc.giwa.io,
  explorer sepolia-explorer.giwa.io, OP Stack, 1-second blocks, ETH gas).
  Dunamu and the Optimism Foundation signed an MoU in May 2026 (GIWA as
  first Self-Managed OP Enterprise chain); mainnet "planned", no date.
  (GIWA via sigintzero incident report, Sep 2026; argusnodes GIWA chain
  sheet reviewed 16 Sep 2026, RPC checked 2 Nov 2026; BlockVar GIWA
  testnet guide, Oct 2026.)
- The fake-chain incident, with the detail that matters for our checker:
  on 26 Sep 2026 an attacker deployed a real OP Stack chain using ID
  9134, which is GIWA's RESERVED mainnet chain ID in the public
  ethereum-lists registry (the registry entry itself says the mainnet has
  not launched). A DEX integrated it within minutes of GIWA's denial post
  and ~766 ETH was drained through its bridge; Korea's FSS issued a
  consumer caution on 22 Oct 2026. Lesson for the checker page: a matching
  chain ID is NOT proof of the real chain; the registry reservation is
  precisely what made the fake look official. Our checker must verify
  against the SDK's attested deployment catalog and say "reserved, not
  launched" for 9134, not merely "fake". (sigintzero, Sep 2026;
  advancedsecurity.club fake-network guide, Oct 2026, citing FSS, Upbit
  and GIWA primary posts.)
- GIWA Sepolia protocol maintenance continues: Upgrade 19 (Karst)
  activated 6 Jul 2026 (Osaka EVM, fault proofs moved to CANNON_KONA);
  op-geth support ended 31 May 2026. Frontend relevance: none directly,
  but it proves the testnet is a moving target and SDK/chain pins need a
  review cadence. (argusnodes, Sep 2026.)
- Ammora SDK: 0.3.9 is still npm latest, reviewed by Ammora's own docs on
  2026-11-04; @ammora-protocol/math stays 0.3.0. Docs instruct
  `npm install --save-exact @ammora-protocol/sdk@0.3.9`. No new version to
  migrate to; our exact pin is correct and current. Docs also confirm:
  creating a valid Config needs no per-team Ammora approval (matches our
  Phase 0 simulation result, configId 43). (ammora-docs SDK status page,
  reviewed 2026-11-04; launchpad and partner quickstart guides, Nov 2026.)

## 12. Benchmarks: what the top Web3 products actually do

- Uniswap (interface): one job per screen, the swap card is the product;
  everything else is quiet. Consistent token colours, restrained accent
  (one brand pink), generous radius on ONE hero component rather than
  every element, plain-language state copy. The lesson is restraint and
  a single focal component, not the palette. (Clay Web3 design principles,
  2026; prateeksha finance design survey, Oct 2026.)
- pump.fun / GMGN (terminals): dark by default, dense but gridded data,
  colour reserved for signal (up/down, verdicts), monospace numerals for
  scanning prices, near-zero decoration. Traders read them 8 hours a day;
  the design serves scanning speed. The lesson for our board: density is
  fine when it is gridded and signal-coloured; what fails is density
  without a grid (our current cards) or friendliness without information
  (our current card text repeats one template sentence per coin).
  (2026 design showcases of pump.fun and GMGN interfaces; GMGN's own
  check-first positioning from our round-2 competitor study.)
- Rainbow / Phantom (wallets): friendly does not mean cream and rounded
  everything; it means a mascot/illustration system, plain words, and
  state clarity (what will happen if I tap this) at consumer scale, on
  dark or light surfaces with real elevation. (prateeksha survey, 2026.)
- Linear effect (adjacent benchmark): dark UI reads premium when surfaces
  are layered by lightness, borders are 1px and low-contrast, glow is
  used once for the primary action, and type is tight and small rather
  than big and friendly. This is the direct counter-model to Evenfield's
  2px tan borders on cream. (prateeksha survey, Oct 2026.)
- Aave's 2024-25 direction is the counter-counter-example: a major DeFi
  brand moved toward light, pastel, whitespace. Dark-by-default is
  Leira's order for our products and the trading-terminal norm, but it is
  a product decision, not a law of quality; the light theme must be
  designed to the same standard, not generated by inversion. (2026 DeFi
  redesign case notes.)

## 13. The unglamorous separators (improvised beyond the brief)

- State design is half the product. Every data surface needs five drawn
  states before build: loading (skeleton matching the final layout's
  geometry, shown after ~300ms, never a bare spinner with no copy),
  empty (what will appear here + why it is empty + the action that fills
  it), error (what happened in plain words + retry + what still works),
  stale (data with its age as a sentence), and partial (some rows real,
  some unreadable, each labelled). Evenfield has honest copy for several
  of these but no skeleton anywhere; first paint is the text "Loading
  Evenfield..." and the money center's 7-minute cold sweep shows one
  progress line for a wall of panels.
- Numbers are a design surface: amounts format by magnitude (>=1: 2-4
  significant decimals; <0.001: "<0.001" or compact/scientific with the
  exact value on tap/hover; dust below gas cost is labelled "dust, not
  worth claiming" and its claim button disabled). Evenfield's money
  center prints 0.000000000000000001 WETH (1 wei) seventeen times with a
  live Claim button: the single most amateur screenshot in the product.
- Social/SEO: every shareable route needs prerendered HTML with title,
  description, canonical, and a generated OG image (1200x630) carrying
  the coin/verdict, plus theme-color per theme. Evenfield has one global
  title/description and no OG tags at all, so every shared link is naked.
- i18n completeness: locale templates per sentence (not word substitution),
  Intl.NumberFormat/DateTimeFormat/RelativeTimeFormat everywhere, and a
  layout stress test with the longer language (Indonesian strings run
  ~15-20% longer than English; German-style overflow is found by the
  320px screenshot, not by users).
- Onboarding: a first-visit 3-step orientation tied to the core loop
  (find, check, act) that is dismissible and never blocks the board;
  returning users get the recap/changes surface instead. Retention comes
  from the weekly recap and claimable-fee surfaces, designed as pages,
  not from badges.
- Analytics without surveillance: count events and funnels, never record
  searched or connected wallet addresses (blueprint G15 rule), self-host
  or use a cookieless counter, and disclose it in one line in the footer.
- Release hygiene: CHANGELOG per release, bundle-hash equality between
  local build and deployed site (kept from Evenfield), a rollback path
  (previous gh-pages commit) documented before it is needed.

## 14. Decision notes (Leira's rule: newest is not automatically best)

Each note: options considered, the pick, the reason, and the condition
under which the alternative would win. The skill encodes the pick plus
the condition.

- D1 Theme mechanism. Options: (a) media query only, (b) `light-dark()`
  tokens only, (c) semantic tokens switched by a `[data-theme]`
  attribute, with `color-scheme` set and a pre-paint bootstrap. Pick: (c).
  Reason: only (c) supports a persisted manual override without a flash
  of wrong theme, and it works in every Baseline engine today;
  `light-dark()` alone cannot express "user picked dark while OS is
  light". Alternative wins: a content/docs site with no manual toggle
  should use (a)/(b) and skip the bootstrap entirely.
- D2 Default theme. Options: dark, light, follow-OS. Pick: dark default
  (Leira's explicit order; also the trading-terminal norm in section 12),
  stored override wins, OS is only a first-visit tiebreak where no order
  exists. Alternative wins: a mass-consumer onboarding product aimed at
  Upbit-style retail first-timers could default to OS; that is a product
  decision for Leira to make per product, never a silent default.
- D3 Wallet stack. Options: (a) hand-rolled window.ethereum, (b) wagmi v3
  + @wagmi/connectors (EIP-6963 + WalletConnect connector) with our own
  UI, (c) Reown AppKit, (d) RainbowKit. Pick: (b). Reason: (d) is wagmi
  v2 only as of its May 2026 release, so adopting it now means adopting
  the older wagmi on purpose; (c) has wagmi v3 support only in beta and
  adds a source-available license with a 500-MAU free ceiling plus a
  hosted dependency, for a modal we can build in our own tokens; (a)
  fails mobile and multi-wallet outright. Alternatives win: AppKit if a
  product needs email/social login or Solana/Bitcoin in the same modal
  quickly; RainbowKit if a product is already React on wagmi v2 and
  cannot migrate this cycle.
- D4 View transitions. Options: use unguarded (newest sources hype it),
  progressive enhancement, skip. Pick: progressive enhancement behind
  @supports, for route changes only, disabled under reduced-motion.
  Reason: Baseline Newly Available (Oct 2025) means a real tail of older
  browsers; the effect is decorative, so it must never be load-bearing.
  Alternative wins: unguarded use once it reaches Widely Available, or
  today in a Chromium-only internal tool.
- D5 Data architecture. Options: live indexer backend now, CI snapshot +
  bounded delta (current), pure live reads. Pick: CI snapshot + delta.
  Reason: zero-ops on static hosting, proven at our scale, and the
  blueprint's own triggers for re-evaluation are explicit. Alternative
  wins (indexer becomes mandatory) when any of: 6-hour staleness becomes
  user-visible at mainnet volume, CI builds start failing from RPC
  throttling two cycles running, or a feature needs sub-minute data
  (live alerts). Pure live reads never win on this RPC (measured 5-7 min
  cold sweeps).
- D6 Security headers. Options: stay on GitHub Pages with meta CSP, front
  Pages with Cloudflare, migrate to a _headers host. Pick: meta CSP +
  shipped _headers file now; migrate (Cloudflare Pages or fronting) at
  the first of: accounts/sessions, mainnet value flows, or a clickjacking
  report. Reason: today the app holds no sessions and signing happens in
  the user's wallet UI, so the residual framing risk is low; the moment
  either changes, frame-ancestors stops being optional. Alternative wins
  immediately if a product launches with login.
- D7 Typeface. Options: keep Plus Jakarta Sans, switch to Inter, add a
  display face. Pick: keep Jakarta Sans (brand continuity, Indonesian
  design roots, full weight range), self-hosted and subset; addresses and
  transaction hashes render in a monospace stack (ui-monospace) as a
  security exception, because character discrimination (0/O, 1/l) is how
  users catch poisoned lookalikes; mono is banned for general data
  labels, kept for identifiers. Alternative wins: Inter for a future
  dense pro-terminal module where its smaller x-height packs more rows;
  decide per module, not per page.
- D8 Framework. Options: vanilla TypeScript + Vite (current), React +
  wagmi hooks, a meta-framework. Pick: vanilla for this product class.
  Reason: the app is read-mostly, single-surface, and its 217KB gzip is
  already ~90% viem+SDK; React would add runtime and a second state model
  to buy hooks we hand-roll in 40 lines. Alternative wins: when a product
  needs rich cross-view shared state (portfolio, trading tickets,
  realtime feeds) or a second developer joins; then React + wagmi v3,
  not a hand-grown framework.
- D9 Dark canvas tint. Options: neutral #121212, brand-tinted charcoal.
  Pick: tinted toward the brand green at very low saturation (Material's
  chromatic-elevation guidance), because our surfaces are large and
  friendly-scale. Alternative wins: neutral for dense terminal modules
  (Bandwagon pro view), where any tint fights the signal colours.
- D10 Card borders vs elevation. Options: keep 2px coloured borders
  (current), 1px low-contrast border + lightness elevation (dark) /
  soft shadow (light). Pick: the latter. Reason: the current 1.30:1
  border-on-cream fails non-text contrast as a component boundary AND
  reads as an outline drawing; elevation by surface lightness is the
  mechanism every benchmark in section 12 uses. Alternative wins: none
  for product UI; heavy borders belong to deliberate brutalist art
  direction, which this product is not.

## Sources (all checked Nov 2026; dates as published)

- W3C WCAG 2.2 (Recommendation 5 Oct 2023; ISO/IEC 40500:2025) and WCAG
  3.0 Working Draft 10 Sep 2026, via chwezi-design-engine WCAG 2.2
  criteria reference and uxbyissa WCAG thresholds (2026).
- web.dev / Google Search Central Core Web Vitals thresholds, via
  involvedigital CWV guide (updated 30 Sep 2026) and digitalmatters CWV
  reference (Oct 2026); HTTP Archive Web Almanac 2025 pass rates.
- Web Platform Baseline via api.webstatus.dev: Wunderlandmedia Baseline
  2026 roundup (Oct 2026); zvoque CSS playbook (verified Jun 2026);
  mdskill modern-css (mid-2026).
- Material Design dark theme / MD3 surface system, via ColourIntell dark
  mode colour design guide (2026), colorpickerweb dark mode masterclass
  (2026), usetoolsuite dark palette guide (2026), Intense-Visions
  design-dark-mode-color skill (2026).
- uxatom visual design fundamentals (Nov 2026); thedigilearners visual
  hierarchy blueprint (10 Nov 2026); ForgeHouse visual design foundations
  (2026); Wavespace design system guide (2026).
- OWASP Top 10:2025 (final Dec 2025), via Imperva OWASP Top 10:2025 guide
  (Oct 2026), Scanverra OWASP 2025 changes (2026), sechb OWASP 2025
  renumbering notes (22 Sep 2026).
- GitHub Pages header limits: indie.pi3.in security headers on static
  hosting (Oct 2026); yourlocalunemployed Cloudflare Pages migration post
  (12 Jul 2026); everything-free deployment docs (Sep 2026); luongnv89
  ADR 0003 security headers (Aug 2026).
- Wallet stack: Reown AppKit wagmi-3 migration doc (Nov 2026); wyllet.dev
  connect-kit comparison (Oct 2026: RainbowKit 2.2.11 May 2026, ConnectKit
  1.9.2 Mar 2026, AppKit licensing); Whitechain Reown integration docs
  (updated 26 Oct 2026: wagmi 3.7.6, viem 2.55.13, AppKit 1.8.23);
  Trust Wallet developer docs on EIP-6963 (2026); cryptoskills
  frontend-ux dApp production patterns (2026).
- Web3 security losses: Oak Security browser and wallet hardening guide
  (17 Jun 2026); Scam Sniffer 2025 annual figures and Chainalysis 2025
  figures via crypto.myprivacy.blog security assessment (2026); USENIX
  Security 2025 address-poisoning study via pixelwebsolutions (2026).
- GIWA: sigintzero fake-GIWA drain report (Sep 2026); advancedsecurity
  .club fake networks guide (Oct 2026, FSS alert 22 Oct 2026); argusnodes
  GIWA chain sheet (reviewed 16 Sep 2026); BlockVar GIWA testnet guide
  (Oct 2026); GIWA official post 27 Sep 2026 as quoted therein.
- Ammora: ammora-docs SDK 0.3.9 status page (reviewed 2026-11-04),
  launchpad guide and partner quickstart (Nov 2026).
- Benchmarks: Clay Web3 website design principles (2026); prateeksha best
  finance website designs (Oct 2026); 2026 pump.fun and GMGN interface
  design showcases.
- Local: frontend-design, canvas-design, theme-factory, app-creation and
  on_chain_safety_rails skills; Evenfield BUILD.md, style.css, main.ts,
  money.ts, chain.ts, dist measurements and probe screenshots (16 Nov
  2026); blueprint v2 sections B5-B6 and G13-G16.
