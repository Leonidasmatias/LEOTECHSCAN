import { describe, expect, it } from "vitest";
import {
  validateEvidenceShape,
  toIdentifier,
  toIsoDateTime,
  type Evidence,
  type UnitInterval,
  type SemVerString,
} from "@/services/intelligence";

const NOW = toIsoDateTime("2026-07-16T00:00:00.000Z");

function buildSampleEvidence(): Evidence {
  return {
    kind: "Evidence",
    id: toIdentifier("evidence-1"),
    source: "Copernicus satellite validation",
    description: "Satellite imagery confirms structure presence at recorded coordinates.",
    weight: 0.8,
    reliability: 0.95 as UnitInterval,
    snapshot: toIdentifier("snapshot-1"),
    origin: {
      origin: "copernicus-api",
      pipeline: "geospatial-enrichment",
      snapshot: toIdentifier("snapshot-1"),
      source: toIdentifier("data-source-1"),
      checksum: "abc123",
      timestamp: NOW,
      version: "1.0.0" as SemVerString,
      processingMetadata: {},
    },
    checksum: "abc123",
    references: ["https://example.org/copernicus/report/1"],
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    metadata: {},
  };
}

describe("Evidence contract", () => {
  it("accepts a well-formed piece of evidence", () => {
    const result = validateEvidenceShape(buildSampleEvidence());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects a reliability value outside [0, 1]", () => {
    const evidence = { ...buildSampleEvidence(), reliability: 2 };
    const result = validateEvidenceShape(evidence);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "reliability")).toBe(true);
  });

  it("rejects evidence missing its provenance origin", () => {
    const evidence: Record<string, unknown> = { ...buildSampleEvidence() };
    delete evidence.origin;
    const result = validateEvidenceShape(evidence);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "origin")).toBe(true);
  });

  it("rejects evidence whose references field is not an array", () => {
    const evidence = { ...buildSampleEvidence(), references: "not-an-array" };
    const result = validateEvidenceShape(evidence);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "references")).toBe(true);
  });
});
