// GENESIS PHASE 2 -- Increment 2 (Engine Manifest / Runtime Registry).
// Pure unit tests for services/intelligence-runtime/engine-manifest(-validation).ts.
// No I/O, no node:sqlite -- these modules depend only on @/services/intelligence
// (itself dependency-free) and plain data.
import { describe, it, expect } from "vitest";
import {
  validateEngineManifestShape,
  freezeManifest,
  CANONICAL_ENGINE_MANIFESTS,
  type EngineManifest,
} from "@/services/intelligence-runtime";

const V0_1_0 = { major: 0, minor: 1, patch: 0, prerelease: null, build: null } as const;
const V1_0_0 = { major: 1, minor: 0, patch: 0, prerelease: null, build: null } as const;

function validManifest(overrides: Partial<EngineManifest> = {}): EngineManifest {
  return {
    id: "test-engine",
    name: "Test Engine",
    description: "A fixture engine manifest used only by this test file.",
    status: "planned",
    version: {
      engineVersion: V0_1_0,
      contractVersion: V1_0_0,
      minimumCompatibleVersion: V1_0_0,
      deprecatedSince: null,
      breakingChanges: [],
    },
    capabilities: ["fixture"],
    owner: "tests",
    engineVersion: "0.1.0" as EngineManifest["engineVersion"],
    contractVersion: "1.0.0" as EngineManifest["contractVersion"],
    configurationVersion: "0.1.0",
    capabilityKey: "test_engine",
    inputs: [{ name: "site", shape: 'EntityReference<"Site">', required: true }],
    outputs: [{ name: "score", shape: "Score<string>", required: true }],
    dependencies: [],
    supportsPreview: true,
    supportsPersistence: false,
    supportsBatch: false,
    maxBatchSize: null,
    supportedScopes: ["site"],
    securityRequirement: "authenticated-read",
    observability: { emitsEvents: [], healthCheck: "none" },
    ...overrides,
  } as EngineManifest;
}

describe("validateEngineManifestShape", () => {
  it("1. accepts a valid manifest", () => {
    const result = validateEngineManifestShape(validManifest());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("1b. accepts every registered canonical manifest (data-trust, confidence, recommendation)", () => {
    for (const manifest of CANONICAL_ENGINE_MANIFESTS) {
      const result = validateEngineManifestShape(manifest);
      expect(result.valid).toBe(true);
    }
  });

  it("2. rejects an invalid semantic version", () => {
    const result = validateEngineManifestShape(
      validManifest({ engineVersion: "not-a-version" as EngineManifest["engineVersion"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "engineVersion")).toBe(true);
  });

  it("3. rejects a manifest missing required identity (id)", () => {
    const manifest = validManifest();
    const { id: _id, ...withoutId } = manifest as unknown as Record<string, unknown>;
    const result = validateEngineManifestShape(withoutId);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "id")).toBe(true);
  });

  it("4. rejects an invalid lifecycle status", () => {
    const result = validateEngineManifestShape(
      validManifest({ status: "operational" as EngineManifest["status"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "status")).toBe(true);
  });

  it("5. rejects batch support declared with a non-positive maxBatchSize", () => {
    const zero = validateEngineManifestShape(
      validManifest({ supportsBatch: true, maxBatchSize: 0 }),
    );
    expect(zero.valid).toBe(false);
    expect(zero.issues.some((i) => i.path === "maxBatchSize")).toBe(true);

    const negative = validateEngineManifestShape(
      validManifest({ supportsBatch: true, maxBatchSize: -10 }),
    );
    expect(negative.valid).toBe(false);

    const nullWhenBatch = validateEngineManifestShape(
      validManifest({ supportsBatch: true, maxBatchSize: null }),
    );
    expect(nullWhenBatch.valid).toBe(false);

    const positive = validateEngineManifestShape(
      validManifest({ supportsBatch: true, maxBatchSize: 500 }),
    );
    expect(positive.valid).toBe(true);
  });

  it("6. rejects duplicate dependency ids", () => {
    const result = validateEngineManifestShape(
      validManifest({ dependencies: ["data-trust", "data-trust"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "dependencies")).toBe(true);
  });

  it("7. rejects a self-dependency", () => {
    const result = validateEngineManifestShape(
      validManifest({ id: "data-trust", dependencies: ["data-trust"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("cannot depend on itself"))).toBe(true);
  });

  it("8. supports open/unknown engine ids, since EngineId is intentionally not a closed union", () => {
    const result = validateEngineManifestShape(validManifest({ id: "a-brand-new-future-engine" }));
    expect(result.valid).toBe(true);
  });

  it("9. validation-error messages never contain the malformed runtime value itself", () => {
    const canary = "CANARY-SENTINEL-ADMIN-KEY-VALUE-DO-NOT-LEAK";
    const result = validateEngineManifestShape(
      validManifest({ engineVersion: canary as EngineManifest["engineVersion"] }),
    );
    expect(result.valid).toBe(false);
    for (const issueItem of result.issues) {
      expect(issueItem.message).not.toContain(canary);
    }
  });

  it("10. a manifest passed through freezeManifest is immutable/read-only", () => {
    const manifest = freezeManifest(validManifest());
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.observability)).toBe(true);
    expect(Object.isFrozen(manifest.inputs)).toBe(true);
    expect(() => {
      (manifest as { id: string }).id = "mutated";
    }).toThrow();
    expect(() => {
      (manifest.dependencies as unknown as string[]).push("x");
    }).toThrow();
  });

  it("manifests contain no executable functions", () => {
    const result = validateEngineManifestShape({
      ...validManifest(),
      observability: { emitsEvents: [], healthCheck: "none", extra: () => "not allowed" },
    });
    expect(result.valid).toBe(false);
  });
});
