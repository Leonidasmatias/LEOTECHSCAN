// GENESIS PHASE 2 -- Increment 8. Side-effect regression sweep (source inspection).
// Proves, across every new file this increment adds, that no write-indicating pattern
// appears anywhere except inside the one explicitly-approved call
// (evidenceCenterForSite(db, siteId, false) in evidence-center-read-adapter.ts, which
// itself is never a write), and that the legacy routes' own persistence behavior is
// completely unchanged.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

const NEW_FILES = [
  path.join("services", "intelligence-adapters", "evidence-checksum.ts"),
  path.join("services", "intelligence-adapters", "evidence-center-read-adapter.ts"),
  path.join("services", "intelligence-runtime", "intelligence-evidence-orchestrator.ts"),
  path.join("services", "intelligence-runtime", "intelligence-evidence-orchestrator-instance.ts"),
  path.join("services", "intelligence-adapters", "evidence-projection-adapter.ts"),
  path.join("app", "api", "intelligence", "evidence-center", "site", "route.ts"),
  path.join("app", "api", "intelligence", "evidence-center", "site", "handler.ts"),
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
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 8 side-effect regression sweep", () => {
  it.each(NEW_FILES)("%s contains no write-indicating pattern", (relativeFile) => {
    const source = stripComments(fs.readFileSync(path.join(ROOT, relativeFile), "utf8"));
    for (const pattern of WRITE_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("the one evidenceCenterForSite call in this increment always passes persist=false literally", () => {
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

  it("the legacy evidence-center export route's own persistence call and filesystem write are completely unchanged", () => {
    const source = fs.readFileSync(path.join(ROOT, "app", "api", "evidence-center", "export", "route.ts"), "utf8");
    expect(source).toContain("evidenceCenterForSite(db, id, true)");
    expect(source).toMatch(/writeFile/);
    expect(source).toMatch(/EXPORTACOES/);
  });

  it("the legacy copernicus site route's own read-only call is completely unchanged", () => {
    const source = fs.readFileSync(path.join(ROOT, "app", "api", "copernicus", "site", "route.ts"), "utf8");
    expect(source).toContain("copernicusForSite(getWritableDb(), id, undefined, undefined, false)");
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
      expect(source).not.toMatch(/node:fs/);
    }
  });
});
