// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 4.
// Behavioral and source-inspection tests for
// services/intelligence-adapters/satellite-evidence-adapter.ts, per
// docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md Section 10.4
// and docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md
// Section 9.8: exact EvidenceId formula, determinism, collision protection against the
// Evidence Center namespace, forced-low reliability, satellite-specific origin,
// provenance traceability, normalization, and non-mutation.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  adaptSatelliteObservationToEvidence,
  type SatelliteEvidenceAdapterContext,
} from "@/services/intelligence-adapters/satellite-evidence-adapter";
import { computeSatelliteEvidenceChecksum } from "@/services/intelligence-adapters/satellite-evidence-checksum";
import type { SatelliteObservation } from "@/services/intelligence-adapters/satellite-observation-model";

const ADAPTER_FILE = path.resolve(__dirname, "..", "services", "intelligence-adapters", "satellite-evidence-adapter.ts");

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
    limitations: [],
    ...overrides,
  };
}

function baseContext(overrides: Partial<SatelliteEvidenceAdapterContext> = {}): SatelliteEvidenceAdapterContext {
  return {
    siteId: 42,
    sourceSceneId: "S1A_IW_GRDH_1SDV_20251201T000000",
    snapshot: "snapshot-2026-01-01",
    ...overrides,
  };
}

function expectedDigest(sourceSceneId: string): string {
  return createHash("sha256").update(sourceSceneId.trim(), "utf8").digest("hex");
}

describe("Increment 10 Wave 4: file exists", () => {
  it("satellite-evidence-adapter.ts exists at the frozen path", () => {
    expect(fs.existsSync(ADAPTER_FILE)).toBe(true);
  });
});

describe("Increment 10 Wave 4: exact EvidenceId formula", () => {
  it("constructs satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())> exactly", () => {
    const observation = baseObservation();
    const context = baseContext();
    const evidence = adaptSatelliteObservationToEvidence(observation, context);
    const digest = expectedDigest(context.sourceSceneId);
    expect(evidence.id).toBe(`satellite:copernicus-legacy-simulated:42:${digest}`);
  });

  it("the digest segment is exactly the 64-character lowercase hex SHA-256 of the trimmed sourceSceneId", () => {
    const context = baseContext({ sourceSceneId: "  scene-with-padding  " });
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), context);
    const digest = expectedDigest("scene-with-padding");
    expect(evidence.id.endsWith(`:${digest}`)).toBe(true);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never substitutes the raw sourceSceneId directly into the id", () => {
    const context = baseContext({ sourceSceneId: "S1A_IW_GRDH_1SDV_20251201T000000" });
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), context);
    expect(evidence.id).not.toContain("S1A_IW_GRDH_1SDV_20251201T000000");
  });

  it("never embeds a timestamp or random component in the id", () => {
    const evidence1 = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    const evidence2 = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    expect(evidence1.id).toBe(evidence2.id);
  });
});

describe("Increment 10 Wave 4: determinism", () => {
  it("produces the same Evidence object and the same EvidenceId across repeated calls with identical input", () => {
    const a = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    const b = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    expect(a).toEqual(b);
    expect(a.id).toBe(b.id);
  });

  it("two different sourceSceneIds produce two different EvidenceIds", () => {
    const a = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ sourceSceneId: "scene-a" }));
    const b = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ sourceSceneId: "scene-b" }));
    expect(a.id).not.toBe(b.id);
  });
});

describe("Increment 10 Wave 4: collision protection against the Evidence Center namespace", () => {
  it("never equals the Evidence Center evidence:<siteId>:COPERNICUS format", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ siteId: 42 }));
    expect(evidence.id).not.toBe("evidence:42:COPERNICUS");
    expect(evidence.id.startsWith("satellite:")).toBe(true);
  });

  it("has a structurally distinct segment count and hex-digest segment that a five-character type literal can never match", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    const segments = evidence.id.split(":");
    expect(segments[0]).toBe("satellite");
    expect(segments).toHaveLength(4);
    expect(segments[3]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Increment 10 Wave 4: forced-low reliability", () => {
  it("forces reliability to exactly 0.1, mirroring the COPERNICUS_RELIABILITY precedent", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    expect(evidence.reliability).toBe(0.1);
  });

  it("forces reliability to 0.1 regardless of the observation's own quality/confidence values", () => {
    const highConfidenceObservation = baseObservation({
      quality: { ...baseObservation().quality, sourceConfidence: 1, qualityClassification: "high" },
    });
    const evidence = adaptSatelliteObservationToEvidence(highConfidenceObservation, baseContext());
    expect(evidence.reliability).toBe(0.1);
  });
});

describe("Increment 10 Wave 4: satellite-specific origin", () => {
  it("sets origin.source to the satellite-specific DataSourceId", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    expect(evidence.origin.source).toBe("satellite-intelligence");
  });

  it("never sets origin.source to Evidence Center's own value", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    expect(evidence.origin.source).not.toBe("evidence-center");
  });
});

describe("Increment 10 Wave 4: provenance traceability", () => {
  it("Evidence.checksum equals origin.checksum, both equal to computeSatelliteEvidenceChecksum(observation)", () => {
    const observation = baseObservation();
    const evidence = adaptSatelliteObservationToEvidence(observation, baseContext());
    const expected = computeSatelliteEvidenceChecksum(observation);
    expect(evidence.checksum).toBe(expected);
    expect(evidence.origin.checksum).toBe(expected);
  });

  it("carries the source observationId in metadata for direct traceability", () => {
    const observation = baseObservation();
    const evidence = adaptSatelliteObservationToEvidence(observation, baseContext());
    expect(evidence.metadata.observationId).toBe(observation.observationId);
  });

  it("origin.snapshot and Evidence.snapshot both equal the caller-supplied snapshot identifier", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "snap-xyz" }));
    expect(evidence.snapshot).toBe("snap-xyz");
    expect(evidence.origin.snapshot).toBe("snap-xyz");
  });

  it("origin.timestamp derives from the observation's own temporal.retrievedAt", () => {
    const observation = baseObservation({
      temporal: { ...baseObservation().temporal, retrievedAt: "2026-02-15T10:00:00.000Z" },
    });
    const evidence = adaptSatelliteObservationToEvidence(observation, baseContext());
    expect(evidence.origin.timestamp).toBe("2026-02-15T10:00:00.000Z");
    expect(evidence.createdAt).toBe("2026-02-15T10:00:00.000Z");
    expect(evidence.updatedAt).toBe("2026-02-15T10:00:00.000Z");
  });
});

describe("Increment 10 Wave 4: whitespace and provider-code normalization", () => {
  it("trims sourceSceneId before hashing", () => {
    const withPadding = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ sourceSceneId: "  scene-x  " }));
    const withoutPadding = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ sourceSceneId: "scene-x" }));
    expect(withPadding.id).toBe(withoutPadding.id);
  });

  it("trims and lowercases providerCode before embedding it in the id", () => {
    const observation = baseObservation({
      provider: { ...baseObservation().provider, providerCode: "  COPERNICUS-LEGACY-SIMULATED  " },
    });
    const evidence = adaptSatelliteObservationToEvidence(observation, baseContext());
    expect(evidence.id.startsWith("satellite:copernicus-legacy-simulated:")).toBe(true);
  });
});

describe("Increment 10 Wave 4: input immutability", () => {
  it("never mutates the observation it is given", () => {
    const observation = baseObservation();
    const snapshot = JSON.parse(JSON.stringify(observation));
    adaptSatelliteObservationToEvidence(observation, baseContext());
    expect(observation).toEqual(snapshot);
  });

  it("never mutates the context it is given", () => {
    const context = baseContext();
    const snapshot = JSON.parse(JSON.stringify(context));
    adaptSatelliteObservationToEvidence(baseObservation(), context);
    expect(context).toEqual(snapshot);
  });
});

describe("Increment 10 Wave 4: no exception for contract-valid input", () => {
  it("never throws for a contract-valid observation and context", () => {
    expect(() => adaptSatelliteObservationToEvidence(baseObservation(), baseContext())).not.toThrow();
  });

  it("returns a plain Evidence object with the canonical kind discriminant", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext());
    expect(evidence.kind).toBe("Evidence");
  });
});

describe("Increment 10 Wave 4: deterministic fallback for empty/whitespace-only snapshot (W4R-1 correction)", () => {
  it("does not throw for snapshot: \"\"", () => {
    expect(() => adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "" }))).not.toThrow();
  });

  it("does not throw for snapshot: \"   \" (whitespace-only)", () => {
    expect(() => adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "   " }))).not.toThrow();
  });

  it("returns a non-empty snapshot identifier for an empty snapshot", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "" }));
    expect(evidence.snapshot.length).toBeGreaterThan(0);
    expect(evidence.origin.snapshot.length).toBeGreaterThan(0);
  });

  it("returns a non-empty snapshot identifier for a whitespace-only snapshot", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "   " }));
    expect(evidence.snapshot.length).toBeGreaterThan(0);
    expect(evidence.origin.snapshot.length).toBeGreaterThan(0);
  });

  it("the empty-snapshot fallback is deterministic across repeated calls with the same input", () => {
    const a = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "" }));
    const b = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "" }));
    expect(a.snapshot).toBe(b.snapshot);
    expect(a).toEqual(b);
  });

  it("empty and whitespace-only snapshot produce the same fallback (both trim to empty)", () => {
    const a = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "" }));
    const b = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "   " }));
    expect(a.snapshot).toBe(b.snapshot);
  });

  it("the empty-snapshot fallback does not collide with a real, distinct caller-supplied snapshot", () => {
    const fallback = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "" }));
    const real = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "snapshot-2026-01-01" }));
    expect(fallback.snapshot).not.toBe(real.snapshot);
  });

  it("EvidenceId formula remains exactly the frozen formula when snapshot is empty", () => {
    const context = baseContext({ snapshot: "" });
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), context);
    const digest = expectedDigest(context.sourceSceneId);
    expect(evidence.id).toBe(`satellite:copernicus-legacy-simulated:42:${digest}`);
  });

  it("forced-low reliability remains unchanged when snapshot is empty", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "" }));
    expect(evidence.reliability).toBe(0.1);
  });

  it("origin.source remains unchanged when snapshot is empty", () => {
    const evidence = adaptSatelliteObservationToEvidence(baseObservation(), baseContext({ snapshot: "" }));
    expect(evidence.origin.source).toBe("satellite-intelligence");
  });

  it("does not mutate the observation or context when falling back for an empty snapshot", () => {
    const observation = baseObservation();
    const context = baseContext({ snapshot: "" });
    const observationSnapshot = JSON.parse(JSON.stringify(observation));
    const contextSnapshot = JSON.parse(JSON.stringify(context));
    adaptSatelliteObservationToEvidence(observation, context);
    expect(observation).toEqual(observationSnapshot);
    expect(context).toEqual(contextSnapshot);
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 10 Wave 4: determinism and dependency-boundary source inspection", () => {
  const source = stripComments(fs.readFileSync(ADAPTER_FILE, "utf8"));

  it("has no Date.now(), Math.random(), or crypto.randomUUID()", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
  });

  it("does not import node:sqlite, @/lib/db, next, or next/server", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/@\/lib\/db/);
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/from\s*["']next["']/);
  });

  it("does not import the legacy Copernicus engine or truth module", () => {
    expect(source).not.toMatch(/copernicus-engine/);
    expect(source).not.toMatch(/copernicus-truth/);
  });

  it("does not import satellite-observation-adapter.ts (Wave 2) or either io/ file (Wave 3)", () => {
    expect(source).not.toMatch(/satellite-observation-adapter/);
    expect(source).not.toMatch(/io\/legacy-copernicus-provider/);
    expect(source).not.toMatch(/io\/satellite-site-read-adapter/);
  });

  it("does not import the pre-existing Increment 5/8 evidence-adapter or evidence-checksum implementations", () => {
    expect(source).not.toMatch(/["']\.\/evidence-adapter["']/);
    expect(source).not.toMatch(/["']\.\/evidence-checksum["']/);
  });

  it("does not construct or import SatelliteTruthMetadata", () => {
    expect(source).not.toMatch(/SatelliteTruthMetadata/);
  });

  it("does not import any other legacy *-engine module", () => {
    const importLines = source.match(/from\s*["'][^"']*-engine[^"']*["']/g) ?? [];
    expect(importLines).toHaveLength(0);
  });
});
