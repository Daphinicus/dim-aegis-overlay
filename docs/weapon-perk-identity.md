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

TypeScript, the full unit suite, and all 192 score tests pass. This includes the
4,000-roll independent arithmetic oracle, 486 default grade parity cases, 7,290
custom grade/potential cases, normal/enhanced identity checks, slot and selected-state
regressions, and crafted recipe exclusion. The generator was rerun against the cached
manifest; the original 100-file source snapshot has no changes.

Authenticated live verification and browser fixtures are pending the coordinated
shared-slot handoff. Existing Lucky Shot and native-search ownership live evidence
is recorded separately; those earlier passes do not establish this broader fix's
fresh browser verification.

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
