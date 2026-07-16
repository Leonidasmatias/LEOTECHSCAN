# 06 — Database Integrity

## Location and identity

`C:\LEOTECHSCAN\DATABASE\leotechscan.db` (a sibling of the `APP\` directory, matching
`lib/db.ts`'s path resolution — `path.join(process.cwd(), "..", "DATABASE", "leotechscan.db")`).

## Before this mission (captured at mission start)

| Property | Value |
|---|---|
| Size | 185MB |
| SHA-256 | `440c4befe1f93d4b0215e8e11114b51637d54daa4bdf43ad15ee67512e5047cc` |
| `PRAGMA integrity_check` | `ok` |
| `sites` row count | 299,308 |
| `site_trust_scores` row count | 270 |
| `site_validation_history` row count | 270 |
| `sig_snapshots` row count | 1 |
| `import_audit` row count | 2 |
| `site_geospatial_status` / `geospatial_grid_cells` / `site_coordinate_quality` | 0 / 0 / 0 (empty, as already documented in the prior Genesis audit) |

## Backup created before any risk of write

Attempted `scripts/backup_database.py` (`VACUUM INTO`): failed with `disk I/O error`. Attempted
Python's `sqlite3.Connection.backup()` API directly: failed with the identical `disk I/O error`.
Both diagnosed as a FUSE-bridge-specific incompatibility with SQLite's low-level write patterns
(ruled out disk space: 21GB free confirmed; ruled out generic large-file writes: a plain `cp` of
the same 185MB file succeeded without error).

**Fallback used:** plain `cp` of the main `.db` file plus its matching `.db-wal`/`.db-shm`
sidecar files as one consistent set, to
`C:\LEOTECHSCAN\BACKUPS\leotechscan-db-backup-genesis-phase0-20260716T125753Z.db` (+ `-wal`/`-shm`).

Verified:
- SHA-256 of the backup: `440c4befe1f93d4b0215e8e11114b51637d54daa4bdf43ad15ee67512e5047cc` —
  identical to the source.
- `PRAGMA integrity_check` against the backup (opened `file:...?mode=ro&immutable=1`, required
  because plain `mode=ro` alone raises `attempt to write a readonly database` due to WAL-mode
  shared-memory index requirements): `ok`.

## After this mission (re-verified at mission end)

| Property | Value | Matches baseline? |
|---|---|---|
| SHA-256 | `440c4befe1f93d4b0215e8e11114b51637d54daa4bdf43ad15ee67512e5047cc` | YES — identical |
| `PRAGMA integrity_check` | `ok` | YES |
| `sites` | 299,308 | YES |
| `site_trust_scores` | 270 | YES |
| `site_validation_history` | 270 | YES |
| `sig_snapshots` | 1 | YES |
| `import_audit` | 2 | YES |
| `site_geospatial_status` / `geospatial_grid_cells` / `site_coordinate_quality` | 0 / 0 / 0 | YES |

**The database was not altered at all by this mission.** No `DELETE`/`UPDATE`/`INSERT`/`DROP`/
`ALTER`/`VACUUM`/`REINDEX` was executed against it at any point — all validation reads used
read-only, immutable connections. This is the preferred, achieved outcome per the mission's own
stated goal.

## An unrelated observation: a second backup file found in `BACKUPS/`

`C:\LEOTECHSCAN\BACKUPS\leotechscan_20260716T130133Z.db` (+ a `.db-journal` sidecar, indicating an
interrupted or just-completed transaction) was found in the backups folder, timestamped a few
minutes after this mission's own snapshot. **This file was not created by any action taken in this
mission** — no command in this session's history produced a file with that naming pattern (this
mission's own backup uses the `-db-backup-genesis-phase0-` naming convention). Read-only
inspection confirms it is a complete, valid backup (`integrity_check: ok`, `sites: 299308`). It was
not modified, moved, or deleted — flagged here for the record and left for the user to identify its
origin (most likely an external, scheduled, or manually-triggered backup process on the Windows
machine, unrelated to this session).
