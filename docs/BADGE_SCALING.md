# Inventory badge scaling

## Ownership

DIM item badges in Classic, Slim Pill, Top Notch, and Bottom Strip scale their
CSS lengths directly. `.item > .aegis-badge` owns `--aegis-badge-px` and has
`zoom: 1`. The existing badge-size preference supplies the unit. Text size
remains an independent multiplier. No new observer, per-item measurement,
annotation, or size-fitting loop is introduced.

Shared borders, offsets, padding, lettering, shadows, and upgrade indicators
consume that local unit. Their `1px` fallback preserves the original dimensions
for reading surfaces, popup previews, shopping results, and other hosts. Those
contexts retain their existing zoom behavior. The grade-color renderer uses the
same selected size for its inline text shadow; otherwise its important inline
declaration would bypass the stylesheet's scaling. Inventory split labels now
resolve the unit to numeric lengths on settings changes, as described below.

Bottom Strip keeps DIM's tile containment and its 1px icon frame. Fixed strips
reserve their scaled height. Adaptive strips reserve the existing resize
observer's measured CSS height directly, because that measurement already
includes the selected size. Multiplying the measurement again would create
excess space. The observer and badge refresh scheduler are unchanged.

Wrapping, roll stars, color-only modes, corner positions, upgrade styles,
hover fading, native search opacity, and tile ownership remain supported.
Animation timing and DIM-SUM's synchronized tab movement are not changed.

## Why this scope matters

An initial footer-only experiment made the other three styles slower in the
frozen inventory test: their shared declarations gained variable calculations
while their badge subtrees still used zoom. It was removed from the live build.
The complete approach uses direct sizing for all four DIM item badge styles.
Always compare every style, with and without DIM-SUM, when changing shared rules.

A transform-only prototype changed wrapping and adaptive strip heights and was
rejected. A separate fixed-height/no-wrap experiment did not improve the measured
style-update operation (about 23.8 ms versus 23.0 ms with wrapping). Wrapping stays
enabled. These findings do not establish the cost of every possible badge update.

## Performance evidence — September 25, 2026

A frozen, script-free DIM standard inventory contains 1,044 items, 806 badges,
and 8,141 Weapons-panel descendants. Each run toggles panel inertness and forces
one style/layout update 14 times; the first two samples are discarded. Both CSS
versions use the same DOM, badge style, font, viewport, and native styles. Two
runs per combination execute in forward/reverse order without competing suites.
The new variant also includes the production inline text-shadow expression.
These are median milliseconds for that operation, not end-to-end tab latency.

| Badge style | Aegis before | Aegis after | With DIM-SUM before | With DIM-SUM after |
| --- | ---: | ---: | ---: | ---: |
| Classic | 18.2 | 15.1 | 25.4 | 21.4 |
| Slim Pill | 19.5 | 14.7 | 26.8 | 21.4 |
| Top Notch | 19.3 | 15.9 | 25.8 | 21.3 |
| Bottom Strip | 22.3 | 17.4 | 29.9 | 24.8 |

The live Chrome comparison uses DIM standard 8.143.0, 1,050 items, 816 badges,
DIM-SUM's theme/default font, 105% badge size, 130% text size, a 1064 × 1826
CSS-pixel viewport, DPR 1, and no CPU/network throttling. Aegis's actual options
controls switch styles; the original preference is restored afterward. After
warming the page, each style records Armor → Weapons → Inventory → Weapons,
with 1.6-second observation windows and no DevTools trace instrumentation.

| Badge style | Live style work before | Live style work after |
| --- | ---: | ---: |
| Classic | 54.3 ms | 50.7 ms |
| Slim Pill | 50.1 ms | 50.2 ms |
| Top Notch | 50.2 ms | 52.5 ms |
| Bottom Strip | 60.5 ms | 53.6 ms |

These live medians contain only four switches per style/version. They show a
Bottom Strip improvement and mixed results for the other styles, not a proven
live speedup for every style. Frame gaps still reach about 79 ms afterward, so
this change does not eliminate tab hitching. All four option-preview dimensions
match the baseline exactly. Settings and mounted inventory counts match.

The live all-style comparison is separate from the frozen Aegis-only comparison;
no Aegis-only signed-in timing claim is made. Private artifacts are named
badge-style-performance*, badge-styles-live-before*, and badge-styles-live-after*.

## Verification

`tests/badge-scale-browser.cjs` is part of the browser suite. It compares the
production CSS against an independent legacy-zoom override in 1,680 cases:

- All four badge styles, including wide, split, dual, starred, and color-only badges.
- All supported corner positions for Classic and Slim Pill.
- Three tile widths, four badge sizes, and two text sizes.
- Upgrade indicators, adaptive footer measurements, and real hover states.
- Production grade-color application, scaled inventory text shadows, and
  unchanged reading-surface text shadows.

Chrome 153.0.8010.54 passed the matrix at DPR 1 and 1.5. Zen 1.22.3b matched tile, badge, and text
rectangles exactly in the same 1,680-case geometry/wrapping fixture. The full
Aegis unit and Chrome browser suites passed; the build and targeted badge/preview
checks passed again after updating the grade-color text shadow. The bundled
Playwright Firefox could not launch in this environment, so the Zen result is
from the installed browser through WebDriver BiDi, not that full Firefox suite.

A separate DIM-SUM integration comparison uses the original complete Aegis
stylesheet, both generated DIM channels, and all six selectable font families
plus native styling. Its 23,520 cases preserve wrapping and tile heights.
Direct font sizing and fractional zoom can round differently: the largest
observed auto-width difference was 0.172 CSS px, and Classic at 70% badge size
with 130% Neue Haas text differed by one pixel in the text rectangle. The affected
text was visually inspected. These checks allow at most 0.25 CSS px of badge
geometry difference and one pixel of text bounds; they do not claim pixel-identical
rasterization. Preview and reading-surface measurements match exactly.

Raw inventories, traces, settings backups, and screenshots remain local under
DIM-SUM's `.tooltip-fix/chrome-comparison/`. They must not be committed or published.
The local `badge-scale-before/` directory contains the original CSS, live content
and popup bundles, and the original grade-color source for rollback.

## Live activation and integration checks

The final CSS, content bundle, and popup bundle were staged through the existing
Reload Aegis Testing shortcut in Chrome and Zen. DIM standard 8.143.0 reports
1,050 items and 816 badges in each browser, with direct badge sizing and the
scaled inline text shadow active. Five tab transitions preserve visible fade
frames, the shared animation clock, native tile ownership, and inert/ARIA state.
Chrome's live expanded detail dock retains Aegis's original system font and
stays within the viewport. All temporary tabs are closed and saved style/dock
preferences are restored after checks.

Chrome's live check switches all four styles through the actual options controls
and verifies their previews. Zen blocks WebDriver BiDi navigation to its extension
options page. Its live check therefore covers the saved Bottom Strip setting;
its 1,680-case production-CSS fixture covers all four styles. No browser security
setting was changed to expand automation access.

DIM-SUM compatibility and its full standard/beta channel suites passed. The first
standard item-tooltip timing assertion failed, then passed on an unchanged
resumed run. That fixture loads DIM-SUM only. The beta suite passed in the resumed
run. Channel coverage uses standard 8.143.0 and beta 8.143.0.4890 fixtures; it is
not a signed-in live beta verification.

## Split-label dependency update — September 25, 2026

The local testing build now generates one inventory-scoped stylesheet in
`src/inventory-badge-scale.ts` at startup and when size or text-size settings
change. Split-label padding, borders, tracking, and transition text sizes use
numeric lengths. Grade-color inline shadows use the same resolved badge size.
Color-only exceptions retain their original precedence. Preview and reading
surfaces retain their local units and original typography.

Existing colored inventory badges refresh only their shadows after a size
change. The color cache includes the resolved shadow and still invalidates
external inline edits. Newly attached badges receive the current shadow during
color application. Repeated settings and grade renders do not rewrite the
stylesheet. There are no new geometry reads, observers, timers, or per-tab work.

`tests/badge-scale-dependencies-browser.cjs` compares 1,680 combinations against
the prior variable-based implementation, including all four styles, positions,
wide/split/dual grades, stars, color-only badges, upgrade indicators, wrapping,
size/text/color changes, hover, and unchanged preview/reading styles. It checks
computed visual properties as well as geometry, sheet reuse and recovery, new
badge attachment, and color-cache invalidation. Chromium passes at DPR 1 and
1.5; installed Zen 1.22.3b passes through WebDriver BiDi. The full Aegis unit and
browser suites pass. The final cache safeguard passed the focused matrix and
TypeScript build after the full-suite run.

Both local Aegis testing builds loaded through the existing reload shortcut.
The before/after Chrome trace retains the same installed DIM-SUM bundle, DIM
standard 8.143.0, 1,050 items, 816 badges, 105% badge size, 130% text size, and
1064 × 1826 viewport at DPR 1. Each version records eight warmed switches with
four-second windows and CPU/invalidation instrumentation. Median total style
work falls from 71.1 to 58.6 ms; the largest Weapons-departure pass resolves
4,838 elements instead of 6,310. The difference matches 1,472 split labels.
These are instrumented attribution measurements, not general speed claims.

Weapons arrivals still show 79–108 ms frame gaps and 30–41 ms of merged paint
work. Roughly 4,800–4,900 elements still receive full style resolution in the
largest pass. This fix removes one contributor; it does not resolve all tab
hitching. No new live-beta or Firefox timing claim is made. Private traces and
source backups are under DIM-SUM's `.tooltip-fix/chrome-comparison/` with the
`badge-dependency-` prefix; do not publish them.

## Rejected footer-root prototype — September 25, 2026

A temporary extension of the shared numeric stylesheet resolved Bottom Strip
root geometry and shadows, removed unused transition declarations, and used a
DIM-SUM companion font rule. It passed the full unit/browser suite, TypeScript
build, expanded 1,680-case appearance/geometry matrix at DPR 1 and 1.5, and the
installed Zen matrix. All enabled decorations and original reading typography
were preserved.

The candidate avoided 736 full style resolutions on Weapons departures and
Inventory → Weapons. Its isolated style-operation median fell from about 16.9
to 13.8 ms. Armor → Weapons still resolved the roots. Two same-page comparisons
showed higher arrival style cost, while a subsequent font-isolation comparison
changed direction. This does not establish a reliable overall benefit or prove
font inheritance caused the earlier penalty.

The production candidate was withdrawn. All four changed Aegis source files
were restored, its helper was removed, and DIM-SUM's companion rule was removed.
Both testing builds were rebuilt and reloaded through the combined shortcut.
The earlier split-label optimization remains active. Expanded root/descendant/
pseudo-element appearance coverage and the corrected static-hover comparison
remain in the regression matrix. No saved preferences changed.

Candidate sources, pre-change backups, traces, and inventories remain private
under DIM-SUM's existing Chrome comparison directory, using `max-decor-`
prefixes. See its `docs/footer-style-dependencies.md` for all timing results,
negative painting experiments, rollback verification, and the next investigation.

## Letter badge

The optional Letter style uses one grade, including plus grades, in DIM's native stats bar. Its text inherits the native row size and remains left-aligned and vertically centered. It does not use the inventory badge scaling or footer-sizing controllers. See [Letter badge](STAT_LETTER_EXPERIMENT.md) for its settings, fallback behavior, and verification.
