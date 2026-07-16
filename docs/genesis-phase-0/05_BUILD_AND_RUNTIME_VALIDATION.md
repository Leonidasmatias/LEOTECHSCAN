# 05 — Build and Runtime Validation

## `npm run build`

```
> next build
   Downloading swc package @next/swc-wasm-nodejs... to <cache>
/bin/sh: 1: pnpm: not found
 ⚠ Attempted to load .../node_modules/next/next-swc-fallback/@next/swc-linux-x64-gnu/... not installed
 ⚠ Attempted to load .../node_modules/next/next-swc-fallback/@next/swc-linux-x64-musl/... not installed
 ⚠ Attempted to load @next/swc-linux-x64-gnu, but it was not installed
 ⚠ Attempted to load @next/swc-linux-x64-musl, but it was not installed
 ⨯ Failed to load SWC binary for linux/x64
```

Next.js's compiler (SWC) ships as a platform-specific native binary, same class of issue as
Vitest/Rollup in `04_TEST_RESULTS.md`. Confirmed directly: `node_modules/@next/` contains
`swc-win32-x64-msvc` (a Windows binary) and no Linux equivalent. Next attempted an automatic
WASM-fallback download via `pnpm`, which is not installed in this environment either, so even the
fallback path failed.

## `npm run dev`

```
> next dev
 ⚠ Attempted to load @next/swc-linux-x64-gnu, but it was not installed
 ⚠ Attempted to load @next/swc-linux-x64-musl, but it was not installed
 ⚠ Attempted to load @next/swc-wasm-nodejs, but it was not installed
 ⚠ Attempted to load @next/swc-wasm-web, but it was not installed
 ⨯ Failed to load SWC binary for linux/x64
```

Identical root cause. The dev server never starts, so no live functional validation (dashboard,
filters, map, site query, dashboard/geospatial/telecom-ai APIs, CSV/PDF export, Data Trust,
Knowledge Graph) was possible in this session.

## Why this was not "fixed"

Installing a Linux-native `@next/swc-*` package or `pnpm` would itself be a dependency change,
out of scope for this mission. It would also not exercise the real target runtime (the project's
Windows machine, confirmed by the installed `swc-win32-x64-msvc` binary and by the prior Genesis
audit's own note that production runs on Node 24 on that machine).

## Result

**Build status: not validated in this session.** This is a pre-existing environment limitation of
the bridge session used to perform this recovery, not a defect introduced or found in the source
code. `npx tsc --noEmit` (see `03_TYPESCRIPT_RECOVERY.md`) is the strongest signal available in
this session that the source is structurally sound, but it is not equivalent to a real
`next build` or a running server.

## Functional validation checklist — status

All items below require a running server and were therefore **not exercised**:

| Item | Status |
|---|---|
| App init | NOT VALIDATED (build/dev blocked) |
| Dashboard | NOT VALIDATED |
| Filters | NOT VALIDATED |
| Map | NOT VALIDATED |
| Site query | NOT VALIDATED |
| Dashboard API | NOT VALIDATED |
| Geospatial API | NOT VALIDATED |
| Telecom-AI API | NOT VALIDATED |
| CSV export | NOT VALIDATED |
| PDF export | NOT VALIDATED |
| Data Trust | NOT VALIDATED |
| Knowledge Graph | NOT VALIDATED |

## Required next step (for Phase 1 / the real machine)

Run `npm run build` then `npm run dev` (or start the production server) directly on the Windows
machine, and perform the functional validation checklist above there — verifying structure/minimum
content per endpoint, never relying on HTTP 200 alone, and never overwriting existing exports.
