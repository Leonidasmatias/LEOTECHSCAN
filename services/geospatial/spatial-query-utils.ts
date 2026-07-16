// STAGE 1 -- Pure, dependency-free geospatial query-shaping helpers.
//
// This module has ZERO imports of node:sqlite (directly or transitively) --
// verified by inspection: it imports only from
// services/geospatial/national-grid.ts, which is itself dependency-free.
// This is the exact same isolation pattern Stage 0 used for
// services/copernicus-truth.ts after tests/copernicus-truth.test.ts hit a
// Vitest/Vite collection failure trying to resolve node:sqlite through a
// transitive import (see docs/stage-0/05_TEST_BASELINE.md's "Follow-up"
// sections, and docs/stage-1/08_TEST_RESULTS.md for this stage's version of
// the same fix).
//
// Everything here is pure: same input always produces the same output, no
// I/O, no database connection, no mutation of its arguments. That is what
// lets tests/geospatial-spatial-query-utils.test.ts exercise all of it with
// plain objects and arrays -- no real or fake database required.
//
// services/geospatial/spatial-intelligence-engine.ts (the SQLite adapter
// layer) imports and calls these functions rather than reimplementing the
// same math inline -- confirmed by tests/geospatial-spatial-engine-contract.test.ts,
// a source-inspection test that never imports the adapter as a module.
import { gridCellId, gridCellBounds, type GridResolution, type GridCellBounds } from "@/services/geospatial/national-grid";

export const EARTH_RADIUS_KM = 6371;

export type BoundingBox = { north: number; south: number; east: number; west: number };

export type LatLon = { latitude: number; longitude: number };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// --- bounding box validation ---

export type BoundingBoxValidation = { valid: boolean; reasons: string[] };

export function validateBoundingBox(bbox: BoundingBox): BoundingBoxValidation {
  const reasons: string[] = [];
  const { north, south, east, west } = bbox;
  if (![north, south, east, west].every(isFiniteNumber)) {
    reasons.push("north/south/east/west devem ser numeros finitos.");
    return { valid: false, reasons };
  }
  if (north < -90 || north > 90) reasons.push("north fora do intervalo -90..90.");
  if (south < -90 || south > 90) reasons.push("south fora do intervalo -90..90.");
  if (east < -180 || east > 180) reasons.push("east fora do intervalo -180..180.");
  if (west < -180 || west > 180) reasons.push("west fora do intervalo -180..180.");
  if (north <= south) reasons.push("north deve ser maior que south.");
  // Antimeridian-crossing boxes (west > east) are not yet supported -- flagged
  // explicitly rather than silently mishandled. WP1.7 documents this same
  // limitation for the viewport API.
  if (east <= west) reasons.push("east deve ser maior que west (bounding boxes cruzando o antimeridiano ainda nao sao suportados).");
  return { valid: reasons.length === 0, reasons };
}

// --- limit normalization ---

export function clampLimit(requested: number | undefined, fallback: number, max: number): number {
  const value = isFiniteNumber(requested) ? requested : fallback;
  return Math.max(1, Math.min(max, Math.round(value)));
}

// --- distance math ---

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const lat1 = aLat * rad;
  const lat2 = bLat * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Same coarse degrees-per-km approximation already used by
// services/enterprise-v3-engine.ts ("radius / 111") -- reused rather than
// reinvented, for the same single-source-of-truth reasoning as the Brazil
// bounding box in services/geospatial/brazil-bounds.ts.
export function radiusToBoundingBox(center: LatLon, radiusKm: number): BoundingBox {
  const box = radiusKm / 111;
  return {
    north: center.latitude + box,
    south: center.latitude - box,
    east: center.longitude + box,
    west: center.longitude - box,
  };
}

export function withDistances<T extends LatLon>(center: LatLon, points: T[]): Array<T & { distanceKm: number }> {
  return points.map((point) => ({
    ...point,
    distanceKm: Number(haversineKm(center.latitude, center.longitude, point.latitude, point.longitude).toFixed(3)),
  }));
}

// Filters to only points within radiusKm and sorts ascending by distance.
// Does not truncate to a limit -- that is a separate, explicit step
// (excludeAndLimit) so callers can tell "matched but truncated" apart from
// "didn't match."
export function filterWithinRadius<T extends { distanceKm: number }>(pointsWithDistance: T[], radiusKm: number): T[] {
  return pointsWithDistance.filter((point) => point.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
}

export function excludeAndLimit<T extends { id?: unknown }>(
  points: T[],
  options: { excludeId?: unknown; limit: number },
): T[] {
  const filtered = options.excludeId === undefined ? points : points.filter((point) => point.id !== options.excludeId);
  return filtered.slice(0, options.limit);
}

// --- clustering ---

export type GridCluster = {
  cellId: string;
  count: number;
  centerLatitude: number;
  centerLongitude: number;
  bounds: GridCellBounds | null;
};

// Deterministic: does not depend on input order (accumulates unordered into
// a map keyed by cell id, only the final Array.from() ordering depends on
// Map iteration order, which does not affect any cluster's own count or
// center -- verified by a dedicated test with shuffled input).
export function aggregateIntoGridClusters(points: LatLon[], resolution: GridResolution): GridCluster[] {
  const clusters = new Map<string, { cellId: string; count: number; latitudeSum: number; longitudeSum: number }>();
  for (const point of points) {
    const cellId = gridCellId(point.latitude, point.longitude, resolution);
    if (!cellId) continue;
    const existing = clusters.get(cellId) ?? { cellId, count: 0, latitudeSum: 0, longitudeSum: 0 };
    existing.count += 1;
    existing.latitudeSum += point.latitude;
    existing.longitudeSum += point.longitude;
    clusters.set(cellId, existing);
  }
  return Array.from(clusters.values()).map((cluster) => ({
    cellId: cluster.cellId,
    count: cluster.count,
    centerLatitude: Number((cluster.latitudeSum / cluster.count).toFixed(6)),
    centerLongitude: Number((cluster.longitudeSum / cluster.count).toFixed(6)),
    bounds: gridCellBounds(cluster.cellId),
  }));
}

// --- SQL parameter/contract construction (text only -- never opens a DB) ---

export function buildInPlaceholders(count: number): string {
  return Array.from({ length: Math.max(0, count) }, () => "?").join(",");
}

// The exact bounding-box overlap predicate used against site_spatial_index
// (an R-Tree table) -- extracted as a named, testable constant so the
// adapter layer and any future caller always use the identical SQL text
// rather than each hand-writing their own slightly-different version.
export const SITE_SPATIAL_INDEX_BBOX_OVERLAP_SQL =
  "SELECT id FROM site_spatial_index WHERE minLat <= ? AND maxLat >= ? AND minLon <= ? AND maxLon >= ?";

// Parameter order for SITE_SPATIAL_INDEX_BBOX_OVERLAP_SQL, given a
// BoundingBox -- pure text/array construction, no DB access.
export function bboxOverlapParams(bbox: BoundingBox): [number, number, number, number] {
  return [bbox.north, bbox.south, bbox.east, bbox.west];
}

// --- SQL variable-count-safe chunking (array manipulation only, never opens a DB) ---

// SQLite enforces a maximum number of bound parameters per prepared
// statement (SQLITE_MAX_VARIABLE_NUMBER) -- historically 999 in SQLite
// versions before 3.32.0 (2020-05), 32,766 by default since. Checkpoint 3's
// own honest performance run against a real node:sqlite database confirmed
// this build's ceiling is 32,766 -- but a production `sites` table query
// built from an `id IN (?, ?, ...)` list must not assume that particular
// ceiling everywhere this application might ever run (a different SQLite
// build, e.g. one compiled before 3.32.0, would silently fail with "too
// many SQL variables" once the candidate-id list is large enough).
// chunkArray() splits an arbitrarily large id list into safe fixed-size
// batches for exactly that reason -- see MAX_SQL_IN_CLAUSE_SIZE in
// spatial-intelligence-engine.ts, which is the only caller.
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return items.length === 0 ? [] : [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
