// STAGE 1 -- WP1.6 Spatial Intelligence Service -- adapter/pure-layer contract test.
//
// Source-inspection (static) test: reads services/geospatial/spatial-intelligence-engine.ts
// as TEXT via fs.readFileSync and checks it with string/regex assertions. It
// deliberately never imports the module (that would require a real
// node:sqlite-backed database to exercise meaningfully, and this project's
// Vitest/Vite pipeline cannot reliably collect a test file with any import
// path reaching node:sqlite -- see docs/stage-1/08_TEST_RESULTS.md). The
// same technique is already used by tests/capabilities-registry.test.ts
// (Stage 0) and tests/copernicus-engine-contract.test.ts (Stage 0's
// analogous fix for the same underlying problem).
//
// Purpose: tests/geospatial-spatial-intelligence-engine.test.ts proves the
// pure query-shaping logic in services/geospatial/spatial-query-utils.ts is
// correct in isolation. This test is the other half -- it proves the
// SQLite adapter layer actually calls that shared logic instead of
// re-deriving its own (possibly drifted) copy of the same math, which is
// exactly the kind of regression (logic duplicated in two places, only one
// of which gets fixed later) audit-v4 risk R1 was originally about for the
// Copernicus truth triplet.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ENGINE_PATH = path.resolve(__dirname, "..", "services", "geospatial", "spatial-intelligence-engine.ts");
const engineSource = fs.readFileSync(ENGINE_PATH, "utf8");

describe("services/geospatial/spatial-intelligence-engine.ts uses the shared pure query layer (source inspection, no DB import)", () => {
  it("imports the pure query-shaping functions from spatial-query-utils rather than nothing", () => {
    const expectedImports = [
      "clampLimit",
      "haversineKm",
      "radiusToBoundingBox",
      "withDistances",
      "filterWithinRadius",
      "excludeAndLimit",
      "aggregateIntoGridClusters",
      "validateBoundingBox",
      "buildInPlaceholders",
    ];
    const importBlockMatch = engineSource.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']@\/services\/geospatial\/spatial-query-utils["']/);
    expect(importBlockMatch).not.toBeNull();
    const importedNames = importBlockMatch![1];
    for (const name of expectedImports) {
      expect(importedNames).toContain(name);
    }
  });

  it("actually calls the imported pure functions at their expected use sites", () => {
    expect(engineSource).toMatch(/clampLimit\(/);
    expect(engineSource).toMatch(/validateBoundingBox\(bbox\)/);
    expect(engineSource).toMatch(/radiusToBoundingBox\(center,\s*radiusKm\)/);
    expect(engineSource).toMatch(/withDistances\(center,/);
    expect(engineSource).toMatch(/filterWithinRadius\(/);
    expect(engineSource).toMatch(/excludeAndLimit\(/);
    expect(engineSource).toMatch(/aggregateIntoGridClusters\(/);
  });

  it("never reimplements the Haversine formula inline (must come only from the shared module)", () => {
    // The exact pattern the original inline implementation used before this
    // refactor. If this reappears, the adapter has drifted from
    // spatial-query-utils.ts and there are now two independent copies of the
    // distance formula that could silently diverge.
    expect(engineSource).not.toMatch(/Math\.sin\(dLat \/ 2\)/);
    expect(engineSource).not.toMatch(/const EARTH_RADIUS_KM/);
  });

  it("never reimplements grid-cluster aggregation inline (must come only from aggregateIntoGridClusters)", () => {
    expect(engineSource).not.toMatch(/new Map<string,\s*\{\s*cellId/);
    expect(engineSource).not.toMatch(/clusters\.set\(/);
  });

  it("never reimplements bounding-box validation inline (must come only from validateBoundingBox)", () => {
    expect(engineSource).not.toMatch(/north\s*<=\s*south/);
  });

  it("still enforces hard result-count limits on every read operation (never an unlimited national query)", () => {
    const exportedFunctionNames = [
      "getSitesInBoundingBox",
      "getClustersInBoundingBox",
      "getSitesWithinRadius",
      "getNearestSites",
      "getGridSummary",
    ];
    for (const name of exportedFunctionNames) {
      // 1,200 chars, not 400 -- some of these functions (e.g.
      // getClustersInBoundingBox) carry a long explanatory comment before
      // their first limit-clamping line, and this check should follow the
      // actual code, not force comments to stay short.
      const fnMatch = new RegExp(`export function ${name}\\([^)]*\\)[\\s\\S]{0,1200}`).exec(engineSource);
      expect(fnMatch, `expected to find export function ${name}(...)`).not.toBeNull();
      expect(fnMatch![0]).toMatch(/clampLimit|limit/);
    }
  });
});
