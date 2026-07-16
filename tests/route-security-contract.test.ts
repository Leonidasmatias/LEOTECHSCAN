// GENESIS PHASE 2 -- Increment 0 Security Floor. Route security contract (source inspection).
//
// app/api/data-trust/recalculate/route.ts imports @/lib/db, and app/api/sentinel-core/build/route.ts
// imports @/sentinel-core/engine, which imports @/lib/db -- both transitively open a real
// node:sqlite DatabaseSync at module scope, the same reason this project's existing API contract
// tests (e.g. tests/geospatial-api-contract.test.ts) never import route.ts files as modules and
// instead source-inspect them via fs.readFileSync. This test follows that established pattern.
//
// Coverage limitation: this proves the guard is wired in correctly at the source level (imported,
// invoked, and its short-circuit textually precedes every body/DB/engine call) -- it does not
// execute the route handler end-to-end against a live request. Real request/response behavior of
// the guard itself (401/503/200, message content) is covered by tests/auth-guard.test.ts; this
// file is the wiring proof that both routes actually call that guard before doing anything else.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PROTECTED_ROUTES = [
  {
    name: "POST /api/data-trust/recalculate",
    file: path.resolve(__dirname, "..", "app", "api", "data-trust", "recalculate", "route.ts"),
    sideEffectMarkers: ["getWritableDb(", "recalculateDataTrust("],
  },
  {
    name: "POST /api/sentinel-core/build",
    file: path.resolve(__dirname, "..", "app", "api", "sentinel-core", "build", "route.ts"),
    sideEffectMarkers: ["buildGraph("],
  },
];

describe.each(PROTECTED_ROUTES)("$name security contract", (route) => {
  const source = fs.readFileSync(route.file, "utf8");

  it("exists and is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("imports requireAdminAuth from @/lib/auth-guard", () => {
    expect(source).toMatch(/import\s*\{[^}]*\brequireAdminAuth\b[^}]*\}\s*from\s*["']@\/lib\/auth-guard["']/);
  });

  it("calls requireAdminAuth(request) and short-circuits with the guard's response on failure", () => {
    expect(source).toMatch(/requireAdminAuth\(request\)/);
    expect(source).toMatch(/if\s*\(\s*!auth\.authorized\s*\)\s*return\s+auth\.response\s*;/);
  });

  it("checks authorization before request-body parsing, database access, and engine execution", () => {
    const authCallIndex = source.indexOf("requireAdminAuth(request)");
    expect(authCallIndex).toBeGreaterThan(-1);

    for (const marker of route.sideEffectMarkers) {
      const markerIndex = source.indexOf(marker);
      expect(markerIndex).toBeGreaterThan(-1);
      expect(markerIndex).toBeGreaterThan(authCallIndex);
    }

    const bodyParseIndex = source.indexOf("request.json()");
    if (bodyParseIndex > -1) expect(bodyParseIndex).toBeGreaterThan(authCallIndex);
  });

  it("still declares the Node runtime and dynamic rendering, matching this project's route convention", () => {
    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).toContain('export const dynamic = "force-dynamic"');
  });
});
