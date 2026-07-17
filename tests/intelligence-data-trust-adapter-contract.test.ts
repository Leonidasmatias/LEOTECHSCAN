// GENESIS PHASE 2 -- Increment 4 (Data Trust Score Adapter).
// Dependency-boundary and architectural contract tests via source inspection,
// following the established pattern (tests/intelligence-site-adapter-contract.test.ts):
// comments are stripped before matching so prose that quotes a forbidden import
// path as evidence for NOT importing it cannot false-positive.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runtimeEngineRegistry } from "@/services/intelligence-runtime";
import capabilities from "@/config/capabilities.json";

const ADAPTER_DIR = path.resolve(__dirname, "..", "services", "intelligence-adapters");
const INTELLIGENCE_DIR = path.resolve(__dirname, "..", "services", "intelligence");
const DATA_TRUST_ADAPTER_FILE = path.join(ADAPTER_DIR, "data-trust-score-adapter.ts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function readAdapterFiles(): Array<{ file: string; source: string }> {
  return fs
    .readdirSync(ADAPTER_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((file) => ({ file, source: stripComments(fs.readFileSync(path.join(ADAPTER_DIR, file), "utf8")) }));
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

describe("services/intelligence-adapters dependency boundaries (source inspection)", () => {
  it("31/32. the Data Trust adapter never imports or calls services/data-trust-engine.ts, and never imports node:sqlite", () => {
    const source = stripComments(fs.readFileSync(DATA_TRUST_ADAPTER_FILE, "utf8"));
    expect(source).not.toMatch(/from\s*["'][^"']*data-trust-engine["']/);
    expect(source).not.toMatch(/dataTrustForSite\(/);
    expect(source).not.toMatch(/recalculateDataTrust\(/);
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
  });

  it("33. no adapter file imports Next.js", () => {
    for (const { source } of readAdapterFiles()) {
      expect(source).not.toMatch(/from\s*["']next\/server["']/);
      expect(source).not.toMatch(/from\s*["']next["']/);
    }
  });

  it("34. no adapter file imports an API route module", () => {
    for (const { source } of readAdapterFiles()) {
      expect(source).not.toMatch(/@\/app\/api/);
    }
  });

  it("35. no adapter file imports a database service (@/lib/db)", () => {
    for (const { source } of readAdapterFiles()) {
      expect(source).not.toMatch(/from\s*["']@\/lib\/db["']/);
      expect(source).not.toMatch(/from\s*["']@\/services\/site-service["']/);
    }
  });

  it("36. no adapter file performs file or network I/O", () => {
    for (const { source } of readAdapterFiles()) {
      expect(source).not.toMatch(/from\s*["']node:fs["']/);
      expect(source).not.toMatch(/\bfetch\(/);
      expect(source).not.toMatch(/\.prepare\(/);
    }
  });

  it("does not call any other legacy engine (confidence/evidence-center/data-quality/duplicates)", () => {
    const source = stripComments(fs.readFileSync(DATA_TRUST_ADAPTER_FILE, "utf8"));
    expect(source).not.toMatch(/from\s*["'][^"']*services\/(confidence-engine|evidence-center-engine|data-quality-engine|duplicates-engine|satellite-validation-engine)["']/);
  });
});

describe("37. services/intelligence/** never imports services/intelligence-adapters/**", () => {
  const files = walkTsFiles(INTELLIGENCE_DIR);

  it("no file under services/intelligence/** references intelligence-adapters", () => {
    for (const file of files) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      expect(source).not.toMatch(/intelligence-adapters/);
    }
  });
});

describe("38. runtime registry remains truthful after this increment", () => {
  it("the data-trust manifest's operational fields are unchanged -- only its description was corrected", () => {
    const manifest = runtimeEngineRegistry.getManifest("data-trust");
    expect(manifest.status).toBe("planned");
    expect(manifest.engineVersion).toBe("0.1.0");
    expect(manifest.contractVersion).toBe("1.0.0");
    expect(manifest.supportsPreview).toBe(true);
    expect(manifest.supportsPersistence).toBe(true);
    expect(manifest.supportsBatch).toBe(true);
    expect(manifest.maxBatchSize).toBe(5000);
    expect(manifest.securityRequirement).toBe("privileged-recalculation");
    expect(manifest.dependencies).toEqual([]);
  });

  it("no new EngineId was registered for the adapter itself", () => {
    expect(runtimeEngineRegistry.hasManifest("data-trust-score-adapter")).toBe(false);
    expect(runtimeEngineRegistry.listManifests()).toHaveLength(3);
  });

  it("no engine is marked active", () => {
    expect(runtimeEngineRegistry.listManifestsByStatus("active")).toHaveLength(0);
  });
});

describe("39. config/capabilities.json remains unchanged (no capability claim added or altered)", () => {
  it("has no entry claiming Data Trust is operational beyond the pre-existing legacy 'data_trust' entry", () => {
    const dataTrustEntries = (capabilities.capabilities as Array<{ key: string; status: string }>).filter(
      (c) => c.key === "data_trust",
    );
    expect(dataTrustEntries).toHaveLength(1);
    // Unchanged from before this increment: legacy feature, not the canonical adapter.
    expect(dataTrustEntries[0].status).toBe("operational");
  });

  it("has no entry referencing the canonical adapter or intelligence-adapters module", () => {
    const raw = JSON.stringify(capabilities);
    expect(raw).not.toMatch(/intelligence-adapters/);
    expect(raw).not.toMatch(/data-trust-score-adapter/);
  });
});
