# Repository input audit — October 8, 2026

This is preparatory repository/packaging work, not a release candidate.
The reviewed `de6b66c` checkpoint and original dirty checkout/index are preserved.
The exact target is Daphinicus/dim-aegis-overlay; no upstream writes are made.

All 223 examined original src/public/scripts/tests/docs/data files have tracked
counterparts in the reviewed checkpoint. The known review fixes supersede the
older source contents; no newer unowned implementation was overwritten. Bundled
runtime data, popup/assets, both browser manifests, dependency lock, notices,
build/package scripts and tests are in Git. A copied popup test in the DIM-SUM
output folder is identical to the canonical Aegis test. Aegis bundles no fonts.

Excluded: node_modules/dependency caches, reproducible dist/ZIP output, scratch
screenshots and live receipts, browser/account data, local testing-build.local
staging paths, credentials and tokens. None is needed to build the two browser
ZIPs from Git or use the packaged extension. Source archives omit .git and local
configuration yet rebuild both browser packages; source-ZIP regeneration is
skipped outside a Git checkout. New data/tools files are covered by source
packaging's untracked-input guard.

Fresh installations require normal online spreadsheet synchronization and DIM/
account/native data. No machine-local ratings cache is a prerequisite; no ratings
snapshot is bundled. Failed initial synchronization still lacks clear persistent
Explorer feedback and remains a separate startup UX issue. It was not changed to
make packaging validation pass. Focused CI validates packages, not full live
browser or online first-run acceptance. No release, merge or deployment occurs.
