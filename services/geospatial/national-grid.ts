// STAGE 1 -- WP1.5 National Grid.
//
// A deterministic, fixed-cell geographic grid. Given the same (latitude,
// longitude, resolution), gridCellId() always returns the same cell id --
// no randomness, no dependency on insertion order, no dependency on what
// else is in the database. That determinism is what lets grid cells be
// recomputed independently by different processes (or the same process
// twice) and still agree.
//
// This is deliberately NOT geohash and NOT H3. Both are reasonable choices
// in the abstract, but both require either a new runtime dependency (this
// session cannot install and verify a new npm package end-to-end -- see
// docs/stage-1/05_NATIONAL_GRID.md) or a hand-rolled bit-interleaving
// implementation that is easy to get subtly wrong and hard to verify by
// inspection. A fixed-cell grid is simple enough to read, test, and verify
// by hand: divide latitude and longitude into equal-sized bands at a given
// resolution and index a point by which band it falls into. The mission
// spec explicitly allows "fixed-cell/custom" as an alternative to
// geohash/H3, so this is a deliberate, documented choice, not a shortcut.

export const GRID_RESOLUTIONS = [0, 1, 2, 3] as const;
export type GridResolution = (typeof GRID_RESOLUTIONS)[number];

// Cell size in decimal degrees per resolution level. Approximate cell size
// at the equator noted for orientation -- actual east-west size shrinks
// away from the equator because lines of longitude converge, which is a
// known, accepted property of any equirectangular fixed-cell grid (the same
// simplification the rest of this codebase already makes, e.g. the existing
// bounding-box radius approximation "radius / 111" in
// services/enterprise-v3-engine.ts).
export const GRID_CELL_SIZE_DEGREES: Record<GridResolution, number> = {
  0: 1, // ~111km
  1: 0.1, // ~11km
  2: 0.01, // ~1.1km
  3: 0.001, // ~111m
};

export type GridCellBounds = {
  resolution: GridResolution;
  latIndex: number;
  lonIndex: number;
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  centerLatitude: number;
  centerLongitude: number;
};

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isGridResolution(value: unknown): value is GridResolution {
  return typeof value === "number" && (GRID_RESOLUTIONS as readonly number[]).includes(value);
}

// Cell ids are plain, human-readable strings on purpose (e.g. "g2:-1580:-4789")
// -- easy to log, easy to spot-check by hand, easy to parse back with
// parseGridCellId(). No encoding step that could hide a bug.
export function gridCellId(latitude: number, longitude: number, resolution: GridResolution): string | null {
  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) return null;
  const size = GRID_CELL_SIZE_DEGREES[resolution];
  const latIndex = Math.floor(latitude / size);
  const lonIndex = Math.floor(longitude / size);
  return `g${resolution}:${latIndex}:${lonIndex}`;
}

const GRID_CELL_ID_PATTERN = /^g(\d+):(-?\d+):(-?\d+)$/;

export function parseGridCellId(cellId: string): { resolution: GridResolution; latIndex: number; lonIndex: number } | null {
  const match = GRID_CELL_ID_PATTERN.exec(cellId);
  if (!match) return null;
  const resolution = Number(match[1]);
  if (!isGridResolution(resolution)) return null;
  return { resolution, latIndex: Number(match[2]), lonIndex: Number(match[3]) };
}

export function gridCellBounds(cellId: string): GridCellBounds | null {
  const parsed = parseGridCellId(cellId);
  if (!parsed) return null;
  const { resolution, latIndex, lonIndex } = parsed;
  const size = GRID_CELL_SIZE_DEGREES[resolution];
  const minLatitude = latIndex * size;
  const minLongitude = lonIndex * size;
  const maxLatitude = minLatitude + size;
  const maxLongitude = minLongitude + size;
  return {
    resolution,
    latIndex,
    lonIndex,
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
    centerLatitude: (minLatitude + maxLatitude) / 2,
    centerLongitude: (minLongitude + maxLongitude) / 2,
  };
}
