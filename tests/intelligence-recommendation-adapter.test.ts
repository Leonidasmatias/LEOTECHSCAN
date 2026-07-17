// GENESIS PHASE 2 -- Increment 6 (Recommendation Adapter).
// Pure unit tests for services/intelligence-adapters/recommendation-adapter.ts.
// No I/O, no node:sqlite -- constructed entirely from plain object literals,
// following the same hardened conventions established for the Evidence Adapter
// (tests/intelligence-evidence-adapter.test.ts).
import { describe, it, expect } from "vitest";
import {
  adaptLegacyRecommendation,
  adaptLegacyRecommendationList,
  LEGACY_RECOMMENDATION_TYPES,
  RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS,
  type LegacyRecommendationItem,
  type RecommendationAdapterContext,
} from "@/services/intelligence-adapters";
import { toIdentifier, validateRecommendationShape, type EntityReference } from "@/services/intelligence";

function legacyItem(overrides: Partial<LegacyRecommendationItem> = {}): LegacyRecommendationItem {
  return {
    type: "DATA_TRUST_TEXT",
    text: "Dado confiavel, recomenda-se revisar evidencias pendentes antes de decisoes criticas.",
    priority: null,
    evidenceContext: null,
    ...overrides,
  };
}

function siteEntity(id = "42"): EntityReference<"Site"> {
  return { kind: "Site", id: toIdentifier<"Site">(id) };
}

function context(overrides: Partial<RecommendationAdapterContext> = {}): RecommendationAdapterContext {
  return {
    idSeed: "42",
    affectedEntities: [siteEntity()],
    timestamp: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

describe("adaptLegacyRecommendation", () => {
  it("adapts a complete, valid legacy DATA_TRUST_TEXT item successfully", () => {
    const result = adaptLegacyRecommendation(legacyItem(), context());
    expect(result.success).toBe(true);
    expect(result.recommendation).not.toBeNull();
    expect(result.recommendation?.kind).toBe("Recommendation");
  });

  it("adapts a sentinel-core-shaped item (with numeric priority and evidenceContext) successfully", () => {
    const result = adaptLegacyRecommendation(
      legacyItem({
        type: "LOW_TRUST",
        text: "Revisar trust de SITE042",
        priority: 1,
        evidenceContext: { siteId: 42, site: "SITE042", trustScore: 35 },
      }),
      context(),
    );
    expect(result.success).toBe(true);
    expect(result.recommendation?.reason).toBe("Revisar trust de SITE042");
  });

  it("the produced Recommendation passes canonical structural validation", () => {
    const result = adaptLegacyRecommendation(legacyItem(), context());
    const structural = validateRecommendationShape(result.recommendation);
    expect(structural.valid).toBe(true);
    expect(structural.issues).toHaveLength(0);
  });

  it("the input item is never mutated", () => {
    const item = legacyItem({ evidenceContext: { siteId: 1 } });
    const pristine = JSON.parse(JSON.stringify(item));
    adaptLegacyRecommendation(item, context());
    expect(item).toEqual(pristine);
  });

  it("the context, including nested affectedEntities, is never mutated", () => {
    const ctx = context();
    const pristine = JSON.parse(JSON.stringify(ctx));
    adaptLegacyRecommendation(legacyItem(), ctx);
    expect(ctx).toEqual(pristine);
  });

  it("the same input produces identical output (deterministic)", () => {
    const item = legacyItem();
    const ctx = context();
    const a = adaptLegacyRecommendation(item, ctx);
    const b = adaptLegacyRecommendation(item, ctx);
    expect(a).toEqual(b);
  });

  it("repeated calls do not accumulate state", () => {
    const first = adaptLegacyRecommendation(legacyItem({ type: "GLOBAL_RULE" }), context({ idSeed: "1" }));
    const second = adaptLegacyRecommendation(legacyItem({ type: "ROLLOUT_OPPORTUNITY" }), context({ idSeed: "2" }));
    const third = adaptLegacyRecommendation(legacyItem({ type: "GLOBAL_RULE" }), context({ idSeed: "1" }));
    expect(first).toEqual(third);
    expect(first.recommendation?.id).not.toBe(second.recommendation?.id);
  });

  it("the result is JSON-serializable", () => {
    const result = adaptLegacyRecommendation(legacyItem(), context());
    expect(() => JSON.stringify(result)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped.success).toBe(true);
  });

  it("metadata preserves the raw legacy type and priority", () => {
    const result = adaptLegacyRecommendation(legacyItem({ type: "COPERNICUS_VALIDATION", priority: 2 }), context());
    expect(result.recommendation?.metadata.legacyType).toBe("COPERNICUS_VALIDATION");
    expect(result.recommendation?.metadata.legacyPriority).toBe(2);
  });

  it("metadata.legacyPriority is null for DATA_TRUST_TEXT (that source has no priority concept)", () => {
    const result = adaptLegacyRecommendation(legacyItem({ type: "DATA_TRUST_TEXT", priority: null }), context());
    expect(result.recommendation?.metadata.legacyPriority).toBeNull();
  });

  it("reason maps directly from the legacy text field", () => {
    const result = adaptLegacyRecommendation(legacyItem({ text: "Priorizar validacao de sites criticos." }), context());
    expect(result.recommendation?.reason).toBe("Priorizar validacao de sites criticos.");
  });

  it("sourceReference preserves all four raw legacy fields verbatim", () => {
    const item = legacyItem({ type: "ROLLOUT_OPPORTUNITY", text: "Avaliar expansao em Campinas/SP", priority: 3, evidenceContext: { municipio: "Campinas", uf: "SP" } });
    const result = adaptLegacyRecommendation(item, context());
    expect(result.sourceReference).toEqual({
      rawType: "ROLLOUT_OPPORTUNITY",
      rawText: "Avaliar expansao em Campinas/SP",
      rawPriority: 3,
      rawEvidenceContext: { municipio: "Campinas", uf: "SP" },
    });
  });

  it("missing reason (empty text) fails without throwing", () => {
    expect(() => adaptLegacyRecommendation(legacyItem({ text: "" }), context())).not.toThrow();
    const result = adaptLegacyRecommendation(legacyItem({ text: "" }), context());
    expect(result.success).toBe(false);
    expect(result.recommendation).toBeNull();
    expect(result.issues.some((i) => i.code === "missing_reason")).toBe(true);
  });

  it("whitespace-only reason fails the same way as empty", () => {
    const result = adaptLegacyRecommendation(legacyItem({ text: "   " }), context());
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_reason")).toBe(true);
  });

  it("missing idSeed blocks success", () => {
    const result = adaptLegacyRecommendation(legacyItem(), context({ idSeed: "" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_id_seed")).toBe(true);
  });

  it("an empty affectedEntities array blocks success (a Recommendation must concern at least one entity)", () => {
    const result = adaptLegacyRecommendation(legacyItem(), context({ affectedEntities: [] }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_affected_entities")).toBe(true);
  });

  it("a malformed entity in affectedEntities blocks success", () => {
    const malformed = { kind: "Site" } as unknown as EntityReference;
    const result = adaptLegacyRecommendation(legacyItem(), context({ affectedEntities: [malformed] }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "invalid_affected_entity")).toBe(true);
  });

  it("missing timestamp blocks success", () => {
    const result = adaptLegacyRecommendation(legacyItem(), context({ timestamp: "" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_evaluated_at")).toBe(true);
  });

  it("an invalid timestamp emits a blocking issue", () => {
    const result = adaptLegacyRecommendation(legacyItem(), context({ timestamp: "not-a-date" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "invalid_timestamp")).toBe(true);
  });

  it("an unrecognized recommendation type does not block success, but is flagged", () => {
    const result = adaptLegacyRecommendation(legacyItem({ type: "FUTURE_TYPE" }), context());
    expect(result.success).toBe(true);
    expect(result.issues.some((i) => i.code === "unrecognized_recommendation_type")).toBe(true);
  });

  it("every known legacy recommendation type adapts successfully", () => {
    for (const type of LEGACY_RECOMMENDATION_TYPES) {
      const result = adaptLegacyRecommendation(legacyItem({ type }), context());
      expect(result.success).toBe(true);
    }
  });

  it("unmappedFields is always empty -- every LegacyRecommendationItem field has a canonical home", () => {
    const result = adaptLegacyRecommendation(legacyItem(), context());
    expect(result.unmappedFields).toBe(RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS);
    expect(result.unmappedFields).toEqual([]);
  });

  it("issues never contain a planted distinctive marker", () => {
    const marker = "UNIQUE-MARKER-DO-NOT-LEAK-8e2f";
    const result = adaptLegacyRecommendation(legacyItem({ text: "" }), context({ timestamp: marker }));
    for (const issueItem of result.issues) {
      expect(JSON.stringify(issueItem)).not.toContain(marker);
    }
  });

  describe("policy-default disclosure (per Increment 5's established philosophy)", () => {
    it("priority is literally \"MEDIUM\"", () => {
      const result = adaptLegacyRecommendation(legacyItem(), context());
      expect(result.recommendation?.priority).toBe("MEDIUM");
    });

    it("confidence is literally 0.5", () => {
      const result = adaptLegacyRecommendation(legacyItem(), context());
      expect(result.recommendation?.confidence).toBe(0.5);
    });

    it("impact.magnitude is literally 0.5 and impact.timeframe is \"unspecified\"", () => {
      const result = adaptLegacyRecommendation(legacyItem(), context());
      expect(result.recommendation?.impact.magnitude).toBe(0.5);
      expect(result.recommendation?.impact.timeframe).toBe("unspecified");
    });

    it("impact.area varies by legacy type (a mechanical category label, not an urgency guess)", () => {
      const rollout = adaptLegacyRecommendation(legacyItem({ type: "ROLLOUT_OPPORTUNITY" }), context());
      const trust = adaptLegacyRecommendation(legacyItem({ type: "LOW_TRUST" }), context());
      const rule = adaptLegacyRecommendation(legacyItem({ type: "GLOBAL_RULE" }), context());
      expect(rollout.recommendation?.impact.area).toBe("coverage");
      expect(trust.recommendation?.impact.area).toBe("data-quality");
      expect(rule.recommendation?.impact.area).toBe("governance");
    });

    it("an unrecognized type falls back to the generic impact area", () => {
      const result = adaptLegacyRecommendation(legacyItem({ type: "FUTURE_TYPE" }), context());
      expect(result.recommendation?.impact.area).toBe("operational");
    });

    it("metadata explicitly discloses the policy defaults", () => {
      const result = adaptLegacyRecommendation(legacyItem(), context());
      expect(result.recommendation?.metadata.policyDefaultsApplied).toBe(true);
      expect(result.recommendation?.metadata.prioritySource).toBe("adapter_policy_default");
      expect(result.recommendation?.metadata.confidenceSource).toBe("adapter_policy_default");
      expect(result.recommendation?.metadata.impactSource).toBe("adapter_policy_default");
    });

    it("carries the policy_default_values_applied issue, non-blocking", () => {
      const result = adaptLegacyRecommendation(legacyItem(), context());
      const found = result.issues.find((i) => i.code === "policy_default_values_applied");
      expect(found).toBeTruthy();
      expect(found?.severity).toBe("informational");
      expect(found?.canContinue).toBe(true);
      expect(result.success).toBe(true);
    });

    it("limitations disclose both the policy defaults and the empty action list", () => {
      const result = adaptLegacyRecommendation(legacyItem(), context());
      expect(result.recommendation?.limitations).toHaveLength(2);
      expect(result.recommendation?.limitations.every((l) => l.severity === "informational")).toBe(true);
    });
  });

  describe("legacy priority finite-number handling (pre-commit hardening item 2)", () => {
    it("a finite legacy priority is preserved exactly in metadata and sourceReference", () => {
      const result = adaptLegacyRecommendation(legacyItem({ type: "LOW_TRUST", priority: 1 }), context());
      expect(result.recommendation?.metadata.legacyPriority).toBe(1);
      expect(result.sourceReference.rawPriority).toBe(1);
      expect(result.issues.some((i) => i.code === "invalid_legacy_priority")).toBe(false);
    });

    it("a null legacy priority (DATA_TRUST_TEXT) is preserved as null, not flagged as invalid", () => {
      const result = adaptLegacyRecommendation(legacyItem({ type: "DATA_TRUST_TEXT", priority: null }), context());
      expect(result.recommendation?.metadata.legacyPriority).toBeNull();
      expect(result.sourceReference.rawPriority).toBeNull();
      expect(result.issues.some((i) => i.code === "invalid_legacy_priority")).toBe(false);
    });

    it("a NaN legacy priority becomes null in metadata and sourceReference, not silently JSON-serialized", () => {
      const result = adaptLegacyRecommendation(legacyItem({ type: "LOW_TRUST", priority: NaN }), context());
      expect(result.success).toBe(true);
      expect(result.recommendation?.metadata.legacyPriority).toBeNull();
      expect(result.sourceReference.rawPriority).toBeNull();
    });

    it("an Infinity legacy priority becomes null in metadata and sourceReference", () => {
      const result = adaptLegacyRecommendation(legacyItem({ type: "COPERNICUS_VALIDATION", priority: Infinity }), context());
      expect(result.success).toBe(true);
      expect(result.recommendation?.metadata.legacyPriority).toBeNull();
      expect(result.sourceReference.rawPriority).toBeNull();
    });

    it("a -Infinity legacy priority becomes null in metadata and sourceReference", () => {
      const result = adaptLegacyRecommendation(legacyItem({ type: "ROLLOUT_OPPORTUNITY", priority: -Infinity }), context());
      expect(result.success).toBe(true);
      expect(result.recommendation?.metadata.legacyPriority).toBeNull();
      expect(result.sourceReference.rawPriority).toBeNull();
    });

    it("a non-finite legacy priority emits the invalid_legacy_priority issue, non-blocking", () => {
      const result = adaptLegacyRecommendation(legacyItem({ priority: NaN }), context());
      const found = result.issues.find((i) => i.code === "invalid_legacy_priority");
      expect(found).toBeTruthy();
      expect(found?.severity).toBe("moderate");
      expect(found?.canContinue).toBe(true);
    });

    it("a non-finite legacy priority does not make adaptation fail", () => {
      const nan = adaptLegacyRecommendation(legacyItem({ priority: NaN }), context());
      const posInf = adaptLegacyRecommendation(legacyItem({ priority: Infinity }), context());
      const negInf = adaptLegacyRecommendation(legacyItem({ priority: -Infinity }), context());
      expect(nan.success).toBe(true);
      expect(posInf.success).toBe(true);
      expect(negInf.success).toBe(true);
      expect(nan.recommendation).not.toBeNull();
    });

    it("canonical priority remains the disclosed policy default \"MEDIUM\" regardless of legacy priority validity", () => {
      const result = adaptLegacyRecommendation(legacyItem({ priority: NaN }), context());
      expect(result.recommendation?.priority).toBe("MEDIUM");
    });

    it("JSON.stringify of a non-finite-priority result contains no unintended null from raw NaN/Infinity serialization -- the null is explicit and disclosed", () => {
      const result = adaptLegacyRecommendation(legacyItem({ priority: NaN }), context());
      const serialized = JSON.stringify(result);
      expect(() => JSON.parse(serialized)).not.toThrow();
      const parsed = JSON.parse(serialized);
      expect(parsed.recommendation.metadata.legacyPriority).toBeNull();
      expect(parsed.sourceReference.rawPriority).toBeNull();
      expect(parsed.issues.some((i: { code: string }) => i.code === "invalid_legacy_priority")).toBe(true);
    });

    it("issues never contain a planted marker even when priority is non-finite", () => {
      const marker = "UNIQUE-MARKER-PRIORITY-9f1c";
      const result = adaptLegacyRecommendation(legacyItem({ priority: NaN, text: marker }), context());
      for (const issueItem of result.issues) {
        expect(JSON.stringify(issueItem)).not.toContain(marker);
      }
    });
  });

  describe("structural fields never fabricated beyond documented defaults", () => {
    it("recommendedActions is always empty", () => {
      const result = adaptLegacyRecommendation(legacyItem(), context());
      expect(result.recommendation?.recommendedActions).toEqual([]);
    });

    it("evidence is always empty -- no canonical Evidence objects are created by this increment", () => {
      const result = adaptLegacyRecommendation(legacyItem(), context());
      expect(result.recommendation?.evidence).toEqual([]);
    });

    it("affectedEntities is preserved exactly, in the same order supplied", () => {
      const entities = [siteEntity("1"), siteEntity("2")];
      const result = adaptLegacyRecommendation(legacyItem(), context({ affectedEntities: entities }));
      expect(result.recommendation?.affectedEntities).toEqual([
        { kind: "Site", id: "1" },
        { kind: "Site", id: "2" },
      ]);
    });
  });

  describe("duplicate affected entities (pre-commit hardening item 3, documented current behavior)", () => {
    it("the same entity referenced twice is not silently deduplicated -- both entries remain, in order", () => {
      const entities = [siteEntity("7"), siteEntity("7")];
      const result = adaptLegacyRecommendation(legacyItem(), context({ affectedEntities: entities }));
      expect(result.success).toBe(true);
      expect(result.recommendation?.affectedEntities).toHaveLength(2);
      expect(result.recommendation?.affectedEntities).toEqual([
        { kind: "Site", id: "7" },
        { kind: "Site", id: "7" },
      ]);
    });

    it("duplicate-entity input is never mutated", () => {
      const entities = [siteEntity("7"), siteEntity("7")];
      const pristine = JSON.parse(JSON.stringify(entities));
      adaptLegacyRecommendation(legacyItem(), context({ affectedEntities: entities }));
      expect(entities).toEqual(pristine);
    });

    it("duplicate-entity adaptation is deterministic", () => {
      const entities = [siteEntity("7"), siteEntity("7")];
      const ctx = context({ affectedEntities: entities });
      const a = adaptLegacyRecommendation(legacyItem(), ctx);
      const b = adaptLegacyRecommendation(legacyItem(), ctx);
      expect(a).toEqual(b);
    });
  });

  describe("individual vs. list adaptation identity", () => {
    it("adaptLegacyRecommendation(item, context) and adaptLegacyRecommendationList([item], context)[0] are deeply equal", () => {
      const item = legacyItem({ type: "COPERNICUS_VALIDATION" });
      const ctx = context();
      const individual = adaptLegacyRecommendation(item, ctx);
      const [fromList] = adaptLegacyRecommendationList([item], ctx);
      expect(individual).toEqual(fromList);
    });
  });

  describe("duplicate-type recommendations within one subject (documented current behavior)", () => {
    it("two legacy items sharing the same type and idSeed produce the same RecommendationId -- a known, deliberately-not-redesigned limitation", () => {
      const first = adaptLegacyRecommendation(legacyItem({ type: "GLOBAL_RULE", text: "first rule" }), context({ idSeed: "99" }));
      const second = adaptLegacyRecommendation(legacyItem({ type: "GLOBAL_RULE", text: "second rule" }), context({ idSeed: "99" }));
      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(first.recommendation?.id).toBe(second.recommendation?.id);
      expect(first.recommendation?.reason).toBe("first rule");
      expect(second.recommendation?.reason).toBe("second rule");
    });
  });

  describe("Unicode preservation", () => {
    it("accented Portuguese text survives adaptation and JSON round-tripping byte-for-byte", () => {
      const unicodeText = "Recomendacao nao informada -- Priorizar expansao em municipios com OPI alto: Recomendação não informada — estação São José";
      const result = adaptLegacyRecommendation(legacyItem({ text: unicodeText }), context());
      expect(result.recommendation?.reason).toBe(unicodeText);
      const roundTripped = JSON.parse(JSON.stringify(result));
      expect(roundTripped.recommendation.reason).toBe(unicodeText);
    });
  });

  describe("frozen input", () => {
    it("a frozen legacy item and a frozen context do not throw and are not mutated", () => {
      const item = Object.freeze(legacyItem());
      const ctx = Object.freeze(context());
      expect(() => adaptLegacyRecommendation(item, ctx)).not.toThrow();
      const result = adaptLegacyRecommendation(item, ctx);
      expect(result.success).toBe(true);
      expect(Object.isFrozen(item)).toBe(true);
      expect(Object.isFrozen(ctx)).toBe(true);
    });
  });
});

describe("adaptLegacyRecommendationList", () => {
  it("adapts a realistic sentinel-core-shaped batch independently, in order", () => {
    const items: LegacyRecommendationItem[] = [
      { type: "GLOBAL_RULE", text: "Priorizar validacao de sites criticos.", priority: 1, evidenceContext: null },
      { type: "LOW_TRUST", text: "Revisar trust de SITE042", priority: 1, evidenceContext: { siteId: 42, site: "SITE042" } },
      { type: "COPERNICUS_VALIDATION", text: "Validar Copernicus para SITE042", priority: 2, evidenceContext: { siteId: 42, site: "SITE042" } },
      { type: "ROLLOUT_OPPORTUNITY", text: "Avaliar expansao em Campinas/SP", priority: 3, evidenceContext: { municipio: "Campinas", uf: "SP" } },
    ];
    const results = adaptLegacyRecommendationList(items, context());
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.map((r) => r.recommendation?.metadata.legacyType)).toEqual([
      "GLOBAL_RULE",
      "LOW_TRUST",
      "COPERNICUS_VALIDATION",
      "ROLLOUT_OPPORTUNITY",
    ]);
  });

  it("every item in a batch of distinct types gets a distinct RecommendationId", () => {
    const items: LegacyRecommendationItem[] = [legacyItem({ type: "LOW_TRUST" }), legacyItem({ type: "ROLLOUT_OPPORTUNITY" })];
    const results = adaptLegacyRecommendationList(items, context());
    expect(results[0].recommendation?.id).not.toBe(results[1].recommendation?.id);
  });

  it("a batch is a thin wrapper -- one bad item does not block the others", () => {
    const items: LegacyRecommendationItem[] = [legacyItem({ text: "" }), legacyItem({ type: "COPERNICUS_VALIDATION" })];
    const results = adaptLegacyRecommendationList(items, context());
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });

  it("preserves list order even when a duplicate-type collision occurs", () => {
    const items: LegacyRecommendationItem[] = [
      legacyItem({ type: "GLOBAL_RULE", text: "one" }),
      legacyItem({ type: "GLOBAL_RULE", text: "two" }),
      legacyItem({ type: "LOW_TRUST", text: "three" }),
    ];
    const results = adaptLegacyRecommendationList(items, context());
    expect(results.map((r) => r.recommendation?.reason)).toEqual(["one", "two", "three"]);
    expect(results[0].recommendation?.id).toBe(results[1].recommendation?.id);
    expect(results[2].recommendation?.id).not.toBe(results[0].recommendation?.id);
  });

  it("an empty array adapts to an empty array", () => {
    expect(adaptLegacyRecommendationList([], context())).toEqual([]);
  });

  it("the input items array is never mutated", () => {
    const items: LegacyRecommendationItem[] = [legacyItem({ type: "LOW_TRUST" }), legacyItem({ type: "ROLLOUT_OPPORTUNITY" })];
    const pristine = JSON.parse(JSON.stringify(items));
    adaptLegacyRecommendationList(items, context());
    expect(items).toEqual(pristine);
  });
});
