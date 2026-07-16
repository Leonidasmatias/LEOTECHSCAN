// STAGE 1 -- WP1.2 Coordinate Quality Engine tests.
import { describe, it, expect } from "vitest";
import {
  evaluateCoordinateQuality,
  COORDINATE_QUALITY_ALGORITHM_VERSION,
  type CoordinateStatus,
} from "@/services/geospatial/coordinate-quality-engine";

const FIXED_NOW = () => "2026-07-15T00:00:00.000Z";
const BRASILIA = { latitude: -15.7942, longitude: -47.8825 };

function statusOf(input: Parameters<typeof evaluateCoordinateQuality>[0]): CoordinateStatus {
  return evaluateCoordinateQuality(input, FIXED_NOW).status;
}

describe("services/geospatial/coordinate-quality-engine", () => {
  it("classifies a normal, unambiguous Brazilian coordinate as valid and eligible for both mapping and Sentinel", () => {
    const result = evaluateCoordinateQuality(BRASILIA, FIXED_NOW);
    expect(result.status).toBe("valid");
    expect(result.eligibleForMapping).toBe(true);
    expect(result.eligibleForSentinel).toBe(true);
    expect(result.confidence).toBe(1);
    expect(result.reasons).toEqual([]);
    expect(result.evaluatedAt).toBe("2026-07-15T00:00:00.000Z");
    expect(result.algorithmVersion).toBe(COORDINATE_QUALITY_ALGORITHM_VERSION);
  });

  it("classifies missing latitude and/or longitude as missing, ineligible for anything", () => {
    expect(statusOf({ latitude: null, longitude: -47 })).toBe("missing");
    expect(statusOf({ latitude: -15, longitude: undefined })).toBe("missing");
    expect(statusOf({ latitude: null, longitude: null })).toBe("missing");
    const result = evaluateCoordinateQuality({ latitude: null, longitude: null }, FIXED_NOW);
    expect(result.eligibleForMapping).toBe(false);
    expect(result.eligibleForSentinel).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("classifies out-of-range latitude/longitude as invalid_latitude / invalid_longitude", () => {
    expect(statusOf({ latitude: 120, longitude: -47 })).toBe("invalid_latitude");
    expect(statusOf({ latitude: -15, longitude: 300 })).toBe("invalid_longitude");
  });

  it("classifies an identical (non-zero) latitude/longitude pair as invalid_pair", () => {
    expect(statusOf({ latitude: -20, longitude: -20 })).toBe("invalid_pair");
  });

  it("classifies (0, 0) as zero_coordinate, not invalid_pair", () => {
    expect(statusOf({ latitude: 0, longitude: 0 })).toBe("zero_coordinate");
  });

  it("classifies a coordinate outside the Brazil bounding box as outside_brazil", () => {
    expect(statusOf({ latitude: 40.7128, longitude: -74.006 })).toBe("outside_brazil"); // New York
  });

  it("classifies a suspected lat/lon swap as suspicious rather than outside_brazil", () => {
    // Brasilia's pair, swapped.
    const result = evaluateCoordinateQuality({ latitude: -47.8825, longitude: -15.7942 }, FIXED_NOW);
    expect(result.status).toBe("suspicious");
    expect(result.eligibleForSentinel).toBe(false);
    expect(result.eligibleForMapping).toBe(true);
  });

  it("classifies a near-border coordinate as requires_review", () => {
    const result = evaluateCoordinateQuality({ latitude: 5.95, longitude: -47 }, FIXED_NOW);
    expect(result.status).toBe("requires_review");
  });

  it("flags duplicate_exact when the caller supplies isDuplicateExact, without querying anything itself", () => {
    const result = evaluateCoordinateQuality({ ...BRASILIA, isDuplicateExact: true }, FIXED_NOW);
    expect(result.status).toBe("duplicate_exact");
    expect(result.eligibleForMapping).toBe(true);
    expect(result.eligibleForSentinel).toBe(false);
  });

  it("flags duplicate_dense when the caller supplies isDuplicateDense", () => {
    const result = evaluateCoordinateQuality({ ...BRASILIA, isDuplicateDense: true }, FIXED_NOW);
    expect(result.status).toBe("duplicate_dense");
    expect(result.eligibleForSentinel).toBe(false);
  });

  it("prioritizes duplicate_exact over duplicate_dense when both are supplied, but still warns about the other", () => {
    const result = evaluateCoordinateQuality({ ...BRASILIA, isDuplicateExact: true, isDuplicateDense: true }, FIXED_NOW);
    expect(result.status).toBe("duplicate_exact");
    expect(result.warnings.some((w) => w.includes("agrupamento denso"))).toBe(true);
  });

  it("never mutates the input coordinate -- classification only, no auto-correction", () => {
    const input = { latitude: -47.8825, longitude: -15.7942 };
    const before = JSON.stringify(input);
    evaluateCoordinateQuality(input, FIXED_NOW);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("defaults evaluatedAt to a real ISO timestamp when no clock override is supplied", () => {
    const result = evaluateCoordinateQuality(BRASILIA);
    expect(() => new Date(result.evaluatedAt).toISOString()).not.toThrow();
  });
});
