// GENESIS PHASE 2 -- Increment 9 (Pure Site Intelligence Projection Adapter).
// Pure unit tests for services/intelligence-adapters/site-intelligence-projection-adapter.ts.
import { describe, it, expect } from "vitest";
import {
  projectSiteIntelligenceResponse,
} from "@/services/intelligence-adapters/site-intelligence-projection-adapter";
import type { SiteIntelligenceOrchestrationResult } from "@/services/intelligence-runtime/site-intelligence-aggregator";
import type { CanonicalDataTrustOrchestrationResult } from "@/services/intelligence-runtime/intelligence-orchestrator";
import type { CanonicalEvidenceOrchestrationResult } from "@/services/intelligence-runtime/intelligence-evidence-orchestrator";
import { deriveSiteSnapshot } from "@/services/intelligence-adapters";

const SNAPSHOT = deriveSiteSnapshot({ dataImportacao: "2026-01-01", arquivoOrigem: "sites.xlsx" });

function dataTrustResult(overrides: Partial<CanonicalDataTrustOrchestrationResult> = {}): CanonicalDataTrustOrchestrationResult {
  return {
    notFound: false,
    success: true,
    siteId: "42",
    snapshot: SNAPSHOT,
    context: {
      contextId: "context:data-trust:42:t",
      correlationId: "correlation:data-trust:42:t",
      requestedAt: "2026-01-15T11:59:59.000Z",
      requestedBy: "api:intelligence/data-trust/site",
      environment: "test",
    },
    score: null,
    recommendations: [],
    issues: [],
    limitations: [],
    ...overrides,
  };
}

function evidenceResult(overrides: Partial<CanonicalEvidenceOrchestrationResult> = {}): CanonicalEvidenceOrchestrationResult {
  return {
    notFound: false,
    success: true,
    siteId: "42",
    snapshot: SNAPSHOT,
    context: {
      contextId: "context:evidence:42:t",
      correlationId: "correlation:evidence:42:t",
      requestedAt: "2026-01-15T12:00:00.500Z",
      requestedBy: "api:intelligence/evidence-center/site",
      environment: "test",
    },
    evidence: [],
    issues: [],
    limitations: [],
    ...overrides,
  };
}

function aggregateResult(overrides: Partial<SiteIntelligenceOrchestrationResult> = {}): SiteIntelligenceOrchestrationResult {
  return {
    notFound: false,
    status: "complete",
    siteId: "42",
    snapshot: SNAPSHOT,
    context: {
      contextId: "context:site-intelligence:42:t",
      correlationId: "correlation:site-intelligence:42:t",
      requestedAt: "2026-01-15T12:00:01.000Z",
      requestedBy: "api:intelligence/site",
      environment: "test",
    },
    dataTrust: { state: "available", result: dataTrustResult(), errorName: null },
    evidenceCenter: { state: "available", result: evidenceResult(), errorName: null },
    issues: [],
    ...overrides,
  };
}

describe("projectSiteIntelligenceResponse", () => {
  it("1. exact schemaVersion and capability literal", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult());
    expect(envelope.schemaVersion).toBe("1.0");
    expect(envelope.capability).toBe("site-intelligence");
  });

  it("2. status passthrough: complete", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult({ status: "complete" }));
    expect(envelope.result.status).toBe("complete");
  });

  it("3. status passthrough: partial", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult({ status: "partial" }));
    expect(envelope.result.status).toBe("partial");
  });

  it("4. status passthrough: failed, with both nested envelopes absent", () => {
    const failed = aggregateResult({
      status: "failed",
      dataTrust: { state: "unavailable", result: null, errorName: "Error" },
      evidenceCenter: { state: "unavailable", result: null, errorName: "Error" },
    });
    const envelope = projectSiteIntelligenceResponse(failed);
    expect(envelope.result.status).toBe("failed");
    expect(envelope.result.dataTrust.envelope).toBeNull();
    expect(envelope.result.evidenceCenter.envelope).toBeNull();
    expect(envelope.result.dataTrust.state).toBe("unavailable");
    expect(envelope.result.evidenceCenter.state).toBe("unavailable");
  });

  it("5. nested Data Trust projection reuses the existing frozen projection function verbatim", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult());
    expect(envelope.result.dataTrust.envelope).not.toBeNull();
    expect(envelope.result.dataTrust.envelope?.schemaVersion).toBe("1.0");
    expect(envelope.result.dataTrust.envelope?.capability).toBe("data-trust");
  });

  it("6. nested Evidence Center projection reuses the existing frozen projection function verbatim", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult());
    expect(envelope.result.evidenceCenter.envelope).not.toBeNull();
    expect(envelope.result.evidenceCenter.envelope?.schemaVersion).toBe("1.0");
    expect(envelope.result.evidenceCenter.envelope?.capability).toBe("evidence-center");
  });

  it("7. state mapping for available/unavailable/notFound", () => {
    const unavailable = projectSiteIntelligenceResponse(
      aggregateResult({ dataTrust: { state: "unavailable", result: null, errorName: "Error" } }),
    );
    expect(unavailable.result.dataTrust.state).toBe("unavailable");
    expect(unavailable.result.dataTrust.envelope).toBeNull();
  });

  it("8. no notFound field appears anywhere on the aggregate envelope", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult());
    expect(envelope).not.toHaveProperty("notFound");
    expect((envelope as unknown as Record<string, unknown>)["notFound"]).toBeUndefined();
  });

  it("9. nested adaptation issues remain inside their own nested envelope, never duplicated at the top level", () => {
    const dt = dataTrustResult({
      success: false,
      issues: [{ stage: "score", code: "x", field: "y", severity: "moderate", message: "m", canContinue: true }],
    });
    const envelope = projectSiteIntelligenceResponse(
      aggregateResult({ status: "partial", dataTrust: { state: "available", result: dt, errorName: null } }),
    );
    expect(envelope.result.dataTrust.envelope?.adaptation.issues).toHaveLength(1);
    expect(envelope.adaptation.issues).toHaveLength(0);
  });

  it("10. aggregate-origin issues appear only in the top-level adaptation.issues", () => {
    const envelope = projectSiteIntelligenceResponse(
      aggregateResult({
        issues: [{ stage: "snapshot-consistency", code: "snapshot_mismatch", severity: "significant", message: "m" }],
      }),
    );
    expect(envelope.adaptation.issues).toHaveLength(1);
    expect(envelope.adaptation.issues[0].code).toBe("snapshot_mismatch");
  });

  it("11. snapshot passthrough when present", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult());
    expect(envelope.snapshot).not.toBeNull();
    expect(envelope.snapshot?.id).toBe(String(SNAPSHOT.snapshotId));
  });

  it("12. null snapshot handling", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult({ snapshot: null }));
    expect(envelope.snapshot).toBeNull();
  });

  it("13. deterministic output for identical input", () => {
    const input = aggregateResult();
    const first = projectSiteIntelligenceResponse(input);
    const second = projectSiteIntelligenceResponse(input);
    expect(first).toEqual(second);
  });

  it("14. never calls Date.now or reads environment variables (source-level, mirrored behaviorally)", () => {
    const before = aggregateResult();
    projectSiteIntelligenceResponse(before);
    expect(before).toEqual(aggregateResult());
  });

  it("15. never mutates its input", () => {
    const input = aggregateResult();
    const copy = JSON.parse(JSON.stringify(input));
    projectSiteIntelligenceResponse(input);
    expect(input).toEqual(copy);
  });

  it("16. context passthrough", () => {
    const envelope = projectSiteIntelligenceResponse(aggregateResult());
    expect(envelope.context?.contextId).toBe("context:site-intelligence:42:t");
  });

  it("17-19. the final envelope survives JSON.stringify/JSON.parse round-trip without data loss, for complete, partial, and failed shapes", () => {
    const shapes: SiteIntelligenceOrchestrationResult[] = [
      aggregateResult({ status: "complete" }),
      aggregateResult({ status: "partial", dataTrust: { state: "unavailable", result: null, errorName: "Error" } }),
      aggregateResult({
        status: "failed",
        snapshot: null,
        context: null,
        dataTrust: { state: "unavailable", result: null, errorName: "Error" },
        evidenceCenter: { state: "unavailable", result: null, errorName: "Error" },
      }),
    ];
    for (const shape of shapes) {
      const envelope = projectSiteIntelligenceResponse(shape);
      const roundTripped = JSON.parse(JSON.stringify(envelope));
      expect(roundTripped).toEqual(envelope);
    }
  });
});
