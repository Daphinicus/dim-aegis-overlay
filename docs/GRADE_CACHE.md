# Inventory grade cache

Aegis's state-backed search index grades the complete inventory, including
collapsed groups and items outside the current view. The index and tile renderer
now reuse full weapon and armor evaluation payloads for the page session.

Weapon entries use the instance ID and a signature of the name, hash, selectable
perks, perk names/icons, equipped perks, variant text, and normalized masterwork.
Non-instance previews bypass this cache. Simulated compare inputs have distinct
signatures. Armor entries use the definition hash and name. Each cache retains
at most 4,096 entries and evicts the least recently used entry when full.

Scoring settings, database, and locale reprocessing clear both caches. Name and
icon updates invalidate affected presentation data and rewarm the full index.
The extension's delayed storage write does not invalidate unchanged icon data.
Display formatting receives a copy of the cached result. Caches contain no DOM
elements and are not persisted to storage; route changes preserve them, while a
page refresh or extension reload recreates them.

The optional DIM-SUM loader dispatches `dimsum-grade-preload-request` on its
inventory element. The active Aegis content script synchronously replies in
`data-aegis-grade-preload` with JSON containing `status`, `items`, and cache
statistics. Status is `pending`, `ready`, or `unavailable`. Aegis reports pending
until settings, locale, and the current inventory evaluation have settled;
invalidation withdraws readiness before publishing a new search revision.
Disposal removes the request listener. DIM-SUM removes the temporary attribute
after reading it and owns its bounded loading deadline. Missing providers do not
block loading. The integration does not share grade data across extension worlds.

## Badge restoration on inventory returns

The first grade cache still let replacement tile badges run through the normal
annotation and processing queues. Scores were cached, but badges could fill in
visibly after returning from another DIM page.

`src/inventory-badges.ts` now retains final badge presentation for the completed
inventory revision. When native inventory drag tiles mount, a MutationObserver
attaches their cached badges before the next paint. Only badge rendering runs in
this path; annotations, tooltip preparation, and inventory bookkeeping keep their
normal queues. It uses DIM's native `item.index`, as verified in captured standard
**8.143.0** and beta **8.143.0.4890** source. Instance IDs remain grade-cache keys.

The state projection includes exotic status so category visibility is correct
before native annotation. Existing badge rendering supplies current styles,
colors, split grades, roll stars, and footer sizing. Pending grading revisions
disable restoration, and only a completed revision replaces the current snapshot.
Unavailable/disposed providers cannot restore old grades. Native inventory
boundaries exclude dialogs, simulated Compare rolls, and picker previews.

The DIM-SUM loading-screen implementation is unchanged. A live standard check
after **Reload Aegis Testing** recorded two Inventory → Progress → Inventory
round trips. All 761 expected badges were attached on the first frame with 769
mounted tiles. When hidden groups had mounted, all 973 expected badges were
present among 1,241 tiles. Across 83 and 84 inventory frames, missing-badge and
changed-grade counts both stayed zero. No additional grade evaluations or loader
preparation occurred. Route and scroll were restored, the final screenshot was
checked, and the browser session ended after capture. This is warm route-return
evidence, not a cold-start performance benchmark.

`tests/inventory-badges-browser.cjs` exercises the actual badge renderer and
search-revision lifecycle with 720 tiles across three remounts. It checks the
first frame, hidden groups, no reevaluation, native indexes distinct from
instance IDs, armor/exotic visibility, roll stars, replaced tile children,
changed/removed grades, nested dialogs, current styles, and disposal.
The test runs in the normal browser suite. Logs and captures are the
`badge-route-*` files in DIM-SUM's audit directory.

## Verification

- `tests/evaluation-cache.test.cjs`: state/tile reuse, fresh DIM models, grading
  input changes, masterwork normalization, armor, scoring invalidation, unchanged
  registry persistence, preview isolation, and bounded retention.
- `tests/grade-preload-browser.cjs`: active-provider detection, settings startup,
  batched grading, unrated items, invalidation, unavailable data, and disposal.
- DIM-SUM's `tests/retained-sections.cjs`: optional provider, loader readiness,
  stale markers, shared deadline, cancellation, and removal, using captured
  standard **8.143.0** and beta **8.143.0.4890** React contracts.
- Live standard **8.143.0** in Zen with the **1.9.5** development build: all 1,303
  weapon/armor instances prepared (763 weapon entries, 335 distinct armor
  definitions). Two Inventory → Progress → Inventory round trips added no
  evaluation misses and did not restart DIM-SUM's loading screen. All 1,041 tile
  assets and grades completed in a 4,301 ms warm-cache observation. This does not
  measure cold startup or eliminate badge DOM creation on route returns.

The existing extension IDs, settings, and playtest paths were preserved. Live
reload used **Reload Aegis + DIMSUM Testing**. Collapse settings, route, and scroll
were restored, and the browser test session ended after the final capture. Beta
coverage is automated/source-based, not an authenticated live test. Detailed
logs and live counts are in DIM-SUM's `.tooltip-fix/collapse-audit/` files named
`preload-aegis-*` and `aegis-preload-*`.
