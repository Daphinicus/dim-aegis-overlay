# Letter badge

Select **Badges > Letter** in the Aegis testing build. Choose **PvE** or **PvP** and **Perk** or **Weapon**. The initial choice is PvE perk grade.

The variant displays one grade (S+, S, A+, A, B+, B, C, D, E, or F) in DIM's native stats bar, replacing the wishlist rating icon. It preserves plus grades and omits minus signs, stars, upgrade arrows, two-tier labels, split grades, backgrounds, shadows, and the separate footer. The grade uses its corresponding color from the existing palette, including custom plus-grade colors. It inherits the native row font size, aligns at the left padding, and stays vertically centered; the remaining native icons and power stay right-aligned. Badge/text scaling and color-only presentation do not apply; Off still applies per item category. Armor uses its strongest supported set grade; non-letter and unavailable grades leave DIM's rating unchanged.

The variant activates only its selected activity while retaining the saved activity for the other styles. The weapon tier comes from the active spreadsheet independently of the two-tier display preference; perk grades use the existing equipped/potential evaluation preference (Dual resolves to potential for this one-letter view). No PvE/PvP maximum is used. Selecting another style restores the saved activity, stars, positions, sizing, and other presentation choices.

One owned span is appended to an existing stats bar. CSS orders it into the wishlist slot and hides the native rating without removing or rewriting React's nodes. DIM's lazy stats bars remain lazy; no substitute bar is created. Cached-grade restoration handles new or replaced native bars before paint. Missing bars display no letter. Other hosts without DIM's stats bar retain a classic badge fallback. Tooltips, search grading, and tile glow retain their normal behavior for the active activity.

Compatibility hooks are centralized in src/stat-grade.ts: the verified BadgeInfo.badge release class for DIM standard 8.143.0 and readable module prefixes for beta. DOM/CSS fixture coverage is distinct from live account verification.

## Validation

- The full Aegis unit/browser suite includes one-letter rendering, standard/beta bar fixtures, native-node restoration, lazy/replaced bars, current settings, popup controls/preview, and saved activity restoration.
- Live Chrome comparison uses the same inventory and all enabled tile decorations. It interleaves split footer, single-PvE footer, and PvE perk letter; records geometry and native-bar counts; and separates uninstrumented frame timing from detailed traces.
- Measurement results and browser-specific limitations are recorded in DIM-SUM's docs/stat-letter-performance.md after the comparison.

## September 26 result

The completed Chrome confirmation retained 1,050 items and the same 392 native
stats bars in every variant. Compared with split footers, the PvE perk letter
reduced Weapons elements by 38%, median style-recalculation time per switch by
25%, and median main-thread task time by 22%. Weapons-arrival frame gaps fell
from approximately 69–75 ms to 35–42 ms. These small within-machine samples show
an improvement, not elimination of stutters. The single-PvE footer comparator
also remained slower than the letter variant.

The full Aegis suite passes. Live standard inventory checks pass in Chrome
153.0.8010.54 and Zen 1.22.3b: synchronized transitions, intermediate fades,
correct inert/ARIA state, tooltip appearance/dismissal, retained native tile
nodes, and the original Aegis reading typography. Chrome's installed options
controller also passes all four activity/grade combinations and restoration to
Strip. The 42-case standard/beta fixture passes in Zen; no live beta account was
used. Zen results establish compatibility, not a measured speedup percentage.

The preview remains Stat letter, PvE, Perk in both browsers. Selecting Strip
restores the original saved Both activity without resetting other badge choices.


## Letter presentation update — September 26

The options label is now **Letter**. Activity and grade basis use the menu's
existing sliding segmented controls. The description spans both grid columns:
"Simplified, single-grade view. Replaces the Wishlist [thumbs-up icon] icon."
The rendered description contains a local inline SVG, with translations in all
six languages. Existing storage keys and style values remain unchanged.

The preview uses a fixed mock row drawn over the bitmap's original stats row.
Its background matches the bitmap's green (#9aad11). It contains local SVGs and
a fixed power value of 550; Perk shows S+ and Weapon shows B+. The mock thumbs-up
is hidden only while a Letter grade is present and restored for other styles or
an Off category. This preview does not read DIM data, assets, classes, selectors,
or native row structure. Only grade text/color rendering is shared with the
inventory renderer, through an explicitly supplied mock row.

Validation: full Aegis unit/browser suite passes; 168 standard/beta row fixtures
pass in Chromium and installed Zen 1.22.3b, covering four tile sizes, plus grades,
alignment, node reuse, restoration, and custom colors. Options controls and
description geometry pass at 320 and 380 px in all six languages. Live standard
Chrome checks cover 221 visible Weapons rows and 123 Armor rows, including 43
plus grades: the grade matches the row font size and center, with no new
overflowing Weapons rows. The independently rendered mock row and both options
screenshots were inspected. Both testing builds were reloaded through the Aegis
shortcut. Historical timings above refer to the original smaller, plus-free
variant; the follow-up timing check is in DIM-SUM's performance report.

## Stats-row fit — September 26, 2026

Letter mode uses 92.5% of native DIM text and icon sizes in all inventory stats rows, including ungraded rows. At a 62 px tile, text and damage icons are 11.47 px, and breaker icons are 9.176 px. Row height stays native. Horizontal padding is 1 px, and the right-aligned icon/power group uses a 0.25 px gap. The grade stays left-aligned with an automatic end margin. Icons cannot flex-shrink; inherited reading-text tracking is cleared only within these compact rows.

Aegis owns this layout independently of DIM-SUM. A preference-level attribute and owned stylesheet activate the layout at startup and on badge-style changes. The stylesheet exists only while Letter is enabled. Selecting another style restores native sizing. No extra inventory observers, geometry reads, or render nodes are added.

Validation: 960 standalone full/sparse-row cases passed in Chromium and installed Zen 1.22.3b, covering 50–96 px tiles, plus grades, ungraded rows, square icons, alignment, height, mode restoration, and four standard/beta hook formats. Existing Letter, inventory-badge lifecycle, and options-preview tests also passed. DIM-SUM integration passed 560 cases per channel across seven fonts. Live Chrome standard passed with DIM-SUM disabled, including a Classic/Letter settings round trip; both extensions together passed in Chrome and Zen. These are layout checks, not a new performance benchmark.


## Dormant stylesheet cost — September 30, 2026

The native descendant rules previously remained injected when Letter was off.
A standard Chrome trace attributes 949 whole-subtree invalidations to the
optional rule ending in > *. setStatGradeLayout now loads the three unchanged
rules only while active and removes them on deactivation. Repeated activation
reuses the element without DOM writes. Scoring, preferences, native nodes, and
row declarations stay unchanged.

The built production ABBA improves standard filter clearing 869.4 → 770.5 ms
with about 30% less styling CPU. All candidate clearing samples beat the baseline
range. Applying remains variable, and beta shows no established gain. Base DIM
standard/beta timing is nearly identical in a separate native channel ABBA;
DIM-SUM beta selector matching remains a separate target.

Type checking, unit checks, production build, 960 row-spacing cases, 168 Letter
cases, the 720-tile badge lifecycle fixture, 560 combined font cases per channel,
and 960 isolated Zen cases pass. Final Chrome foreground checks preserve 1,252
items, 979 grades, settings, and actual loaded bytes. Earlier Zen live checks
verify the exact executing CSS and decorated tile contract with Letter enabled.
Its protected page/rule-list checks are not bypassed. The final Zen reload count
check is incomplete after a 967-grade startup snapshot and subsequent browser
closure; requalify that count after normal tab/section initialization. No Zen
latency improvement is claimed.

See DIM-SUM's docs/incremental-item-update-research.md, section Extension
attribution and dormant Letter rules, for experiments, ranges, exclusions,
installed hashes, and restart requirements.
