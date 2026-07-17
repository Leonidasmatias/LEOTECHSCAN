// GENESIS PHASE 2 -- Increment 7 (Minimal IntelligenceOrchestrator).
// Pure unit tests for services/intelligence-runtime/intelligence-orchestrator.ts.
// No I/O, no node:sqlite -- the only DB-touching dependency (fetchLegacyDataTrustForSite)
// is faked; every other dependency is the real, unmodified pure adapter, mocking only
// at the correct boundary per this mission's own instruction.
import { describe, it, expect, vi } from "vitest";
import { createDataTrustOrchestrator, type DataTrustOrchestratorDeps } from "@/services/intelligence-runtime/intelligence-orchestrator";
import type { LegacyDataTrustReadResult } from "@/services/intelligence-adapters/data-trust-read-adapter";
import {
  adaptLegacySiteRow,
  toSiteEntityReference,
  adaptLegacyDataTrustResult,
  adaptLegacyRecommendation,
  deriveSiteSnapshot,
} from "@/services/intelligence-adapters";
import type { SiteRow } from "@/lib/types";

const FIXED_NOW = "2026-01-15T12:00:00.000Z";

function siteRow(overrides: Partial<SiteRow> = {}): SiteRow {
  return {
    id: 42,
    siteId: "SITE-42",
    site: "SITE-42",
    operadoraOrigem: "TIM",
    elemento: "Torre",
    tecnologia: "4G",
    municipio: "Sao Paulo",
    estado: "SP",
    uf: "SP",
    regional: "Sudeste",
    endereco: "Rua Exemplo, 100",
    status: "Ativo",
    projeto: "Rollout",
    tipoSite: "Torre",
    detentorInfra: "American Tower",
    tipoInfra: "Torre",
    latitude: -23.55,
    longitude: -46.63,
    populacao: 1000,
    altura: 30,
    geoScore: 80,
    risco: "Baixo",
    stationId: "ST-1",
    operadora: "TIM",
    oriScore: 70,
    oriRisk: "Baixo",
    dataImportacao: "2026-01-01",
    arquivoOrigem: "sites_jan_2026.xlsx",
    ...overrides,
  };
}

function legacyResult(overrides: Partial<LegacyDataTrustReadResult["trust"]> = {}, siteOverrides: Partial<SiteRow> = {}): LegacyDataTrustReadResult {
  return {
    site: siteRow(siteOverrides),
    trust: {
      trustScore: 85,
      trustLevel: "Alto",
      trustBadge: "Gold",
      recommendation: "Dado confiavel, recomenda-se revisar evidencias pendentes antes de decisoes criticas.",
      duplicateSuggestionPenalty: 0,
      activeAlertPenalty: 0,
      coordinateConfidence: 100,
      addressConfidence: 90,
      municipalityConfidence: 95,
      operatorConfidence: 95,
      technologyConfidence: 90,
      satelliteConfidence: 70,
      cadastralConfidence: 92,
      operationalConfidence: 80,
      overallConfidence: 88,
      ...overrides,
    },
  };
}

function buildDeps(overrides: Partial<DataTrustOrchestratorDeps> = {}): DataTrustOrchestratorDeps {
  return {
    fetchLegacyDataTrustForSite: vi.fn(() => legacyResult()),
    deriveSiteSnapshot: vi.fn(deriveSiteSnapshot),
    adaptLegacySiteRow: vi.fn(adaptLegacySiteRow),
    toSiteEntityReference: vi.fn(toSiteEntityReference),
    adaptLegacyDataTrustResult: vi.fn(adaptLegacyDataTrustResult),
    adaptLegacyRecommendation: vi.fn(adaptLegacyRecommendation),
    now: vi.fn(() => FIXED_NOW),
    environment: vi.fn(() => "test" as const),
    ...overrides,
  };
}

describe("createDataTrustOrchestrator", () => {
  it("1. returns notFound when the outer adapter finds no site", () => {
    const deps = buildDeps({ fetchLegacyDataTrustForSite: vi.fn(() => null) });
    const orchestrator = createDataTrustOrchestrator(deps);
    const result = orchestrator.getCanonicalDataTrustForSite(999);
    expect(result.notFound).toBe(true);
    expect(result.success).toBe(false);
    expect(result.score).toBeNull();
    expect(result.recommendations).toEqual([]);
    expect(result.snapshot).toBeNull();
  });

  it("2. calls the outer adapter with the requested siteId", () => {
    const deps = buildDeps();
    createDataTrustOrchestrator(deps).getCanonicalDataTrustForSite(42);
    expect(deps.fetchLegacyDataTrustForSite).toHaveBeenCalledWith(42);
  });

  it("3. derives the Snapshot from the site's dataImportacao/arquivoOrigem", () => {
    const result = createDataTrustOrchestrator(buildDeps()).getCanonicalDataTrustForSite(42);
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.kind).toBe("derived");
    expect(result.snapshot?.source).toBe("data_importacao");
    expect(result.snapshot?.snapshotId).toBe("derived:data-importacao:2026-01-01");
  });

  it("4. produces a successful canonical Score for a well-formed site", () => {
    const result = createDataTrustOrchestrator(buildDeps()).getCanonicalDataTrustForSite(42);
    expect(result.success).toBe(true);
    expect(result.score).not.toBeNull();
    expect(result.score?.type).toBe("data-trust");
    expect(result.score?.value).toBeCloseTo(0.85);
  });

  it("5. produces exactly one DATA_TRUST_TEXT Recommendation from the legacy recommendation text", () => {
    const result = createDataTrustOrchestrator(buildDeps()).getCanonicalDataTrustForSite(42);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].reason).toBe(
      "Dado confiavel, recomenda-se revisar evidencias pendentes antes de decisoes criticas.",
    );
    expect(result.recommendations[0].metadata.legacyType).toBe("DATA_TRUST_TEXT");
  });

  it("6. constructs a CalculationContext-derived summary using the injected clock, not a real one", () => {
    const result = createDataTrustOrchestrator(buildDeps()).getCanonicalDataTrustForSite(42);
    expect(result.context).not.toBeNull();
    expect(result.context?.requestedAt).toBe(FIXED_NOW);
    expect(result.context?.contextId).toBe(`context:data-trust:42:${FIXED_NOW}`);
    expect(result.context?.requestedBy).toBe("api:intelligence/data-trust/site");
    expect(result.context?.environment).toBe("test");
  });

  it("7. aggregates Score and Recommendation limitations", () => {
    const result = createDataTrustOrchestrator(buildDeps()).getCanonicalDataTrustForSite(42);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it("8. discloses the Snapshot's own limitation when the synthetic fallback fires", () => {
    const deps = buildDeps({
      fetchLegacyDataTrustForSite: vi.fn(() => legacyResult({}, { dataImportacao: "", arquivoOrigem: "" })),
    });
    const result = createDataTrustOrchestrator(deps).getCanonicalDataTrustForSite(42);
    expect(result.snapshot?.kind).toBe("synthetic");
    expect(result.limitations.some((l) => l.description.includes("synthetic placeholder"))).toBe(true);
  });

  it("9. reports a stage:'site' failure and produces no Score/Recommendation when Site adaptation fails", () => {
    const deps = buildDeps({
      fetchLegacyDataTrustForSite: vi.fn(() => legacyResult({}, { municipio: "Não informado", uf: "Não informado" })),
    });
    const result = createDataTrustOrchestrator(deps).getCanonicalDataTrustForSite(42);
    expect(result.success).toBe(false);
    expect(result.score).toBeNull();
    expect(result.recommendations).toEqual([]);
    expect(result.issues.some((i) => i.stage === "site")).toBe(true);
    // Snapshot is still disclosed even though Site adaptation failed for an unrelated reason.
    expect(result.snapshot).not.toBeNull();
  });

  it("10. is deterministic: identical input and injected clock produce identical output", () => {
    const a = createDataTrustOrchestrator(buildDeps()).getCanonicalDataTrustForSite(42);
    const b = createDataTrustOrchestrator(buildDeps()).getCanonicalDataTrustForSite(42);
    expect(a).toEqual(b);
  });

  it("11. never calls anything not present in its injected dependencies (no persistence/cache/audit is reachable)", () => {
    const deps = buildDeps();
    createDataTrustOrchestrator(deps).getCanonicalDataTrustForSite(42);
    // Every dependency actually used is exactly one of the seven injected functions --
    // there is no eighth dependency for persistence/cache/audit/lifecycle to have been
    // wired in the first place (DataTrustOrchestratorDeps has no such field).
    expect(Object.keys(deps).sort()).toEqual(
      ["adaptLegacyDataTrustResult", "adaptLegacyRecommendation", "adaptLegacySiteRow", "deriveSiteSnapshot", "environment", "fetchLegacyDataTrustForSite", "now", "toSiteEntityReference"].sort(),
    );
  });

  it("12. calls each pure dependency exactly once per request", () => {
    const deps = buildDeps();
    createDataTrustOrchestrator(deps).getCanonicalDataTrustForSite(42);
    expect(deps.fetchLegacyDataTrustForSite).toHaveBeenCalledTimes(1);
    expect(deps.deriveSiteSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.adaptLegacySiteRow).toHaveBeenCalledTimes(1);
    expect(deps.toSiteEntityReference).toHaveBeenCalledTimes(1);
    expect(deps.adaptLegacyDataTrustResult).toHaveBeenCalledTimes(1);
    expect(deps.adaptLegacyRecommendation).toHaveBeenCalledTimes(1);
  });

  it("13. does not mutate the legacy result returned by the outer adapter", () => {
    const legacy = legacyResult();
    const frozen = Object.freeze({ site: Object.freeze(legacy.site), trust: Object.freeze(legacy.trust) });
    const deps = buildDeps({ fetchLegacyDataTrustForSite: vi.fn(() => frozen as LegacyDataTrustReadResult) });
    expect(() => createDataTrustOrchestrator(deps).getCanonicalDataTrustForSite(42)).not.toThrow();
  });
});
