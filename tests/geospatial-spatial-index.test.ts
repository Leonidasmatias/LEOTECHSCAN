// STAGE 1 -- WP1.4 Spatial Index -- pure schema-contract + source-inspection tests.
//
// This file imports ONLY services/geospatial/spatial-index-sql.mjs, a
// plain-JS module with zero imports of node:sqlite. It deliberately does
// NOT import scripts/geospatial-spatial-index.mjs (the build/rebuild/verify
// script itself), because that script imports node:sqlite directly at
// module scope, and a test file with any import path reaching node:sqlite
// cannot be reliably collected by this project's Vitest/Vite pipeline --
// the same "Failed to load url sqlite (resolved id: sqlite)" failure
// documented for tests/copernicus-truth.test.ts in
// docs/stage-0/05_TEST_BASELINE.md, hit again here for this file's
// original, pre-refactor version. See docs/stage-1/08_TEST_RESULTS.md for
// the full explanation.
//
// Real, end-to-end verification that scripts/geospatial-spatial-index.mjs
// actually builds a correct R-Tree index against real node:sqlite databases
// (synthetic in-memory, a disposable production-size copy, and the live
// database) was run via a separate Node-native harness outside Vitest --
// also documented in 08_TEST_RESULTS.md -- since that is not something this
// test file can safely exercise.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SITE_SPATIAL_INDEX_TABLE,
  SITE_SPATIAL_INDEX_FALLBACK_INDEX,
  CREATE_SITE_SPATIAL_INDEX_RTREE_SQL,
  CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL,
  INSERT_SITE_SPATIAL_INDEX_ROW_SQL,
  DROP_SITE_SPATIAL_INDEX_SQL,
} from "@/services/geospatial/spatial-index-sql.mjs";

describe("services/geospatial/spatial-index-sql.mjs -- pure schema contract", () => {
  it("the R-Tree creation statement targets the expected table and column shape", () => {
    expect(CREATE_SITE_SPATIAL_INDEX_RTREE_SQL).toContain(`CREATE VIRTUAL TABLE ${SITE_SPATIAL_INDEX_TABLE} USING rtree`);
    expect(CREATE_SITE_SPATIAL_INDEX_RTREE_SQL).toContain("id, minLat, maxLat, minLon, maxLon");
  });

  it("the fallback index statement targets sites(latitude, longitude) and is idempotent (IF NOT EXISTS)", () => {
    expect(CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL).toContain("CREATE INDEX IF NOT EXISTS");
    expect(CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL).toContain(SITE_SPATIAL_INDEX_FALLBACK_INDEX);
    expect(CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL).toContain("ON sites(latitude, longitude)");
  });

  it("the insert statement's placeholder count matches the R-Tree table's 5 columns", () => {
    const placeholderCount = (INSERT_SITE_SPATIAL_INDEX_ROW_SQL.match(/\?/g) || []).length;
    expect(placeholderCount).toBe(5);
    expect(INSERT_SITE_SPATIAL_INDEX_ROW_SQL).toContain(SITE_SPATIAL_INDEX_TABLE);
  });

  it("the drop statement is safe to run whether or not the table exists (IF EXISTS)", () => {
    expect(DROP_SITE_SPATIAL_INDEX_SQL).toBe(`DROP TABLE IF EXISTS ${SITE_SPATIAL_INDEX_TABLE}`);
  });
});

const SCRIPT_PATH = path.resolve(__dirname, "..", "scripts", "geospatial-spatial-index.mjs");
const scriptSource = fs.readFileSync(SCRIPT_PATH, "utf8");

describe("scripts/geospatial-spatial-index.mjs uses the shared SQL constants (source inspection, no node:sqlite import)", () => {
  it("imports the DDL constants from services/geospatial/spatial-index-sql.mjs rather than re-hardcoding them", () => {
    expect(scriptSource).toMatch(/import\s*\{[^}]*CREATE_SITE_SPATIAL_INDEX_RTREE_SQL[^}]*\}\s*from\s*["'].*spatial-index-sql\.mjs["']/);
    expect(scriptSource).toMatch(/import\s*\{[^}]*CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL[^}]*\}\s*from\s*["'].*spatial-index-sql\.mjs["']/);
  });

  it("actually uses the imported constants when building the index (not a second, independent DDL string)", () => {
    expect(scriptSource).toContain("db.exec(CREATE_SITE_SPATIAL_INDEX_RTREE_SQL)");
    expect(scriptSource).toContain("db.exec(CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL)");
    expect(scriptSource).toContain("db.exec(DROP_SITE_SPATIAL_INDEX_SQL)");
    // The old inline DDL literal this refactor removed -- if this reappears,
    // the script has drifted back to its own hardcoded copy. Narrowed to the
    // site_spatial_index-specific literal (not just any "CREATE VIRTUAL
    // TABLE" call) so this doesn't false-positive on the legitimate
    // rtreeAvailable() feature-detection probe below, which intentionally
    // creates its own disposable __rtree_probe virtual table and is not the
    // kind of duplication this assertion guards against.
    expect(scriptSource).not.toMatch(/db\.exec\(\s*["']CREATE VIRTUAL TABLE\s+site_spatial_index\s+USING\s+rtree/i);
  });

  it("the rtreeAvailable() probe uses its own disposable table, not the real site_spatial_index table", () => {
    // Guards the narrowed assertion above: confirms the probe statement is
    // still present (so we know the assertion above isn't just vacuously
    // passing because the probe was deleted) and confirms it targets a
    // throwaway name, not site_spatial_index itself.
    const probeMatch = /db\.exec\(\s*["']CREATE VIRTUAL TABLE[^"']*["']\s*\)/.exec(scriptSource);
    expect(probeMatch, "expected to find the rtreeAvailable() probe's CREATE VIRTUAL TABLE call").not.toBeNull();
    expect(probeMatch![0]).toContain("__rtree_probe");
    expect(probeMatch![0]).not.toContain("site_spatial_index");
  });

  it("prefers R-Tree and only falls back to the composite index when CREATE VIRTUAL TABLE fails", () => {
    expect(scriptSource).toMatch(/function rtreeAvailable/);
    expect(scriptSource).toMatch(/rtreeAvailable\(db\)\s*\?\s*["']rtree["']\s*:\s*["']btree_fallback["']/);
  });

  it("never touches the sites table's rows -- only reads from it and writes to its own derived structures", () => {
    expect(scriptSource).not.toMatch(/DELETE FROM sites/i);
    expect(scriptSource).not.toMatch(/UPDATE sites/i);
    expect(scriptSource).not.toMatch(/DROP TABLE (IF EXISTS )?sites\b/i);
  });

  it("wraps the build in a transaction with rollback on failure", () => {
    expect(scriptSource).toContain('db.exec("BEGIN IMMEDIATE")');
    expect(scriptSource).toContain('db.exec("ROLLBACK")');
    expect(scriptSource).toContain('db.exec("COMMIT")');
  });
});
