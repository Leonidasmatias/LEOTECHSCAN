// STAGE 1 -- WP1.6 Spatial Intelligence Service (SQLite adapter layer).
//
// This is the thin, DB-touching half of WP1.6. All the actual math --
// bbox validation, limit clamping, Haversine distance, radius-to-bbox
// conversion, cluster aggregation, nearest-site filtering -- lives in
// services/geospatial/spatial-query-utils.ts (pure, zero imports of
// node:sqlite) and is only called from here, never reimplemented. See
// docs/stage-1/08_TEST_RESULTS.md for why this split exists: Vitest could
// not reliably collect a test file that imports node:sqlite (directly or
// transitively), the same failure mode documented for
// services/copernicus-truth.ts in docs/stage-0/05_TEST_BASELINE.md.
// tests/geospatial-spatial-engine-contract.test.ts is a source-inspection
// test (reads this file as text, never imports it) confirming it actually
// delegates to spatial-query-utils.ts rather than drifting back to
// duplicated inline logic.
//
// Every operation here takes a hard result-count limit -- there is no
// operation that can serialize the full national dataset, per the Stage 1
// safety rule "never unlimited national dataset."
//
// `db` is typed `any` deliberately: this module takes whatever
// DatabaseSync-like connection the caller already has open (production
// code gets it from lib/db.ts's getDb()/getWritableDb(); real integration
// tests construct their own in-memory node:sqlite connection -- see
// docs/stage-1/08_TEST_RESULTS.md for where that verification actually
// lives now) rather than importing node:sqlite itself.
import { SITE_SELECT } from "@/api/site-query";
import { gridCellBounds, type GridResolution } from "@/services/geospatial/national-grid";
import {
  clampLimit,
  haversineKm,
  radiusToBoundingBox,
  withDistances,
  filterWithinRadius,
  excludeAndLimit,
  aggregateIntoGridClusters,
  validateBoundingBox,
  buildInPlaceholders,
  chunkArray,
  SITE_SPATIAL_INDEX_BBOX_OVERLAP_SQL,
  bboxOverlapParams,
  type BoundingBox,
} from "@/services/geospatial/spatial-query-utils";

export type { BoundingBox };

export type SpatialQueryOptions = { limit?: number };

const DEFAULT_BBOX_LIMIT = 2000;
const MAX_BBOX_LIMIT = 5000;
const DEFAULT_RADIUS_LIMIT = 500;
const MAX_RADIUS_LIMIT = 2000;
const DEFAULT_NEAREST_LIMIT = 20;
const MAX_NEAREST_LIMIT = 200;
// Clustering only ever needs a point's latitude/longitude, unlike the
// compact-but-still-27-column SITE_SELECT rows getSitesInBoundingBox
// fetches -- so its candidate sample can be far larger for the same cost.
// This constant is intentionally much bigger than MAX_BBOX_LIMIT: see the
// comment on getClustersInBoundingBox for why sharing MAX_BBOX_LIMIT
// silently under-sampled whole-country cluster requests (Checkpoint 3
// finding, documented in docs/stage-1/07_GEOSPATIAL_APIS.md).
const MAX_CLUSTER_CANDIDATES = 50000;
// SQLite enforces a maximum number of bound parameters per prepared
// statement (SQLITE_MAX_VARIABLE_NUMBER) -- historically 999 before SQLite
// 3.32.0 (2020-05), 32,766 by default since (empirically confirmed at
// 32,766 for this Node build during Checkpoint 3's real-database
// performance run -- an `id IN (?, ?, ...)` query built directly from
// MAX_CLUSTER_CANDIDATES ids hit "too many SQL variables" past that point).
// A single batch must stay safely under the OLDER, stricter ceiling so this
// still works against any SQLite build this application might ever run
// against, not just the one it happened to be measured against.
const MAX_SQL_IN_CLAUSE_SIZE = 900;

function hasSpatialIndexTable(db: any): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_spatial_index'").get();
}

// Returns the set of candidate site ids whose bounding box overlaps the
// query bbox, using whichever spatial-index strategy WP1.4 actually built
// (R-Tree if available, otherwise null -- meaning the caller falls back to
// querying `sites` directly through its own composite index).
function candidateIdsInBoundingBox(db: any, bbox: BoundingBox): number[] | null {
  if (!hasSpatialIndexTable(db)) return null;
  const rows = db.prepare(SITE_SPATIAL_INDEX_BBOX_OVERLAP_SQL).all(...bboxOverlapParams(bbox)) as Array<{ id: number }>;
  return rows.map((row) => row.id);
}

function sitesByIds(db: any, ids: number[]): Record<string, unknown>[] {
  if (ids.length === 0) return [];
  return chunkArray(ids, MAX_SQL_IN_CLAUSE_SIZE).flatMap((batch) => {
    const placeholders = buildInPlaceholders(batch.length);
    return db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id IN (${placeholders})`).all(...batch) as Record<
      string,
      unknown
    >[];
  });
}

// Lean counterpart to sitesByIds() for callers (clustering) that only need
// coordinates, not the full ~27-column site record -- fetching only two
// columns per row is what lets getClustersInBoundingBox afford a much
// larger candidate sample than getSitesInBoundingBox's MAX_BBOX_LIMIT.
function coordinatesByIds(db: any, ids: number[]): Array<{ latitude: number; longitude: number }> {
  if (ids.length === 0) return [];
  return chunkArray(ids, MAX_SQL_IN_CLAUSE_SIZE).flatMap((batch) => {
    const placeholders = buildInPlaceholders(batch.length);
    return db.prepare(`SELECT latitude, longitude FROM sites WHERE id IN (${placeholders})`).all(...batch) as Array<{
      latitude: number;
      longitude: number;
    }>;
  });
}

export function getSiteCountInBoundingBox(db: any, bbox: BoundingBox): number {
  const candidateIds = candidateIdsInBoundingBox(db, bbox);
  if (candidateIds !== null) return candidateIds.length;
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM sites WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`)
    .get(bbox.south, bbox.north, bbox.west, bbox.east) as { n: number };
  return row.n;
}

export function getSitesInBoundingBox(db: any, bbox: BoundingBox, options: SpatialQueryOptions = {}) {
  const validation = validateBoundingBox(bbox);
  if (!validation.valid) {
    return { items: [], count: 0, totalCount: 0, truncated: false, limit: 0, error: validation.reasons };
  }
  const limit = clampLimit(options.limit, DEFAULT_BBOX_LIMIT, MAX_BBOX_LIMIT);
  const totalCount = getSiteCountInBoundingBox(db, bbox);
  const candidateIds = candidateIdsInBoundingBox(db, bbox);
  const rows =
    candidateIds !== null
      ? sitesByIds(db, candidateIds.slice(0, limit))
      : (db
          .prepare(`SELECT ${SITE_SELECT} FROM sites WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? LIMIT ?`)
          .all(bbox.south, bbox.north, bbox.west, bbox.east, limit) as Record<string, unknown>[]);
  return { items: rows, count: rows.length, totalCount, truncated: totalCount > rows.length, limit };
}

export function getClustersInBoundingBox(
  db: any,
  bbox: BoundingBox,
  resolution: GridResolution,
  options: SpatialQueryOptions = {},
) {
  const validation = validateBoundingBox(bbox);
  if (!validation.valid) {
    return { clusters: [], resolution, sampledSites: 0, totalCountInBoundingBox: 0, truncated: false, error: validation.reasons };
  }
  // Checkpoint 3 finding (docs/stage-1/07_GEOSPATIAL_APIS.md): the first
  // version of this function reused getSitesInBoundingBox's full-row fetch
  // (capped at MAX_BBOX_LIMIT=5000) as its clustering candidate sample.
  // That silently under-sampled a whole-country, low-resolution cluster
  // request -- honest performance measurement against the real 299,308-row
  // production copy found a 5,000-site sample was only ~1.6% of the
  // national dataset, which would understate real site density almost
  // everywhere on a national overview. Clustering only ever needs
  // latitude/longitude, so it fetches coordinates directly (via
  // coordinatesByIds/a lean fallback SELECT) up to the much larger
  // MAX_CLUSTER_CANDIDATES instead of reusing the full-row limit.
  const limit = clampLimit(options.limit, MAX_CLUSTER_CANDIDATES, MAX_CLUSTER_CANDIDATES);
  const candidateIds = candidateIdsInBoundingBox(db, bbox);
  let points: Array<{ latitude: number; longitude: number }>;
  let totalCount: number;
  if (candidateIds !== null) {
    totalCount = candidateIds.length;
    points = coordinatesByIds(db, candidateIds.slice(0, limit));
  } else {
    totalCount = getSiteCountInBoundingBox(db, bbox);
    points = db
      .prepare(`SELECT latitude, longitude FROM sites WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? LIMIT ?`)
      .all(bbox.south, bbox.north, bbox.west, bbox.east, limit) as Array<{ latitude: number; longitude: number }>;
  }
  const clusters = aggregateIntoGridClusters(points, resolution);
  return {
    clusters,
    resolution,
    sampledSites: points.length,
    totalCountInBoundingBox: totalCount,
    truncated: totalCount > points.length,
  };
}

export function getSitesWithinRadius(
  db: any,
  center: { latitude: number; longitude: number },
  radiusKm: number,
  options: SpatialQueryOptions = {},
) {
  const limit = clampLimit(options.limit, DEFAULT_RADIUS_LIMIT, MAX_RADIUS_LIMIT);
  const bbox = radiusToBoundingBox(center, radiusKm);
  // Overfetch candidates within the bbox (bounded by MAX_RADIUS_LIMIT) so
  // the exact-distance filter below has enough to work with even though the
  // box is a rough square around a circle.
  const { items } = getSitesInBoundingBox(db, bbox, { limit: MAX_RADIUS_LIMIT });
  const withDistance = withDistances(center, items as Array<Record<string, unknown> & { latitude: number; longitude: number }>);
  const withinRadius = filterWithinRadius(withDistance, radiusKm);
  const truncated = withinRadius.length > limit;
  return { items: withinRadius.slice(0, limit), count: Math.min(withinRadius.length, limit), radiusKm, truncated };
}

export function getNearestSites(
  db: any,
  center: { latitude: number; longitude: number },
  options: SpatialQueryOptions & { excludeSiteId?: number; maxRadiusKm?: number } = {},
) {
  const limit = clampLimit(options.limit, DEFAULT_NEAREST_LIMIT, MAX_NEAREST_LIMIT);
  const maxRadiusKm = options.maxRadiusKm ?? 200;
  // Expanding-radius search: start narrow (cheap) and widen only if not
  // enough candidates are found, capped at maxRadiusKm so this can never
  // degrade into an unbounded/full-table search.
  const radiiToTry = [10, 30, 75, 150, maxRadiusKm].filter((r, index, all) => r <= maxRadiusKm && all.indexOf(r) === index);
  if (radiiToTry[radiiToTry.length - 1] !== maxRadiusKm) radiiToTry.push(maxRadiusKm);

  let candidates: Array<Record<string, unknown> & { distanceKm: number; id?: unknown }> = [];
  let searchedRadiusKm = radiiToTry[0];
  for (const radiusKm of radiiToTry) {
    const result = getSitesWithinRadius(db, center, radiusKm, { limit: Math.max(limit * 3, MAX_RADIUS_LIMIT) });
    candidates = result.items as typeof candidates;
    searchedRadiusKm = radiusKm;
    if (excludeAndLimit(candidates, { excludeId: options.excludeSiteId, limit }).length >= limit) break;
  }
  const filtered = excludeAndLimit(candidates, { excludeId: options.excludeSiteId, limit });
  return { items: filtered, count: filtered.length, searchedRadiusKm };
}

export function getGridSummary(db: any, resolution: GridResolution, options: SpatialQueryOptions = {}) {
  const limit = clampLimit(options.limit, 500, 2000);
  const rows = db
    .prepare(
      `SELECT grid_cell_id, COUNT(*) AS site_count FROM site_geospatial_status WHERE grid_cell_id IS NOT NULL GROUP BY grid_cell_id ORDER BY site_count DESC LIMIT ?`,
    )
    .all(limit) as Array<{ grid_cell_id: string; site_count: number }>;
  return {
    resolution,
    cells: rows.map((row) => ({ cellId: row.grid_cell_id, siteCount: row.site_count, bounds: gridCellBounds(row.grid_cell_id) })),
    limit,
  };
}

export function getCoordinateQualitySummary(db: any) {
  const rows = db
    .prepare(`SELECT coordinate_status, COUNT(*) AS total FROM site_geospatial_status GROUP BY coordinate_status ORDER BY total DESC`)
    .all() as Array<{ coordinate_status: string; total: number }>;
  const totalEvaluated = rows.reduce((sum, row) => sum + row.total, 0);
  return { totalEvaluated, byStatus: rows.map((row) => ({ status: row.coordinate_status, total: row.total })) };
}

export function getSiteGeospatialStatus(db: any, siteId: number) {
  return db.prepare(`SELECT * FROM site_geospatial_status WHERE site_id = ?`).get(siteId) ?? null;
}

// Re-exported so callers that only need the pure math (e.g. a future API
// route validating query params before touching the DB at all) don't have
// to import spatial-query-utils.ts separately -- this module remains the
// single public entry point for WP1.6, even though its implementation is
// split across two files.
export { haversineKm, validateBoundingBox };
