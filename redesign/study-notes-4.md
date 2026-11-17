# Study notes 4: total frontend rebuild 4.0.0 (17 Nov 2026)

Leira rejected the product a fourth time and ordered a TOTAL rebuild of
theme, UI/UX and the whole frontend ("YANG EVENFIELD MASIH JELEK, COBA
ROMBAK TOTAL TEMA, UI UX DAN SELURUH FRONTEND NYA"). Patching is
forbidden. What survives, per the brief: the data pipeline and
snapshot/indexer, the verdict engine and its logic, the wallet stack
(D3/D11), the money-center logic, and the data contracts. Everything
visual is replaced: identity, colour theme, typography, layout,
navigation, every component, and the information architecture where it
clarifies the core job.

## Reference study (web, 17 Nov 2026)

### Axiom (axiompro.app terminal guide, updated 13 Nov 2026; reviews Oct-Nov 2026)
- One top bar is the whole map: product tabs, search, chain selector,
  wallet. Everything below belongs to the open tab.
- Pulse (the launchpad feed) is three stage columns: New Pairs, Final
  Stretch, Migrated. Stage is the primary organising idea, not a filter
  buried in a sheet.
- Discover rows carry many data points per item (age, liquidity,
  holders, concentration) and a quick action on the row itself.
- Token page splits: chart and evidence on the left, action panel
  pinned on the right. Density is the product's identity; mobile is a
  reduced single column, honestly secondary.
- Lesson for Evenfield: stage columns on desktop, one-tap quick read
  per row, action pinned beside content. Our difference: Axiom shows
  market data only; our rows lead with a judged verdict, which Axiom
  does not have at all.

### pump.fun (front page observed 8 Nov 2026, per PumpCrate study)
- Front page is panels with intent-named tabs (Trending, Movers, New,
  Graduated, Most holders, Soon) and time windows; the bonding-curve
  progress percentage is the number every card leads with.
- Graduation is the emotional centre: progress toward it is shown
  everywhere, as a bar and a percentage.
- Lesson: progress-to-graduation deserves a first-class visual device,
  not a thin bar under a card. Evenfield 4.0 makes it a dial (below).

### DexScreener (guides and site recon, Nov 2026)
- A row IS the product: pair, price, age, txns, volume, makers in one
  dense line; columns are the interface. Makers (distinct wallets) is
  the column beginners ignore and the one that matters.
- Filters are numeric thresholds (min liquidity, min volume, max age),
  one button, applied to the list in place.
- Lesson: at desktop widths a true table with sortable columns beats
  cards; keep the makers/buyers column prominent. Evenfield already
  has the dense table; 4.0 makes the table the DESKTOP DEFAULT and
  cards the compact alternative, the reverse of 3.x.

### Linear (non-category polish reference, from product knowledge)
- Left sidebar rail as the app frame; content sits in a quiet canvas;
  one accent used sparingly; keyboard-first (Cmd+K, single-key
  shortcuts); everything else recedes. The frame never changes between
  pages, so the user always knows where they are.
- Lesson: a persistent left rail on desktop (Board, Watching, Money,
  Chain check, Method, More) replaces the top-nav-plus-tabbar split of
  3.x. Mobile keeps a bottom bar, but the rail's order and names are
  identical, so the map is the same on both.

## What the references do that 3.1.2 did not
1. Stage is structure, not a filter (Axiom Pulse): 4.0 board on desktop
   is a three-lane stage board (New / Filling up / Graduated) when the
   "Lanes" view is chosen, and a dense table otherwise; on mobile the
   stage becomes the segmented control at the top of the list.
2. Progress is a device, not a bar (pump.fun): the graduation dial.
3. Rows carry more judged data per item (DexScreener density plus our
   verdict): price, dial, buyers, trades, last trade, holder top-10,
   verdict chip, creator record chip, all in one row.
4. The frame is constant (Linear): sidebar rail, same on every route.

## The empty-product reality check (Gate 17, counted from the snapshot)
Current snapshot (145 launches, 48 creators at last build): verdicts
careful 68 / test 39 / too-new 21 / clean 12 (3.1.0 census of 140).
Default view must lead with judged, non-test coins and the clean tier
must be visible above the fold; the dial makes progress the loudest
element, not a caveat. Preset counts stay live and zero presets stay
status text (3.x rule, kept).
