// GENESIS PHASE 2 -- Increment 4 (Data Trust Score Adapter).
// Pure unit tests for services/intelligence-adapters/data-trust-score-adapter.ts.
// No I/O, no node:sqlite -- constructed entirely from plain object literals.
import { describe, it, expect } from "vitest";
import {
  adaptLegacyDataTrustResult,
  DATA_TRUST_ADAPTER_UNMAPPED_FIELDS,
  type LegacyDataTrustResult,
  type DataTrustAdapterContext,
} from "@/services/intelligence-adapters";
import { toIdentifier, validateScoreShape, type EntityReference } from "@/services/intelligence";

function validResult(overrides: Partial<LegacyDataTrustResult> = {}): LegacyDataTrustResult {
  return {
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
  };
}

function siteReference(id = "42"): EntityReference<"Site"> {
  return { kind: "Site", id: toIdentifier<"Site">(id) };
}

function validContext(overrides: Partial<DataTrustAdapterContext> = {}): DataTrustAdapterContext {
  return {
    entityReference: siteReference(),
    calculatedAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

describe("adaptLegacyDataTrustResult", () => {
  it("1. adapts a complete, valid legacy result successfully", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext());
    expect(result.success).toBe(true);
    expect(result.score).not.toBeNull();
    expect(result.score?.kind).toBe("Score");
  });

  it("2. successful canonical output passes structural validation", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext());
    expect(result.score).not.toBeNull();
    const structural = validateScoreShape(result.score);
    expect(structural.valid).toBe(true);
    expect(structural.issues).toHaveLength(0);
  });

  it("3. the canonical Site reference is preserved exactly", () => {
    const ref = siteReference("777");
    const result = adaptLegacyDataTrustResult(validResult(), validContext({ entityReference: ref }));
    expect(result.score?.entity).toEqual({ kind: "Site", id: "777" });
  });

  it("4. the same input produces identical output (deterministic)", () => {
    const input = validResult();
    const context = validContext();
    const a = adaptLegacyDataTrustResult(input, context);
    const b = adaptLegacyDataTrustResult(input, context);
    expect(a).toEqual(b);
  });

  it("5. the legacy result input is never mutated", () => {
    const input = validResult();
    const pristine = JSON.parse(JSON.stringify(input));
    adaptLegacyDataTrustResult(input, validContext());
    expect(input).toEqual(pristine);
  });

  it("6. the supplied entity reference is never mutated", () => {
    const ref = siteReference();
    const pristine = JSON.parse(JSON.stringify(ref));
    adaptLegacyDataTrustResult(validResult(), validContext({ entityReference: ref }));
    expect(ref).toEqual(pristine);
  });

  it("7. the result is JSON-serializable", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext());
    expect(() => JSON.stringify(result)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped.success).toBe(true);
  });

  it("8. repeated calls do not accumulate state", () => {
    const first = adaptLegacyDataTrustResult(validResult({ trustScore: 10 }), validContext({ entityReference: siteReference("1") }));
    const second = adaptLegacyDataTrustResult(validResult({ trustScore: 90 }), validContext({ entityReference: siteReference("2") }));
    const third = adaptLegacyDataTrustResult(validResult({ trustScore: 10 }), validContext({ entityReference: siteReference("1") }));
    expect(first).toEqual(third);
    expect(first.score?.value).not.toBe(second.score?.value);
  });

  it("9. a valid zero score is not treated as missing", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: 0 }), validContext());
    expect(result.success).toBe(true);
    expect(result.score?.value).toBe(0);
    expect(result.issues.some((i) => i.code === "missing_score")).toBe(false);
  });

  it("10. a valid maximum score is preserved", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: 100 }), validContext());
    expect(result.success).toBe(true);
    expect(result.score?.value).toBe(1);
  });

  it("11. a numeric-string trustScore is rejected, never silently parsed (no repository evidence supports coercion here)", () => {
    const row = validResult({ trustScore: "85" as unknown as number });
    const result = adaptLegacyDataTrustResult(row, validContext());
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_score")).toBe(true);
  });

  it("12. an ambiguous-looking fractional trustScore is never reinterpreted as already-canonical-scale", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: 0.85 }), validContext());
    expect(result.success).toBe(true);
    // Always divided by 100 mechanically, per ADR-003 -- never "detected" as already 0-1.
    expect(result.score?.value).toBeCloseTo(0.0085, 10);
  });

  it("13. NaN trustScore is surfaced as a blocking issue, never replaced with zero", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: NaN }), validContext());
    expect(result.success).toBe(false);
    expect(result.score).toBeNull();
    expect(result.issues.some((i) => i.code === "non_finite_score")).toBe(true);
  });

  it("14. Infinity trustScore is surfaced as a blocking issue, never replaced with zero", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: Infinity }), validContext());
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "non_finite_score")).toBe(true);
  });

  it("15. a negative legacy score converts mechanically and is flagged, not corrected", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: -10 }), validContext());
    expect(result.success).toBe(true);
    expect(result.score?.value).toBe(-0.1);
    expect(result.issues.some((i) => i.code === "score_out_of_range")).toBe(true);
  });

  it("16. an above-range legacy score converts mechanically and is flagged, not corrected", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: 150 }), validContext());
    expect(result.success).toBe(true);
    expect(result.score?.value).toBe(1.5);
    expect(result.issues.some((i) => i.code === "score_out_of_range")).toBe(true);
  });

  it("17. no silent clamping occurs for out-of-range values", () => {
    const low = adaptLegacyDataTrustResult(validResult({ trustScore: -50 }), validContext());
    const high = adaptLegacyDataTrustResult(validResult({ trustScore: 200 }), validContext());
    expect(low.score?.value).toBe(-0.5);
    expect(high.score?.value).toBe(2);
  });

  it("18. no silent rounding occurs beyond the legacy formula's own integer trustScore", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: 85 }), validContext());
    expect(result.score?.value).toBe(0.85);
  });

  it("19. the score is never recomputed from component values", () => {
    // Components that would sum to something wildly different from trustScore/100 --
    // score.value must still come from trustScore alone.
    const result = adaptLegacyDataTrustResult(
      validResult({ trustScore: 60, coordinateConfidence: 0, addressConfidence: 0, overallConfidence: 0 }),
      validContext(),
    );
    expect(result.score?.value).toBe(0.6);
  });

  it("20. a missing optional component value does not become zero -- it is omitted with an issue", () => {
    const row = { ...validResult() } as unknown as Record<string, unknown>;
    delete row.cadastralConfidence;
    const result = adaptLegacyDataTrustResult(row as unknown as LegacyDataTrustResult, validContext());
    expect(result.success).toBe(true);
    expect(result.score?.drivers.some((d) => d.factor === "cadastralConfidence")).toBe(false);
    expect(result.issues.some((i) => i.code === "invalid_component_value" && i.field === "cadastralConfidence")).toBe(true);
  });

  it("21. component values are preserved exactly in driver contributions", () => {
    const result = adaptLegacyDataTrustResult(validResult({ coordinateConfidence: 100 }), validContext());
    const driver = result.score?.drivers.find((d) => d.factor === "coordinateConfidence");
    expect(driver?.weight).toBe(0.2);
    expect(driver?.contribution).toBeCloseTo(0.2 * 1, 10);
  });

  it("22. unmapped legacy fields (site, satellite) are documented, not silently dropped", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext());
    expect(result.unmappedFields).toBe(DATA_TRUST_ADAPTER_UNMAPPED_FIELDS);
    expect(result.unmappedFields).toEqual(["site", "satellite"]);
  });

  it("23. the legacy classification (trustBadge) is preserved verbatim, and flagged as non-canonical", () => {
    const result = adaptLegacyDataTrustResult(validResult({ trustBadge: "Gold" }), validContext());
    expect(result.score?.classification).toBe("Gold");
    expect(result.issues.some((i) => i.code === "unmapped_classification")).toBe(true);
  });

  it("24. a missing Site reference blocks success", () => {
    const result = adaptLegacyDataTrustResult(
      validResult(),
      validContext({ entityReference: undefined as unknown as EntityReference<"Site"> }),
    );
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_entity_reference")).toBe(true);
  });

  it("25. the adapter never derives identity from a telecom site code -- it trusts the supplied reference verbatim", () => {
    const ref = siteReference("42");
    const result = adaptLegacyDataTrustResult(validResult(), validContext({ entityReference: ref }));
    expect(result.score?.entity.id).toBe("42");
    // LegacyDataTrustResult has no site-code field at all -- nothing to derive from.
    expect((validResult() as unknown as Record<string, unknown>).site).toBeUndefined();
  });

  it("26. a missing calculation timestamp blocks success", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext({ calculatedAt: "" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_evaluated_at")).toBe(true);
  });

  it("27. an invalid calculation timestamp emits a blocking issue", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext({ calculatedAt: "not-a-date" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "invalid_timestamp")).toBe(true);
  });

  it("28. engineVersion/contractVersion are always present, mirroring the registered manifest -- never 'missing'", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext());
    expect(result.score?.engineVersion).toBe("0.1.0");
    expect(result.score?.contractVersion).toBe("1.0.0");
  });

  it("29. no legacy methodology version is invented -- the version-source limitation is explicit", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext());
    const found = result.score?.limitations.find((l) => l.description.includes("does not represent") || l.description.includes("not an internal version"));
    expect(found).toBeTruthy();
  });

  it("30. the canonical result truthfully identifies itself as a Data Trust score", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext());
    expect(result.score?.type).toBe("data-trust");
    expect(result.score?.executionMetadata.engineId).toBe("data-trust");
  });

  it("issues never contain a planted distinctive marker", () => {
    const marker = "UNIQUE-MARKER-DO-NOT-LEAK-7c2a";
    const result = adaptLegacyDataTrustResult(validResult({ trustScore: NaN }), validContext({ calculatedAt: marker }));
    for (const issueItem of result.issues) {
      expect(JSON.stringify(issueItem)).not.toContain(marker);
    }
  });

  it("evidence is an empty array -- no canonical Evidence objects are created by this increment", () => {
    const result = adaptLegacyDataTrustResult(validResult(), validContext());
    expect(result.score?.evidence).toEqual([]);
  });

  it("the score id is deterministic given the same entity reference", () => {
    const a = adaptLegacyDataTrustResult(validResult(), validContext({ entityReference: siteReference("9") }));
    const b = adaptLegacyDataTrustResult(validResult({ trustScore: 5 }), validContext({ entityReference: siteReference("9") }));
    expect(a.score?.id).toBe(b.score?.id);
  });

  it("sourceReference preserves the raw legacy score/badge/level verbatim", () => {
    const result = adaptLegacyDataTrustResult(
      validResult({ trustScore: 73, trustBadge: "Silver", trustLevel: "Medio" }),
      validContext(),
    );
    expect(result.sourceReference).toEqual({ rawTrustScore: 73, rawTrustBadge: "Silver", rawTrustLevel: "Medio" });
  });
});
