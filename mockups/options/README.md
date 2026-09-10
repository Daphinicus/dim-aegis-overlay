# Compact options prototype

Branch: `feat/compact-options`, based on customization commit `5b1415f`.

The popup remains 320 CSS pixels wide. Four tabs group badges, scoring, item details, and data maintenance. Existing controls and setting values are preserved; shorter headings follow the existing translation tables in all six supported languages.

This is a review prototype, not an installed playtest or submitted PR. The initial tab is Badges. Keyboard arrows, Home, and End navigate tabs. Color and grading editors remain accessible through the existing header and scoring guide.

Build with the existing TypeScript/build commands, then run `node mockups/options/server.cjs` from this checkout. Open `http://127.0.0.1:4319` for the comparison. The current-menu comparison reads the sibling `aegis-custom-grades/dist` directory. The preview uses in-memory sample settings: refreshing discards edits, and sync calls do not reach extension services.

Verification: TypeScript and extension build; four tabs at 320 px across six languages; color and criteria dialogs. Full installed-extension regression testing is deferred until the layout is accepted.
