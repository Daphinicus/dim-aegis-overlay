# Search editor interaction audit

Reviewed September 21, 2026. This covers the local testing build, not a published release.

## Interaction contract

This is a structured search field: editable draft text and immutable tokens
share one line. It is not a set of editable labels. Keep the complete query as
the source of truth, including operators, negation, quoted values, and grouping.

- Keep the active term as text, even after it becomes syntactically valid.
- Convert on a clear commitment: a delimiter outside quotes, Enter, an accepted
  completion, or leaving the field. A saved search or filter-menu selection is
  already committed.
- Validate with DIM before conversion. Preserve invalid drafts so users can fix
  them; never silently discard text.
- Remove a token as a unit with X, Backspace, or Delete. Preserve neighboring
  tokens and clean up the Boolean expression when removing one token.
- Preserve normal selection, plain-text clipboard contents, undo/redo, native
  suggestions, and predictable focus navigation.

This follows the separation of text and tokens in Adobe's
[TokenField examples](https://react-aria.adobe.com/TokenField), including its
delimiter-based tag example. That component is currently marked alpha; this
audit uses its interaction examples, not a recommendation to add the package.
The [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
calls for platform text-editing behavior, appropriate suggestion navigation,
and an accessible label and popup relationship. It does not prescribe a
complete tokenized Boolean-query editor.

## Findings addressed

| Finding | Correction and evidence |
| --- | --- |
| Every keystroke generated an editable badge. | Drafts stay plain; committed, validated badges use `contenteditable=false`. Browser tests cover both partial and already-valid drafts. |
| The native input could appear beside the badge editor. | Removed the dependency on a DIM parent class and on React-owned `className`. An Aegis data attribute controls hiding. The live test checks the real input's computed position and width; a cropped screenshot verifies the resulting field. |
| Deleting a separator could merge a token with adjacent text. | Separator deletion cannot edit or join an immutable token. The caret crosses the separator instead. |
| Enter conversion was absent from undo history. | Conversion is undoable separately from typing. Redo restores the immutable token. |
| Shift+Tab could invoke DIM's Tab completion. | Modified Tab keys retain normal navigation; Shift+Tab is tested. |
| Loading or refreshing metadata could affect conversion. | Pending committed terms can convert when validation becomes available. Already accepted badges remain immutable during refresh. |
| DIM could focus the hidden input when opening suggestions. | Native focus calls are redirected to the editor, with the native completion path preserved. Live Gecko typing and completion exercise this behavior. |
| A missing React integration could leave an unusable replacement field. | Attachment requires the native change and key handlers. If they disappear, the editor disposes, preserves the query, restores the original input and focus, and avoids overwriting another owner's replacement focus method. |
| An old validator could survive adapter disposal. | The adapter releases only its own validator. Covered by the native-search browser fixture. |
| Typing rebuilt every badge, cloned DOM ranges for selection offsets, and measured caret layout synchronously. | Incremental rendering retains badge nodes and updates draft text. Selection offsets use the existing tree. Overflow scrolling runs once per animation frame, outside the key handler. Inventory observers ignore internal search-editor mutations. Structural performance checks run in the browser suite. |
| Incremental rendering could retain text inserted by native composition. | Clear consumed tail text and normalize split draft nodes. Synthetic composition tests cover both insertion paths and subsequent typing; actual IME interoperability remains a manual release check. |
| Home could leave the caret outside a horizontally scrolled field. | Measure the neighboring badge edge when a collapsed range has no text rectangle. Long-query tests check the end caret and scrolling back to the start. |
| Immutable badges made it awkward to edit a value inside a long query. | The compact display control cycles between Classic text, exact badges, and readable badges. Classic exposes the native DIM input. Query text, selection, and shared undo/redo survive mode changes. Exact badges remain the default; the choice persists in extension storage. |
| Shorter readable labels could corrupt query offsets or clipboard text. | Badges retain their original query text independently of the label and icon. Caret mapping, copy/cut, removal, and DIM updates use those raw bytes. Browser tests cover shortened labels, backward selections, quotes, and unknown filters. |
| A new draft before an existing badge could jump across its separator. | The inserted separator stays after the caret. Continued typing and switching between badge styles preserve the active draft. |

## Typing performance

The September 21 test typed 34 characters after 13 committed badges in a live
Zen DIM tab with 1,232 indexed items. The same workload before and after the
optimization produced these measurements:

| Measurement | Before | After |
| --- | ---: | ---: |
| Full editor rebuilds | 34 | 0 |
| DOM range clones | 204 | 0 |
| Added and removed editor nodes | 1,903 | 9 |
| Total synchronous `beforeinput` time | 85 ms | 18 ms |
| 95th-percentile synchronous `beforeinput` time | 4 ms | 1 ms |

These are one before/after sample, not an end-to-end input-to-paint benchmark.
Background-tab frame throttling, timer resolution, badge count, and machine load
affect timing. The controlled Chromium fixture also improved. Regression tests
assert retained badge nodes, bounded DOM churn, no range cloning or synchronous
caret measurement, correct query text, and caret visibility. They do not assert
wall-clock thresholds. DIM's existing result-update debounce is unchanged.

After the composition and scrolling fixes, the complete unit and browser suites,
TypeScript checking, production build, and live stable DIM consumer checks passed.
The final beta typing sample recorded 22 ms total synchronous `beforeinput` time,
1 ms at the 95th percentile, nine added/removed nodes, no editor rebuilds, no range
clones, and no synchronous caret measurements. Full beta consumer checks had
passed before this performance change; this follow-up beta run covered typing.

To repeat the structural checks and print fixture timings:

```sh
node tests/inline-search-performance.cjs sample
```

For live profiling, build first and use the signed-in Zen testing profile in
`testing-build.local`:

```sh
node scripts/profile-search-live.mjs sample
node scripts/profile-search-live.mjs beta-sample --beta
```

The profiler uses a separate background tab, types a query without changing
inventory, closes its tab, and restores the configured testing extension. It
leaves existing DIM tabs alone. Run it separately from other live tests because
they share the browser debugging session. JSON results are saved under `scratch/`.

## Remaining work, in priority order

1. **Manual accessibility and input-method testing before broad release.**
   Test NVDA with Firefox/Zen and a Chromium browser, VoiceOver where supported,
   and actual IME composition, dictation, and mobile selection. Check how a
   screen reader announces a token, its removal, the complete query, and DIM's
   suggestions. Existing ARIA attributes and browser automation are not proof
   of screen-reader interoperability. Custom selection/history and temporary
   native focus for Tab completion deserve particular scrutiny.

2. **Expand readable labels and localization.** The first version handles Aegis
   ratings and shortcuts, champion filters, common DIM categories, named values,
   and power comparisons. Other filters retain their exact syntax. Add mappings
   only when their meaning is known, and localize the English label text and
   removal labels. The mode control itself has six-language translations.

3. **More useful invalid-draft feedback.** Invalid terms remain recoverable,
   but the editor does not explain why a term failed to convert. Add restrained
   feedback when the user commits, not errors flashing on every keystroke.
   Distinguish an unsupported term from Aegis data that is still loading.

4. **Preserve unrelated formatting on removal.** The current cleanup preserves
   Boolean meaning but serializes the expression, which can lowercase operators,
   replace explicit AND with spaces, and simplify parentheses. A future edit
   should ideally change only the removed term and necessary neighboring syntax.
   Share the parser with filter-menu editing rather than maintaining two
   grammar implementations.

5. **Complete the keyboard, localization, and touch matrix.** Add dedicated
   acceptance checks for autocomplete within a complex expression, platform
   word-deletion shortcuts, long quoted values at high zoom, and touch removal.
   Localize the current English removal labels. Evaluate touch hit areas without
   crowding DIM's star, shield, and action controls.

## Compatibility and verification limits

The real query still drives DIM Search Actions. No item-ID expansion or separate
visual-only result set is introduced. The adapter nevertheless depends on DIM's
private React properties, discovered validators, and completion behavior. The
fallback handles missing hooks; it cannot detect every semantic change in a
future DIM update. Keep the stable/beta integration tests as release checks.

Automated coverage includes draft/commit boundaries, invalid drafts, immutable
deletion, quote spacing, Boolean cleanup, conversion/removal undo, clipboard,
external query updates, narrow layouts, React class replacement, validator
lifecycle, and native-input fallback. The live test types directly into the
visible editor, reproduces `breaker:barrier`, and checks DIM query membership,
autocomplete, Compare, and Strip Sockets previews. Screen-reader, mobile, and
real IME testing are not claimed.

Verification on September 21 passed the unit suite, browser regression suite,
TypeScript checking, production build, and live stable/beta checks in Zen
1.22.2b with 1,232 indexed items. The beta consumer test required a longer timeout
for background-tab timers; its completed run passed. Both live search-field
screenshots show one immutable `breaker:barrier` badge and no duplicate input.

The three-mode follow-up also passed unit and browser checks, typing performance
checks in both badge modes, and live stable/beta consumer checks with the same
inventory. The live runs exercised readable-label typing offsets, Classic native
input, and switching back without altering the query. The beta run additionally
verified the champion image loaded and captured the readable field. Synthetic
composition tests cover deferring a mode switch until composition completes.
