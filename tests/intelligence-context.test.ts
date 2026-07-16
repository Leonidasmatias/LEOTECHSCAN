import { describe, expect, it } from "vitest";
import {
  validateCalculationContextShape,
  toIdentifier,
  toIsoDateTime,
  type CalculationContext,
} from "@/services/intelligence";

const NOW = toIsoDateTime("2026-07-16T00:00:00.000Z");

function buildSampleContext(): CalculationContext {
  return {
    contextId: "context-1",
    scope: "global",
    snapshot: toIdentifier("snapshot-1"),
    requestedAt: NOW,
    requestedBy: "scheduler:nightly-batch",
    correlationId: "correlation-1",
    environment: "production",
    extensions: {},
  };
}

describe("CalculationContext contract", () => {
  it("accepts a well-formed global-scope context", () => {
    const result = validateCalculationContextShape(buildSampleContext());
    expect(result.valid).toBe(true);
  });

  it("accepts a context scoped to a specific entity", () => {
    const context: CalculationContext = {
      ...buildSampleContext(),
      scope: { kind: "Site", id: toIdentifier("site-1") },
    };
    const result = validateCalculationContextShape(context);
    expect(result.valid).toBe(true);
  });

  it("rejects an unrecognized environment value", () => {
    const context = { ...buildSampleContext(), environment: "development" };
    const result = validateCalculationContextShape(context);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "environment")).toBe(true);
  });

  it("rejects a context missing its snapshot reference", () => {
    const context: Record<string, unknown> = { ...buildSampleContext() };
    delete context.snapshot;
    const result = validateCalculationContextShape(context);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "snapshot")).toBe(true);
  });
});
