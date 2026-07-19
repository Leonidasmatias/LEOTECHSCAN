// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 2.
// Behavioral and source-inspection tests for
// services/intelligence-adapters/satellite-observation-adapter.ts, per
// docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md
// Section 8 (Wave 2): quality/freshness classification boundaries,
// cloud-coverage-null handling, missing-sourceSceneId exclusion.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  adaptSatelliteProviderScene,
  type SatelliteObservationAdapterContext,
} from "@/services/intelligence-adapters/satellite-observation-adapter";
import type { SatelliteProviderScene, SatelliteProviderQualitySummary } from "@/services/intelligence-runtime/satellite-intelligence-provider-port";
import type { SatelliteObservation } from "@/services/intelligence-adapters/satellite-observation-model";

const ADAPTER_FILE = path.resolve(__dirname, "..", "services", "intelligence-adapters", "satellite-observation-adapter.ts");

const FIXED_NOW = "2026-01-01T00:00:00.000Z";

function baseScene(overrides: Partial<SatelliteProviderScene> = {}): SatelliteProviderScene {
  return {
    sourceSceneId: "S1A_IW_GRDH_1SDV_20251201T000000",
    capturedAt: "2025-12-01T00:00:00.000Z", // 31 days before FIXED_NOW
    publishedAt: "2025-12-01T01:00:00.000Z",
    retrievedAt: FIXED_NOW,
    spatialResolutionMeters: 10,
    cloudCoveragePercent: null,
    noDataCoveragePercent: 0,
    coverage: { footprintDescription: "site-centered footprint", radiusKm: 2 },
    sourceAttributes: {},
    ...overrides,
  };
}

function baseQualitySummary(overrides: Partial<SatelliteProviderQualitySummary> = {}): SatelliteProviderQualitySummary {
  return { overallScore: 0.8, overallClassification: "high", ...overrides };
}

function baseContext(overrides: Partial<SatelliteObservationAdapterContext> = {}): SatelliteObservationAdapterContext {
  return {
    siteId: 42,
    latitude: -23.55,
    longitude: -46.63,
    radiusKm: 2,
    providerCode: "copernicus-legacy-simulated",
    dataset: "Sentinel-1 GRD",
    sourceType: "sar",
    maximumImageryAgeDays: 45,
    qualitySummary: baseQualitySummary(),
    deriveEvidenceId: (sourceSceneId: string) => `evidence-id-for:${sourceSceneId}`,
    ...overrides,
  };
}

function now(): string {
  return FIXED_NOW;
}

function isObservation(result: unknown): result is SatelliteObservation {
  return !!result && typeof result === "object" && !("excluded" in (result as Record<string, unknown>));
}

describe("Increment 10 Wave 2: file exists", () => {
  it("satellite-observation-adapter.ts exists at the frozen path", () => {
    expect(fs.existsSync(ADAPTER_FILE)).toBe(true);
  });
});

describe("Increment 10 Wave 2: missing sourceSceneId exclusion", () => {
  it("excludes a scene with sourceSceneId: null, never fabricating an identifier", () => {
    const scene = baseScene({ sourceSceneId: null });
    const result = adaptSatelliteProviderScene(scene, baseContext(), now);
    expect(isObservation(result)).toBe(false);
    if (!isObservation(result)) {
      expect(result.excluded).toBe(true);
      expect(result.issue.code).toBe("missing_scene_id");
      expect(result.issue.stage).toBe("observation");
      expect(result.issue.severity).toBe("significant");
      expect(result.issue.canContinue).toBe(true);
    }
  });

  it("adapts a scene with a non-null sourceSceneId normally", () => {
    const result = adaptSatelliteProviderScene(baseScene(), baseContext(), now);
    expect(isObservation(result)).toBe(true);
  });
});

describe("Increment 10 Wave 2: freshness classification boundaries", () => {
  it("classifies exactly at the 45-day threshold as recent", () => {
    const capturedAt = new Date(Date.parse(FIXED_NOW) - 45 * 86_400_000).toISOString();
    const result = adaptSatelliteProviderScene(baseScene({ capturedAt }), baseContext({ maximumImageryAgeDays: 45 }), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.temporal.imageryAgeDays).toBe(45);
      expect(result.temporal.freshness).toBe("recent");
    }
  });

  it("classifies one day past the threshold as stale", () => {
    const capturedAt = new Date(Date.parse(FIXED_NOW) - 46 * 86_400_000).toISOString();
    const result = adaptSatelliteProviderScene(baseScene({ capturedAt }), baseContext({ maximumImageryAgeDays: 45 }), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.temporal.imageryAgeDays).toBe(46);
      expect(result.temporal.freshness).toBe("stale");
    }
  });

  it("classifies freshness as unknown, with a null imageryAgeDays, when capturedAt is null", () => {
    const result = adaptSatelliteProviderScene(baseScene({ capturedAt: null }), baseContext(), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.temporal.captureTime).toBeNull();
      expect(result.temporal.imageryAgeDays).toBeNull();
      expect(result.temporal.freshness).toBe("unknown");
    }
  });

  it("classifies freshness as unknown when the threshold itself is null, even with a known captureTime", () => {
    const result = adaptSatelliteProviderScene(baseScene(), baseContext({ maximumImageryAgeDays: null }), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.temporal.imageryAgeDays).not.toBeNull();
      expect(result.temporal.freshness).toBe("unknown");
    }
  });
});

describe("Increment 10 Wave 2: cloud-coverage-null handling (provider-neutral passthrough)", () => {
  it("passes through cloudCoveragePercent: null verbatim, never fabricating a value", () => {
    const result = adaptSatelliteProviderScene(baseScene({ cloudCoveragePercent: null }), baseContext(), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.quality.cloudCoveragePercent).toBeNull();
    }
  });

  it("passes through a non-null cloudCoveragePercent verbatim, unchanged", () => {
    const result = adaptSatelliteProviderScene(baseScene({ cloudCoveragePercent: 37 }), baseContext(), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.quality.cloudCoveragePercent).toBe(37);
    }
  });

  it("passes through a null spatialResolutionMeters verbatim, never fabricating a value", () => {
    const result = adaptSatelliteProviderScene(baseScene({ spatialResolutionMeters: null }), baseContext(), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.quality.spatialResolutionMeters).toBeNull();
    }
  });
});

describe("Increment 10 Wave 2: quality classification passthrough", () => {
  it("reuses the batch-level overallClassification/overallScore verbatim, never re-deriving a new formula", () => {
    const result = adaptSatelliteProviderScene(
      baseScene(),
      baseContext({ qualitySummary: baseQualitySummary({ overallClassification: "medium", overallScore: 0.55 }) }),
      now,
    );
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.quality.qualityClassification).toBe("medium");
      expect(result.quality.sourceConfidence).toBe(0.55);
      expect(result.quality.usable).toBe(true);
    }
  });

  it("marks usable: false only when qualityClassification is insufficient", () => {
    const result = adaptSatelliteProviderScene(
      baseScene(),
      baseContext({ qualitySummary: baseQualitySummary({ overallClassification: "insufficient", overallScore: 0.1 }) }),
      now,
    );
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.quality.qualityClassification).toBe("insufficient");
      expect(result.quality.usable).toBe(false);
    }
  });
});

describe("Increment 10 Wave 2: coordinate eligibility (reuses evaluateCoordinateQuality verbatim)", () => {
  it("marks a valid Brazilian coordinate as eligible", () => {
    const result = adaptSatelliteProviderScene(baseScene(), baseContext({ latitude: -23.55, longitude: -46.63 }), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.spatial.coordinateEligibility).toBe("eligible");
      expect(result.spatial.coordinateStatus).toBe("valid");
    }
  });

  it("marks a zeroed coordinate as ineligible", () => {
    const result = adaptSatelliteProviderScene(baseScene(), baseContext({ latitude: 0, longitude: 0 }), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.spatial.coordinateEligibility).toBe("ineligible");
      expect(result.spatial.coordinateStatus).toBe("zero_coordinate");
    }
  });

  it("marks a coordinate outside Brazil as ineligible", () => {
    const result = adaptSatelliteProviderScene(baseScene(), baseContext({ latitude: 51.5, longitude: -0.12 }), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.spatial.coordinateEligibility).toBe("ineligible");
      expect(result.spatial.coordinateStatus).toBe("outside_brazil");
    }
  });
});

describe("Increment 10 Wave 2: identity, evidenceId, and limitations", () => {
  it("builds observationId from siteId + sourceSceneId, and evidenceId via the injected deriveEvidenceId", () => {
    const result = adaptSatelliteProviderScene(baseScene(), baseContext({ siteId: 99 }), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.observationId).toBe(`observation:99:${baseScene().sourceSceneId}`);
      expect(result.evidenceId).toBe(`evidence-id-for:${baseScene().sourceSceneId}`);
    }
  });

  it("two different scenes in the same batch receive two different evidenceIds", () => {
    const a = adaptSatelliteProviderScene(baseScene({ sourceSceneId: "scene-a" }), baseContext(), now);
    const b = adaptSatelliteProviderScene(baseScene({ sourceSceneId: "scene-b" }), baseContext(), now);
    expect(isObservation(a) && isObservation(b)).toBe(true);
    if (isObservation(a) && isObservation(b)) {
      expect(a.evidenceId).not.toBe(b.evidenceId);
    }
  });

  it("sets derivationMethod from the context's own providerCode, versioned", () => {
    const result = adaptSatelliteProviderScene(baseScene(), baseContext({ providerCode: "copernicus-legacy-simulated" }), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.derivationMethod).toBe("copernicus-legacy-simulated:v1");
    }
  });

  it("sets observationType to the single frozen literal sar_scene_metadata", () => {
    const result = adaptSatelliteProviderScene(baseScene(), baseContext(), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.observationType).toBe("sar_scene_metadata");
    }
  });

  it("discloses a limitation when spatial resolution is not reported", () => {
    const result = adaptSatelliteProviderScene(baseScene({ spatialResolutionMeters: null }), baseContext(), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.limitations.some((l) => l.includes("Spatial resolution"))).toBe(true);
    }
  });

  it("discloses a limitation when cloud coverage is not reported", () => {
    const result = adaptSatelliteProviderScene(baseScene({ cloudCoveragePercent: null }), baseContext(), now);
    expect(isObservation(result)).toBe(true);
    if (isObservation(result)) {
      expect(result.limitations.some((l) => l.includes("Cloud coverage"))).toBe(true);
    }
  });

  it("never throws for any of the fixtures exercised above", () => {
    expect(() => adaptSatelliteProviderScene(baseScene({ sourceSceneId: null }), baseContext(), now)).not.toThrow();
    expect(() => adaptSatelliteProviderScene(baseScene(), baseContext({ maximumImageryAgeDays: null }), now)).not.toThrow();
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 10 Wave 2: determinism and dependency-boundary source inspection", () => {
  // Comments stripped before matching, following the established
  // services/intelligence-adapters/ convention (tests/intelligence-data-trust-adapter-contract.test.ts,
  // tests/intelligence-increment-9-contract.test.ts's own determinism check)
  // so prose citing a forbidden pattern as evidence for its own absence
  // (e.g. this file's own header comment) cannot false-positive.
  const source = stripComments(fs.readFileSync(ADAPTER_FILE, "utf8"));

  it("has no Date.now(), Math.random(), or crypto.randomUUID()", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
  });

  it("does not import node:sqlite or a database helper", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/@\/lib\/db/);
  });

  it("does not import node:crypto (evidenceId is injected, never self-computed)", () => {
    expect(source).not.toMatch(/from\s*["']node:crypto["']/);
  });

  it("does not import next or next/server", () => {
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/from\s*["']next["']/);
  });

  it("does not import any legacy engine other than the explicitly authorized coordinate-quality-engine", () => {
    const importLines = source.match(/from\s*["'][^"']*-engine[^"']*["']/g) ?? [];
    for (const line of importLines) {
      expect(line).toMatch(/coordinate-quality-engine/);
    }
  });
});
