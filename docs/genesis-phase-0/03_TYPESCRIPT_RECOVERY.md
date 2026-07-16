# 03 — TypeScript Recovery

Tool used throughout: `npx tsc --noEmit` (chosen because it works reliably in this bridge
session, unlike Vitest/Next's build pipeline — see `04_TEST_RESULTS.md` and
`05_BUILD_AND_RUNTIME_VALIDATION.md`). Fixed in small batches, re-validated with a fresh
`tsc --noEmit` run after each batch, per the mission's instruction.

## Batch 1 — restore the 18 purely-truncated tracked files + complete `vitest.config.ts`

Applied via `git show HEAD:<file> > <file>` for the 18 files (see `02_RECOVERY_DECISIONS.md`) and
a targeted completion of `vitest.config.ts`'s missing `defineConfig` body.

Result after batch 1: 3 errors remained —
- `.next/types/routes.d.ts(110,9): error TS1005: '}' expected.`
- `.next/types/validator.ts(414,39): error TS1005: '>' expected.`
- `services/geospatial/spatial-intelligence-engine.ts(198,48): error TS1005: '}' expected.`

The first two were immediately recognized as belonging to `.next/`, a gitignored generated build
cache — confirmed via `.gitignore` (`.next` listed) and file mtime (dated 18 days before this
mission, i.e. clearly stale, unrelated to any change made in this session).

The third was new information: `spatial-intelligence-engine.ts` is an **untracked** Stage 1
file with no `git show HEAD:` fallback, and had not been flagged as broken by the original Genesis
audit. Investigated in detail (see `02_RECOVERY_DECISIONS.md` and
`07_GEOSPATIAL_FOUNDATION_STATUS.md`).

## Batch 2 — reconstruct `spatial-intelligence-engine.ts`

Reconstructed from a complete, verbatim 258-line read of this exact file captured earlier in this
same working session (during the prior Genesis Repository Audit, before this mission began).
Before overwriting, the truncated 197-line state was copied into
`RECOVERY_SNAPSHOTS/GENESIS_PHASE_0_20260716_125753Z/pre-repair-truncated-untracked/` and its
SHA-256 recorded.

Result after batch 2: 2 errors remained — the same two `.next/types/*` errors as batch 1.
`spatial-intelligence-engine.ts` compiled clean.

## Batch 3 — verify no other untracked file has hidden truncation

`tsc --noEmit`'s `include` pattern (`"**/*.ts", "**/*.tsx"`) covers every `.ts`/`.tsx` file in the
project regardless of import reachability, so the batch-2 clean result already swept all `.ts`
files. It does **not** cover `.mjs`/`.mts`/`.py` files. Ran `node --check` against both `.mjs`
files and `python3 -m py_compile` against the one `.py` script in the untracked Stage 1 set:

- `services/geospatial/spatial-index-sql.mjs` — `node --check` passed.
- `scripts/geospatial-spatial-index.mjs` — **failed**: `SyntaxError: Unexpected end of input` at
  line 179 (`} else if (value`). A second, previously-undetected truncation. See
  `02_RECOVERY_DECISIONS.md` for the reconstruction (Option C, evidence-based from
  `docs/stage-1/04_SPATIAL_INDEX.md`).
- `scripts/geospatial_migrate.py` — `python3 -m py_compile` passed.

## Batch 4 — reconstruct `scripts/geospatial-spatial-index.mjs`

Applied the reconstruction described in `02_RECOVERY_DECISIONS.md`. Re-ran `node --check` — passed.
Re-ran full `npx tsc --noEmit` for a final sweep.

## Final result

```
.next/types/routes.d.ts(110,9): error TS1005: '}' expected.
.next/types/validator.ts(414,39): error TS1005: '>' expected.
```

**0 errors in source code.** The 2 remaining errors are exclusively in the gitignored, generated
`.next/types/` build cache (dated 18 days before this mission), not in any file tracked by git or
authored by this project. An attempt was made to delete the stale `.next/` directory to remove
this noise entirely; it failed because this session's device bridge cannot delete files on the
Windows-mounted filesystem (confirmed structural limitation, not a permissions decision) — this
is a cosmetic, no-risk leftover, and `.next/` will regenerate correctly the next time
`npm run build`/`npm run dev` actually runs (on a machine where that's possible — see
`05_BUILD_AND_RUNTIME_VALIDATION.md`).

## Initial vs. final error count

| Stage | Errors | Notes |
|---|---|---|
| Mission start | Not separately isolated (build was already broken before typecheck was run) | — |
| After batch 1 (18 files + vitest.config.ts) | 3 | 2 stale `.next/`, 1 new (`spatial-intelligence-engine.ts`) |
| After batch 2 (`spatial-intelligence-engine.ts`) | 2 | Both stale `.next/` only |
| After batch 3 (verification sweep) | 2 (tsc) + 1 new (`node --check` on `.mjs`) | Found `geospatial-spatial-index.mjs` truncation via a non-tsc tool |
| After batch 4 (`geospatial-spatial-index.mjs`) | 2 (tsc, both stale `.next/`); 0 (`node --check`, `py_compile`) | Final state |

No `any`, `@ts-ignore`, `@ts-nocheck`, or `eslint-disable` was introduced at any point in this
recovery.
