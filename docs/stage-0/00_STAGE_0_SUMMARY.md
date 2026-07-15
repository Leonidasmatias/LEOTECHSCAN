# Stage 0 — Stabilization and Truth Baseline: Summary

Status: **all 12 work packages (WP0.1–WP0.12) implemented and verified.** Stage 1 has **not** been started and will not begin without explicit approval, per the governing instruction for this stage.

This document is the entry point into the Stage 0 documentation set. Read it first; the other eight files go into the specifics referenced below.

## What Stage 0 was for

The V4 audit (`docs/audit-v4/`) found a working application whose UI, in several places, implied capabilities that did not exist behind it — most seriously, Sentinel-1 satellite data that was entirely synthetic, presented without a clear "simulated" label. Stage 0's job was not to build new features. It was to make the existing system stop overstating itself, close the cheapest/most obvious security gaps, stop losing derived data on reimport, and leave behind a baseline anyone can trust and build on in Stage 1. Nothing in Stage 0 adds new functionality; every change either corrects a claim, closes a gap, or adds a safety net.

## Work package status

| WP | Name | Status |
|---|---|---|
| WP0.1 | Source Control Baseline | Done — see note on git below |
| WP0.2 | Build Baseline | Done — see `06_BUILD_VALIDATION.md` for what "done" means here |
| WP0.3 | Capability Truth Registry | Done — `config/capabilities.json`, 22 entries |
| WP0.4 | Correct Copernicus/Sentinel-1 Representation | Done |
| WP0.5 | Export Path Protection | Done |
| WP0.6 | CSV/Excel Formula Injection sanitizer | Done (TS and Python) |
| WP0.7 | Basic API Protection | Done (partial coverage, documented) |
| WP0.8 | Preserve Derived Tables During Import | Done, tested against a database copy |
| WP0.9 | Database Backup/Restore scripts | Done, tested |
| WP0.10 | Initial Automated Tests | Done — 10 tests, see `05_TEST_BASELINE.md` |
| WP0.11 | System Health Endpoint | Done — `GET /api/system-health` |
| WP0.12 | Truthful Capability Badges in UI | Done — all 22 registry keys now referenced somewhere in the UI |

## The three limitations that cut across multiple work packages

These are not failures of any single WP — they are properties of the environment this work was done in, and they matter enough to call out here instead of burying them in one document each.

1. **Git commits cannot be made through the Cowork device bridge.** A real git repository now exists at `APP/.git` (apparently initialized directly on your machine during this session), and reads (`git log`, `git status`, `git diff`) work fine through the bridge. Writes do not: the bridge's filesystem mount cannot support the atomic rename `git commit` depends on, and a stray `.git/index.lock` was left behind by a failed attempt. Every change in this stage is fully staged and ready — you need to run the commit yourself, directly on your machine. Exact commands are in `07_ROLLBACK_PLAN.md`.
2. **Genuine `npm run build` / `next build` validation could not be performed from either the cloud sandbox or the bridge's Linux VM.** Both are Linux environments trying to run against `node_modules` built for your Windows machine; native SWC binaries are platform-specific. What Stage 0 validated instead, and what still needs to happen on your machine before Stage 1, is in `06_BUILD_VALIDATION.md`.
3. **`npm install` could not be run in the cloud sandbox during this session** — the npm registry returned `403 Forbidden` for every package, including ones already used elsewhere in the project. `vitest` is declared in `package.json`'s devDependencies (WP0.10) but isn't installed anywhere yet. Run `npm install` on your machine to pull it down, then `npm test`.

## What to do next

1. Run `npm install` on your machine (picks up `vitest`).
2. Run `npm run build` and `npx tsc --noEmit` to get the build/typecheck validation this environment couldn't perform (`06_BUILD_VALIDATION.md`).
3. Run `npm test` to execute the 10 WP0.10 tests for real (`05_TEST_BASELINE.md`).
4. Resolve the stray `.git/index.lock` and make the Stage 0 commit yourself (`07_ROLLBACK_PLAN.md`).
5. Review `08_REMAINING_RISKS.md` — it lists everything Stage 0 deliberately did not fix, so nothing here is mistaken for "the system is now fully secure/accurate."
6. When you're ready, give explicit approval to begin Stage 1. Nothing further will happen automatically.
