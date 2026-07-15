// STAGE 0 -- WP0.10 Initial Automated Tests, companion to tests/copernicus-truth.test.ts.
//
// This is a source-inspection (static) contract test: it reads services/copernicus-engine.ts
// as TEXT via fs.readFileSync and checks it with string/regex assertions. It deliberately never
// imports services/copernicus-engine.ts as a module, because that file transitively imports
// node:sqlite via services/site-service.ts -> lib/db.ts (see
// docs/stage-0/05_TEST_BASELINE.md's "Follow-up" section). The same technique is already used
// by tests/capabilities-registry.test.ts to scan components/**/*.tsx without importing them.
//
// Purpose: tests/copernicus-truth.test.ts proves the pure contract in services/copernicus-truth.ts
// is correct in isolation. This test is the other half -- it proves services/copernicus-engine.ts
// actually uses that shared contract instead of drifting back to its own hardcoded copies, which
// is exactly the kind of regression (a truth value re-hardcoded in one place and never updated)
// that caused audit-v4 risk R1 in the first place.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ENGINE_PATH = path.resolve(__dirname, "..", "services", "copernicus-engine.ts");
const engineSource = fs.readFileSync(ENGINE_PATH, "utf8");

describe("services/copernicus-engine.ts uses the shared truth module (source inspection, no DB import)", () => {
  it("imports copernicusTruthMetadata and MOCK_SCENE_ID_PREFIX from services/copernicus-truth", () => {
    expect(engineSource).toMatch(/import\s*\{[^}]*copernicusTruthMetadata[^}]*\}\s*from\s*["']@\/services\/copernicus-truth["']/);
    expect(engineSource).toMatch(/import\s*\{[^}]*MOCK_SCENE_ID_PREFIX[^}]*\}\s*from\s*["']@\/services\/copernicus-truth["']/);
  });

  it("actually calls copernicusTruthMetadata() at every response construction site (at least 4 call sites)", () => {
    const callSites = engineSource.match(/\.\.\.copernicusTruthMetadata\(\)/g) || [];
    expect(callSites.length).toBeGreaterThanOrEqual(4);
  });

  it("uses MOCK_SCENE_ID_PREFIX for synthetic scene ids instead of a re-hardcoded literal", () => {
    expect(engineSource).toContain("MOCK_SCENE_ID_PREFIX");
    // The old hardcoded template-literal prefix must be gone -- if this ever reappears, someone
    // re-introduced a second, independent copy of the prefix that could drift from the shared one.
    expect(engineSource).not.toMatch(/`MOCK_S1_\$\{/);
  });

  it("never re-hardcodes the truth triplet as inline literals (must come only from the shared module)", () => {
    // Matches the exact old pattern this refactor removed: `dataStatus: "simulated" as const,`
    // (with or without the `as const`). If this reappears, the engine has drifted from
    // services/copernicus-truth.ts and this contract is broken even if copernicus-truth.ts
    // itself is still correct.
    expect(engineSource).not.toMatch(/dataStatus:\s*["']simulated["']/);
    expect(engineSource).not.toMatch(/source:\s*["']local_rule_engine["']/);
    expect(engineSource).not.toMatch(/isRealSatelliteEvidence:\s*false/);
  });
});
