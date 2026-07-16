# Genesis Phase 0 — Recovery, Stabilization & Baseline

This directory documents a **read/repair mission** (not a feature mission) executed against
`C:\LEOTECHSCAN\APP`, directly following the findings of `docs/genesis-audit/` (the prior,
strictly read-only Genesis Repository Audit). Its sole objective was to bring the repository
from "does not compile, working tree has truncated files" to "compiles cleanly, documented,
reversible" — with **zero new product features**.

## Documents in this set

- `00_EXECUTIVE_SUMMARY.md` — answers the 15 required executive questions.
- `01_INITIAL_WORKING_TREE.md` — the exact state found at mission start.
- `02_RECOVERY_DECISIONS.md` — per-file classification table and the decision taken for each.
- `03_TYPESCRIPT_RECOVERY.md` — `tsc --noEmit` error progression, batch by batch.
- `04_TEST_RESULTS.md` — `npm test` outcome (environment-blocked; documented precisely).
- `05_BUILD_AND_RUNTIME_VALIDATION.md` — `npm run build`/`npm run dev` outcome (environment-blocked).
- `06_DATABASE_INTEGRITY.md` — before/after hash, integrity_check, row counts.
- `07_GEOSPATIAL_FOUNDATION_STATUS.md` — Stage 1 Geospatial Foundation, file by file.
- `08_FINAL_BASELINE.md` — what state the repository is actually in now.
- `09_REMAINING_RISKS.md` — everything still open, including the unresolved git-commit blocker.

## Snapshot and backups referenced throughout

- Pre-repair snapshot: `C:\LEOTECHSCAN\RECOVERY_SNAPSHOTS\GENESIS_PHASE_0_20260716_125753Z\`
  (git state, byte-for-byte copies of every modified/untracked file, HEAD versions, SHA-256
  hashes, and the two additional truncated-file backups added mid-mission — see
  `02_RECOVERY_DECISIONS.md`).
- Database backup: `C:\LEOTECHSCAN\BACKUPS\leotechscan-db-backup-genesis-phase0-20260716T125753Z.db`
  (+ `.db-wal`/`.db-shm`), SHA-256 `440c4befe1f93d4b0215e8e11114b51637d54daa4bdf43ad15ee67512e5047cc`,
  verified identical to the live database both before and after this entire mission.

## One-line status

Source code compiles cleanly (`tsc --noEmit`: 0 errors). Test execution and the production build
could not be validated in this session due to a pre-existing, environment-specific native-binary
mismatch (this bridge session is Linux; the installed `node_modules` were built for Windows) —
this is **not** a code defect, but it means "tested" and "builds" are not yet confirmed **in this
session**. The final git commit is prepared but not yet created, blocked by a stale
`.git/index.lock` this session cannot remove. See `09_REMAINING_RISKS.md` for exact remediation.
