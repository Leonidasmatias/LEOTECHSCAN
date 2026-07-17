// GENESIS PHASE 2 -- Increment 9 (Minimal Site Intelligence Aggregator).
// Pure unit tests for services/intelligence-runtime/site-intelligence-aggregator.ts.
// No I/O, no node:sqlite -- both capability entry points are faked; the
// aggregator core itself is exercised directly with injected fakes.
import { describe, it, expect, vi } from "vitest";
import {
  createSiteIntelligenceAggregator,
  type SiteIntelligenceAggregatorDeps,
} from "@/services/intelligence-runtime/site-intelligence-aggregator";
import type { CanonicalDataTrustOrchestrationResult } from "@/services/intelligence-runtime/intelligence-orchestrator";
import type { CanonicalEvidenceOrchestrationResult } from "@/services/intelligence-runtime/intelligence-evidence-orchestrator";
import { deriveSiteSnapshot } from "@/services/intelligence-adapters";

const FIXED_NOW = "2026-01-15T12:00:00.000Z";

const SNAPSHOT_A = deriveSiteSnapshot({ dataImportacao: "2026-01-01", arquivoOrigem: "sites_jan.xlsx" });
const SNAPSHOT_B = deriveSiteSnapshot({ dataImportacao: "2026-02-01", arquivoOrigem: "sites_feb.xlsx" });

function dataTrustResult(overrides: Partial<CanonicalDataTrustOrchestrationResult> = {}): CanonicalDataTrustOrchestrationResult {
  return {
    notFound: false,
    success: true,
    siteId: "42",
    snapshot: SNAPSHOT_A,
    context: {
      contextId: "context:data-trust:42:2026-01-15T11:59:59.000Z",
      correlationId: "correlation:data-trust:42:2026-01-15T11:59:59.000Z",
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
    snapshot: SNAPSHOT_A,
    context: {
      contextId: "context:evidence:42:2026-01-15T12:00:00.500Z",
      correlationId: "correlation:evidence:42:2026-01-15T12:00:00.500Z",
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

function notFoundDataTrust(): CanonicalDataTrustOrchestrationResult {
  return {
    notFound: true,
    success: false,
    siteId: "999",
    snapshot: null,
    context: null,
    score: null,
    recommendations: [],
    issues: [],
    limitations: [],
  };
}

function notFoundEvidence(): CanonicalEvidenceOrchestrationResult {
  return {
    notFound: true,
    success: false,
    siteId: "999",
    snapshot: null,
    context: null,
    evidence: [],
    issues: [],
    limitations: [],
  };
}

function buildDeps(overrides: Partial<SiteIntelligenceAggregatorDeps> = {}): SiteIntelligenceAggregatorDeps {
  return {
    getCanonicalDataTrustForSite: vi.fn(() => dataTrustResult()),
    getCanonicalEvidenceForSite: vi.fn(() => evidenceResult()),
    now: vi.fn(() => FIXED_NOW),
    environment: vi.fn(() => "test" as const),
    ...overrides,
  };
}

describe("createSiteIntelligenceAggregator", () => {
  it("1. both capabilities succeed -> status complete", () => {
    const deps = buildDeps();
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.status).toBe("complete");
    expect(result.notFound).toBe(false);
    expect(result.dataTrust.state).toBe("available");
    expect(result.evidenceCenter.state).toBe("available");
  });

  it("2. Data Trust succeeds, Evidence Center throws -> status partial", () => {
    const deps = buildDeps({
      getCanonicalEvidenceForSite: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.status).toBe("partial");
    expect(result.dataTrust.state).toBe("available");
    expect(result.evidenceCenter.state).toBe("unavailable");
    expect(result.evidenceCenter.result).toBeNull();
    expect(result.evidenceCenter.errorName).toBe("Error");
  });

  it("3. Evidence Center succeeds, Data Trust throws -> status partial", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.status).toBe("partial");
    expect(result.dataTrust.state).toBe("unavailable");
    expect(result.evidenceCenter.state).toBe("available");
  });

  it("4. both capabilities throw -> status failed, HTTP-mappable, no usable envelope from either", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => {
        throw new Error("dt-down");
      }),
      getCanonicalEvidenceForSite: vi.fn(() => {
        throw new Error("ec-down");
      }),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.status).toBe("failed");
    expect(result.dataTrust.state).toBe("unavailable");
    expect(result.evidenceCenter.state).toBe("unavailable");
    expect(result.dataTrust.result).toBeNull();
    expect(result.evidenceCenter.result).toBeNull();
  });

  it("5. both capabilities report adaptation.success=false with real results -> partial, never failed", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => dataTrustResult({ success: false })),
      getCanonicalEvidenceForSite: vi.fn(() => evidenceResult({ success: false })),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.status).toBe("partial");
    expect(result.status).not.toBe("failed");
    expect(result.dataTrust.state).toBe("available");
    expect(result.evidenceCenter.state).toBe("available");
    expect(result.dataTrust.result?.success).toBe(false);
    expect(result.evidenceCenter.result?.success).toBe(false);
  });

  it("6. one adaptation.success=false, the other true -> partial", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => dataTrustResult({ success: false })),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.status).toBe("partial");
  });

  it("7. both capabilities report notFound -> aggregate notFound, no snapshot comparison attempted", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => notFoundDataTrust()),
      getCanonicalEvidenceForSite: vi.fn(() => notFoundEvidence()),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(999);
    expect(result.notFound).toBe(true);
    expect(result.snapshot).toBeNull();
    expect(result.issues).toEqual([]);
  });

  it('7b. (post-audit hardening, F-2) both-notFound carries internal status "notFound", never "failed"', () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => notFoundDataTrust()),
      getCanonicalEvidenceForSite: vi.fn(() => notFoundEvidence()),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(999);
    expect(result.notFound).toBe(true);
    expect(result.status).toBe("notFound");
    expect(result.status).not.toBe("failed");
  });

  it("8. one notFound, one found -> exactly one notfound-inconsistency issue", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => notFoundDataTrust()),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.notFound).toBe(false);
    const notFoundIssues = result.issues.filter((i) => i.stage === "notfound-inconsistency");
    expect(notFoundIssues).toHaveLength(1);
    expect(notFoundIssues[0].code).toBe("notfound_inconsistency");
    expect(result.status).toBe("partial");
  });

  it("9. not-found inconsistency never also produces a snapshot-mismatch issue for the same request", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => notFoundDataTrust()),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    const snapshotIssues = result.issues.filter((i) => i.stage === "snapshot-consistency");
    expect(snapshotIssues).toHaveLength(0);
    expect(result.snapshot).toBeNull();
  });

  it("10. matching snapshots are surfaced as the aggregate's own snapshot", () => {
    const deps = buildDeps();
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.snapshotId).toBe(SNAPSHOT_A.snapshotId);
    expect(result.issues.filter((i) => i.stage === "snapshot-consistency")).toHaveLength(0);
  });

  it("11. mismatching snapshots -> aggregate snapshot null and exactly one snapshot issue, never complete", () => {
    const deps = buildDeps({
      getCanonicalEvidenceForSite: vi.fn(() => evidenceResult({ snapshot: SNAPSHOT_B })),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.snapshot).toBeNull();
    const mismatchIssues = result.issues.filter((i) => i.code === "snapshot_mismatch");
    expect(mismatchIssues).toHaveLength(1);
    expect(result.status).not.toBe("complete");
  });

  it("12. snapshot comparison is skipped (no issue of either kind) when one capability is unavailable", () => {
    const deps = buildDeps({
      getCanonicalEvidenceForSite: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.issues.filter((i) => i.stage === "snapshot-consistency")).toHaveLength(0);
    expect(result.snapshot).not.toBeNull(); // Data Trust's own real snapshot is still surfaced
  });

  it("13. now() is called exactly once per request", () => {
    const deps = buildDeps();
    createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(deps.now).toHaveBeenCalledTimes(1);
  });

  it("14. deterministic output under a fixed injected clock", () => {
    const deps = buildDeps();
    const first = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    const second = createSiteIntelligenceAggregator(buildDeps()).getCanonicalSiteIntelligence(42);
    expect(first.context).toEqual(second.context);
  });

  it("15. one capability throwing never suppresses the other's real result", () => {
    const deps = buildDeps({
      getCanonicalEvidenceForSite: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.dataTrust.state).toBe("available");
    expect(result.dataTrust.result?.success).toBe(true);
  });

  it("16. call order is deterministic: Data Trust before Evidence Center", () => {
    const callOrder: string[] = [];
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => {
        callOrder.push("data-trust");
        return dataTrustResult();
      }),
      getCanonicalEvidenceForSite: vi.fn(() => {
        callOrder.push("evidence-center");
        return evidenceResult();
      }),
    });
    createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(callOrder).toEqual(["data-trust", "evidence-center"]);
  });

  it("17. differing nested requestedAt timestamps between capabilities do not produce any aggregate context-consistency issue", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() =>
        dataTrustResult({ context: { ...dataTrustResult().context!, requestedAt: "2026-01-15T11:00:00.000Z" } }),
      ),
      getCanonicalEvidenceForSite: vi.fn(() =>
        evidenceResult({ context: { ...evidenceResult().context!, requestedAt: "2026-01-15T13:00:00.000Z" } }),
      ),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(result.status).toBe("complete");
    expect(result.issues).toHaveLength(0);
  });

  it("18. never mutates the results returned by either injected capability function", () => {
    const dt = dataTrustResult();
    const ec = evidenceResult();
    const dtCopy = JSON.parse(JSON.stringify(dt));
    const ecCopy = JSON.parse(JSON.stringify(ec));
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => dt),
      getCanonicalEvidenceForSite: vi.fn(() => ec),
    });
    createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(42);
    expect(dt).toEqual(dtCopy);
    expect(ec).toEqual(ecCopy);
  });

  it("19. both capabilities agree not-found is checked before either capability's own success/adaptation content is inspected", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => notFoundDataTrust()),
      getCanonicalEvidenceForSite: vi.fn(() => notFoundEvidence()),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(999);
    expect(result.notFound).toBe(true);
    expect(result.context).toBeNull();
  });

  it("20. (post-audit hardening, F-1, formally documented in the plan Section 8) hybrid combination: Data Trust unavailable, Evidence Center notFound -> status failed, no usable envelope anywhere", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => {
        throw new Error("dt-down");
      }),
      getCanonicalEvidenceForSite: vi.fn(() => notFoundEvidence()),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(999);
    expect(result.status).toBe("failed");
    expect(result.notFound).toBe(false);
    expect(result.dataTrust.state).toBe("unavailable");
    expect(result.evidenceCenter.state).toBe("notFound");
  });

  it("21. (post-audit hardening, F-1, mirror combination) Evidence Center unavailable, Data Trust notFound -> status failed, no usable envelope anywhere", () => {
    const deps = buildDeps({
      getCanonicalDataTrustForSite: vi.fn(() => notFoundDataTrust()),
      getCanonicalEvidenceForSite: vi.fn(() => {
        throw new Error("ec-down");
      }),
    });
    const result = createSiteIntelligenceAggregator(deps).getCanonicalSiteIntelligence(999);
    expect(result.status).toBe("failed");
    expect(result.notFound).toBe(false);
    expect(result.dataTrust.state).toBe("notFound");
    expect(result.evidenceCenter.state).toBe("unavailable");
  });
});
