# Aegis integration with DIM search

Study date: September 18, 2026.

## Finding

Direct integration works in the deployed application tested. A temporary
`aegis:mvp` predicate passed 12 checks in the expanded regression run in a dedicated background tab running stable
DIM in Zen 1.22.2b (Firefox-based). DIM's real search results, action targets,
result drawer, and Strip Sockets preview all consumed the custom predicate.
Updates to its match index refreshed those results without changing query text.

The preferred architecture is to register Aegis with DIM's search pipeline and
evaluate the complete inventory. Updating CSS or replacing only the action menu's
item array does not solve the underlying integration problem.

This study makes no production changes and performs no account-changing actions.
The probe temporarily registered a filter, intercepted Compare dispatch, opened
read-only previews, restored its changes, and closed its dedicated test tab.

The subsequent regression review and staged handoff are in
[NATIVE_SEARCH_IMPLEMENTATION_PLAN.md](NATIVE_SEARCH_IMPLEMENTATION_PLAN.md).

## Minimal live test results

The completed run is recorded in `scratch/search-mvp-live-results.json`. The
reproducible runner is `scratch/run-search-mvp.mjs`; it uses the existing local
debugging connection on port 47195 and requires an open stable DIM inventory tab
to obtain the account's inventory URL. It creates and closes its own background
tab. Run it with `node scratch/run-search-mvp.mjs`.

| Check | Result |
| --- | --- |
| Discover deployed search module and Redux store | Found using source signatures and React provider props; no fixed module IDs or export names. |
| Register `aegis:mvp` | Native validation, input, and autocomplete accepted it. |
| Search Actions | Received exactly the two selected weapon instances; native actions became available. |
| Compare callback | Intercepted its real dispatch; query and selected instances were exact. |
| Results drawer | Rendered the same two items and the header `2 items`. |
| Strip Sockets | Independently evaluated the custom query; its preview contained one applicable socket action on a matching item. Nothing was applied. |
| Match changes | Changed two matches to one; native results and action props updated with unchanged query/input text. |
| Independence from rendered inventory | Temporarily detached a real weapon's native tile, identified by DIM's own item index; it remained in native results and action targets. The tile was restored. |
| Boolean composition | AND, OR, and negation returned expected instances; combined-query action props agreed. |
| Empty and unavailable results | Empty sets stayed empty. Unknown arguments and unavailable predicates disabled actions, including under negation and OR. |
| Exact input preservation | The revised refresh retained quoted whitespace, input version, and results-panel state. |
| Pending native input | An unfinished edit survived refresh and became the correct query after DIM's debounce. The native handler was exercised directly; removing legacy Aegis DOM listeners remains implementation work. |

The tested predicate received all 1,584 inventory items from DIM in the expanded
run (1,583 in the original run). The inventory contained 698 eligible weapon
instances. One synchronous refresh took about 19 ms in the expanded run,
excluding React rendering; this is a smoke-test
measurement, not a performance guarantee.

The probe used a synthetic membership index over real item instances. It proves
the native integration path, not a completed refactor of Aegis grading. It did
not execute tagging, locking, transferring, or socket changes. It checked their
shared action-target inputs and exercised Compare's callback with dispatch
intercepted. DIM updated its inventory state reference during the run, so
reference identity is not evidence that background inventory refreshes stopped.

### The refresh mechanism that worked

The probe registered the definition in the live `kvFilters` map and `allFilters`
list. It cleared both the argument caches and result-function caches of the
relevant Reselect selectors. The revised probe dispatches DIM's existing
`shell/TOGGLE_SEARCH_RESULTS` action with the current explicit boolean value.
This creates new shell state without changing the query, input version, or
results-panel visibility. React subscribers receive newly computed results.

The original MVP used an empty `shell/TOGGLE_SEARCH_QUERY_COMPONENT` action.
A regression probe confirmed that this can collapse whitespace inside a quoted
value and that it increments the input version, which resets native input state.
Do not use that original method in production. The replacement passed the full
live sequence plus exact-text and pending-input checks.

Clearing caches without that state update failed the first unavailable-filter UI
check: the manually queried selector had fresh results while the mounted menu
still had old props. Using the full refresh sequence resolved it. A separate
repeat was interrupted when the shared tab navigated to Vendors; the final
passing run used an isolated background tab.

This refresh adapter depends on DIM internals and needs compatibility checks.
The explicit same-value results action must continue to produce new shell state
without changing the query or UI; otherwise the adapter is incompatible.
A dedicated upstream invalidation hook
would be preferable if available. No root reducer, inventory objects, or native
action implementation was replaced.

### Decision

Build out the native approach. Runtime access, native registration, complete
inventory access, action routing, and result invalidation all have live evidence.
The remaining work is integrating real Aegis evaluations, handling their lifecycle,
and validating compatibility across supported browsers and DIM stable/beta.
This is a go decision for implementation, not a release-ready feature.

### Regression review evidence

`scratch/search-regression-probe.cjs` runs six checks against the pinned DIM
source and records `scratch/search-regression-results.json`. These reproduce the
quoted-whitespace mutation, verify the replacement reducer behavior, test a
definition-owned suggestions validator for variable arguments, demonstrate
unavailable-data behavior under NOT/OR, expose the unsafe freeform/false approach,
and verify complete-argument quoting for source names containing spaces.

The initial DOM-absence check used missing Aegis annotations as a proxy for an
unrendered item. A repeat exposed that annotation could simply be delayed. The
expanded live probe instead locates a tile by DIM's native item index and
temporarily detaches/restores it. This proves independence from a present tile;
an actual collapsed-section lifecycle test remains part of implementation QA.

## Evidence and scope

The local DIM checkout is version 8.142.0, commit
`4ddd5ec0b3212037efaf16ab36210014735d90ff`, dated September 14, 2026. The study uses
that pinned revision; it does not establish that the deployed app runs the same
revision. A fresh GitHub HEAD check was unavailable. Web-accessible upstream
copies independently confirm the ID predicate and selector pipeline.

Relevant source:

- [DIM search selectors](https://github.com/DestinyItemManager/DIM/blob/4ddd5ec0b3212037efaf16ab36210014735d90ff/src/app/search/items/item-search-filter.ts)
- [DIM search factory and validator](https://github.com/DestinyItemManager/DIM/blob/4ddd5ec0b3212037efaf16ab36210014735d90ff/src/app/search/search-filter.ts)
- [DIM Search Actions menu](https://github.com/DestinyItemManager/DIM/blob/4ddd5ec0b3212037efaf16ab36210014735d90ff/src/app/search/MainSearchBarMenu.tsx)
- [DIM action handlers](https://github.com/DestinyItemManager/DIM/blob/4ddd5ec0b3212037efaf16ab36210014735d90ff/src/app/item-actions/ItemActionsDropdown.tsx)

The earlier source-only probe is `scratch/search-actions-feasibility.cjs`. Run it from the
repository root with `node scratch/search-actions-feasibility.cjs`. It requires
the existing `scratch/dim-source` checkout and writes
`scratch/search-actions-feasibility-results.json`. Scratch files are ignored by
Git. Localization and logging are stubbed; DIM's parser, validator, predicate
factory, ID/hash definitions, and utility functions execute from the checkout.

## Why the current filters do not work with Search Actions

In `src/content.ts`, `processCompletedAegisToken` removes the Aegis token from
DIM's input. `evaluateAegisFiltering` then applies opacity, grayscale, and pointer
styles to rendered item elements. The evaluation payloads are stored in a
`WeakMap` keyed by elements.

DIM independently derives its results through:

```text
Inventory objects + query + filter definitions
  -> searchFilterSelector
  -> filteredItemsSelector
  -> result count, results drawer, and Search Actions
```

The action menu receives `filteredItems`, `searchQuery`, and a validity flag.
With an Aegis-only filter, removing the token can leave an empty native query and
disable actions. With a mixed filter, actions can operate on the broader native
query rather than the Aegis subset.

## Preferred approach: a native Aegis filter

DIM's filter factory and validator look up filter definitions in
`filtersMap.kvFilters`. Registering an `aegis` definition there allows its parser
to evaluate a predicate on each `DimItem`. Aegis can supply synchronous membership
lookups into an index of evaluated inventory instances, avoiding asynchronous
spreadsheet work inside DIM's predicate.

The probe registered a synthetic Aegis membership predicate and verified:

- `aegis:god` passes DIM's validator and returns the intended item instances.
- Combining it with a native filter using `and` produces the intersection.
- `or` and negation use DIM's normal Boolean semantics.
- Updating the membership index changes predicate results, but an already
  computed result array remains stale until recomputed.

That earlier probe proved the filter mechanism. The live test above additionally
proved runtime registration in the tested deployment; equivalence with every
existing Aegis rating rule remains implementation work.

There is already relevant integration infrastructure in the overlay:

- `src/compare-native-tooltips.ts` discovers modules through DIM's Rspack/Webpack
  runtime without fixed module IDs.
- The same adapter walks React provider props and reads `store.getState()`.
- DIM's inventory selector reads all stores' item arrays from its Redux state.
- The overlay already runs a main-world script on DIM.

These are implementation precedents, not a public extension API. No supported
external filter-registration API was found in the examined source. Production
bundling can rename, combine, or omit exports. The live probe located the real
filter map through the discovered search selectors' dependency graph; this
approach still needs compatibility testing beyond the tested deployment.

### Required changes

1. Extract Aegis query matching from DOM styling into a reusable predicate. Keep
   badge evaluation and search evaluation consistent for weapons, armor, modes,
   and shopping/chase filters.
2. Build evaluations from DIM's inventory objects, keyed by exact string instance
   IDs and account. Subscribe to inventory changes and Aegis data/settings changes.
3. Register the predicate in the real search configuration. Preserve `aegis:` in
   DIM's query and integrate validation and suggestions where necessary.
4. Make Aegis data revisions invalidate the relevant DIM search caches and trigger
   subscribed views to update. Changing an external `Set` is insufficient. DIM's
   shell reducer returns unchanged state for the same query, so redispatching the
   identical query is insufficient too.
5. Retire the parallel CSS-only search behavior when the native adapter is active.
   Verify that result counts, results drawer, highlighted items, and action targets
   all reflect the same query and data revision.

The inventory work matters: DIM's `CollapsedSection` does not render collapsed
children. Scanning item tiles cannot guarantee complete results. Existing DOM
caches also need account, removed-item, and data-refresh handling before they
could serve as authoritative inventory indexes.

Loading and failure handling must apply to the complete Aegis-containing query.
A false predicate alone is insufficient while data is unavailable: `-aegis:god`
would invert it and match items. Actions must not become available for a stale,
partial, or unavailable evaluation as though it were complete.

## Expected action coverage

| Action | DIM behavior | Implication |
| --- | --- | --- |
| Tag, lock, unlock, notes | Uses filtered item objects; checks eligibility as appropriate | Native Aegis results should flow through existing handlers. |
| Move | Builds a move loadout from filtered items | Existing capacity and transfer rules still apply. |
| Compare | Receives the query and filtered items; requires compatible item types | Correct native results should preserve existing behavior. |
| Strip sockets | Passes the query to a dialog that filters inventory again | Aegis must work in the shared filter factory, not only the initial menu. |
| Save search | Saves query text | A native `aegis:` query remains meaningful where the extension is active. |

Account-changing action coverage is inferred from the source and shared live
action-target props. Compare dispatch and the Strip Sockets preview were tested
as described above. No live account-changing bulk action was executed.

## Alternative: translate into native ID searches

This also changes DIM's real results. It is a lower-coupling fallback if runtime
filter registration proves unreliable. DIM supports exact `id:` matching, and the
overlay already generates OR-separated ID queries in `triggerDimSearchForIds` for
the Chase List's Highlight in Vault action.

For a mixed filter, the generated query can be:

```text
(original native query) and (id:instance1 or id:instance2)
```

The IDs must remain strings to preserve their full precision. Empty results must
produce a valid contradiction such as `id:0 and -id:0`; an empty query matches all
items. A live version must recompute IDs when inventory or Aegis inputs change.

The probe passed eight ID-query checks covering precision, duplicates, combined
queries, exclusions, empty results, invalid native filters, and search history.
It also correctly matched 100, 1,000, and 2,000 selected IDs against 2,000 synthetic
inventory items. Single-run validation, compilation, and filtering took roughly
5–37 ms in Node on this host. These are smoke-test measurements, not browser
performance claims; rendering, autocomplete, and repeated selector work were not
measured.

The generated queries were 2,596–51,996 characters. DIM accepts these as valid
searches in the tested source but disallows saving queries over 2,048 canonical
characters. Saved ID queries represent particular copies rather than a reusable
Aegis rule. These limitations favor native `aegis:` registration for the intended
user experience.

## Recommendation and completion criteria

The bounded prototype passed. Proceed with a search/data refactor around native
filter registration. The evidence supports implementation but does not establish
release readiness.

Use the following conditions to guide production validation. The minimal live
probe covers the core path in one browser/deployment; it does not cover every
listed lifecycle or compatibility case:

1. Discover the search configuration and inventory store in deployed stable and
   beta DIM without fixed module IDs or executing unrelated module factories.
2. Register one `aegis:` predicate and show matching native counts, results, and
   action targets, including items in collapsed sections and duplicate rolls.
3. Refresh results when inventory, rating data, or mode changes while query text
   remains unchanged; handle pending evaluations, zero matches, and negation.
4. Demonstrate correct query reuse in Compare and Strip Sockets, plus predictable
   clearing, navigation, and account switching.
5. Verify Chrome and Firefox behavior and disable Aegis-dependent actions if a
   DIM update makes the adapter incompatible.

If runtime registration or invalidation cannot be made reliable, use complete
inventory evaluation plus native ID queries, or seek an upstream extension hook.
Do not return to CSS-only filtering as though it provided Search Actions support.
