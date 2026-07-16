import { describe, expect, it } from "vitest";
import {
  EngineRegistry,
  CANONICAL_ENGINE_IDS,
  DuplicateEngineDeclarationError,
  EngineNotRegisteredError,
  type EngineDeclaration,
} from "@/services/intelligence";

function declarationFor(id: (typeof CANONICAL_ENGINE_IDS)[number]): EngineDeclaration {
  return {
    id,
    name: `${id} engine`,
    description: `Declared placeholder for the future ${id} engine.`,
    status: "planned",
    version: {
      engineVersion: { major: 0, minor: 1, patch: 0, prerelease: null, build: null },
      contractVersion: { major: 1, minor: 0, patch: 0, prerelease: null, build: null },
      minimumCompatibleVersion: { major: 1, minor: 0, patch: 0, prerelease: null, build: null },
      deprecatedSince: null,
      breakingChanges: [],
    },
    capabilities: [],
    owner: "Genesis Phase 2",
  };
}

describe("EngineRegistry", () => {
  it("declares every canonical engine without instantiating any of them", () => {
    const registry = new EngineRegistry();
    for (const id of CANONICAL_ENGINE_IDS) {
      registry.declare(declarationFor(id));
    }
    const declarations = registry.list();
    expect(declarations).toHaveLength(CANONICAL_ENGINE_IDS.length);
    for (const declaration of declarations) {
      for (const value of Object.values(declaration)) {
        expect(typeof value).not.toBe("function");
      }
    }
  });

  it("retrieves a declared engine by id", () => {
    const registry = new EngineRegistry();
    registry.declare(declarationFor("risk"));
    expect(registry.get("risk").name).toBe("risk engine");
    expect(registry.has("risk")).toBe(true);
    expect(registry.has("opportunity")).toBe(false);
  });

  it("throws EngineNotRegisteredError for an undeclared engine", () => {
    const registry = new EngineRegistry();
    expect(() => registry.get("risk")).toThrow(EngineNotRegisteredError);
  });

  it("throws DuplicateEngineDeclarationError when declaring the same id twice", () => {
    const registry = new EngineRegistry();
    registry.declare(declarationFor("risk"));
    expect(() => registry.declare(declarationFor("risk"))).toThrow(
      DuplicateEngineDeclarationError,
    );
  });

  it("filters declarations by lifecycle status", () => {
    const registry = new EngineRegistry();
    registry.declare(declarationFor("risk"));
    registry.declare(declarationFor("opportunity"));
    expect(registry.listByStatus("planned")).toHaveLength(2);
    expect(registry.listByStatus("active")).toHaveLength(0);
  });
});
