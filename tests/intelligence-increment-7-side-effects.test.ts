// GENESIS PHASE 2 -- Increment 7. Side-effect regression sweep (source inspection).
// Proves, across every new file this increment adds, that no write-indicating pattern
// appears anywhere except inside the one explicitly-approved call
// (dataTrustForSite(db, siteId, false) in data-trust-read-adapter.ts, which itself is
// never a write -- see that file's own header comment and Section 15 of
// docs/genesis-phase-2/24_INCREMENT_7_CANONICAL_DATA_TRUST_PATH.md), and that the
// legacy route's own persistence behavior is completely unchanged.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

const NEW_FILES = [
  path.join("services", "intelligence-adapters", "snapshot-provider.ts"),
  path.join("services", "intelligence-adapters", "data-trust-read-adapter.ts"),
  path.join("services", "intelligence-runtime", "intelligence-orchestrator.ts"),
  path.join("services", "intelligence-runtime", "intelligence-orchestrator-instance.ts"),
  path.join("services", "intelligence-adapters", "api-projection-adapter.ts"),
  path.join("app", "api", "intelligence", "data-trust", "site", "route.ts"),
  path.join("app", "api", "intelligence", "data-trust", "site", "handler.ts"),
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
  /\.register\(/, // runtime registry mutation
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 7 side-effect regression sweep", () => {
  it.each(NEW_FILES)("%s contains no write-indicating pattern", (relativeFile) => {
    const source = stripComments(fs.readFileSync(path.join(ROOT, relativeFile), "utf8"));
    for (const pattern of WRITE_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("the one dataTrustForSite call in this increment always passes persist=false literally", () => {
    const source = stripComments(
      fs.readFileSync(path.join(ROOT, "services", "intelligence-adapters", "data-trust-read-adapter.ts"), "utf8"),
    );
    const calls = source.match(/dataTrustForSite\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/,\s*false\s*\)$/);
    }
  });

  it("the legacy route's own persistence call is completely unchanged", () => {
    const source = fs.readFileSync(path.join(ROOT, "app", "api", "data-trust", "site", "route.ts"), "utf8");
    expect(source).toContain("dataTrustForSite(getWritableDb(), id, true)");
  });

  it("no new file writes to config/capabilities.json or any manifest file", () => {
    for (const relativeFile of NEW_FILES) {
      const source = stripComments(fs.readFileSync(path.join(ROOT, relativeFile), "utf8"));
      expect(source).not.toMatch(/capabilities\.json/);
      expect(source).not.toMatch(/canonical-engine-manifests/);
    }
  });
});
