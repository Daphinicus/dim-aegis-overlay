# Aegis percentage score implementation plan

Implement an opt-in percentage display for legendary weapons in the DIM Aegis overlay. The purpose is to help the user compare drops in their actual vault, then refine the calibration after use. This is an implementation handoff: follow the phases below in order, use the specified defaults, and verify the acceptance fixtures. The implementing agent does not need the originating conversation.

The first trial is implemented in the accompanying branch. Its 122 automated tests, TypeScript checks, builds, package checks, and a Chromium menu smoke check pass. Authenticated DIM browser testing remains pending; follow `score-local-session-prompt.md`. The origin benchmark registry starts empty rather than inventing capacity evidence, so ambiguous Omni origin targets remain unrated. New score labels currently use English fallbacks in other menu languages. The adjacent `score-acceptance-fixtures.json` is a portable mathematical contract, not captured player inventory.

## Starting point

- Repository inspected: `dim-aegis-overlay`, commit `e5442899594a872beec54f4ae95af9af973a6760`.
- Recheck the working tree and applicable `AGENTS.md` before implementation. Locate functions by name if lines have moved. Preserve concurrent work, especially the personal wishlist feature.
- `src/scorer.ts` scores DIM wishlists. The spreadsheet grade evaluator is `scoreSheetWeapon` in `src/content.ts`. Do not replace the wishlist scorer with the new algorithm.
- Data snapshots contain 748 PvE and 791 PvP legendary rows. All PvE legendary rows have ranks; Finnald legendary ranks are blank. Each activity also has 141 exotic rows, excluded from this calibration.
- This scope is the overlay repository. A separate DIM-SUM or Winnower repository may consume the new fields later; do not claim those external integrations are implemented from this checkout.

## Agreed product behavior

1. Scores summarize the official Aegis PvE or Finnald PvP recommendations. Personal wishlists do not alter numerical scores.
2. Compare within the spreadsheet weapon category. Frame and element are filters, not independent normalization groups. A 90% glaive and a 90% sniper are not equivalent overall damage or utility.
3. Scores replace grade text when enabled. Users can switch back to grades. Preserve existing grade settings and calculations.
4. The default score profile is **Best selections**: use the strongest recommended options actually owned on that instance, whether active or selectable. Extra alternatives do not increase this profile.
5. **Omni coverage** adds a small contribution for owning additional recommendations. Its benchmark is two barrels, two magazines, three Trait 1 options, three Trait 2 options, and one masterwork type. Never reduce these targets to the individual drop's smaller capacity.
6. Origin capacity is weapon-specific, with no fixed limit of three. Use the maximum recommended origin coverage possible together on a legitimate relevant version, including applicable special variants with Accelerated Assault. Never union mutually exclusive origin sets into an impossible target.
7. Unlisted perks receive zero credit. A known unmatched slot is different from an unreadable or unrated slot.
8. Assume full masterwork investment, but evaluate the actual masterwork type. A crafted weapon is scored as configured; hypothetical reshaping options are not owned perks.
9. PvE and PvP produce independent scores. In dual mode, preserve the split presentation. Missing PvP data never falls back to PvE, or vice versa.
10. An unrated score displays `—`. A fully observed roll with no recommendation matches displays `0%`.
11. Display whole percentages by default. Offer exactly 0, 1, or 2 decimal places. Calculations, comparisons, and sorting retain full precision.
12. Only a structurally complete 100% score may display 100. Incomplete results cap at 99%, 99.9%, or 99.99%, according to display precision.

## Implementation defaults for the first trial

These choices make the handoff executable. They are initial implementation choices, not additional preferences claimed from the user.

- Keep existing installations on Grades until the user opts into Scores. When they enable Scores, initialize Best selections and 0 decimals.
- Use the calibrated constants in the next section; make them centralized and versioned, not user-adjustable weight sliders. Future personal preferences belong to the wishlist feature.
- Base and enhanced forms of the same perk are equivalent for v1 matching and coverage. Deduplicate them. No separate enhancement bonus has been calibrated.
- Score legendary weapons with adequate source and owned-slot data. Exotics display `—` in score mode until an explicit exotic model exists. Armor retains its current grading presentation.
- Scores are available with the Aegis/Finnald engine and Spreadsheet or Both ranking sources. In Light.gg or wishlist-only mode, use the existing source presentation and disable the Scores control with a short explanation. Preserve the user's saved score preferences for when official spreadsheet scoring is available again; do not silently change ranking sources.
- Color numerical scores from red at 0% through yellow at 50% to green at 100%, using the raw percentage independently of displayed precision. Use a neutral dash with 40% alpha for unavailable values; a real zero stays red. Preserve the existing badge/container and activity layout. Do not infer letter-grade styling by parsing `97%` or show an S-roll gold glow for a numerically weak weapon.
- Render the percent suffix at 65% of its score numeral size, aligned to the baseline with no inserted space. Use relative font sizing so it follows badge sizing and zoom; retain the complete plain percentage for accessible labels, copied text, and data. This ratio follows the user's visual preference, not a prescribed accessibility threshold. See [Google's percentage formatting guidance](https://developers.google.com/style/numbers#percentages) and [W3C text resizing guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
- Offer **Percent symbols → On/Off** under **Scoring → Scores**, saved as `aegisScoreShowPercent`. Default to On; only explicit `false` disables it. Hide only the score suffix spans in Aegis and DIM-SUM using a root presentation attribute and visually hidden CSS. Retain canonical percent text, accessible labels, raw values, colors, precision, and unavailable dashes. A suffix-only change does not invalidate native search or evaluate inventory again.
- Preserve existing personal wishlist bookmark behavior: outlined for a complete owned roll, filled for an applied complete roll, with bookmark priority over other whole-roll markers. Numbers do not replace bookmark meaning.

## Exact scoring contract

### Weapon ceiling

Use these best-member ceilings, in percentage points:

| Tier | Best member | Last ranked member |
| --- | ---: | ---: |
| S | 100 | 96 |
| A | 90 | 86 |
| B | 78 | 74 |
| C | 65 | 61 |
| D | 50 | 46 |
| E | 37 | 33 |
| F | 25 | 21 |

For a numeric rank `r`, find `rMin` and `rMax` among entries in the same activity, spreadsheet category, and tier:

```text
progress = rMax > rMin ? (r - rMin) / (rMax - rMin) : 0
ceiling = tierCeiling - 4 * progress
```

When the row has no numerical rank, use its tier ceiling without a deduction. Do not infer rank from row order, alphabetical order, notes saying Best-in-Class, or a missing value coerced to zero. Count unique source rows, not aliases in `weapons` or repeated `variants` references. Ties in rank share a ceiling. Missing tier/category, conflicting rank data, or an unresolved source version produces an unrated result with a reason; do not silently clamp inconsistent input into a valid ranking.

Changing the ranked population can change the within-tier interpolation. That is expected on a real source update. Invalidate the ceiling index when the corresponding database changes.

### Slot weights

| Slot | PvE | PvP |
| --- | ---: | ---: |
| Trait 1 | 35 | 34 |
| Trait 2 | 35 | 34 |
| Magazine | 12 | 14 |
| Barrel or equivalent | 8 | 10 |
| Masterwork | 6 | 6 |
| Origin | 4 | 2 |

Barrels include the corresponding sight, string, blade, or launch tube slot. Magazines include batteries, arrows, guards, and other existing equivalents. Keep source recommendations attached to the correct slot.

An explicit source `None` removes that criterion; renormalize the other weights to sum to 1. A blank, uncertain token, or unreadable owned slot does not mean `None`: retain an unrated state. An absent origin on an old weapon must not be penalized again if the source explicitly says `None`; its weapon tier already reflects that limitation.

For the current snapshot, examples of source issues are a blank magazine for `Mykel's Reverance` and `Headseeker (???)` in Nameless Midnight's Trait 2 list. Preserve the reason instead of silently repairing the curator's meaning.

### Perk order credit

The source order is authoritative. With zero-based recommendation position `i`:

```text
credit(i) = 0.90 + 0.10 * 0.60^i
```

The first four values are `1`, `0.96`, `0.936`, and `0.9216`; subsequent alternatives gently approach `0.90`. A non-recommended perk receives `0`. Never alphabetize the source list or treat same-index perks across columns as prescribed pairs.

Global perk tiers are not an additional multiplier in this calibrated model. In particular, do not use them to give unlisted perks partial credit, reorder weapon-specific recommendations, or import Finnald's PvE-cloned standalone perk tables as PvP ratings. The weapon tier and its explicit recommendations remain the authority.

### Best selections score

For each applicable slot `s`, let `q[s]` be the highest credit of a recommendation actually owned in that slot, or zero for a known unmatched slot. With normalized weights `w[s]`:

```text
Q = sum(w[s] * q[s])
bestScore = ceiling * Q
```

Selecting a different owned perk, changing DIM's preview, or changing the active loadout does not change the owned potential score. It may change existing selected-perk indicators. Reshaping, rerolling, or otherwise changing the owned configuration does invalidate the score.

### Omni coverage score

For the five fixed-capacity criteria, use capacities `{barrel:2, mag:2, perk1:3, perk2:3, masterwork:1}`.

For each slot, `k = min(number of recommended options, benchmark capacity)`. The denominator is the sum of credit for the first `k` recommendations. The numerator is the sum of the best `k` distinct recommended options actually owned. The numerator may include lower-priority alternatives but never count an enhanced/base duplicate twice.

```text
c[s] = ownedRecommendedCredit / maximumBenchmarkCredit
C = sum(w[s] * c[s])
omniScore = ceiling * (0.90 * Q + 0.10 * C)
```

Example: three recommended Trait 2 perks require three for full coverage, even if the owned version can only have two. Two recommendations require both, not an invented third. Four recommendations use the best attainable three within the fixed trait benchmark. Owning more options than a fixed benchmark does not create credit above 1.

For origins, enumerate verified **coexisting sets** for the relevant weapon family/version. Intersect each legal set with the official origin recommendations, calculate its recommendation credit, and take the greatest value as the denominator. Score the observed legal owned set against that denominator. Unlisted origins such as Accelerated Assault add no points unless the source recommends them. Their existence may matter to coexistence metadata but does not create an extra required unlisted perk.

One recommended origin has an unambiguous denominator once the recommendation and owned-slot data are resolved; it does not require proving a larger total origin capacity. Multiple recommended origins require a verified benchmark. If that benchmark is unknown, Best selections may remain rated while Omni displays `—`.

Do not derive the origin maximum from this player's observed roll, the length of an incomplete flat manifest array, or the union of unrelated legacy/reissued weapons sharing a name. Every origin record must declare applicability and provenance. A single observed roll proves coexistence of its options but does not prove it is the maximum possible.

### Completion and formatting

Keep separate flags for all first choices owned, full benchmark coverage, and perfect overall score. A C-tier weapon can have complete Omni coverage without an overall score of 100.

- Best is a perfect overall score only if the ceiling is exactly 100 and every applicable slot contains its first choice.
- Omni is perfect overall only if that condition holds and full verified coverage is attained.
- Determine completion from normalized identities/benchmark attainment, not rounded percentages or a permissive floating-point epsilon.
- Clamp numerical roundoff to valid bounds, but do not promote an incomplete result to 100. If necessary cap its stored raw value at `100 - Number.EPSILON * 100`.

Formatting contract, after validating `precision` is 0, 1, or 2:

```text
unrated -> "—"
scale = 10^precision
rounded = floor(value * scale + 0.5 + 1e-9) / scale
display = perfectOverall ? 100 : min(rounded, 100 - 1/scale)
text = display.toFixed(precision) + "%"
```

Explicit precision uses fixed decimal places: `80%`, `80.0%`, `80.00%`. The 100% rule changes display only; sorting and numeric predicates use the full raw value and a rated/unrated distinction. Do not format or concatenate scores into `result.grade` or `matchPercentage`.

## Required data structures

Add `src/score-types.ts`. Equivalent naming is acceptable only if every caller uses the same contract; do not invent alternative meanings for the fields.

```ts
type ScoreActivity = 'pve' | 'pvp';
type ScoreProfile = 'best' | 'omni';
type ScorePrecision = 0 | 1 | 2;
type ScoreSlot = 'barrel' | 'mag' | 'perk1' | 'perk2' | 'masterwork' | 'origin';
type CanonicalPerkId = string; // stable base-perk identity, never localized display text

type SourceSlot =
  | { state: 'ranked'; recommendations: readonly CanonicalPerkId[] }
  | { state: 'not-applicable' }
  | { state: 'unknown'; reason: string };

type OwnedSlot =
  | { state: 'known'; available: readonly CanonicalPerkId[] }
  | { state: 'unknown'; reason: string };

interface OwnedScoreSnapshot {
  schemaVersion: 1;
  itemHash: number;
  instanceId?: string;
  slots: Record<ScoreSlot, OwnedSlot>;
}

// DOM bridge DTO, before content-script canonicalization. Reuse these field
// names, but never assert that a raw plug hash is already a canonical identity.
interface RawOwnedScoreSnapshot {
  schemaVersion: 1;
  itemHash: number;
  instanceId?: string;
  slots: Record<Exclude<ScoreSlot, 'masterwork'>,
    | { state: 'known'; availableHashes: readonly number[] }
    | { state: 'unknown'; reason: string }>;
  masterwork:
    | { state: 'known'; statHash: number }
    | { state: 'unknown'; reason: string };
}

interface ScoreValue {
  value: number | null; // percentage points, full precision
  perfectOverall: boolean;
  reason?: string; // stable code; translated explanation belongs to the renderer
}

interface WeaponScoreEvaluation {
  modelVersion: string;
  sourceRevision: string;
  ceiling: number | null;
  quality: number | null; // Q, 0..1
  coverage: number | null; // C, 0..1
  allFirstChoices: boolean;
  fullCoverage: boolean;
  best: ScoreValue;
  omni: ScoreValue;
  slots: readonly SlotScoreBreakdown[];
}
```

Define `SlotScoreBreakdown` with slot, applicable normalized weight, best matched recommendation index, Q contribution, C contribution or reason, and benchmark capacity/legal-set reference. Provide reasons for missing source, unresolved category/variant, unknown owned slot, unresolved recommendation identity, unsupported exotic, and missing/inconsistent origin benchmark.

Add an optional `scoreEvaluations?: Partial<Record<ScoreActivity, WeaponScoreEvaluation>>` to `WeaponEvaluationPayload` in `src/types.ts`. Reuse the same evaluation objects in dual tooltips and copy comparisons. Grade fields remain grade fields. Store both score profiles together so changing profile or display precision does not rerun the model.

New normalized source records must retain activity, stable source row identity, category, tier, optional numeric rank, exact version applicability, ordered slot recommendations, and data revision. Build a category/tier ceiling index once per source revision.

## File map

| File | Work |
| --- | --- |
| `src/score-types.ts` | New explicit score inputs/results and reason types |
| `src/score-config.ts` | New constants, model version, capacities, settings defaults |
| `src/score-model.ts` | New pure ceiling, Q, C, and completion calculation |
| `src/score-format.ts` | New formatting and raw numerical comparison helpers |
| `src/score-source.ts` | New source normalization, ordered identities, category/rank indexing |
| `src/score-owned.ts` | New validation/canonicalization of owned snapshot data |
| `src/score-origins.ts` | New verified origin-set lookup and benchmark resolution |
| `src/types.ts` | Extend storage/source/payload types without changing legacy grade meanings |
| `src/background.ts` | Preserve source category/type and revision in live spreadsheet sync |
| `scripts/sync-sheets-cron.mjs` | Equivalent metadata in the checked-in snapshot generator |
| `src/main-world-content.ts` | Publish actual per-slot owned hashes and masterwork identity |
| `src/content.ts` | Evaluate/cache, render, filter, and compare structured scores |
| `src/tooltip.ts` | Render the selected numeric result and compact optional explanation |
| `src/popup.ts`, `public/popup.html` | Persist display/profile/precision controls and preview |
| `src/i18n.ts`, `public/styles.css` | New labels, reason text, score styles and width handling |
| `data/score-origin-benchmarks.json` | Verified origin evidence only; an empty initial registry is valid |
| `tests/scores/` | Pure model, adapter, settings, and rendering-contract tests |
| `package.json`, lockfile | Add a compatible test runner and focused score test command |

Do not copy the calibration report's DOM stub into the product. The mathematical fixtures are useful; actual extension extraction and rendering need separate verification.

## Implementation phases

### Phase 1 Build the pure engine

1. Add the score types, configuration, model, and formatter. Export small deterministic functions; these modules must not read Chrome storage, DOM, network, or user inventory.
2. Assign model version `aegis-score-v1`. Changing weights, credit curves, benchmarks, or rounding semantics requires a version change.
3. Add a Node test runner compatible with this Vite 5 repository, for example `vitest@2` as a development dependency. Add `test:scores` running `vitest run tests/scores`. Commit the dependency lock update during implementation.
4. Load the adjacent acceptance fixture file in tests and implement every expectation. Keep raw-score tolerance tests separate from exact string-format tests.
5. Add property cases: same-tier rank monotonicity, equal ceilings without ranks, recommended order monotonicity, unlisted zero credit, enhanced duplicates, and extra options affecting only Omni.

Completion gate: pure tests pass, `npx tsc --noEmit` passes, and neither the core nor formatter imports a UI module. Do not wire badges before this gate.

### Phase 2 Normalize official source data

1. Read both sync implementations. They currently preserve perk strings and ranks but collapse Finnald's legendary rows into one category and alias `Slot`/`Affinity`/`Type` into `energy`.
2. Preserve Finnald `Type`, `Slot`, and `Affinity` as distinct optional metadata. Introduce a scoring `categoryKey` from weapon Type. For Aegis use the actual weapon tab category. Do not rekey the existing `categories` object in a way that breaks Explorer; derive a separate scoring index.
3. Preserve row version identity. Alias entries for the same sheet row must not count as extra rank peers. Do not pool legacy and current editions merely because their base names match.
4. Resolve source strings to stable canonical perk identities using existing registries/hash translation and enhanced-to-normal mapping. Preserve source order; deduplicate identity aliases. For the new scorer, do not reuse `isPerkMatch`'s permissive word-subsequence test.
5. Handle `None`, `None (Has access to Stocks instead)`, and the existing explanatory lines as no official criterion; stocks/grips without curator recommendations earn no invented preference score. Blank or questionable recommendations are unknown. Explicit absence and missing data need different states.
6. Preserve a snapshot/schema revision, with a deterministic content revision for cache invalidation. Keep PvE and PvP revisions separate. Normalize English source identities independently of translated UI labels.
7. Existing caches may lack new metadata. Recover category from unambiguous verified metadata where available; otherwise schedule the normal refresh and show `—` for affected scores. Do not wipe wishlist or unrelated storage. A failed refresh may retain a valid prior snapshot, but may not relabel it as a fresh snapshot.
8. Add parity fixtures proving the background parser and cron parser produce equivalent score metadata from the same bounded raw rows. Include a Finnald Type/Slot/Affinity row.

Completion gate: both activities have category-aware normalized records; the blank-rank case is intentional; malformed data is diagnosed; no global perk-ranking fetch is added to score individual items.

### Phase 3 Publish actual owned slots

1. Inspect `processElement` in `src/main-world-content.ts` and its DIM socket extraction. The existing flat `perkHashes`/`perksDataMap` cannot establish which trait column owns a perk.
2. Add a versioned `data-aegis-score-owned` payload containing `RawOwnedScoreSnapshot`. Validate it and resolve it into canonical `OwnedScoreSnapshot` identities in the isolated content script. Canonical masterwork identity must represent stat type, not upgrade tier. Use an explicit stat-hash mapping; an unknown stat stays unknown.
3. Obtain actual present selectable options, not every perk in the weapon manifest or craftable recipe. Capture representative DIM socket fixtures before choosing availability fields; never guess that every `plugOptions` entry is owned. Include a crafted item and a multi-trait drop.
4. Classify sockets explicitly. A recommended Trait 2 perk owned only in Trait 1 earns zero in Trait 2. Include the appropriate barrel/mag equivalents and origin sockets. Enhanced/base versions count as one option.
5. Emit `unknown` for incomplete extraction; do not serialize an unreadable slot as an empty known array. Only a verified owned slot with no official match earns zero.
6. Stabilize serialization and write the attribute only when its content changes. Preserve existing attributes for consumers and wishlist/grade rendering.
7. The existing early return compares only item hash and flattened perks. Ensure masterwork-only changes and slot redistribution invalidate the score snapshot even when that flat set is unchanged. Active-only changes must still update selection indicators without changing owned potential.
8. In `content.ts`, observe the new owned payload and required identity/masterwork inputs. The current `attributeFilter` only watches item hash and perk hashes. Never observe score output attributes in the score input observer.
9. Winnower supplies its own item attributes; it does not run this DIM bridge. Accept its new structured slot payload when available. With only flat perks, show an unrated score rather than assigning columns by guesswork. Existing grades still work there.

Completion gate: fixture tests cover complete, missing, crafted, enhanced, multi-option, same-flat-hashes/different-columns, and masterwork-only updates. An active selection change leaves both numeric profiles unchanged.

### Phase 4 Connect evaluation and caching

1. Add scoring alongside the current official spreadsheet evaluation in `content.ts`. Use the actual PvE and PvP databases, never the legacy cross-activity fallback. Do not use a wishlist result or Light.gg grade as an input.
2. Normalize and evaluate each activity once per instance/source/owned snapshot revision. Return both Best and Omni evaluations and share those objects across tile, popup, tooltip, Explorer, and shopping comparison consumers.
3. Use a bounded cache keyed by instance/hash, canonical owned-slot signature, exact matched source/version identity, source revision, origin-benchmark revision, and model version. Settings for profile, precision, badge style, or UI language are not model cache keys.
4. Rebuild source indexes on source refresh. Invalidate an instance when its actual owned configuration changes. Avoid network calls, full-manifest traversal, or inventory-wide rank sorting in hover/render paths.
5. Add score payloads to `weaponDataMap` and `PlayerOwnedItemInfo`. Update `getLiveEvaluatedCopyInfo` so it reuses valid score evaluations rather than rerunning an independent implementation.
6. Do not gate score storage or an unrated badge on `result.grade` being truthy. Existing weapon branches currently do this. Keep the guards that prevent badges in armor/stat/toolbar elements.
7. Publish additive output attributes for external consumers: `data-aegis-score-pve`, `data-aegis-score-pvp`, corresponding `-status` attributes, `data-aegis-score-profile`, and `data-aegis-score-version`. Numeric values are raw, selected-profile scores; remove a numeric attribute when unrated and set its status to `unrated`. Also clear stale fields on DOM tile reuse. Publish only on change.

Completion gate: the same instance has identical scores across views; only the changed instance is recalculated for a roll change; selecting another owned perk or changing precision does not recompute the model.

### Phase 5 Deliver the first usable trial

Add these validated persisted settings to `LocalStorageSchema`:

| Storage key | Values | Default |
| --- | --- | --- |
| `aegisRatingDisplay` | `grades`, `scores` | `grades` |
| `aegisScoreProfile` | `best`, `omni` | `best` |
| `aegisScorePrecision` | `0`, `1`, `2` as numbers | `0` |

1. Add Rating display, Score basis, and Decimal places controls in the existing popup. Disable/hide grade-specific two-tier/equipped/dual-grade options while Scores is active, preserving their stored values. Scores always represent best owned potential.
2. Validate corrupt/missing settings at read time and in change listeners; never accept arbitrary precision, profiles, or HTML. Update the popup preview from the shared formatter rather than hardcoded score text.
3. Extend a single rating presentation helper to produce text, status, accessibility label, and profile completion markers. Use it in `injectBadge`, `injectPopupSummary`, `showTooltip`, `formatShoppingBadgeHtml`, and owned-copy comparisons.
4. Stop all score branches before legacy grade-string parsing. Existing renderers interpret string length, `/`, `|`, arrows, and initial letters as grade structure. A decimal or percent sign must not enter those paths.
5. Use one score per activity. Do not append weapon-tier letters, equipped-to-potential arrows, or a second percentage explaining the calculation to inventory tiles. Examples: `87%`, dual `87% | 92%`, and `87% | —`, within the existing split layout.
6. On hover, optionally expand a compact Score details row: ceiling, best-selection quality, and coverage only for Omni. Put unrated reasons here rather than a warning on every tile. Use localized text and a screen-reader label that identifies PvE/PvP and score basis.
7. Keep existing star/grade fields compatible. In score presentation, use the new `fullCoverage` result for an Omni marker; it does not require an overall 100%. Keep personal bookmark priority. Do not silently redefine legacy grade search tokens or overwrite legacy `isOmniRoll` for unrelated consumers.
8. Add a user-triggered Copy score details action in the expanded details. Copy only the current item's normalized scoring input, source identity/revision, model version, selected settings, component results, and unrated reason. This provides reproducible feedback while the user tries the feature; no automatic upload or background reporting.
9. Test single/dual modes, all three precisions, existing badge positions/styles/scales, and narrow tiles. Preserve the existing marker and activity layout. Percent text must not overflow or get interpreted as a new grade class.

Completion gate: an unpacked local build lets the user switch between Grades and Scores, change profile and precision, inspect a drop, and copy a reproducible score explanation. Best selections should be usable even while some origin benchmarks remain unknown. This is the first delivery checkpoint; do not hold it for every possible origin variant.

### Phase 6 Complete origin coverage data

1. Define a versioned registry of relevant weapon/version applicability, legal coexisting origin sets, evidence references, and whether the maximum is verified. Prefer existing authoritative manifest/socket metadata where it genuinely proves coexistence; use small explicit overrides for special variants when necessary.
2. Include applicable Accelerated Assault variants without borrowing the main trait pools or tier of an unrelated reissue. Match benchmark applicability by verified identities, not name substrings alone.
3. An empty registry is allowed for the first build. Single-recommended-origin rows remain scoreable with resolved owned data. Multiple recommendations without proof produce an Omni-specific unrated reason.
4. Add evidence-backed multi-origin examples, including a four-origin legal set and incompatible versions. Keep synthetic math fixtures clearly labeled synthetic; they cannot certify real game capacity.
5. Load the small registry from the extension bundle with versioning. Update `scripts/build.mjs` to package it. Do not bundle the entire manifest: the inspected commit intentionally moved it to on-demand loading to meet Firefox package-size constraints.

Completion gate: verified-origin weapons calculate complete/partial coverage correctly; unknown maxima remain honest `—` values; no denominator changes just because the player owns a lower-capacity roll.

### Phase 7 Add comparison and search support

1. Owned-copy ordering in Explorer/shopping uses the selected profile's raw score when Scores is enabled. Default grade behavior remains available in Grades mode. Unrated values sort after rated values; use a deterministic tie break such as instance identity.
2. In dual mode, give owned-copy comparisons an explicit PvE/PvP choice; initially use PvE and label the choice. Do not invent an average or silently pick the larger activity score.
3. Armory/unowned rows have no drop configuration. Show a clearly labeled weapon ceiling if a numeric summary is useful; never label that ceiling as the score of an owned roll.
4. Add numeric predicates before existing grade predicate parsing:

```text
aegis:score:>=90
aegis:pve:score:>=90
aegis:pvp:score:>=90
aegis:score:unrated
```

Unqualified score predicates use the current activity; in dual mode, match either activity. Explicit activity predicates evaluate only that activity. Unrated never compares as zero. The selected Best/Omni profile applies consistently. Support `>`, `>=`, `<`, `<=`, `=`, and decimal inputs from 0 through 100; reject malformed/out-of-range operands.

5. Keep `aegis:p:*`, `aegis:w:*`, `aegis:god`, and existing legacy Omni/perfect tokens on their current semantics. A new `aegis:score:omni` predicate may expose verified full coverage without changing those legacy meanings; document it if included.
6. Clearly explain that filtering/sorting uses unrounded values. Changing Decimal places never changes matches or ordering.

Completion gate: same-weapon drops can be compared by raw score, activity-specific filters work, and the user can investigate a disappointing score without relying on screenshots alone.

### Phase 8 Validate and package

1. Run `npm run test:scores`, `npx tsc --noEmit`, and `npm run build`. Run existing project checks too if the target branch has acquired any since this inspection.
2. Run a realistic captured-inventory replay, retaining per-slot ownership. Calibration permutations are not a substitute for this extraction/integration test.
3. Browser-check DIM inventory, item popup, hovering, perk selection, comparison views, settings reload, and all precisions in Chromium and Firefox/Zen when available. Test supported Winnower data separately. If the environment blocks navigation, use an already authorized fixture origin or record the missing check; do not disable browser policy or claim a visual pass.
4. Verify no new network request or full source parse occurs on repeated hovers. Compare Grades and Scores on the same captured vault: record initial evaluation and repeated-hover timings plus evaluation counts. Investigate repeatable regressions greater than 10% in whole-scan median or newly introduced hover recalculation. This 10% threshold is an engineering guard, not a measured current baseline.
5. Add README documentation for enabling scores, the two profiles, category-relative meaning, precision, `—`, search syntax, and copying details. Keep the user-facing explanation short; retain the formulas here.
6. Produce the normal local unpacked build and development package with `npm run build:all` after successful checks. Report which platforms/data cases were actually verified and remaining unrated cases. Publishing a store release is not part of this plan.

Completion gate: reproducible test results, a loadable local build, documented settings, a replay demonstrating real owned-slot extraction, and a small list of specific remaining data gaps.

## Acceptance matrix

Use [score-acceptance-fixtures.json](score-acceptance-fixtures.json) for exact numerical examples. It is self-contained: no calibration scripts or files outside this repository are required.

The JSON has four test groups: 46 `scoreCases`, 25 `rankCases`, 30 `formatCases`, and four `orderingCases` with two profile assertions each. Read its `contract` object before writing the fixture adapter:

- A score case references a normalized `sources` record by key and supplies actual `owned` options and optional `originLegalSets`. Map recommendation arrays into ranked source slots, empty source arrays into not-applicable slots, and null source/owned values into unknown states. All string identities are opaque canonical IDs for pure model tests.
- `rankBounds` supplies the same-category/tier peer extrema for pure ceiling tests. Separate source-adapter tests must prove that aliases, categories, and activities produce the correct bounds.
- Numeric expectations use absolute tolerance `1e-9`; completion flags and rendered strings must match exactly. Unrated values are null, never zero. Do not use the numeric test tolerance to determine completion in the product.
- Source-derived cases use real recommendations with constructed ownership. Synthetic four-origin sets prove the mathematics only. Capture actual DIM socket inputs separately in Phase 3; do not present these fixtures as real owned drops or origin-capacity evidence.

Add these behavioral checks even where no fixed number is necessary:

- Both user orderings hold: perfect F-tier weapon below C-roll S-tier weapon; S-roll C-tier weapon above F-roll S-tier weapon. Test both profiles and each activity, including tier endpoints and late-ranked alternatives.
- Second-choice recommendations are close to first choices, while unlisted main traits produce a substantial deduction.
- Available-but-inactive recommendations count; unrelated manifest perks and hypothetical crafting choices do not.
- A perk in the wrong trait column does not match. Enhanced/base duplicates do not add coverage.
- One recommended origin can be scored without inventing a three-origin target. A verified four-origin maximum works. Mutually exclusive variants cannot combine to earn full coverage.
- Missing masterwork changes a previously rated result to unknown when extraction fails; a known non-recommended masterwork earns zero for that slot. Masterwork level alone never changes score.
- A lower-capacity roll never shrinks the Tier-5 denominator.
- Explicit `None` and blank source data take different paths. Exotics never inherit the current evaluator's hardcoded `matchPercentage: 100`.
- `0%` is not `—`. One activity can be rated while the other is unrated.
- Near-100 rounding never displays false perfection at any precision. Precision updates do not change filters, sorting, or raw cached scores.
- An old cache, a source refresh, a reused DOM tile, and a changed masterwork do not leave stale results or stale score attributes.
- Source refreshes invalidate source indexes; extra markers, localization, hover, and profile changes do not cause observer feedback loops.
- Switching back to Grades restores the previous grade mode and styling. Scores never modify personal wishlist matches or bookmark priority.

## Known limits and non goals

The calibrated model is a versioned recommendation index, not a simulation of weapon DPS, recoil, build synergy, or encounter performance. Source notes may identify important exceptions, such as a particularly important barrel, but v1 does not automatically turn prose into weight overrides. Capture these cases through score details during the trial.

No exotic/armor score model, community-popularity blending, automatic dismantling, personalized numerical overrides, or global cross-category power ranking is included. The personal wishlist feature remains responsible for exact desired rolls. External DIM-SUM layout work requires its own checkout and tests; this plan provides stable additive score data for that integration.

Do not respond with another plan when asked to implement this document. Execute phases in order, leave the local testable checkpoint available after Phase 5, and continue the authorized remaining work. Keep a checklist of completed gates and concrete data/environment limitations; do not invent evidence to clear a gate.
