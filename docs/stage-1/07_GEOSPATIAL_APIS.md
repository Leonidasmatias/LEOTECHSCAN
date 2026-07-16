# Stage 1 — Checkpoint 3: Geospatial APIs (WP1.7-1.10)

## Scope

Four read-only HTTP endpoints exposing Checkpoint 2's spatial intelligence engine to the rest of the application. Every one of them is a thin adapter: request parsing/validation, a call into the already-approved Checkpoint 2 engine, and compact response shaping. No SQL is written in any route file; no query-shaping logic is duplicated. Frontend/Map Engine V2 work is explicitly out of scope for this checkpoint (requirement 9) — these are backend contracts only.

| Endpoint | Work package | Engine function called |
|---|---|---|
| `GET /api/geospatial/viewport` | WP1.7 | `getSitesInBoundingBox` |
| `GET /api/geospatial/clusters` | WP1.8 | `getClustersInBoundingBox` |
| `GET /api/geospatial/radius` | WP1.9 | `getSitesWithinRadius` |
| `GET /api/geospatial/nearest` | WP1.9 | `getNearestSites` |
| `GET /api/geospatial/summary` | WP1.10 | `getGridSummary` + `getCoordinateQualitySummary` |

## Layering

New pure (zero `node:sqlite`) modules, reused by every route:

- `services/geospatial/request-params.ts` — strict query-param parsing/validation against a plain `URLSearchParams` (requirement 2). A required parameter that is missing, non-numeric, or out of range is rejected with a list of reasons; only genuinely optional parameters (limit, resolution, radiusKm defaults) fall back quietly.
- `services/geospatial/compact-site.ts` — trims a raw `sites` row (or `siteRow()`'s ~24-field shape) down to a 9-10 field compact payload (`id, site, municipio, uf, operadora, tecnologia, status, latitude, longitude, geoScore`, plus `distanceKm` where relevant) for requirement 5, "return compact payloads only." Heavy Stage-0 fields (`arquivo_origem`, `data_importacao`, `station_id`, `endereco`, ...) never appear in a viewport/radius/nearest response.

Route files themselves (`app/api/geospatial/*/route.ts`) do nothing but: parse+validate via `request-params.ts`, call the Checkpoint 2 engine, map results via `compact-site.ts` where the result is a list of sites, and return `NextResponse.json(...)`. Every route returns HTTP 400 with `{ error, reasons }` for invalid input and 500 for unexpected failures, matching this project's existing error-response convention (`{ error: string }`, Portuguese messages).

## Request validation and limits (requirements 2 and 3)

| Param | Endpoints | Rule |
|---|---|---|
| `north/south/east/west` | viewport, clusters | Required; must be finite, in-range, `north>south`, `east>west` (antimeridian-crossing boxes rejected, inherited from Checkpoint 2's `validateBoundingBox`) |
| `lat/lon` | radius, nearest | Required; must be finite and in `[-90,90]`/`[-180,180]` |
| `radiusKm` | radius | Optional, default 10km, rejected (not clamped) above 300km |
| `maxRadiusKm` | nearest | Optional, default 200km, silently capped at 500km (an expanding-radius search parameter, not a strict user-facing bound) |
| `resolution` | clusters, summary | Optional; must be one of `0,1,2,3` if present |
| `limit` / `excludeSiteId` | all | Optional positive integer; the underlying engine's own `clampLimit` still enforces a hard per-endpoint ceiling regardless of what is requested |

Every endpoint's per-item result count is hard-capped inside the Checkpoint 2 engine (`clampLimit`) independent of anything the route layer does — a caller cannot force an unbounded response by any combination of query params.

## The clustering finding (Checkpoint 3, discovered during honest performance measurement)

Requirement 8 ("measure real performance against the production-size database") was run against a disposable, byte-identical copy of the live 299,308-row database (see "Verification" below) — and it surfaced two real issues in the *already-approved* Checkpoint 2 `getClustersInBoundingBox`, not in any new Checkpoint 3 code:

**1. Silent under-sampling at national scale.** The original `getClustersInBoundingBox` reused `getSitesInBoundingBox`'s full-row fetch, capped at `MAX_BBOX_LIMIT` (5,000), as its clustering candidate sample. For a whole-country, low-resolution cluster request — the case a national overview map would actually make — the real database has ~298,000 sites in Brazil's bounding box, so a 5,000-site sample covered only ~1.7% of the country. A cluster map built from that sample would silently understate real site density almost everywhere. This was never caught in Checkpoint 2 because Checkpoint 2's own verification used small synthetic databases and a narrower bounding box, where a 5,000-site cap was never actually the binding constraint.

  Fix: clustering only ever needs a point's latitude/longitude, not the other ~25 columns `SITE_SELECT` carries. A new lean `coordinatesByIds()` (two columns only) lets the candidate sample grow to a much larger `MAX_CLUSTER_CANDIDATES = 50,000` for the same per-row cost — still a hard cap (never literally unbounded, per the Stage 1 safety rule), but a ~29x larger, far more representative one. Verified against the real database: the default (no explicit `limit`) now samples 50,000 of 297,931 sites in a whole-Brazil bounding box (16.8%, vs. the old 1.7%), still correctly reporting `truncated: true` since 50,000 < 297,931.

**2. A latent SQLite parameter-count ceiling, exposed by the larger sample.** Raising the candidate sample to 50,000 immediately hit a real SQLite error: `too many SQL variables`. SQLite enforces a maximum number of bound parameters per prepared statement (`SQLITE_MAX_VARIABLE_NUMBER`) — empirically confirmed at 32,766 for this Node build (binary-searched directly against a real `node:sqlite` connection), but historically as low as 999 in SQLite versions before 3.32.0 (May 2020). An `id IN (?, ?, ...)` query built from an arbitrarily large id list is not safe to assume works on every SQLite build this application might ever run against.

  This ceiling was always a latent risk in Checkpoint 2's `sitesByIds()` too (used by `getSitesInBoundingBox`): `MAX_BBOX_LIMIT` (5,000) stays safely under this build's measured 32,766-variable ceiling, but 5,000 already *exceeds* the pre-3.32.0 999-variable ceiling — so the exact same "too many SQL variables" failure would have hit `getSitesInBoundingBox` itself on an older SQLite build, for any bounding box wide enough to match more than 999 sites. Nothing in Checkpoint 2's own testing (small synthetic databases, narrow bounding boxes) happened to exercise that path. Both `sitesByIds()` and the new `coordinatesByIds()` were fixed the same way: a new pure `chunkArray()` helper in `spatial-query-utils.ts` splits any id list into batches of `MAX_SQL_IN_CLAUSE_SIZE = 900` (safely under the historical 999-variable floor) before building each `IN (...)` query, so neither function can ever exceed a safe parameter count regardless of which SQLite build is running underneath. This is a portability hardening fix, not a behavior change: the returned rows are identical (`chunkArray` guarantees no id is dropped or duplicated across batches — covered directly by a unit test), just fetched in safely-sized pieces.

Both fixes are additive to the existing `getClustersInBoundingBox`/`sitesByIds` functions — every other Checkpoint 2 function (`getSitesInBoundingBox`, `getSitesWithinRadius`, `getNearestSites`, `getGridSummary`, `getCoordinateQualitySummary`, `getSiteGeospatialStatus`) is untouched, and the existing Checkpoint 2 test suite (pure-layer tests + the two source-inspection contract tests) still passes unchanged against the modified file (see "Verification" below) plus one new assertion (`getClustersInBoundingBox` is now included in the "every read op enforces a limit" contract check) and a new `chunkArray` unit-test block.

## Real performance (honest numbers, against a disposable copy of the live 299,308-row database)

Measured by directly invoking the real (fixed) engine functions — the same functions the routes call unmodified — against a byte-identical copy of the live database, 20 iterations averaged per query, via a Node-native harness outside Vitest (see "Verification" below for why the harness runs there rather than through the routes themselves).

| Query | Result | Avg latency |
|---|---|---|
| Viewport, ~150km-wide bbox, limit 2000 | 500 of 9,486 matching sites | 17.0 ms |
| Viewport, ~15km-wide bbox (typical zoomed-in), limit 2000 | within limit | 12.0 ms |
| Clusters, whole-Brazil bbox, resolution 0, **default** (up to 50,000) | 92 clusters from a 50,000/297,931-site sample | 333.4 ms |
| Clusters, whole-Brazil bbox, resolution 0, old 5,000 cap (for comparison) | 5,000/297,931-site sample | 244.1 ms |
| Clusters, ~150km bbox, resolution 1, limit 2000 | 92 clusters, full sample (no truncation) | 7.3 ms |
| Radius, 10km around a real site | within radius, real Haversine | 27.8 ms |
| Radius, 50km around a real site | within radius | 29.9 ms |
| Nearest, 20 nearest to a real site | expanding-radius search | 27.6 ms |
| Summary, grid resolution 0 | reads `site_geospatial_status` (currently 0 rows — populated by Checkpoint 4's WP1.11, not yet run) | 0.02 ms |

Every realistic viewport/radius/nearest/summary case is well inside the mission's "<500ms warm" target, most by more than an order of magnitude. The one case approaching that budget is the most extreme possible request this API supports — the entire country at the lowest resolution with the maximum candidate sample — and it still completes in 333ms, comfortably under 500ms. No further optimization was attempted, per "correctness, reproducibility, and auditability over speed, until functionality is validated."

## Verification

**Pure unit tests (Vitest, zero `node:sqlite` in their import graph):**
- `tests/geospatial-request-params.test.ts` — every parse function, valid/missing/non-numeric/out-of-range/default-fallback cases (20 checks).
- `tests/geospatial-compact-site.test.ts` — field mapping, compactness (asserts the exact key set, explicitly checks heavy Stage-0 fields never leak through), graceful fallback on missing data (6 checks).
- `tests/geospatial-spatial-intelligence-engine.test.ts` — extended with a `chunkArray` block (5 checks): even/uneven splits, oversized chunk size, empty input, and a 2,537-id no-drop/no-duplicate/order-preserving check.

**Source-inspection contract test (never imports a route file — every route transitively reaches `node:sqlite` via `@/lib/db`):**
- `tests/geospatial-api-contract.test.ts` — for each of the 5 routes: imports and calls the correct Checkpoint 2 engine function; imports and calls the shared `request-params` validators; returns an explicit 400 on invalid input; uses the read-only `getDb()` (never `getWritableDb()`); never hand-writes SQL or imports `node:sqlite` directly; declares `runtime="nodejs"`/`dynamic="force-dynamic"`; has a 500 catch-all; and (viewport/radius/nearest) shapes its response through `compact-site.ts`. 45 checks, all passing (dry-run against the real route source, since this session cannot run the project's real Vitest).
- `tests/geospatial-spatial-engine-contract.test.ts` — the existing Checkpoint 2 contract test, re-verified against the modified engine file, plus `getClustersInBoundingBox` added to the "enforces a hard limit" check.

**Node-native integration + performance (outside Vitest, against real `node:sqlite` databases):** this project's `node_modules` (including `next`) exist only on the Windows host, reached through the Cowork device bridge; this session's own cloud sandbox has no network route to fetch them, and the device bridge's own execution path (`device_bash`) hit a known, previously-documented bridge/FUSE read-corruption error trying to resolve `next/server` (`Invalid package config .../package.json` — confirmed by independently re-reading the same file through the more reliable `device_stage_files` path, where it parses as valid JSON; this is the bridge's own read-cache, not a real file problem, and per this session's standing instruction it was not "fixed" by touching that file). Route-level (`NextRequest`/`NextResponse`) end-to-end execution therefore could not be exercised directly in this session.

What *was* run directly, against a real `node:sqlite` connection: (1) all engine functions against a disposable, SHA-256-verified, `PRAGMA integrity_check`-clean byte copy of the live 299,308-row database (8 correctness checks: count/truncation consistency, the invalid-bbox structured-error path, cluster-count-sums-to-sample, real-Haversine radius filtering, sorted-nearest-with-limit, the grid/quality summary shape, and the specific default-sample-size regression check for the clustering finding above), immediately followed by the performance table above, all on the same disposable copy; and (2) the existing Checkpoint 2 synthetic-in-memory-database integration test (12 checks, unchanged pass), confirming the engine-layer fix didn't regress any previously-verified behavior. This is strong, real-data evidence for the part of the system that actually touches the database and does the expensive work; it is not a substitute for the user's own `npm test`/`npx tsc --noEmit` run, which remains the authoritative gate, and it does not exercise the literal HTTP request/response cycle (covered instead by the source-inspection contract test above, which confirms each route's wiring without needing to execute it).

## Production behavior

- No Stage 0 file touched.
- No table schema changed; no write path added (every new/modified function is read-only).
- `getSitesInBoundingBox`, `getSitesWithinRadius`, `getNearestSites`, `getGridSummary`, `getCoordinateQualitySummary`, `getSiteGeospatialStatus` are byte-for-byte unchanged from Checkpoint 2.
- `getClustersInBoundingBox`'s SQL text, sampling strategy, and default sample size changed (see "The clustering finding" above) — its output shape (`{ clusters, resolution, sampledSites, totalCountInBoundingBox, truncated }`) is unchanged, and it now also returns the same structured `{ error: reasons }` shape as `getSitesInBoundingBox` for an invalid bounding box (previously it relied on the caller/route to validate first).
- `sitesByIds()` (used by `getSitesInBoundingBox`) now batches its `IN (...)` query instead of issuing one query for the whole candidate list — same returned rows, same order source (still driven by the R-Tree candidate id order), just chunked. This is the portability hardening from finding #2 above, not a behavior change.
