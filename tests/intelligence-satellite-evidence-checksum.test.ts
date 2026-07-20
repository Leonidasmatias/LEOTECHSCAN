// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 4.
// Behavioral and source-inspection tests for
// services/intelligence-adapters/satellite-evidence-checksum.ts, per
// docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md
// Section 9.7: determinism, versioned SHA-256 representation, content-sensitivity,
// non-mutation, no time/random dependency.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { computeSatelliteEvidenceChecksum } from "@/services/intelligence-adapters/satellite-evidence-checksum";
import type { SatelliteObservation } from "@/services/intelligence-adapters/satellite-observation-model";

const CHECKSUM_FILE = path.resolve(__dirname, "..", "services", "intelligence-adapters", "satellite-evidence-checksum.ts");

function baseObservation(overrides: Partial<SatelliteObservation> = {}): SatelliteObservation {
  return {
    observationId: "observation:42:S1A_IW_GRDH_1SDV_20251201T000000",
    observationType: "sar_scene_metadata",
    provider: {
      providerCode: "copernicus-legacy-simulated",
      dataset: "Sentinel-1 GRD",
      sourceType: "sar",
      retrievedAt: "2026-01-01T00:00:00.000Z",
    },
    spatial: {
      siteCoordinates: { latitude: -23.55, longitude: -46.63 },
      requestedRadiusKm: 2,
      coordinateEligibility: "eligible",
      coordinateStatus: "valid",
    },
    temporal: {
      captureTime: "2025-12-01T00:00:00.000Z",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      imageryAgeDays: 31,
      freshness: "recent",
    },
    quality: {
      cloudCoveragePercent: null,
      noDataCoveragePercent: 0,
      spatialResolutionMeters: 10,
      sourceConfidence: 0.8,
      qualityClassification: "high",
      usable: true,
    },
    derivationMethod: "copernicus-legacy-simulated:v1",
    evidenceId: "evidence-id-for:S1A_IW_GRDH_1SDV_20251201T000000",
    limitations: ["Cloud coverage not reported by this source."],
    ...overrides,
  };
}

describe("Increment 10 Wave 4: file exists", () => {
  it("satellite-evidence-checksum.ts exists at the frozen path", () => {
    expect(fs.existsSync(CHECKSUM_FILE)).toBe(true);
  });
});

describe("Increment 10 Wave 4: checksum determinism", () => {
  it("produces exactly the same checksum across repeated calls with identical input", () => {
    const observation = baseObservation();
    const first = computeSatelliteEvidenceChecksum(observation);
    const second = computeSatelliteEvidenceChecksum(observation);
    const third = computeSatelliteEvidenceChecksum(baseObservation());
    expect(first).toBe(second);
    expect(first).toBe(third);
  });

  it("is insensitive to the property construction order of the input object", () => {
    const observation = baseObservation();
    const reordered: SatelliteObservation = {
      limitations: observation.limitations,
      evidenceId: observation.evidenceId,
      derivationMethod: observation.derivationMethod,
      quality: { ...observation.quality },
      temporal: { ...observation.temporal },
      spatial: { ...observation.spatial },
      provider: { ...observation.provider },
      observationType: observation.observationType,
      observationId: observation.observationId,
    };
    expect(computeSatelliteEvidenceChecksum(reordered)).toBe(computeSatelliteEvidenceChecksum(observation));
  });
});

describe("Increment 10 Wave 4: versioned SHA-256 representation", () => {
  it("carries the sha256-v1: prefix followed by a 64-character lowercase hex digest", () => {
    const checksum = computeSatelliteEvidenceChecksum(baseObservation());
    expect(checksum.startsWith("sha256-v1:")).toBe(true);
    const digest = checksum.slice("sha256-v1:".length);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Increment 10 Wave 4: content sensitivity", () => {
  it("changes when observationId changes", () => {
    const a = computeSatelliteEvidenceChecksum(baseObservation());
    const b = computeSatelliteEvidenceChecksum(baseObservation({ observationId: "observation:99:other-scene" }));
    expect(a).not.toBe(b);
  });

  it("changes when cloudCoveragePercent changes from null to a reported value", () => {
    const a = computeSatelliteEvidenceChecksum(baseObservation());
    const b = computeSatelliteEvidenceChecksum(
      baseObservation({ quality: { ...baseObservation().quality, cloudCoveragePercent: 37 } }),
    );
    expect(a).not.toBe(b);
  });

  it("changes when freshness classification changes", () => {
    const a = computeSatelliteEvidenceChecksum(baseObservation());
    const b = computeSatelliteEvidenceChecksum(
      baseObservation({ temporal: { ...baseObservation().temporal, freshness: "stale" } }),
    );
    expect(a).not.toBe(b);
  });

  it("changes when limitations content changes", () => {
    const a = computeSatelliteEvidenceChecksum(baseObservation());
    const b = computeSatelliteEvidenceChecksum(baseObservation({ limitations: [] }));
    expect(a).not.toBe(b);
  });

  it("distinguishes a null numeric field from a reported zero", () => {
    const withZero = computeSatelliteEvidenceChecksum(
      baseObservation({ quality: { ...baseObservation().quality, spatialResolutionMeters: 0 } }),
    );
    const withNull = computeSatelliteEvidenceChecksum(
      baseObservation({ quality: { ...baseObservation().quality, spatialResolutionMeters: null } }),
    );
    expect(withZero).not.toBe(withNull);
  });

  it("does not change when evidenceId alone changes (excluded from the content fingerprint)", () => {
    const a = computeSatelliteEvidenceChecksum(baseObservation());
    const b = computeSatelliteEvidenceChecksum(baseObservation({ evidenceId: "evidence-id-for:completely-different" }));
    expect(a).toBe(b);
  });
});

describe("Increment 10 Wave 4: non-mutation and no exception", () => {
  it("never mutates the observation it is given", () => {
    const observation = baseObservation();
    const snapshot = JSON.parse(JSON.stringify(observation));
    computeSatelliteEvidenceChecksum(observation);
    expect(observation).toEqual(snapshot);
  });

  it("never throws for a contract-valid observation", () => {
    expect(() => computeSatelliteEvidenceChecksum(baseObservation())).not.toThrow();
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 10 Wave 4: determinism and dependency-boundary source inspection", () => {
  const source = stripComments(fs.readFileSync(CHECKSUM_FILE, "utf8"));

  it("has no Date.now(), Math.random(), or crypto.randomUUID()", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
  });

  it("imports only node:crypto and the sibling observation model", () => {
    const importLines = source.match(/^import[^\n]*$/gm) ?? [];
    for (const line of importLines) {
      expect(line).toMatch(/node:crypto|satellite-observation-model/);
    }
  });

  it("does not import node:sqlite, @/lib/db, next, or next/server", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/@\/lib\/db/);
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/from\s*["']next["']/);
  });

  it("does not import any legacy Copernicus module or engine", () => {
    expect(source).not.toMatch(/copernicus-engine/);
    expect(source).not.toMatch(/copernicus-truth/);
    expect(source).not.toMatch(/from\s*["'][^"']*-engine[^"']*["']/);
  });

  it("does not import the pre-existing Increment 8 evidence-checksum implementation", () => {
    expect(source).not.toMatch(/["']\.\/evidence-checksum["']/);
  });

  it("uses createHash from node:crypto", () => {
    expect(source).toMatch(/createHash/);
    expect(source).toMatch(/from\s*["']node:crypto["']/);
  });
});
