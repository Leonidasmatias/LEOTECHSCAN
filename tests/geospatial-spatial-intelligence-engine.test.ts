// STAGE 1 -- WP1.6 Spatial Intelligence Service -- pure-layer tests.
//
// This file imports ONLY services/geospatial/spatial-query-utils.ts (and,
// transitively, services/geospatial/national-grid.ts) -- both zero-import
// modules with no path to node:sqlite. It deliberately does NOT import
// services/geospatial/spatial-intelligence-engine.ts (the SQLite adapter
// layer), because exercising that layer meaningfully requires a real
// DatabaseSync connection, and a test file that imports node:sqlite
// (directly or transitively) cannot be reliably collected by this
// project's Vitest/Vite pipeline -- the exact failure already documented
// for tests/copernicus-truth.test.ts in docs/stage-0/05_TEST_BASELINE.md,
// and hit again here: "Failed to load url sqlite (resolved id: sqlite)."
//
// See docs/stage-1/08_TEST_RESULTS.md for the full explanation, and
// tests/geospatial-spatial-engine-contract.test.ts for the companion
// source-inspection test proving the adapter layer actually delegates to
// these pure functions rather than reimplementing the same math inline.
// Real, end-to-end SQLite integration behavior (the adapter layer actually
// querying a real database) was verified via a separate Node-native
// harness outside Vitest -- also documented in 08_TEST_RESULTS.md -- run
// against synthetic in-memory databases, a disposable production-size
// database copy, and the live database's own index build.
import { describe, it, expect } from "vitest";
import {
  validateBoundingBox,
  clampLimit,
  haversineKm,
  radiusToBoundingBox,
  withDistances,
  filterWithinRadius,
  excludeAndLimit,
  aggregateIntoGridClusters,
  buildInPlaceholders,
  bboxOverlapParams,
  SITE_SPATIAL_INDEX_BBOX_OVERLAP_SQL,
  chunkArray,
} from "@/services/geospatial/spatial-query-utils";

const BRASILIA = { latitude: -15.7942, longitude: -47.8825 };

describe("services/geospatial/spatial-query-utils -- bounding box validation", () => {
  it("accepts a well-formed bounding box", () => {
    const result = validateBoundingBox({ north: -15, south: -16, east: -47, west: -48 });
    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("rejects north <= south", () => {
    const result = validateBoundingBox({ north: -16, south: -15, east: -47, west: -48 });
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("north"))).toBe(true);
  });

  it("rejects east <= west (antimeridian-crossing boxes, not yet supported)", () => {
    const result = validateBoundingBox({ north: -15, south: -16, east: -48, west: -47 });
    expect(result.valid).toBe(false);
  });

  it("rejects non-finite or out-of-range values", () => {
    expect(validateBoundingBox({ north: Number.NaN, south: -16, east: -47, west: -48 }).valid).toBe(false);
    expect(validateBoundingBox({ north: 200, south: -16, east: -47, west: -48 }).valid).toBe(false);
    expect(validateBoundingBox({ north: -15, south: -16, east: 400, west: -48 }).valid).toBe(false);
  });
});

describe("services/geospatial/spatial-query-utils -- limit normalization", () => {
  it("uses the fallback when nothing is requested", () => {
    expect(clampLimit(undefined, 100, 5000)).toBe(100);
  });

  it("clamps to the max when the request exceeds it", () => {
    expect(clampLimit(999999, 100, 5000)).toBe(5000);
  });

  it("rounds and floors at 1", () => {
    expect(clampLimit(10.6, 100, 5000)).toBe(11);
    expect(clampLimit(-5, 100, 5000)).toBe(1);
  });

  it("falls back for non-finite input", () => {
    expect(clampLimit(Number.NaN, 100, 5000)).toBe(100);
  });
});

describe("services/geospatial/spatial-query-utils -- distance math", () => {
  it("haversineKm returns ~0 for identical points", () => {
    expect(haversineKm(BRASILIA.latitude, BRASILIA.longitude, BRASILIA.latitude, BRASILIA.longitude)).toBeCloseTo(0, 6);
  });

  it("haversineKm returns the known approximate distance between Brasilia and Sao Paulo (~870km)", () => {
    const distance = haversineKm(BRASILIA.latitude, BRASILIA.longitude, -23.5505, -46.6333);
    expect(distance).toBeGreaterThan(850);
    expect(distance).toBeLessThan(900);
  });

  it("radiusToBoundingBox produces a symmetric box around the center using the 111km/degree approximation", () => {
    const bbox = radiusToBoundingBox(BRASILIA, 111);
    expect(bbox.north - BRASILIA.latitude).toBeCloseTo(1, 6);
    expect(BRASILIA.latitude - bbox.south).toBeCloseTo(1, 6);
    expect(bbox.east - BRASILIA.longitude).toBeCloseTo(1, 6);
    expect(BRASILIA.longitude - bbox.west).toBeCloseTo(1, 6);
  });

  it("withDistances attaches a distanceKm to each point without losing other fields", () => {
    const points = [{ id: 1, latitude: BRASILIA.latitude, longitude: BRASILIA.longitude, extra: "kept" }];
    const result = withDistances(BRASILIA, points);
    expect(result[0].extra).toBe("kept");
    expect(result[0].distanceKm).toBeCloseTo(0, 3);
  });

  it("filterWithinRadius excludes points beyond the radius and sorts ascending", () => {
    const points = [
      { id: "far", distanceKm: 900 },
      { id: "near", distanceKm: 1 },
      { id: "mid", distanceKm: 50 },
    ];
    const result = filterWithinRadius(points, 100);
    expect(result.map((p) => p.id)).toEqual(["near", "mid"]);
  });

  it("excludeAndLimit removes the excluded id and truncates to the limit", () => {
    const points = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const result = excludeAndLimit(points, { excludeId: 2, limit: 2 });
    expect(result.map((p) => p.id)).toEqual([1, 3]);
  });

  it("excludeAndLimit with no excludeId just truncates", () => {
    const points = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(excludeAndLimit(points, { limit: 2 }).map((p) => p.id)).toEqual([1, 2]);
  });
});

describe("services/geospatial/spatial-query-utils -- deterministic cluster aggregation", () => {
  const points = [
    { latitude: -15.7942, longitude: -47.8825 },
    { latitude: -15.7945, longitude: -47.8828 },
    { latitude: -23.5505, longitude: -46.6333 },
  ];

  it("groups nearby points into the same cell and keeps distant ones separate", () => {
    const clusters = aggregateIntoGridClusters(points, 1); // ~11km cells
    const totalCount = clusters.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBe(3);
    expect(clusters.length).toBe(2); // the two Brasilia points share a cell, Sao Paulo is separate
  });

  it("is order-independent: shuffled input produces the same clusters", () => {
    const shuffled = [points[2], points[0], points[1]];
    const a = aggregateIntoGridClusters(points, 1).sort((x, y) => x.cellId.localeCompare(y.cellId));
    const b = aggregateIntoGridClusters(shuffled, 1).sort((x, y) => x.cellId.localeCompare(y.cellId));
    expect(b).toEqual(a);
  });

  it("computes a cluster center as the mean of its member points", () => {
    const clusters = aggregateIntoGridClusters([points[0], points[1]], 1);
    expect(clusters.length).toBe(1);
    const expectedLat = (points[0].latitude + points[1].latitude) / 2;
    expect(clusters[0].centerLatitude).toBeCloseTo(expectedLat, 5);
  });

  it("returns an empty array for no points", () => {
    expect(aggregateIntoGridClusters([], 1)).toEqual([]);
  });
});

describe("services/geospatial/spatial-query-utils -- SQL parameter/contract construction (text only, no DB)", () => {
  it("buildInPlaceholders produces the right number of comma-separated placeholders", () => {
    expect(buildInPlaceholders(3)).toBe("?,?,?");
    expect(buildInPlaceholders(1)).toBe("?");
    expect(buildInPlaceholders(0)).toBe("");
  });

  it("bboxOverlapParams orders parameters to match SITE_SPATIAL_INDEX_BBOX_OVERLAP_SQL's placeholders", () => {
    const bbox = { north: -15, south: -16, east: -47, west: -48 };
    expect(bboxOverlapParams(bbox)).toEqual([-15, -16, -47, -48]);
    // The SQL text's ? order is minLat<=north, maxLat>=south, minLon<=east, maxLon>=west --
    // this pins the contract between the two so a change to one is caught by this test.
    expect(SITE_SPATIAL_INDEX_BBOX_OVERLAP_SQL).toContain("minLat <= ? AND maxLat >= ? AND minLon <= ? AND maxLon >= ?");
  });
});

describe("services/geospatial/spatial-query-utils -- chunkArray (SQL variable-count-safe batching)", () => {
  // Checkpoint 3 finding: an id IN (?, ?, ...) query built directly from a
  // large candidate-id list hit SQLite's own "too many SQL variables" error
  // once the list passed the SQLite build's SQLITE_MAX_VARIABLE_NUMBER
  // (empirically 32,766 for the Node build this was measured against, but
  // as low as 999 on SQLite versions before 3.32.0) -- see
  // docs/stage-1/07_GEOSPATIAL_APIS.md. chunkArray() is what
  // spatial-intelligence-engine.ts's sitesByIds()/coordinatesByIds() use to
  // stay safely under that ceiling regardless of which SQLite build is
  // actually running.
  it("splits evenly when the array length is a multiple of the chunk size", () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("puts the remainder in a final, smaller chunk", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when chunkSize exceeds the array length", () => {
    expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it("every id in the input appears in exactly one chunk, in original order (no drops, no duplicates)", () => {
    const ids = Array.from({ length: 2537 }, (_, i) => i);
    const chunks = chunkArray(ids, 900);
    expect(chunks.length).toBe(3);
    expect(chunks.every((chunk) => chunk.length <= 900)).toBe(true);
    expect(chunks.flat()).toEqual(ids);
  });
});
