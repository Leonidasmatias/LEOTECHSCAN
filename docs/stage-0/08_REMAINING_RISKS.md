# Stage 0 — Remaining Risks

Stage 0's job was stabilization and truth-telling, not making this system fully secure or fully accurate. This is the explicit list of what is still true after Stage 0, so nothing here gets mistaken for "fixed."

## Security (still open)

- **No authentication or authorization anywhere** (audit-v4 risk R2). Every API endpoint, including the new `GET /api/system-health`, is reachable by anyone who can reach the server. WP0.7 added response headers and input-shape clamping; neither is a substitute for access control.
- **No rate limiting.** Nothing stops a client from calling any endpoint as fast as it can.
- **Request-guard coverage is 2 of roughly 43 documented endpoints** (`app/api/telecom-ai`, `app/api/geointelligence`). The other endpoints' inputs are not shape-validated. `lib/request-guard.ts` says this explicitly in its own header comment; extending coverage is Stage 1+ backlog.
- **The CSV formula-injection fix has an accepted tradeoff:** legitimate negative numbers get an apostrophe prefix and display as text in spreadsheet software, not as computable numeric cells. This is the standard mitigation and is treated as safe-by-default, but it is a real, visible behavior change for anyone opening these exports.

## Data / import (mostly closed, one loose end)

- **WP0.8's fix is verified for the exact scenarios tested** (a clean import, and a forced-failure rollback) — see `04_IMPORT_SAFETY.md`. It has not been tested against every conceivable malformed-input shape, concurrent-writer scenario, or disk-full-mid-transaction case.
- **`sqlite_stat1` (SQLite's own query-planner statistics, not application data) is reset to empty by a reimport**, because the indexes are recreated and `ANALYZE` hasn't run again by the time `import_all()` returns. This does not lose or corrupt any data — the query planner just falls back to un-analyzed heuristics until the next `ANALYZE`/`PRAGMA optimize` actually populates it — but it's a small, real behavior change worth knowing about if query performance seems different immediately after a reimport.

## Truth / capability representation

- **`sentinel_1_processing` and `sentinel_1_change_detection` remain fully `unavailable`** — nothing was built for either in Stage 0, correctly reflected in the registry and now explicitly surfaced in the UI (WP0.12) rather than silently absent.
- **The capability registry is not mechanically enforced against the code it describes.** If a Stage 1+ change alters what `services/copernicus-engine.ts` (or any other service) actually does, `config/capabilities.json` has to be updated by hand to match — nothing currently checks that automatically. `tests/capabilities-registry.test.ts` only checks that referenced keys exist and have valid statuses, not that the status is still true.

## Environment / process limitations specific to this session (not architectural)

These are worth separating from the above because they're properties of the sandbox this work was done in, not properties of the LEOTECHSCAN codebase — a future session, or you working directly on your machine, won't necessarily hit them again.

- **Git commits could not be made through the Cowork device bridge.** Everything is staged; you need to run the commit yourself (`07_ROLLBACK_PLAN.md` has the exact commands, including cleaning up a stray `.git/index.lock`).
- **`npm run build` / `next build` could not be genuinely validated from this session** (both the cloud sandbox and the bridge's Linux VM are Linux; this project's `node_modules` are built for Windows) — **since resolved**: you've run `npm install` and `npm run build` directly on your machine and it succeeded (`06_BUILD_VALIDATION.md`).
- **`npm install` (and `bun add`) were blocked by the npm registry returning `403 Forbidden`** for every package during this session, including packages already used elsewhere in this project — this is why `vitest` (WP0.10) was never actually installed or run through the real framework from this session. You've since installed it on your machine yourself. Its underlying test logic was independently verified here by directly executing the real source files (`05_TEST_BASELINE.md`); a follow-up attempt to run the actual `vitest` binary through the bridge hit the same cross-platform native-binary limitation as `next build` (`Cannot find module '@rollup/rollup-linux-x64-gnu'`) — so the `node:sqlite` config fix in `vitest.config.ts` is believed correct but its `npm test` run still needs to be confirmed by you.
- **A `device_bash`-side stale read-cache** made `npx tsc --noEmit` and a `cp -r` operation both report false corruption/parse-error signals for files that had just been updated through a different bridge call. Diagnosed as a caching artifact via three independent read paths, not treated as a real defect, and no working code was changed because of it (`06_BUILD_VALIDATION.md`).

None of the above blocks Stage 1 from being approved — they're disclosed so the approval is informed, not because Stage 0 is asking for more time to fix them. Fixing any of them, if you want them fixed, would itself be Stage 1+ work.
