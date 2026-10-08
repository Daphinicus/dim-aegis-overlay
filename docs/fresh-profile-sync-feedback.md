# Fresh-profile sync feedback

A profile with no wishlist timestamp previously defaulted to Synced. Automatic spreadsheet failures were saved by the background worker but not rendered when reopening the popup, and the failure text claimed retained caches even when no data existed.

The existing popup now displays idle, loading, success, partial and failure states from storage in all six menu languages. Failure text distinguishes absent data from available retained data. A background state query distinguishes a live refresh from a loading marker left by an interrupted worker; interrupted work permits retry. Concurrent requests share one refresh, and stale popup state replies cannot overwrite newer feedback. The existing status becomes a polite live region; unchanged messages are not re-announced. Existing controls, cache ownership, source selection, network permissions and typography remain unchanged.

Run TypeScript checking, node tests/sync-feedback.test.cjs and node tests/review-data-regressions.test.cjs. The focused regression fixture evaluates the actual background function and bundled popup. It covers first failure, cache retention, partial refresh, unexpected exceptions, complete retry, concurrent requests, interruption and delayed reply ordering in six languages. The fixture supplies browser APIs in memory; it does not establish native installation or account acceptance. Native acceptance must use exact packaged checkpoints and disposable profiles, keeping real inventory and installed test/personal profiles untouched.

## Separate project inputs

The preserved tile-masterwork-shimmer.png has SHA256 fbf8cdc05874bad4c1856b8ef0011f98a32a3562e163f55b0380c42568892d0f. Identical bytes occur in the historical DIM-SUM inventory-deep-performance/before capture; its 0.1.3 manifest and styles used an eight-second rotating masterwork shimmer. This establishes a retired project asset and comparison input, not a current runtime dependency. Its creator and upload authority remain unresolved. The similarly named generator produces different border assets. Preserve both old copies without inferring authorship or adding them to public Git.

Theme redesign galleries and snapshots are derived inputs for the separate private theme-workshop Site, not extension runtime/build inputs. Raw MHTML and account captures remain private; capture clearance for repository publication is not established. Modular theme authoring and palette files already have their appropriate private repository home. No account captures are added by this work.
