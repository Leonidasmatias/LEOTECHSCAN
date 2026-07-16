# 17 — Increment 0: Security Floor (Genesis Phase 2)

Status: **Implemented**. This document records what was actually built for Increment 0's
security-floor half (`14_IMPLEMENTATION_ROADMAP.md`), against the frozen role model in
`10_SECURITY_BOUNDARY.md` and ADR-011 (`15_ARCHITECTURE_DECISIONS.md`).

## Baseline already verified in this session

Recorded verbatim from the native `leotechscan-pc` baseline run that preceded this increment, in
the same Claude Code session, before any file in this increment was touched:

- `HEAD`: `aa32e3a`
- Branch: `master`
- Tag at `HEAD`: `genesis-phase-2-architecture-v1`
- Working tree: clean
- `npx tsc --noEmit`: PASS (no output)
- `npm test`: 24 test files, 205/205 tests PASS
- `npm run build`: PASS
- No files modified or created during that baseline pass

## Files inspected before implementation

- `docs/genesis-phase-2/10_SECURITY_BOUNDARY.md`
- `docs/genesis-phase-2/14_IMPLEMENTATION_ROADMAP.md`
- `docs/genesis-phase-2/15_ARCHITECTURE_DECISIONS.md`
- `docs/genesis-phase-2/16_QUALITY_GATES.md`
- `lib/request-guard.ts` (existing WP0.7 input-shape guards — confirmed unrelated to
  authentication; left untouched)
- `app/api/data-trust/recalculate/route.ts`
- `app/api/sentinel-core/build/route.ts`
- `app/api/data-trust/site/route.ts`
- `app/api/evidence-center/site/route.ts`
- `services/data-trust-engine.ts` (`dataTrustForSite`, `recalculateDataTrust`,
  `dataTrustDashboard`) — the direct service functions called by the routes above
- `services/evidence-center-engine.ts` (`evidenceCenterForSite`)
- `sentinel-core/engine.ts` (`buildGraph`) and its import of
  `sentinel-core/graph/graph-builder.ts`
- `services/enterprise-v3-engine.ts` (`scenarioPlanner`, `strategicPlanning`,
  `digitalTwinSite`) — inspected to classify `POST /api/scenario-planner` and
  `POST /api/strategic-planning`
- `services/site-notes.ts` (`addSiteNote`) — inspected to classify
  `POST /api/sites/[id]/notes`
- `services/audit-trail.ts` (`recordAudit`)
- `lib/db.ts` (`getDb` — read-only, `PRAGMA query_only = ON`; `getWritableDb` — read/write)
- `tests/request-guard.test.ts` (existing test pattern for `lib/request-guard.ts`)
- `tests/geospatial-api-contract.test.ts` (existing source-inspection contract-test pattern,
  reused for this increment's route wiring proof)
- `components/DataTrustModules.tsx`, `components/SentinelCoreModules.tsx`,
  `components/Sprint2BModules.tsx` (client-side `useApi`/`fetch` consumers) — inspected to
  determine real UI usage of the four named routes
- Searched the full `app/api/**/route.ts` set (44 route files) for any `POST`/`PUT`/`PATCH`/`DELETE`
  handler and for other GET handlers that persist

No existing authentication utility was found anywhere in the repository (`SENTINEL_ADMIN_KEY`,
`x-sentinel-admin-key`, and common names like `authGuard`/`requireAdmin` all had zero hits before
this increment).

## Guard design

New file: `lib/auth-guard.ts`. Single exported function, `requireAdminAuth(request: Request):
AdminAuthResult`, where `AdminAuthResult = { authorized: true } | { authorized: false; response:
NextResponse }`. A route calls it as its first statement and returns `auth.response` immediately
if `!auth.authorized`.

Design choices:

- **Dependency-free**: imports only `node:crypto` (`timingSafeEqual`) and `next/server`
  (`NextResponse`, already a direct dependency of every route in this project — no new package
  added, `package.json`/`package-lock.json` untouched).
- **Fail closed**: any ambiguous or unconfigured state (missing env var, missing header, empty
  header, mismatched key) resolves to "not authorized." There is no code path that defaults to
  authorized.
- **Constant-time comparison**: `secretsMatch()` compares UTF-8 byte buffers with
  `crypto.timingSafeEqual`. Node's `timingSafeEqual` throws on unequal-length buffers, so a
  length mismatch is checked first and handled by running a same-cost `timingSafeEqual` call
  against the expected buffer with itself (so the function's timing profile doesn't have an
  early-return shortcut for the mismatched-length case) before returning `false`. This means
  different-length keys are handled safely and never throw, per the requirement — the length
  check itself is a (standard, widely-accepted) minor timing signal that the *length* of the
  secret differs, not its value; padding to a fixed-width comparison was considered and rejected
  as unnecessary complexity for a shared-secret floor of this scope.
- **No hardcoded secret**: the expected value is read once per call from
  `process.env.SENTINEL_ADMIN_KEY`; nothing is embedded in source, committed, or defaulted.
- **No secret logging**: the only `console.error` call in the module logs the fixed string
  `"sentinel_admin_key_not_configured"` (an event name, not a value) when the env var is absent.
  Neither the configured secret nor the client-supplied header value is ever passed to `console.*`
  or included in any response body — verified by `tests/auth-guard.test.ts`.
- **Generic responses**: `401` body is `{ error: "Nao autorizado." }`; `503` body is
  `{ error: "Servico de autorizacao indisponivel." }`. Both follow this project's existing
  sanitized-error-disclosure convention (`10_SECURITY_BOUNDARY.md`'s "Error disclosure policy",
  same pattern already used by `system-health/route.ts`).

## Environment variable and header contract

- Environment variable: `SENTINEL_ADMIN_KEY` (server-side only; not read by any client code, not
  added to any `.env*` file by this increment — no `.env` file was created or modified).
- Request header: `x-sentinel-admin-key`.
- A caller must set this header to the exact value of `SENTINEL_ADMIN_KEY` to invoke either
  protected route. There is no fallback, alternate header name, or query-param form.

## Protected routes

- `POST /api/data-trust/recalculate` (`app/api/data-trust/recalculate/route.ts`)
- `POST /api/sentinel-core/build` (`app/api/sentinel-core/build/route.ts`)

Both call `requireAdminAuth(request)` as the first line of their handler, before `request.json()`,
before `getWritableDb()`/DB access, before the engine call (`recalculateDataTrust`/`buildGraph`),
before any persistence, and — for `recalculateDataTrust`, which calls `recordAudit` internally via
`dataTrustForSite` — before any audit write. `tests/route-security-contract.test.ts` proves this
ordering by source position, not just presence.

Authorized-request behavior is otherwise byte-for-byte unchanged: same body parsing, same `limit`
clamping (`[1, 5000]` for Data Trust, unchanged pass-through for the graph build's `limit`/`reset`),
same success/error status codes, same response shapes. No formula, adapter, schema, or persistence
logic was touched.

## Inventory of other mutating API routes (rule 2 — reported, not protected)

A full scan of all 44 files under `app/api/**/route.ts` for `POST`/`PUT`/`PATCH`/`DELETE` handlers
found exactly five, beyond the two named above:

| Route | Handler calls | Persists? | Decision |
|---|---|---|---|
| `POST /api/sites/[id]/notes` | `addSiteNote(getWritableDb(), id, note)` → `INSERT INTO site_notes` | **Yes** | **Not protected.** Not named in `14_IMPLEMENTATION_ROADMAP.md` Increment 0's affected-files list, and not classified anywhere in `10_SECURITY_BOUNDARY.md`'s operation-class table. Per this mission's scope rule, an unclassified route is inventoried and reported, not auto-protected. Real risk (a low-value, low-blast-radius per-Site text note, capped at 1000 chars) is materially lower than the two named recalculation/rebuild routes, but it is a genuine gap carried forward, not hidden. |
| `POST /api/scenario-planner` | `scenarioPlanner(getDb(), body)` → `strategicPlanning(getDb(), body)` | **No** — `getDb()` opens SQLite with `PRAGMA query_only = ON`; no `.run(` calls anywhere in the call graph | Correctly unprotected; it is a read-only computation, not a mutation route. |
| `POST /api/strategic-planning` | `strategicPlanning(getDb(), body)` | **No** — same read-only connection as above | Same as above. |

No `PUT`, `PATCH`, or `DELETE` handler exists anywhere in `app/api/**`.

Additionally, `GET /api/data-trust` (`app/api/data-trust/route.ts`, the dashboard) calls
`dataTrustDashboard(getWritableDb())`, which conditionally calls `recalculateDataTrust(db, 25)` —
but only when `site_trust_scores` is empty (a one-time bootstrap, not a per-request write once
seeded). This is a third GET-with-conditional-side-effect route, not previously named in
`10_SECURITY_BOUNDARY.md`'s table or in this mission's scope. It is reported here for completeness
and left unchanged — out of scope for Increment 0, and not one of the two GET routes this
increment was asked to investigate.

## Decision on the two named GET-with-side-effects routes

`GET /api/data-trust/site` and `GET /api/evidence-center/site` were investigated as instructed.
Both call their underlying service function with `persist = true`
(`dataTrustForSite(getWritableDb(), id, true)` and `evidenceCenterForSite(getWritableDb(), id,
true)`, the latter cascading into `dataTrustForSite(..., persist)` and
`copernicusForSite(..., persist)` as well), so both do write to SQLite and call `recordAudit` on
every successful GET — exactly the pre-existing risk `ADR-008` already named.

**Decision: leave both unchanged for this increment. Do not apply the guard.**

Real repository usage confirms both are live UI read paths, not admin-only actions:

- `components/DataTrustModules.tsx` calls `useApi(\`/api/data-trust/site?id=${siteId}\`)` and
  `useApi(\`/api/evidence-center/site?id=${siteId}\`)`.
- Every `useApi` implementation in this codebase (confirmed in `Sprint2BModules.tsx` and the same
  pattern in `DataTrustModules.tsx`) is a plain client-side `fetch(url)` call with no custom
  headers — it is browser code, so it has no way to attach `x-sentinel-admin-key` without
  embedding the server secret in client-shipped JavaScript, which would defeat the guard entirely
  (the secret would be visible to anyone viewing the page source/network tab).

Applying `requireAdminAuth` to either route today would return `401` to every normal page load that
renders a Site's Trust badge or Evidence Center panel — a functional regression of currently-working
UI, not just an admin action. That fails this increment's own acceptance criteria ("all existing
tests remain green... no other route's behavior changes") and the mission's explicit instruction
not to change UI or break an existing consumer.

This reproduces, and does not resolve, the exact residual risk `ADR-008` already accepted: these
two routes cannot be correctly gated behind a simple "is this an authorized admin" check without
first splitting their read and write behavior (`13_MIGRATION_STRATEGY.md`, referenced by
`10_SECURITY_BOUNDARY.md`'s table entry for `GET /api/data-trust/site`) — a route-shape change,
which is explicitly out of scope for this increment and for this mission generally (Principle 4 /
ADR-015: legacy routes are never modified as a side effect of unrelated work). The residual risk is
carried forward unresolved, exactly as `ADR-008` anticipated, targeted for Increment 11 per
`14_IMPLEMENTATION_ROADMAP.md`.

## Authorization and misconfiguration behavior

| Condition | Response |
|---|---|
| Header absent | `401`, `{ "error": "Nao autorizado." }` |
| Header present, empty | `401`, same body |
| Header present, wrong value | `401`, same body |
| Header present, correct value, `SENTINEL_ADMIN_KEY` unset | `503`, `{ "error": "Servico de autorizacao indisponivel." }` |
| Header present, correct value, `SENTINEL_ADMIN_KEY` set and matching | Request proceeds unchanged |

## Side-effect prevention

For both protected routes, `requireAdminAuth(request)` is the first executable statement in the
handler. An unauthorized or misconfigured call returns before:

- any request-body parsing (`request.json()`)
- any database handle acquisition (`getWritableDb()`)
- any engine execution (`recalculateDataTrust`/`buildGraph`)
- any persistence (`INSERT` into `site_trust_scores`/`site_validation_history`)
- any graph rebuild (`buildGraphInternal`)
- any audit write (`recordAudit`, reached transitively through `recalculateDataTrust` →
  `dataTrustForSite`)

`tests/route-security-contract.test.ts` asserts this ordering by source position (the guard call's
string index precedes every side-effect marker's string index), not merely by import presence.

## Tests

- `tests/auth-guard.test.ts` — 8 tests, pure unit tests of `requireAdminAuth` (no I/O, no
  `node:sqlite`): missing header, incorrect key, correct key, missing `SENTINEL_ADMIN_KEY`, empty
  client key, different-length keys (both directions) never throw, deterministic repeated checks,
  and rejection bodies never contain either the configured or provided secret value.
- `tests/route-security-contract.test.ts` — 10 tests, source-inspection contract tests (the
  established pattern from `tests/geospatial-api-contract.test.ts`), proving both protected routes
  import `requireAdminAuth` from `@/lib/auth-guard`, call it and short-circuit on
  `!auth.authorized`, and do so before every identified side-effect call.

**Coverage limitation, stated explicitly per the mission's own instruction**: neither protected
route file is imported as a module in any test. `app/api/data-trust/recalculate/route.ts` imports
`@/lib/db`, and `app/api/sentinel-core/build/route.ts` imports `@/sentinel-core/engine` → `@/lib/db`
— both transitively open a real `node:sqlite` `DatabaseSync` at module scope, which this project's
Vitest/Vite pipeline cannot collect (the same documented failure mode behind
`tests/geospatial-api-contract.test.ts` and `docs/stage-1/08_TEST_RESULTS.md`). This increment
reuses that project's existing, established source-contract pattern instead of attempting a direct
import. Consequence: the route contract test proves correct wiring and ordering by source
inspection, not a live HTTP request/response cycle through the actual Next.js route handler. The
guard function itself (`requireAdminAuth`) *is* covered end-to-end via real `Request`/`Response`
objects in `tests/auth-guard.test.ts`, since `lib/auth-guard.ts` has no `node:sqlite` dependency.

Total: 18 new tests, all passing. Full-suite `npm test` results before/after this increment are
in the Quality Gates section below.

## Remaining risks

- `GET /api/data-trust/site` and `GET /api/evidence-center/site` still write to SQLite (including
  an audit-trail row) on every unauthenticated GET — unresolved, carried forward per `ADR-008`
  (see decision section above).
- `GET /api/data-trust` (dashboard) still has a conditional bootstrap-time write path, newly
  documented here, not previously named in `10_SECURITY_BOUNDARY.md`.
- `POST /api/sites/[id]/notes` remains unauthenticated and can persist arbitrary (length-capped)
  text against any Site ID — inventoried, not protected, per scope rule 2. Extending guard
  coverage to this and the remaining ~41 non-mandatory-scope endpoints is explicitly out of scope
  (`14_IMPLEMENTATION_ROADMAP.md`, "Explicitly postponed" section) and unchanged by this increment.
- The shared-secret model has no rate limiting, no replay protection, and no per-caller identity —
  all explicitly named as not-designed-in-Phase-2.0 in `10_SECURITY_BOUNDARY.md`'s cross-cutting
  definitions. A brute-force attempt against the header is only mitigated by the constant-time
  comparison (prevents timing-based key recovery), not by throttling.
- `components/DataTrustModules.tsx`'s "recalculate" button and `components/SentinelCoreModules.tsx`'s
  "build" button call these two POST routes directly from the browser with no admin header. After
  this increment, both buttons will receive `401` from a real browser session until an operator
  configures `SENTINEL_ADMIN_KEY` and a proper (non-browser) authorized caller invokes them — this
  is the intended, accepted effect of closing the highest-severity risk (ADR-011), not an
  overlooked regression: these routes were never meant to remain callable by an anonymous browser
  session. No UI file was modified to reach this state, per the mission's explicit instruction.

## Rollback

Revert exactly two kinds of change, nothing else:

1. Delete `lib/auth-guard.ts`, `tests/auth-guard.test.ts`, and `tests/route-security-contract.test.ts`.
2. In `app/api/data-trust/recalculate/route.ts` and `app/api/sentinel-core/build/route.ts`, remove
   the `import { requireAdminAuth } from "@/lib/auth-guard";` line and the two-line
   `const auth = requireAdminAuth(request); if (!auth.authorized) return auth.response;` block.

No schema, database file, dependency, or other route is touched by this increment, so rollback is
a pure file/line revert with no migration or data implications. This procedure was exercised
mentally against the actual diff (Section "Files created and modified" of the final report) rather
than by a separate staging revert-and-restore pass in this session; the two-file/two-call-site
scope named in `14_IMPLEMENTATION_ROADMAP.md` matches exactly what was changed, which is what makes
the rollback mechanical.

## Go/no-go for Increment 1

**Go**, conditioned on the quality-gate results recorded in this increment's final report being
all-green (native `tsc --noEmit`, `npm test`, `npm run build`, and a diff limited to the files
listed above). Increment 0's acceptance criteria
(`14_IMPLEMENTATION_ROADMAP.md`: "the two named routes return 401/403 without valid credentials;
all existing tests remain green; `tsc --noEmit` clean; no other route's behavior changes") are met
by this implementation. The residual risks above are carried forward, documented, and — per
ADR-008/ADR-011 — already anticipated and accepted at the architecture-freeze level, not new
information that should block Increment 1 (`14_IMPLEMENTATION_ROADMAP.md` Increment 1 is a
documentation-freeze formality, not additional code).
