# Combined-source score validation

Validated on October 1, 2026, in the signed-in persistent testing profiles. This draft combines the percentage-score trial with all 100 modified or untracked source files captured from the local Aegis checkout at `f7171f6`. The user explicitly authorized publishing the combined source. The original checkout's files are unchanged; a final comparison against the snapshot found no subsequent local changes.

The integration preserves version 1.9.5, personal wishlist and bookmark behavior, the newer native DIM search, menus, badge and tooltip layouts, and stable testing extension IDs. DIM-SUM Compare and Shader Browser work was coordinated through exclusive browser/install handoffs. Aegis changed no DIM-SUM source or installed files. Its final reload retained the released Compare CSS.

## Fixes found during integration and live testing

- Use the current inventory cache and native search pipeline for score evaluation, raw numeric filtering, and presentation changes.
- Keep numeric badges neutral, including native search results and the Letter stat-row style. Switching back to Grades restores grade presentation.
- Recognize current DIM/Bungie socket families, including scopes, tubes, blades, bowstrings, hafts, rails, grenade-launcher magazines, batteries, guards, arrows, bolts, frames, and origins. The initial authenticated scan exposed the missing category mappings.
- Narrow selectable options only for actually crafted items. Random drops can carry crafting metadata; Explosive Personality supplied a real regression case.
- Read accuracy, heat-efficiency, and shield-duration masterworks. For Tier-5 stat bundles without a primary stat marker, use the equipped masterwork plug type. Unsupported types remain unknown.
- Bind sorted shopping hover details to the copy's instance identity. The original unsorted array index could select a different owned copy after score sorting. Best-alternative hovers use the same ordering.
- Preserve score details and the delegated Copy action through cloned DIM-SUM preview cards.

Fifteen sanitized captured socket fixtures are committed in [live-owned.json](../tests/scores/fixtures/live-owned.json), with 19 regression tests in [live-owned.test.ts](../tests/scores/live-owned.test.ts). They include actual selectable drops, crafted items, enhanced/base identities, multiple origins, special socket families, and masterwork configurations. Account and instance identifiers are excluded. These supplement the modeled acceptance fixtures rather than replacing them.

## Automated validation

- `npm install`: passed.
- `npm run test:scores`: 145 tests passed in six files.
- TypeScript `tsc --noEmit`: passed.
- Existing unit suite: passed after the ownership and sorted-copy fixes.
- Existing Chromium browser fixtures: all 22 suites passed on the final source, including standard/beta tooltip placement, cached rendering, native Boolean search, Compare exclusions, menu behavior, and badge geometry.
- `npm run build:all`: passed on the final source; Chromium, Firefox, and source archives generated locally.

The browser fixtures use local DOM and preview data. They are distinct from the authenticated results below. Source refresh, missing-source behavior, settings reload, stale tile reuse, and score invalidation are covered by automated fixtures; destructive live source-cache changes were not performed.

## Browser and installation metadata

| Target | Version/build | Viewport in CSS pixels | Device pixel ratio |
| --- | --- | --- | --- |
| Chrome, DIM standard | Chrome 154.0.8037.59; DIM 8.144.0 release, `main-aab428e8.js` | 1082 × 1073 | 1.5 |
| Chrome, DIM beta | Chrome 154.0.8037.59; DIM 8.144.0.4903 beta, `main-65a4edfb.js` | 1082 × 1073 | 1.5 |
| Zen, DIM standard | Zen 1.22.3b / Gecko 156.0; same standard DIM bundle | 1064 × 1826 | 1 |
| Zen, DIM beta | Zen 1.22.3b / Gecko 156.0; same beta DIM bundle | 1064 × 1826 | 1 |

DIM versions were read from the exact public main bundles recorded by the live pages. All four timing runs reported visible, focused documents and received foreground animation frames. The theme was `theme-dimdark`; visual viewport scale was 1. Browser zoom was not independently established, so device pixel ratio is not presented as a zoom measurement. Chrome focus emulation was enabled through the existing relay.

Stable installations:

- Chrome Aegis: `C:/Users/dante/Documents/Codex/2026-09-05/cva/work/dimsum/.tooltip-fix/chrome-comparison/extensions/aegis`, ID `pdnhnmdhokcbnodocpokmbocibgjhopo`.
- Chrome DIM-SUM: the sibling `dimsum` directory, ID `hkfijiibhihimgcmdnafeiglnceoaobn`.
- Zen Aegis: `C:/Users/dante/Documents/Codex/2026-09-12/i/outputs/Aegis-performance-playtest/extension`, ID `dim-aegis-overlay@maxeption.github.io`.
- Zen DIM-SUM: `C:/Users/dante/Documents/Codex/2026-09-05/cva/outputs/dimsum-playtest/extension`, ID `dimsum@daphinicus.local`.

Final production JavaScript SHA-256 hashes:

| Bundle | SHA-256 |
| --- | --- |
| `background.js` | `c98628a1cfc862d3be4bc577e493046fe566f6059b796c2410dfd3f4e93b31ed` |
| `content.js` | `9ba3b20cd3e019c3020e73dadd28001909c68722c1c747fc9c6cdbd28657522c` |
| `main-world-content.js` | `c9581fec20238bb064d129edeec2292b391ae7d7a42f51e89a2680ddbe845572` |
| `popup.js` | `5f737655b09fec2508ce590ef21fea716596adacc55f0dc5d1a82f752c6d48a9` |

The final stock build verified 28 Zen files. The official Aegis-only reload helper activated both extensions in all four existing Chrome DIM tabs; Zen's separate activation records also report both extensions active. Staging alone was not counted as activation.

## Authenticated functional results

Chrome standard was tested before Chrome beta, followed by Zen compatibility. All four functional matrices completed with zero assertion failures after the socket fixes:

- Grades/Scores switching; Best/Omni; PvE, PvP, and both; precision 0, 1, and 2; switching back to Grades.
- 18 profile/activity/precision combinations per target. Five badge styles and two positions were exercised under active DIM-SUM delegation. Standalone badge geometry and scale coverage comes from the browser fixtures; this live matrix does not establish all standalone scales.
- 616 actual owned legendary instances, including 34 crafted items. Cloned runtime preview checks preserved ownership across 2,835 perk selections and 596 masterwork-level changes. Changing the masterwork type invalidated the ownership signature in 596 checks. These checks cloned live item structures and did not change game inventory or crafting selections.
- Native numeric search agreed with raw score evaluations and excluded armor. Precision changes retained exact matching identities. Unrated values did not compare as zero. Legacy grade and shopping-priority queries retained their behavior.

| Query | Matches, identical across all four targets |
| --- | ---: |
| `aegis:score:>=90` | 48 |
| `aegis:pve:score:>89.99` | 27 |
| `aegis:pvp:score:<=80` | 349 |
| `aegis:score:unrated` | 339 |
| `aegis:score:omni` | 1 |
| `aegis:>=S` | 458 |
| `aegis:shopping:high` | 26 |

Chrome's actual popup menu persisted display/profile/precision changes and accepted keyboard selection back to Grades. The Light.gg and wishlist source gates disabled numeric presentation. English, Spanish, Korean, Japanese, Simplified Chinese, and Traditional Chinese were inspected: the new score labels use English fallbacks outside English.

## Detail, comparison, and Copy surfaces

Chrome standard and beta verified rated floating details, native item popups, DIM-SUM right and bottom details, pinned ownership markers, and actual Copy button feedback (`Copied`). Numeric labels remained neutral in the inspected screenshots.

No Hesitation supplied a reproducible raw-component check: PvE ceiling 100 × quality 0.1 = 10%; PvP ceiling 100 × quality 0.5544 = 55.44%. Recomputing the weighted slot contributions matched both values exactly. Its three native Compare copies displayed 10.00/55.44, 100.00/56.00, and 71.20/44.00, with distinct owned identities.

Native Compare and Armory cards rendered in all four targets. Armory retained source recommendations and category tiers, consistent with the implementation plan's no-drop rule; it did not fabricate an owned-roll score. Shopping hover details matched the sorted row's instance identity for three sampled weapon rows in each target. Zen beta's isolated repeat passed with pointer hover and no programmatic fallback.

Zen's rated native popup rendered correctly. Its right/bottom preference controls changed, but the visual checks remained in the native popup and did not establish DIM-SUM dock placement or pin ownership. Trusted pointer attempts also did not establish Copy feedback. These are unverified live checks, not passes. Zen's extension popup navigation was refused by WebDriver BiDi (`moz-extension` navigation unsupported), so actual Zen popup menu and keyboard behavior remain unverified; the Chromium menu fixtures do not substitute for them.

## Performance and cache evidence

Each foreground target replayed the existing native vault-evaluation request over 1,298 items, with six alternating warmed Grades/Scores pairs per display. Medians:

| Target | Grades | Scores | Change |
| --- | ---: | ---: | ---: |
| Chrome standard | 61.60 ms | 59.85 ms | −2.84% |
| Chrome beta | 67.40 ms | 69.75 ms | +3.49% |
| Zen standard | 82.00 ms | 78.00 ms | −4.88% |
| Zen beta | 88.50 ms | 94.00 ms | +6.21% |

Score cache misses remained 1,404 before and after every paired scan; cache hits increased. None exceeded the 10% median investigation threshold. These measurements describe warmed native evaluation, not overall tab-motion performance. Separate Chrome scroll traces were saved locally.

Repeated hover attempts recorded no additional Resource Timing entries and unchanged score cache counters. The earlier Chrome hover loop did not establish a visible score card, and rated Copy checks were not separately network-instrumented. Treat this as limited resource/cache evidence rather than proof covering every rated hover path. Score evaluation itself uses the existing local source model and adds no per-item fetch.

## Remaining data gaps and cleanup

The origin benchmark registry remains empty. Captured coexisting origins, including Accelerated Assault variants, are not sufficient provenance for a legal maximum. Ambiguous multiple-origin Omni results remain a dash; Best can still work when only the origin maximum is unknown. Tier-5 trait denominators remain three per column, even on drops with fewer choices.

The live scan contained 537 rated PvE and 404 rated PvP weapon evaluations. Unsupported exotics and unresolved source recommendations, variants, or actual masterwork/origin inputs remain explicit unrated values. No fuzzy matches or invented origin provenance were added to increase coverage.

Original settings were saved before writes and restored, including removing keys that were originally absent. Chrome DIM-SUM's right placement and inventory-preview settings were restored exactly; Zen's original bottom placement was restored. Zen preference changes used a temporary, token-protected bridge restricted to 14 Aegis settings. The bridge was removed; the installed Zen content bundle equals the production bundle and contains no testing listener. No relay token was printed or committed.

All owned tabs, Chrome attachments, and Zen debugging sessions were closed before the next handoff. The shared relay remains available to the coordinated Shader pass. Raw account fixtures, screenshots, traces, preference backups, and private drivers remain only in ignored `scratch/score-live/`; only sanitized fixtures and this report are published.

Keep the PR a draft. No merge or store release is included.
