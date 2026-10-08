# Local browser testing handoff

Use this prompt in the local Codex session that has the signed-in DIM testing browsers and the current Aegis and DIM-SUM checkouts. Replace the PR URL with the review link provided alongside this document.

```text
Test the Aegis percentage-score trial from the supplied draft PR in my live DIM browsers. Read the PR and the repository AGENTS.md first. Aegis and DIM-SUM are separate extensions: put scoring code in the Aegis checkout, preserve DIM-SUM's source and saved settings, and preserve concurrent personal wishlist work.

Fetch the draft PR from Daphinicus/dim-aegis-overlay into a new isolated Aegis worktree. Its original base is e5442899594a872beec54f4ae95af9af973a6760. If the local testing branch has newer fixes or personal wishlist work, integrate the feature carefully into that branch's isolated worktree and resolve conflicts without discarding those features. Do not replace the newer testing checkout wholesale with the older baseline. Preserve the current manifest version and extension IDs. Run npm install, npm run test:scores, npx tsc --noEmit, and npm run build:all. Do not stage a failing build.

Read DIM-SUM docs/chrome-live-testing.md. Use its existing scripts/reload-testing.ps1 and testing.local.json (or the documented Reload Aegis Testing / Reload Aegis + DIMSUM Testing shortcuts). Stage to the existing Chrome/Zen playtest paths. Do not reload extensions or refresh DIM using computer-use clicks/keyboard shortcuts. Confirm both extensions are actually active and record each browser activation result separately. Do not expose debugging relay tokens or account credentials.

Verify DIM standard in Chrome first, beta second, then Zen compatibility. Record browser/DIM versions, actual extension paths and hashes, viewport/zoom/theme/layout, and Aegis settings. Check that foreground animation frames arrive before judging timing. Preserve settings parity; record original settings and restore them after testing unless I choose to keep Scores enabled.

Test Rating display Grades/Scores, Best selections/Omni, 0/1/2 decimals, all single/dual activity modes, badge positions/styles/scales, menu persistence, and switching back to grades. Inspect item tiles, floating tooltips, native popups, DIM-SUM right/bottom/pinned details, shopping copy comparisons, and Armory. Confirm percent strings never enter letter-grade styling and incomplete values do not round to 100. Test keyboard controls and the supported menu languages; report untranslated score labels explicitly.

Use real owned drops with multiple selectable perks, enhanced/base variants, crafted configurations, multiple origins, and different masterwork types. Changing a perk preview must not change potential scores. A masterwork-type/configuration change must invalidate them; masterwork level alone must not. Confirm crafting recipes and perks in the wrong column are not credited. Capture minimal actual DIM socket fixtures for these cases; existing automated ownership fixtures are modeled, not live captures.

For Omni, keep the Tier-5 denominator even on drops with only two trait choices. Origin maxima must come from verified coexisting sets, including applicable Accelerated Assault variants. Unknown maxima must show an Omni dash rather than shrink to the observed roll. Do not invent provenance to fill the initially empty origin registry. Best selections should remain available when only the origin maximum is unknown.

Try aegis:score:>=90, aegis:pve:score:>89.99, aegis:pvp:score:<=80, aegis:score:unrated, and aegis:score:omni. Confirm raw values drive filtering/sorting and precision changes do not alter matches. Unrated must not compare as zero. Legacy grade filters and personal wishlist/bookmark priority must retain their meanings.

Copy score details from a few representative drops and compare the raw components against docs/score-implementation-plan.md and its acceptance fixtures. Verify stale DOM tile reuse, source refresh, settings reload, and missing-source states. Check cache reuse and absence of new hover network requests. Compare a warmed Grades and Scores vault scan, and record timings/evaluation counts; investigate repeatable >10% median regressions or repeated hover calculations rather than inferring speed from the unit tests.

Fix issues found in the feature branch, rerun appropriate checks, and update the draft PR with the implementation and evidence. Save screenshots, compact fixtures, and performance traces locally. Distinguish automated fixtures, local menu Chromium checks, and authenticated live results. Report remaining data gaps and browser checks honestly. Keep the PR a draft; do not merge, publish a store release, automatically dismantle anything, or overwrite unrelated work. End native Computer Use and debugging sessions when finished.
```
