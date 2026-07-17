// GENESIS PHASE 2 -- Increment 5 (Evidence Adapter).
// Dependency-boundary and architectural contract tests via source inspection,
// following the established pattern (tests/intelligence-data-trust-adapter-contract.test.ts):
// comments are stripped before matching so prose that quotes a forbidden import
// path as evidence for NOT importing it cannot false-positive.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runtimeEngineRegistry } from "@/services/intelligence-runtime";
import capabilities from "@/config/capabilities.json";

const ADAPTER_DIR = path.resolve(__dirname, "..", "services", "intelligence-adapters");
const INTELLIGENCE_DIR = path.resolve(__dirname, "..", "services", "intelligence");
const EVIDENCE_ADAPTER_FILE = path.join(ADAPTER_DIR, "evidence-adapter.ts");
const ADAPTER_INDEX_FILE = path.join(ADAPTER_DIR, "index.ts");

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

describe("services/intelligence-adapters/evidence-adapter.ts dependency boundaries", () => {
  const source = stripComments(fs.readFileSync(EVIDENCE_ADAPTER_FILE, "utf8"));

  it("never imports or calls services/evidence-center-engine.ts", () => {
    expect(source).not.toMatch(/from\s*["'][^"']*evidence-center-engine["']/);
    expect(source).not.toMatch(/evidenceCenterForSite\(/);
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

  it("only imports services/copernicus-truth.ts among legacy service modules -- no other legacy engine", () => {
    expect(source).not.toMatch(/from\s*["'][^"']*services\/(data-trust-engine|confidence-engine|data-quality-engine|duplicates-engine|satellite-validation-engine|copernicus-engine)["']/);
    expect(source).toMatch(/from\s*["']@\/services\/copernicus-truth["']/);
  });

  it("copernicus-truth.ts itself remains dependency-free (re-verifying the precondition this adapter relies on)", () => {
    const truthSource = fs.readFileSync(path.resolve(__dirname, "..", "services", "copernicus-truth.ts"), "utf8");
    expect(truthSource).not.toMatch(/^import /m);
  });
});

describe("pre-commit hardening: isTruthfulCopernicusResponse is not re-exported from the adapter barrel", () => {
  it("services/intelligence-adapters/index.ts does not reference isTruthfulCopernicusResponse", () => {
    const source = stripComments(fs.readFileSync(ADAPTER_INDEX_FILE, "utf8"));
    expect(source).not.toMatch(/isTruthfulCopernicusResponse/);
  });

  it("evidence-adapter.ts no longer re-exports isTruthfulCopernicusResponse as its own named export", () => {
    const source = stripComments(fs.readFileSync(EVIDENCE_ADAPTER_FILE, "utf8"));
    expect(source).not.toMatch(/export\s*\{\s*isTruthfulCopernicusResponse\s*\}/);
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
  it("no new EngineId was registered for the Evidence Adapter", () => {
    expect(runtimeEngineRegistry.hasManifest("evidence")).toBe(false);
    expect(runtimeEngineRegistry.hasManifest("evidence-adapter")).toBe(false);
    expect(runtimeEngineRegistry.listManifests()).toHaveLength(3);
  });

  it("no engine is marked active", () => {
    expect(runtimeEngineRegistry.listManifestsByStatus("active")).toHaveLength(0);
  });
});

describe("config/capabilities.json remains unchanged (no capability claim added)", () => {
  it("has no entry referencing the Evidence Adapter or intelligence-adapters", () => {
    const raw = JSON.stringify(capabilities);
    expect(raw).not.toMatch(/intelligence-adapters/);
    expect(raw).not.toMatch(/evidence-adapter/);
  });

  it("the pre-existing evidence_center entry is unchanged (partial, derived_data -- not claimed operational by this adapter)", () => {
    const entries = (capabilities.capabilities as Array<{ key: string; status: string }>).filter((c) => c.key === "evidence_center");
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("partial");
  });
});
