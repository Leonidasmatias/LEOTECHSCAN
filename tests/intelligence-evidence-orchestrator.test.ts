// GENESIS PHASE 2 -- Increment 8 (Minimal Evidence Orchestrator).
// Pure unit tests for services/intelligence-runtime/intelligence-evidence-orchestrator.ts.
// No I/O, no node:sqlite -- the only DB-touching dependency
// (fetchLegacyEvidenceCenterForSite) is faked; every other dependency is the real,
// unmodified pure adapter, mocking only at the correct boundary.
import { describe, it, expect, vi } from "vitest";
import { createEvidenceOrchestrator, type EvidenceOrchestratorDeps } from "@/services/intelligence-runtime/intelligence-evidence-orchestrator";
import type { LegacyEvidenceCenterReadResult } from "@/services/intelligence-adapters/evidence-center-read-adapter";
import {
  adaptLegacySiteRow,
  toSiteEntityReference,
  adaptLegacyEvidence,
  deriveSiteSnapshot,
  computeEvidenceChecksum,
} from "@/services/intelligence-adapters";
import type { SiteRow } from "@/lib/types";
import type { LegacyEvidenceItem } from "@/services/intelligence-adapters";

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

const FIVE_EVIDENCE_ITEMS: LegacyEvidenceItem[] = [
  { type: "CADASTRO", source: "vivo_sites.xlsx", status: "Disponivel", summary: "SITE-42 - TIM - Sao Paulo/SP" },
  { type: "COORDENADAS", source: "SQLite sites", status: "Validado", summary: "-23.55, -46.63" },
  { type: "COPERNICUS", source: "Sentinel-1 metadata_only", status: "Media", summary: "Evidencia satelital util" },
  { type: "QUALIDADE", source: "Data Trust Engine", status: "Gold", summary: "Trust Score 85" },
  { type: "OBSERVACOES", source: "site_notes", status: "Disponivel", summary: "2 observacoes locais" },
];

function legacyResult(overrides: Partial<SiteRow> = {}, itemsOverride?: LegacyEvidenceItem[]): LegacyEvidenceCenterReadResult {
  return {
    site: siteRow(overrides),
    evidences: itemsOverride ?? FIVE_EVIDENCE_ITEMS,
  };
}

function buildDeps(overrides: Partial<EvidenceOrchestratorDeps> = {}): EvidenceOrchestratorDeps {
  return {
    fetchLegacyEvidenceCenterForSite: vi.fn(() => legacyResult()),
    deriveSiteSnapshot: vi.fn(deriveSiteSnapshot),
    adaptLegacySiteRow: vi.fn(adaptLegacySiteRow),
    toSiteEntityReference: vi.fn(toSiteEntityReference),
    computeEvidenceChecksum: vi.fn(computeEvidenceChecksum),
    adaptLegacyEvidence: vi.fn(adaptLegacyEvidence),
    now: vi.fn(() => FIXED_NOW),
    environment: vi.fn(() => "test" as const),
    ...overrides,
  };
}

describe("createEvidenceOrchestrator", () => {
  it("1. returns notFound when the outer adapter finds no site", () => {
    const deps = buildDeps({ fetchLegacyEvidenceCenterForSite: vi.fn(() => null) });
    const result = createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(999);
    expect(result.notFound).toBe(true);
    expect(result.success).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.snapshot).toBeNull();
  });

  it("2. calls the outer adapter with the requested siteId, exactly once", () => {
    const deps = buildDeps();
    createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(deps.fetchLegacyEvidenceCenterForSite).toHaveBeenCalledWith(42);
    expect(deps.fetchLegacyEvidenceCenterForSite).toHaveBeenCalledTimes(1);
  });

  it("3. derives the Snapshot exactly once per request", () => {
    const deps = buildDeps();
    createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(deps.deriveSiteSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.deriveSiteSnapshot).toHaveBeenCalledWith({ dataImportacao: "2026-01-01", arquivoOrigem: "sites_jan_2026.xlsx" });
  });

  it("4. calls now() exactly once per request", () => {
    const deps = buildDeps();
    createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(deps.now).toHaveBeenCalledTimes(1);
  });

  it("5. computes exactly one checksum per evidence item (five calls for five items)", () => {
    const deps = buildDeps();
    createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(deps.computeEvidenceChecksum).toHaveBeenCalledTimes(5);
  });

  it("6. calls adaptLegacyEvidence individually once per item, never a batch wrapper", () => {
    const deps = buildDeps();
    createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(deps.adaptLegacyEvidence).toHaveBeenCalledTimes(5);
  });

  it("7. produces exactly five canonical Evidence records for a well-formed site", () => {
    const result = createEvidenceOrchestrator(buildDeps()).getCanonicalEvidenceForSite(42);
    expect(result.success).toBe(true);
    expect(result.evidence).toHaveLength(5);
    expect(result.evidence.map((e) => e.metadata.legacyType)).toEqual([
      "CADASTRO",
      "COORDENADAS",
      "COPERNICUS",
      "QUALIDADE",
      "OBSERVACOES",
    ]);
  });

  it("8. preserves the legacy array's own order, never re-sorting", () => {
    const result = createEvidenceOrchestrator(buildDeps()).getCanonicalEvidenceForSite(42);
    const types = result.evidence.map((e) => e.metadata.legacyType);
    expect(types).toEqual(FIVE_EVIDENCE_ITEMS.map((i) => i.type));
  });

  it("9. every item shares the same Snapshot and the same timestamp", () => {
    const result = createEvidenceOrchestrator(buildDeps()).getCanonicalEvidenceForSite(42);
    const snapshots = new Set(result.evidence.map((e) => e.snapshot));
    const timestamps = new Set(result.evidence.map((e) => e.createdAt));
    expect(snapshots.size).toBe(1);
    expect(timestamps.size).toBe(1);
  });

  it("10. each evidence item has its own distinct checksum", () => {
    const result = createEvidenceOrchestrator(buildDeps()).getCanonicalEvidenceForSite(42);
    const checksums = result.evidence.map((e) => e.checksum);
    expect(new Set(checksums).size).toBe(5);
  });

  it("11. produces deterministic EvidenceIds keyed by siteId and type", () => {
    const result = createEvidenceOrchestrator(buildDeps()).getCanonicalEvidenceForSite(42);
    expect(result.evidence[0].id).toBe("evidence:42:CADASTRO");
    expect(result.evidence[2].id).toBe("evidence:42:COPERNICUS");
  });

  it("12. constructs a context summary using the injected clock, not a real one", () => {
    const result = createEvidenceOrchestrator(buildDeps()).getCanonicalEvidenceForSite(42);
    expect(result.context).not.toBeNull();
    expect(result.context?.requestedAt).toBe(FIXED_NOW);
    expect(result.context?.contextId).toBe(`context:evidence:42:${FIXED_NOW}`);
    expect(result.context?.requestedBy).toBe("api:intelligence/evidence-center/site");
    expect(result.context?.environment).toBe("test");
  });

  it("13. reports a stage:'site' failure and produces no evidence when Site adaptation fails", () => {
    const deps = buildDeps({
      fetchLegacyEvidenceCenterForSite: vi.fn(() => legacyResult({ municipio: "Não informado", uf: "Não informado" })),
    });
    const result = createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(result.success).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.issues.some((i) => i.stage === "site")).toBe(true);
    expect(result.snapshot).not.toBeNull();
  });

  it("14. is deterministic: identical input and injected clock produce identical output", () => {
    const a = createEvidenceOrchestrator(buildDeps()).getCanonicalEvidenceForSite(42);
    const b = createEvidenceOrchestrator(buildDeps()).getCanonicalEvidenceForSite(42);
    expect(a).toEqual(b);
  });

  it("15. a genuinely empty legacy evidence list produces a genuinely successful empty result", () => {
    const deps = buildDeps({ fetchLegacyEvidenceCenterForSite: vi.fn(() => legacyResult({}, [])) });
    const result = createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(result.success).toBe(true);
    expect(result.evidence).toEqual([]);
  });

  it("16. issues from a failed item are tagged with that item's own type in the field", () => {
    const badItems: LegacyEvidenceItem[] = [{ type: "CADASTRO", source: "", status: "Disponivel", summary: "" }];
    const deps = buildDeps({ fetchLegacyEvidenceCenterForSite: vi.fn(() => legacyResult({}, badItems)) });
    const result = createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(result.success).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.issues.some((i) => i.stage === "evidence" && i.field.startsWith("CADASTRO."))).toBe(true);
  });

  it("17. never calls anything not present in its injected dependencies", () => {
    const deps = buildDeps();
    createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);
    expect(Object.keys(deps).sort()).toEqual(
      [
        "adaptLegacyEvidence",
        "adaptLegacySiteRow",
        "computeEvidenceChecksum",
        "deriveSiteSnapshot",
        "environment",
        "fetchLegacyEvidenceCenterForSite",
        "now",
        "toSiteEntityReference",
      ].sort(),
    );
  });

  it("18. does not mutate the legacy result returned by the outer adapter", () => {
    const legacy = legacyResult();
    const frozen = Object.freeze({ site: Object.freeze(legacy.site), evidences: Object.freeze(legacy.evidences) });
    const deps = buildDeps({ fetchLegacyEvidenceCenterForSite: vi.fn(() => frozen as LegacyEvidenceCenterReadResult) });
    expect(() => createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42)).not.toThrow();
  });

  it("19. documents the accepted duplicate-type EvidenceId collision inherited from the reused Evidence Adapter", () => {
    // Post-audit regression (independent audit finding F-1). Only
    // fetchLegacyEvidenceCenterForSite is faked -- computeEvidenceChecksum,
    // deriveSiteSnapshot, adaptLegacySiteRow, toSiteEntityReference, and
    // adaptLegacyEvidence are all the real, unmodified implementations.
    //
    // adaptLegacyEvidence (Increment 5, reused verbatim, not modified by
    // this fix) derives EvidenceId as `evidence:${idSeed}:${evidenceType}`.
    // This Orchestrator supplies idSeed = String(siteId), shared by every
    // item in one request (Section 12 of the design doc). Two legacy items
    // that happen to share the same `type` therefore collide onto the
    // identical EvidenceId, even when their content is genuinely different
    // (proving the collision is a true identity collapse, not merely two
    // occurrences of identical content producing identical output by
    // design).
    //
    // This is not reachable in today's production flow:
    // evidenceCenterForSite() always emits exactly five items with five
    // distinct types (CADASTRO/COORDENADAS/COPERNICUS/QUALIDADE/OBSERVACOES),
    // and Principle 2 forbids modifying that legacy engine to introduce a
    // duplicate. It is the same structural characteristic Increment 6 already
    // found, accepted, and documented for Recommendation's identical
    // `recommendation:${idSeed}:${type}` scheme (the GLOBAL_RULE collision) --
    // this test gives Evidence's analogous, currently-dormant case the same
    // explicit, tested documentation, per the reused adapter's own explicit
    // "do not redesign identity" scope boundary (this increment must not
    // modify evidence-adapter.ts).
    const duplicateTypeItems: LegacyEvidenceItem[] = [
      { type: "CADASTRO", source: "vivo_sites.xlsx", status: "Disponivel", summary: "First CADASTRO item for this site" },
      { type: "CADASTRO", source: "different_source.xlsx", status: "Pendente", summary: "Second, semantically different CADASTRO item" },
    ];
    const deps = buildDeps({ fetchLegacyEvidenceCenterForSite: vi.fn(() => legacyResult({}, duplicateTypeItems)) });
    const result = createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(42);

    expect(result.success).toBe(true);
    expect(result.evidence).toHaveLength(2);

    // Both items adapt successfully and remain in their original order.
    expect(result.evidence[0].description).toBe("First CADASTRO item for this site");
    expect(result.evidence[1].description).toBe("Second, semantically different CADASTRO item");

    // Checksums differ -- the two items are genuinely different content.
    expect(result.evidence[0].checksum).not.toBe(result.evidence[1].checksum);

    // Yet the canonical EvidenceIds are identical -- the accepted, inherited
    // collision this test exists to document, not silently hide.
    expect(result.evidence[0].id).toBe("evidence:42:CADASTRO");
    expect(result.evidence[1].id).toBe("evidence:42:CADASTRO");
    expect(result.evidence[0].id).toBe(result.evidence[1].id);
  });
});
