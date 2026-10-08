# Reproducible extension packages

Run `npm ci` and `npm run build:all` to type-check, build, and generate the
Chromium and Firefox ZIPs. The browser packages include all runtime bundles,
popup assets, manifest weapons, Korean evaluation data, score-origin benchmarks,
and third-party notices. End users need no Node, Git, local configuration file,
or separate font installation. DIM/account data and initial spreadsheet ratings
require the normal online services; a fresh install has no pre-populated ratings
cache. Failed first synchronization currently lacks a clear persistent error in
Explorer; this is a separate startup UX issue, not package completeness.

`npm run package` accepts only a completed, unchanged build from the current
committed checkpoint. Commit project changes before packaging. The build receipt
checks source/input hashes and every payload hash, so a matching version number
alone cannot certify freshness. Missing core data or assets fails validation.
Git checkouts also create a reviewed source ZIP; new source/data/test files must
be staged first. Extracted source archives intentionally omit `.git` and local
testing configuration. They rebuild both browser packages without Git; producing
another source ZIP is skipped. `build:testing` is developer staging only.

Chromium packages contain the service worker manifest; Firefox packages contain
the background-script manifest and stable Gecko ID. These ZIPs are unsigned local
test artifacts. Packaging does not upload, publish, sign, install, or reload them.

Run `node --test tests/package-completeness.mjs` for missing/stale asset contracts.
Validate the actual extracted ZIPs before release, including online first-run
behavior and browser compatibility. A source build is not an installed-browser
acceptance result.
