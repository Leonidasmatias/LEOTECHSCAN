// GENESIS PHASE 2 -- Increment 2 (Engine Manifest / Runtime Registry).
// Pure unit tests for services/intelligence-runtime/{runtime-engine-registry,registry-instance}.ts.
// No I/O, no node:sqlite.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  RuntimeEngineRegistry,
  runtimeEngineRegistry,
  CANONICAL_ENGINE_MANIFESTS,
  type EngineManifest,
} from "@/services/intelligence-runtime";
import { EngineNotRegisteredError, DuplicateEngineDeclarationError } from "@/services/intelligence";

const V0_1_0 = { major: 0, minor: 1, patch: 0, prerelease: null, build: null } as const;
const V1_0_0 = { major: 1, minor: 0, patch: 0, prerelease: null, build: null } as const;

function fixtureManifest(overrides: Partial<EngineManifest> = {}): EngineManifest {
  return {
    id: "fixture-engine",
    name: "Fixture Engine",
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
    capabilityKey: "fixture_engine",
    inputs: [],
    outputs: [],
    dependencies: [],
    supportsPreview: false,
    supportsPersistence: false,
    supportsBatch: false,
    maxBatchSize: null,
    supportedScopes: ["site"],
    securityRequirement: "authenticated-read",
    observability: { emitsEvents: [], healthCheck: "none" },
    ...overrides,
  } as EngineManifest;
}

describe("RuntimeEngineRegistry (fresh instances)", () => {
  it("13. rejects duplicate registration consistently, matching EngineRegistry's own behavior", () => {
    const registry = new RuntimeEngineRegistry();
    registry.register(fixtureManifest({ id: "dup" }));
    expect(() => registry.register(fixtureManifest({ id: "dup" }))).toThrow(
      DuplicateEngineDeclarationError,
    );
  });

  it("14. unknown engine lookup throws EngineNotRegisteredError", () => {
    const registry = new RuntimeEngineRegistry();
    expect(() => registry.getManifest("does-not-exist")).toThrow(EngineNotRegisteredError);
    expect(registry.hasManifest("does-not-exist")).toBe(false);
  });

  it("15. a registered manifest's identity/version match what was registered", () => {
    const registry = new RuntimeEngineRegistry();
    registry.register(fixtureManifest({ id: "identity-check", engineVersion: "2.3.4" as EngineManifest["engineVersion"] }));
    const stored = registry.getManifest("identity-check");
    expect(stored.id).toBe("identity-check");
    expect(stored.engineVersion).toBe("2.3.4");
  });

  it("18. dependency references must already be registered -- unknown dependency throws, correct order succeeds", () => {
    const registry = new RuntimeEngineRegistry();
    expect(() =>
      registry.register(fixtureManifest({ id: "child", dependencies: ["parent"] })),
    ).toThrow(EngineNotRegisteredError);

    registry.register(fixtureManifest({ id: "parent" }));
    expect(() =>
      registry.register(fixtureManifest({ id: "child", dependencies: ["parent"] })),
    ).not.toThrow();
    expect(registry.getManifest("child").dependencies).toEqual(["parent"]);
  });

  it("a malformed manifest is rejected before it ever reaches the underlying EngineRegistry", () => {
    const registry = new RuntimeEngineRegistry();
    expect(() =>
      registry.register(fixtureManifest({ status: "not-a-real-status" as EngineManifest["status"] })),
    ).toThrow();
    expect(registry.hasManifest("fixture-engine")).toBe(false);
  });

  it("registered manifests returned by list/get are frozen (read-only to callers)", () => {
    const registry = new RuntimeEngineRegistry();
    registry.register(fixtureManifest({ id: "frozen-check" }));
    const stored = registry.getManifest("frozen-check");
    expect(Object.isFrozen(stored)).toBe(true);
  });
});

describe("runtimeEngineRegistry singleton (registry-instance.ts)", () => {
  it("11. initializes deterministically -- registering the same fixed, ordered manifest list", () => {
    const ids = runtimeEngineRegistry.listManifests().map((m) => m.id);
    expect(ids).toEqual(CANONICAL_ENGINE_MANIFESTS.map((m) => m.id));
  });

  it("12. expected initial manifests (data-trust, confidence, recommendation) are present", () => {
    expect(runtimeEngineRegistry.hasManifest("data-trust")).toBe(true);
    expect(runtimeEngineRegistry.hasManifest("confidence")).toBe(true);
    expect(runtimeEngineRegistry.hasManifest("recommendation")).toBe(true);
  });

  it("12b. risk, data-quality, and evidence are NOT registered this increment (evaluated, excluded -- see 18_INCREMENT_2 report)", () => {
    expect(runtimeEngineRegistry.hasManifest("risk")).toBe(false);
    expect(runtimeEngineRegistry.hasManifest("data-quality")).toBe(false);
    expect(runtimeEngineRegistry.hasManifest("evidence")).toBe(false);
  });

  it("16. exposes no execution/adapter-running API -- a manifest's presence never implies an adapter exists", () => {
    expect((runtimeEngineRegistry as unknown as Record<string, unknown>).execute).toBeUndefined();
    expect((runtimeEngineRegistry as unknown as Record<string, unknown>).run).toBeUndefined();
    expect((runtimeEngineRegistry as unknown as Record<string, unknown>).invoke).toBeUndefined();
  });

  it("17. no registered canonical engine is marked operational/active prematurely", () => {
    for (const manifest of runtimeEngineRegistry.listManifests()) {
      expect(manifest.status).toBe("planned");
    }
    expect(runtimeEngineRegistry.listManifestsByStatus("active")).toHaveLength(0);
  });

  it("19. dependency/registration ordering is deterministic across repeated access", () => {
    const first = runtimeEngineRegistry.listManifests().map((m) => m.id);
    const second = runtimeEngineRegistry.listManifests().map((m) => m.id);
    expect(second).toEqual(first);
  });

  it("20. repeated access does not duplicate declarations", () => {
    expect(runtimeEngineRegistry.listManifests()).toHaveLength(CANONICAL_ENGINE_MANIFESTS.length);
    expect(runtimeEngineRegistry.listManifests()).toHaveLength(CANONICAL_ENGINE_MANIFESTS.length);
  });

  it("every registered manifest declares no dependencies yet (no adapters exist to depend on)", () => {
    for (const manifest of runtimeEngineRegistry.listManifests()) {
      expect(manifest.dependencies).toEqual([]);
    }
  });
});

describe("services/intelligence-runtime source boundaries (source inspection)", () => {
  const dir = path.resolve(__dirname, "..", "services", "intelligence-runtime");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));

  it("21. no module imports node:sqlite, Next.js, or route code", () => {
    for (const file of files) {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
      expect(source).not.toMatch(/from\s*["']next\/server["']/);
      expect(source).not.toMatch(/from\s*["']next["']/);
      expect(source).not.toMatch(/@\/lib\/db/);
      expect(source).not.toMatch(/@\/app\/api/);
    }
  });

  it("22. is not coupled to sentinel-core", () => {
    for (const file of files) {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      expect(source).not.toMatch(/sentinel-core/);
    }
  });

  it("does not import any legacy services/*-engine.ts module (comments may reference them as evidence)", () => {
    for (const file of files) {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      expect(source).not.toMatch(/from\s*["'][^"']*services\/[a-z-]+-engine[^"']*["']/);
    }
  });
});
