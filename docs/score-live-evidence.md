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
are closed, and the relay is stopped.

### Zen recovery and completed sorting verification

After the user closed and reopened Zen, the first official helper still timed out
at session creation. A foreground retry activated both extensions with no
warnings. The sorting chat then ran standard 8.144.0 first and beta 8.144.0.4905
second in Zen 1.22.3b, at 1064 × 1826 CSS pixels and DPR 1. Both authoritative
Zen receipts complete 12 cases with complete, restored, and closed true. Each
direction verifies 586 rendered scored weapons, 718 graded weapons, and 213
graded armor items against raw provider values. Scope round trips, fonts on/off,
null ordering, unchanged native DIM settings, and grouping completion
synchronization pass.

Zen has 1,298 owned items, 595 selected scores, and 1,099 selected grades. Its
own provider preferences are independently verified and restored: PvE, Best,
PvE comparison activity, Aegis source, spreadsheet database, and potential
grades. Chrome retains PvP and the combined database mode. These distinct saved
configurations explain different functional counts; no matched cross-browser
performance claim is made.

The temporary allowlisted DIM-SUM preference bridge is removed and the official
Zen-only helper reactivates stock DIM-SUM. Final checks independently confirm
Aegis and DIM-SUM, both sorting choices, unchanged provider preferences, 1,298
items, no bridge, and exact restored Zen sorting configuration on both channels.
All automation sessions end and owned tabs close; the reused user's standard tab
is preserved and Zen remains open. Source and browser control are explicitly
released, then handed to Compare for its separate standard/beta pass. No Aegis
application source or Chrome installation changed during Zen verification.

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
contains its staging and final installed-hash receipts. Authoritative Zen files
are zen-app-complete-results.json, zen-beta-complete-results.json, their live logs
and choice screenshots, zen-final-verification.json, and official foreground/final
stock reload logs. This chat independently verifies both complete 12-case Zen
receipts, native settings equality, and required weapon/armor directions.
The earlier missing-score
browser results and preceding stock hashes remain historical evidence; the
sorting provider does not change the score model.

### Coordinated Zen Compare follow-up

After sorting released Zen, the Compare chat verified the unchanged combined
stock build on standard 8.144.0 first and beta 8.144.0.4905 second. Four receipts
cover sword/armor and firearm checks with fonts enabled and disabled. Each
records cleanup and no item writes. The viewport remains 1064 × 1826 at DPR 1,
with foreground animation frames and the original PvE activity preference.

The pass verifies reference selection, signed stat differences, Aegis
recommendation marks, native preview updates, native sort identity, collapse,
reference removal fallback, and layout re-entry. Sullen Claw retains 104 px
headers; Hungry Edge preview updates other rolls without replacing native bar
roots. Mykel's Reverence supports Polygonal Rifling preview and recoil indicators
remain clear of the difference labels. Keyboard reference activation passes.
These checks do not extend the earlier unverified Aegis popup-menu or docking
coverage.

No application source, staging, reload, settings, or game item writes occur in
this pass. Temporary page font attributes are restored, owned tabs close, and
BiDi sessions end. Compare explicitly releases Zen to the queued Shader chat,
which must preserve the canonical sorting/provider/Compare integration for its
separate presentation work. The accepted Compare bridge remains
`d9dcc43e446505581a688377316cafed40c7356e7c8e4083686302393d223f35`.

Private evidence is under DIM-SUM's
`.tooltip-fix/pr-1-integration/compare-reference-live`: `zen-app-results.json`,
`zen-beta-results.json`, their firearm counterparts, and screenshots. This chat
reads all four receipts and confirms channel versions, fonts-on/off matrices,
cleanup, and no-item-write markers. Compare retains its detailed verification
and documentation in its own checkout.

### Shared Shader presentation promotion and preservation

After the coordinated stock passes, Shader completed its separate presentation
work at commit `a79b3bd91d3dcd832fe252c2ec0da8d40b1e090a` in its draft PR #2.
Its authoritative October 2 report and promotion receipt record Chrome and Zen
standard/beta activation, 522 shaders, 394 owned shaders, and 475 season symbols.
Those are Shader functional results; they do not repeat the numerical sorting
or Aegis interaction matrix. The Shader report retains its mobile, account-switch,
and live interaction limits.

This chat independently hashes both installed copies after promotion. DIM-SUM
content.js is now `f8f8675f5dd70f9c6c58018003f40017f2ed90da9139ac5264620c7c014e3068`;
the earlier sorting stock hash remains historical. Aegis content.js remains
`c55d3b275a324a17b34af907de86b285a753c2b715d73a1b1c2b73bed4a2c2b7`,
DIM-SUM grouping-bridge.js remains
`018d034e694c3ae2b2c7cf79984788d8ee57e654b0ca815f486a4b3bd312a377`,
and Compare bridge remains
`d9dcc43e446505581a688377316cafed40c7356e7c8e4083686302393d223f35`.
The repaired canonical vault pin rule retains `justify-content:flex-start`.
Original Aegis local source still matches its initial 100-file snapshot.

The authoritative Shader report is in its isolated shader-browser-testing
worktree, docs/shader-browser.md, under Destiny presentation implementation,
October 2, 2026. Its private live/interface-promotion.json records preserved
bridges, fonts, and vault alignment; the final Chrome interface and Zen layout
receipts cover the promoted presentation. Older Shader counts and earlier
reports remain historical. Settings are restored, debugging sessions are
closed, and the Chrome relay is stopped before the explicit shared source,
staging, and reload release. Neither draft PR is merged or released.

### Score colors, October 2, 2026

At the user's request, percentage scores now run from red at 0% through yellow
at 50% to green at 100%. Hue uses the raw value, so precision changes do not
change the color. Unavailable values use a neutral dash with 40% alpha; a real
zero remains red. The shared presentation covers Aegis badges, score details,
tooltips, shopping comparisons, stat rows, and options previews. The existing
DIM-SUM label-color protocol accepts the same HSL/RGBA colors without companion
source or preference changes. Numeric values retain their neutral backgrounds
and never enter letter-grade styling.

The source at `6b7e0844c6f842f8bdc34eaf537cf89008407bac` includes the concurrent
user-authored narrow-stat-row, diagnostic, CI, and cross-browser clipboard fixes
through `694d397`. These changes were fetched and preserved before publishing;
no forced push or original-checkout replacement occurred. All 175 score tests,
TypeScript, the full unit suite, and all 22 Chromium browser suites pass. The
updated 2,240-case narrow-row regression and both modified clipboard browser
suites pass after integrating the concurrent commits. Production builds and
Chromium/Firefox/source packaging pass.

Authenticated color checks run Chrome standard first, beta second, then Zen
standard and beta against the coordinated Shader stock integration. Chrome is
154.0.8037.59 at 2560 × 1305, DPR 1.5; Zen is 1.22.3b / Firefox 156 at
1064 × 1826, DPR 1. Each target supplies 12 foreground animation frames.
Each completes 18 combinations: Best/Omni, precision 0/1/2, and PvE/PvP/Both.
Computed colors match the raw values on 729 rendered weapon labels in single
activity and 1,458 in Both, including rated values and unavailable dashes.
These are rendered-label counts, not full-inventory coverage counts. Screenshots
were visually inspected. Grades restoration and exact original preferences
pass on all four targets. The first Zen beta check observed 12 queued score
values at 300 ms; an unchanged rerun waits for settled DOM restoration and
passes. Both receipts are retained.

The representative equipped tile did not open a native detail card through
the scripted click on this follow-up. New popup-color live verification is
therefore not established; the earlier score-feature popup checks and shared
presentation tests remain separate evidence. This pass does not repeat the
original search, ownership, comparison-interaction, or performance matrix.

The temporary Zen preference bridge is removed, and the official Aegis-only
reload succeeds in both browsers. Independent stock activation checks confirm
Aegis, its inventory provider, and DIM-SUM active with 1,298 facts in each
browser. The stock content.js hash is
`d3e6d046188c318cde8bdb6fd627698f303050b347c2caf52aec177fd863ff59`;
popup.js is
`36e7ba05c7f1e8f14af79bb0137b3649924496fd0ba1899d45a7727b1399ef41`.
Background and main-world bundles remain unchanged. All 6,244 installed DIM-SUM
files per browser remain unchanged, including Shader content.js
`a200549b69bf26caba82af5c5a8586608063a99665d3ca91e902fd1a0d6db33c`.
Original Aegis local source still matches the initial 100-file snapshot.

Private evidence is in ignored scratch/score-live: color-{chrome,zen}-{standard,beta}-results.json,
original preference receipts, first-attempt receipts, vault/click screenshots,
color-final-stock.json, color-dimsum-before.json, and official reload/test logs.
All owned tabs, CDP attachments, and BiDi sessions close before the explicit
handoff to the scrolling chat. Its existing Chrome target and shared relay
remain available at its request. Stable installation paths, extension IDs,
sign-in, and saved preferences are preserved. PR #1 remains a draft.


## Percentage-symbol sizing — October 2, 2026

Application commit: `8a4888e33c6bd1731e18397361f894a99c55f834`.
Percent symbols now use `font-size: .55em`, a shared baseline, and inherited
score color in the shared Aegis formatter and DIM-SUM delegated tile labels.
The full percentage remains in plain text and accessible labels; raw values,
precision, copying, grade labels, and the faded unavailable dash are unchanged.
The portable three-file DIM-SUM companion patch is
[score-percent-dimsum.patch](score-percent-dimsum.patch). It was applied as
narrow hunks alongside the latest primary and canonical shared source.

The 55% ratio follows the user's requested hierarchy.
[Google's percentage guidance](https://developers.google.com/style/numbers#percentages)
supports keeping the numeral and sign together without a space.
[W3C's resize-text guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
supports text enlargement; relative units keep this symbol proportional.
Neither reference prescribes a 55% ratio or baseline alignment.

Validation includes 175 score tests, TypeScript, production build, and a
Chromium typography fixture: 12/20/32 px parents, 0/50/100 and unavailable,
at 100/125/150/200% zoom (36 symbol assertions). Size ratio, baseline, inherited
color, and complete plain percentage text pass. Screenshots were inspected.
These checks do not establish complete WCAG conformance. The attempted local
headless Firefox launch returned spawn UNKNOWN; authenticated Zen checks below
provide the Firefox compatibility evidence.

The latest DIM-SUM candidate passes TypeScript, build, generated-style checks,
and all 107 integration roles on captured standard 8.143.0 and beta
8.143.0.4890. The channel runner resumes standard from compare-stat-bars after
copying the required real ItemStat and Motion audit fixtures, then runs beta.
The initial beta hover-frame raster endpoint reports a seam at 2x/96 ms; an
unchanged rerun of that endpoint and the remaining beta checks passes. That
fixture loads neither the changed percentage renderer nor its styles. Initial
receipts and resumed logs are retained rather than replaced with a clean-only
record. Percentage tile-renderer assertions pass on both captured channels.

Authenticated follow-up order is Chrome standard, Chrome beta, Zen standard,
then Zen beta. Chrome is 154.0.8037.59 at 2560 × 1305 / DPR 1.5; Zen is 1.22.3b
at 1064 × 1826 / DPR 1. Each supplies 12 visible, focused animation frames.
Each completes 18 combinations (72 total): Best/Omni, precision 0/1/2, and
PvE/PvP/Both. Checks cover 729 rendered weapon labels in single activity and
1,458 in Both, including mixed rated/unavailable labels. Numerical suffixes
compute to 0.55 of their parent, align to the baseline, and inherit its color.
Plain labels remain complete. All four vault screenshots were inspected.
These counts describe rendered labels, not full-inventory score coverage.

Grades and exact original saved preferences restore on all targets. The first
Zen standard attempt checks delegated labels after 300 ms and sees 642 queued
percent labels, despite no remaining core score spans. The unchanged product
passes after the harness waits for both renderers to settle: standard
673 ms, beta 877 ms. Both first and settled receipts are retained.
This typography follow-up does not repeat the original ownership, search,
comparison-interaction, popup-interaction, or performance matrix.

The temporary Zen preference bridge is removed; official stock Aegis reloads
and independent activation checks pass in Chrome and Zen with 1,314 native
facts each, the inventory provider, and DIM-SUM active. Normal dist and both
installed Aegis bundles match. content.js is
`44a38cf31fff86363c06759ea7fbb64b58be247138383609e8b83f36156a630a`;
popup.js is `104e3121b1ab3e7e489f85abc1521e41afe9cc96c31d245bb6eb0bf22b5f28f3`.
Background and main-world bundles are unchanged. DIM-SUM has 6,245 files per
browser; only tile-bridge.js and its three stylesheets change. Its content.js
remains Shader build
`029db24a4068c253b72b896d150b322affaf47fc87400939d49e8f319da3c59b`;
tile-bridge.js is
`ac0bd706d8586060919634c23ee402b9d0eaf738655758252875ac5e723bac6a`.
All 6,241 other DIM-SUM files per browser are preserved. The original Aegis
checkout still matches its initial 100-file local source snapshot. Stable
installation paths, extension IDs, sign-in, and saved settings are preserved.

All owned tabs, attachments, and BiDi sessions close; the shared relay stops
before the explicit handoff to the Compare chat. No equipment writes occur.
Private receipts, screenshots, fixture results, preservation hashes, and
reload logs are retained in ignored scratch/score-live with the percent prefix.
The typography audit in both shared DIM-SUM source copies records this scoped
unit role. PR #1 remains a draft; no merge or release is performed.


## 65% symbol legibility follow-up — October 2, 2026

The user found the 55% suffix muddy at compact inventory sizes. Application
commit `467a0d7abf0f5e3ce461b7921596a5570fa90550` raises it to 65%
(`.65em`) in Aegis and the DIM-SUM companion patch. Baseline alignment,
inherited color, complete plain labels, score digits, and the faded unavailable
dash retain their previous behavior. The earlier 55% evidence remains historical.

Aegis TypeScript/build/package checks pass. The Chromium typography fixture
passes 36 assertions across 12/20/32 px parents and 100/125/150/200% zoom.
DIM-SUM passes TypeScript/build, all 107 compatibility roles on the captured
standard 8.143.0 and beta 8.143.0.4890 classes, generated-style validation,
and the existing tile-presentation fixture on both channels with the updated
0.65 ratio assertion. Full channel acceptance for the latest shared baseline
is recorded separately by the completed Compare handoff. This narrow retune
uses targeted checks and does not repeat the ownership, search, sorting,
comparison, or performance matrices. No new scoring logic or label protocol
is introduced, and these checks do not establish complete WCAG conformance.

Authenticated order is Chrome standard, Chrome beta, Zen standard, then Zen
beta. Each passes four focused cases: Best, precision 0/2, and PvE/Both
(16 total). Checks cover 729 single-activity and 1,458 dual-activity rendered
weapon labels per case, including unavailable values. Computed suffix ratios
are 0.65, baseline alignment and inherited colors pass, and plain labels remain
complete. Each target supplies 12 visible/focused frames. Chrome is
154.0.8037.59 at 2560 × 1305 / DPR 1.5; Zen is 1.22.3b at
1064 × 1826 / DPR 1. All four screenshots are inspected. Grades and exact
original saved preferences restore. The Zen preference snapshot also matches
its preceding 55% snapshot after the coordinated same-profile recovery.
The current standard 8.144.0 and beta 8.144.0.4905 release versions are verified
by the immediately preceding Compare live handoff; this glyph pass records
hosts and browser metadata independently.

The existing official helper reloads both extensions and then restores stock
Aegis after removal of the temporary Zen preference bridge. Both independent
stock activations pass with 1,314 facts, the provider, and DIM-SUM active. All
Aegis JavaScript bundle hashes remain unchanged from the 55% build.
styles.css alone changes; dist, Chrome, and Zen match
`837fb4eb880ff6703597e01e27744f09253ba883c84e40dabb99255a6ec53ff7`.
DIM-SUM changes exactly three stylesheets among 6,245 installed files per
browser. Its main content remains
`aa97dfa880d2ffac8248860eb8ef175ac9ec22f5a6b92029f6074ab3894d4e08`;
Compare bridge remains
`9520d24bec611cc6800814a597f9b9eaa3952ed62ddc5fb803d6d89a32ba46b8`;
tile bridge remains
`540ea31215f2eb309c6aacbf9a06a37ce72309caf21f6d10fcf3e185ee599254`.
All 6,242 other DIM-SUM files per browser are preserved. The original Aegis
checkout still matches the initial 100-file local snapshot. Stable extension
IDs, paths, sign-in, fonts, and saved settings are preserved.

The shared source receives only the two ratio replacements and the typography
audit update alongside the latest Compare work. All owned tabs, attachments,
and BiDi sessions close; the temporary bridge is removed and relay stopped
before explicit release of the shared slot. No equipment writes occur.
Private percent65 receipts, screenshots, fixture results, preservation hashes,
and reload logs remain in ignored scratch/score-live. PR #1 remains a draft.
