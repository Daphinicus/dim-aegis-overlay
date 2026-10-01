# Testing Aegis

Use Node.js 22 or later and npm. Install dependencies and browser runtimes:

```sh
npm ci
npm run test:browser:install
npm test
npm run build
```

`npm test` runs unit checks followed by browser suites for Compare/Overview,
Bottom Strip, popup layers, the version pill, and perk-tooltip geometry. Browser fixtures run
offline and close their browser processes on success or failure. They do not use
your normal browser profile or require a fixed local port.

To run Firefox instead of Chromium, set `BROWSER_ENGINE=firefox` before running
`npm run test:browser`. In PowerShell:

```powershell
$env:BROWSER_ENGINE = 'firefox'
npm run test:browser
Remove-Item Env:BROWSER_ENGINE
```

For an installed Chromium browser, set `BROWSER_CHANNEL` to `msedge` or `chrome`.
Alternatively, set `BROWSER_PATH` to an executable. Do not combine a Chromium
channel with `BROWSER_ENGINE=firefox`. Playwright's patched Firefox runtime is
required for the automated Firefox suite; a normal Zen executable is not a
replacement for it.

CI installs Chromium and Firefox with their Linux dependencies, runs both browser
suites, builds the extension, and packages the artifacts.

## Fixtures and coverage

The checked-in DIM CSS excerpts and their provenance are in
[`tests/fixtures/dim`](../tests/fixtures/dim/README.md). These tests cover captured
standard and beta markup contracts. They supplement live compatibility testing.

The browser tests use synthetic items and mocked React ownership. They verify
layout, native event-handler preservation, simulated selection, tooltip geometry,
and cleanup without changing an account's equipment. They do not exercise the
Bungie API or prove that private DIM runtime interfaces remain unchanged.

Before release, check the combined extension in standard and beta DIM, in Firefox
or Zen and Chromium, both with and without DIMSUM:

- Compare several rolls and change preview perks, layout, order, and PvE/PvP mode.
- Toggle recommendations off and on; confirm native selectors return.
- In Overview, preview an owned perk and confirm **Apply Perks** remains available.
  Applying it is not necessary for a UI test.
- Hover and focus owned and missing perks, including near viewport edges. Check
  the first visible frame, arrow alignment, late content, Escape, and scrolling.
- Change language while the analysis feature is enabled. Analyses with bundled
  translations and interface labels should use the selected language. Missing
  analysis translations should retain the source text.
- Drag both badge sliders, switch badge styles rapidly, search, and scroll a large
  vault. Check for missing, duplicate, stale, or incorrectly dimmed badges.
- Toggle DIMSUM's stats bar and check Bottom Strip spacing.
- Toggle the 5/5 and omni roll stars under Badges. Check every badge style,
  independent PvE/PvP stars, color-only visibility, and the live preview.

## Review transitions and shared state

Popup first-paint tests exercise the captured release and beta `usePopper` modules
through the native placement adapter. They verify synchronous Aegis preparation,
expanded Overview width, inline height, and cancellation before the first paint.
The adapter replaces positioning only for item popups with the native action rail;
other tooltips keep DIM's hook. If the module signature changes, Aegis retains
native positioning and uses inline content when the sidebar cannot fit. No
visibility timer or post-paint popup flip is used.

When reviewing a UI change, inspect the live DIM structure before assuming that
navigation removes a component. DIM can retain Overview underneath Armory. A
connected element can still belong to an inactive layer.

- Open Armory through the item-name text, the rest of the header button, and the
  keyboard shortcut. Confirm that the underlying sidebar and tooltips disappear,
  Armory's own analysis remains visible, and closing Armory restores Overview.
- Open a new item popup from Armory. Confirm that its own overlays remain visible
  above the older Armory layer. Test with Aegis Armory enhancements disabled too.
- Close, cover, or replace a view while timers, animation frames, locale requests,
  and resize callbacks are pending. Let that work finish and check for restored
  cards, stale content, incorrect positioning, and writes to a newer view.
- Change activity, layout, recommendation settings, and item selection with a
  tooltip open. Include items that lack recommendations for one activity.
- Check that Compare previews remain isolated from inventory grades, shopping
  results, and cached selections, including when a preview opens another popup.
- Check dimensions after content arrives and after it shrinks, including at
  supported zoom and text sizes. Confirm that native positioning and styling are
  restored when the feature is disabled.

Turn confirmed failures into regression tests using the observed ownership and
layer structure. A fixture that removes a popup cannot validate cleanup for a
popup that DIM actually retains. Run the corresponding live transition after
the fix; report fixture coverage separately from live verification.

## Badge ownership and native dimming

As of September 25, 2026, DIM badges remain children of the native item tile.
DIM's search opacity and ancestor filters composite the whole tile, including
its badge. Aegis no longer observes body class/style changes for badge dimming,
reads computed styles to infer search state, or schedules dimming timers.
The old opacity-inherit and descendant dimming rules are removed to avoid
multiplying the tile fade on its badge. This supersedes the earlier native-search
plan's requirement to retain badge opacity synchronization.

Tests in tests/badge-dimming-browser.cjs use production badge injection and CSS.
They cover all four styles and corner positions, directly annotated and wrapped
tiles, picker tiles, variable native search opacity, late badge attachment,
ancestor filters, and intermediate tab-animation frames. They require badges
to remain children of the tile, with no extra opacity/grayscale or per-search
badge style/state writes. Footer, star, and first-paint cache-restoration suites
cover layout and presentation independently.

## Builds and packaging

Native Aegis search has a pinned-DIM browser fixture and an opt-in live consumer
test. See [Native Aegis search](NATIVE_SEARCH.md#verification) for commands,
coverage, compatibility assumptions, and the limits of the current live checks.

`npm run build` type-checks without emitting JavaScript beside TypeScript, then
creates standalone extension bundles in `dist`. Bundlers prefer TypeScript source
even if an older checkout contains ignored generated `.js` files.

After staging new source files, run `npm run build:all`. Packaging writes separate
Chromium and Firefox ZIPs and a source ZIP in the repository root. Browser packages
use the appropriate manifest and preserve nested assets. The source ZIP includes
Git-tracked files, excluding ignored local settings and generated builds.

The package version remains the upstream version until a release version is
approved. Locally generated ZIPs are review artifacts, not published releases.

To update the installed Zen testing extension, use `npm run build:testing` before
the reload shortcut. The shortcut loads the existing testing files; it does not
compile source. See the README for configuration.

## Inventory badge scaling

All four DIM item badge styles now size their layout lengths directly. See
[Inventory badge scaling](BADGE_SCALING.md) for ownership, measured performance,
fractional-font differences, and the independent legacy-zoom comparisons.
Run `tests/badge-scale-browser.cjs` when changing shared badge dimensions or
inline grade colors. Check Classic, Slim Pill, Top Notch, and Bottom Strip;
include popup previews and Aegis-only usage as well as DIM-SUM.


`tests/badge-scale-dependencies-browser.cjs` additionally exercises the
production settings controller against the prior variable-based implementation.
Its 1,680 cases compare geometry, wrapping, and computed appearance through
size/text/color updates. It checks real hover, preview and reading surfaces,
new badge attachment, stylesheet reuse/recovery, and color-cache invalidation.
Run it when changing resolved badge lengths or inline text-shadow caching.
It is included in the standard browser test runner.

The footer-root investigation expanded that matrix to root dimensions, fonts,
shadows, and pseudo-element appearance. Static hover geometry must be captured
while each reference frame is actually hovered; one pointer cannot hover both
frames simultaneously. The test then removes the static transition override to
verify idle transitions and preserved hover-fade entry/exit timing.

## Stat letter variant

The fifth item badge style uses one colored letter in DIM's existing stats bar.
See [Stat letter experiment](STAT_LETTER_EXPERIMENT.md) for its independent
activity/grade choices, native-bar lifecycle, and reversible settings.

`tests/stat-grade-browser.cjs` covers 42 standard/beta bar and grade cases,
one-letter normalization, missing source data, native-node identity, row geometry,
color changes, and removal. The inventory-badge, badge-stars, activity-mode,
and translation suites cover live bar replacement, options/preview controls,
saved activity restoration, and all six languages. These checks are included in
the regular test runners.

The September 26 Chrome comparison keeps all tile decorations enabled. Its
24-switch confirmation, separate detailed traces, and Chrome/Zen functional
checks are documented in DIM-SUM's `docs/stat-letter-performance.md`. These
measurements use a live standard account; beta account behavior remains a
fixture check. Raw inventory captures remain private.
