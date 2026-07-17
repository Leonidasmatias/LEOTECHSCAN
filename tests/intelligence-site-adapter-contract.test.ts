// GENESIS PHASE 2 -- Increment 3 (Site Entity Adapter).
// Dependency-boundary contract tests via source inspection, following the
// established pattern (tests/geospatial-api-contract.test.ts,
// tests/intelligence-runtime-registry.test.ts's "source boundaries" suite):
// this file never imports a module that could transitively reach
// node:sqlite -- it reads the adapter's own source as text instead.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ADAPTER_DIR = path.resolve(__dirname, "..", "services", "intelligence-adapters");
// data-trust-read-adapter.ts (Increment 7) is a deliberate, documented exception to
// "every file in this directory is pure": it is the DB-touching outer adapter
// `docs/genesis-phase-2/23_INCREMENT_6_5_ARCHITECTURAL_DECISIONS.md` Decision C /
// ADR-018 formally scoped into this directory (per `08_ADAPTER_STRATEGY.md`'s own
// category 2 "DB-fetching half" carve-out). Its own dedicated contract test
// (tests/intelligence-increment-7-contract.test.ts) covers its specific boundaries
// instead. Excluding it here is narrower than weakening any check -- every other
// file in this directory is still swept by every assertion below, unchanged.
const ADAPTER_EXCLUSIONS = ["data-trust-read-adapter.ts"];
const ADAPTER_FILES = fs.readdirSync(ADAPTER_DIR).filter((f) => f.endsWith(".ts") && !ADAPTER_EXCLUSIONS.includes(f));
const INTELLIGENCE_DIR = path.resolve(__dirname, "..", "services", "intelligence");

// Strips block and line comments before checking for real imports/calls, so a
// doc comment that quotes a forbidden import path as prose evidence (e.g.
// explaining *why* a module is NOT imported) doesn't false-positive against
// these boundary checks.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function readAdapterSources(): Array<{ file: string; source: string }> {
  return ADAPTER_FILES.map((file) => ({
    file,
    source: stripComments(fs.readFileSync(path.join(ADAPTER_DIR, file), "utf8")),
  }));
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
  it("21. no adapter file imports node:sqlite", () => {
    for (const { source } of readAdapterSources()) {
      expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    }
  });

  it("22. no adapter file imports Next.js", () => {
    for (const { source } of readAdapterSources()) {
      expect(source).not.toMatch(/from\s*["']next\/server["']/);
      expect(source).not.toMatch(/from\s*["']next["']/);
    }
  });

  it("23. no adapter file imports an API route module", () => {
    for (const { source } of readAdapterSources()) {
      expect(source).not.toMatch(/@\/app\/api/);
    }
  });

  it("24. no adapter file performs file or database I/O", () => {
    for (const { source } of readAdapterSources()) {
      expect(source).not.toMatch(/from\s*["']node:fs["']/);
      expect(source).not.toMatch(/\bfetch\(/);
      expect(source).not.toMatch(/from\s*["']@\/lib\/db["']/);
      expect(source).not.toMatch(/\.prepare\(/);
    }
  });

  it("26. no adapter file calls a legacy Data Trust/Confidence/Evidence/Recommendation/Risk/Data Quality engine", () => {
    for (const { source } of readAdapterSources()) {
      expect(source).not.toMatch(/from\s*["'][^"']*services\/(data-trust-engine|confidence-engine|evidence-center-engine|data-quality-engine|duplicates-engine)["']/);
    }
  });

  it("does not import services/site-service.ts (would transitively reach node:sqlite via @/lib/db)", () => {
    for (const { source } of readAdapterSources()) {
      expect(source).not.toMatch(/from\s*["']@\/services\/site-service["']/);
    }
  });
});

describe("25. services/intelligence/** never imports services/intelligence-adapters/**", () => {
  const files = walkTsFiles(INTELLIGENCE_DIR);

  it("no file under services/intelligence/** references intelligence-adapters", () => {
    for (const file of files) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      expect(source).not.toMatch(/intelligence-adapters/);
    }
  });
});
