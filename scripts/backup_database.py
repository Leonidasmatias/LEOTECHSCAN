"""STAGE 0 -- WP0.9 Database Backup.

Creates a timestamped, integrity-verified snapshot of the production SQLite
database. Never overwrites an existing backup file (timestamp collisions get
a numeric suffix instead of clobbering).

Usage (run directly on the machine hosting the database, e.g. Windows
PowerShell / cmd -- not through the Cowork device bridge):

    python scripts\\backup_database.py
    python scripts\\backup_database.py --database "C:\\LEOTECHSCAN\\DATABASE\\leotechscan.db" --backup-dir "C:\\LEOTECHSCAN\\BACKUPS"

What this does, precisely:
  1. Computes a SHA-256 fingerprint of the source database file BEFORE the
     backup, so we can detect if something else was writing to it at the
     same moment (best-effort; SQLite's own locking is the real guard).
  2. Uses `VACUUM INTO` (a built-in SQLite statement) to write a consistent,
     defragmented, single-file snapshot to the destination path. VACUUM INTO
     takes SQLite's own read lock semantics into account and is safe to run
     against a live WAL-mode database without stopping the application --
     it does NOT require exclusive access the way a raw file copy would.
  3. Computes a SHA-256 fingerprint of the resulting backup file, runs
     `PRAGMA integrity_check` against it, and records row counts for the
     tables Stage 0's audit identified as load-bearing.
  4. Writes a JSON manifest next to the backup (same base name + .manifest.json)
     recording everything above, so `restore_database.py` (and a human) can
     verify a backup's integrity before trusting it.
  5. Never deletes or overwrites an existing backup or manifest file. If the
     timestamped name is already taken (e.g. two runs within the same
     second), a numeric suffix is appended until a free name is found.

Retention: this script does NOT delete old backups automatically. See
docs/stage-0/07_ROLLBACK_PLAN.md for retention guidance -- pruning old
backups is a manual decision for whoever operates this system, not
something Stage 0 automates.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DATABASE = Path(r"C:\LEOTECHSCAN\DATABASE\leotechscan.db")
DEFAULT_BACKUP_DIR = Path(r"C:\LEOTECHSCAN\BACKUPS")

# Tables whose row counts are recorded in the manifest as a quick sanity
# signal. This list is informational only -- an unexpected table is not an
# error, it's just not summarized here. Kept in sync with the derived-table
# inventory documented in docs/stage-0/04_IMPORT_SAFETY.md.
SUMMARY_TABLES = [
    "sites",
    "metadata",
    "import_audit",
    "audit_trail",
    "copernicus_scenes",
    "sig_edges",
    "sig_insights",
    "sig_nodes",
    "sig_snapshots",
    "site_evidence_center",
    "site_notes",
    "site_satellite_validation",
    "site_trust_scores",
    "site_validation_history",
]


def fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def table_counts(database: Path) -> dict[str, int | None]:
    conn = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    counts: dict[str, int | None] = {}
    try:
        existing = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for table in SUMMARY_TABLES:
            if table not in existing:
                counts[table] = None
                continue
            counts[table] = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    finally:
        conn.close()
    return counts


def unique_backup_path(backup_dir: Path, stamp: str) -> Path:
    candidate = backup_dir / f"leotechscan_{stamp}.db"
    if not candidate.exists():
        return candidate
    suffix = 2
    while True:
        candidate = backup_dir / f"leotechscan_{stamp}_{suffix}.db"
        if not candidate.exists():
            return candidate
        suffix += 1


def run_backup(database: Path, backup_dir: Path) -> Path:
    if not database.exists():
        raise SystemExit(f"Source database not found: {database}")
    backup_dir.mkdir(parents=True, exist_ok=True)

    before_hash = fingerprint(database)
    before_counts = table_counts(database)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = unique_backup_path(backup_dir, stamp)
    manifest_path = backup_path.with_suffix(backup_path.suffix + ".manifest.json")
    if manifest_path.exists():
        raise SystemExit(f"Refusing to overwrite existing manifest: {manifest_path}")

    conn = sqlite3.connect(database)
    try:
        # VACUUM INTO requires the destination not to already exist.
        conn.execute("VACUUM INTO ?", (str(backup_path),))
    finally:
        conn.close()

    if not backup_path.exists():
        raise SystemExit("VACUUM INTO did not produce the expected backup file; aborting.")

    after_hash = fingerprint(backup_path)
    integrity_conn = sqlite3.connect(f"file:{backup_path}?mode=ro", uri=True)
    try:
        integrity_result = integrity_conn.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        integrity_conn.close()
    after_counts = table_counts(backup_path)

    manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_database": str(database),
        "source_sha256_before_backup": before_hash,
        "source_table_counts_before_backup": before_counts,
        "backup_file": str(backup_path),
        "backup_sha256": after_hash,
        "backup_size_bytes": backup_path.stat().st_size,
        "backup_integrity_check": integrity_result,
        "backup_table_counts": after_counts,
        "counts_match_source": before_counts == after_counts,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    if integrity_result != "ok":
        raise SystemExit(
            f"Backup created at {backup_path} but PRAGMA integrity_check reported: {integrity_result}. "
            "Do not treat this backup as trustworthy -- investigate before relying on it."
        )
    if before_counts != after_counts:
        raise SystemExit(
            f"Backup created at {backup_path} but table row counts differ from the source "
            f"(before={before_counts} after={after_counts}). Investigate before relying on this backup."
        )

    return backup_path


def main() -> None:
    parser = argparse.ArgumentParser(description="STAGE 0 WP0.9 -- timestamped, integrity-verified SQLite backup.")
    parser.add_argument("--database", default=str(DEFAULT_DATABASE), help="Path to the production leotechscan.db")
    parser.add_argument("--backup-dir", default=str(DEFAULT_BACKUP_DIR), help="Directory to write timestamped backups into")
    args = parser.parse_args()

    backup_path = run_backup(Path(args.database), Path(args.backup_dir))
    print(f"Backup OK: {backup_path}")
    print(f"Manifest:  {backup_path.with_suffix(backup_path.suffix + '.manifest.json')}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(f"BACKUP FAILED: {exc}", file=sys.stderr)
        raise
