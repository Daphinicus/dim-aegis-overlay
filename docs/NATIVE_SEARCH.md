# Native Aegis search

The working-tree implementation registers `aegis:` with DIM's item-search
engine. DIM owns Boolean parsing, result counts, Search Actions, Compare, and
Strip Sockets. Queries remain in the search input and can be saved in DIM.
This document describes development changes, not a published release.

## Query examples

| Query | Meaning |
| --- | --- |
| `aegis:god` | Roll grade of S or better |
| `aegis:upgrade and is:weapon` | Weapons with an upgrade available |
| `aegis:p:>=a` | Perk grade of A or better |
| `aegis:p:>=a aegis:w:s` | Perk grade of A or better and weapon tier S |
| `aegis:w:s` | Weapon tier S |
| `aegis:pve:>=a` | PvE side of a split grade |
| `aegis:a:2p:>=a` | Armor two-piece rating of A or better |
| `aegis:shopping:ready` | Shopping-list items with a qualifying roll |
| `aegis:"source:king's fall"` | Source substring, with the whole argument quoted |
| `aegis:chase or aegis:bis` | Chase-list or best-in-class matches |

The existing aliases remain supported: perfect-roll, omni-roll, upgrade,
shopping, source, perk/weapon grade, and armor forms. `meta` is not supported.
Use DIM's native `and`, `or`, parentheses, and negation around complete filters.
Separating complete filters with a space also means AND. Pressing Space keeps
the first filter in the input so you can type the next one.
The widget writes a native query; it no longer removes tokens or creates a
separate filter pill.
Shield-menu filters replace existing terms for the same target (perk, weapon,
source, two-piece armor, or four-piece armor). Different targets combine with AND.
Aliases share a target, including `god` and perk grades; shortcuts such as perfect,
omni, upgrade, shopping, and chase retain separate targets. Replacing terms inside
manual Boolean groups preserves their grouping. Redundant AND nesting and
duplicate terms are removed. Incomplete input is preserved rather than discarded.
Source text adds a filter when you select a source or press Enter; typing only
narrows the source choices. The explicit clear button still clears the query.

The pin button in the popup header keeps it open after selections and outside
clicks. Escape or the shield closes it even when pinned. Pinning lasts for the
current widget session; it does not change the query or persist across reloads.

## Availability and compatibility

While inventory or grading data is pending, expressions containing `aegis:`
are invalid and return no matches, including negated and OR expressions.
Missing shopping data invalidates shopping queries without disabling unrelated
rating queries. A completed evaluation with zero matches is a valid search.
An unrated item does not match a positive rating query; native negation can
include it once evaluation is complete. This intentionally corrects the old
CSS filter's treatment of an absent grade as a numeric zero.

The adapter uses DIM internals because DIM does not expose an extension search
registration API. It requires unique runtime signatures, supported selector
caches, and mutable item-search maps. On an incompatible build, it leaves
`aegis:` text intact and disables the integration. Normal DIM searches remain
available. The widget tooltip reports pending or unavailable integration.
Winnower keeps its existing behavior.

The index contains owned weapon and armor instances from DIM state, including
items without rendered tiles. Vendor and hypothetical picker items are not
added to this index. Their handling under native negation remains DIM's own
behavior. Search definitions for other contexts, such as loadout names, are
not modified.

## Implementation

- `aegis-search.ts` parses arguments, matches compact facts, and finalizes grades.
- `dim-item-input.ts` shares socket and masterwork projection with tile annotation.
- `content.ts` evaluates projected inventory through the existing weapon and
  armor evaluators, then publishes only search fields.
- `search-bridge.ts` sends JSON messages across the main/isolated-world boundary.
  Session, account, inventory, and evaluation revisions reject obsolete results.
  Evaluation yields between batches using message tasks, including background tabs.
- `dim-search-adapter.ts` owns registration, selector refresh, inventory changes,
  and cleanup. Refresh preserves query bytes, input version, and panel visibility.
  Pending native actions are guarded, including a Strip Sockets footer whose
  query belongs to a sibling component. Unchanged old click handlers stay guarded
  until a new handler commits.

The adapter never replaces Redux dispatch or reducers and does not implement
inventory-changing actions. Query edits and presentation-only settings do not
trigger inventory grading. Compare's simulated perks do not populate the index.

## Verification

Run the normal unit and browser suites with `node scripts/test.mjs`, then
`node node_modules/typescript/bin/tsc --noEmit` and `node scripts/build.mjs`.

The search tests include 1,566 captured legacy matcher cases, the documented
unrated-item correction, compact-fact parity, grade finalization, native DIM
Boolean parsing, pending and unavailable states, stale revisions, a 1,601-item
inventory, query preservation, delayed action handlers, map replacement, and
cleanup. Pinned DIM fixtures include their upstream license and provenance.

For a signed-in Zen testing profile configured in `testing-build.local`, run:

```sh
node scripts/test-native-search-live.mjs
node scripts/test-native-search-live.mjs --beta
```

Build first. This opt-in test temporarily installs `dist`, creates a separate
background DIM tab, and restores the configured testing extension afterward.
It opens Compare and a Strip Sockets preview, but does not apply socket changes,
lock, tag, or move inventory. Existing tabs are not reloaded.
The live test types two Aegis filters with browser keystrokes, verifies that
Space preserves the complete query, and checks that both filters reach DIM's results.

On September 18, 2026, the implementation was exercised on stable and beta DIM in Zen
1.22.2b with 1,162 indexed items, including 1,002 rated items. The index completed
before tile annotations appeared. Live checks covered native action membership,
Compare's query and rendered targets, Strip Sockets preview membership, a pending preview transition,
and native typing followed by Tab and blur. Twelve subsequently rendered badge
grades agreed with the index.

Chromium fixtures and the full unit suite pass. Standalone Playwright Firefox
could not launch on this machine (`spawn UNKNOWN`); the live Zen checks exercise
Gecko's actual main/isolated-world bridge. A complete live matrix across all
grading preferences and DIMSUM combinations remains release testing.

## Inline search editor

The compact button immediately outside the search bar's right edge cycles through
three display modes:

| Mode | Button | Display |
| --- | --- | --- |
| Classic text | `T` | DIM's original input, with the complete editable query |
| Exact badges (default) | `</>` | Immutable badges containing the original filter syntax |
| Readable badges | `Aa` | Recognized filters use labels, such as **Perk ≥ S** and **Overload**, with a champion icon |

The selection is saved in `chrome.storage.local` as `aegisSearchDisplay` and
applies across DIM tabs. Switching modes preserves query bytes, current edits,
selection, and query undo/redo. Pointer activation keeps the search field focused;
keyboard activation keeps the mode button focused. Its accessible label and
tooltip identify both the current mode and the next mode.

Readable labels are presentation only. Copying, saved searches, Search Actions,
and term removal use the original query. Hover a badge to see its exact syntax.
Operators, negation, parentheses, comments, and draft text retain their syntax.
Unrecognized filters retain exact-text labels. Label formatting runs when a badge
is created or its mode changes, not on each character. Labels are currently in
English; the mode control has translations in the six supported UI languages.

Typing remains plain text. Complete terms convert into noneditable badges when
committed with a delimiter, Enter, autocomplete, or leaving the field. DIM's
validator decides whether a term can become a badge; unsupported or incomplete
terms remain editable text. Backspace/Delete remove badges as whole units, and
typing beside a badge starts a separate draft. Aegis terms use Master's default
search-pill palette (`#ffd700`, with a translucent gold background and border).
Other terms use muted blue-gray. Operators, parentheses, and comments remain
visible in the same field. X removes one term and cleans up its surrounding
Boolean expression; incomplete surrounding drafts remain editable.

The complete query stays synchronized with DIM's native input and React handlers.
Badges do not replace queries with item IDs or change search matching. Copy and
paste use plain query text, without the X glyphs. Undo/redo includes badge removal
and explicit conversion. Shift+Tab retains backward focus navigation.
The editor forwards autocomplete to DIM and follows native clear, saved-search,
and shield-menu updates. Long searches scroll horizontally to keep the shield,
star, and other controls in their own space.

`tests/inline-search-editor-browser.cjs` covers keyboard editing, Boolean removal,
clipboard text, history, native completion, external updates, layout, and cleanup.
`tests/search-display-browser.cjs` covers mode switching, shortened-label offsets,
exact clipboard data, cross-mode history, storage updates, keyboard focus, and
narrow layouts. Both badge modes run the structural performance checks.
The live test additionally exercises Tab completion and badge removal against
DIM's actual search state.

The original input is hidden with an Aegis-owned data attribute because React
replaces its classes when query validity changes. The visible editor restores
the native input if the required React handlers become unavailable. Accepted
badges stay immutable during rating refreshes; deferred validation can promote
previously committed terms after their data becomes available.

On September 21, 2026, live stable and beta DIM checks covered inline badge
removal, real query results, Tab completion, pinned filter selection, Compare,
and Strip Sockets previews in Zen 1.22.2b. The editor redirects DIM's native
focus calls so autocomplete keeps the visible editor active, including when
Gecko suppresses focus events in a background tab.
