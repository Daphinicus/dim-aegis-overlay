# Explorer rendering follow-up, October 8, 2026

The closed Database Explorer was rebuilding its result DOM during native inventory snapshots and settings updates. The panel opens with the `.open` class; it never uses `.hidden` to indicate its closed state. Three callers checked `!hidden`, so they rendered the closed panel. The resulting row mutations also reached the native compare/overview observers.

The correction checks the current `explorerUi.panel` owner, its connection to the document and `.open` before rendering results or another pagination chunk. Result containers are resolved inside that owner. The three callers use the same guard. Native ownership updates, sorting publication, badge work, database/settings state and comparison refresh remain outside the guard. Opening already refreshes the filters and calls `renderResults()`, so first open and reopen read current state rather than retaining a closed-panel render job.

## Matched Windows fixture evidence

The comparison used baseline `431c3310d686182c990fb8485704d6a217cab74b` and the frozen production candidate, with the same full PvE database and original `tests/scores/overlay.test.ts`. The Explorer stayed closed throughout this one-owned-item integration fixture.

| Measured work in the fixture | Baseline | Candidate |
| --- | ---: | ---: |
| Result render bodies | 29 | 0 |
| Rendered pagination chunks | 29 | 0 |
| Constructed Explorer rows | 1,160 | 0 |
| Native pending snapshots | 16 | 16 |
| Native ready snapshots | 4 | 4 |
| Native unavailable snapshots | 2 | 2 |
| Compare/overview observer calls | 44 | 26 |
| Observed compare/overview callback time | 4,636.67 ms | 29.41 ms |
| Instrumented test-body duration | 10,718 ms | 1,565 ms |

Both runs retained 889 source category rows, all 35 functional `expect` expressions, all nine waits and the 5,000 ms test deadline. The original overlay file and database were byte-identical before and after each run. Native snapshot counts were exactly equal. The observer measurements include the fixture's compare and overview `observe()` calls; the candidate does not change either observer.

The original uninstrumented baseline failed the 5,000 ms deadline with a reported test duration of 8.11 seconds. A separate non-acceptance CPU profile identified compare-observer selector work and Explorer row construction. The instrumented baseline reported a pass despite its 10.718-second body: synchronous event-loop work delayed the timeout callback. That result is diagnostic evidence, not acceptance of the deadline. The instrumented candidate completed in 1.565 seconds. After integration, root ran the original uninstrumented full-database overlay in about 1.39 seconds and the complete Windows score suite passed 208/208 tests across 12 files.

These counts establish avoided closed-panel work in this matched Windows/jsdom fixture. They do not establish a universal browser or inventory speedup, open-Explorer performance, or timing on another machine. The saved counter receipts are `root-baseline-01` and `root-candidate-01` under the local `scratch/oct08-explorer-counters` review directory. The original failure is retained as `root-cwd-full-02`; the separate CPU receipt is `root-full-01`.

## Preserved test scope and lifecycle checks

The unchanged overlay still exercises cached numerical scores, settings presentation, masterwork known/none/unknown states, database removal/restoration, decimal search comparisons and state-backed sorting. Its final readiness wait still publishes the original search requests. A proposed 62-Autos-row fixture did not resolve the deadline and was discarded; neither its reduced dataset nor its helper is part of this correction.

`tests/explorer-lifecycle.test.cjs` executes the production result filtering, pagination, constructor bindings, presentation scheduling, native reprocessing and search-snapshot callback. Row presentation and unrelated services are boundary stubs. Its coverage includes closed startup and repeated updates, all 889 source rows, latest database data at first open and reopen, 40-row scroll chunks, close-before-chunk, scroll retention, current-owner result scoping, detached owners and locale replacement. It also checks that closed panels do not suppress native item processing, comparison refresh, badge presentation, ownership updates or sorting publication. This focused lifecycle regression complements the unchanged full-controller overlay; it does not replace it.

The default unit run then exposed omitted dependencies in three source-extracted fixtures. `badge-updates.test.cjs` and `evaluation-cache.test.cjs` now extract the actual visibility helper with `explorerUi: null`, matching their absent-Explorer environments. `review-data-regressions.test.cjs` also includes the helper: its open Shopping fixture uses a connected DOM panel with `.open` and closes it by removing that class. All existing assertion expressions are retained. These are fixture initialization corrections, with no substitute hidden-class behavior.

At this documentation freeze, the full-controller Windows score acceptance run has passed; the updated extracted fixtures and broader verification remain pending root's serial execution. Historical receipts are preserved, and no timeout, assertion, benchmark row or scheduling behavior was weakened to obtain the result.
