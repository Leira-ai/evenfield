# Evenfield changelog

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
