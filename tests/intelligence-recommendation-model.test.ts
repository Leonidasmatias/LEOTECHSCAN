import { describe, expect, it } from "vitest";
import {
  validateRecommendationShape,
  toIdentifier,
  toIsoDateTime,
  type Recommendation,
  type UnitInterval,
} from "@/services/intelligence";

const NOW = toIsoDateTime("2026-07-16T00:00:00.000Z");

function buildSampleRecommendation(): Recommendation {
  return {
    kind: "Recommendation",
    id: toIdentifier("recommendation-1"),
    reason: "Trust score has fallen below the review threshold.",
    priority: "HIGH",
    confidence: 0.85 as UnitInterval,
    impact: {
      magnitude: 0.6 as UnitInterval,
      area: "data-quality",
      timeframe: "immediate",
    },
    affectedEntities: [{ kind: "Site", id: toIdentifier("site-1") }],
    recommendedActions: [
      {
        action: "Re-validate the site via Copernicus.",
        rationale: "No satellite validation exists for this site.",
        sequence: 1,
      },
    ],
    evidence: [toIdentifier("evidence-1")],
    limitations: [
      { description: "Confidence is bounded by snapshot age.", severity: "informational" },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    metadata: {},
  };
}

describe("Recommendation contract", () => {
  it("accepts a well-formed recommendation", () => {
    const result = validateRecommendationShape(buildSampleRecommendation());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects a recommendation with no affected entities", () => {
    const recommendation = { ...buildSampleRecommendation(), affectedEntities: [] };
    const result = validateRecommendationShape(recommendation);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "affectedEntities")).toBe(true);
  });

  it("rejects a recommendation missing its impact assessment", () => {
    const recommendation: Record<string, unknown> = { ...buildSampleRecommendation() };
    delete recommendation.impact;
    const result = validateRecommendationShape(recommendation);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "impact")).toBe(true);
  });
});
