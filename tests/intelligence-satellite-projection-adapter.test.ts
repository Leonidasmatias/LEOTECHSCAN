// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 6.
// Behavioral and source-inspection tests for
// services/intelligence-adapters/satellite-projection-adapter.ts, per
// docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md Section 15
// and docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md
// Section 9.9: verbatim projection, no derived fields, no evidence/snapshot/
// success fields, synchronous, deterministic, non-mutating.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  projectSatelliteIntelligenceResponse,
  type SatelliteIntelligenceEnvelope,
} from "@/services/intelligence-adapters/satellite-projection-adapter";
import type { SatelliteCapabilityOutcome } from "@/services/intelligence-runtime/satellite-intelligence-orchestrator";
import type { SatelliteObservation, SatelliteAggregateStatus } from "@/services/intelligence-adapters/satellite-observation-model";
import type { SatelliteOrchestrationIssue } from "@/services/intelligence-adapters/satellite-observation-adapter";

const ADAPTER_FILE = path.resolve(
  __dirname,
  "..",
  "services",
  "intelligence-adapters",
  "satellite-projection-adapter.ts",
);

function baseObservation(overrides: Partial<SatelliteObservation> = {}): SatelliteObservation {
  return {
    observationId: "observation:42:S1A_TEST",
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
    evidenceId: "satellite:copernicus-legacy-simulated:42:abc123",
    limitations: [],
    ...overrides,
  };
}

function baseIssue(overrides: Partial<SatelliteOrchestrationIssue> = {}): SatelliteOrchestrationIssue {
  return {
    stage: "observation",
    code: "missing_scene_id",
    severity: "significant",
    message: "Provider scene has no sourceSceneId; it cannot be adapted into a canonical observation.",
    canContinue: true,
    ...overrides,
  };
}

function baseContext(): NonNullable<SatelliteCapabilityOutcome["context"]> {
  return {
    contextId: "context:satellite-intelligence:42:2026-01-01T00:00:00.000Z",
    correlationId: "correlation:satellite-intelligence:42:2026-01-01T00:00:00.000Z",
    requestedAt: "2026-01-01T00:00:00.000Z",
    requestedBy: "api:intelligence/satellite/site",
    environment: "test",
  };
}

function baseTruthMetadata(): NonNullable<SatelliteCapabilityOutcome["truthMetadata"]> {
  return {
    dataReality: "simulated",
    realSatelliteEvidence: false,
    simulationReason: "Data source: local_rule_engine (dataStatus=simulated).",
    sourceDisclosure: "dataStatus=simulated; source=local_rule_engine",
  };
}

function baseOutcome(overrides: Partial<SatelliteCapabilityOutcome> = {}): SatelliteCapabilityOutcome {
  return {
    notFound: false,
    status: "complete",
    siteId: "42",
    coordinateEligibility: "eligible",
    observations: [baseObservation()],
    evidence: [],
    truthMetadata: baseTruthMetadata(),
    context: baseContext(),
    issues: [],
    limitations: [],
    ...overrides,
  };
}

describe("Increment 10 Wave 6: file exists", () => {
  it("satellite-projection-adapter.ts exists at the frozen path", () => {
    expect(fs.existsSync(ADAPTER_FILE)).toBe(true);
  });
});

describe("Increment 10 Wave 6: status projection (complete/partial/unavailable/failed)", () => {
  const statuses: SatelliteAggregateStatus[] = ["complete", "partial", "unavailable", "failed"];
  for (const status of statuses) {
    it(`projects status "${status}" verbatim`, () => {
      const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ status }));
      expect(envelope.result.status).toBe(status);
    });
  }
});

describe("Increment 10 Wave 6: observations projection", () => {
  it("empty observations array projects unchanged", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ observations: [] }));
    expect(envelope.result.observations).toEqual([]);
  });

  it("a populated observations array projects unchanged, same order, same values, including evidenceId references", () => {
    const observations = [
      baseObservation({ observationId: "observation:42:a", evidenceId: "satellite:copernicus-legacy-simulated:42:aaa" }),
      baseObservation({ observationId: "observation:42:b", evidenceId: "satellite:copernicus-legacy-simulated:42:bbb" }),
    ];
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ observations }));
    expect(envelope.result.observations).toEqual(observations);
    expect(envelope.result.observations[0].observationId).toBe("observation:42:a");
    expect(envelope.result.observations[1].observationId).toBe("observation:42:b");
    expect(envelope.result.observations[0].evidenceId).toBe("satellite:copernicus-legacy-simulated:42:aaa");
    expect(envelope.result.observations[1].evidenceId).toBe("satellite:copernicus-legacy-simulated:42:bbb");
  });

  it("observations are passed through by reference, never mapped or re-derived (same array contents, same object identity per element)", () => {
    const observationA = baseObservation({ observationId: "observation:42:same-ref" });
    const observations = [observationA];
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ observations }));
    expect(envelope.result.observations[0]).toBe(observationA);
  });
});

describe("Increment 10 Wave 6: coordinateEligibility projection", () => {
  it("eligible passes through unchanged", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ coordinateEligibility: "eligible" }));
    expect(envelope.result.coordinateEligibility).toBe("eligible");
  });

  it("ineligible passes through unchanged", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ coordinateEligibility: "ineligible" }));
    expect(envelope.result.coordinateEligibility).toBe("ineligible");
  });

  it("null passes through unchanged (structurally allowed by the type, even though never called for notFound in practice)", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ coordinateEligibility: null }));
    expect(envelope.result.coordinateEligibility).toBeNull();
  });
});

describe("Increment 10 Wave 6: truthMetadata passthrough (byte-for-byte)", () => {
  it("copies truthMetadata verbatim, deep-equal to the source", () => {
    const truthMetadata = baseTruthMetadata();
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ truthMetadata }));
    expect(envelope.result.truthMetadata).toEqual(truthMetadata);
  });

  it("never recomputes or re-derives truthMetadata -- a distinctive fixture value survives unchanged", () => {
    const distinctive = {
      dataReality: "simulated" as const,
      realSatelliteEvidence: false,
      simulationReason: "a distinctive, non-standard fixture reason for this test only",
      sourceDisclosure: "dataStatus=simulated; source=distinctive-fixture-marker",
    };
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ truthMetadata: distinctive }));
    expect(envelope.result.truthMetadata).toBe(distinctive);
  });
});

describe("Increment 10 Wave 6: context projection", () => {
  it("context: null projects to null", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ context: null }));
    expect(envelope.context).toBeNull();
  });

  it("a populated context projects every field unchanged", () => {
    const context = baseContext();
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ context }));
    expect(envelope.context).toEqual(context);
    expect(envelope.context?.contextId).toBe(context.contextId);
    expect(envelope.context?.correlationId).toBe(context.correlationId);
    expect(envelope.context?.requestedAt).toBe(context.requestedAt);
    expect(envelope.context?.requestedBy).toBe(context.requestedBy);
    expect(envelope.context?.environment).toBe(context.environment);
  });
});

describe("Increment 10 Wave 6: issues and limitations passthrough", () => {
  it("empty issues array projects unchanged", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ issues: [] }));
    expect(envelope.adaptation.issues).toEqual([]);
  });

  it("populated issues array projects unchanged, same order and content", () => {
    const issues = [baseIssue({ message: "first" }), baseIssue({ message: "second" })];
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ issues }));
    expect(envelope.adaptation.issues).toEqual(issues);
    expect(envelope.adaptation.issues[0].message).toBe("first");
    expect(envelope.adaptation.issues[1].message).toBe("second");
  });

  it("empty limitations array projects unchanged", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ limitations: [] }));
    expect(envelope.adaptation.limitations).toEqual([]);
  });

  it("populated limitations array projects unchanged", () => {
    const limitations = [{ description: "a limitation", severity: "informational" as const }];
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ limitations }));
    expect(envelope.adaptation.limitations).toEqual(limitations);
  });
});

describe("Increment 10 Wave 6: structural exclusions (no evidence, no snapshot, no top-level success)", () => {
  it("the envelope's result has no evidence field", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect("evidence" in envelope.result).toBe(false);
    expect("evidence" in envelope).toBe(false);
  });

  it("the envelope has no notFound field", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect("notFound" in envelope).toBe(false);
  });

  it("the envelope has no snapshot field", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect("snapshot" in envelope).toBe(false);
  });

  it("the envelope's adaptation has no top-level success field", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect("success" in envelope.adaptation).toBe(false);
  });

  it("the full set of top-level envelope keys matches exactly the frozen contract", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect(Object.keys(envelope).sort()).toEqual(["adaptation", "capability", "context", "result", "schemaVersion", "siteId"].sort());
  });

  it("the full set of result keys matches exactly the frozen contract", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect(Object.keys(envelope.result).sort()).toEqual(
      ["status", "observations", "coordinateEligibility", "truthMetadata"].sort(),
    );
  });

  it("the full set of adaptation keys matches exactly the frozen contract", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect(Object.keys(envelope.adaptation).sort()).toEqual(["issues", "limitations"].sort());
  });
});

describe("Increment 10 Wave 6: schemaVersion and capability literals", () => {
  it("schemaVersion is exactly the literal 1.0", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect(envelope.schemaVersion).toBe("1.0");
  });

  it("capability is exactly the literal satellite-intelligence", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    expect(envelope.capability).toBe("satellite-intelligence");
  });
});

describe("Increment 10 Wave 6: siteId projection", () => {
  it("siteId passes through unchanged", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome({ siteId: "999" }));
    expect(envelope.siteId).toBe("999");
  });
});

describe("Increment 10 Wave 6: determinism and JSON round-trip", () => {
  it("identical input produces a deep-equal envelope across repeated calls", () => {
    const outcome = baseOutcome();
    const a = projectSatelliteIntelligenceResponse(outcome);
    const b = projectSatelliteIntelligenceResponse(outcome);
    expect(a).toEqual(b);
  });

  it("the envelope survives a JSON.stringify/JSON.parse round-trip unchanged", () => {
    const envelope = projectSatelliteIntelligenceResponse(baseOutcome());
    const roundTripped = JSON.parse(JSON.stringify(envelope)) as SatelliteIntelligenceEnvelope;
    expect(roundTripped).toEqual(envelope);
  });

  it("the round-trip also holds for a populated, multi-observation, multi-issue outcome", () => {
    const outcome = baseOutcome({
      status: "partial",
      observations: [baseObservation({ observationId: "observation:42:x" }), baseObservation({ observationId: "observation:42:y" })],
      issues: [baseIssue()],
      limitations: [{ description: "x", severity: "moderate" }],
    });
    const envelope = projectSatelliteIntelligenceResponse(outcome);
    const roundTripped = JSON.parse(JSON.stringify(envelope)) as SatelliteIntelligenceEnvelope;
    expect(roundTripped).toEqual(envelope);
  });
});

describe("Increment 10 Wave 6: no input mutation", () => {
  it("never mutates the outcome it is given, including nested arrays and objects", () => {
    const outcome = baseOutcome({
      observations: [baseObservation()],
      issues: [baseIssue()],
      limitations: [{ description: "x", severity: "informational" }],
    });
    const snapshot = JSON.parse(JSON.stringify(outcome));
    projectSatelliteIntelligenceResponse(outcome);
    expect(outcome).toEqual(snapshot);
  });

  it("never mutates the returned envelope's own inputs on a second call", () => {
    const outcome = baseOutcome();
    const first = projectSatelliteIntelligenceResponse(outcome);
    const second = projectSatelliteIntelligenceResponse(outcome);
    expect(first).toEqual(second);
  });
});

describe("Increment 10 Wave 6: synchronous behavior and no exception", () => {
  it("returns a plain object, never a Promise", () => {
    const result = projectSatelliteIntelligenceResponse(baseOutcome());
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof (result as unknown as { then?: unknown }).then).not.toBe("function");
  });

  it("never throws for a contract-valid outcome", () => {
    expect(() => projectSatelliteIntelligenceResponse(baseOutcome())).not.toThrow();
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 10 Wave 6: source inspection", () => {
  const source = stripComments(fs.readFileSync(ADAPTER_FILE, "utf8"));

  it("has no async, await, or Promise anywhere in its own source", () => {
    expect(source).not.toMatch(/\basync\b/);
    expect(source).not.toMatch(/\bawait\b/);
    expect(source).not.toMatch(/\bPromise\b/);
  });

  it("has no Date.now(), Math.random(), or crypto.randomUUID()", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
  });

  it("has no console.error/console.log/console.warn", () => {
    expect(source).not.toMatch(/console\.(error|log|warn)\(/);
  });

  it("does not import node:sqlite, @/lib/db, next, or next/server", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/@\/lib\/db/);
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/from\s*["']next["']/);
  });

  it("does not import the legacy Copernicus engine or truth module, or any other legacy *-engine module", () => {
    expect(source).not.toMatch(/copernicus-engine/);
    expect(source).not.toMatch(/copernicus-truth/);
    expect(source).not.toMatch(/from\s*["'][^"']*-engine[^"']*["']/);
  });

  it("does not value-import the orchestrator instance, either Wave 3 io/ file, or Wave 2's/Wave 4's adapters", () => {
    expect(source).not.toMatch(/satellite-intelligence-orchestrator-instance/);
    expect(source).not.toMatch(/io\/legacy-copernicus-provider/);
    expect(source).not.toMatch(/io\/satellite-site-read-adapter/);
    const valueImportPattern =
      /^import\s+\{[^}]*\}\s+from\s*["'][^"']*(satellite-observation-adapter|satellite-evidence-adapter)["']/m;
    expect(source).not.toMatch(valueImportPattern);
  });

  it("does not import node:fs, does not call fetch(), does not call .prepare()", () => {
    expect(source).not.toMatch(/from\s*["']node:fs["']/);
    expect(source).not.toMatch(/\bfetch\(/);
    expect(source).not.toMatch(/\.prepare\(/);
  });
});
