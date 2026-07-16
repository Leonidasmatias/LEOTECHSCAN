# Stage 1 — WP1.1 Geospatial Domain Model

## Why these four tables

`sites` already carries `latitude`/`longitude` as plain columns with no dedicated quality, indexing, or grid metadata attached (confirmed during the Stage 1 pre-implementation inspection: no index on either column, and no column recording anything about coordinate trustworthiness). Rather than adding a growing set of ad-hoc columns to `sites` itself — which the Stage 1 safety rules prohibit doing destructively, and which would blur "imported data" with "derived analysis" — Stage 1 adds four new, clearly-derived tables. All four can be dropped and rebuilt from `sites` with no data loss; none of them is a source of truth for anything, `sites` remains that.

## Tables

### `site_geospatial_status`

One row per site (`site_id INTEGER PRIMARY KEY REFERENCES sites(id)`), the *current* geospatial status snapshot — what a UI reads to show a site's status right now.

| Column | Type | Meaning |
|---|---|---|
| `site_id` | INTEGER PK | FK to `sites(id)` |
| `latitude`, `longitude` | REAL | copied at evaluation time, for convenience/audit (not a second source of truth — always re-derived from `sites`) |
| `coordinate_status` | TEXT | one of the 11 values from WP1.2 (`valid`, `missing`, `invalid_latitude`, `invalid_longitude`, `invalid_pair`, `outside_brazil`, `zero_coordinate`, `duplicate_exact`, `duplicate_dense`, `suspicious`, `requires_review`) |
| `coordinate_confidence` | REAL | 0–1 relative confidence, not a probability |
| `mapping_eligible`, `sentinel_eligible` | INTEGER (0/1) | see `03_COORDINATE_QUALITY.md` for exactly what each means |
| `duplicate_coordinate`, `suspicious_coordinate`, `outside_brazil` | INTEGER (0/1) | quick-filter flags mirroring `coordinate_status` |
| `validation_reasons` | TEXT (JSON array) | human-readable reasons, Portuguese, matching the rest of the app's UI language |
| `grid_cell_id` | TEXT | WP1.5 grid cell, nullable when coordinates can't be classified into one |
| `last_evaluated_at`, `algorithm_version` | TEXT | when and by which version of the classifier this row was produced |

### `site_coordinate_quality`

Append-only history: every time a site's coordinate quality is (re-)evaluated, a new row is inserted here (`id INTEGER PRIMARY KEY AUTOINCREMENT`, not keyed by `site_id`). `site_geospatial_status` always reflects the latest evaluation; this table is the audit trail behind it — useful for answering "when did this site's status change, and why" without needing a separate change-log mechanism.

### `geospatial_processing_runs`

One row per batch job (index build/rebuild, coordinate-quality batch evaluation, grid rebuild, verify) — `run_type`, `mode`, `started_at`, `finished_at`, `status`, `sites_processed`, `sites_total`, `notes`. This is the same idea as `import_audit` (Stage 0's importer audit trail) applied to Stage 1's own batch operations, so every geospatial processing run is independently auditable later, not just trusted based on a console log at the time.

### `geospatial_grid_cells`

One row per populated grid cell (`grid_cell_id TEXT PRIMARY KEY`) with its resolution, bounds, center point, and current site count — a precomputed summary table so grid-based dashboards (WP1.16) don't need to re-aggregate `site_geospatial_status` on every request. Populated by the same batch process that evaluates coordinate quality (Checkpoint 4's processing command); empty until then.

## Migration mechanics

`scripts/geospatial_migrate.py`:
- Every statement is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` — safe to run multiple times.
- Runs inside a single `BEGIN IMMEDIATE` / `COMMIT` transaction; any failure rolls back the whole batch, never a partial set of new tables.
- Before returning success, re-checks that all 14 pre-existing "protected" tables (the same list Stage 0's backup tooling tracks) have byte-identical row counts to before the migration ran, and that `PRAGMA integrity_check` still reports `ok`. Any mismatch raises immediately rather than silently succeeding.

## What was actually run, and the result

Validated on a disposable copy of the production database first (built, then re-run a second time to confirm idempotency), then applied to the live database (`C:\LEOTECHSCAN\DATABASE\leotechscan.db`).

- Before: `sites` = 299,308 rows; 14 tables tracked as protected.
- After: `site_geospatial_status`, `site_coordinate_quality`, `geospatial_processing_runs`, `geospatial_grid_cells` all present; all 14 protected tables' row counts unchanged; `sites` still 299,308 rows; `PRAGMA integrity_check` = `ok`.

## Rollback

All four tables are purely derived and currently empty of anything but structure (no batch evaluation has populated them yet, beyond what WP1.4's index build wrote to `geospatial_processing_runs`). Rollback is `DROP TABLE IF EXISTS site_geospatial_status, site_coordinate_quality, geospatial_processing_runs, geospatial_grid_cells;` — safe at any point in Stage 1, since nothing outside Stage 1's own code reads them yet. Full rollback plan (including the spatial index) is consolidated in `11_ROLLBACK_PLAN.md`, written once Checkpoint 5 closes.
