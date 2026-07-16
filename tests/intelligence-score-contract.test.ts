import { describe, expect, it } from "vitest";
import {
  validateScoreShape,
  toIdentifier,
  toIsoDateTime,
  type Score,
  type UnitInterval,
  type SemVerString,
} from "@/services/intelligence";

const NOW = toIsoDateTime("2026-07-16T00:00:00.000Z");

function buildSampleScore(): Score {
  return {
    kind: "Score",
    id: toIdentifier("score-1"),
    entity: { kind: "Site", id: toIdentifier("site-1") },
    type: "risk",
    value: 0.72,
    classification: "HIGH",
    confidence: 0.9 as UnitInterval,
    engineVersion: "1.0.0" as SemVerString,
    contractVersion: "1.0.0" as SemVerString,
    drivers: [
      {
        factor: "coverage-overlap",
        weight: 0.6,
        contribution: 0.4,
        explanation: "High overlap with an existing operator's coverage.",
      },
    ],
    evidence: [toIdentifier("evidence-1")],
    limitations: [
      { description: "Based on a 30-day-old snapshot.", severity: "moderate" },
    ],
    calculatedAt: NOW,
    executionMetadata: {
      engineId: "risk",
      contextId: "context-1",
      executedAt: NOW,
      durationMs: 42,
      notes: [],
    },
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    metadata: {},
  };
}

describe("Score contract", () => {
  it("accepts a well-formed score", () => {
    const result = validateScoreShape(buildSampleScore());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("accepts a score type and classification outside the canonical suggestion list", () => {
    const score: Score = {
      ...buildSampleScore(),
      type: "future-engine-type",
      classification: "REQUIRES_REVIEW",
    };
    const result = validateScoreShape(score);
    expect(result.valid).toBe(true);
  });

  it("rejects a confidence value outside [0, 1]", () => {
    const score = { ...buildSampleScore(), confidence: 87 };
    const result = validateScoreShape(score);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "confidence")).toBe(true);
  });

  it("rejects a score missing its drivers array", () => {
    const score: Record<string, unknown> = { ...buildSampleScore() };
    delete score.drivers;
    const result = validateScoreShape(score);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "drivers")).toBe(true);
  });
});
