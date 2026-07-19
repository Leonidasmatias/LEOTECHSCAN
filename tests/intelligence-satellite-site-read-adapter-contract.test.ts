// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 3.
// Dependency-boundary and behavioral contract tests for
// services/intelligence-adapters/io/satellite-site-read-adapter.ts.
//
// This file is never imported directly: it transitively resolves
// node:sqlite via getWritableDb() (@/lib/db), the same collection
// hazard every other io/-classified file in this project carries.
// Following the established, already-validated pattern for
// data-trust-read-adapter.ts/evidence-center-read-adapter.ts (see
// tests/intelligence-increment-9-side-effects.test.ts's own
// "persist=false literal" checks), every assertion below is
// source-inspection only -- comments stripped before matching, matching
// the services/intelligence-adapters/ convention.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ADAPTER_FILE = path.resolve(
  __dirname,
  "..",
  "services",
  "intelligence-adapters",
  "io",
  "satellite-site-read-adapter.ts",
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 10 Wave 3: satellite-site-read-adapter.ts exists", () => {
  it("the file exists at the frozen path", () => {
    expect(fs.existsSync(ADAPTER_FILE)).toBe(true);
  });
});

describe("Increment 10 Wave 3: satellite-site-read-adapter.ts import boundary", () => {
  const source = stripComments(fs.readFileSync(ADAPTER_FILE, "utf8"));

  it("imports exactly the four allowed dependencies", () => {
    expect(source).toMatch(/import type \{ DatabaseSync \} from ["']node:sqlite["']/);
    expect(source).toMatch(/import type \{ SiteRow \} from ["']@\/lib\/types["']/);
    expect(source).toMatch(/import \{ getWritableDb \} from ["']@\/lib\/db["']/);
    expect(source).toMatch(/import \{ siteRow \} from ["']@\/services\/site-service["']/);
  });

  it("never imports either legacy Copernicus module", () => {
    expect(source).not.toMatch(/copernicus-engine/);
    expect(source).not.toMatch(/copernicus-truth/);
  });

  it("never imports SITE_SELECT or @/api/site-query", () => {
    expect(source).not.toMatch(/SITE_SELECT/);
    expect(source).not.toMatch(/@\/api\/site-query/);
  });

  it("imports no other export from @/services/site-service besides siteRow", () => {
    const importLine = source.match(/import \{[^}]*\} from ["']@\/services\/site-service["']/);
    expect(importLine).not.toBeNull();
    expect(importLine?.[0]).toMatch(/^\s*import\s*\{\s*siteRow\s*\}\s*from/);
  });

  it("never imports any other *-engine module", () => {
    const engineImports = source.match(/from\s*["'][^"']*-engine[^"']*["']/g) ?? [];
    expect(engineImports).toHaveLength(0);
  });

  it("never imports next or next/server or @/app/api", () => {
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/from\s*["']next["']/);
    expect(source).not.toMatch(/@\/app\/api/);
  });
});

describe("Increment 10 Wave 3: satellite-site-read-adapter.ts behavioral contract (source-verified)", () => {
  const source = stripComments(fs.readFileSync(ADAPTER_FILE, "utf8"));

  it("declares the exact frozen export signature with a default database parameter", () => {
    expect(source).toMatch(
      /export function fetchSatelliteSiteRow\(\s*siteId:\s*number,\s*db:\s*DatabaseSync\s*=\s*getWritableDb\(\),?\s*\)\s*:\s*SiteRow \| null/,
    );
  });

  it("uses the injected db parameter for the lookup, never re-acquiring a fresh connection internally", () => {
    // getWritableDb() appears exactly once -- as the default parameter value,
    // never called again inside the function body.
    const calls = source.match(/getWritableDb\(\)/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(source).toMatch(/db\.prepare\(/);
  });

  it("performs a parameterized, read-only lookup against the sites table by id", () => {
    expect(source).toMatch(/db\.prepare\(\s*["']SELECT \* FROM sites WHERE id = \?["']\s*\)\.get\(siteId\)/);
  });

  it("returns null when no row is found, before ever calling siteRow", () => {
    expect(source).toMatch(/if\s*\(\s*!raw\s*\)\s*return null;/);
    const nullReturnIndex = source.indexOf("if (!raw) return null;");
    const siteRowCallIndex = source.indexOf("siteRow(raw)");
    expect(nullReturnIndex).toBeGreaterThan(-1);
    expect(siteRowCallIndex).toBeGreaterThan(-1);
    expect(nullReturnIndex).toBeLessThan(siteRowCallIndex);
  });

  it("converts the raw row through the canonical siteRow(raw) mapping, never a hand-rolled shape", () => {
    expect(source).toMatch(/return siteRow\(raw\);/);
  });

  it("performs no writes (no INSERT/UPDATE/DELETE/.run)", () => {
    expect(source).not.toMatch(/INSERT INTO/i);
    expect(source).not.toMatch(/UPDATE\s+\w+\s+SET/i);
    expect(source).not.toMatch(/DELETE FROM/i);
    expect(source).not.toMatch(/\.run\(/);
  });

  it("performs no schema initialization (no ensure*Tables call)", () => {
    expect(source).not.toMatch(/ensure\w*Tables/);
  });

  it("has no try/catch of its own -- a genuine database exception propagates uncaught to the caller", () => {
    expect(source).not.toMatch(/\btry\b/);
    expect(source).not.toMatch(/\bcatch\b/);
  });

  it("has no Date.now(), Math.random(), or crypto.randomUUID()", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
  });

  it("declares a synchronous function (no async, no Promise return type)", () => {
    expect(source).not.toMatch(/export\s+async\s+function\s+fetchSatelliteSiteRow/);
    expect(source).not.toMatch(/Promise<SiteRow/);
  });
});
