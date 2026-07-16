// STAGE 1 -- WP1.5 National Grid tests.
import { describe, it, expect } from "vitest";
import { gridCellId, parseGridCellId, gridCellBounds, GRID_CELL_SIZE_DEGREES } from "@/services/geospatial/national-grid";

const BRASILIA = { latitude: -15.7942, longitude: -47.8825 };

describe("services/geospatial/national-grid", () => {
  it("is deterministic: same input always returns the same cell id", () => {
    expect(gridCellId(BRASILIA.latitude, BRASILIA.longitude, 2)).toBe(gridCellId(BRASILIA.latitude, BRASILIA.longitude, 2));
  });

  it("returns a different id per resolution for the same point", () => {
    const ids = [0, 1, 2, 3].map((r) => gridCellId(BRASILIA.latitude, BRASILIA.longitude, r as 0 | 1 | 2 | 3));
    expect(new Set(ids).size).toBe(4);
  });

  it("returns null for non-finite coordinates", () => {
    expect(gridCellId(Number.NaN, -47, 1)).toBeNull();
    expect(gridCellId(-15, undefined as unknown as number, 1)).toBeNull();
  });

  it("merges nearby points at coarse resolution but separates them at fine resolution", () => {
    const a = { lat: -15.001, lon: -47.001 };
    const b = { lat: -15.09, lon: -47.09 };
    expect(gridCellId(a.lat, a.lon, 0)).toBe(gridCellId(b.lat, b.lon, 0));
    expect(gridCellId(a.lat, a.lon, 2)).not.toBe(gridCellId(b.lat, b.lon, 2));
  });

  it("parseGridCellId round-trips gridCellId output", () => {
    const id = gridCellId(BRASILIA.latitude, BRASILIA.longitude, 2)!;
    const parsed = parseGridCellId(id);
    expect(parsed).toEqual({
      resolution: 2,
      latIndex: Math.floor(BRASILIA.latitude / 0.01),
      lonIndex: Math.floor(BRASILIA.longitude / 0.01),
    });
  });

  it("rejects malformed or out-of-range cell ids", () => {
    expect(parseGridCellId("not-a-cell-id")).toBeNull();
    expect(parseGridCellId("g9:1:2")).toBeNull();
    expect(parseGridCellId("g1:abc:2")).toBeNull();
  });

  it("gridCellBounds contains the original point and matches the resolution's cell size", () => {
    const id = gridCellId(BRASILIA.latitude, BRASILIA.longitude, 2)!;
    const bounds = gridCellBounds(id)!;
    expect(bounds.minLatitude <= BRASILIA.latitude && BRASILIA.latitude < bounds.maxLatitude).toBe(true);
    expect(bounds.minLongitude <= BRASILIA.longitude && BRASILIA.longitude < bounds.maxLongitude).toBe(true);
    expect(bounds.maxLatitude - bounds.minLatitude).toBeCloseTo(GRID_CELL_SIZE_DEGREES[2], 9);
  });

  it("gridCellBounds returns null for a malformed id", () => {
    expect(gridCellBounds("nope")).toBeNull();
  });
});
