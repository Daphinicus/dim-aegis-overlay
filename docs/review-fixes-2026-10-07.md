# Review repairs for the October 7 test checkpoint

This patch repairs all fifteen Aegis findings against 72579b5 while preserving the original tooltip typography, extension identity and dependency versions.

| Findings | Result |
| --- | --- |
| A01-A02 | Verified trait enhancement identities retain scores; activity queries resolve single-mode grades and exclude unavailable values. |
| A03-A04 | Failed refreshes retain each last-good channel. Mode is read when refreshed aliases commit. Distinct same-name rows survive extraction and canonical scoring; verified item metadata or owned origins resolve cross-family editions, and ambiguous inputs remain unresolved. |
| A05 | Complete native account/revision snapshots drive Shopping ownership. Stale or disposed snapshots cannot commit; open audits refresh after committed or cleared ownership. |
| A06-A07 | Native tooltip disclosures remain bounded and scrollable; selected score settings expose localized group names and pressed state. |
| A08-A10 | Background serializes Light.gg deltas without lost updates. Cached armor retains A/S presentation. External notes and grades remain escaped text inside trusted tooltip structure. |
| A11-A13 | Language choices support native keyboard navigation, the changelog contains/restores focus, and readable chips/removal labels update in all six languages while preserving raw query syntax. |
| A14 | Fetch returns its original response promptly and inspects the cloned body asynchronously with handled rejection. |
| A15 | Firefly recommendations use the current verified trait icon in normal and enhanced comparisons; exact owned definitions and numerical score IDs remain stable. |

Final combined verification: 208 score tests in twelve files, fifteen data regressions, five UI regression groups, the complete Node unit suite, TypeScript and all six production bundles pass. The actual content edition resolver is exercised by five tests without modeled patches or source overrides. Each assigned finding has fail-before/pass-after evidence in the private coordinator receipts.

Independent review found and corrected three introduced lifecycle races: deferred DIMSUM migration (documented in that repository), open Shopping audit refresh, and activity-mode changes during a slow source refresh. It also prompted actual content-resolver ambiguity coverage.

Offline Chromium UI checks cover native accessibility state, keyboard navigation, six languages, tooltip growth/scrolling, reduced motion and forced colors. Firefox fixture launch was unavailable (spawn UNKNOWN); deployed Chrome/Zen and full combined browser acceptance are recorded separately. Existing compact-popup label clipping and incomplete unrelated score-label translations remain known baseline limitations.

The controlled Light.gg probe delayed its cloned body by 250 ms while the wrapper returned the original response in under one millisecond. This is fixture evidence, not a live latency guarantee. No account inventory, tags or shaders were modified. No upstream changes, merge, release or deployment are part of this patch.

CI at d6e8e7d passed scores, Node checks and the complete Chromium suite, then exposed a Firefox-only tooltip fixture dismissal. Each tooltip case now hides the prior card, moves the pointer onto the relocated anchor and opens the disclosure through a native click. Existing viewport, scrolling, focus and lifecycle assertions remain; explicit open/visible checks and named failure diagnostics were added. Corrected Chromium coverage passes. Firefox confirmation is tracked for the subsequent exact-commit CI run; no production code changed for this fixture correction.


A15 Firefly follow-up was reproduced against exact integration commit `705e11b8ec5aae7c6dec679fcdedef33d3dd1dfe`. The cached public Bungie English InventoryItem manifest `244213.26.06.29.2000-1-bnet.65864` contains legacy normal trait `1561789734` with icon `27f84cef4d4ab2aa73fa5692792831e2.png`, current normal trait `3824105627`, and enhanced trait `1183436451`. The latter two use `629e225e6f8214326bc1eb0a911a6f6d.png`, the flame inside a circular crosshair. The bundled DIM enhancement table verifies the exact `3824105627 -> 1183436451` relationship, and all three definitions belong to the `frames` weapon-trait socket family. A small public-definition fixture records these identities and provenance; no full manifest or dependency was added.

The generator now updates a historical representative's presentation only when one verified normal endpoint in that trait family has a different manifest glyph. Multiple linked endpoints, absent glyphs, and other socket families retain the previous choice. This is not a display-name prefix or icon-based identity guess: exact definitions and verified links establish the family, while the icon difference identifies a presentation update. Regeneration changes only Firefly's two names, two aliases and three hash mappings. All indexed definitions retain their prior numerical score IDs; Firefly's canonical score ID remains `1183436451`. Direct legacy-hash icon lookup and owned/native icon nodes remain unchanged.

`node tests/firefly-comparison.test.cjs` reproduces the pre-fix actual comparison-controller result (`1561789734` where the normal recommendation requires `3824105627`) and passes after repair. It exercises unmodified production SVG creation for normal and enhanced columns, exact icon URLs and enhancement markers, legacy/current/enhanced score equivalence, and the actual perk evaluator's missing/owned presentations. The complete Node unit suite, all 208 score tests, TypeScript and six production bundles pass. Independent review also checked every indexed score identity and generator selection for same/missing glyphs, multiple linked endpoints, non-trait collisions and alias ambiguity.

A single disposable Chromium `151.0.7922.34` fixture rendered the actual bundled comparison controller with routed public manifest PNGs and production styles. The screenshot confirms the flame/crosshair glyph, enhancement arrow, and preserved owned legacy glyph; node assertions verify the exact normal/enhanced/owned hashes and icon paths. Fixture marker anatomy and status colors are controlled inputs. This confirms rendered glyph identity, not deployed DIM or in-game screenshot pixel parity. The browser was closed after this check; live standard Chrome/Zen acceptance for A15 remains pending.

Exact `705e11b` CI run `37703430504` passed scores, Node checks, Chromium and Firefox browser suites, and all production bundles, resolving the earlier Firefox fixture issue above. That green run predates A15. The final Firefly integration commit and its CI verification remain pending the coordinator's handoff.
