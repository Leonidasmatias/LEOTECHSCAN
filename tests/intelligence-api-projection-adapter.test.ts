// GENESIS PHASE 2 -- Increment 7 (Pure API Projection Adapter).
// Pure unit tests for services/intelligence-adapters/api-projection-adapter.ts.
// No I/O, no node:sqlite -- constructed entirely from plain object literals.
import { describe, it, expect } from "vitest";
import { projectCanonicalDataTrustResponse } from "@/services/intelligence-adapters";
import type { CanonicalDataTrustOrchestrationResult } from "@/services/intelligence-runtime/intelligence-orchestrator";
import { toIdentifier, type Score, type Recommendation } from "@/services/intelligence";

function score(): Score {
  return {
    kind: "Score",
    id: toIdentifier<"Score">("data-trust:42"),
    createdAt: "2026-01-15T12:00:00.000Z" as Score["createdAt"],
    updatedAt: "2026-01-15T12:00:00.000Z" as Score["updatedAt"],
    version: 1,
    metadata: {},
    entity: { kind: "Site", id: toIdentifier<"Site">("42") },
    type: "data-trust",
    value: 0.85,
    classification: "Gold",
    confidence: 0.88 as Score["confidence"],
    engineVersion: "0.1.0" as Score["engineVersion"],
    contractVersion: "1.0.0" as Score["contractVersion"],
    drivers: [],
    evidence: [],
    limitations: [{ description: "score limitation", severity: "informational" }],
    calculatedAt: "2026-01-15T12:00:00.000Z" as Score["calculatedAt"],
    executionMetadata: {
      engineId: "data-trust",
      contextId: "context:data-trust:42:2026-01-15T12:00:00.000Z",
      executedAt: "2026-01-15T12:00:00.000Z" as Score["calculatedAt"],
      durationMs: 0,
      notes: [],
    },
  };
}

function recommendation(): Recommendation {
  return {
    kind: "Recommendation",
    id: toIdentifier<"Recommendation">("recommendation:42:DATA_TRUST_TEXT"),
    createdAt: "2026-01-15T12:00:00.000Z" as Recommendation["createdAt"],
    updatedAt: "2026-01-15T12:00:00.000Z" as Recommendation["updatedAt"],
    version: 1,
    metadata: { legacyType: "DATA_TRUST_TEXT" },
    reason: "Dado confiavel.",
    priority: "MEDIUM",
    confidence: 0.5 as Recommendation["confidence"],
    impact: { magnitude: 0.5 as Recommendation["impact"]["magnitude"], area: "data-quality", timeframe: "unspecified" },
    affectedEntities: [{ kind: "Site", id: toIdentifier<"Site">("42") }],
    recommendedActions: [],
    evidence: [],
    limitations: [{ description: "recommendation limitation", severity: "informational" }],
  };
}

function orchestrationResult(overrides: Partial<CanonicalDataTrustOrchestrationResult> = {}): CanonicalDataTrustOrchestrationResult {
  return {
    notFound: false,
    success: true,
    siteId: "42",
    snapshot: { snapshotId: toIdentifier<"Snapshot">("derived:data-importacao:2026-01-01"), kind: "derived", source: "data_importacao", limitation: null },
    context: {
      contextId: "context:data-trust:42:2026-01-15T12:00:00.000Z",
      correlationId: "correlation:data-trust:42:2026-01-15T12:00:00.000Z",
      requestedAt: "2026-01-15T12:00:00.000Z",
      requestedBy: "api:intelligence/data-trust/site",
      environment: "test",
    },
    score: score(),
    recommendations: [recommendation()],
    issues: [{ stage: "score", code: "unmapped_classification", field: "trustBadge", severity: "informational", message: "msg", canContinue: true }],
    limitations: [{ description: "score limitation", severity: "informational" }, { description: "recommendation limitation", severity: "informational" }],
    ...overrides,
  };
}

describe("projectCanonicalDataTrustResponse", () => {
  it("1. produces the exact schemaVersion and capability literal", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect(envelope.schemaVersion).toBe("1.0");
    expect(envelope.capability).toBe("data-trust");
  });

  it("2. carries the Score as the primary result", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect(envelope.result.score).not.toBeNull();
    expect(envelope.result.score?.type).toBe("data-trust");
  });

  it("3. evidence is always an empty array", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect(envelope.result.evidence).toEqual([]);
  });

  it("4. maps recommendations verbatim", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect(envelope.result.recommendations).toHaveLength(1);
    expect(envelope.result.recommendations[0].reason).toBe("Dado confiavel.");
  });

  it("5. discloses the snapshot kind and source", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect(envelope.snapshot).toEqual({ id: "derived:data-importacao:2026-01-01", kind: "derived", source: "data_importacao" });
  });

  it("6. maps issues and limitations without alteration", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect(envelope.adaptation.issues).toHaveLength(1);
    expect(envelope.adaptation.limitations).toHaveLength(2);
    expect(envelope.adaptation.success).toBe(true);
  });

  it("7. the envelope never carries a notFound field -- that state is mapped to HTTP 404 by the route before this function is ever called (post-audit fix)", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect("notFound" in envelope).toBe(false);
    expect(Object.keys(envelope).sort()).toEqual(
      ["adaptation", "capability", "context", "result", "schemaVersion", "siteId", "snapshot"].sort(),
    );
  });

  it("7b. still handles a null snapshot/context/score gracefully (defensive, even though the route never calls this function for a notFound result)", () => {
    const envelope = projectCanonicalDataTrustResponse(
      orchestrationResult({ success: false, snapshot: null, context: null, score: null, recommendations: [], issues: [], limitations: [] }),
    );
    expect(envelope.snapshot).toBeNull();
    expect(envelope.context).toBeNull();
    expect(envelope.result.score).toBeNull();
  });

  it("8. does not mutate its input", () => {
    const result = orchestrationResult();
    const frozen = Object.freeze(result);
    expect(() => projectCanonicalDataTrustResponse(frozen)).not.toThrow();
    projectCanonicalDataTrustResponse(frozen);
    expect(result.issues).toHaveLength(1);
  });

  it("9. is deterministic across repeated calls with identical input", () => {
    const result = orchestrationResult();
    const a = projectCanonicalDataTrustResponse(result);
    const b = projectCanonicalDataTrustResponse(result);
    expect(a).toEqual(b);
  });

  it("10. introduces no fabricated field -- every envelope field traces to a result field", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect(envelope.siteId).toBe("42");
    expect(envelope.context?.requestedBy).toBe("api:intelligence/data-trust/site");
  });

  it("11. is JSON-serializable end to end", () => {
    const envelope = projectCanonicalDataTrustResponse(orchestrationResult());
    expect(() => JSON.stringify(envelope)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(envelope));
    expect(parsed.schemaVersion).toBe("1.0");
  });
});
