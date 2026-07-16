// STAGE 1 -- WP1.7-1.10 Geospatial APIs -- source-inspection contract tests.
//
// This file reads each app/api/geospatial/**/route.ts as TEXT via
// fs.readFileSync and checks it with string/regex assertions. It
// deliberately never imports any route file as a module: every one of them
// imports @/lib/db, which opens a real node:sqlite DatabaseSync at module
// scope, and a test file with any import path reaching node:sqlite cannot
// be reliably collected by this project's Vitest/Vite pipeline -- the same
// "Failed to load url sqlite (resolved id: sqlite)" failure documented for
// tests/copernicus-truth.test.ts and tests/geospatial-spatial-index.test.ts
// in docs/stage-1/08_TEST_RESULTS.md.
//
// Purpose: tests/geospatial-request-params.test.ts and
// tests/geospatial-compact-site.test.ts prove the pure parsing/shaping
// logic is correct in isolation. This test is the wiring proof -- it
// confirms each route handler actually calls that shared logic and the
// Checkpoint 2 engine functions, rather than re-deriving its own ad hoc
// validation or hand-writing a second copy of the SQL those engine
// functions already encapsulate (Checkpoint 3 requirement 1: "reuse the
// pure query utilities and SQLite adapters from Checkpoint 2").
//
// Real, end-to-end behavior of these routes against a real node:sqlite
// database (including timing against a production-size copy) was verified
// via a separate Node-native harness outside Vitest -- see
// docs/stage-1/07_GEOSPATIAL_APIS.md for that record, the same technique
// already used for the WP1.4 build script and the WP1.6 engine in
// Checkpoint 2.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROUTES = [
  {
    name: "viewport",
    file: path.resolve(__dirname, "..", "app", "api", "geospatial", "viewport", "route.ts"),
    engineImport: "getSitesInBoundingBox",
    paramImports: ["parseBoundingBox", "parseOptionalPositiveInt"],
    compactImport: "toCompactSite",
  },
  {
    name: "clusters",
    file: path.resolve(__dirname, "..", "app", "api", "geospatial", "clusters", "route.ts"),
    engineImport: "getClustersInBoundingBox",
    paramImports: ["parseBoundingBox", "parseResolution", "parseOptionalPositiveInt"],
    compactImport: null,
  },
  {
    name: "radius",
    file: path.resolve(__dirname, "..", "app", "api", "geospatial", "radius", "route.ts"),
    engineImport: "getSitesWithinRadius",
    paramImports: ["parseLatLon", "parseRadiusKm", "parseOptionalPositiveInt"],
    compactImport: "toCompactSiteWithDistance",
  },
  {
    name: "nearest",
    file: path.resolve(__dirname, "..", "app", "api", "geospatial", "nearest", "route.ts"),
    engineImport: "getNearestSites",
    paramImports: ["parseLatLon", "parseOptionalPositiveInt"],
    compactImport: "toCompactSiteWithDistance",
  },
  {
    name: "summary",
    file: path.resolve(__dirname, "..", "app", "api", "geospatial", "summary", "route.ts"),
    engineImport: "getGridSummary",
    paramImports: ["parseResolution", "parseOptionalPositiveInt"],
    compactImport: null,
  },
];

describe.each(ROUTES)("app/api/geospatial/$name/route.ts (source inspection, no node:sqlite import)", (route) => {
  const source = fs.readFileSync(route.file, "utf8");

  it("exists and is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it(`imports and calls the Checkpoint 2 engine function ${route.engineImport}`, () => {
    expect(source).toMatch(new RegExp(`import\\s*\\{[^}]*\\b${route.engineImport}\\b[^}]*\\}\\s*from\\s*["']@/services/geospatial/spatial-intelligence-engine["']`));
    expect(source).toMatch(new RegExp(`${route.engineImport}\\(`));
  });

  it("imports and calls the shared strict request-validation helpers, not ad hoc parsing", () => {
    for (const paramImport of route.paramImports) {
      expect(source).toMatch(new RegExp(`import\\s*\\{[^}]*\\b${paramImport}\\b[^}]*\\}\\s*from\\s*["']@/services/geospatial/request-params["']`));
      expect(source).toMatch(new RegExp(`${paramImport}\\(`));
    }
  });

  it("rejects invalid input with an explicit 400 (strict request validation, requirement 2)", () => {
    const matches = source.match(/status:\s*400/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("uses the read-only getDb(), never getWritableDb(), for these read-only endpoints", () => {
    expect(source).toMatch(/import\s*\{[^}]*\bgetDb\b[^}]*\}\s*from\s*["']@\/lib\/db["']/);
    expect(source).not.toMatch(/getWritableDb/);
  });

  it("never hand-writes SQL or opens node:sqlite directly (all DB access goes through the Checkpoint 2 engine)", () => {
    expect(source).not.toMatch(/db\.prepare\(/);
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
  });

  it("declares the Node runtime and dynamic rendering, matching every other route in this project", () => {
    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).toContain('export const dynamic = "force-dynamic"');
  });

  it("has a catch-all error handler returning 500, matching this project's existing route convention", () => {
    expect(source).toMatch(/catch\s*\(error\)/);
    expect(source).toMatch(/status:\s*500/);
  });

  if (route.compactImport) {
    it(`shapes its per-site response items through ${route.compactImport} (compact payloads only, requirement 5)`, () => {
      expect(source).toMatch(new RegExp(`import\\s*\\{[^}]*\\b${route.compactImport}\\b[^}]*\\}\\s*from\\s*["']@/services/geospatial/compact-site["']`));
      expect(source).toMatch(new RegExp(`\\.map\\(${route.compactImport}\\)`));
    });
  }
});

describe("viewport and clusters routes enforce a hard result/candidate limit (requirement 3)", () => {
  const viewportSource = fs.readFileSync(ROUTES[0].file, "utf8");
  const clustersSource = fs.readFileSync(ROUTES[1].file, "utf8");

  it("viewport passes the parsed limit through to getSitesInBoundingBox rather than fetching unbounded", () => {
    expect(viewportSource).toMatch(/getSitesInBoundingBox\(/);
    expect(viewportSource).toContain("{ limit: limitResult.value }");
  });

  it("clusters passes the parsed limit through to getClustersInBoundingBox rather than fetching unbounded", () => {
    expect(clustersSource).toMatch(/getClustersInBoundingBox\(/);
    expect(clustersSource).toContain("{ limit: limitResult.value }");
  });
});
