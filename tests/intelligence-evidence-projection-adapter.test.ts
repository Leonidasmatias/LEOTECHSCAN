// GENESIS PHASE 2 -- Increment 8 (Pure Evidence Projection Adapter).
// Pure unit tests for services/intelligence-adapters/evidence-projection-adapter.ts.
// No I/O, no node:sqlite -- constructed entirely from plain object literals.
import { describe, it, expect } from "vitest";
import { projectCanonicalEvidenceResponse } from "@/services/intelligence-adapters";
import type { CanonicalEvidenceOrchestrationResult } from "@/services/intelligence-runtime/intelligence-evidence-orchestrator";
import { toIdentifier, type Evidence } from "@/services/intelligence";

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    kind: "Evidence",
    id: toIdentifier<"Evidence">("evidence:42:CADASTRO"),
    createdAt: "2026-01-15T12:00:00.000Z" as Evidence["createdAt"],
    updatedAt: "2026-01-15T12:00:00.000Z" as Evidence["updatedAt"],
    version: 1,
    metadata: { legacyType: "CADASTRO" },
    source: "vivo_sites.xlsx",
    description: "SITE-42 - TIM - Sao Paulo/SP",
    weight: 1,
    reliability: 0.5 as Evidence["reliability"],
    snapshot: toIdentifier<"Snapshot">("derived:data-importacao:2026-01-01"),
    origin: {
      origin: "vivo_sites.xlsx",
      pipeline: "evidence-center",
      snapshot: toIdentifier<"Snapshot">("derived:data-importacao:2026-01-01"),
      source: toIdentifier<"DataSource">("evidence-center"),
      checksum: "sha256-v1:abc",
      timestamp: "2026-01-15T12:00:00.000Z" as Evidence["createdAt"],
      version: "0.1.0" as Evidence["origin"]["version"],
      processingMetadata: {},
    },
    checksum: "sha256-v1:abc",
    references: [],
    ...overrides,
  };
}

function orchestrationResult(overrides: Partial<CanonicalEvidenceOrchestrationResult> = {}): CanonicalEvidenceOrchestrationResult {
  return {
    notFound: false,
    success: true,
    siteId: "42",
    snapshot: { snapshotId: toIdentifier<"Snapshot">("derived:data-importacao:2026-01-01"), kind: "derived", source: "data_importacao", limitation: null },
    context: {
      contextId: "context:evidence:42:2026-01-15T12:00:00.000Z",
      correlationId: "correlation:evidence:42:2026-01-15T12:00:00.000Z",
      requestedAt: "2026-01-15T12:00:00.000Z",
      requestedBy: "api:intelligence/evidence-center/site",
      environment: "test",
    },
    evidence: [evidence()],
    issues: [{ stage: "evidence", code: "policy_default_values_applied", field: "CADASTRO.weight,reliability", severity: "informational", message: "msg", canContinue: true }],
    limitations: [],
    ...overrides,
  };
}

describe("projectCanonicalEvidenceResponse", () => {
  it("1. produces the exact schemaVersion and capability literal", () => {
    const envelope = projectCanonicalEvidenceResponse(orchestrationResult());
    expect(envelope.schemaVersion).toBe("1.0");
    expect(envelope.capability).toBe("evidence-center");
  });

  it("2. exact top-level keys, no notFound field", () => {
    const envelope = projectCanonicalEvidenceResponse(orchestrationResult());
    expect(Object.keys(envelope).sort()).toEqual(
      ["adaptation", "capability", "context", "result", "schemaVersion", "siteId", "snapshot"].sort(),
    );
    expect("notFound" in envelope).toBe(false);
  });

  it("3. carries the Evidence array under result.evidence", () => {
    const envelope = projectCanonicalEvidenceResponse(orchestrationResult());
    expect(envelope.result.evidence).toHaveLength(1);
    expect(envelope.result.evidence[0].metadata.legacyType).toBe("CADASTRO");
  });

  it("4. preserves evidence order", () => {
    const items = [evidence({ id: toIdentifier<"Evidence">("evidence:42:CADASTRO") }), evidence({ id: toIdentifier<"Evidence">("evidence:42:COORDENADAS") })];
    const envelope = projectCanonicalEvidenceResponse(orchestrationResult({ evidence: items }));
    expect(envelope.result.evidence.map((e) => e.id)).toEqual(["evidence:42:CADASTRO", "evidence:42:COORDENADAS"]);
  });

  it("5. discloses the snapshot kind and source", () => {
    const envelope = projectCanonicalEvidenceResponse(orchestrationResult());
    expect(envelope.snapshot).toEqual({ id: "derived:data-importacao:2026-01-01", kind: "derived", source: "data_importacao" });
  });

  it("6. maps issues and limitations without alteration", () => {
    const envelope = projectCanonicalEvidenceResponse(orchestrationResult());
    expect(envelope.adaptation.issues).toHaveLength(1);
    expect(envelope.adaptation.success).toBe(true);
  });

  it("7. a successful result with genuinely zero legacy evidence items projects a successful, empty result.evidence", () => {
    const envelope = projectCanonicalEvidenceResponse(orchestrationResult({ evidence: [], success: true }));
    expect(envelope.result.evidence).toEqual([]);
    expect(envelope.adaptation.success).toBe(true);
  });

  it("8. a failed result never masquerades as a successful empty evidence array", () => {
    const envelope = projectCanonicalEvidenceResponse(
      orchestrationResult({ evidence: [], success: false, issues: [{ stage: "evidence", code: "missing_source", field: "CADASTRO.source", severity: "significant", message: "msg", canContinue: false }] }),
    );
    expect(envelope.result.evidence).toEqual([]);
    expect(envelope.adaptation.success).toBe(false);
    expect(envelope.adaptation.issues).toHaveLength(1);
  });

  it("9. does not mutate its input", () => {
    const result = orchestrationResult();
    const frozen = Object.freeze(result);
    expect(() => projectCanonicalEvidenceResponse(frozen)).not.toThrow();
    projectCanonicalEvidenceResponse(frozen);
    expect(result.evidence).toHaveLength(1);
  });

  it("10. is deterministic across repeated calls with identical input", () => {
    const result = orchestrationResult();
    const a = projectCanonicalEvidenceResponse(result);
    const b = projectCanonicalEvidenceResponse(result);
    expect(a).toEqual(b);
  });

  it("11. reflects null snapshot/context when notFound-adjacent state is passed defensively", () => {
    const envelope = projectCanonicalEvidenceResponse(
      orchestrationResult({ success: false, snapshot: null, context: null, evidence: [], issues: [], limitations: [] }),
    );
    expect(envelope.snapshot).toBeNull();
    expect(envelope.context).toBeNull();
  });

  it("12. is JSON-serializable end to end", () => {
    const envelope = projectCanonicalEvidenceResponse(orchestrationResult());
    expect(() => JSON.stringify(envelope)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(envelope));
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.notFound).toBeUndefined();
  });
});
