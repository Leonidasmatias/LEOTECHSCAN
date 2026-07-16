#!/usr/bin/env node
// STAGE 1 -- WP1.4 Spatial Index build / rebuild / verify.
//
// Creates and populates `site_spatial_index`, a derived, disposable lookup
// structure over sites(latitude, longitude). "Derived and disposable" is
// the load-bearing property here: this table holds nothing that isn't
// already in `sites` (just a bounding box per site, plus for rtree the id).
// It can always be dropped and rebuilt from scratch with no data loss --
// that is exactly why a full rebuild-from-scratch is an acceptable strategy
// here (see docs/stage-1/11_ROLLBACK_PLAN.md), unlike anything touching
// `sites` itself.
//
// Strategy, in preference order (WP1.4):
//   1. SQLite R-Tree virtual table (CREATE VIRTUAL TABLE ... USING rtree).
//      Preferred: O(log n) bounding-box lookups via SQLite's own spatial
//      index implementation. Requires the SQLite build in use to have been
//      compiled with SQLITE_ENABLE_RTREE. Node's built-in node:sqlite has
//      this compiled in (verified directly: a CREATE VIRTUAL TABLE ... USING
//      rtree(...) statement succeeds against Node 22 and, per the Stage 1
//      inspection, the production app runs on Node 24, which bundles the
//      same SQLite amalgamation build). This script always runs through
//      node:sqlite specifically (not Python's sqlite3, which has its own,
//      separately-compiled RTREE support) so the index-build path uses the
//      exact same SQLite feature set the running application queries
//      against at runtime.
//   2. Fallback: a plain composite B-tree index on sites(latitude,
//      longitude). Not O(log n) for a 2D bounding-box query the way R-Tree
//      is, but vastly better than an unindexed full-table scan (the
//      pre-Stage-1 status quo), and requires no virtual table module at
//      all. Used automatically if step 1's CREATE VIRTUAL TABLE fails.
//
// This script never touches `sites` or any other existing table -- it only
// creates/repopulates its own derived structures.
//
// The DDL text itself lives in services/geospatial/spatial-index-sql.mjs,
// a plain-JS module with zero node:sqlite dependency, shared between this
// script and tests/geospatial-spatial-index.test.ts's pure schema-contract
// checks -- see docs/stage-1/08_TEST_RESULTS.md for why that split exists
// (the short version: Vitest cannot reliably collect a test file that
// imports node:sqlite, directly or transitively, in this project's
// toolchain).
//
// Usage:
//   node scripts/geospatial-spatial-index.mjs --database <path> --mode dry-run
//   node scripts/geospatial-spatial-index.mjs --database <path> --mode build
//   node scripts/geospatial-spatial-index.mjs --database <path> --mode verify
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import {
  SITE_SPATIAL_INDEX_TABLE,
  SITE_SPATIAL_INDEX_FALLBACK_INDEX,
  CREATE_SITE_SPATIAL_INDEX_RTREE_SQL,
  CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL,
  INSERT_SITE_SPATIAL_INDEX_ROW_SQL,
  DROP_SITE_SPATIAL_INDEX_SQL,
} from "../services/geospatial/spatial-index-sql.mjs";

function nowIso() {
  return new Date().toISOString();
}

function rtreeAvailable(db) {
  try {
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS __rtree_probe USING rtree(id, minX, maxX, minY, maxY)");
    db.exec("DROP TABLE IF EXISTS __rtree_probe");
    return true;
  } catch {
    return false;
  }
}

function tableExists(db, name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','virtual table') AND name = ?").get(name);
}

function logRun(db, { runType, mode, status, sitesProcessed, sitesTotal, notes, startedAt }) {
  db.prepare(
    `INSERT INTO geospatial_processing_runs (run_type, mode, started_at, finished_at, status, sites_processed, sites_total, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(runType, mode, startedAt, nowIso(), status, sitesProcessed ?? null, sitesTotal ?? null, notes ?? null);
}

export function buildSpatialIndex(db, { dryRun = false } = {}) {
  const startedAt = nowIso();
  const strategy = rtreeAvailable(db) ? "rtree" : "btree_fallback";

  const sitesTotalRow = db.prepare("SELECT COUNT(*) AS n FROM sites").get();
  const sitesTotal = sitesTotalRow.n;
  const geocodedRow = db
    .prepare("SELECT COUNT(*) AS n FROM sites WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
    .get();
  const sitesToIndex = geocodedRow.n;

  if (dryRun) {
    return { strategy, sitesTotal, sitesToIndex, dryRun: true };
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    if (strategy === "rtree") {
      db.exec(DROP_SITE_SPATIAL_INDEX_SQL);
      db.exec(CREATE_SITE_SPATIAL_INDEX_RTREE_SQL);
      const insert = db.prepare(INSERT_SITE_SPATIAL_INDEX_ROW_SQL);
      const rows = db
        .prepare("SELECT id, latitude, longitude FROM sites WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
        .all();
      for (const row of rows) {
        insert.run(row.id, row.latitude, row.latitude, row.longitude, row.longitude);
      }
    } else {
      // Fallback tier: a plain composite index. No separate table needed --
      // bounding-box queries against `sites` directly benefit from this
      // index the same way any other WHERE-clause index would.
      db.exec(CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const integrity = db.prepare("PRAGMA integrity_check").get();
  logRun(db, {
    runType: "spatial-index-build",
    mode: strategy,
    status: "success",
    sitesProcessed: sitesToIndex,
    sitesTotal,
    notes: `strategy=${strategy}`,
    startedAt,
  });

  return { strategy, sitesTotal, sitesToIndex, integrityCheck: integrity.integrity_check };
}

export function verifySpatialIndex(db) {
  const strategy = tableExists(db, SITE_SPATIAL_INDEX_TABLE) ? "rtree" : "btree_fallback";
  const geocodedRow = db
    .prepare("SELECT COUNT(*) AS n FROM sites WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
    .get();
  let indexedCount = null;
  if (strategy === "rtree") {
    indexedCount = db.prepare(`SELECT COUNT(*) AS n FROM ${SITE_SPATIAL_INDEX_TABLE}`).get().n;
  } else {
    const hasFallbackIndex = !!db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
      .get(SITE_SPATIAL_INDEX_FALLBACK_INDEX);
    indexedCount = hasFallbackIndex ? geocodedRow.n : 0;
  }
  const integrity = db.prepare("PRAGMA integrity_check").get().integrity_check;
  return {
    strategy,
    geocodedSites: geocodedRow.n,
    indexedCount,
    countsMatch: indexedCount === geocodedRow.n,
    integrityCheck: integrity,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      database: { type: "string" },
      mode: { type: "string", default: "dry-run" },
    },
  });
  if (!values.database) {
    console.error("MIGRATION FAILED: --database is required");
    process.exit(1);
  }
  const db = new DatabaseSync(values.database);
  try {
    if (values.mode === "dry-run") {
      const result = buildSpatialIndex(db, { dryRun: true });
      console.log("DRY RUN:", JSON.stringify(result, null, 2));
    } else if (values.mode === "build") {
      const result = buildSpatialIndex(db, { dryRun: false });
      console.log("BUILD OK:", JSON.stringify(result, null, 2));
    } else if (values.mode === "verify") {
      // GENESIS PHASE 0 RECOVERY NOTE: this file was found truncated (working tree
      // cut off mid-statement at "} else if (value", missing the entire verify
      // branch, the unknown-mode error branch, closing of the try block, and the
      // main() invocation) -- see docs/genesis-phase-0/02_RECOVERY_DECISIONS.md.
      // This completion is not invented: docs/stage-1/04_SPATIAL_INDEX.md
      // explicitly documents "--mode verify -- confirms the indexed row count
      // matches the count of sites with non-null coordinates, and that PRAGMA
      // integrity_check still reports ok; exits non-zero on any mismatch," and
      // verifySpatialIndex(db) (already complete above, lines 136-158) already
      // returns exactly { strategy, geocodedSites, indexedCount, countsMatch,
      // integrityCheck } to match that description.
      const result = verifySpatialIndex(db);
      console.log("VERIFY:", JSON.stringify(result, null, 2));
      if (!result.countsMatch || result.integrityCheck !== "ok") {
        process.exit(1);
      }
    } else {
      console.error(`MIGRATION FAILED: unknown --mode "${values.mode}" (expected dry-run, build, or verify)`);
      process.exit(1);
    }
  } finally {
    db.close();
  }
}

main();
