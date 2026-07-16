# 01 — Initial Working Tree (state captured before any change)

Captured at mission start into
`C:\LEOTECHSCAN\RECOVERY_SNAPSHOTS\GENESIS_PHASE_0_20260716_125753Z\`.

## Git state

- Branch: `master`
- HEAD: `0b61fd76622208e07ad79554f0c551afd65ec0c3` ("Stage 0: finalize stabilization baseline")
- Total commit history: 2 commits (`01ed583` "Stage 0 Baseline", `0b61fd7` "Stage 0: finalize
  stabilization baseline")
- `.git/index.lock` present, dated 2026-07-15 15:25:58 UTC, zero bytes — indicating a git process
  crashed or was interrupted mid-write roughly one day before this mission began (`.git/index`
  itself last touched ~39ms earlier, consistent with a write in progress at that moment).

## 19 tracked files shown as "modified"

`app/api/export/route.ts`, `app/api/geointelligence/route.ts`, `app/api/telecom-ai/route.ts`,
`app/globals.css`, `components/CopernicusModules.tsx`, `components/Dashboard.tsx`,
`components/DataTrustModules.tsx`, `components/MissionControl.tsx`,
`components/SentinelCoreModules.tsx`, `components/Sprint2BModules.tsx`,
`components/Sprint3Modules.tsx`, `components/Sprint4Modules.tsx`,
`importers/multi_operator_import.py`, `next.config.ts`, `package-lock.json`, `package.json`,
`services/copernicus-engine.ts`, `utils/csv.ts`, `vitest.config.ts`.

## Untracked work present (never committed)

- `app/api/geospatial/{clusters,nearest,radius,summary,viewport}/route.ts` (5 files)
- `services/geospatial/{brazil-bounds,compact-site,coordinate-quality-engine,national-grid,
  request-params,spatial-index-sql.d,spatial-index-sql,spatial-intelligence-engine,
  spatial-query-utils}.{ts,mjs,mts}` (9 files)
- `scripts/geospatial-spatial-index.mjs`, `scripts/geospatial_migrate.py`
- `tests/geospatial-*.test.ts` (8 files)
- `docs/stage-1/*.md` (7 files)
- `docs/genesis-audit/*.md` (18 files — the prior audit's own output)

## Initial diagnostic results

- `npx tsc --noEmit`: failed (exact error count and messages captured in
  `03_TYPESCRIPT_RECOVERY.md`).
- `npx vitest run --reporter=basic`: failed to start — `Cannot find module
  '@rollup/rollup-linux-x64-gnu'`.
- Database (`leotechscan.db`, sibling of `APP/` at `C:\LEOTECHSCAN\DATABASE\leotechscan.db`):
  185MB, 299,308 rows in `sites`, SHA-256 `440c4befe1f93d4b0215e8e11114b51637d54daa4bdf43ad15ee67512e5047cc`,
  `PRAGMA integrity_check` = `ok`.

## Snapshot contents (for full detail, see the snapshot directory itself)

- `git-state/` — status, diff-stat, diff-name-status, log, branch, porcelain status.
- `working-tree.patch` — full pre-repair `git diff` (88,457 bytes / 1,850 lines).
- `working-tree-copy/` — byte-for-byte copies of all 19 modified + 39 untracked files.
- `head-versions/` — `git show HEAD:<file>` output for each of the 19 modified files.
- `hashes/` — SHA-256 of every file in both states.
- `RECOVERY_MANIFEST.json`, `RECOVERY_README.md` — machine- and human-readable summaries.
