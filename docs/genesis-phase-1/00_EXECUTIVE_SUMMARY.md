# 00 — Executive Summary

## What this mission was

Genesis Phase 1 is an architecture-only mission. It designed and built the **Sentinel
Intelligence Foundation** — the canonical entity model, the Score/Evidence/Recommendation
contracts, the calculation context, the engine registry, semantic versioning, a typed error
model, and structural validation — all under `services/intelligence/`, plus the documentation you
are reading and a new automated test suite. It implemented **zero business logic**: no Risk
Engine, no Priority Engine, no Opportunity Engine, no Data Trust Engine, no Recommendation Engine,
no Machine Learning, no Forecast, no Simulation, no Optimization, no Executive AI. Those are
explicitly out of scope for this phase and are left to Genesis Phase 2 and beyond (see
`10_FUTURE_ROADMAP.md`).

## Why it matters

Before this phase, "an intelligence engine's output" had no agreed shape anywhere in the
codebase. Every future engine — and there are at least nine named in the mission brief — would
otherwise have been free to invent its own notion of a score, its own evidence format, its own
versioning scheme, and its own error handling. That path leads to nine incompatible dialects
instead of one language: a dashboard that wants to render "every score across every engine"
would need nine renderers; an audit trail would need nine explanations of "why"; a second engine
consuming a first engine's output would need nine adapters. `services/intelligence` is the single
language all of them now speak, decided once, before any of them are built.

## What was created

| Area | Location | Purpose |
|---|---|---|
| Shared primitives | `services/intelligence/types/` | Branded ids, timestamps, semantic version strings, unit-interval numbers, JSON-safe metadata. |
| Base entity contract | `services/intelligence/contracts/` | `BaseEntity`, `Limitation`, `ExecutionMetadata` — shared by every canonical entity and by Score/Recommendation. |
| Canonical entities | `services/intelligence/entities/` | Site, Municipality, State, Operator, Technology, TowerCompany, Structure, Equipment, Observation, DataSource, Snapshot, Indicator, Scenario (Score, Evidence, Recommendation re-exported from their dedicated homes). |
| Calculation context | `services/intelligence/context/` | The single execution-context object every engine receives. |
| Engine registry | `services/intelligence/registry/` | Declares (never instantiates) Risk, Opportunity, Confidence, Priority, Data Trust, Recommendation, Machine Learning, Simulation, Forecast, Optimization, and Executive AI. |
| Evidence & provenance | `services/intelligence/evidence/` | The reusable "why" behind every Score and Recommendation, and the data-lineage model beneath it. |
| Recommendations | `services/intelligence/recommendations/` | The reusable "what to do about it" contract. |
| Scoring | `services/intelligence/scoring/` | The official `Score` contract and its classification/driver vocabulary. |
| Versioning | `services/intelligence/versioning/` | Semantic version contracts and structural compatibility checks. |
| Errors | `services/intelligence/errors/` | A typed error hierarchy replacing string errors. |
| Validation | `services/intelligence/validation/` | Structural (not business) validation helpers for every contract above. |
| Documentation | `docs/genesis-phase-1/` | This directory. |
| Tests | `tests/intelligence-*.test.ts` | Nine new test files covering contracts, registry, versioning, and validation. |

## Verified results

See the end of this document for the exact `tsc --noEmit`, `npm run build`, and `npm test`
output captured on `leonidas-pc` after the new files were placed in the repository, plus the
`git status`/`git diff --stat` summary of what changed. All three checks were run **in place** in
the existing repository, using the existing `package.json` scripts — no dependency was added and
no existing script was modified.

### `tsc --noEmit` (against the full project, including every existing file and every new file)

```
$ npx tsc --noEmit
(no output — 0 errors)
```

Zero TypeScript errors across the entire repository, including `services/intelligence/**/*.ts` and
`tests/intelligence-*.test.ts` type-checked against the project's real, installed `vitest` types.

### `npm run build` and `npm test` — environment-blocked, not a code defect

Both commands fail on this Linux device-bridge session with the same root cause `genesis-phase-0`
already documented: `node_modules` on `leonidas-pc` was installed on Windows, and this session's
Linux VM cannot load Windows-native optional binaries (`@rollup/rollup-linux-x64-gnu` for
`vitest`, `@next/swc-linux-x64-gnu`/`-musl` for `next build`). Neither failure references any file
this phase created — both fail before any test or page is compiled, while resolving a platform
binary. Nothing in `services/intelligence/`, `docs/genesis-phase-1/`, or the new test files was
the cause, and nothing was modified to work around it (reinstalling `node_modules` for Linux was
not attempted, since that would alter the existing, working Windows install this mission must not
touch).

```
$ npm test
Error: Cannot find module '@rollup/rollup-linux-x64-gnu' ...

$ npm run build
⨯ Failed to load SWC binary for linux/x64 ...
```

**Recommended next step**: run `npm test` and `npm run build` directly on `leonidas-pc` outside
this bridge session (a normal Windows terminal, e.g. PowerShell or cmd, in `C:\LEOTECHSCAN\APP`)
to get an authoritative pass/fail for the nine new test files and the production build. The
`tsc --noEmit` result above is not affected by this limitation and is a complete, authoritative
type-check.

### `git status` / `git diff --stat`

```
$ git status --porcelain
 M .gitignore                          (pre-existing line-ending artifact — see below, not a real change)
?? _to_delete/                         (this mission's cleanup folder — see note below)
?? docs/genesis-phase-1/
?? services/intelligence/
?? tests/intelligence-context.test.ts
?? tests/intelligence-entities.test.ts
?? tests/intelligence-errors.test.ts
?? tests/intelligence-evidence-model.test.ts
?? tests/intelligence-recommendation-model.test.ts
?? tests/intelligence-registry.test.ts
?? tests/intelligence-score-contract.test.ts
?? tests/intelligence-validation.test.ts
?? tests/intelligence-versioning.test.ts

$ git diff --stat
(empty — no tracked file's committed content actually differs from HEAD)
```

Everything reported is new, untracked content. Nothing was committed (not requested).

**`.gitignore`**: `git status` reports it modified, but `git diff`, `git diff --cached`, and
`git hash-object .gitignore` all confirm the working-tree blob is byte-identical to
`HEAD:.gitignore` (`07e5d54b...`). This is a stat-cache artifact of this bridge session: it cannot
atomically replace `.git/index.lock` (`unable to unlink ... Operation not permitted`), so `git
status` can never refresh its cached comparison and reports the file as changed even after its
content is confirmed identical. `genesis-phase-0`'s docs record the same `.git/index.lock`
limitation independently. No actual content difference exists.

**`_to_delete/`**: this session's device-bridge tools cannot delete files on `leonidas-pc` (only
create or move them). Two artifacts that could not be removed were moved here instead of left at
the repository root: a stale `.git/index.lock` left behind by a failed `git checkout` attempted
early in this mission (before content-identity was confirmed via `git diff --ignore-all-space`
and the fix applied via a non-destructive `git show HEAD:.gitignore > .gitignore` instead), and
the incoming `.tar.gz` payload used to transfer the new files onto this machine. Both are safe to
delete manually; deleting `_to_delete/` entirely is safe.

## What this phase deliberately did not do

- No engine implementation of any kind.
- No changes to SQLite, the database, existing APIs, Next.js, React, the current frontend,
  Geospatial Stage 1, existing tests, existing services, or existing routes.
- No new npm dependency. Everything in `services/intelligence/` is written against the TypeScript
  and Node standard library already present in `package.json`.
- No persistence, no ORM, no ID generation strategy — canonical entities are pure contracts, not
  storable records.
