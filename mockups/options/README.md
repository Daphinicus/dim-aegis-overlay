# Compact options prototype

Branch: `feat/compact-options`, based on customization commit `5b1415f`.

The popup remains 320 CSS pixels wide. Four tabs group badges, scoring, item details, and data maintenance. Existing controls and setting values are preserved; shorter headings follow the existing translation tables in all six supported languages.

Setting labels and segmented choices share a row. Short option names keep every choice visible, with the original descriptions retained as localized tooltips and accessible names. Upgrade styles use the actual badge icons; corner positions use a spatial arrow grid. Numeric size controls keep their slider and current value inline.

The header and tab bar stay visible. Each panel scrolls within the remaining viewport and remembers its position while switching tabs. The comparison's custom scrollbar follows the active panel; the current-menu preview retains its original whole-page scrolling.

This is a review prototype, not an installed playtest or submitted PR. The initial tab is Badges. Keyboard arrows, Home, and End navigate tabs. Color and grading editors remain accessible through the existing header and scoring guide.

Option highlights slide over 150 ms. Dependent badge/scoring rows expand and collapse over 200 ms, with immediate setting changes and inert collapsed controls. Tabs crossfade over 140 ms with a 5 px directional shift; the outgoing panel immediately becomes inert and leaves the accessibility tree. The tab bar stays fixed and panel height changes immediately. Initial rendering and reselecting the active tab do not animate. System reduced-motion preferences disable these transitions. No animation dependency is added.

Build with the existing TypeScript/build commands, then run `node mockups/options/server.cjs` from this checkout. Open `http://127.0.0.1:4319` for the comparison. The current-menu comparison reads the sibling `aegis-custom-grades/dist` directory. The preview uses in-memory sample settings: refreshing discards edits, and sync calls do not reach extension services.

Verification: TypeScript and extension build; four tabs at 320 px across six languages; color and criteria dialogs; rapid animation reversals, intermediate reveal heights, collapsed focus handling, reduced motion, idle cleanup, and highlight alignment. Full installed-extension regression testing is deferred until the layout is accepted.
