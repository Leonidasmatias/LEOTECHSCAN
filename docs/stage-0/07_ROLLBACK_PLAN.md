# Stage 0 — Rollback Plan (WP0.9, plus git recovery)

Two separate kinds of rollback are covered here: rolling back the **database** (WP0.9's actual deliverable), and rolling back the **Stage 0 code changes themselves** if something in this stage needs to be undone.

## Database backup and restore (WP0.9)

### Taking a backup

```
python scripts\backup_database.py
python scripts\backup_database.py --database "C:\LEOTECHSCAN\DATABASE\leotechscan.db" --backup-dir "C:\LEOTECHSCAN\BACKUPS"
```

Writes a timestamped, defragmented snapshot (`leotechscan_<UTC timestamp>.db`) using SQLite's `VACUUM INTO`, which is safe to run against a live WAL-mode database without stopping the app. Verifies the backup's `PRAGMA integrity_check`, compares table row counts against the source, and writes a `.manifest.json` next to it recording both hashes, the row counts, and the integrity check result. **Never overwrites an existing backup or manifest** — a name collision gets a numeric suffix.

### Restoring a backup

```
# Dry run first -- shows exactly what would change, changes nothing:
python scripts\restore_database.py --backup "C:\LEOTECHSCAN\BACKUPS\leotechscan_<timestamp>.db"

# Then, once you're satisfied:
python scripts\restore_database.py --backup "C:\LEOTECHSCAN\BACKUPS\leotechscan_<timestamp>.db" --yes
```

Before touching anything, this verifies the backup's SHA-256 against its manifest (catching corruption or tampering since the backup was made) and runs its own `PRAGMA integrity_check`. With `--yes`, it takes an **automatic safety backup of whatever is currently at the target path** before overwriting it, so a restore can itself always be undone. The actual file swap is an atomic `os.replace()` — the target is never left partially written even if interrupted.

Both scripts were tested end-to-end against a scratch database (not the production one): a normal backup/restore round-trip, a restore onto a database that had drifted since the backup (confirming the pre-restore safety backup correctly captured the drifted state and the restore correctly brought back the original data), and a restore attempt against a deliberately tampered backup file (confirming it was correctly refused with a clear hash-mismatch error rather than silently proceeding).

### Retention

Neither script deletes old backups automatically, and Stage 0 does not propose an automated retention/pruning job — that's a decision for whoever operates this system day to day, not something to bake in silently. As a starting point: keep at least the last backup before every reimport, and periodically thin older ones by hand once you're confident nothing needs to be recovered from them.

## Rolling back Stage 0's own code changes

A real git repository exists at `APP/.git` with one commit so far (`01ed583`, "Stage 0 Baseline"), created directly on your machine. Everything Stage 0 changed in this session is currently staged in that repository's index but **not yet committed** — commits could not be made through the Cowork device bridge (see `06_BUILD_VALIDATION.md`'s sibling note in `00_STAGE_0_SUMMARY.md` for why: the bridge's mount can't support the atomic rename `git commit` needs). A failed commit attempt also left a stray lock file behind.

To finish this yourself, in a terminal directly on your machine:

```
cd C:\LEOTECHSCAN\APP
del .git\index.lock
git status
git add -A
git commit -m "Stage 0: stabilization and truth baseline"
```

`git status` before committing is worth actually reading — it will show you every file Stage 0 touched, which should match `01_CHANGE_PLAN.md` exactly.

Once that commit exists, rolling back any part of Stage 0 later is ordinary git:

```
git log --oneline                  # find the commit to go back to
git revert <commit>                # undo a specific commit without rewriting history
# or, if you're certain and haven't pushed anywhere:
git reset --hard <commit>          # discard everything after <commit>
```

Until that first commit is made, "rolling back" Stage 0's code changes means restoring individual files from whatever backup or copy you have of the pre-Stage-0 state — there is no git history to fall back on yet.
