// STAGE 1 -- WP1.7-1.10 Geospatial APIs -- pure request-parsing tests.
//
// Imports ONLY services/geospatial/request-params.ts (and, transitively,
// spatial-query-utils.ts / national-grid.ts -- both zero-import modules).
// No node:sqlite anywhere in this file's import graph. Exercises the
// "strict request validation" requirement (Checkpoint 3, requirement 2)
// directly: every required parameter must be rejected with a reason when
// missing, non-numeric, or out of range, and optional parameters must fall
// back to their documented default rather than erroring.
import { describe, it, expect } from "vitest";
import {
  parseBoundingBox,
  parseLatLon,
  parseRadiusKm,
  parseResolution,
  parseOptionalPositiveInt,
} from "@/services/geospatial/request-params";

function qs(pairs: Record<string, string>): URLSearchParams {
  return new URLSearchParams(pairs);
}

describe("parseBoundingBox", () => {
  it("accepts a well-formed bounding box", () => {
    const result = parseBoundingBox(qs({ north: "-15", south: "-16", east: "-47", west: "-48" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ north: -15, south: -16, east: -47, west: -48 });
  });

  it("rejects a missing required param instead of coercing it to 0", () => {
    const result = parseBoundingBox(qs({ south: "-16", east: "-47", west: "-48" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("north"))).toBe(true);
  });

  it("rejects a non-numeric param", () => {
    const result = parseBoundingBox(qs({ north: "abc", south: "-16", east: "-47", west: "-48" }));
    expect(result.ok).toBe(false);
  });

  it("rejects north <= south (delegates to validateBoundingBox)", () => {
    const result = parseBoundingBox(qs({ north: "-16", south: "-15", east: "-47", west: "-48" }));
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-range latitude", () => {
    const result = parseBoundingBox(qs({ north: "200", south: "-16", east: "-47", west: "-48" }));
    expect(result.ok).toBe(false);
  });
});

describe("parseLatLon", () => {
  it("accepts a well-formed center point", () => {
    const result = parseLatLon(qs({ lat: "-15.7942", lon: "-47.8825" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ latitude: -15.7942, longitude: -47.8825 });
  });

  it("rejects a missing lat", () => {
    const result = parseLatLon(qs({ lon: "-47.8825" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("lat"))).toBe(true);
  });

  it("rejects an out-of-range latitude", () => {
    const result = parseLatLon(qs({ lat: "95", lon: "-47.8825" }));
    expect(result.ok).toBe(false);
  });

  it("rejects an out-of-range longitude", () => {
    const result = parseLatLon(qs({ lat: "-15.7942", lon: "-200" }));
    expect(result.ok).toBe(false);
  });

  it("reports both errors when both lat and lon are missing", () => {
    const result = parseLatLon(qs({}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("lat"))).toBe(true);
      expect(result.errors.some((e) => e.includes("lon"))).toBe(true);
    }
  });
});

describe("parseRadiusKm", () => {
  it("falls back to the default when absent", () => {
    const result = parseRadiusKm(qs({}), { fallback: 10, max: 300 });
    expect(result).toEqual({ ok: true, value: 10 });
  });

  it("accepts a valid positive radius under the max", () => {
    const result = parseRadiusKm(qs({ radiusKm: "50" }), { fallback: 10, max: 300 });
    expect(result).toEqual({ ok: true, value: 50 });
  });

  it("rejects zero and negative radii", () => {
    expect(parseRadiusKm(qs({ radiusKm: "0" }), { fallback: 10, max: 300 }).ok).toBe(false);
    expect(parseRadiusKm(qs({ radiusKm: "-5" }), { fallback: 10, max: 300 }).ok).toBe(false);
  });

  it("rejects a radius exceeding the max (does not silently clamp)", () => {
    const result = parseRadiusKm(qs({ radiusKm: "5000" }), { fallback: 10, max: 300 });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric radius", () => {
    expect(parseRadiusKm(qs({ radiusKm: "far" }), { fallback: 10, max: 300 }).ok).toBe(false);
  });
});

describe("parseResolution", () => {
  it("falls back to the default when absent", () => {
    expect(parseResolution(qs({}), 1)).toEqual({ ok: true, value: 1 });
  });

  it("accepts every supported resolution value", () => {
    for (const resolution of [0, 1, 2, 3]) {
      expect(parseResolution(qs({ resolution: String(resolution) }), 1)).toEqual({ ok: true, value: resolution });
    }
  });

  it("rejects an unsupported resolution value", () => {
    expect(parseResolution(qs({ resolution: "4" }), 1).ok).toBe(false);
    expect(parseResolution(qs({ resolution: "-1" }), 1).ok).toBe(false);
    expect(parseResolution(qs({ resolution: "1.5" }), 1).ok).toBe(false);
  });
});

describe("parseOptionalPositiveInt", () => {
  it("returns undefined when absent", () => {
    expect(parseOptionalPositiveInt(qs({}), "limit")).toEqual({ ok: true, value: undefined });
  });

  it("floors a valid positive decimal", () => {
    expect(parseOptionalPositiveInt(qs({ limit: "10.9" }), "limit")).toEqual({ ok: true, value: 10 });
  });

  it("rejects zero, negative, and non-numeric values", () => {
    expect(parseOptionalPositiveInt(qs({ limit: "0" }), "limit").ok).toBe(false);
    expect(parseOptionalPositiveInt(qs({ limit: "-3" }), "limit").ok).toBe(false);
    expect(parseOptionalPositiveInt(qs({ limit: "many" }), "limit").ok).toBe(false);
  });
});
