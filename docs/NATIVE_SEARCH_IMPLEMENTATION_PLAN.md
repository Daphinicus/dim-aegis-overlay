# Native Aegis search: regression review and implementation plan

Implementation and current verification are documented in
[Native Aegis search](NATIVE_SEARCH.md). The checklist below remains the original
handoff and release-validation reference; it is not a claim that every live
compatibility combination has been tested.

Reviewed September 18, 2026. This is an implementation handoff, not authorization
to publish a release or execute inventory actions on a live account.

## Decision and boundaries

Proceed in small, sequential changes. The native integration is feasible, but
the minimum prototype must not be copied into production unchanged. The most
important remaining work is preserving existing grading behavior, replacing the
old input interception, and making lifecycle changes invalidate every consumer.

The feature should make `aegis:` part of DIM's actual item search. DIM continues
to own Boolean parsing, results, counts, and action execution. Do not implement
replacement bulk actions, translate queries into long ID lists, replace Redux
reducers/dispatch, or use a CSS-only fallback when the integration fails.

Existing source changes in this workspace concern popup interactions and layout.
Inspect `git status` before starting and preserve those changes. This plan adds
no feature implementation. The earlier evidence is in
[SEARCH_ACTIONS_FEASIBILITY.md](SEARCH_ACTIONS_FEASIBILITY.md).

Review validation: six focused checks against the pinned DIM source passed, and
the revised live prototype passed 12 checks in Zen 1.22.2b. Those include exact
query/input preservation and a pending native input edit. The prototype still
uses synthetic membership over real inventory; grading integration, cross-browser
compatibility, and full lifecycle handling are not already completed.

## Failure points and required protections

“Confirmed” means observed in source or a probe. “Risk” means the failure has not
been reproduced but follows from the integration boundary.

| Priority | Finding and evidence | Required protection |
| --- | --- | --- |
| P1 | **Confirmed:** `setupSearchFilterObserver` handles input, Enter, Tab, and blur; it removes `aegis:` text and creates a separate pill. The live MVP set Redux directly and bypassed this path. | Remove the old handlers from native mode. Test real typing, paste, completion, blur, and widget clicks. |
| P1 | **Confirmed:** the MVP's empty `TOGGLE_SEARCH_QUERY_COMPONENT` action normalizes whitespace and increments `searchQueryVersion`. `notes:"two  spaces"` becomes `notes:"two spaces"` if it contains the first whitespace run. | Use the revised same-value results-state refresh described below. Never normalize, rewrite, or version-bump a user's query just to refresh results. |
| P1 | **Confirmed:** a freeform predicate returning false still validates. Under negation it matches everything; with OR it can leave a broader native clause active. | Validate availability and syntax before constructing predicates. Reject the entire Aegis-containing expression while required data is unavailable. |
| P1 | **Confirmed:** `processElement` modifies the result after `evaluateWeapon`, including potential grades, exotic tiers, upgrade flags, and two-tier display. The existing matcher reads that modified payload. | Extract shared finalization and matching, with parity fixtures. Calling raw `evaluateWeapon` alone is insufficient. |
| P1 | **Risk:** an old asynchronous response arrives after account, inventory, source, or mode changes and restores obsolete matches. | Stamp both directions with a session/account epoch and monotonic inventory/evaluation revisions. Publish only a complete matching revision. |
| P1 | **Confirmed:** clearing selector caches without a new observable store state left the mounted action menu stale in the MVP. Redispatching an identical search query is a reducer no-op. | Invalidate argument and result-function caches, then notify subscribers through the tested narrow adapter. Verify menu props after React commits. |
| P1 | **Confirmed:** the search factory is shared by Compare, Organizer, Strip Sockets, loadout tools, vendors, item pickers, and other views. Some retain a query independently of the header. | Refresh the factory and validation selectors even if the header has no Aegis query. Test an already-open consumer while its source data changes. |
| P1 | **Risk:** an open menu or dialog retains old actionable props during a pending evaluation. Strip Sockets clears selected sockets in a React effect, not synchronously with the data update. | Test pending transitions with a preview selection and interrupted renders. If stale invocation is possible, add a narrowly scoped pending-state interaction guard; do not ship based only on selector assertions. |
| P1 | **Confirmed:** DOM annotation and cache coverage are not authoritative inventory coverage. The existing weapon cache is capped at 1,500 and armor takes a separate path. | Build the search index from DIM state. Distinguish a fully evaluated unrated item from an item whose inputs are still loading. |
| P1 | **Risk:** module signatures, selector exports, cache APIs, or map identities change in a DIM update. | Require unique candidates and structural checks. Disable only Aegis integration on mismatch; keep its query text so DIM treats it as unsupported. Never execute arbitrary candidate exports. |
| P2 | **Confirmed:** legacy queries include aliases, source text, armor pairs, and grade comparisons. A one-entry `suggestions: ['mvp']` definition does not establish support for that grammar. | Parse the Aegis argument separately; use DIM for Boolean syntax. Quote the complete argument for multiword sources. |
| P2 | **Risk:** a search-triggered DOM update causes rescoring, publishing, selector clearing, and another search update indefinitely. | Subscribe to scoring inputs and data revisions, not general DOM mutations or every Redux dispatch. Publish only semantic changes and coalesce notifications. |
| P2 | **Risk:** Compare or Overview preview perks contaminate inventory results for the same item ID. | Inventory projections must come only from DIM's inventory state. Keep preview evaluation/cache ownership separate. |
| P2 | **Risk:** locale changes, masterwork normalization, variant names, enhanced perks, or Light.gg mode change which sheet row or grade is selected. | Reuse existing normalization and activity-mode behavior. Include these cases in evaluator parity tests. |
| P2 | **Risk:** duplicate extension initialization, account replacement, disable/re-enable, or a new filter-map object duplicates registration or leaves listeners behind. | Use an owned, idempotent registration with a disposer, current-store checks, and exact ownership checks before removal. |
| P2 | **Risk:** full-inventory grading on every keypress or irrelevant setting change stalls DIM. | Evaluate once per relevant revision. Compile each Aegis argument once; match items with synchronous index reads. Measure grading separately from native filtering. |
| P2 | **Confirmed:** saved queries and other item-search consumers outlive the visual widget; loadout-name search has a separate configuration. | Keep saved text self-contained. Register only in the item-search map. Unsupported contexts must not broaden a query silently. |

## Architecture decisions

### 1. One matching implementation

Create `src/aegis-search.ts` with pure parsing and matching. DIM passes the
argument after `aegis:`; this module does not parse `and`, `or`, grouping, or
negation. Return a typed parse result, including an error for unknown/incomplete
arguments. Use the same matcher for characterization of the old path and for
the new native predicate.

Preserve the current matching meaning of these families and their aliases:

- `5/5`, `perfect`, `5of5`, `godroll`; `omni`, `master`, `allperks`.
- `god`; `upgrade`, `upgradeable`, `upgradable`; `bis`, `bestinclass`; `chase`.
- `shopping`, `shop`, priority/high, ready, farm/suboptimal, alt/alternative.
- `p:`/`perk:`, `w:`/`weapon:`, `pve:`, `pvp:`, and bare grade/composite forms.
- `a:`/`armor:`, `2p:`/`2piece:`, `4p:`/`4piece:`, and armor grade pairs.
- `s:`/`source:` text and the grade operators actually accepted by `compareGrades`.

Derive the full alias and grade table from `evaluateAegisFiltering` and
`compareGrades`; the list above is a checklist, not permission to invent syntax.
For example, `getAegisFilterLabel` mentions `meta`, but a label alone does not
establish matcher support. Keep unrelated existing semantic bugs separate.

For source values containing spaces, produce `aegis:"source:king's fall"`.
The entire argument is quoted. `aegis:source:king's fall` becomes multiple DIM
terms. Preserve current single-token syntax and add tests for quotes/escaping.

### 2. State-backed inputs, existing evaluator

Create `src/dim-item-input.ts` to project a DIM inventory item into the inputs
already consumed by the evaluator. Keep instance IDs as strings. Include hash,
owned/active perk hashes, normalized names needed for lookup, masterwork, item
kind, and weapon-variant/armor-set signals. Do not serialize the Redux store,
authentication data, React objects, or the whole manifest across worlds.

Extract the relevant extraction/normalization from `main-world-content.ts` so
inventory search and tile annotation agree. Preserve its existing preview path.
Do not infer variant identity from unrelated tile text or assume DIM's display
names are English.

Keep the existing rating data in the isolated content world for the first
version. Refactor `content.ts` to expose an internal DOM-independent evaluation
facade using its existing initialized data and functions. This avoids moving
every scorer/global into a new module in one change.

Move the display-mode grade finalization into a shared helper used by both the
tile path and the facade. Do the same for armor evaluation. The returned compact
search facts must reproduce the *current filter-visible* grades and flags;
they must not be reconstructed from rendered badge text.

### 3. Revisioned bridge and atomic publication

Use a small JSON bridge between main and isolated worlds, following the existing
DOM bridge convention in `perk-analysis-bridge.ts`. Treat messages as data with
validated schemas, finite sizes, and known message kinds. No message may request
arbitrary Redux dispatch, code evaluation, or an account action.

Define these contracts in `src/search-protocol.ts` before wiring them:

```ts
interface SearchRevision {
  session: string;           // New handshake/document session.
  accountEpoch: number;      // Changes when the active account changes.
  inventoryRevision: number;
  evaluationRevision: number;
}

type SearchAvailability = 'pending' | 'ready' | 'unavailable';
// Inventory messages carry projected item inputs and a revision.
// Evaluation responses carry compact search facts and the same revision.
// A ready response replaces the index atomically; it is never a partial merge.
```

The main world owns current inventory identity and the committed native index.
The isolated world owns rating/settings readiness and evaluation. A handshake
provides the initial evaluation revision; changes invalidate the prior revision
before recomputation. Reject messages for an obsolete session, account, or either
revision, even if they arrive after a newer ready response.

Track readiness separately from an empty database or an unrated item. A source
that is successfully loaded and empty can return zero positive matches. A
required source that is still loading or has failed cannot be treated as empty.
Do not require unused optional data sources for every filter; record dependencies
for rating, armor, shopping, and chase argument families.

Fingerprint scoring inputs. Tags, locks, location-only moves, badge size, colors,
and popup geometry must not trigger complete rating rebuilds unless a fixture
demonstrates that they affect a current filter. Mode, scoring source, grade
settings/display, relevant databases, enhanced-perk mappings, and chase/shopping
changes do invalidate their dependent facts. Register chase-list changes
explicitly; the current storage handler only rerenders the Explorer for them.

### 4. Native registration and validation

Create `src/dim-search-adapter.ts`. Keep DIM runtime discovery and all private
API assumptions here. Reuse the discovery technique demonstrated in
`compare-native-tooltips.ts`; do not alter that adapter as part of this task.
Require a unique candidate module and selectors with the expected dependency and
cache methods. Inspect matched module source before invoking its exports.

Register one owned definition in `filtersMap.kvFilters` and `allFilters`. Do not
overwrite another extension's `aegis` entry. Verify registration identity after
map/store changes. Leave native filters and DIM inventory objects untouched.

Use `format: 'query'` with an adapter-owned suggestions array whose `includes`
method validates the candidate argument and its readiness. The iterable array
still contains ordinary completion examples; its own `includes` method accepts
valid open-ended arguments such as source text. This has a source-level probe
against DIM's actual validator and factory. It must pass the equivalent deployed
runtime check in step 2 before it is accepted for production.

```ts
const hints = ['god', 'upgrade', 'p:>=a'];
Object.defineProperty(hints, 'includes', {
  value: (argument: string) => {
    const parsed = parseAegisArgument(argument);
    return parsed.ok && isReadyFor(parsed.value, currentSnapshot);
  },
});
```

Do not modify `Array.prototype`, DIM's validator, or unrelated definitions.
Do not use `format: 'custom'`: the examined factory does not implement it.
Do not substitute freeform plus a false predicate for validation. Recheck
readiness in predicate construction as well; there must be no fallback predicate
that silently broadens a larger expression.

The index contains owned instances only. An evaluated, unrated owned item does
not match a positive rating filter. Normal DIM negation may include unrated
items, materials, or vendor items that do not match the positive predicate;
do not silently redefine NOT to mean “other rated weapons.” A query using
`is:weapon` supplies that domain restriction explicitly.

### 5. Invalidation without editing the query

Clear the relevant Reselect argument caches and memoized result-function caches,
including configuration, factory, validation, native filter, and result selectors.
Then dispatch `shell/TOGGLE_SEARCH_RESULTS` with its **current explicit boolean
value**, not an omitted value. In the examined reducer this produces new shell
state while preserving panel visibility, exact query text, and input version.

This replaces the prototype's empty-component refresh. Feature-detect and test
the behavior in the deployed runtime. If the action becomes a no-op in a future
DIM release, the adapter is incompatible; do not quietly keep stale results.

Do not restrict invalidation to a header containing `aegis:`. Compare, Strip
Sockets, or an item picker may still hold one. Coalesce each logical pending/ready
transition, and ensure the store notification cannot trigger another identical
inventory publication. Do not clear unrelated selectors across the application.

### 6. Cutover and failure behavior

Native mode must leave Aegis tokens in DIM's input. Remove pill extraction and
its input/keydown/blur listeners, not just the pill element. Preserve shortcut
and Explorer/Chase entry points through one query-setting helper. Keep their
existing replace-query behavior unless a separate UX change is requested.

September 25, 2026 update: the later badge-ownership optimization supersedes the
requirement below to retain badge opacity synchronization. Badges are children
of the native tile and now share native search/ancestor opacity without a
separate observer, computed-style scan, or badge dimming state. See TESTING.md.

Remove only opacity/filter/pointer styles owned by the old Aegis search path.
Do not remove DIM's native search classes, badge opacity synchronization, or
another extension's styles. Winnower must continue using its existing host path.

Pending/unavailable Aegis clauses invalidate their whole expression. Surface a
brief loading/unavailable state; do not erase the query, strip its token, execute
an action, or revive visual-only filtering. Native-only searches continue to
work. When disabling/uninstalling registration, preserve the query and remove
only the definition this adapter owns. On pages using a different search engine,
do not install a second parser or claim compatibility without tests.

## Implementation sequence

Complete one step and its checks before the next. Keep each change reviewable.
Steps 3 and 4 can be split further by the listed substeps. Do not implement new
features while resolving a parity failure.

### Step 1 — Extract and characterize current matching

- Files: new `src/aegis-search.ts`, `tests/aegis-search.test.cjs`; targeted edits
  to `content.ts` around `evaluateAegisFiltering` and `compareGrades` only.
- Separate argument parsing, facts, and matching from DOM iteration. Temporarily
  let the existing visual path call the extracted matcher so there is one oracle.
- Build hand-authored fixtures for every family/alias, grade operator, case,
  invalid/incomplete input, armor, unrated item, and Both-mode behavior.
- Include equipped/dual/potential and two-tier examples. Assert expected matches,
  not just equality between two copies of the same implementation.
- Gate: focused test passes and existing grading/activity-mode tests pass. No
  native runtime integration, listener removal, or visible behavior change yet.

### Step 2 — Harden the runtime adapter with synthetic facts

- Files: new `src/dim-search-adapter.ts`, `tests/dim-search-adapter.test.cjs`, and
  a focused browser fixture. Keep it unconnected to normal extension startup.
- Implement discovery, owned registration, dynamic argument validation,
  invalidation, same-value notification, and disposal.
- Move the necessary probe contracts into tracked fixtures with the upstream
  revision and MIT attribution. CI must not require the ignored DIM checkout,
  a real account, or port 47195.
- Test changed module IDs/export names, ambiguous matches, absent cache APIs,
  immutable maps, namespace collisions, map replacement, double initialization,
  and disposal after another owner changes an entry.
- Gate: the existing live checks plus quoted whitespace, pending native typing,
  and variable source/range validation pass in a dedicated disposable tab.
  Intercept dispatch for account-changing actions; inspect targets only.
- If this gate fails, leave startup disconnected and document the exact failing
  contract. Do not replace the validator globally or weaken unavailable-data rules.

### Step 3 — Project inventory and preserve evaluation parity

**3A: Item inputs.** Add `src/dim-item-input.ts` and its tests. Extract shared
normalization from `main-world-content.ts`. Test duplicate hashes with distinct
string IDs, equipped/selectable/enhanced perks, masterworks, localized names,
variants, armor, incomplete sockets, and uninstanced/vendor items.

**3B: Weapon facts.** Add a DOM-independent facade around the existing evaluator
in `content.ts`. Extract grade finalization into a small module used by both
paths. Compare raw, finalized, and filter-visible expectations for PvE, PvP,
Both, wishlist/spreadsheet combinations, Light.gg, and custom grading.

**3C: Armor and secondary facts.** Reuse armor-set lookup and shopping/chase
resolution. Produce the facts needed by the matcher without attaching tooltips,
badges, DOM listeners, or rows in `playerVaultInventory`.

- Gate: fixture expectations match the current tile path for every supported
  family; inventory evaluations remain unchanged after Compare/Overview previews.
- Do not move the whole 7,000-line content script or redesign scoring as part of
  this step. Report a pre-existing discrepancy separately from this integration.

### Step 4 — Add the revisioned bridge and lifecycle controller

- Files: `src/search-protocol.ts`, `src/search-bridge.ts`, a main-world controller,
  and focused protocol/controller tests. Wire the two entry points only behind
  a development toggle until step 5 is ready.
- Implement schema validation, handshake, full-inventory projection, relevant
  change detection, pending/ready transitions, and atomic index replacement.
- Test out-of-order replies, deleted/new items, missing manifests, disconnected
  content script, account switch, mode/source changes during evaluation, and
  repeated identical data. Reject unknown IDs and mismatched item fingerprints.
- Use asynchronous scheduling outside predicate execution. A predicate performs
  synchronous reads only; it must never initiate scoring, storage, or network I/O.
- Gate: one logical update produces bounded work and reaches a stable idle state;
  no stale reply can reactivate old matches. Plain native searches still work
  while Aegis is pending or unavailable.

### Step 5 — Replace legacy search interception

- Files: targeted `content.ts` search-widget/observer edits; native startup in
  `main-world-content.ts`; narrow status UI and styles if necessary.
- Give search listeners a disposer/AbortController. Account for the current
  `observedSearchInputs` WeakSet so route changes do not strand or duplicate them.
- Remove token stripping, the separate active-filter pill/state, and search-owned
  CSS writes in native mode. Preserve DIM's Enter/Tab/IME/blur behavior.
- Route grade shortcuts, source combobox, Explorer filters, Chase ID searches,
  and clear controls through the intended native query entry point.
- Gate: actual input events work end to end, including typing while an evaluation
  completes, IME composition, undo/redo, quoted text, paste, and multiple Aegis
  clauses. Header, native count, visible matches, drawer, and menu targets agree.

### Step 6 — Exercise consumers and transitions

- Add `tests/native-search-browser.cjs` to the explicit list in
  `scripts/test-browser.mjs`. Unit tests named `*.test.cjs` are found automatically
  by `scripts/test.mjs`; browser suites are not.
- Test Compare and Strip Sockets while already open: change ratings, enter
  pending, clear the header, switch mode, and remove a matching item. Verify
  selected socket previews clear and disabled actions cannot use old selections.
- Exercise Organizer and native loadout/item-picker queries; confirm vendor and
  record pages tolerate owned-only facts. Do not alter native-only results.
- Cover reload with a saved `aegis:` query, a saved query without the extension,
  back/forward navigation, input replacement, failure/disposal, and re-enable.
- Check native badges, Compare/Overview recommendations, shopping audit, and
  Winnower for regression. Keep preview state out of the inventory index.
- Gate: no stale action target during transitions and no refresh/observer loop.
  Test failures here are release blockers, not reasons to drop lifecycle cases.

### Step 7 — Compatibility, performance, and release notes

- Run the targeted suites, then `npm run test:unit`, browser suites in Chromium
  and Firefox, and `npm run build`. Follow `docs/TESTING.md` for runtime setup.
- In PowerShell, set `$env:BROWSER_ENGINE = 'firefox'` for the Firefox browser
  run and remove it afterward. Do not substitute a normal Zen binary for
  Playwright's patched Firefox runtime.
- Verify deployed stable and beta DIM in Chromium and Firefox/Zen, with and
  without DIMSUM. Record tested versions and failures separately from fixtures.
- Measure cold grading, incremental grading, bridge payloads, native filtering,
  and UI update separately on a large synthetic inventory and a live large vault.
  Confirm no rescoring on keystrokes or purely visual setting changes. Do not
  use the MVP's 11 ms measurement as a grading performance claim.
- Update the README/filter examples, `docs/TESTING.md`, and changelog only after
  behavior is verified. Record supported syntax, readiness, saved-query behavior,
  and unsupported contexts. Do not change version or publish during this task.

## Completion checklist

- [ ] Native and Aegis clauses share DIM's parser and action target list.
- [ ] Existing filter-visible grading semantics have parity fixtures.
- [ ] No query byte changes, input resets, or lost edits during refresh.
- [ ] Full inventory coverage is independent of DOM rendering/annotation.
- [ ] Pending, unavailable, invalid, and ready-empty states are distinct.
- [ ] Negation and OR cannot bypass unavailable-data validation.
- [ ] Old revisions, account data, and previews cannot enter the active index.
- [ ] Open consumers update even with no Aegis clause in the header.
- [ ] Unsupported DIM runtime behavior disables integration predictably.
- [ ] Registration/listeners/styles are removed only when owned by this feature.
- [ ] No account-changing action was required to validate the integration.
- [ ] Cross-browser/live results are distinguished from fixture results.

## Copyable instruction for the implementer

> Read `docs/NATIVE_SEARCH_IMPLEMENTATION_PLAN.md` and
> `docs/SEARCH_ACTIONS_FEASIBILITY.md`. Inspect the working tree and preserve
> unrelated changes. Implement this plan sequentially, starting with step 1.
> Keep grading behavior unchanged and make each step pass its stated gate before
> wiring the next. Use small commits or reviewable changes; do not copy the
> synthetic runtime probe into production. Do not overwrite native DIM action
> handlers, mutate its inventory, publish a release, or execute account-changing
> actions for testing. If a private-runtime contract fails, leave native search
> disconnected and report the specific failed gate; continue independent pure
> extraction/testing work without substituting CSS filtering. Finish with changed
> files, verified checks, remaining compatibility limits, and completed steps.
