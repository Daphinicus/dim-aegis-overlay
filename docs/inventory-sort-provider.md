# Inventory sorting provider

Aegis publishes cached inventory evaluations for DIM-SUM numerical and grade
sorting. The provider does not read badge text, create a second inventory scan,
change settings, or fetch data. It works while **Rating display** is Grades or
Scores and while inventory tiles are hidden or unmounted.

## Connect and updates

Dispatch a cancelable `aegis:inventory-sort-request-v1` CustomEvent on `document`
with the string detail `JSON.stringify({type: 'connect'})`. The active provider
acknowledges synchronously with `preventDefault()`. An acknowledgment establishes
liveness, including when the inventory is pending; it does not establish ratings
availability. The command performs no evaluation or state publication.

Read the JSON script node `aegis-inventory-sort-state-v1`, then listen for the
plain document event `aegis:inventory-sort-state-v1`. Read the node again after
notification. JSON text and string commands cross isolated extension worlds in
Chrome and Firefox without exporting objects. Ignore unsupported versions,
malformed states, and commands that do not receive an acknowledgment.

Parse each publication once and index items by their instance ID and item hash.
Never connect or parse the snapshot inside a sort comparator. Pending or
unavailable states contain no items; clear the previous index immediately. A
removed node means the provider was disposed. Provider replacement and a page
exit remove the old node and notify consumers. Cached page transitions preserve
the provider. A consumer can probe liveness while visible to detect extension
context loss without scanning inventory.

## Version 1 schema

```ts
{
  version: 1,
  generation: number,
  status: 'pending' | 'ready' | 'unavailable',
  revision: null | {
    session: string,
    accountEpoch: number,
    inventoryRevision: number,
    evaluationRevision: number
  },
  settings: {
    mode: 'pve' | 'pvp' | 'both',
    profile: 'best' | 'omni',
    comparisonActivity: 'pve' | 'pvp',
    source: 'aegis' | 'lightgg',
    dbMode: 'spreadsheet' | 'wishlist' | 'both',
    gradeDisplayMode: 'equipped' | 'dual' | 'potential'
  },
  items: [{
    id: string,
    hash: number,
    kind: 'weapon' | 'armor',
    scores: {
      pve: { best: number | null, omni: number | null },
      pvp: { best: number | null, omni: number | null }
    },
    grades: {
      pve: { label: string | null, rank: number | null },
      pvp: { label: string | null, rank: number | null }
    },
    selected: { score: number | null, grade: number | null }
  }]
}
```

`generation` increases with each publication from one provider. The revision is
copied from Aegis's native search request. Its three numeric counters are
integers. A new page or replacement provider can restart generation numbering;
clear state on disposal rather than rejecting the new provider forever. Ready
contains the complete evaluated inventory for that revision, including unrated
items. An empty ready inventory is valid. Settings, inventory, account, source,
and evaluation locale changes use the native search invalidation path. Pending
is published immediately, before evaluation resumes. Interrupted generations
cannot publish a partial or stale ready inventory.

## Sorting semantics

Use `selected.score` and `selected.grade` as comparator inputs. Higher values
rank first by default. Keep null after rated items in both directions, then use
DIM's native tie-breaker. A real score of zero remains rated. A missing grade is
null; F has rank 10. Precision only formats presentation and never rounds sort
values. For example, 89.991 sorts below 90 even if both display as 90%.

Numbers use the selected Best/Omni profile and the active PvE/PvP activity. In
Both mode, `comparisonActivity` chooses the numerical activity, matching Aegis's
owned-copy comparison policy. Both numerical activities remain available in the
snapshot. Missing sources, unsupported items, and uncertain owned configurations
have null values. Best can remain rated when an unknown origin maximum makes
Omni unavailable. Armor never receives a weapon percentage score.

Grades retain the legacy evaluator and custom grade rules independently of
percentage scores. The provider uses Aegis's `displayGrade()` and `gradeValue()`
policy: roll grade rather than a two-tier weapon prefix, potential grade for a
dual arrow, and the better available activity in Both mode. Equipped and
potential preferences are applied by the same grade finalization as native
search and inventory badges. The single active activity has a grade; an inactive
activity has null because the legacy evaluator has not evaluated it. Armor's
selected grade is the better two-piece/four-piece grade. Letter badge weapon-basis
presentation does not change the provider's roll-grade sorting semantics.

The provider and consumer preserve settings. DIM-SUM owns sorting choices,
global and local overrides, direction, and stable tie-breaks. It must not send
its custom sorting IDs to DIM's native sort preference.

## Verification

`tests/scores/inventory-sort.test.ts` checks raw and zero scores, unavailable
Omni, grade policies, activity/profile selection, armor, string-only liveness,
provider replacement, page lifecycle, and interrupted full-inventory evaluation.
The production content integration in `tests/scores/overlay.test.ts` checks
Grades/Scores independence, precision, profile invalidation, and Light.gg
fallback without assigning a numerical weapon score.

Authenticated Chrome and Zen checks must be recorded separately from these
fixtures after a coordinated shared testing-slot handoff.

Authenticated sorting checks on October 2, 2026 verify the stock provider in
Chrome 154.0.8037.59 on DIM standard 8.144.0 and beta 8.144.0.4905. Both expose
1,298 owned items, 548 PvP/Best scores, and 1,090 potential-grade ranks. The
standard receipt completes global/local weapon and armor ordering, both
directions, and exact preference restoration. The initial beta receipt verifies
weapon ordering but fails the final local-scope assertion before armor checks;
those cases require a completed follow-up receipt. Zen helper activation is
verified, while its live contexts time out. The [live evidence](score-live-evidence.md)
records these limits, final stock hashes, and companion preservation separately
from automated fixture results.
