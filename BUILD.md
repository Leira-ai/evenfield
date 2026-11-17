# Evenfield: build notes

Evenfield is the combined Ammora Builder product from blueprint v2
(`~/workspace/ammora-s2/produk-gabungan-blueprint-v2.md`): one home for the
whole launch day. Spot the coins worth your money (Rush board), read the
receipts on the human behind them (Lookout verdicts, Goodname passports),
launch your own when you are ready (Launchparty, Phase 1B), split the fees
with your people (Potluck, Phase 1B), follow the wallets that keep showing
up (Bandwagon, Phase 1B), and collect what is yours (the money center,
Glean's verified engine). GIWA Sepolia testnet only. No mainnet path exists
in the code.

- Live site: https://leira-ai.github.io/evenfield/
- Repo: https://github.com/Leira-ai/evenfield (source on `main`, built site on `gh-pages`)
- SDK: `@ammora-protocol/sdk` pinned at exactly 0.3.9, viem 2.x
- Pitch: "Evenfield is the whole Ammora launch day in one place: spot the
  coins worth your money, read the receipts on the human behind them, buy in
  two taps, and launch your own when you are ready."

## Phase 0 gates (all results recorded before the build was adapted)

### Gate 1: the name "Evenfield" — KEPT, with one honest footnote

Checks run 16 Nov 2026:

- Web search for "Evenfield" in crypto, DeFi, Web3, and product contexts:
  no crypto or DeFi product named Evenfield exists. The hard collision that
  killed "Fairground" (Forte Protocol's live perpetual DEX at
  fairground.fi) has no equivalent here.
- GitHub: `Leira-ai/evenfield` did not exist (checked with `gh repo view`);
  the name was free and the repo has since been created under that name.
- Minor non-crypto uses found, neither a hard collision (different field,
  no shared audience, no live product competing for the same searches in
  Web3 contexts):
  - "Evenfield" is an education vertical inside the "Jonomor ecosystem", a
    one-person studio (Ali Morgan), mentioned on xrnotify.io,
    theneutralbridge.com, and hunie.ai.
  - A Devpost hackathon project spelled "EvenField" ("Debunking DEI
    deniers"), a one-off student entry.
- Verdict: the name stands. If a future mainnet launch wants a trademark
  opinion, that is a legal check for that day, not something this testnet
  build can settle.

### Gate 2: catalog census — the "second launch factory" question is CLOSED, and the answer is bigger than the audit expected

Script: `scripts/census.mjs` (resumable, checkpointed). It enumerated every
deployment slot in the SDK 0.3.9 catalog for chain 91342 and scanned
`LaunchCreated` in 10,000-block chunks across every launch factory, plus
`AFSVaultCreated` across every fee-sharing factory. Raw result:
`scripts/census-result.json`. Head at scan time: block 41,504,258.

Launch factories (7 distinct) and what they hold:

| Factory | Catalog slots | Launches |
| --- | --- | --- |
| 0x35353a2Dab7426EcCAe6f5FB267702a542ab68fA | v4-auto-route-20260917 + giwa-auto-route-atomic-20261027 | 73 |
| 0x1a30507113c5f3bc1b0d740b69548b499ebf83cf | permissionless | 45 |
| 0x42acd2531e47ea789c03915c9de195bf6250c0a2 | sealed | 6 |
| 0x3203801200503c78e5ee0b81696818bd1b5649bb | vaults | 3 |
| 0xafb0b870d718f656cadd2bea721b9736d9064c9a | audited | 3 |
| 0x79f5525fdc6b5d433da016d145bfbb0997161c22 | vnext | 1 |
| 0x1b8210f2f54c2fd6394eb7c1cf1ca7617a71b3bd | merged | 1 |
| **Total** |  | **132** |

So the audit's correction stands and extends: Slipway and Glean did read
the same factory (0x35353a2D...), but that factory holds only 73 of 132
launches. The permissionless factory alone holds 45 that neither earlier
product ever saw. The blueprint v2 merge rule is applied: the index scans
every catalog launch factory, dedupes per curve address, tags each launch
with its slot(s), and keeps one creator history per person across all
factories.

Fee-sharing (DFS) factories: 11 vaults in total (auto-route factory
0xb6131d1f...: 5; legacy 0x6eb2b962...: 2; vnext, merged, sealed, audited:
1 each). The money center keeps Glean's verified scope (auto-route +
legacy factories); the extra factories are recorded here for a later slice.

Deployment attestation: `attestAmmoraDeployment` against the auto-route
profile FAILS in SDK 0.3.9 with "deployment profile has no production
runtime hash for 0x35353a2D... (active.launch.factory,
recognized.launchFactories)". The profile ships without a production
runtime hash for the launch factory, so SDK runtime attestation cannot
complete for this profile. Consequences, honestly applied:
- Evenfield's chain badge claims the catalog match ("attested
  deployment" = the deployment comes from the SDK's attested catalog),
  which is true.
- The chain checker page reports exactly this: chain 91342 is the catalog
  chain, and the deeper runtime attestation is unavailable for this
  profile. It never claims a bytecode match it did not verify.

### Gate 3: monetization surfaces — simulation only, from a fresh address, nothing broadcast

Scripts: `scripts/monetization-probe.mjs`, `monetization-probe2.mjs`,
`monetization-probe3.mjs`. Simulation sender:
0x000000000000000000000000000000000000dead (never used on-chain).

1. **Third-party Config registration on the auto-route registry
   (0x6d043014972b87406C4757a5f2d655A24e0b0aF9): PROVEN.**
   Using the official example config document from
   AmmoraLabs/ammora-examples (which targets this live registry), with
   `configOwner` set to the fresh address and `partnerRecipient` (and the
   liquidity-distribution partner) set to an arbitrary stand-in product
   address, built with the SDK's own `buildCreateAmmoraV4Config` and
   validated with `assertAmmoraV4Config`, the `createConfig` call
   simulated successfully from the fresh address and returned
   (configId 43, config hash). A third party can register a Config naming
   its own fee recipient. Notes: the registry is a V4 registry
   (`ammoraLaunchConfigRegistryV4Abi`); the segmented V3 ABI that Slipway
   used for reads is the wrong tool for creation, and the registry's
   `get()` decode throws in viem on a 1e24 config field (the documented
   Slipway bug), so reads stay per-field.
2. **Product-weighted DFS vault creation: PROVEN (raw call), with an SDK
   caveat.** `buildCreateAFSVault(WETH, WETH, [{fresh, 95}, {product,
   5}], salt)` simulated successfully against the auto-route fee-sharing
   factory 0xb6131d1f86321c3de61f0e92fe136fa82e078927 from the fresh
   address and returned the predicted vault address
   0x3DF111e9695604DB7Bbc9A29F6E98f7FB5480C97 (matching `predictVault`).
   Caveat: the SDK's `DFSFactoryClient.planCreateVault` refuses this
   factory ("not the reviewed 0x2b4b0f2a...", the sealed slot) when built
   without deployment options, so the product path is the raw builder
   call, planner-fallback style, exactly the pattern Glean proved for
   claims. Weights are relative, not BPS (95/5 here); a vault distributes
   one fee token to 2-5 distinct recipients.
3. **Partner trade-fee surface (Partner V4 / GIWAGMI): NEEDS AMMORA
   PERMISSION.** Not tested; per blueprint G7 it requires registry
   approval and consent. Not part of Slice A.
4. **Money center: free forever, on purpose** (blueprint G7). The claim
   side is permissionless and proven by Glean; the receiving side is
   items 1 and 2 above.

### Gate 4: delta-sync cost — inside budget with room to spare

Measured live against the production RPC: a 6-hour gap (21,600 blocks,
roughly the CI snapshot interval at this chain's ~1 block/second) across
all 7 launch factories = 21 `eth_getLogs` calls, 5.7 seconds sequential,
9 launches found in the window. A single `eth_blockNumber` costs ~0.23 s.
The app's hard 20-second delta budget therefore covers a gap of roughly
20 hours before it starts truncating, and truncation is safe by design:
the delta is an enhancement, every screen completes from the snapshot
alone, and the next visit retries from the same watermark.

## How Slice A is built

- `scripts/build-snapshot.mjs` builds the full index (all catalog launch
  factories, curve state read per field with the V4 client path first in
  the app and per-field reads in the builder, swap evidence in bounded
  windows: launch + 200,000 blocks forward and the last 300,000 blocks,
  creator aggregates computed per creator, protocol test launches
  classified by named rules and excluded from negative verdicts). It
  writes `public/snapshot.json` and the in-bundle fallback
  `src/fallback-snapshot.json`. GitHub Actions runs it every 6 hours
  (`.github/workflows/snapshot.yml`), commits the snapshot, rebuilds, and
  republishes `gh-pages`. A failed or partial snapshot never replaces the
  last good one in the app: the app falls back to the bundled copy and
  labels staleness in plain words.
- The app boots from the snapshot instantly, then runs a background delta
  sync (LaunchCreated from the snapshot watermark across all factories)
  with a hard 20-second budget. Delta results are an enhancement, never a
  requirement; every screen completes from the snapshot alone.
- Verdicts (blueprint B12, published on the in-app methodology page):
  graduated = the curve filled; stopped = no swap for 100,000 blocks
  and not graduated; creator sold early = a sell from the creator address
  before graduation or within the first 7,200 blocks, always reported
  with amount and transaction link. Verdict copy is generated only from
  these evidence fields; no motive words anywhere. Protocol test launches
  (SDK test series, guide demos, canary/isolated metadata, protocol check
  names) are tagged, listed separately on passports, and never counted
  against a creator.
- Money center: Glean's engine, moved over unchanged in behavior
  (`src/money.ts`): six streams (creator surplus, creator leftover,
  partner fees, ALMM referral fees, ARL pool revenue, DFS vault shares),
  planner first with the exact verified call as fallback, simulation
  before any send, claims only ever from the visitor's own connected
  wallet. Parity check during verification: for the busiest creator
  address (0x13cd27a6...), the app renders the same figures as a direct
  engine probe (probe/a1-probe.mts): ARL claimables in the shared vault
  0x56f05c... including 0.246887728 AUICON and 0.246887728 ANRCON exactly,
  and WETH 296086000000 wei (0.000000296086). The WETH figure itself had
  moved since Glean's read a day earlier (0.000296086 then): the
  beneficiary is an active protocol-team address and the shared-vault
  balance was partly claimed in between; the significant digits and the
  engine agree.
- Chain checker: chain 91342 = GIWA Sepolia from the attested catalog
  (with the attestation caveat above stated on the page); chain 9134 =
  the documented fake that drained about 766 ETH in September 2026;
  anything else = not in the catalog. The header badge is always visible.
- EN/ID toggle with per-locale templates and Intl number/date formatting.
  Evenfield and the module names are never translated.
- PWA shell: manifest + service worker caching the shell and the last
  snapshot.
- Telegram one-way channel: PREPARED, NOT LIVE. `scripts/feed.mjs`
  generates `public/feed.json` and `public/feed.txt` (new launches, new
  graduations, weekly recap) from the same snapshot CI. Posting requires
  a bot token and channel id as repo secrets (TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHANNEL_ID); the workflow posts only when both exist. No bot
  account exists yet, so nothing has been posted anywhere.
- Analytics: local-only page-view counters in the visitor's own
  localStorage. Wallet addresses are never recorded (blueprint G15's hard
  rule); nothing leaves the device.

## What Slice A deliberately does not contain (blueprint phase map)

- Launchparty wizard and the Potluck split designer: Phase 1B, behind
  this same URL. The task brief's demo-path sentence mentions them; the
  governing blueprint v2 places both in 1B and ends the Slice A script at
  the money center, so Slice A follows the blueprint.
- Bundle meter on verdicts (Phase 1B, it is a heavy per-curve read).
- Swap execution, portfolio/PnL, direct buy from the verdict card,
  profile claiming, creator dashboard: Phase 2.
- Partner trade fees: Phase 3 and NEEDS AMMORA PERMISSION (Gate 3.3).
- Bot-interactive Telegram and push alerts: mainnet phase. The one-way
  digest is prepared (above).

### Build-time correction: the curve status enum (found by the first snapshot, verified three ways)

Slipway's labels said status 2 = Migrated, and the first Evenfield
snapshot dutifully mapped 27 curves to "unknown" because their status
read 3. The SDK's own `docs/v4-graduation-lifecycle.md` gives the real
lifecycle: 1 = Trading, 2 = ReadyToMigrate (the terminal fill completed;
a permissionless `migrate()` remains), 3 = Migrated (the canonical pool
exists). Verified independently: the SDK V4 client returns status 3 for
the same curves, and both status-2 and status-3 curves carry a
MigrationReady event and a set canonical pool (the migration event on
this generation is `MigratedV4`, emitted at migration). Consequence,
applied in the builder and in the published methodology: **graduated =
the curve filled (status 2 or 3)**, with status 2 flagged
`readyToMigrate` and worded as such in the UI. This refines blueprint
B12's one-line definition ("status Migrated") with the protocol's own
lifecycle names; the blueprint's intent (graduation is a contract fact,
not an inference) is unchanged. A second defect from the same first
build: `LaunchCreated` has three indexed parameters (token, curve,
creator); a hand-written event ABI without the indexed flags silently
decoded zero launches. The builder and the app's delta scan both use the
corrected declaration, and chunk failures are now logged, never silent.

## Verification (live browser, not Node-only)

Headless Chromium (Playwright) against the LIVE Pages URL,
`probe/render-check.mjs`: **34/34 checks passed** on the final build,
plus graduated/ready spot checks (`probe/grad-check2.mjs`). Covered:
home renders instantly from the snapshot with the exact blueprint
headline and the live fact line ("42 creators have launched 133 coins");
search finds coins; the demo coin page (BAEKHO) shows the verdict chip,
the evidence-based verdict sentence, and an evidence drawer with
explorer transaction links; the quote resolves LIVE (0.01 WETH in,
800,544.42 BAEKHO out, sell-back 0.009644 WETH, block-stamped); the
early-seller passport shows its "sold their own coin early" section and
the big creator's passport separates his 13 protocol test launches; the
chain checker returns the fake verdict for 9134, the not-in-catalog
verdict for 1234, and the catalog verdict for 91342; the methodology
page publishes the 100,000 / 7,200 parameters; the dispute form prepares
its text locally and the public correction log renders; the money center
completes a full sweep for the busiest creator and reproduces the direct
engine probe's figures (see the parity note above; the sweep takes
about 7 minutes cold in the browser, the known Glean tradeoff); the ID
toggle translates the UI, keeps "Evenfield" untranslated, and formats
numbers in the Indonesian locale; the 390px mobile viewport has no
horizontal overflow; with the RPC blocked at the network layer the app
still renders the full board from the snapshot and the quote widget
falls back to an honest labelled state; zero JavaScript page errors
across the whole run (the only console noise was two HTTP 429 resource
responses from the rate-limited public RPC, which the app absorbs with
its fallbacks).

Defects found by verification and fixed before this report:
1. Quote button on the coin page carried the chain checker's label
   ("Check this chain"); it now has its own label in both locales.
2. The verdict sentence said "in 1 transactions"; singular form added
   in both locales.
3. The weekly recap counted all graduations ever next to this week's
   launch count; it now counts graduations among the week's launches.
4. The snapshot-price fallback quote could print an absurd estimate for
   segmented curves; a sanity bound (estimate must not exceed the
   token's total supply) now routes those to the honest no-quote state.
5. The status-enum and indexed-event defects described above (found by
   the first snapshot build and a correlation test, fixed in the
   builder, the app's delta scan, and the published methodology).
6. First verification run scored 31/34; the three failures were the
   chain-1234 assertion (a curly apostrophe in the app's copy versus a
   straight one in the test), the money parity figure (a live balance
   that had moved, settled by the direct engine probe), and the
   console-error rule (network 429s, reclassified as described above).

## Rebuild 2.0.0: "field at dusk" (17 Nov 2026)

Full frontend rebuild under the permanent skill
`~/workspace/custom-skills/web-product-engineering/SKILL.md` (gates
G0-G12) and `redesign/audit-and-redesign-spec.md`. The data engine was
not touched behaviourally: same 7-factory index, verdict engine and
evidence content, Glean claim reads, transport discipline, three-state
honesty, snapshot CI. What changed is presentation, structure, the
wallet layer, and the defects the audit measured.

### Per-gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| G0 design plan first | PASS | audit-and-redesign-spec.md (R1-R6) preceded all code; no catalogued AI-generic look (dark green field tokens, one theatrical element: the verdict stage) |
| G1 tokens + computed contrast | PASS | one semantic token set; `npm run contrast` computes all 64 pairs, both themes, ALL PASS (redesign/contrast-table.md). Two tokens adjusted to pass: dark border.interactive #54755F → #597D65 (2.98 → 3.32 on surface.2), light danger #C93A1E → #C23418 (4.46 → 4.83 on its tint) |
| G2 live screenshot matrix | PASS | probe/qa-matrix.mjs against the LIVE URL: widths 320/360/390/430/768/1024/1280/1440/1920 dark, 390/768/1280 light, foldable 344 + 717, ID at 320; every screenshot viewed by the builder; 69/69 checks |
| G3 responsive + targets | PASS | container-query grids (minmax(0,1fr), blowout found in QA and fixed), bottom tab bar with safe-area, targets ≥44px (compacted header controls keep 44px height) |
| G4 WCAG 2.2 AA + axe | PASS | axe-core zero critical/serious on home dark, home light, coin dark (one real find fixed: stage-count text.3 at 16px → text.2); keyboard pass: evidence drawer opens via Enter, focus visible |
| G5 performance budget | PASS | initial JS 24.0 KB gzip (entry), CSS 4.2 KB gzip; snapshot ships ONCE (in-bundle fallback copy deleted; SW cache is the offline copy); throttled run (4x CPU + Fast 3G): cards usable in 2.8s |
| G6 security | PASS with platform note | CSP meta with hashed inline bootstrap + `_headers` for hosts that honour it; deps pinned exactly (viem 2.57.20, @wagmi/core 3.6.9, @wagmi/connectors 8.2.4, @ammora-protocol/sdk 0.3.9); sink audit below; GitHub Pages cannot send frame-ancestors / HSTS / X-Content-Type-Options headers, the meta CSP omits only those |
| G7 five states + formatting | PASS | loading skeletons, empty, error + retry, stale banner (simulated 3-day-old snapshot), partial (per-stream unavailable lines); amounts by magnitude; dust grouped, labelled, claim disabled. One honest subtraction: the chart prints no spot price, because the launch curve's sqrtPrice cannot be rescaled safely (see defects) and the only prices printed come from the live quote engine |
| G8 wallet | PARTIAL (one criterion) | wagmi v3 + per-provider EIP-6963 connectors + custom sheet; four states exercised against a mock EIP-6963 wallet in Chromium (discover → connect → wrong-network on chain change → switch back); 9134 guard kept. WalletConnect is wired but INACTIVE: it needs a Reown project id registered for this origin, which does not exist yet; the sheet says so honestly instead of offering a dead button |
| G9 simulate before signing | PASS | money.executeClaim simulates the exact transaction via publicClient.call before sendTransaction (code + code path unchanged from Slice A claim flow) |
| G10 snapshot pipeline | PASS | unchanged CI (atomic publish + head block watermark); fallback-copy removal applied to build-snapshot.mjs and the workflow's git add list |
| G11 prerender + OG + i18n | PASS | static home injected into dist/index.html; 133 coin + 42 creator share pages, each with own title/description/canonical and a subject OG image (175 images in public/og/); EN/ID toggle verified incl. ID at 320px |
| G12 release discipline | PASS | version 2.0.0, CHANGELOG.md entry, SW cache name versioned (evenfield-v2.0.0) with kill switch, rollback = redeploy previous gh-pages commit (Slice A deploy, source bf2c7c1) |

### Defects found during the rebuild and fixed

1. Header overflow at 320/360/390 and 1024 (QA matrix): chain badge
   moved to ≥1280px, compact header rules ≤560px and ≤400px, connected
   wallet button drops its chain label on small screens.
2. Grid blowout at 320 (a card's min-content forced a 270px column in a
   238px container): all grids now minmax(0, 1fr), cards min-width 0.
3. axe light-theme contrast: stage counts in text.3 (4.20:1 at 16px
   bold) → text.2.
4. Spot price rendered as "0 WETH": the chart initially derived a spot
   price from the curve's sqrtPrice as if it were a Uniswap X96. It is
   not: rescaled it disagrees with the reserves ratio and with the
   engine's live quote by orders of magnitude (BAEKHO: implied 1e-19
   scale vs a verified live quote of 0.01 WETH → 800,544 coins). The
   unverifiable number was removed, not reformatted: the chart shows
   the measured progress and marker only, and every price on the page
   now comes from the live quote engine. (The Slice A quote fallback
   uses the same sqrtPrice but behind a total-supply sanity bound, so
   it degrades to the honest no-quote state; left untouched.)
5. Topnav labels wrapped to two lines at desktop widths: nowrap.
6. QA harness finds (not product defects): the mock wallet's chain hex
   (91342 = 0x164CE), eth_accounts must stay empty until authorised,
   axe must be served as a same-origin file because our own CSP blocks
   inline injection, service workers must be blocked in the stale and
   snapshot-only simulations for deterministic interception.

### Money parity (live, this rebuild)

A1 sweep in the rebuilt UI against the direct engine probe (same
engine code, untouched): AUICON and ANRCON match exactly at
0.246887728 (UI display rounds to 0.246888, exact value on the toggle).
The WETH row is a moving balance: the Slice A probe read 296,086 wei,
and by this rebuild's sweep the beneficiary had claimed it down to a
7-wei dust remainder, direct evidence of the balance moving between
sittings rather than a read error. The 1-wei class rows render inside
the dust box with exact amounts under a <details> toggle and a
disabled claim button; no 18-decimal string appears as a primary
amount anywhere in the results.

### Sink audit (Gate 6)

Every `innerHTML` interpolation in src/main.ts passes esc() except two
numeric-only SVG builders whose inputs are computed numbers, never
chain strings: identiconSvg (hue + rect coordinates from address hex
digits via parseInt) and curveChart (path coordinates from measured
numbers; its text nodes pass esc()). Address/hash display goes through
addrChip/shortAddr + esc(). The share pages from scripts/prerender.mjs
escape all snapshot fields with the same esc().

## UX rebuild 3.0.0 (17 Nov 2026)

Built under the skill's Gates 13-16 and `redesign/ux-spec-v2.md`,
decisions D11-D16 in `redesign/study-notes-2.md`. Leira rejected
2.0.0 because users were confused and mobile was still bad; this
rebuild is organised around measured task success, not page
appearance. The data engine's verified numbers and honesty rules
were not touched; `executeClaim` behaviour is unchanged.

### Per-gate results (G0-G16)

| Gate | Result | Evidence |
| --- | --- | --- |
| G0 design plan first | PASS | ux-spec-v2.md + study-notes-2.md (D11-D16) preceded all code |
| G1 tokens + computed contrast | PASS | tokens unchanged from 2.0.0; `scripts/contrast-check.mjs` re-run on 3.0.0: ALL PAIRS PASS |
| G2 live matrix + performed tasks | PASS | probe/qa-matrix.mjs 69/69 and probe/qa-tasks.mjs (see T1-T8 below) against the LIVE URL; every reported screenshot viewed by the builder |
| G3 performance budgets | PASS | initial JS 34.8 KB gzip (entry chunk), CSS 5.8 KB gzip, both far under the 200 KB gate; the WalletConnect chunk is fully lazy; throttled run (400 kbps, 4x CPU) shows usable cards in 4,380 ms |
| G4 responsive matrix | PASS | widths 320-1920 plus foldable 344/717, both themes: no horizontal overflow anywhere; first-card visibility per width recorded under T1 |
| G5 accessibility | PASS | axe-core zero critical/serious on home dark, home light, coin dark (1280); focus and target tokens unchanged from 2.0.0 |
| G6 sink audit | PASS | new render surfaces (strip, chips, sheet, suggestions, summary) interpolate snapshot/user strings only through esc(); counts and amounts are computed numbers |
| G7 formatting | PASS | relative times for every user-facing time (blockDate at 1.0 s/block, measured live); raw block heights removed from coin stats; amounts display at 6dp (0.246887728 shows as 0.246888) |
| G8 wallet states | PASS | wagmi v3 + EIP-6963 kept; WalletConnect leg per D11 (below); mock-wallet connect, wrong-state and reconnect flows exercised by the probes |
| G9 money-action safety | PASS | every claim still simulates via publicClient.call before any signature (executeClaim untouched); the confirm sheet precedes all signing (T6) |
| G10 i18n parity | PASS | EN and ID dictionaries at exact parity, 323 = 323 keys, no orphans; all v3 keys present in both |
| G11 honesty of states | PASS | three-state data honesty kept; stale-banner and snapshot-only flows pass in the matrix; one dust rule in every panel (0 enabled dust claims measured, T5/T6) |
| G12 build/deploy hygiene | PASS | tsc --noEmit clean; SW cache bumped to evenfield-v3.0.0; each deploy verified by entry-chunk hash equality between dist and the live URL |
| G13 task success | PASS on measured tasks, PARTIAL on hallway | T1-T8 all pass inside their tap budgets (table below). A 5-user hallway test cannot be run in this environment; the 5-second and face-value comprehension checks were performed as a documented builder self-review on the fresh screenshots instead |
| G14 filters and discovery | PASS | presets with per-preset live counts; facets cross-counted with zero-count values disabled; safe defaults announced; applied chips removable plus Clear all; state in URL + localStorage, restored on back navigation (T8); mobile sheet with live "Show N coins"; desktop rail with instant apply; grouped suggestions with verdict chips and recents; the search placeholder renders in full at 320px |
| G15 mobile and PC craft | PASS | job-based tab bar (Board / Watching / Money / Chain check / More); sticky quote dock on the coin page; sheet capped at 92svh with overscroll containment; coarse-pointer inputs at 16px; desktop rail, density toggle, keyboard shortcuts |
| G16 safe defaults + money ease | PASS | test launches and stopped coins hidden by default and announced; connected wallet auto-checked on arrival; plain-words summary first; claim-all behind the "Before you sign" sheet; paste-address fallback validated and auto-run |

### Acceptance tasks T1-T8 (live URL, real browser, taps counted)

| Task | Budget | Measured | Result |
| --- | --- | --- | --- |
| T1 first card in first viewport, 390 dark | 0 taps | first card top 563px, 281px visible at 390x844 | PASS |
| T1 variants | 0 taps | 360x740: 157px visible; 344x740: 128px; 390 light: 195px; 768: 484px; 320x700: 68px | PASS |
| T2 shortlist via Worth a look + one facet | <= 3 taps | preset 1 tap -> 2 coins (AMMORA, Verify Drill); facet composes at tap 2; desktop preset + rail facet = 2 clicks | PASS |
| T3 verdict chip + fact + meaning on the card | 0 taps (passport <= 1) | chip "Caution: sold early", fact and meaning on the first card at 0 taps; creator record at 1 tap | PASS |
| T4 caution meaning from coin page top | 0 taps | meaning at top 559px in an 844px viewport; stats relative-time only; quote dock pinned mid-scroll | PASS |
| T5 money summary after connect | 0 taps after connect | summary names AUICON and ANRCON at 0.246888 each (the verified 0.246887728 record at 6dp), plus GLPD, BLDRC and sub-0.001 WETH; 0 enabled dust claims anywhere | PASS |
| T6 claim-all confirm sheet | <= 3 taps | sheet open at 1 tap, listing all 5 amounts and "sign 5 time(s)"; probe stopped at the sheet, Claim now never clicked | PASS |
| T7 zero-result state + recovery | recovery <= 1 tap | state names the cause; recovery tap returns 1 coin (QLT) | PASS |
| T8 filter state survives back navigation | n/a | "Showing 2 of 133 coins" identical before and after the round trip | PASS |

Full suite: probe/qa-tasks.mjs 44/44, probe/qa-matrix.mjs 69/69,
probe/qa-wallet-money.mjs 18/18, contrast ALL PAIRS PASS.

### Defects found and fixed during this rebuild

1. T1 failed on the real app render. The first QA run measured
   212px of card visible, but that was the prerendered static card;
   the app render put its first card at top 917px in an 844px
   viewport (hero 209 + filterbar 296 + why-line 112). The static
   prerender had been masking the failure. Fixed by compressing the
   hero, moving search into the sticky bar, collapsing presets,
   quick verdict chips, sort and the Filters button into one
   horizontally scrolling strip, slimming the why-line, and moving
   the hidden-by-default counts into strip chips; small-viewport
   rules tighten lane headers at <= 768px and the hero fact at
   <= 480px. The probe now waits for the app render (#boardSearch)
   before measuring anything.
2. Every preset chip showed the same count, 47. presetCount passed
   skip:'preset' to the filter pipeline, which made the pipeline
   ignore the preset being counted. Fixed to evaluate the preset;
   verified live counts are Worth a look 2, Graduating soon 0, New
   today 35, Clean creators 0, Graduated 13. A probe assertion now
   pins these numbers.
3. Probe defects (not app defects): the T5 connect check compared
   the checksummed button label case-sensitively and reported a
   working connect as failed; the T5 summary poll crashed on a
   30s auto-wait instead of polling; the T5 amount regex expected
   0.2469 where Gate 7 display rounding produces 0.246888. All
   fixed in the probes.
4. Stale harness expectations after the copy changes: qa-matrix
   (verdict chip label, ID headline, snapshot-only promise line)
   and qa-wallet-money ("Read at block" -> relative "Read {time}.",
   the old dust label -> "{n} dust amounts, worth less than their
   claim fees", the WalletConnect note's new wording, parity
   expressed at Gate 7 display rounding with the full-precision
   record asserted in data-exact, and one pinned dust digit string
   from an old sweep replaced by the reachability invariant: the
   dust details toggle opens and shows a full-precision figure).
   Updated and re-run.

### Recorded interpretations and corrections

- D11 licence correction: study-notes-2 described
  @walletconnect/ethereum-provider as MIT. Its LICENSE.md is the
  WalletConnect Community License Agreement (Reown, Inc., released
  20 August 2025), royalty-free for application development under
  Section 1(b). The package is pinned exactly (2.26.0) as a direct
  dependency and imported lazily, only when VITE_WC_PROJECT_ID is
  configured; it is not configured, no external account was
  created, and the honest in-product note remains.
- "Worth a look" preset: the spec's "Clean record or Caution-free"
  is implemented as verdict kind clean OR too-new-to-judge, plus
  progress >= 25% OR buyers >= 3. On the current snapshot that is
  exactly 2 coins (AMMORA, Verify Drill). Clean creators is 0:
  no creator currently has a fully clean record.
- The hidden-by-default counts moved out of the "Showing N of 133
  coins" sentence into sticky strip chips ("39 test launches hidden
  by your defaults · Show them"). The inline sentence wrapped to
  four-plus lines at 344-360px and was itself a cause of the T1
  failure; the counts and the one-tap lift remain on the same
  screen, in the sticky bar.
- Data facts behind the counts: 133 launches, 42 creators, 39 test
  launches, 57 stopped; default-visible 47 (stage new 33, graduated
  13, other 1, near 0; the only >= 75% coin, QLT at 99%, is a test
  launch, so Graduating soon reads 0 under the safe defaults).

## Submission package (prepared, NOT sent)

- X post draft: `builder-post.txt` (max 280 chars, mentions @AmmoraHQ,
  claims only what the live browser check verified).
- Submit payload shape for the Ammora Season 2 API:
  `signed_action("submit", { kind: "builder", project: "Evenfield",
  website: "https://leira-ai.github.io/evenfield/", url: "<X post URL
  after posting>" })`. Posting and submitting wait for Leira's review of
  the live artifact.

## Perfection pass 3.1.0 (17 Nov 2026, from redesign/perfection-audit.md)

Built under Gate 17 after v3 was rejected without feedback. Source
commits: main b0db5f5 (the pass), 7908642 (sparkline label wrap fix);
deploys: gh-pages 6b207f5, cb318cd. Live entry chunk verified equal
to the local build (index-BeG3GmGw.js) before the final QA runs.

### What shipped, per audit item

- P-1/F-1 verdict calibration: the snapshot builder now records
  `earlySellPct` per launch (creator early sells as a share of their
  buys on that curve) and effective early-sell aggregates per
  creator (only sells of 1% or more count). Bands: under 1% is a
  recorded fact and never raises a caution (two band-A coins,
  including one whose creator sold 0.2%, no longer carry any caution
  wording); 1-25% names the fraction plainly; over 25% uses the
  "cashed out" wording. Every meaning line is generated from the
  coin's and creator's own measured values (percentage, counts,
  ages, plus a clause about this coin itself), so identical meaning
  prose cannot repeat across different situations. The positive
  tier "No red flags found" ships with the published F-1 definition
  and its boundary sentence ("a clean record so far, not a
  guarantee"), on the methodology page and next to the verdict.
- P-2/F-2 signal-first cards: snapshot price sampled at index build
  time through the proven ALCClient quote path (0.01 WETH in,
  block-stamped, labelled with its age; all 107 then-trading curves
  answered, graduated curves honestly show no curve price), an
  activity sparkline from 12-window swap aggregates (labelled
  activity, never price), progress, one tabular stats line, verdict
  chip + one fact, holder line, and the meaning behind a "Why"
  expander.
- F-3 holder concentration: the builder now excludes the curve AND
  its canonical pool from holder shares (the old build counted the
  pool itself: one coin's top holder read 89.1% and is 22.6% with
  the pool excluded). Card line (top holder, top 10) plus a coin
  page panel with the under/over-30% scale line printed next to the
  number; 78 of 140 launches carry holder data, the rest say so.
- P-3 empty doors: a preset whose live count is zero renders as
  status text, never a button ("Watching: none yet"; the
  graduating-soon status names the closest coin and its percentage
  when it is zero). In the shipped snapshot Graduating soon is no
  longer zero (REIKA at 99.3%).
- P-5 money summary: plain words first ("N amounts are worth
  claiming.", the biggest in words, per-token totals as rows);
  dust counted and named as dust in its own sentence; the stray
  "Read now." fragment is gone (the line now reads "This check was
  read {time}."); the partial-read honesty line moved to the end of
  the results with calmer wording, and each unread stream says so
  in its own panel. One residual, fixed in code but not yet
  deployed (see Environment note): a claimable sub-0.001 amount
  (A1's 0.000296 WETH, worth claiming under the engine's gas rule)
  displayed as "<0.001"; fmtAmountDisplay now renders real
  significant digits for claimable amounts.
- P-8 desktop: content width 1200px to 1760px, four-column card
  grid at wide containers, and the list density is a true sortable
  table (Coin, Price, Progress, Buyers, Raised, Last trade, Creator
  verdict) with two new sorts (snapshot price, last trade).
- D-1 QA foundations: new probe `probe/qa-readability.mjs`
  (measured truncation assertions across widths/themes, H1-largest
  check, boilerplate detector with a 3-card threshold for identical
  meaning sentences, zero-preset status check, mid-scroll sticky
  tap test, 1920 dense-table checks, Gate 17 screenshots).

### New verdict distribution (snapshot built 2026-11-17T00:17Z, head 41,528,186; 140 launches, 46 creators)

Builder verdicts: careful 68, test 39, too-new 21, clean 12.
Display kinds: caution-early 44, caution-stopped 26, too-new 19,
clean 12, test 39. The positive tier is reachable for the first
time (12 coins: XTB, OXX, REIKA, CBRL, MIMO, YUZU, TRAI, AMMORA x2,
GMORA, APGEN, VDRL). Worth a look now returns 6 coins, all clean.
Prices: 107 sampled, 0 trading curves unanswered. Sparklines: 88
coins with non-zero activity. Holders: 78 launches.

### Gate results and acceptance tasks (live URL)

- G0-G12, G14-G16: PASS as in the 3.0.0 record; tokens unchanged
  (contrast ALL PAIRS PASS at 3.1.0), i18n parity 371 = 371 keys,
  tsc clean, initial JS 38.6 KB gzip, CSS 6.5 KB gzip, SW cache
  evenfield-v3.1.0.
- qa-matrix run 1: 67/69. Two failures, both root-caused and fixed
  in the same run: (a) ID 320 overflow: the Indonesian no-trades
  sparkline label ("Belum ada perdagangan", nowrap) pushed the
  price row 11px out at 320px; fixed by wrapping the label, and the
  re-run scored 68/69. (b) stale-banner check: a probe race (it read
  the prerender before the app render); the banner was confirmed
  present in a manual reproduction, and the probe now waits for the
  app render and polls. The confirming matrix re-run is pending
  (Environment note).
- qa-tasks run: 46/48. T1-T4, T6, T7 pass, including the new T3
  shape (chip + fact at 0 taps, meaning behind Why in 1 tap, full
  record in 2), T7's zero-preset status text, URL facet-combo zero
  state and 1-tap loosening recovery. Two failures, both
  root-caused: T8 compared the whole "Showing N of M" line while
  the live delta sync grew the index 140 to 142 mid-run (filters
  were intact; the probe now compares the filtered count), and T5
  caught the "<0.001 WETH" summary display described under P-5
  (real defect, fixed in code, deployment pending per the
  Environment note). The confirming tasks re-run is pending.
- G13/G17 self-critique: side-by-side against the audit's benchmark
  set was performed on the fresh screenshots (home 390/1280/1920,
  coin 390, money summary). Findings fixed in-run: the ID 320
  sparkline overflow and the sub-0.001 display. The headline
  promise test passes against the shipped snapshot (the board's
  first card is a clean-tier coin; the trust answer is on the card
  face). The readability probe run is pending (Environment note).
- G13 hallway: PARTIAL as before (no 5-user test possible in this
  environment; documented self-review instead).

### Environment note (why three items are pending)

Mid-run, the sandbox enabled a write guard: any exec process that
reads project or node_modules files is then refused filesystem
writes (EPERM), which blocks local vite builds, git object writes,
cp, and Chromium profile writes (so the probes cannot launch).
Verified independently by a second agent session: same result.
What is deployed and verified live is everything except three
small fixes that sit uncommitted in the working tree (src/main.ts,
src/i18n.ts; tsc clean, i18n parity 374 = 374): (1) the
fmtAmountDisplay significant-digits fix above; (2) clean-tier fact
pluralization ("We checked 1 launches and 1 trades" on the APGEN
card, caught in the Gate 17 screenshot review; singular variants
added); (3) the card holder line for coins with at most 2 holders
read now says "Only {n} holders read so far, too few to judge
concentration" instead of the trivially-true "Top holder 100% ·
Top 10 100%" that repeated across one-buyer cards (also caught in
the Gate 17 review; the coin page keeps the full numbers). Remaining, in order, for the first session after
the guard lifts: (1) npm run build, commit, deploy, verify the
live chunk; (2) re-run qa-matrix (expect 69/69), qa-tasks (expect
48/48), qa-readability, qa-wallet-money; (3) refresh the v31
screenshots. A CI run (snapshot-and-deploy, workflow_dispatch
43992271523) was triggered to keep the snapshot fresh meanwhile;
it builds from main, so it does not carry the fmt fix either.
Nothing was posted to X and nothing was submitted to Ammora;
both still wait for Leira's review of v3.1.

### Recovery run (17 Nov 2026, later session): the pending list is closed

The write guard had lifted (verified by a touch/rm probe, then by
a full vite build writing dist). All three queued steps are done.

1. The three queued fixes are committed and deployed: main
   09a141a (rebased over two CI snapshot commits; the build was
   redone on the refreshed snapshot, 145 launches / 48 creators),
   gh-pages 3494d83, live chunk index-CkYu1QCm.js verified equal
   to the local build.
2. The probe re-runs did not stop at green for the old suites:
   qa-readability ran for the first time and failed 2 of 15,
   both real app defects, fixed in the same run in three rounds:
   - Round 1 (main 8dbda3d): the clean-tier meaning repeated 12x
     (12 of 14 clean coins have exactly 1 buyer, so the per-coin
     clause was identical). Clean meanings now carry the coin's
     own buyers, trades and curve fill (measured max repeat 2).
     Plus the 320px truncations it caught: the price row could
     not break the long snapshot price token (overflow-wrap:
     anywhere) and the "No trades yet" label was squeezed
     (flex: none).
   - Round 2 (main 345a227): the too-new meaning repeated 9x
     (a same-creator burst of clone launches, byte-identical in
     every measured value). Too-new meanings now carry the
     coin's launch ordinal for its creator, the one honest fact
     that tells burst clones apart. Plus card-top truncation at
     320px: the nowrap stage pill crushed the names column to
     32px and the symbol overflowed; card-top now wraps and the
     symbol can break.
   - Round 3 (main a1d0dd1): the creator-variant caution-early
     meaning repeated 8x (creator-level fact + one coin stat
     collides for every serial creator). Caution meanings
     (early and stopped) now append the launch ordinal via a
     shared wrapper; the coin clause's trades unit got its
     singular/plural forms at the same time.
   Readability then passed 15/15 (top meaning repeat 2x, 56
   distinct meanings on the rendered board).
3. Gate 17 screenshot review of the refreshed v31 set caught
   one more defect, fixed in main 17eb995: the few-holders card
   line read "Only 1 holders read so far"; it now has a
   singular form. The same review verified the money summary
   shows real significant digits (0.0000102 WETH, not "<0.001"),
   the first card on mobile is a clean-tier coin with its trust
   answer on the card face, and the 1920 dense table renders
   with live preset counts (Clean creators 14, Graduating soon
   1, Worth a look 8 on the current snapshot).
4. FINAL VERIFICATION on the final deployed build (source main
   17eb995, gh-pages 0b5eeee, live entry chunk
   index--gyS03ka.js verified equal to the local build):
   qa-matrix 69/69, qa-tasks 48/48, qa-wallet-money 18/18,
   qa-readability 15/15. tsc clean, i18n parity 384 = 384,
   contrast ALL PAIRS PASS, initial entry JS 38.4 KB gzip, SW
   cache evenfield-v3.1.0. All v31 screenshots refreshed in
   probe/qa/, including v31-home-1920-dense.png.
5. Infra note: the Chromium probes need the local proxy relay
   on 127.0.0.1:18080; its script now lives in the repo at
   probe/relay-18080.mjs (force-added past the probe gitignore)
   because /tmp does not survive VM restarts. Start it before
   any probe run.

Unchanged and still open, by design: G13 hallway stays PARTIAL
(no 5-user test possible in this environment); WalletConnect is
still not enabled (needs a Reown project ID, Leira's decision);
the Telegram channel is still prepared-not-live (needs bot
token + channel ID secrets, Leira's decision). Nothing was
posted to X and nothing was submitted to Ammora; both still
wait for Leira's review of v3.1.

## Hotfix 3.1.1 (17 Nov 2026): the unstyled-page incident

Leira opened the live site on her phone at 13:31 WIB and got a
page with NO styles at all: white background, default serif
font, blue underlined links, the prerendered text frozen in
place. Her connection at the time was ~4 KB/s. Every internal
QA run had passed on fast connections with fresh profiles, so
the defect had cleared all gates. She ordered the cause found,
other bugs hunted, and improvement gaps listed. All three were
done in this run; the fix is deployed (source main e2243d7,
gh-pages 58906fa).

### Root cause (proven, not inferred)

Three mechanisms combined:

1. EVERY deploy deletes the previous build's assets. The CI
   workflow (and the manual deploys mirroring it) publishes by
   initialising a brand-new git repo inside dist/ and
   force-pushing it as gh-pages, every 6 hours for CI. Hashed
   asset filenames from previous builds are not carried over.
   Verified live: the entry chunks of 2.0.0 (index-Be0AcyGj.js),
   3.0.0 (index-BJ6JnFIc.js), the first 3.1.0 deploy
   (index-BeG3GmGw.js) and the recovery deploy
   (index-CkYu1QCm.js) ALL return HTTP 404.
2. The service worker pinned returning visitors to a stale
   index.html forever. public/sw.js (cache evenfield-v3.1.0)
   precached ./index.html and answered every same-origin GET,
   navigations included, cache-first with no revalidation and
   no runtime refresh. Its cache name changed only when a human
   shipped a release, NOT on CI snapshot deploys (sw.js is a
   static file; CI builds copied it verbatim). So a phone that
   had visited during one build kept receiving that build's
   HTML on every later visit, pointing at asset hashes the next
   deploy had already deleted.
3. The CSS 404 is what made it VISIBLE as total style loss.
   The prerendered home carries real content in the HTML, so
   with the stylesheet gone the browser simply painted that
   content with default styles: serif, blue underlined links,
   no dark theme, no cards. The JS 404 meant the app never
   booted, so the frozen static page never updated either. The
   state could never heal, because the worker kept serving the
   same cached HTML. Leira's timeline fits exactly: her worker
   held an earlier recovery deploy's HTML (145 coins, 48
   creators, matching her screenshot), the next deploy replaced
   the tree (the final recovery build was live by 13:07 WIB),
   and her 13:31 visit hit deleted assets.

Reproduction (probe/repro-unstyled.mjs, fresh headless
Chromium against the live URL):
- Fresh profile at ~5 KB/s with 4x CPU throttle: the page
  painted UNSTYLED content at t=3s and t=5s (computed body
  background transparent, font "Times New Roman", link colour
  rgb(0, 0, 238) underlined, 0 stylesheets); styles only
  landed between 5s and 10s, and the app had not booted by
  35s. So even without the worker, a slow connection produced
  a long unstyled window, because the stylesheet is a separate
  file that must arrive before the design exists.
- Worker scenario: visit 1 (fast) installed the worker with
  the HTML cached; visit 2 with /assets/ answered 404 (the
  wipe) reproduced Leira's screenshot pixel for pixel
  (probe/qa/repro-sw-wipe.png), with the network log showing
  exactly index--gyS03ka.js -> 404 and index-ClaOTa7e.css ->
  404. Visit 2 without the wipe stayed styled: the bomb was
  the combination, not either half alone.
- Why the gates missed it: Gate 2/3 QA always ran fresh
  profiles (no worker, no stale cache) and its "throttled" run
  was Fast 3G at 400 kbps (~50 KB/s, ten times Leira's link),
  and no run ever simulated a deploy landing between two
  visits. A repeat-visit, post-deploy, slow-link scenario did
  not exist in the matrix. It does now (see Verification).

### The fix (deployed)

1. The stylesheet is INLINED into dist/index.html.
   scripts/prerender.mjs (new "finalize" step) replaces the
   <link rel="stylesheet"> to the hashed CSS file with a
   <style> block containing the whole sheet (34,283 chars;
   index.html grows 17,035 -> 51,283 bytes raw, comparable
   gzipped). First paint is now styled the moment the HTML
   itself arrives, independent of any asset file. CSP already
   allowed inline styles (style-src 'self' 'unsafe-inline').
   The CSS file is still emitted by Vite but no longer
   referenced by the home page.
2. The service worker is rewritten and STAMPED PER BUILD.
   public/sw.js is now a template; prerender stamps
   dist/sw.js with a cache name derived from the entry chunk
   hash (evenfield-b<hash>) and a shell list naming the real
   entry chunk, so CI snapshot deploys roll the worker too.
   Strategies: navigations NETWORK-FIRST (cached shell is an
   offline fallback only, refreshed on every successful
   navigation); /assets/ cache-first with runtime fill (hashes
   are immutable per build, and a fresh navigation always
   brings HTML matching the assets on the server);
   snapshot.json network-first with cache fallback and NO
   LONGER PRECACHED (its 307 KB was a hostile install payload
   on slow links, and the old worker's atomic addAll meant one
   failed snapshot fetch failed the whole worker install);
   everything else same-origin is stale-while-revalidate. On
   activation, old caches are deleted; if a LEGACY pre-fix
   cache (evenfield-v*) was among them, open windows are
   navigated once to their own URL, which is the self-heal for
   users stuck on the broken shell (their browser fetches the
   new worker on the next visit; the reload lands on
   network-first navigation and the inline-CSS HTML). Routine
   build-to-build upgrades do not force a reload.
3. The CI deploy now preserves the previous generation's
   assets: the workflow checks out the existing gh-pages tree
   and copies into dist/assets/ only the files the new build
   lacks, before force-pushing. One generation of overlap
   means a not-yet-updated worker's HTML still finds its CSS
   and JS alive. This manual deploy did the same copy (a no-op
   this time: the live tree was built from identical source,
   so every filename matched).

### Verification (live, after deploy)

probe/verify-unstyled-fix.mjs, ALL CHECKS PASSED:
- A, fresh profile at ~5 KB/s: NO unstyled-content phase at
  any poll (1-10s); the first content, at t=5s, arrived
  already styled (dark background, product font). Before, the
  same profile showed unstyled content at 3-5s and styles at
  ~10s. Screenshot probe/qa/fix-slow-t5.png.
- B, new worker installed, then /assets/ forced to 404 and
  reloaded: page stayed styled (network-first HTML carries
  its CSS inline); in the event the app even booted from the
  worker's runtime asset cache. Screenshot
  probe/qa/fix-sw-wipe.png.
- C, legacy heal on a local mirror of the pre-fix site (old
  worker fixture probe/legacy-sw-v3.1.0.js + the pre-fix live
  HTML): deleting the CSS reproduced the unstyled state; after
  the fixed build was deployed to the mirror, the next load
  healed itself (styled again, legacy cache purged).
  Screenshots probe/qa/fix-legacy-broken.png and
  fix-legacy-healed.png.
- Full regression on the final live build: qa-matrix 69/69,
  qa-tasks 48/48, qa-wallet-money 18/18, qa-readability
  15/15. tsc clean (build), contrast unchanged (CSS content
  identical, only its delivery changed).

Residual honesty: a phone still holding the legacy worker
shows the broken page until its browser runs a worker update
check (normally on the next navigation) and the new worker
activates; the heal was verified end-to-end on the mirror,
and asset preservation narrows the window further, but the
very first reopened tab can still flash the old shell before
the update lands.

### Bug hunt (same run, live site)

Checked beyond the incident and NOT bugs: unknown or
malformed coin/creator hash routes land on a designed state
("Nothing matches that yet. Back to the board") with header
and tab bar intact and zero page errors
(probe/hunt-bad-routes.mjs); share pages carry correct title,
meta and redirect; feed.json and feed.txt are served; the
manifest is valid; the four QA suites above cover the rest of
the surface (both themes, 320-1920, money flows, axe).

Found, recorded, deliberately not fixed in a hotfix run:
- No custom 404.html: an unknown path under /evenfield/
  returns GitHub Pages' generic 404 page, unstyled and
  off-brand. Fix: ship a small styled 404.html that routes
  back into the app. (Improve list #2.)

### Improvement gaps (from live evidence, impact order)

1. Boot on slow links is still slow even though first paint
   is fixed: at ~5 KB/s the app shell (header, tab bar) had
   not appeared after 35s in the repro, because boot waits on
   the entry JS (39 KB gzip) plus the snapshot fetch (307 KB
   raw) plus live RPC checks, while the readable static page
   just sits there. Next step: render the app shell and the
   snapshot board as soon as the JS arrives, without waiting
   for live checks, and consider a slimmer first-paint
   snapshot (the board's visible fields only).
2. No custom 404.html (see bug hunt).
3. Snapshot freshness can lag far beyond the 6h cadence: CI
   runs take ~40 minutes end to end (the snapshot scan is the
   bulk) and GitHub's cron started the 00:21 UTC run at
   01:53 UTC; the board's "refreshed" line can therefore be
   many hours old even when everything works. The snapshot
   builder needs the same delta treatment the app already
   has, or a smaller rescan window.
4. The prerendered static home is a thinner card than the app
   card (no snapshot price, sparkline or holder line). On a
   slow link that static page is the product for tens of
   seconds. Enriching the prerender cards to match the app
   card would close the visible gap between the two states.
5. Footer paragraphs render tightly together on the
   not-found state (three <p> lines read as one block).
   Cosmetic; a margin pass on .site-footer p would fix it.

Process change recorded for the skill: a repeat-visit,
post-deploy scenario (worker installed, then assets wiped)
and a ~5 KB/s first-visit scenario are now part of this
product's release evidence (probe/repro-unstyled.mjs +
probe/verify-unstyled-fix.mjs). Nothing was posted to X and
nothing was submitted to Ammora in this run.

## Visual bug hunt round 2: 3.1.2 (17 Nov 2026)

Leira, after the 3.1.1 hotfix: "DI EVENFIELD MASIH BANYAK BUG
VISUAL". The hunt standard was Gate 2/17 in full: every screen
screenshotted in segments at 390/360 (dark), 390 (light), 1280
(dark and light) and 1920, plus the GitHub 404, and every frame
VIEWED (134 frames, probe/qa/hunt/). The four probe suites had
passed 69/69 + 48/48 + 18/18 + 15/15 on 3.1.1 while every
defect below was live: presence checks do not see design.

### Catalogue: found in the hunt, fixed in 6e7a13d + 2dcfdc0

1. Sticky bars translucent: header, tab bar and the filter
   strip used a 92% background with backdrop blur; card text
   ghosted through them mid-scroll. All bars now use the
   solid surface colour, blur removed.
2. Sort select wider than the filter strip: capped, the strip
   carries a fade at its right edge, and the strip scroll
   resets to the start when filters change.
3. Quote preset chips overflowed the coin-page dock: presets
   wrap; the dock got roomier padding and targets.
4. Search suggestions: the verdict chip sat beside the name
   and squeezed it into a ~90px column that shredded long
   names. Final form (late fix): the name takes the full row
   (wraps to two lines), the chip sits on its own line under
   it, indented to the name's start. Verified live in
   probe/qa/hunt2/v-search.png.
5. Standalone pages (money, chain, method, dispute, more)
   rendered their h1 with the browser default: the intro
   paragraph struck through the heading's descenders. New
   .page-title rule in the product type scale.
6. Card header: the stage pill crushed the coin name and
   symbol. Header went no-wrap with a two-line name clamp and
   the name carries a title attribute with the full name.
   (Completed in this run, item 21: the clamp alone still
   truncated at 320px.)
7. Tiny snapshot prices printed a dozen decimals and wrapped
   the card price row over three rows: cards now use the
   compact subscript form (0.0₉590); the exact decimal stays
   on the coin page and in the dense table.
8. Holder concentration scale was action-green at every
   value, including the above-30% readings its own sentence
   warns about: the fill turns caution-coloured above 30%.
9. Bonding-curve chart axis labels were 12px inside a
   640-wide viewBox (illegible at phone width): 17px, with
   more bottom room in the viewBox.
10. Stat grids: an odd final tile left a half-empty gap on
    phones: two-column grids, the odd tile spans the row.
11. Board extras (weekly recap, top creators) repeated under
    filtered boards: they render only on the unfiltered
    board.
12. Creator sentence used the plural template for one-launch
    creators ("1 coins"): singular form added, shared by the
    verdict stage and the creator strip.
13. The filter sheet's toggles group was labelled with the
    generic filter title: it has its own "Include" label.
14. Input placeholders truncated at 320px in both languages:
    shortened (money: "Paste a 0x address"; chain: final form
    names both IDs, "91342 or 9134").
15. No branded 404 (the item 3.1.1 recorded and deliberately
    left): public/404.html shipped in the product's own
    colours with a way back to the board.
16. Coin head: the "launched ... ago" fragment wrapped onto
    its own line away from its sentence; kept on one nowrap
    span. The explorer link no longer wraps mid-label.
17. The too-new verdict glyph (a three-quarter circle)
    rendered as a near-blank disc at chip size: replaced.
18. Coin page footer slid under the floating quote dock at
    maximum scroll (late fix): dock pages carry 96px of
    footer clearance on mobile. Verified in
    probe/qa/hunt2/v-coin-bottom.png.

### Completion run (later session, same day)

The hunt worker stopped without a final report (one exec
failed with exit 1; its step is not recoverable from the
logs). State found and resolved:

19. Its deploy (gh-pages fc0b9ef, "final 2") was live and
    correct, but built from a working tree whose last three
    fixes were UNCOMMITTED: main did not match the live
    build, and the next CI snapshot deploy would have
    regressed them. The fixes are committed as 2dcfdc0, and
    source==live was proven by rebuilding from the committed
    tree: the local build reproduced the live entry chunk
    index-CcKiTu_J.js and SW cache evenfield-bCcKiTu_J
    exactly. Three 0-byte scratch files (probe-b.mjs,
    probe-c.mjs, probe-local.mjs) were its only other
    residue; removed.
20. The four suites were then run on that build for the
    first time: qa-matrix 69/69, qa-tasks 48/48,
    qa-wallet-money 18/18, qa-readability 14/15.
21. qa-readability failure, a real app defect: at 320px the
    card-top row overflowed by 5px and the name "Giwamora"
    was cut by 2px, because the no-wrap header let a long
    stage pill ("Close to graduation") squeeze the names
    column to 32px. Fix (6633bc0): the names column keeps a
    96px floor and the header wraps, so the pill takes its
    own row at 320px. Redeployed (gh-pages c0e232b); all
    four suites green on that build.
22. Screenshot review of the verification set caught one
    more copy defect of the 3.1.0 singular class: the card
    stats line read "1 buyers so far". Singular added in
    both languages (049da25). Redeployed (gh-pages b03b929).
23. The final full run then exposed a state-dependent
    failure the earlier runs could not see: qa-tasks 46/48,
    T1 variants at 360x740 (91px visible) and 344x740 (62px)
    against a 100px budget. Cause, measured: the snapshot
    had aged past the stale threshold (7 hours), so the
    two-line stale banner (70px) joined the hero above the
    fold; the earlier green runs had a fresh snapshot and no
    banner. Fix (82a88a7): on small screens the three
    spacings that exist only above the first card tighten
    (lane top margin 48 to 16, search row margin, stale
    banner padding). Re-measured in the stale state:
    139px at 360, 110px at 344, 303px at 390. Redeployed
    (gh-pages fe3484a).
    (The same run was cut once by a dead proxy relay, which
    also killed a suite loop mid-run; the relay was
    restarted detached and the runs repeated in full.)

FINAL VERIFICATION on the final deployed build (source main
82a88a7, gh-pages fe3484a, live entry chunk
index-CrqIwfNc.js verified equal to the local build):
qa-matrix 69/69, qa-tasks 48/48, qa-wallet-money 18/18,
qa-readability 15/15. Verification screenshots viewed, in
probe/qa/hunt2/: w320-home + w320-home-scroll (card headers,
pill on its own row, singular stats line), w390-sticky
(solid bars over scrolled cards), w390-coin-dock (presets
and quote button fully inside the dock), w390-money-title
(page-title rule), w1280-board-sort (rail, presets, capped
sort), w390-404 (branded 404), v-search (suggestion rows),
v-chain (placeholder), v-coin-bottom (footer vs dock).

### Deliberately not fixed, recorded

- The capped sort select clips its own label mid-word
  ("Closest to gradu...") inside the closed native control;
  the full label shows in the opened list. The cap is what
  keeps the strip inside the viewport; widening it reopens
  defect 2. Accepted as the native-control tradeoff.
- Snapshot freshness still depends on the 6h CI cadence and
  its start delays (3.1.1 gap 3): the layout is now robust
  to the stale state, but the pipeline item stays open.
- Boot on ~5 KB/s links is still slow (3.1.1 gap 1) and the
  prerendered static cards are still thinner than the app
  cards (gap 4). Both stay on the improvement list.
- G13 hallway remains PARTIAL (no 5-user test possible in
  this environment). WalletConnect still awaits a Reown
  project ID and the Telegram channel is still
  prepared-not-live; both are Leira's decisions, unchanged.

Rollback: redeploy gh-pages b03b929 (final 4) or fc0b9ef
(final 2), or revert on main and redeploy. Nothing was
posted to X and nothing was submitted to Ammora in this
run; both still wait for Leira's review.

## Total rebuild 4.0.0: "The Dial Room" (17 Nov 2026)

Leira's fourth rejection came with an explicit order: total
rebuild of theme, UI/UX and the whole frontend, no patching.
Kept, per the brief and verified untouched in behaviour: the
snapshot/indexer pipeline and data contracts, the verdict engine
and its calibrated bands, the wallet stack (D3/D11), the money
center engine, the transport discipline, and the 3.1.1 delivery
fixes (inlined CSS, per-build stamped service worker,
previous-generation asset preservation in deploys).

### Study and plan (Gates 0 and 17, before code)
- redesign/study-notes-4.md: Axiom (Pulse three-stage columns,
  row density, pinned action panel; terminal guide updated
  13 Nov 2026), pump.fun (graduation progress as the emotional
  centre), DexScreener (the row is the product; makers column),
  Linear (constant left rail, one accent, keyboard-first).
- redesign/design-plan-4.md: one-paragraph plan (subject,
  audience, one job, one memorable element: the Graduation
  Dial), the banned-catalogue check, and the full semantic
  token set for both themes.

### What is new
- Theme "violet ink": dark canvas #17142B with stepped violet
  surfaces, action #A78BFA, gold #F5C04E reserved for the
  graduation zone; light "porcelain violet" (#F5F3FC canvas,
  action #6D3FD4, gold #9A6B00). scripts/contrast-check.mjs
  carries the new tokens plus gold pairs: ALL PAIRS PASS.
- Type: Sora (display) + Inter (body, tabular figures),
  self-hosted variable woff2 (25 KB + 48 KB), replacing Plus
  Jakarta Sans everywhere including share pages, OG images,
  the 404 page and the manifest colours.
- Frame: desktop header becomes a fixed 232px left rail (nav
  with icons, chain badge, wallet, theme, language at the
  foot); mobile keeps the slim top bar and bottom tab bar with
  the same five jobs in the same order.
- The Graduation Dial (dialSvg in src/main.ts): a 270-degree
  gauge, arc + needle from the measured progressPct, gold zone
  from 86%, full gold when graduated, one 600ms settle
  animation on first render, disabled under reduced motion.
  It replaces the meter bar on cards, appears at 36px in
  dense-table rows and at 92px in the coin page head.
- Lanes view (FilterState.view 'lanes', URL ?v=lanes, storage,
  third toggle in the rail): stage columns in the Axiom Pulse
  pattern. Cards and List are unchanged in behaviour.
- style.css was rewritten from zero (all ~150 component
  classes re-expressed in the new system); radius scale is now
  8/14/22/pill by hierarchy; content width 1760px.

### Gate results on the final build
- G0 plan first: PASS (design-plan-4.md preceded code).
- G1 tokens + computed contrast: PASS, ALL PAIRS PASS both
  themes (table regenerated in redesign/contrast-table.md).
- G2/G3/G4 matrix: qa-matrix 69/69 on the live final build
  (widths 320-1920, foldables, both themes, axe zero
  critical/serious, throttled cards at 4,114 ms).
- G5 budget: entry JS 40.4 KB gzip, CSS inlined as before;
  fonts add 73 KB total, self-hosted, swap.
- G6 sinks: unchanged discipline; the only new template code
  (dialSvg, lanes) interpolates computed numbers and esc()
  strings.
- G13 tasks: qa-tasks 48/48 (run on the pre-lanes-fix build of
  this release; the lanes fix touched only >=1024px lane rules,
  re-verified by qa-matrix and qa-readability on the final
  build). G14: lanes join the same filter pipeline; counts and
  zero states behave identically in all three views.
- G17 hunt, findings fixed in-cycle: (1) 320px top-bar
  overflow of 17px in both languages (qa-matrix), fixed by
  yielding the wordmark text to the dial mark under 400px;
  (2) 1920 grid at 3 columns (qa-readability) after the
  content width was narrowed, fixed by restoring 1760px;
  (3) lane cards crushed at 1440px with the price text
  wrapping one character per line (screenshot review), fixed
  by gating four lanes to >=1750px and dropping the sparkline
  from lane cards. Side-by-side notes against the references
  are in study-notes-4.md; the empty-product and five-second
  checks pass on the viewed v40 screenshots (first card is a
  clean-tier coin with its dial and verdict on its face).
- G13 hallway: PARTIAL, as in every prior release (no 5-user
  test possible in this environment).

### Release record
- Version 4.0.0 (package.json, CHANGELOG.md). Service worker
  cache evenfield-bDSvG7tVB, stamped per build as before.
- Source main 694c8c3; gh-pages 8a780c2; live entry chunk
  index-DSvG7tVB.js verified equal to the local build.
- Verification screenshots: probe/qa/v40-*.png (320, 390,
  1280, 1920, both themes, lanes at 1440 and 1920, coin at
  390 and 1280), all viewed by the builder.
- Rollback: redeploy the 3.1.2 gh-pages tree (fe3484a) or
  revert main to 82a88a7 and redeploy.
- Deliberately left, unchanged from 3.1.2 and recorded there:
  the sort select's closed label clips inside its native
  control (full label on open); snapshot freshness rides the
  6-hour CI; WalletConnect inactive without a Reown project
  ID (Leira's decision); Telegram channel prepared, not live
  (Leira's decision). Nothing was posted to X and nothing was
  submitted to Ammora; both wait for Leira's review of 4.0.0.
