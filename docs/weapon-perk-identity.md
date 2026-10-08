# Weapon perk identity and calculation audit

## Problem and plan

The canonical name registry includes all inventory items. A name can identify a weapon
trait and an unrelated emote, ornament, barrel, battery, or event item. Looking up a
name without its socket family can therefore produce the wrong icon or native tooltip.
The existing flat grade input also loses trait-column membership and selected state.

1. Generate an offline index of verified weapon plug families from Bungie's English
   InventoryItem definitions. Resolve recommendations within their barrel, magazine,
   trait, or origin family. Preserve exact-hash localization for other inventory items.
2. Carry each owned perk's available and active socket membership through the existing
   DIM projection. Exclude crafted recipes and unowned reusable options from grades.
3. Use the same family identity for recommendation presentation, Compare, grade matching,
   and percentage inputs. Retain the native tooltip socket-category rejection guard.
   A shared icon is not sufficient evidence of equivalent plugs.
4. Verify manifest collisions, normal/enhanced equivalence, socket selection, arithmetic,
   cache behavior, and authenticated browser behavior. Preserve concurrent local work,
   DIM-SUM, profile settings, extension IDs, and the draft PR status.

## Manifest provenance

Index: 1,140 definitions and 677 exact names, from manifest version
`244213.26.06.29.2000-1-bnet.65864`.

[Bungie English InventoryItem definitions](https://www.bungie.net/common/destiny2_content/json/en/DestinyInventoryItemDefinition-a8ba855a-93c7-4014-8f2e-d92357fdfb42.json)
were cached during the earlier Lucky Shot investigation. The checked-in collision
fixture contains 24 actual definitions. No account identifiers are included.

Regenerate with `python scripts/generate-weapon-perk-identities.py <manifest.json> --version <version>`.
The generator reads the current canonical registry but accepts only explicit weapon
plug families. Shared intrinsic and armor enhancement families are excluded. Regenerate this index when updating that registry or manifest.

| Name | Trait hash | Rejected trait lookup |
| --- | --- | --- |
| Lucky Shot | 2054520291 | 896553940, emote |
| Once More | 2129059110 | 167605063, ornament |
| Trench Barrel | 2360754333 | 806159697, barrel |
| Heat Sink | 3772485195 | 1080094173, battery |
| Longest Winter | 2482418662 | 257592559, snowball upgrade |
| Heavy Metal | 1964414318 | 1042964491, event item |

Hailstorm (2041229079) and Hail Storm (2000464223) remain distinct traits. Their
descriptions describe reload-on-kill and Stasis arrows, respectively. Exact names
resolve independently; ambiguous punctuation/spacing aliases are rejected.

Trench Barrel's barrel remains valid in the barrel family. Once More's trait has no
icon in this manifest; the UI must use its missing-icon fallback rather than the
ornament artwork. Exact numeric hashes still localize their original item definitions.

Literal part names resolve before variant-prefix normalization: Enhanced Battery and
Enhanced Heatsink are named battery parts. Treating Enhanced as a prefix before checking
the complete name would make their magazine recommendations unavailable.

## Grade behavior

The production evaluator resolves each recommendation by its socket family and checks
the perk's actual column membership. A trait in column 1 cannot satisfy column 2.
If the same hash appears in both columns, its active status stays specific to each
column. Crafted recipe pools and options absent from a runtime reusable list cannot
improve a grade. Enhanced and normal definitions of the same family remain equivalent.
Unknown recommendation text is missing instead of receiving fuzzy name credit.
Not-applicable source text and comma-containing perk names use the score parser's
semantics. Wishlist and custom grade rules remain available.

## Percentage behavior

Owned hashes normalize within their original weapon family instead of passing through
a global name. A barrel cannot become trait credit through the name Trench Barrel.
Invalid bridge slot/hash combinations remain unknown. A stale runtime enhanced map
cannot replace a verified definition with a different perk or socket family. Valid existing numerical IDs
are retained, including enhanced barrel and origin representatives, so verified origin
benchmarks keep their identities. Source revisions include a socket-identity version
to prevent reuse of results prepared with the old identity policy.

The percentage formulas, tier ceilings, capacities, raw search comparisons, display
precision, and saved percent-symbol preference are unchanged. The independent oracle
uses separately written weights, capacities, recommendation credit, and ceiling formulas
for 4,000 deterministic rolls across both activities and all tiers. Existing acceptance
fixtures cover origin maxima, unknown data, incomplete values, and rounding below 100.

## Validation status

TypeScript, the full unit suite, and all 194 score tests pass. This includes the
4,000-roll independent arithmetic oracle, 486 default grade parity cases, 7,290
custom grade/potential cases, normal/enhanced identity checks, slot and selected-state
regressions, and crafted recipe exclusion. The generator was rerun against the cached
manifest; the original 100-file source snapshot has no changes.

The complete Chromium browser suite, native-search ownership fixture, and nine
percent visibility/zoom cases pass. Compare and tooltip lifecycle checks passed
again after the live variant correction. Production bundles and all three archives
build successfully. The installed Playwright Firefox runtime failed to launch with
`spawn UNKNOWN`; it did not provide compatibility evidence.

The bundled source audit covers 889 PvE and 932 PvP rows. It resolves 3,647 and
3,844 ranked recommendation slots, respectively. Existing unknown/uncertain source
text stays unknown. One legacy PvP row, Rose (Original Variant), puts Polymer Grip
in the origin column. That grip is not an origin trait; it stays unsupported for
origin scoring rather than receiving fabricated origin credit. The source row is
preserved. Current Trench Barrel trait recommendations resolve correctly in all
90 PvE and 93 PvP recommendation entries identified by the earlier audit.

## Captured-input replay

The same 616 previously captured actual legendary instances were evaluated before and
after this identity change using their captured browser source databases. All 2,464
Best/Omni activity comparisons retain their values or explicit unavailable states
(tolerance 1e-9). Rated counts stay at 595 PvE and 548 PvP. A first strict-lookup replay
identified 30 regressions from literal Enhanced Battery/Enhanced Heatsink names; exact
name resolution fixed them before staging. This is a replay of earlier authenticated
captures, not a fresh live browser pass. The underlying formulas are unchanged.

## Live variant regression

The first fresh Chrome standard audit compared 1,189 activity evaluations for 622
actual legendary instances. Percentages agreed with the independent arithmetic
oracle, but one Vow Forbearance used the Onslaught PvP grade row. Both source rows
omit version tags; the legacy raid heuristic chose the first untagged variant.
The grade and tooltip resolver now prefers an unambiguous verified owned origin
before legacy name/source heuristics. Regression cases cover Souldrinker identity,
row order, localized names, wrong socket membership, and ambiguous origin matches.
Fresh Chrome standard and beta verification now has zero grade discrepancies
across 1,189 activity evaluations per channel. The affected Vow roll's PvP grade
changes from F to C, using its actual Golden Tricorn and magazine choices.
All failing and passing attempts restored the controlled settings.

## Fresh Chrome evidence — October 3, 2026

Chrome 154.0.8037.59 used the persistent signed-in testing profile. Standard DIM
8.144.0 and beta 8.144.0.4905 ran at 2560 × 1305 CSS pixels, DPR 1.5, zoom 1,
and the saved dark DIM-SUM theme. Each pass verified four foreground animation
frames, both active extensions, and the new per-column socket metadata.

Both channels captured 622 actual legendary instances. All 1,189 available source
activity evaluations matched the independent Best/Omni arithmetic oracle (1e-9
value tolerance) and the grade calculation using actual socket membership,
selected state, and saved grade rules. Ratings remain available for 601 PvE and
554 PvP instances. Remaining source, variant, and ownership gaps stay explicit.

The 12-case Grades/Scores × Best/Omni × 0/1/2-decimal matrix preserved underlying
letter grades and full percentage evaluations. Five numeric queries retained
identical instance matches at every precision: >=90 (57), PvE >89.99 (28),
PvP <=80 (483), unrated (183), and Omni (1). Representative Explosive Personality
native popup details matched actual ownership and both percentage component
calculations on both channels. Beta required an actual pointer click; its initial
synthetic tile click did not open a popup and is not recorded as a details pass.

Actual ownership checks cover 2,864 preview alternatives, 602 masterwork-level
changes, 602 masterwork-type changes, and 34 crafted configurations per channel,
with zero failures. Preview and masterwork-level changes preserve owned inputs;
masterwork type changes invalidate them; crafted recipe pools are excluded.

Lucky Shot on three Long Arm copies and Trench Barrel on three Perfect Paradox
copies passed native comparisons on standard and beta. With DIM-SUM fonts on and
off, pointer hover and keyboard focus show the verified enhanced trait hashes
4170193963 and 2459015849, correct manifest icons, native weapon descriptions,
and unchanged owned sockets. Eight hover observations add zero weapon-grade or
percentage cache misses. Observed page requests include local assets and one
analytics POST, with no scoring API request in those observation windows.
This page observation does not monitor all background-extension traffic.

### Performance

The first alternating presentation run measured 176.4 ms for Grades and 240.0 ms
for Scores on standard. Its 100 ms pause allowed display-switch work to overlap
measurement. A follow-up waited for the UI to settle, checked foreground frames,
warmed each mode, and reversed block order. It measured 24 vault scans per channel
(12 per display), each covering 1,314 native facts. Every measured scan added zero
weapon-grade or score cache misses.

| Channel | Grades median | Scores median | Scores difference |
| --- | ---: | ---: | ---: |
| Standard | 146.4 ms | 150.7 ms | +3.0% |
| Beta | 171.8 ms | 174.5 ms | +1.6% |

These are full native evaluator scans in the current viewport, including response
publication and rendering work. They are not a comparison against an older build
or a pure formula benchmark. The settled repeats are below the 10% investigation
threshold. The initial overlapping run remains recorded locally.

### Chrome preservation before the Zen handoff

All owned test tabs and debugging attachments were closed. Controlled Aegis
preferences were restored exactly, including removal of previously absent keys;
queries and temporary font-theme attributes were restored. No inventory action
changed owned selections. Chrome-only reloads used the existing helper with an
ignored config that reads Aegis from the isolated `dist` directory. The shared
configuration, extension paths/IDs, and manifest version remain unchanged.

Every one of the 6,245 installed DIM-SUM files in each browser matches the pre-test
hash snapshot. Its content hash remains
`c5dc66ea2b3c4a206ac0e54802732bb4aaae8a19877cea244e011a649de76340`.
All 28 reserved Zen Aegis files remain unchanged, and the original 100-file local
source snapshot has no changes. No merge or release was performed.

Chrome Aegis content hash:
`ac45fab188cbae85b2601e3fd9fc7e245f4c920f76a90119419379d1d6f0f058`.
Main-world content hash:
`b3d665a3aa89a1c6e1a71bda7ca2c8df96a06d184914586e26685c81ff5800ad`.

The coordinated Zen follow-up below completes verification of this revision and
updates the shared installed Aegis source used by the ordinary reload shortcut.

## Fresh Zen evidence — October 3, 2026

After the outline chat completed its live checks and closed its clients, Zen
1.22.3b ran signed-in standard DIM 8.144.0 and beta 8.144.0.4905 at
1064 × 1826 CSS pixels, DPR 1, and zoom 1. Both channels delivered four focused,
visible animation frames and exposed the new per-column socket metadata.

Zen's saved stat-badge style uses a single activity. The first audit incorrectly
expected Both-mode result fields while retaining that style. Matching Chrome's
classic badge style resolved the test setup; no grade calculation change was
needed. All attempts restored the original style and controlled preferences.

Both channels captured 622 legendary instances and passed all 1,189 source
activity grade checks and independent Best/Omni arithmetic comparisons (1e-9
tolerance). Rated counts match Chrome: 601 PvE and 554 PvP. Each channel passed
the 12-case display/profile/precision matrix and the same five precision-independent
numeric searches. Actual ownership checks passed 2,864 preview alternatives,
602 masterwork-level changes, 602 type changes, and 34 crafted configurations
per channel. Native Explosive Personality details matched exact ownership and
both percentage component calculations; standard and beta screenshots were
inspected.

Percent symbols passed eight On/Off/On cases across Best/Omni, precision 0/2,
and Both activity mode. Hiding the suffix removes its visible space while keeping
canonical labels, full percentage text, raw score attributes, and colors unchanged.
The saved Off preference persisted in a fresh DIM context. On/Off screenshots were
inspected at DPR 1. The existing Chrome menu-control pass covers the actual
Scoring popup; Zen's visibility and persistence pass used preference writes.

Zen's automation protocol rejected navigation to the extension popup with
`unsupported operation`. The existing temporary token-protected testing bridge
provided allowlisted preference writes and read-only source access. It was removed
after exact settings restoration; stock Aegis was reloaded with the existing
helper before the native comparison and final activation checks. No browser
security preference was changed.

Stock Lucky Shot/Long Arm and Trench Barrel/Perfect Paradox comparisons each
used three owned rolls on standard and beta. DIM-SUM fonts On/Off, pointer hover,
and keyboard focus showed the correct enhanced hashes 4170193963 and 2459015849,
manifest trait icons, native weapon descriptions, and unchanged selections.
Eight hover observations added zero grade or score cache misses. Zen page
network traffic was not captured in these checks.

### Zen performance

The same settled, warmed vault-scan procedure used 24 scans per pass,
12 per display, covering 1,314 facts per scan. Every measured scan retained
its grade and score cache-miss counts. Standard was repeated with reversed
block order after its first pass exceeded the 10% investigation threshold.

| Channel/run | Grades median | Scores median | Scores difference |
| --- | ---: | ---: | ---: |
| Standard, first | 179.0 ms | 206.5 ms | +15.4% |
| Standard, reversed repeat | 185.5 ms | 199.0 ms | +7.3% |
| Beta | 189.5 ms | 200.5 ms | +5.8% |

The first standard result remains part of the evidence. The repeated result is
below the investigation threshold, but these variable timings do not establish
a consistent sub-10% difference in Zen. These are full evaluator/response/rendering
scans on the current build, not an older-build comparison or a pure arithmetic
benchmark. No additional formula evaluation or cache-miss regression was observed.

### Final preservation and cleanup

All 6,245 DIM-SUM files in each browser match the post-outline handoff snapshot;
the content hash remains `c5dc66ea2b3c4a206ac0e54802732bb4aaae8a19877cea244e011a649de76340`.
The original 100-file local source snapshot has no changes. Stable extension
paths and IDs, sign-in, saved databases, and controlled preferences are preserved.
Queries and temporary font attributes were restored, and all owned tabs, input
actions, and debugging sessions were closed. The Chrome relay was not restarted.

Chrome and Zen now have the same stock Aegis content and main-world hashes listed
above. The ordinary reload helper's stable Zen source contains this revision,
so its Chrome staging no longer reads the preceding Aegis build. Final stock
activation on both Zen hosts verified Aegis, DIM-SUM, four foreground frames,
1,314 facts, the original PvE activity, and no temporary testing bridge.
The browser/build slot was released to the outline chat. No merge or release
was performed.

Private captures, screenshots, cache observations, and the settled timing results
are retained in ignored `scratch/score-live/identity-*` files. They contain account
instance identifiers and are excluded from the PR. Checked-in fixtures contain
public definitions and modeled inputs, with no account identifiers.
## October 7 review corrections: enhancement links and duplicate editions

The offline generator now consumes the checked-in `data/trait-to-enhanced-trait.json`
from DIM's public `src/data/d2/trait-to-enhanced-trait.json` table. The cached local
DIM source supplied 425 relationships; 224 have both definitions in this manifest's
verified trait socket family. Input SHA-256:
`7df83e9542ec6d45eb953d1778ef9bfe8be7540fe3c03e49c45188b6d605d457`.
The generator validates both endpoints' socket families before sharing their identity.
It does not infer enhancement equivalence by removing words from display names.
This covers Golden Tricorn (2610012052) and Golden Tricorn Enhanced (4290541820),
whose exact names differ. An `Enhanced <trait>` source alias is emitted only for a
verified hash link. Literal Enhanced Battery and Enhanced Heatsink remain magazine
components; fabricated enhanced barrel names are unresolved.

The regenerated registry retains 1,140 definitions and includes 900 exact/verified
source names. Regenerate using the existing manifest command; optionally pass
`--enhancement-links <DIM-table.json>` when updating the verified input.

The score source index retains duplicate display names by stable row identity;
fallback identities include category, name, version, and frame. Unique display names
remain convenient lookup aliases. Hash-specific frame metadata is projected from
the bundled public weapon manifest into `data/score-weapon-frames.json` by
`node scripts/generate-score-weapon-frames.mjs` (2,270 entries). The shared edition
resolver matches an unambiguous verified frame before owned-origin resolution.
Unknown metadata, missing source frames, and multiple matching frames do not
resolve through the metadata helper. Cross-frame or cross-category editions must
remain unresolved unless verified item metadata or owned origin identifies one row;
same-frame/category editions retain their existing fallback behavior. A cached category-row index repairs older name-only variant payloads
without scanning source categories for every item. The `score-source-socket-v3`
revision includes source frame metadata and invalidates previous identity results.

Modeled regression evidence reproduces Optative's enhanced first choice dropping
Best/Omni from 65/65 to 42.25/42.25 and grade S+ to C on the pinned baseline. With
verified enhancement identity it retains 65/65 and S+. Public legacy High Albedo
hash 1197486957 selects the Primary Adaptive Burst row regardless of category order
and retains Best 50 / Omni 49.1071428571; the Special Micro-Missile hash 2662459958
selects its distinct row. These are modeled public-data regressions, not fresh live
inventory or browser verification. A root-owned content integration patch uses the
same category index and frame resolver for grade-row selection.

Cached PvP snapshots also omit the source Type/category metadata. The generator
projects frame-qualified source categories only for names spanning more than one
PvE category into `data/score-weapon-category-frames.json` (currently High Albedo).
Legacy Adaptive Burst and current Micro-Missile retain Sidearms and Rocket Sidearms,
respectively; an unrecognized source frame remains unavailable instead of falling
through to the flat name category registry.

### Actual content resolver boundary follow-up

An extracted-function regression against the combined content source found that
the initial integration still reached the old perk-overlap and row-order fallbacks
when cross-family metadata was unknown or ambiguous. The category-row index now
caches whether a name spans distinct normalized frames or source categories.
`weaponVariantsNeedIdentity(db, name)` supplies the content guard after verified
item metadata and owned-origin matching, before every legacy name/perk heuristic.
The guard preserves existing same-family fallback behavior. Actual resolver tests
cover both public High Albedo hashes, reversed source order, unknown hashes,
multiple matching frames, categories-only ambiguity, verified owned origin, and
same-family compatibility. Baseline combined source fails two of five cases; the
exact guard modeled in memory passes all five. Root owns the content edit and
final actual combined-source verification.
