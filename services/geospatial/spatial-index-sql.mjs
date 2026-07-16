// STAGE 1 -- WP1.4 Spatial Index: pure SQL/schema constants.
//
// Plain .mjs (not .ts) so this single module can be imported two ways with
// no build step in between:
//   1. scripts/geospatial-spatial-index.mjs (a standalone Node script run
//      directly via `node`, outside the Next.js/Vite toolchain) imports it
//      with a relative path.
//   2. tests/geospatial-spatial-index.test.ts imports it via the "@/" alias
//      through Vitest's own Vite-based resolution.
// Zero imports of node:sqlite or anything else here -- these are strings
// and small pure helpers only, so both consumers can load this file with no
// risk of the node:sqlite collection failure documented in
// docs/stage-1/08_TEST_RESULTS.md.

export const SITE_SPATIAL_INDEX_TABLE = "site_spatial_index";
export const SITE_SPATIAL_INDEX_FALLBACK_INDEX = "idx_sites_spatial_fallback";

export const CREATE_SITE_SPATIAL_INDEX_RTREE_SQL =
  "CREATE VIRTUAL TABLE site_spatial_index USING rtree(id, minLat, maxLat, minLon, maxLon)";

export const CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL =
  "CREATE INDEX IF NOT EXISTS idx_sites_spatial_fallback ON sites(latitude, longitude)";

export const INSERT_SITE_SPATIAL_INDEX_ROW_SQL =
  "INSERT INTO site_spatial_index (id, minLat, maxLat, minLon, maxLon) VALUES (?, ?, ?, ?, ?)";

export const DROP_SITE_SPATIAL_INDEX_SQL = "DROP TABLE IF EXISTS site_spatial_index";

// Note: the bounding-box overlap SELECT used to *query* site_spatial_index
// (the read side, WP1.6) is a separate concern from this file's build/
// rebuild DDL (the write side, WP1.4) and lives in
// services/geospatial/spatial-query-utils.ts instead, next to the rest of
// the read-query pure helpers -- kept here would have meant the same
// constant duplicated in two places with no shared consumer to keep them in
// sync automatically.
