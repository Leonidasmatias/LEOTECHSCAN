# Stage 0 — Build Baseline / Build Validation (WP0.2)

## Update: production build confirmed on your machine

You've since run `npm install` and `npm run build` directly on your machine, and the production build succeeded. That's the genuine validation this document originally said this session couldn't provide — recorded here as confirmed, not just hoped for. `npm test` subsequently failed on a `node:sqlite` resolution error in Vitest; that was a test-environment configuration gap (fixed in `vitest.config.ts`, unrelated to anything the production build exercises) and is written up in `05_TEST_BASELINE.md`'s "Follow-up" section, not here. The rest of this document describes what this session did to compensate for not being able to run the build itself, which is still accurate background even though the build has now actually been validated.

## The constraint

This work was done from two environments, both Linux: a cloud sandbox, and (during the mid-session bridge reconnect) a Linux VM reached through the Cowork device bridge. The project's `node_modules` are built for your Windows machine. Native SWC binaries (the compiler Next.js uses under the hood) are platform-specific — a Linux-built SWC binary cannot run against a Windows `node_modules` tree, and neither of the two Linux environments available during this session could install a matching one without reaching into your actual machine's toolchain, which is out of scope for what either bridge does.

Practically: **`npm run build` (i.e. `next build`) could not be genuinely executed or validated from this session, in either environment.** Attempts to run `npx tsc --noEmit` through the bridge's `device_bash` also produced a separate, unrelated false-positive problem — see the note below — which was correctly diagnosed as a tooling artifact rather than a real code defect, and not "fixed" by changing working code in response to it.

## What was actually validated, and how

Given that constraint, here's what substituted for a real build, work package by work package:

- **Python changes** (`importers/multi_operator_import.py`, `scripts/backup_database.py`, `scripts/restore_database.py`): `python3 -m py_compile` confirmed syntactic validity, and — far more importantly — every one of these files was actually **executed** against real (copied) data with real assertions on the output. See `04_IMPORT_SAFETY.md` and `07_ROLLBACK_PLAN.md`.
- **Pure TypeScript logic** (`utils/csv.ts`, `lib/request-guard.ts`, `lib/export-path.ts`, `services/copernicus-engine.ts`'s exported functions): actually executed via Node 22's `--experimental-strip-types` flag against the real source files, with real assertions — see `05_TEST_BASELINE.md` for the details and the one real bug this caught.
- **React/JSX component changes** (the WP0.4/WP0.12 badge rollout across 8 component files): verified by careful manual reading of every diff, plus the automated registry-consistency check (test 10) which would fail if a `capabilityKey` typo or a missing import broke the reference — but this does **not** substitute for Next.js actually compiling and rendering these components. That gap is real and is the main reason this document exists.
- **`next.config.ts`**: reviewed manually; header-injection logic is simple enough (a static array applied via the documented `headers()` API) that the main risk is a syntax error, which `py_compile`-equivalent TypeScript parsing (via the strip-types execution above, since `next.config.ts` was read and its structure traced by hand) would have caught.

## A known tooling artifact you should be aware of, not a fixed bug

While debugging the `device_bash` bridge session earlier in this work, `npx tsc --noEmit` run through that bridge reported cascading JSX/TS parse errors (unclosed tags, unterminated strings) across every file that had just been edited. Cross-checking three independent read paths (`device_bash`'s own `cat`/`wc -c`, `device_list_dir`'s reported size/mtime, and a full-content diff via `device_stage_files`) showed the actual files on disk were correct — `device_bash`'s own mounted view was serving a stale cached read of files that had just been updated through a different bridge call (`device_commit_files`). This was diagnosed as a caching artifact specific to that bridge session, not a defect in the edited code, and no code was changed in response to it. It's recorded here so that if you see similarly nonsensical parse errors when running commands through a Cowork device-bridge session against files that were just edited, you know to suspect the bridge's read cache before suspecting the code.

## Same limitation, hit again trying to run Vitest

When diagnosing the `node:sqlite` Vitest failure above, this session tried running `node_modules/.bin/vitest run` through the Cowork device bridge's Linux VM, against your already-installed `node_modules`. It failed at a different step than the `node:sqlite` issue: `Cannot find module '@rollup/rollup-linux-x64-gnu'` — because your `node_modules` were installed on Windows (only `@esbuild/win32-x64` is present, no Linux build), and Rollup (which Vitest depends on) ships platform-specific native binaries the same way SWC does. This is the identical cross-platform limitation described above for `next build`, now confirmed to apply to `npm test` as well. It means the `vitest.config.ts` fix in `05_TEST_BASELINE.md` could be diagnosed and written with high confidence, but not observed passing through the actual `vitest` binary from this session — that confirmation still needs to happen in your own terminal.

## What you need to do

Before approving Stage 1, run these yourself, in a native terminal on the machine that actually has a matching `node_modules`:

```
npm install
npx tsc --noEmit
npm run build
npm test
```

If any of these fail, that's real signal Stage 0 did not have access to during this session — treat a failure here as blocking, not cosmetic.
