// GENESIS PHASE 2 -- Increment 6 (Recommendation Adapter).
// Dependency-boundary and architectural contract tests via source inspection,
// following the established pattern (tests/intelligence-evidence-adapter-contract.test.ts):
// comments are stripped before matching so prose citing a forbidden import path as
// evidence for NOT importing it cannot false-positive.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runtimeEngineRegistry } from "@/services/intelligence-runtime";
import capabilities from "@/config/capabilities.json";

const ADAPTER_DIR = path.resolve(__dirname, "..", "services", "intelligence-adapters");
const INTELLIGENCE_DIR = path.resolve(__dirname, "..", "services", "intelligence");
const RECOMMENDATION_ADAPTER_FILE = path.join(ADAPTER_DIR, "recommendation-adapter.ts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("services/intelligence-adapters/recommendation-adapter.ts dependency boundaries", () => {
  const source = stripComments(fs.readFileSync(RECOMMENDATION_ADAPTER_FILE, "utf8"));

  it("never imports or calls any legacy recommendation producer", () => {
    expect(source).not.toMatch(/from\s*["'][^"']*data-trust-engine["']/);
    expect(source).not.toMatch(/from\s*["'][^"']*evidence-center-engine["']/);
    expect(source).not.toMatch(/from\s*["'][^"']*recommendation-engine["']/);
    expect(source).not.toMatch(/from\s*["'][^"']*site-recommendation["']/);
    expect(source).not.toMatch(/getRecommendations\(/);
    expect(source).not.toMatch(/getRecommendationsForScope\(/);
  });

  it("never imports node:sqlite, @/lib/db, or services/site-service.ts", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/from\s*["']@\/lib\/db["']/);
    expect(source).not.toMatch(/from\s*["']@\/services\/site-service["']/);
  });

  it("never imports Next.js or an API route module", () => {
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/from\s*["']next["']/);
    expect(source).not.toMatch(/@\/app\/api/);
  });

  it("never performs file or network I/O", () => {
    expect(source).not.toMatch(/from\s*["']node:fs["']/);
    expect(source).not.toMatch(/\bfetch\(/);
    expect(source).not.toMatch(/\.prepare\(/);
  });

  it("imports no legacy service module at all (unlike Evidence, this adapter needs none)", () => {
    expect(source).not.toMatch(/from\s*["'][^"']*services\/(data-trust-engine|confidence-engine|evidence-center-engine|data-quality-engine|duplicates-engine|satellite-validation-engine|copernicus-engine|copernicus-truth|enterprise-v3-engine|rollout-engine)["']/);
    expect(source).not.toMatch(/from\s*["'][^"']*sentinel-core[^"']*["']/);
  });

  it("does not import the Runtime Registry", () => {
    expect(source).not.toMatch(/intelligence-runtime/);
  });

  it("has no Date.now(), Math.random(), or crypto.randomUUID() (determinism)", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
  });

  it("pre-commit hardening item 1: no 'as unknown as' cast or bare 'any' type remains anywhere in the file", () => {
    expect(source).not.toMatch(/as\s+unknown\s+as/);
    expect(source).not.toMatch(/:\s*any\b/);
  });

  it("uses a type-predicate guard (isNonEmptyReadonlyArray) instead of a cast for the non-empty affectedEntities tuple", () => {
    expect(source).toMatch(/function\s+isNonEmptyReadonlyArray/);
    expect(source).toMatch(/values is readonly \[T, \.\.\.T\[\]\]/);
  });
});

describe("services/intelligence/** never imports services/intelligence-adapters/**", () => {
  const files = walkTsFiles(INTELLIGENCE_DIR);

  it("no file under services/intelligence/** references intelligence-adapters", () => {
    for (const file of files) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      expect(source).not.toMatch(/intelligence-adapters/);
    }
  });
});

describe("runtime registry remains truthful after this increment", () => {
  it("no new EngineId was registered for the Recommendation Adapter", () => {
    expect(runtimeEngineRegistry.hasManifest("recommendation-adapter")).toBe(false);
    expect(runtimeEngineRegistry.listManifests()).toHaveLength(3);
  });

  it("the existing 'recommendation' manifest (Increment 2) is unchanged and still 'planned'", () => {
    const manifest = runtimeEngineRegistry.getManifest("recommendation");
    expect(manifest.status).toBe("planned");
  });

  it("no engine is marked active", () => {
    expect(runtimeEngineRegistry.listManifestsByStatus("active")).toHaveLength(0);
  });
});

describe("config/capabilities.json remains unchanged (no capability claim added)", () => {
  it("has no entry referencing the Recommendation Adapter or intelligence-adapters", () => {
    const raw = JSON.stringify(capabilities);
    expect(raw).not.toMatch(/intelligence-adapters/);
    expect(raw).not.toMatch(/recommendation-adapter/);
  });
});
