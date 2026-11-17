# Design plan 4.0.0: "The Dial Room" (Gate 0, written before code)

## The paragraph
Evenfield is a judging room for Ammora launches: a visitor arrives
wanting to know, in seconds, which new coins deserve their money and
which creators deserve their trust. The audience is mobile-first Web3
retail meeting a testnet launchpad today and a mainnet one tomorrow.
The product's one job is the judged board: every coin carrying a
verdict built from on-chain receipts, next to the price and the path
to graduation. The one memorable element is the Graduation Dial: a
chunky radial gauge on every coin, on the board and huge on the coin
page, whose needle sweeps toward a gold graduation zone. Everything
else, the rail, the table, the sheets, stays quiet so the dials and
the verdicts are the picture.

## Direction check against the banned catalogue (Gate 0)
- Not warm cream + terracotta. Not near-black + one acid accent (the
  canvas is a saturated deep violet, and there are two working accents
  plus full semantic colours). Not broadsheet hairlines. Not the
  SaaS-card kit: the desktop board is a table and stage lanes, cards
  survive only as the mobile list form, with three different radii by
  hierarchy. No all-caps tracked eyebrows. No big-number hero: the
  board opens with a one-line promise and goes straight to dials.
- The old "field at dusk" (green charcoal, #0D130F family, mint
  accent, Plus Jakarta Sans, top header + hero + strip + card grid)
  is discarded entirely: new hue family (violet), new typefaces
  (Sora display + Inter body), new frame (left rail), new board
  (table-first, stage lanes), new device (the dial).

## Colour tokens (semantic, Gate 1; ratios computed by script)
Dark (default), "violet ink":
- canvas #17142B, surface.1 #1F1B38, surface.2 #272145, surface.3 #322A55
- text.1 #F2F0FA, text.2 #C6C0DE, text.3 #9A92BC
- accent (violet) #A78BFA on canvas for large/UI, accent.strong #C4B0FF
- gold (graduation) #F5C04E, positive #3ECF8E, caution #FFB224,
  danger #FF6B5E, info #5EC8FF
- border.subtle #38325C, border.interactive computed to >= 3:1
Light, "porcelain violet":
- canvas #F5F3FC, surface.1 #FFFFFF, surface.2 #EEEAF9, surface.3 #E2DAF3
- text.1 #1D1836, text.2 #4A4270, text.3 #6E6394
- accent #6D3FD4, gold #9A6B00 (text-safe), positive #0E7A4C,
  caution #9A6200, danger #C23418, info #0B6FA4
- border.subtle #D9D2F0, border.interactive computed to >= 3:1
Elevation: dark by lightness steps, light by soft violet-tinted shadow.
Radius scale: 8 / 14 / 22 / pill, assigned by hierarchy (rows 14,
panels 22, chips pill, dial housing 22).

## Type
- Display: Sora (self-hosted variable, weights 400-800), headings and
  the dial numerals.
- Body/data: Inter (self-hosted variable), tabular numerals for every
  figure. Two families, clearly distinct roles.
- Scale 1.25: 12/14/16/20/24/30/36/48. Line heights 1.15 headings,
  1.5 body.

## Layout
- Desktop (>= 1024px): fixed left rail 232px (wordmark, nav in job
  order, chain badge, wallet, theme and language at the foot); content
  column to 1560px. Board default = dense table; "Lanes" toggle =
  three stage columns. Coin page: dial hero left, quote panel right
  (sticky), evidence below.
- Mobile: slim top bar (wordmark, chain pill, wallet icon), stage
  segmented control, dial rows as list cards, bottom tab bar with the
  same five jobs in the same order as the rail.
- Motion: the dial needle animates once on first render (600ms,
  ease-out) and never again; reduced-motion disables it. Nothing else
  animates except sheet/dock transitions answering a tap.

## Copy rules (unchanged product rules)
First sentence is the verdict; every number carries its meaning;
errors in plain words with the next step; no motive words; EN and ID
at parity; relative times only.
