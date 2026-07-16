"""STAGE 1 -- WP1.1 Geospatial Domain Model migration.

Additive-only migration: creates four new tables used by Stage 1's geospatial
intelligence foundation. Never drops, alters, or renames any existing table
or column, and never touches a single row of `sites` or any other existing
table. Idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS),
so re-running it is a safe no-op once applied.

New tables:
  - site_geospatial_status     : one row per site, current geospatial status (WP1.1)
  - site_coordinate_quality    : append-only history of coordinate-quality evaluations (WP1.2)
  - geospatial_processing_runs : audit log of every geospatial batch job (WP1.11)
  - geospatial_grid_cells      : deterministic grid-cell summaries (WP1.5)

Usage:
    python scripts/geospatial_migrate.py --database <path> --dry-run
    python scripts/geospatial_migrate.py --database <path>

Safety: this script itself takes no destructive action -- it only adds new
tables/indexes inside a single transaction, verifies every existing
(``protected``) table's row count is byte-for-byte unchanged afterward, and
runs PRAGMA integrity_check before declaring success. Per Stage 1's safety
rules it should still only be run after a verified backup exists (see
docs/stage-1/10_DATABASE_MIGRATION.md).
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS site_geospatial_status (
        site_id INTEGER PRIMARY KEY REFERENCES sites(id),
        latitude REAL,
        longitude REAL,
        coordinate_status TEXT NOT NULL,
        coordinate_confidence REAL NOT NULL,
        mapping_eligible INTEGER NOT NULL DEFAULT 0,
        sentinel_eligible INTEGER NOT NULL DEFAULT 0,
        duplicate_coordinate INTEGER NOT NULL DEFAULT 0,
        suspicious_coordinate INTEGER NOT NULL DEFAULT 0,
        outside_brazil INTEGER NOT NULL DEFAULT 0,
        validation_reasons TEXT,
        grid_cell_id TEXT,
        last_evaluated_at TEXT NOT NULL,
        algorithm_version TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_geospatial_status_coordinate_status ON site_geospatial_status(coordinate_status)",
    "CREATE INDEX IF NOT EXISTS idx_geospatial_status_grid_cell ON site_geospatial_status(grid_cell_id)",
    "CREATE INDEX IF NOT EXISTS idx_geospatial_status_mapping_eligible ON site_geospatial_status(mapping_eligible)",
    """
    CREATE TABLE IF NOT EXISTS site_coordinate_quality (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL REFERENCES sites(id),
        status TEXT NOT NULL,
        confidence REAL NOT NULL,
        eligible_for_mapping INTEGER NOT NULL,
        eligible_for_sentinel INTEGER NOT NULL,
        reasons TEXT,
        warnings TEXT,
        evaluated_at TEXT NOT NULL,
        algorithm_version TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_coordinate_quality_site_id ON site_coordinate_quality(site_id)",
    "CREATE INDEX IF NOT EXISTS idx_coordinate_quality_evaluated_at ON site_coordinate_quality(evaluated_at)",
    """
    CREATE TABLE IF NOT EXISTS geospatial_processing_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_type TEXT NOT NULL,
        mode TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        sites_processed INTEGER,
        sites_total INTEGER,
        notes TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_processing_runs_started_at ON geospatial_processing_runs(started_at)",
    """
    CREATE TABLE IF NOT EXISTS geospatial_grid_cells (
        grid_cell_id TEXT PRIMARY KEY,
        resolution INTEGER NOT NULL,
        center_latitude REAL NOT NULL,
        center_longitude REAL NOT NULL,
        min_latitude REAL NOT NULL,
        max_latitude REAL NOT NULL,
        min_longitude REAL NOT NULL,
        max_longitude REAL NOT NULL,
        site_count INTEGER NOT NULL DEFAULT 0,
        last_updated_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_grid_cells_resolution ON geospatial_grid_cells(resolution)",
]

EXPECTED_NEW_TABLES = [
    "site_geospatial_status",
    "site_coordinate_quality",
    "geospatial_processing_runs",
    "geospatial_grid_cells",
]

PROTECTED_TABLES = [
    "sites", "metadata", "import_audit", "audit_trail", "copernicus_scenes",
    "sig_edges", "sig_insights", "sig_nodes", "sig_snapshots",
    "site_evidence_center", "site_notes", "site_satellite_validation",
    "site_trust_scores", "site_validation_history",
]


def existing_tables(conn):
    return {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def table_counts(conn, tables):
    existing = existing_tables(conn)
    return {t: (conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] if t in existing else None) for t in tables}


def run_migration(database: Path, dry_run: bool) -> None:
    if dry_run:
        print("-- DRY RUN: DDL that would be executed --")
        for stmt in DDL_STATEMENTS:
            print(stmt.strip() + ";")
        return

    conn = sqlite3.connect(str(database))
    try:
        before_protected = table_counts(conn, PROTECTED_TABLES)
        conn.execute("BEGIN IMMEDIATE")
        for stmt in DDL_STATEMENTS:
            conn.execute(stmt)
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    after_protected = table_counts(conn, PROTECTED_TABLES)
    integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
    now_tables = existing_tables(conn)
    conn.close()

    missing_new = [t for t in EXPECTED_NEW_TABLES if t not in now_tables]
    if missing_new:
        raise SystemExit(f"Migration ran but expected new tables are missing: {missing_new}")
    if before_protected != after_protected:
        raise SystemExit(
            f"PROTECTED TABLE ROW COUNTS CHANGED -- this must never happen. "
            f"before={before_protected} after={after_protected}"
        )
    if integrity != "ok":
        raise SystemExit(f"PRAGMA integrity_check failed after migration: {integrity}")

    print("Migration OK.")
    print("New tables present:", EXPECTED_NEW_TABLES)
    print("Protected table counts unchanged:", after_protected)
    print("integrity_check:", integrity)


def main():
    parser = argparse.ArgumentParser(description="STAGE 1 WP1.1 -- additive geospatial domain model migration.")
    parser.add_argument("--database", required=True, help="Path to the leotechscan.db to migrate")
    parser.add_argument("--dry-run", action="store_true", help="Print DDL without executing")
    args = parser.parse_args()
    run_migration(Path(args.database), args.dry_run)


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(f"MIGRATION FAILED: {exc}", file=sys.stderr)
        raise
