# Stage 1 — WP1.5 National Grid

## What it is

`services/geospatial/national-grid.ts` divides Brazil (in fact, the whole lat/lon plane — there's nothing Brazil-specific in the math) into a fixed grid of rectangular cells at one of four resolutions:

| Resolution | Cell size | Approx. size at the equator |
|---|---|---|
| 0 | 1.0° | ~111 km |
| 1 | 0.1° | ~11 km |
| 2 | 0.01° | ~1.1 km |
| 3 | 0.001° | ~111 m |

`gridCellId(latitude, longitude, resolution)` returns a plain string like `g2:-1580:-4789` (`floor(latitude / cellSize)` and `floor(longitude / cellSize)`, resolution-prefixed). `parseGridCellId()` and `gridCellBounds()` invert it back to the cell's index and exact lat/lon bounds.

## Why fixed-cell instead of geohash or H3

The mission spec allows "geohash/fixed-cell/custom" — fixed-cell was chosen deliberately, not by default:

- **No new runtime dependency.** A real geohash or H3 implementation is a library, and this session cannot `npm install` a new package and verify it end-to-end (the cloud sandbox used for this work has no access to the npm registry — the same limitation already documented for Stage 0's Vitest setup). Adding an unverified dependency to a production `package.json` is a worse risk than writing ~15 lines of arithmetic that can be read and checked by hand.
- **Transparency.** A fixed-cell id like `g2:-1580:-4789` is directly interpretable — the sign and magnitude of the indices tell you roughly where the cell is. A geohash string (`6xrp8b`) or an H3 index (a 64-bit integer, base-16 in practice) requires decoding to mean anything to a human reading a database row or a log line.
- **The known tradeoff, accepted and documented**: this is an equirectangular grid, so cells shrink in real-world east-west size away from the equator (a cell at Brazil's southern edge covers noticeably less real ground east-west than one at the equator). This is the same simplification already accepted elsewhere in this codebase — `services/enterprise-v3-engine.ts`'s existing `radius / 111` degrees-per-km approximation makes an equivalent simplifying assumption. Geohash and H3 don't have this particular distortion, but introducing them isn't worth an unverifiable new dependency for a feature (clustering/grid summaries) that doesn't need geodesic precision to begin with.

## Properties actually verified (8 tests)

- **Deterministic**: the same (lat, lon, resolution) always produces the same cell id — required for `geospatial_grid_cells` to be independently rebuildable from `sites` at any time and agree with itself.
- **Resolution-sensitive**: two points close enough to share a coarse (resolution 0) cell can and do land in different fine (resolution 2) cells.
- **Round-trips**: `parseGridCellId(gridCellId(lat, lon, r))` recovers the exact indices used to build the id; `gridCellBounds()` returns a rectangle that actually contains the original point.
- **Malformed input handling**: non-finite coordinates return `null` rather than a nonsensical cell id; malformed or out-of-range cell-id strings are rejected by both parsing functions rather than silently producing wrong bounds.

## How it's used elsewhere in Stage 1

`services/geospatial/spatial-intelligence-engine.ts`'s `getClustersInBoundingBox()` groups a bounding-box's worth of sites by grid cell at a caller-chosen resolution — the mechanism WP1.8's cluster API (Checkpoint 3) will sit on top of. `site_geospatial_status.grid_cell_id` (WP1.1) is populated by the coordinate-quality batch job (Checkpoint 4) so `getGridSummary()` can aggregate site counts per cell without recomputing grid membership for all 299,308 sites on every request.
