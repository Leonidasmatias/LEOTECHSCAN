# 09 — Remaining Risks

## RISK 1 (BLOCKER) — stale `.git/index.lock` prevents committing this baseline

`.git/index.lock` (0 bytes, dated 2026-07-15 15:25:58 UTC, ~22 hours old at time of writing and
never renewed) blocks every index-writing git operation (`git add`, `git commit`). This session's
device bridge is structurally unable to delete files on the Windows-mounted filesystem — confirmed
both by this mission's own attempts (`rm`/`mv` both fail with `Operation not permitted` on this
specific mount) and by this environment's documented bridge limitation. This is **not** the same
situation as the forbidden destructive commands (`git reset --hard`, `git clean -fd`,
`git checkout .`, `git restore .`, `git stash`) — removing a crashed process's lock file is git's
own documented recovery procedure (the error message itself says so: *"a git process may have
crashed in this repository earlier: remove the file manually to continue"*) — but it must be done
on the machine that actually owns the file, with someone confirming no real git process is
currently running.

**Recommended remediation (run on the Windows machine, not in this session):**
1. Confirm no git GUI, editor, or terminal is mid-`git commit`/`git rebase` right now.
2. Delete `C:\LEOTECHSCAN\APP\.git\index.lock`.
3. Run the exact prepared commit (see below) — nothing further needs to be re-derived.

**Prepared commit (ready to run once the lock is cleared):**
```
cd C:\LEOTECHSCAN\APP
git add vitest.config.ts
git add app/api/geospatial/ services/geospatial/ scripts/geospatial-spatial-index.mjs scripts/geospatial_migrate.py
git add tests/geospatial-*.test.ts
git add docs/stage-1/ docs/genesis-audit/ docs/genesis-phase-0/
git status
git commit -m "Genesis Phase 0: recover and stabilize enterprise baseline"
```
(Deliberately excludes `scripts/__pycache__/` — a harmless byproduct of this session's own
diagnostic syntax-checks, not source code — and anything already covered by `.gitignore`.)

**Tag** — only create `genesis-baseline-v1` after confirming the commit above succeeded and
`git log -1` shows it as HEAD:
```
git tag genesis-baseline-v1
```
Do not push either the commit or the tag without an explicit, separate request from the user.

## RISK 2 (HIGH, PRE-EXISTING) — test suite cannot run in this or any Linux environment as currently installed

`node_modules` contains Windows-only native binaries (`@next/swc-win32-x64-msvc`, and presumably
the Rollup equivalent). This blocks both `npm test` and `npm run build` outside the actual Windows
machine. Already risk-registered as R-07 in `docs/genesis-audit/15_RISK_REGISTER.md`; unchanged by
this mission. Recommendation unchanged: define and document a CI environment that actually matches
production (Windows, per the audit's own finding that production runs on Node 24 there), so this
class of blocker stops recurring on every audit/recovery session.

## RISK 3 (MEDIUM) — two previously-undetected truncated files existed outside the original audit's finding

The original Genesis Repository Audit correctly flagged 19 tracked files as modified/broken but
did not detect that `services/geospatial/spatial-intelligence-engine.ts` and
`scripts/geospatial-spatial-index.mjs` (both untracked, with no git history) were also truncated.
Both are now fixed (see `02_RECOVERY_DECISIONS.md`), but this suggests the original audit's syntax
sweep did not cover every untracked non-`.ts` file exhaustively. Recommendation: before Phase 1
begins any new work, run the same three-tool sweep this mission used (`tsc --noEmit` for
`.ts`/`.tsx`, `node --check` for `.mjs`/`.cjs`, `python3 -m py_compile` for `.py`) once more across
the entire repository, not just the geospatial subtree, as a final confirmation.

## RISK 4 (LOW) — unexplained backup file in `BACKUPS/`

`leotechscan_20260716T130133Z.db` (+ `.db-journal`), found valid and untouched but not created by
this mission — see `06_DATABASE_INTEGRITY.md`. Recommendation: the user should confirm what
process created it (a scheduled task, a manual run of `scripts/backup_database.py` on the real
machine, etc.) so it's accounted for, though it poses no risk as found.

## RISK 5 (INFORMATIONAL) — the reconstructed `--mode verify` branch is untested at runtime

The completion added to `scripts/geospatial-spatial-index.mjs` (see `02_RECOVERY_DECISIONS.md`
and `07_GEOSPATIAL_FOUNDATION_STATUS.md`) is syntactically valid and closely evidence-based, but
has not been executed against a real database in this session (blocked by the same native-binary
issue as Risk 2, since it uses `node:sqlite`). Recommendation: run
`node scripts/geospatial-spatial-index.mjs --database <disposable copy> --mode verify` on the real
machine as the first real-world check of this fix.

## Carried over from the prior Genesis Repository Audit, unchanged by this mission

R-01 (no authentication on ~49 endpoints), R-10 (no rate limiting), R-16 (public
`/api/system-health`) remain fully open — this mission's scope explicitly excluded auth/security
work. See `docs/genesis-audit/15_RISK_REGISTER.md` for the complete prior register, still valid.
