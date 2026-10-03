# Native search ownership

Verified October 3, 2026.

When DIM removed its desktop search at narrow widths, Aegis's generic `input[type="search"]` fallback selected the Shader browser's search. Aegis then inserted its shield, display control, and potentially its inline editor into that extension-owned field.

`src/native-search-input.ts` now centralizes the existing native-search candidates and excludes the Shader dialog, DIM-SUM owned controls, and Aegis-owned search panels. All native-search consumers use this ownership check. The query adapter retains its widget-local draft lookup and existing Redux fallback, preserving unsynchronized typing behavior.

Widget setup disposes the previous widget, display control, and event handlers before returning when no accepted native input remains. The inline editor rechecks ownership even when its target is connected, and direct attachment rejects extension-owned inputs. The fix does not change visual anatomy, animation timing, or stored preferences.

TypeScript, the production build, and the full unit suite passed. Browser regressions passed for production widget ownership/lifecycle, native Boolean search and query preservation, three display modes and storage behavior, and inline typing, clipboard, keyboard focus, synchronization, and cleanup. The ownership fixture covers an extension-only page, a Shader input before DIM's input, repeated mounting, a connected input becoming extension-owned, native removal/restoration, and unchanged queries/preferences.

Live checks passed in Chrome and Zen, standard first (DIM 8.144.0), then beta (8.144.0.4905). Each target tested 900, 500, 360, then 900 CSS pixels. Shader search contained no Aegis controls, editor, or ownership markers. Typing `Indigo` preserved DIM's `is:weapon` query. At narrow widths, DIM's desktop input and Aegis's widget, display control, and editor were absent. Returning to 900 pixels restored exactly one native binding. Each target delivered four foreground frames before testing. Screenshots show the resting states; no intermediate hover animation capture was taken for this ownership-only change.

The existing helper reloaded Aegis only in both persistent testing browsers. File inventory receipts confirm that only Aegis's content.js and main-world-content.js changed. Every DIM-SUM installed file was preserved, including responsive content.js SHA256 f244034e88e24b9f645e1ba5dec70283d1ecb06f67bcecab7bb879ce29177fef. Testing manifests, extension IDs, popup/styles, Lucky Shot identity, percentage visibility, licensed fonts, and testing paths were preserved. The original compare-master workspace was untouched.

Live scripts restore the original DIM query, reset Zen's viewport, close owned tabs, end Zen sessions, and close sockets. The Chrome relay was stopped and the shared verification slot returned to Shader Browser. No temporary extension bridge was installed. Source and tests remain uncommitted; no commit, push, or PR status change was made.

Evidence is in the DIM-SUM workspace's `.tooltip-fix/native-search-ownership/`: type/build/unit/browser logs, reload output, installed-file inventories, preservation summary, and four `<browser>-<channel>-results.json` files. Screenshots follow `<browser>-<channel>-900-0.png`, `-500-1.png`, `-360-2.png`, and `-900-3.png` for browsers `chrome`/`zen` and channels `app`/`beta`.

Installed Aegis SHA256:

- content.js: 05c49091b3b686eba9b4a385676da864f284dae8603747c1cd689b2a285af159
- main-world-content.js: 6f1be74bb2bc9e99e524d3a43f9d6cce2a641017e22b2ee50998546a3be7397e
