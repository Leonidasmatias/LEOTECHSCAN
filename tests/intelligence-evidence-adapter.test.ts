// GENESIS PHASE 2 -- Increment 5 (Evidence Adapter), hardened per the independent
// pre-commit audit. Pure unit tests for
// services/intelligence-adapters/evidence-adapter.ts. No I/O, no node:sqlite --
// constructed entirely from plain object literals.
import { describe, it, expect } from "vitest";
import {
  adaptLegacyEvidence,
  adaptLegacyEvidenceList,
  LEGACY_EVIDENCE_TYPES,
  EVIDENCE_ADAPTER_UNMAPPED_FIELDS,
  type LegacyEvidenceItem,
  type EvidenceAdapterContext,
} from "@/services/intelligence-adapters";
import { validateEvidenceShape } from "@/services/intelligence";
// isTruthfulCopernicusResponse belongs to services/copernicus-truth.ts, not the adapter
// layer -- imported directly from its real source, not re-exported through the adapter
// barrel (removed during pre-commit hardening; see 21_INCREMENT_5_EVIDENCE_ADAPTER.md).
import { isTruthfulCopernicusResponse } from "@/services/copernicus-truth";

function legacyItem(overrides: Partial<LegacyEvidenceItem> = {}): LegacyEvidenceItem {
  return {
    type: "CADASTRO",
    source: "vivo_sites.xlsx",
    status: "Disponivel",
    summary: "SITE042 - VIVO - Sao Paulo/SP",
    ...overrides,
  };
}

function context(overrides: Partial<EvidenceAdapterContext> = {}): EvidenceAdapterContext {
  return {
    idSeed: "42",
    snapshot: "snapshot-2026-01-15",
    source: "evidence-center-import",
    checksum: "abc123checksum",
    timestamp: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

describe("adaptLegacyEvidence", () => {
  it("adapts a complete, valid legacy evidence item successfully", () => {
    const result = adaptLegacyEvidence(legacyItem(), context());
    expect(result.success).toBe(true);
    expect(result.evidence).not.toBeNull();
    expect(result.evidence?.kind).toBe("Evidence");
  });

  it("the produced Evidence passes canonical structural validation", () => {
    const result = adaptLegacyEvidence(legacyItem(), context());
    const structural = validateEvidenceShape(result.evidence);
    expect(structural.valid).toBe(true);
    expect(structural.issues).toHaveLength(0);
  });

  it("the input item is never mutated", () => {
    const item = legacyItem();
    const pristine = JSON.parse(JSON.stringify(item));
    adaptLegacyEvidence(item, context());
    expect(item).toEqual(pristine);
  });

  it("the context is never mutated", () => {
    const ctx = context();
    const pristine = JSON.parse(JSON.stringify(ctx));
    adaptLegacyEvidence(legacyItem(), ctx);
    expect(ctx).toEqual(pristine);
  });

  it("the same input produces identical output (deterministic)", () => {
    const item = legacyItem();
    const ctx = context();
    const a = adaptLegacyEvidence(item, ctx);
    const b = adaptLegacyEvidence(item, ctx);
    expect(a).toEqual(b);
  });

  it("repeated calls do not accumulate state", () => {
    const first = adaptLegacyEvidence(legacyItem({ type: "CADASTRO" }), context({ idSeed: "1" }));
    const second = adaptLegacyEvidence(legacyItem({ type: "COORDENADAS" }), context({ idSeed: "2" }));
    const third = adaptLegacyEvidence(legacyItem({ type: "CADASTRO" }), context({ idSeed: "1" }));
    expect(first).toEqual(third);
    expect(first.evidence?.id).not.toBe(second.evidence?.id);
  });

  it("the result is JSON-serializable", () => {
    const result = adaptLegacyEvidence(legacyItem(), context());
    expect(() => JSON.stringify(result)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped.success).toBe(true);
  });

  it("metadata preserves the raw legacy type and status", () => {
    const result = adaptLegacyEvidence(legacyItem({ type: "QUALIDADE", status: "Gold" }), context());
    expect(result.evidence?.metadata.legacyType).toBe("QUALIDADE");
    expect(result.evidence?.metadata.legacyStatus).toBe("Gold");
  });

  it("source and description map directly from the legacy source/summary fields", () => {
    const result = adaptLegacyEvidence(
      legacyItem({ source: "Data Trust Engine", summary: "Trust Score 85" }),
      context(),
    );
    expect(result.evidence?.source).toBe("Data Trust Engine");
    expect(result.evidence?.description).toBe("Trust Score 85");
  });

  it("sourceReference preserves all four raw legacy fields verbatim", () => {
    const item = legacyItem({ type: "OBSERVACOES", source: "site_notes", status: "Disponivel", summary: "3 observacoes locais" });
    const result = adaptLegacyEvidence(item, context());
    expect(result.sourceReference).toEqual({
      rawType: "OBSERVACOES",
      rawSource: "site_notes",
      rawStatus: "Disponivel",
      rawSummary: "3 observacoes locais",
    });
  });

  it("missing optional context.version defaults to a static adapter version", () => {
    const result = adaptLegacyEvidence(legacyItem(), context());
    expect(result.evidence?.origin.version).toBe("0.1.0");
  });

  it("an explicit context.version overrides the default", () => {
    const result = adaptLegacyEvidence(legacyItem(), context({ version: "2.0.0" }));
    expect(result.evidence?.origin.version).toBe("2.0.0");
  });

  it("malformed evidence (missing source) fails without throwing", () => {
    expect(() => adaptLegacyEvidence(legacyItem({ source: "" }), context())).not.toThrow();
    const result = adaptLegacyEvidence(legacyItem({ source: "" }), context());
    expect(result.success).toBe(false);
    expect(result.evidence).toBeNull();
    expect(result.issues.some((i) => i.code === "missing_source")).toBe(true);
  });

  it("malformed evidence (missing summary/description) fails without throwing", () => {
    const result = adaptLegacyEvidence(legacyItem({ summary: "   " }), context());
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_description")).toBe(true);
  });

  it("missing idSeed blocks success (would otherwise collide across subjects)", () => {
    const result = adaptLegacyEvidence(legacyItem(), context({ idSeed: "" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_id_seed")).toBe(true);
  });

  it("missing snapshot blocks success (no legacy snapshot mechanism exists)", () => {
    const result = adaptLegacyEvidence(legacyItem(), context({ snapshot: "" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_snapshot")).toBe(true);
  });

  it("missing checksum blocks success", () => {
    const result = adaptLegacyEvidence(legacyItem(), context({ checksum: "" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_checksum")).toBe(true);
  });

  it("missing timestamp blocks success", () => {
    const result = adaptLegacyEvidence(legacyItem(), context({ timestamp: "" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_evaluated_at")).toBe(true);
  });

  it("an invalid timestamp emits a blocking issue", () => {
    const result = adaptLegacyEvidence(legacyItem(), context({ timestamp: "not-a-date" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "invalid_timestamp")).toBe(true);
  });

  it("an unrecognized evidence type does not block success, but is flagged", () => {
    const result = adaptLegacyEvidence(legacyItem({ type: "FUTURE_TYPE" }), context());
    expect(result.success).toBe(true);
    expect(result.issues.some((i) => i.code === "unrecognized_evidence_type")).toBe(true);
  });

  it("every known legacy evidence type adapts successfully", () => {
    for (const type of LEGACY_EVIDENCE_TYPES) {
      const result = adaptLegacyEvidence(legacyItem({ type }), context());
      expect(result.success).toBe(true);
    }
  });

  it("unmappedFields is always empty -- every LegacyEvidenceItem field has a canonical home", () => {
    const result = adaptLegacyEvidence(legacyItem(), context());
    expect(result.unmappedFields).toBe(EVIDENCE_ADAPTER_UNMAPPED_FIELDS);
    expect(result.unmappedFields).toEqual([]);
  });

  it("evidence has no database, framework, or engine dependency (no throw, pure computation)", () => {
    expect(() => adaptLegacyEvidence(legacyItem(), context())).not.toThrow();
  });

  it("issues never contain a planted distinctive marker", () => {
    const marker = "UNIQUE-MARKER-DO-NOT-LEAK-4d1e";
    const result = adaptLegacyEvidence(legacyItem({ source: "" }), context({ timestamp: marker }));
    for (const issueItem of result.issues) {
      expect(JSON.stringify(issueItem)).not.toContain(marker);
    }
  });

  describe("policy-default disclosure (pre-commit hardening)", () => {
    it("non-Copernicus weight is literally 1", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "CADASTRO" }), context());
      expect(result.evidence?.weight).toBe(1);
    });

    it("non-Copernicus reliability is literally 0.5", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "CADASTRO" }), context());
      expect(result.evidence?.reliability).toBe(0.5);
    });

    it("non-Copernicus metadata explicitly discloses the policy defaults", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "OBSERVACOES" }), context());
      expect(result.evidence?.metadata.policyDefaultsApplied).toBe(true);
      expect(result.evidence?.metadata.weightSource).toBe("adapter_policy_default");
      expect(result.evidence?.metadata.reliabilitySource).toBe("adapter_policy_default");
    });

    it("non-Copernicus items carry the policy_default_values_applied issue", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "QUALIDADE" }), context());
      const found = result.issues.find((i) => i.code === "policy_default_values_applied");
      expect(found).toBeTruthy();
      expect(found?.severity).toBe("informational");
      expect(found?.canContinue).toBe(true);
    });

    it("the policy-default issue is non-blocking: success remains true and evidence is still returned", () => {
      const result = adaptLegacyEvidence(legacyItem(), context());
      expect(result.issues.some((i) => i.code === "policy_default_values_applied")).toBe(true);
      expect(result.success).toBe(true);
      expect(result.evidence).not.toBeNull();
    });

    it("the policy-default issue is deterministic and JSON-serializable", () => {
      const a = adaptLegacyEvidence(legacyItem(), context());
      const b = adaptLegacyEvidence(legacyItem(), context());
      expect(a.issues).toEqual(b.issues);
      expect(() => JSON.stringify(a.issues)).not.toThrow();
    });

    it("Copernicus items do NOT also carry the generic policy_default_values_applied issue (behavior B: no redundant disclosure)", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "COPERNICUS" }), context());
      expect(result.issues.some((i) => i.code === "policy_default_values_applied")).toBe(false);
      expect(result.issues.some((i) => i.code === "copernicus_evidence_simulated")).toBe(true);
    });

    it("non-Copernicus items do NOT carry the Copernicus-specific issue or metadata flag", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "CADASTRO" }), context());
      expect(result.issues.some((i) => i.code === "copernicus_evidence_simulated")).toBe(false);
      expect(result.evidence?.metadata.simulatedDataDisclosure).toBeUndefined();
    });
  });

  describe("Copernicus truthfulness (mandatory acceptance criterion, 14_IMPLEMENTATION_ROADMAP.md Increment 5)", () => {
    it("a COPERNICUS-type evidence item's origin.processingMetadata passes isTruthfulCopernicusResponse", () => {
      const result = adaptLegacyEvidence(
        legacyItem({ type: "COPERNICUS", source: "Sentinel-1 metadata_only", summary: "Insuficiente" }),
        context(),
      );
      expect(result.success).toBe(true);
      expect(isTruthfulCopernicusResponse(result.evidence?.origin.processingMetadata)).toBe(true);
    });

    it("a COPERNICUS-type evidence item's reliability is literally 0.1, reflecting simulated status", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "COPERNICUS" }), context());
      expect(result.evidence?.reliability).toBe(0.1);
    });

    it("a COPERNICUS-type evidence item always carries the copernicus_evidence_simulated disclosure issue", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "COPERNICUS" }), context());
      const found = result.issues.find((i) => i.code === "copernicus_evidence_simulated");
      expect(found).toBeTruthy();
      expect(found?.canContinue).toBe(true);
    });

    it("a COPERNICUS-type evidence item's metadata explicitly flags simulatedDataDisclosure", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "COPERNICUS" }), context());
      expect(result.evidence?.metadata.simulatedDataDisclosure).toBe(true);
    });

    it("a non-COPERNICUS evidence item's origin.processingMetadata does NOT falsely claim Copernicus truthfulness", () => {
      const result = adaptLegacyEvidence(legacyItem({ type: "CADASTRO" }), context());
      expect(isTruthfulCopernicusResponse(result.evidence?.origin.processingMetadata)).toBe(false);
      expect(result.evidence?.metadata.simulatedDataDisclosure).toBeUndefined();
    });

    it("non-COPERNICUS evidence has a higher default reliability than COPERNICUS evidence", () => {
      const cadastro = adaptLegacyEvidence(legacyItem({ type: "CADASTRO" }), context());
      const copernicus = adaptLegacyEvidence(legacyItem({ type: "COPERNICUS" }), context());
      expect(cadastro.evidence!.reliability).toBeGreaterThan(copernicus.evidence!.reliability);
    });
  });

  describe("individual vs. list adaptation identity", () => {
    it("adaptLegacyEvidence(item, context) and adaptLegacyEvidenceList([item], context)[0] are deeply equal", () => {
      const item = legacyItem({ type: "QUALIDADE" });
      const ctx = context();
      const individual = adaptLegacyEvidence(item, ctx);
      const [fromList] = adaptLegacyEvidenceList([item], ctx);
      expect(individual).toEqual(fromList);
    });
  });

  describe("whitespace-only context fields", () => {
    it("a whitespace-only idSeed fails with a structured issue, not a throw", () => {
      expect(() => adaptLegacyEvidence(legacyItem(), context({ idSeed: "   " }))).not.toThrow();
      const result = adaptLegacyEvidence(legacyItem(), context({ idSeed: "   " }));
      expect(result.success).toBe(false);
      expect(result.issues.some((i) => i.code === "missing_id_seed")).toBe(true);
    });

    it("a whitespace-only snapshot fails with a structured issue, not a throw", () => {
      const result = adaptLegacyEvidence(legacyItem(), context({ snapshot: "   " }));
      expect(result.success).toBe(false);
      expect(result.issues.some((i) => i.code === "missing_snapshot")).toBe(true);
    });

    it("a whitespace-only checksum fails with a structured issue, not a throw", () => {
      const result = adaptLegacyEvidence(legacyItem(), context({ checksum: "\t\n " }));
      expect(result.success).toBe(false);
      expect(result.issues.some((i) => i.code === "missing_checksum")).toBe(true);
    });

    it("a whitespace-only provenance data-source (context.source) fails with a structured issue, not a throw", () => {
      const result = adaptLegacyEvidence(legacyItem(), context({ source: "   " }));
      expect(result.success).toBe(false);
      expect(result.issues.some((i) => i.code === "missing_provenance_source")).toBe(true);
    });
  });

  describe("Unicode preservation", () => {
    it("accented Portuguese text survives adaptation and JSON round-tripping byte-for-byte", () => {
      const unicodeText = "Evidencia nao informada -- estacao Sao Jose: Évidência não informada — estação São José";
      const result = adaptLegacyEvidence(
        legacyItem({ source: unicodeText, summary: unicodeText }),
        context(),
      );
      expect(result.evidence?.source).toBe(unicodeText);
      expect(result.evidence?.description).toBe(unicodeText);
      const roundTripped = JSON.parse(JSON.stringify(result));
      expect(roundTripped.evidence.source).toBe(unicodeText);
      expect(roundTripped.evidence.description).toBe(unicodeText);
    });
  });

  describe("frozen input", () => {
    it("a frozen legacy item and a frozen context do not throw and are not mutated", () => {
      const item = Object.freeze(legacyItem());
      const ctx = Object.freeze(context());
      expect(() => adaptLegacyEvidence(item, ctx)).not.toThrow();
      const result = adaptLegacyEvidence(item, ctx);
      expect(result.success).toBe(true);
      expect(Object.isFrozen(item)).toBe(true);
      expect(Object.isFrozen(ctx)).toBe(true);
    });
  });

  describe("duplicate-type evidence within one subject (documented current behavior, not redesigned)", () => {
    it("two legacy items sharing the same type and idSeed produce the same EvidenceId -- a known, deferred limitation, not silently hidden", () => {
      const first = adaptLegacyEvidence(legacyItem({ type: "CADASTRO", summary: "first" }), context({ idSeed: "99" }));
      const second = adaptLegacyEvidence(legacyItem({ type: "CADASTRO", summary: "second" }), context({ idSeed: "99" }));
      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      // Current, documented behavior: EvidenceId depends only on (idSeed, type), so
      // duplicate-type items for the same subject collide. No collision is detected,
      // no issue is raised, and neither item is deduplicated or given a random id --
      // see 21_INCREMENT_5_EVIDENCE_ADAPTER.md's "Identifier collision" section.
      expect(first.evidence?.id).toBe(second.evidence?.id);
      expect(first.evidence?.description).toBe("first");
      expect(second.evidence?.description).toBe("second");
    });
  });
});

describe("adaptLegacyEvidenceList", () => {
  it("adapts the real five-item evidenceCenterForSite() shape independently, in order", () => {
    const items: LegacyEvidenceItem[] = [
      { type: "CADASTRO", source: "vivo_sites.xlsx", status: "Disponivel", summary: "SITE042 - VIVO - Sao Paulo/SP" },
      { type: "COORDENADAS", source: "SQLite sites", status: "Validado", summary: "-23.55, -46.63" },
      { type: "COPERNICUS", source: "Sentinel-1 metadata_only", status: "Insuficiente", summary: "Sem evidencia" },
      { type: "QUALIDADE", source: "Data Trust Engine", status: "Gold", summary: "Trust Score 85" },
      { type: "OBSERVACOES", source: "site_notes", status: "Disponivel", summary: "2 observacoes locais" },
    ];
    const results = adaptLegacyEvidenceList(items, context());
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.map((r) => r.evidence?.metadata.legacyType)).toEqual([
      "CADASTRO",
      "COORDENADAS",
      "COPERNICUS",
      "QUALIDADE",
      "OBSERVACOES",
    ]);
  });

  it("every item in a batch of distinct types gets a distinct EvidenceId", () => {
    const items: LegacyEvidenceItem[] = [
      legacyItem({ type: "CADASTRO" }),
      legacyItem({ type: "COORDENADAS" }),
    ];
    const results = adaptLegacyEvidenceList(items, context());
    expect(results[0].evidence?.id).not.toBe(results[1].evidence?.id);
  });

  it("a batch is a thin wrapper -- one bad item does not block the others", () => {
    const items: LegacyEvidenceItem[] = [legacyItem({ source: "" }), legacyItem({ type: "COORDENADAS" })];
    const results = adaptLegacyEvidenceList(items, context());
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });

  it("preserves list order even when a duplicate-type collision occurs", () => {
    const items: LegacyEvidenceItem[] = [
      legacyItem({ type: "CADASTRO", summary: "one" }),
      legacyItem({ type: "CADASTRO", summary: "two" }),
      legacyItem({ type: "COORDENADAS", summary: "three" }),
    ];
    const results = adaptLegacyEvidenceList(items, context());
    expect(results.map((r) => r.evidence?.description)).toEqual(["one", "two", "three"]);
    expect(results[0].evidence?.id).toBe(results[1].evidence?.id);
    expect(results[2].evidence?.id).not.toBe(results[0].evidence?.id);
  });

  it("an empty array adapts to an empty array", () => {
    expect(adaptLegacyEvidenceList([], context())).toEqual([]);
  });

  it("the input items array is never mutated", () => {
    const items: LegacyEvidenceItem[] = [legacyItem({ type: "CADASTRO" }), legacyItem({ type: "COORDENADAS" })];
    const pristine = JSON.parse(JSON.stringify(items));
    adaptLegacyEvidenceList(items, context());
    expect(items).toEqual(pristine);
  });
});
