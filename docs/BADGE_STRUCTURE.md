# Split badge structure

Split grades in Classic, Slim Pill, and Bottom Strip badges render their
text directly in the two colored halves. Each badge removes two redundant
`.aegis-grade-text` spans. The halves use `.aegis-split-label` to apply the
existing text treatment. This affects Aegis inventory badges independently of
DIM-SUM; it is not a DIM-SUM override.

Single grades retain a separate text item beside their upgrade indicator. Top
Notch retains its text wrappers for clipped, single-line alignment. Footer
flattening requires CSS support for block content alignment, text trimming, and
`overflow:clip`; older engines retain their wrappers.

Footer labels use block text alignment and the same cap/alphabetic trimming as
the former inner span. `overflow:clip` is deliberate: `overflow:hidden` creates
a scroll container, which changed Firefox's text position by up to 1.37 CSS px
and Chromium's text painting at DPR 1.5. Clip preserves the bounds without that
scroll container. The final implementation needs no engine-specific exception.
Stars and adaptive footers retain untrimmed text. Color-only mode hides glyphs
without deleting grades needed for color selection and accessible labels. See
the CSS specifications for
[text trimming](https://drafts.csswg.org/css-inline-3/#text-box-trim) and
[block alignment](https://drafts.csswg.org/css-align-3/#align-block).

Template caching, grading, tile ownership, search opacity, wrapping, footer
height measurement, and tooltip/detail typography retain their existing paths.
This change adds no observer, layout measurement, scroll handler, or visibility
gating. Popup option previews keep their existing structure.

## Verification

`tests/badge-structure-browser.cjs` extracts the production template builder
and compares its output with the previous wrapper structure. Its 1,680 cases
cover all four styles, corner positions, widths, text and badge sizes, ordinary
and dual grades, roll stars, upgrade indicators, and color-only mode. Assertions
cover tile/icon/badge/upgrade geometry, text rectangles and wrapping, accessible
labels, color settings, and size changes on existing nodes. A separate painted
comparison covers 24 representative badges at DPR 1 and 1.5, with identical
pixels in both browsers. Chromium removes 1,728 elements across the complete
geometry fixture.

The Chromium matrix passed with native styling and all six DIM-SUM font options
in both standard and beta stylesheets (23,520 cases). Zen 1.22.3b passed the
1,680-case geometry, wrapping, and pixel comparisons at DPR 1 and 1.5 with the
shared clipping rule. The
Aegis unit/browser suites and TypeScript build passed. Fixture channels use
DIM standard 8.143.0 and beta 8.143.0.4890; this does not claim signed-in beta
verification or a full Firefox browser-suite run.

## Performance evidence

The frozen 1,044-item inventory loses 1,454 Weapons-panel descendants: 8,141
becomes 6,687. Median inert-triggered style/layout flushing was 21.95 ms with
the previous structure and 21.55 ms after flattening. DOM count alone therefore
does not establish a large speedup.

The first live prototype comparison used Chrome 153.0.8010.54, standard DIM
8.143.0, 1,050 items, 816 badges, Bottom Strip at 105% size and 130% text size,
DIM-SUM's theme, 1064 × 1826 CSS pixels, DPR 1, and no throttling. After warming
scroll positions, the order was reference/new/new/reference, with eight tab
actions and eight scroll jumps per condition. Performance metrics and passive
long-animation-frame entries covered 1.8 seconds after each action; no repeating
animation-frame sampler ran. Median tab style work was 69.68 → 65.79 ms, layout
2.72 → 4.19 ms, and total task work 305.02 → 261.02 ms. These small samples are
work within an observation window, not input latency or proof of smooth motion.

Raw captures, screenshots, and rollback files remain private under DIM-SUM's
ignored `.tooltip-fix/chrome-comparison/badge-structure*` paths. The
`badge-structure-before` directory contains the source and stylesheet from
before this change. Roll back only the template flattening and
`.aegis-split-label` rules, then rebuild; keep earlier scaling, search, and
inventory optimizations intact.

The final build loaded through the shared Aegis reload shortcut in Chrome and
Zen. Both passed five live tab transitions with synchronized clocks, visible
intermediate fades, correct inert/ARIA state, and retained native tiles. Chrome
also passed live option changes, previews, tooltip opening/dismissal, viewport
bounds, and original Aegis tooltip typography for all four badge styles. Saved
preferences were restored. Zen's current live preference renders single grades;
its split-badge coverage comes from the production-template fixture. These are
separate correctness checks, not a matched Chrome-versus-Zen performance test.

DIM-SUM compatibility and all standard/beta acceptance checks passed. The beta
control-tooltip timing fixture, which loads DIM-SUM alone, failed intermittently
and passed after restoring the unchanged test; no tooltip production code or
permanent tooltip-test changes were made. Beta coverage remains fixture-based.
