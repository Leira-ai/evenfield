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

## Submission package (prepared, NOT sent)

- X post draft: `builder-post.txt` (max 280 chars, mentions @AmmoraHQ,
  claims only what the live browser check verified).
- Submit payload shape for the Ammora Season 2 API:
  `signed_action("submit", { kind: "builder", project: "Evenfield",
  website: "https://leira-ai.github.io/evenfield/", url: "<X post URL
  after posting>" })`. Posting and submitting wait for Leira's review of
  the live artifact.
