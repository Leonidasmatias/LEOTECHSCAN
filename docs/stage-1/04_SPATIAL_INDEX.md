# Stage 1 — WP1.4 Spatial Index

## The gap this closes

Confirmed during the Stage 1 pre-implementation inspection by reading the live database's actual schema: `sites` has `latitude REAL, longitude REAL` columns but **no index covering either one** (the existing indexes — `idx_filters`, `idx_score`, `idx_site`, `idx_unified_site` — are all on categorical/text columns or `geo_score`). Every bounding-box query in the app today (`services/enterprise-v3-engine.ts`'s `digitalTwinSite()` and `geointelligence()`) does a full table scan under the hood to evaluate its `latitude BETWEEN ? AND ?` clause. `config/capabilities.json`'s `site_mapping` entry already says as much: *"Sem índice espacial dedicado e sem clustering de marcador"* (no dedicated spatial index, no marker clustering).

## Strategy: R-Tree, with an automatic fallback

Preference order, per the mission spec:

1. **SQLite R-Tree virtual table** (`CREATE VIRTUAL TABLE site_spatial_index USING rtree(id, minLat, maxLat, minLon, maxLon)`). For a point (a site has one lat/lon, not a real bounding box), `minLat = maxLat = latitude` and `minLon = maxLon = longitude`. Confirmed directly (not assumed) that Node's built-in `node:sqlite` — the exact engine `lib/db.ts` uses at runtime — has R-Tree support compiled in, by successfully creating and querying a real R-Tree virtual table in both a sandbox environment and, separately, via this project's own database file. **This script always builds the index through `node:sqlite`, never through Python's `sqlite3`**, specifically so the index-build path uses the identical SQLite feature set the running Next.js application queries against — Python's stdlib `sqlite3` is a separately-compiled SQLite build (confirmed R-Tree-capable too, in this environment, but that's beside the point: consistency with the runtime engine is what matters, not just "does some SQLite have R-Tree").
2. **Fallback**: if the `CREATE VIRTUAL TABLE ... USING rtree` statement itself fails (meaning the SQLite build in use wasn't compiled with `SQLITE_ENABLE_RTREE`), the script instead creates a plain composite index, `CREATE INDEX idx_sites_spatial_fallback ON sites(latitude, longitude)`. Not O(log n) for a 2D range query the way R-Tree is, but far better than the current unindexed scan, and needs no virtual table module at all.

A known, accepted limitation: SQLite's R-Tree module stores bounding-box coordinates as **32-bit floats internally**, not the 64-bit doubles `sites.latitude`/`longitude` use. Observed directly: a point inserted as `(-15.7942018..., -47.8825073...)` reads back with `minLat` slightly different from `maxLat` (by roughly 1–2×10⁻⁶ degrees, well under a millimeter on the ground) even though both were written as the same value. This is completely negligible at any bounding-box query scale this application uses (kilometers), and is documented here so it's never mistaken for a bug later.

## Layering (added during Checkpoint 2's test-collection fix)

The R-Tree/fallback DDL and DML text (the `CREATE VIRTUAL TABLE`/`CREATE INDEX`/insert/drop statements) lives in `services/geospatial/spatial-index-sql.mjs` as exported string constants, not inlined in the build script. `scripts/geospatial-spatial-index.mjs` imports those constants rather than duplicating the SQL text a second time. This split exists so `tests/geospatial-spatial-index.test.ts` can assert the DDL's shape (right table name, right column list, idempotent `IF NOT EXISTS`/`IF EXISTS`) by importing the zero-dependency `.mjs` module directly, without ever importing the build script itself — which imports `node:sqlite` at module scope and therefore cannot be safely collected by this project's Vitest pipeline (see `08_TEST_RESULTS.md` for the full explanation). The SQL text itself, and everything this script does with it, is unchanged by this split.

## Build/rebuild/verify script — `scripts/geospatial-spatial-index.mjs`

Three modes:
- `--mode dry-run` — reports which strategy would be used and how many sites would be indexed, without creating anything.
- `--mode build` — drops and recreates `site_spatial_index` from scratch (or creates the fallback index), inside a transaction, then runs `PRAGMA integrity_check` and logs a row to `geospatial_processing_runs`. A full from-scratch rebuild was chosen over incremental sync for this checkpoint, per the "do not optimize prematurely" instruction — `site_spatial_index` is fully derived from `sites`, so a full rebuild is always correct and the 299,308-row dataset rebuilds in well under 30 seconds (measured below), which doesn't yet justify the added complexity of incremental sync/triggers. Revisit if the dataset grows enough that this becomes a real cost.
- `--mode verify` — confirms the indexed row count matches the count of sites with non-null coordinates, and that `PRAGMA integrity_check` still reports `ok`; exits non-zero on any mismatch.

Rebuilding never touches `sites` or any other existing table — confirmed by a dedicated test asserting `sites`' row count is identical before and after a build.

## Validation sequence actually performed (copy first, then live)

1. Made a disposable byte-for-byte copy of the live database.
2. `--mode dry-run` against the copy: reported `strategy: "rtree"`, `sitesTotal: 299308`, `sitesToIndex: 299308` (every site in this dataset currently has non-null coordinates).
3. `--mode build` against the copy: succeeded, `integrityCheck: "ok"`, wall time ~27 seconds.
4. `--mode verify` against the copy: `geocodedSites: 299308`, `indexedCount: 299308`, `countsMatch: true`.
5. Performance measured against the copy (see below).
6. Only after all of the above passed: ran `--mode build` against the live database. `integrityCheck: "ok"`, wall time ~26 seconds. `--mode verify` against the live database confirmed the same counts. Separately re-ran `PRAGMA integrity_check`, `sites` row count, and all 14 protected tables' row counts directly against the live database after the build — all unchanged and matching the Checkpoint 1 baseline.
7. Disposable copy and its WAL/SHM sidecar files removed.

## Measured performance (honest numbers, not estimates)

All measurements: 20 iterations, averaged, against the real 299,308-row database (the disposable copy, which was byte-identical to the live database at the time of measurement).

| Query | Matches | Unindexed (current production reality) | With R-Tree index | Speedup |
|---|---|---|---|---|
| ~150km-wide box around Brasília | 8,129 sites | 74.93 ms avg | 5.76 ms avg | ~13× |
| ~15km-wide box around Brasília (typical zoomed-in viewport) | 3,256 sites | 55.26 ms avg | 1.28 ms avg | ~43× |

Match counts were identical between the indexed and unindexed queries in both cases — this is a correctness check, not just a speed one: the index returns exactly the same sites, just faster.

Both numbers, indexed and unindexed, are already inside the mission's stated performance targets (ordinary viewport <500ms warm) even before this change — the index turns "comfortably inside budget" into "essentially instant," which matters once WP1.7's viewport API is fetching on every pan/zoom rather than once per page load. No further optimization was attempted, per "correctness, reproducibility, and auditability over speed, until functionality is validated."

## Rollback

`site_spatial_index` (or `idx_sites_spatial_fallback`) is entirely derived from `sites.latitude`/`longitude` and holds no independent data. Rollback is `DROP TABLE IF EXISTS site_spatial_index;` (or `DROP INDEX IF EXISTS idx_sites_spatial_fallback;` for the fallback path) — safe at any time, since nothing outside Stage 1's own new code queries it yet. Consolidated further in `11_ROLLBACK_PLAN.md`.
