"""STAGE 0 -- WP0.9 Database Restore.

Restores a previously-created backup (see backup_database.py) over the
production database, with multiple safety checks before anything is
overwritten. Defaults to a DRY RUN: pass --yes to actually perform the
restore.

Usage (run directly on the machine hosting the database):

    # Dry run -- shows what WOULD happen, changes nothing:
    python scripts\\restore_database.py --backup "C:\\LEOTECHSCAN\\BACKUPS\\leotechscan_20260101T000000Z.db"

    # Actually restore (after reviewing the dry run output):
    python scripts\\restore_database.py --backup "C:\\LEOTECHSCAN\\BACKUPS\\leotechscan_20260101T000000Z.db" --yes

What this does, precisely:
  1. Confirms the backup file exists and, if a .manifest.json sits next to
     it (written by backup_database.py), verifies the backup file's current
     SHA-256 still matches what the manifest recorded at backup time --
     catching silent corruption or tampering since the backup was made.
  2. Runs `PRAGMA integrity_check` directly against the backup file
     regardless of whether a manifest is present.
  3. Prints a before/after table-count comparison between the current
     target database (if it exists) and the backup, so a human can see
     exactly what a restore would change before committing to it.
  4. Without --yes: stops here. Nothing on disk is touched.
  5. With --yes: first takes a SAFETY BACKUP of the CURRENT target database
     (reusing backup_database.run_backup) before touching it -- so a restore
     can itself always be undone by restoring that safety backup. This step
     is skipped only if the target database does not exist yet (e.g. first
     ever restore onto a fresh machine), which is logged explicitly.
  6. Copies the backup file to a temp file in the SAME directory as the
     target, then performs an atomic `os.replace()` onto the target path --
     the target is never left in a partially-written state.
  7. Re-verifies the restored target's SHA-256 and table counts against the
     backup's recorded values, and runs a final `PRAGMA integrity_check`.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from backup_database import DEFAULT_DATABASE, fingerprint, table_counts, run_backup  # noqa: E402


def load_manifest(backup_path: Path) -> dict | None:
    manifest_path = backup_path.with_suffix(backup_path.suffix + ".manifest.json")
    if not manifest_path.exists():
        return None
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def verify_backup(backup_path: Path) -> dict:
    if not backup_path.exists():
        raise SystemExit(f"Backup file not found: {backup_path}")

    manifest = load_manifest(backup_path)
    current_hash = fingerprint(backup_path)
    if manifest is not None:
        recorded_hash = manifest.get("backup_sha256")
        if recorded_hash and recorded_hash != current_hash:
            raise SystemExit(
                f"Backup file hash does not match its manifest -- possible corruption or tampering.\n"
                f"  manifest sha256: {recorded_hash}\n"
                f"  current  sha256: {current_hash}\n"
                f"Refusing to restore from this backup."
            )

    conn = sqlite3.connect(f"file:{backup_path}?mode=ro", uri=True)
    try:
        integrity_result = conn.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        conn.close()
    if integrity_result != "ok":
        raise SystemExit(f"Backup file failed PRAGMA integrity_check: {integrity_result}. Refusing to restore.")

    return {
        "manifest": manifest,
        "current_sha256": current_hash,
        "integrity_check": integrity_result,
        "table_counts": table_counts(backup_path),
    }


def perform_restore(backup_path: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists():
        print(f"Taking a safety backup of the CURRENT target database before overwriting it: {target}")
        safety_backup_dir = target.parent.parent / "BACKUPS" if target.parent.name.upper() == "DATABASE" else target.parent
        safety_path = run_backup(target, safety_backup_dir)
        print(f"Safety backup of current target created at: {safety_path}")
    else:
        print(f"NOTE: target database {target} does not currently exist -- no safety backup needed (fresh restore).")

    # Atomic swap: write into a temp file in the SAME directory as the target (same filesystem
    # is required for os.replace to be atomic), then replace. The target is never left partially
    # written even if the process is interrupted mid-copy -- it either still has the old file
    # (temp copy interrupted) or the new one (replace already happened), never a half-written one.
    fd, tmp_name = tempfile.mkstemp(prefix=".restore_tmp_", dir=str(target.parent))
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        shutil.copyfile(backup_path, tmp_path)
        os.replace(tmp_path, target)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description="STAGE 0 WP0.9 -- verified restore from a backup_database.py snapshot.")
    parser.add_argument("--backup", required=True, help="Path to the backup .db file to restore from")
    parser.add_argument("--database", default=str(DEFAULT_DATABASE), help="Target database path to restore onto")
    parser.add_argument("--yes", action="store_true", help="Actually perform the restore (default is dry-run only)")
    args = parser.parse_args()

    backup_path = Path(args.backup)
    target = Path(args.database)

    print(f"Verifying backup: {backup_path}")
    verification = verify_backup(backup_path)
    print(f"  integrity_check: {verification['integrity_check']}")
    print(f"  sha256:          {verification['current_sha256']}")
    if verification["manifest"] is not None:
        print("  manifest found and hash matches -- backup has not been altered since it was created.")
    else:
        print("  no manifest found next to this backup -- integrity_check above is the only guarantee available.")

    print()
    print(f"Target database: {target}")
    if target.exists():
        current_counts = table_counts(target)
        print("  Table counts -- CURRENT target vs BACKUP (this restore would replace current with backup):")
        for table in sorted(set(current_counts) | set(verification["table_counts"])):
            print(f"    {table}: current={current_counts.get(table)} -> backup={verification['table_counts'].get(table)}")
    else:
        print("  Target does not exist yet -- this would be a fresh restore, not an overwrite.")

    if not args.yes:
        print()
        print("Dry run only -- no files were changed. Re-run with --yes to actually perform this restore.")
        return

    print()
    print("Proceeding with restore (--yes was passed)...")
    perform_restore(backup_path, target)

    post_hash = fingerprint(target)
    post_counts = table_counts(target)
    conn = sqlite3.connect(f"file:{target}?mode=ro", uri=True)
    try:
        post_integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        conn.close()

    print()
    print("Restore complete. Post-restore verification:")
    print(f"  sha256 matches backup:   {post_hash == verification['current_sha256']}")
    print(f"  integrity_check:         {post_integrity}")
    print(f"  table counts match backup: {post_counts == verification['table_counts']}")

    if post_hash != verification["current_sha256"] or post_integrity != "ok" or post_counts != verification["table_counts"]:
        raise SystemExit(
            "RESTORE VERIFICATION FAILED after the file was written -- the target database may be in an "
            "unexpected state. Use the safety backup created above (if the target existed before this "
            "restore) to recover, and investigate before trusting the current target."
        )


if __name__ == "__main__":
    main()
