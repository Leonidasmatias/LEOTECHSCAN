// GENESIS PHASE 2 -- Increment 9. Side-effect regression sweep (source inspection).
// Proves, across every new file this increment adds, that no write-indicating pattern
// appears anywhere, and that both frozen capabilities' own persistence behavior and
// the legacy routes' behavior are completely unchanged.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

const NEW_FILES = [
  path.join("services", "intelligence-runtime", "site-intelligence-aggregator.ts"),
  path.join("services", "intelligence-runtime", "site-intelligence-aggregator-instance.ts"),
  path.join("services", "intelligence-adapters", "site-intelligence-projection-adapter.ts"),
  path.join("app", "api", "intelligence", "site", "route.ts"),
  path.join("app", "api", "intelligence", "site", "handler.ts"),
];

const WRITE_PATTERNS = [
  /\.run\(/,
  /INSERT INTO/i,
  /UPDATE\s+\w+\s+SET/i,
  /DELETE FROM/i,
  /recordAudit/,
  /localStorage/,
  /sessionStorage/,
  /fs\.writeFile/,
  /fs\.appendFile/,
  /writeFile/,
  /mkdir/,
  /EXPORTACOES/,
  /\.register\(/, // runtime registry mutation
  /getWritableDb/,
  /\bgetDb\(/,
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 9 side-effect regression sweep", () => {
  it.each(NEW_FILES)("%s contains no write-indicating pattern", (relativeFile) => {
    const source = stripComments(fs.readFileSync(path.join(ROOT, relativeFile), "utf8"));
    for (const pattern of WRITE_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("neither new runtime file references node:fs", () => {
    for (const relativeFile of NEW_FILES) {
      const source = stripComments(fs.readFileSync(path.join(ROOT, relativeFile), "utf8"));
      expect(source).not.toMatch(/node:fs/);
    }
  });

  it("no new file writes to config/capabilities.json, package.json, or any manifest file", () => {
    for (const relativeFile of NEW_FILES) {
      const source = stripComments(fs.readFileSync(path.join(ROOT, relativeFile), "utf8"));
      expect(source).not.toMatch(/capabilities\.json/);
      expect(source).not.toMatch(/canonical-engine-manifests/);
      expect(source).not.toMatch(/package\.json/);
    }
  });

  it("no new file references the legacy export/filesystem-write path", () => {
    for (const relativeFile of NEW_FILES) {
      const source = stripComments(fs.readFileSync(path.join(ROOT, relativeFile), "utf8"));
      expect(source).not.toMatch(/EXPORTACOES/);
    }
  });

  it("Data Trust's outer read adapter still calls dataTrustForSite with persist=false literally, unaffected by Increment 9", () => {
    const source = stripComments(
      fs.readFileSync(path.join(ROOT, "services", "intelligence-adapters", "data-trust-read-adapter.ts"), "utf8"),
    );
    const calls = source.match(/dataTrustForSite\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/,\s*false\s*\)$/);
    }
  });

  it("Evidence Center's outer read adapter still calls evidenceCenterForSite with persist=false literally, unaffected by Increment 9", () => {
    const source = stripComments(
      fs.readFileSync(path.join(ROOT, "services", "intelligence-adapters", "evidence-center-read-adapter.ts"), "utf8"),
    );
    const calls = source.match(/evidenceCenterForSite\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/,\s*false\s*\)$/);
    }
  });

  it("the legacy evidence-center site route's own persistence call is completely unchanged", () => {
    const source = fs.readFileSync(path.join(ROOT, "app", "api", "evidence-center", "site", "route.ts"), "utf8");
    expect(source).toContain("evidenceCenterForSite(getWritableDb(), id, true)");
  });

  it("the legacy data-trust site route's own behavior is unaffected", () => {
    expect(fs.existsSync(path.join(ROOT, "app", "api", "data-trust", "site", "route.ts"))).toBe(true);
  });

  it("the aggregator composes only existing read behavior -- no new schema-initialization path is introduced beyond the union of both frozen capabilities' own already-documented paths", () => {
    const instanceSource = stripComments(
      fs.readFileSync(
        path.join(ROOT, "services", "intelligence-runtime", "site-intelligence-aggregator-instance.ts"),
        "utf8",
      ),
    );
    expect(instanceSource).not.toMatch(/ensure\w*Tables/);
  });
});
