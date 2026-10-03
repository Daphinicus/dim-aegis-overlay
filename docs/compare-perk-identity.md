# Compare perk identity

Verified October 3, 2026.

Long Arm Compare could display a Lucky Shot emote icon and native tooltip alongside weapon-perk recommendations. The canonical name aliases `lucky shot` and `luckyshot` resolved to emote hash 896553940. They now resolve to normal trait hash 2054520291; enhanced recommendations resolve to 4170193963 through the existing trait mapping.

Bungie's manifest version 244213.26.06.29.2000-1-bnet.65864 identifies the emote's plug category as `emote`, and both weapon traits as `frames`. All three definitions have item type 19 and plug metadata. The regression fixture records the relevant identity fields and their [manifest source](https://www.bungie.net/common/destiny2_content/json/en/DestinyInventoryItemDefinition-a8ba855a-93c7-4014-8f2e-d92357fdfb42.json).

Native missing-perk preview preparation now rejects definitions whose plug category is absent from the owned socket's plug options. The check runs before DIM's stat-preview calculation. Exact-hash localization remains unchanged, and previews do not alter owned items or selected plugs. Other canonical name collisions are outside this fix's scope.

TypeScript, the production build, the complete unit suite, real-definition collision regressions, 934 Compare browser checks, and the tooltip lifecycle fixture passed.

Live verification used three Long Arm rolls in Chrome and Zen, standard first (DIM 8.144.0), then beta (8.144.0.4905), with DIM-SUM fonts enabled and disabled. Pointer hover and keyboard focus displayed Lucky Shot as Enhanced Trait with the correct icon, weapon description, and Aegis analysis. Owned socket signatures were unchanged; a final Chrome standard rerun additionally checked fresh inventory objects by ID.

The existing Aegis-only reload helper installed the fix into both persistent testing browsers. Only content.js and main-world-content.js changed. Testing manifests, extension IDs, popup/styles, percentage preferences, DIM-SUM files, and testing paths were preserved. Clients were closed and the relay stopped after verification. No commit, push, or PR status change was made.

Evidence is in the DIM-SUM workspace's `.tooltip-fix/compare-lucky-shot/` directory: per-target JSON and screenshots, build/unit/browser logs, reload output, and installed-file preservation receipts. A retained first-attempt failure reflects a quoted-selector error in the test script, corrected before all final live checks passed.
