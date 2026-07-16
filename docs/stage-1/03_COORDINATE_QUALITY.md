# Stage 1 — WP1.2/WP1.3 Coordinate Quality Engine & Brazil Geographic Bounds

## Files

- `services/geospatial/brazil-bounds.ts` — WP1.3
- `services/geospatial/coordinate-quality-engine.ts` — WP1.2

Both are pure and dependency-free: no imports beyond each other, no `node:sqlite`, no database access. This mirrors the pattern established in Stage 0 for `services/copernicus-truth.ts` (see `docs/stage-0/05_TEST_BASELINE.md`'s "Follow-up" sections) — logic that doesn't need a database shouldn't import anything that pulls one in, so it stays trivially unit-testable.

## WP1.3 — Brazil Geographic Bounds

A plain bounding-box check: latitude in `[-34, 6]`, longitude in `[-75, -32]`. These are **the same numbers already used by `services/data-quality-engine.ts`'s "coordenadas-invalidas" check** (Stage 0) — deliberately reused rather than redefined, so a coordinate can't be "outside Brazil" in one part of the app and "fine" in another.

This is a bounding rectangle, not a country polygon. It has no knowledge of Brazil's actual borders, and the rectangle also covers parts of Bolivia, Paraguay, Peru, and the Pacific/Atlantic near the coastlines. A site can pass this check and still not be in Brazil, or in the wrong municipality entirely. **This limitation is permanent and intentional** — there are no municipality/UF boundary geometries anywhere in this codebase, and Stage 1 does not add any, per the safety rule against claiming exact site-location accuracy without evidence. `classifyBrazilBounds()` returns `inside | near_border | outside | cannot_validate`, with a 0.5°-tolerance "near border" band (~55km) so border-adjacent sites are flagged for human review rather than confidently called either way.

`suspectedLatLonSwap()` catches a specific, common data-entry mistake: a pair that fails the bounds check but would pass if latitude and longitude were swapped. It never corrects anything — it only feeds a `suspicious` classification for a human to look at.

## WP1.2 — Coordinate Quality Engine

`evaluateCoordinateQuality()` classifies a single site's coordinate into one of 11 statuses (the exact enum from the Stage 1 spec): `valid`, `missing`, `invalid_latitude`, `invalid_longitude`, `invalid_pair`, `zero_coordinate`, `outside_brazil`, `duplicate_exact`, `duplicate_dense`, `suspicious`, `requires_review`.

**Priority order** when more than one condition could apply (worst-first, so `status` always reflects the single most important concern while `reasons`/`warnings` keep everything else visible): missing → invalid latitude → invalid longitude → identical-non-zero pair (`invalid_pair`, a copy-paste signature) → zero coordinate → outside Brazil / suspected swap → duplicate exact → duplicate dense → near-border (`requires_review`) → valid.

**Duplicate detection is deliberately not computed here.** `services/duplicates-engine.ts` (Stage 0) already detects exact-coordinate and dense-cluster duplicates by querying across all sites. Re-implementing a second, independent duplicate detector inside this "pure" engine would risk exactly the kind of drift the WP0.4 audit flagged for the Copernicus truth triplet (two copies of the same fact, edited in only one place). Instead, `evaluateCoordinateQuality()` takes `isDuplicateExact`/`isDuplicateDense` as caller-supplied booleans — the batch job that populates `site_geospatial_status` (Checkpoint 4) is expected to compute these from the existing engine's queries and pass them in.

**Eligibility, and what it does and doesn't mean:**
- `eligibleForMapping` — true for anything that has a real coordinate landing in or near Brazil, even if flagged as a duplicate or suspicious. The reasoning: the map is exactly where a human notices and investigates a questionable point, so hiding it defeats the purpose. False only for `missing`, `invalid_latitude`, `invalid_longitude`, `invalid_pair`, `zero_coordinate`, `outside_brazil`.
- `eligibleForSentinel` — true **only** for `status === "valid"`. This is deliberately the strictest tier. Per the mission's explicit truthful-labeling requirement: **"Sentinel eligible" means only that a coordinate is precise and unambiguous enough to be worth using in a future Sentinel-1 scene search — it is not a claim that any satellite evidence exists, and Copernicus/Sentinel-1 integration remains simulated exactly as documented in Stage 0.**

No auto-correction happens anywhere in this module — confirmed by a dedicated test that the input object is byte-identical before and after evaluation. Suggestions only, exactly as the mission's safety rules require.

## Verification

This session cannot run `npm test` directly (see `docs/stage-0/05_TEST_BASELINE.md`) — logic was verified by direct execution of the real module code against real assertions (21 checks: 8 for `brazil-bounds.ts`, 13 for `coordinate-quality-engine.ts`), all passing, in addition to the checked-in `tests/geospatial-brazil-bounds.test.ts` and `tests/geospatial-coordinate-quality.test.ts` (same assertions, vitest form). The user's own `npm test` run during Checkpoint 1 confirmed these pass for real.
