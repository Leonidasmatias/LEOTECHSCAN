# 04 — Test Results

## Command run

```
npm test
```
(which runs `vitest run`, per `package.json`'s `scripts.test`).

## Result: environment startup failure, not a test failure

```
⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯
Error: Cannot find module @rollup/rollup-linux-x64-gnu. npm has a bug related to optional
dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i` again after removing
both package-lock.json and node_modules directory.
```

Vitest never reached the point of collecting or running a single test file. This is a native
optional-dependency resolution failure: Rollup (Vitest's underlying bundler) ships
platform-specific native binaries as optional dependencies, and the `node_modules` directory
present in this repository was installed on the project's real Windows machine — it contains the
Windows build, not `@rollup/rollup-linux-x64-gnu`. This cloud/bridge session runs Linux.

## Why this was not "fixed"

The npm-suggested remedy (`rm -rf node_modules package-lock.json && npm install`) is a dependency
change, explicitly out of scope for Genesis Phase 0 ("nenhuma atualização geral de dependências").
It would also not reflect the actual target environment (the Windows machine), so "fixing" it here
would not actually validate anything real — it would just install a different, second set of
native binaries never used in production.

## Prior documentation of this exact issue

This is not a new discovery. The immediately preceding Genesis Repository Audit already identified
and risk-registered this exact failure mode:
`docs/genesis-audit/15_RISK_REGISTER.md`, risk **R-07**: *"Suíte de testes (Vitest) não executável
neste ambiente de auditoria por incompatibilidade de binário nativo"* — recommending that a CI
environment matching the real production runtime (Windows or Linux, but consistent) be defined and
documented. That recommendation still stands and is repeated in `09_REMAINING_RISKS.md`.

## Totals

Not obtainable in this session: 0 test files were collected, so there is no pass/fail/ignored
count, duration, or warning list to report. This is an environment blocker, not a "0 tests
passed" result.

## Geospatial-specific tests

The 8 `tests/geospatial-*.test.ts` files were not run for the same reason. Their syntax was
independently confirmed valid via `tsc --noEmit` (see `03_TYPESCRIPT_RECOVERY.md`), which is a
necessary but not sufficient condition for them to actually pass at runtime.

## Required next step (for Phase 1 / the real machine)

Run `npm test` directly on the Windows machine that owns this `node_modules` directory (where the
native Rollup binary already matches the OS), and record real pass/fail/duration/warning numbers
there. This mission does not claim tests pass — it explicitly could not run them.
