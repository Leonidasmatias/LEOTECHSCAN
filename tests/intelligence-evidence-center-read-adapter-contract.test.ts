// GENESIS PHASE 2 -- Increment 8 (Evidence Center outer adapter contract).
// Dependency-boundary and architectural contract tests via source inspection,
// following the established pattern (tests/intelligence-increment-7-contract.test.ts's
// "Data Trust outer adapter" describe block): comments are stripped before matching so
// prose citing a forbidden import path as evidence for NOT importing it cannot
// false-positive.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const OUTER_ADAPTER_FILE = path.resolve(__dirname, "..", "services", "intelligence-adapters", "evidence-center-read-adapter.ts");
const BARREL_FILE = path.resolve(__dirname, "..", "services", "intelligence-adapters", "index.ts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function read(file: string): string {
  return stripComments(fs.readFileSync(file, "utf8"));
}

describe("Increment 8: Evidence Center outer adapter (evidence-center-read-adapter.ts)", () => {
  const source = read(OUTER_ADAPTER_FILE);

  it("calls evidenceCenterForSite with a literal false persist argument, never omitted or true", () => {
    expect(source).toMatch(/evidenceCenterForSite\(\s*db\s*,\s*siteId\s*,\s*false\s*\)/);
    expect(source).not.toMatch(/evidenceCenterForSite\(\s*db\s*,\s*siteId\s*\)/);
    expect(source).not.toMatch(/evidenceCenterForSite\([^)]*,\s*true\s*\)/);
  });

  it("imports evidenceCenterForSite and getWritableDb (not getDb)", () => {
    expect(source).toMatch(/from\s*["']@\/services\/evidence-center-engine["']/);
    expect(source).toMatch(/import\s*\{\s*getWritableDb\s*\}\s*from\s*["']@\/lib\/db["']/);
    expect(source).not.toMatch(/\bgetDb\(/);
  });

  it("performs no canonical translation (no toIdentifier/Evidence kind construction)", () => {
    expect(source).not.toMatch(/toIdentifier/);
    expect(source).not.toMatch(/kind:\s*["']Evidence["']/);
  });

  it("does not compute a checksum", () => {
    expect(source).not.toMatch(/computeEvidenceChecksum/);
    expect(source).not.toMatch(/createHash/);
  });

  it("does not derive a snapshot", () => {
    expect(source).not.toMatch(/deriveSiteSnapshot/);
  });

  it("performs no HTTP projection and imports no route/Next.js code", () => {
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/NextResponse/);
  });

  it("never writes (no INSERT/recordAudit call of its own) and never touches export/filesystem behavior", () => {
    expect(source).not.toMatch(/\.run\(/);
    expect(source).not.toMatch(/recordAudit/);
    expect(source).not.toMatch(/writeFile/);
    expect(source).not.toMatch(/EXPORTACOES/);
    expect(source).not.toMatch(/from\s*["']node:fs["']/);
  });

  it("returns a narrow shape -- no trust/copernicus/notes/history/googleMaps/technicalRecommendation/governance field is referenced", () => {
    for (const forbiddenField of ["trust", "copernicus", "notes", "history", "googleMaps", "technicalRecommendation", "governance"]) {
      expect(source).not.toMatch(new RegExp(`\\.${forbiddenField}\\b`));
    }
  });

  it("does not expose a raw DatabaseSync object beyond the function parameter type", () => {
    // The only DatabaseSync reference should be the type-only import and the
    // db parameter's own type annotation -- never returned as part of the result.
    expect(source).not.toMatch(/readonly db:/);
  });
});

describe("Increment 8: evidence-center-read-adapter.ts is not exported through the pure adapter barrel", () => {
  const barrelSource = read(BARREL_FILE);

  it("the barrel never references evidence-center-read-adapter", () => {
    expect(barrelSource).not.toMatch(/evidence-center-read-adapter/);
  });
});
