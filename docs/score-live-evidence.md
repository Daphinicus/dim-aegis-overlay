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

Production JavaScript SHA-256 hashes from the initial score pass:

| Bundle | SHA-256 |
| --- | --- |
| `background.js` | `c98628a1cfc862d3be4bc577e493046fe566f6059b796c2410dfd3f4e93b31ed` |
| `content.js` | `9ba3b20cd3e019c3020e73dadd28001909c68722c1c747fc9c6cdbd28657522c` |
| `main-world-content.js` | `c9581fec20238bb064d129edeec2292b391ae7d7a42f51e89a2680ddbe845572` |
| `popup.js` | `5f737655b09fec2508ce590ef21fea716596adacc55f0dc5d1a82f752c6d48a9` |

The initial stock build verified 28 Zen files. The official Aegis-only reload helper activated both extensions in all four existing Chrome DIM tabs; Zen's separate activation records also report both extensions active. Staging alone was not counted as activation.

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

The initial live scan contained 537 rated PvE and 404 rated PvP weapon evaluations. Unsupported exotics and unresolved source recommendations, variants, or actual masterwork/origin inputs remain explicit unrated values. No fuzzy matches or invented origin provenance were added to increase coverage.

Original settings were saved before writes and restored, including removing keys that were originally absent. Chrome DIM-SUM's right placement and inventory-preview settings were restored exactly; Zen's original bottom placement was restored. Zen preference changes used a temporary, token-protected bridge restricted to 14 Aegis settings. The bridge was removed; the installed Zen content bundle equals the production bundle and contains no testing listener. No relay token was printed or committed.

All owned tabs, Chrome attachments, and Zen debugging sessions were closed before the next handoff. The shared relay remains available to the coordinated Shader pass. Raw account fixtures, screenshots, traces, preference backups, and private drivers remain only in ignored `scratch/score-live/`; only sanitized fixtures and this report are published.

Keep the PR a draft. No merge or store release is included.

## Compare integration follow-up

DIM-SUM annotates native Compare headers with `role="columnheader"`. The older Aegis selector excluded those headers, so recommendations disappeared. Commit `aac0303` accepts the role while retaining the direct item-header structure and excluding stat and perk cells. The standard, beta, and legacy browser fixture passed 934 checks. The coordinated Compare chat also verified recommendations, masterworks, settings cleanup, grid/list layouts, and native tooltips in signed-in Chrome standard/beta and Zen standard/beta. Its Aegis production reload removed the temporary Zen bridge and retained all installed DIM-SUM files. This fix is included in the combined PR source.

## Missing-score investigation

The user's crafted Explosive Personality exposed a distinct extraction bug. A read-only signed-in Chrome capture found 17 crafted weapons with `masterworkInfo=null`, an equipped base intrinsic with empty `investmentStats` and runtime `stats`, and the empty masterwork plug `233125175`. Those fields prove that no masterwork bonus is configured. The old adapter treated this as unknown metadata and erased the whole score. The adapter now serializes that verified absence explicitly and awards zero masterwork credit without removing its weight. Missing fields, contradictory stats, definition-only sockets, and frame previews remain unknown or retain their actual equipped configuration.

This agrees with [DIM's masterwork implementation](https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/store/masterwork.ts), which reads crafted masterwork bonuses from the intrinsic and returns null when it has no stat bonus. Seventeen sanitized actual socket fixtures are committed in [crafted-no-masterwork.json](../tests/scores/fixtures/crafted-no-masterwork.json).

Two source normalization failures also affected many weapons: comma splitting broke the canonical origin name Nail, Meet Hammer, and exact source abbreviations or typos failed to resolve. The fix retains complete canonical perk names before splitting comma-delimited lists and recognizes verified exact aliases, including Fluted Barrel Barrel, Hammer-forged Rifling Rifling, Ricochet, Extended Magazine, and High Explosive. It also maps Cooling Efficiency to its existing stat hash and supports Persistence. Unknown or explicitly uncertain source text still fails closed; no fuzzy matching or invented version/origin evidence was added.

A before/after replay uses the same 616 actual owned legendary runtime items and the same cached live PvE/PvP databases. The baseline comes from `aac0303`; the fixed implementation is `817cda7`. This replay is separate from installed-browser validation.

| Activity | Rated before | Rated after | Restored evaluations |
| --- | ---: | ---: | ---: |
| PvE | 537 | 595 | 58 |
| PvP | 404 | 548 | 144 |

Crafted Explosive Personality now has PvE ceiling 74.36363636 × quality 0.16 = 11.89818182% Best and Omni. Its PvP Best is 92.24%, and Omni is 87.25942090%. The masterwork contributes zero in both activities. These values describe its current crafted configuration, without granting crafting recipe alternatives.

Remaining legendary Best gaps in that replay are explicit: PvE has 15 unknown owned origins, four ambiguous versions, and two missing source rows; PvP has 16 unknown origins, 36 ambiguous versions, 13 missing source rows, and three explicitly uncertain perk recommendations. Multi-origin Omni benchmark gaps and unsupported exotics remain unchanged.

Follow-up automated checks passed: 167 score tests in seven files, TypeScript, the full existing unit and Chromium browser suites, and production builds/packages. Original local source files still match the initial uncommitted-work snapshot.

Installed-browser validation is complete as described below. The tile integration regression also verifies number/dash transitions and cache invalidation between known-empty, unknown, and selected masterwork bonuses.

## Installed missing-score follow-up

The updated production build was tested in signed-in Chrome standard first, Chrome beta second, then Zen standard and beta. Final functional runs have no assertion failures. Each target reproduces 595 rated PvE and 548 rated PvP legendary evaluations from 616 owned instances. All 17 crafted base-frame configurations score with zero masterwork credit. Explosive Personality's actual detail card displays 11.90% PvE Best and 92.24% PvP Best, with matching instance identity and raw score details. Best/Omni, precision 0/1/2, and PvE/PvP/Both checks preserve raw evaluations and keep numeric presentation neutral.

The matched Both-mode checks temporarily use Classic because Stat rows retain a separate single-activity preference. Zen's original Stat style and activity preferences are restored. Initial Zen attempts with mismatched Stat/Both expectations and an unsupported textual BiDi Escape key are recorded privately as failed harness attempts; final runs use the correct supported setup and key encoding.

Current numeric search matches are identical across all four targets:

| Query | Matches |
| --- | ---: |
| `aegis:score:>=90` | 57 |
| `aegis:pve:score:>89.99` | 28 |
| `aegis:pvp:score:<=80` | 477 |
| `aegis:score:unrated` | 183 |
| `aegis:score:omni` | 1 |
| `aegis:>=S` | 458 |

Raw evaluations agree with the numeric filter identities; changing precision retains them. Settled foreground Grades/Scores comparisons preserve exact legacy grade and shopping identities within each persistent profile. Shopping-high matches are 25 in Chrome and 26 in Zen; the cross-profile difference is one armor fact, which score predicates exclude. Preferences and data were not normalized to force those counts to agree. A cold/background Chrome probe that observed an identity shift is retained as a failed attempt; matched foreground settled repeats pass.

### Follow-up timing investigation

The first transition-inclusive Zen measurements showed large apparent regressions (Grades/Scores medians 74/227.5 ms on standard and 293.5/383.5 ms on beta). Those runs replayed requests while preference-driven presentation work could still be pending and do not establish warmed steady-state timing. We investigated with the same installed source: foreground focus, 1.2 seconds for each display transition to settle, two animation frames, three untimed vault replays, and a fourth timed replay, in six alternating Grades/Scores pairs per target.

| Target | Grades | Scores | Change |
| --- | ---: | ---: | ---: |
| Chrome standard | 66.60 ms | 65.85 ms | -1.13% |
| Chrome beta | 71.40 ms | 74.55 ms | +4.41% |
| Zen standard | 75.50 ms | 75.00 ms | -0.66% |
| Zen beta | 82.50 ms | 84.50 ms | +2.42% |

All measured requests contain 1,298 facts. Score-cache misses stay at 1,404 throughout warmups and timed requests. None of the settled medians exceeds the 10% investigation threshold. The earlier observations are preserved rather than relabeled as passes. These measurements cover warmed native evaluation; they do not establish overall display-switch latency, tab motion, or a complete hover-network guarantee.

### Final stock installation and preservation

The temporary Zen preference bridge was removed by the stock testing build, followed by the official Aegis-only Both reload. Chrome's four existing DIM tabs and Zen's two existing tabs were refreshed through the helper. Four new stock activation checks independently verify both extensions active, the bridge absent, 17 recovered crafted configurations, and the 595/548 rated counts. All owned tabs, attachments, and Zen sessions were closed before explicitly handing browser/install access to Compare.

Every one of 6,244 installed DIM-SUM files per browser matches the post-Shader baseline. Every modified Aegis preference was restored, including removing originally absent keys. The original local source snapshot remains intact. Account captures, preference backups, screenshots, traces, and harness attempts remain in ignored local scratch files.

Authoritative stock JavaScript hashes match production, Chrome, and Zen:

| Bundle | SHA-256 |
| --- | --- |
| `background.js` | `c98628a1cfc862d3be4bc577e493046fe566f6059b796c2410dfd3f4e93b31ed` |
| `content.js` | `0406994a18f52b4c492c2ae86e788fb5309ecaa13b16631cedb21e5f550a4bd7` |
| `main-world-content.js` | `b1cf3f4958a20b3b6f0c336203b06bc9ebb1f1d39abb4194f2a09af537bdea0c` |
| `popup.js` | `5f737655b09fec2508ce590ef21fea716596adacc55f0dc5d1a82f752c6d48a9` |

## DIM-SUM sorting provider follow-up

The numerical/grade sorting integration adds a read-only, versioned full-inventory
provider. It publishes raw Best/Omni scores and canonical legacy grade ranks,
independently of Grades/Scores display and precision. It reuses native inventory
search evaluation rather than scanning tiles or recalculating during comparisons.
Pending, unavailable, replaced, and disposed providers clear stale sorting data.
See [Inventory sorting provider](inventory-sort-provider.md) for the cross-world
schema and lifecycle.

All 174 score tests across eight files, TypeScript, and the full unit/browser
suite passed. The seven new provider tests cover ranks, real zero versus null,
profile/activity selection, armor, liveness, cleanup, and stale request rejection.
The existing production content test also checks display/precision independence,
profile invalidation, and Light.gg grade fallback. A malformed request now
invalidates an in-progress generation before marking it unavailable, so it
cannot later publish stale sorting or search facts.

### Coordinated sorting installation and Chrome results

October 2, 2026. Compare explicitly released source and Chrome before sorting
integration, then released Zen separately. The sorting candidate applies its
narrow delta to the accepted combined DIM-SUM source, preserving Shader Browser
and Compare. Aegis's stock provider was staged with its existing testing helper;
only Aegis content.js changed. Both manifests and the extension ID remained
byte-identical.

The sorting chat's authenticated receipts verify Chrome 154.0.8037.59 on DIM
standard 8.144.0 first and beta 8.144.0.4905 second. The viewport is 1080 × 1785
CSS pixels at DPR 1; focus and animation frames were confirmed. Each channel
exposes 1,298 owned provider items, with 548 rated scores and 1,090 grade ranks.
Chrome retains PvP, Best, and potential-grade settings. Each direction checks
540 rendered scored weapons, 709 graded weapons, and 213 graded armor items
against the supplied raw values. Both authoritative stock receipts complete all
12 cases, including global/local scope and both armor directions; complete,
restored, and closed are true. Native DIM settings match before and after each run.

The initial beta receipt was incomplete after a local-scope ordering assertion,
before its armor checks. It remains local as failed evidence. The stock rerun
waits for data-dimsum-grouping-drawn to match data-dimsum-dual-config before
asserting final order. Standard passes first, then beta, on unchanged application
bundles and without a temporary preference bridge. The corrected synchronization
resolves the premature snapshot; the follow-up establishes final ordering, not
scope-change latency.

Global/section scope, typography, equipped exclusion, null ordering, native
settings isolation, and saved preference restoration are covered by the
recorded Chrome cases. The DIM-SUM standard/beta acceptance runs and focused
combined toolbar, Shader Browser, grouping, precision/provider, and compatibility
fixtures passed. These functional and fixture results do not establish a sorting
performance improvement or a matched cross-browser benchmark.

The official Both/Both helper reactivated the stock builds after removing the
temporary token-protected DIM-SUM preference bridge. Chrome independently
confirms both sorting options and a ready 1,298-item provider after stock reload.
Its saved preferences are exactly restored; owned tabs and debugging attachments
are closed, and the relay is stopped. Zen's helper independently activates both
extensions, but new-tab creation and existing-tab activation time out. Zen live
sorting order and visual checks remain pending. No Zen sorting preference was
changed. Browser and source slots are released.

Only DIM-SUM content.js and grouping-bridge.js changed in the sorting installation.
Every other installed DIM-SUM file, including fonts and the accepted Compare
bridge, remains unchanged. Sorting source, tests, docs, and verified bundles are
saved into its canonical combined-playtest; the historical Compare candidate is
untouched. Original Aegis local source still matches the initial 100-file snapshot.

Final installed SHA-256 hashes match Chrome and Zen:

| Bundle | SHA-256 |
| --- | --- |
| Aegis content.js | c55d3b275a324a17b34af907de86b285a753c2b715d73a1b1c2b73bed4a2c2b7 |
| DIM-SUM content.js | 7384656d4e23790e72ba48e5f57cbea814960e64fa1cf41281c0f9825e98976e |
| DIM-SUM grouping-bridge.js | 018d034e694c3ae2b2c7cf79984788d8ee57e654b0ca815f486a4b3bd312a377 |
| DIM-SUM compare-bridge.js | d9dcc43e446505581a688377316cafed40c7356e7c8e4083686302393d223f35 |

Private evidence is retained in DIM-SUM's .tooltip-fix/aegis-sorting: channel
stock-results.json and stock-live.log per channel, stock choice-menu screenshots,
receipt-audit.json, final-verification.json, installation.json,
combined-sync.json, and final-stock-reload.log. This chat independently checked
the receipts and both installed hash sets. Aegis's ignored scratch/score-live
contains its staging and final installed-hash receipts. The earlier missing-score
browser results and preceding stock hashes remain historical evidence; the
sorting provider does not change the score model.
