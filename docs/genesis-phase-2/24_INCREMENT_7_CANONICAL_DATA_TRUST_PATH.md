# 24 — Increment 7: Canonical Read-Only Data Trust Path

Frozen implementation contract, written before any runtime code in this
increment. Per `23_INCREMENT_6_5_ARCHITECTURAL_DECISIONS.md` (Decisions
A–F, ADR-016 through ADR-019), this increment builds the first isolated,
additive, read-only canonical HTTP path for Data Trust.

## 1. Purpose

Serve a canonical, read-only projection of a Site's Data Trust assessment
at `GET /api/intelligence/data-trust/site`, proving that a new canonical
route can be added without bypassing the Orchestrator (`12_DEPENDENCY_GRAPH.md`
forbidden dependency #3), without persisting anything (Principle 6), and
without touching the legacy route or any existing caller (Principle 4).

## 2. Baseline

Branch `master`, HEAD `b2081ba`, tag `genesis-phase-2-increment-6-5-v1`,
working tree clean, confirmed before any file in this increment was
touched.

## 3. Architectural dependencies

- ADR-016 (minimal Orchestrator) — satisfied by `services/intelligence-runtime/intelligence-orchestrator.ts` (pure core) + `intelligence-orchestrator-instance.ts` (real wiring).
- ADR-017 (Snapshot Provider) — satisfied by `services/intelligence-adapters/snapshot-provider.ts`.
- ADR-018 (Data Trust outer adapter) — satisfied by `services/intelligence-adapters/data-trust-read-adapter.ts`.
- ADR-019 (Stage 3/4 clarification) — this route is additive, non-default, zero migrated callers; Increment 8 remains the gate for UI migration.
- Increment 3's Site Entity Adapter (`site-entity-adapter.ts`), Increment 4's Data Trust Score Adapter (`data-trust-score-adapter.ts`), and Increment 6's Recommendation Adapter (`recommendation-adapter.ts`) are reused verbatim, unmodified.

## 4. Modules created

| Module | Kind | DB-touching? |
|---|---|---|
| `services/intelligence-adapters/snapshot-provider.ts` | pure | No |
| `services/intelligence-adapters/data-trust-read-adapter.ts` | thin outer adapter | Yes — the only DB-touching module in this increment |
| `services/intelligence-runtime/intelligence-orchestrator.ts` | pure core, DI-based | No (all deps injected) |
| `services/intelligence-runtime/intelligence-orchestrator-instance.ts` | real wiring | Yes, transitively (imports the outer adapter) |
| `services/intelligence-adapters/api-projection-adapter.ts` | pure | No |
| `app/api/intelligence/data-trust/site/handler.ts` | testable request-handling logic | No |
| `app/api/intelligence/data-trust/site/route.ts` | route (Next.js entry point only) | Yes, transitively — but only inside the `GET` function body via a dynamic `import()`, never at module top-level (see Section 5's testability note) |

No existing file is modified except `services/intelligence-adapters/index.ts` (new export additions only, if needed).

### Why the Orchestrator is split into two files

Every existing adapter test in this repository (`tests/intelligence-*-adapter*.test.ts`)
is a pure unit test with zero I/O; no test anywhere in `tests/**` imports
`services/data-trust-engine.ts`, `services/site-service.ts`, or `lib/db.ts`
directly (confirmed by a repo-wide search before writing this doc) — because
`site-service.ts` imports `lib/db.ts`, which imports `node:sqlite` as a real
(non-type-only) import, and this project's established, repeatedly-stated
convention is that a Vitest file transitively importing `node:sqlite` cannot
be safely collected. To keep the Orchestrator's own call-ordering/context-
construction logic unit-testable without I/O, its core logic
(`intelligence-orchestrator.ts`) takes every dependency — including the
outer adapter — as an injected function, and has no import of any
DB-touching module at all (only type-only imports, which are erased at
compile time and never load `node:sqlite`). A second, thin file
(`intelligence-orchestrator-instance.ts`) wires the real dependencies
together for production use; it is the only place, besides the outer
adapter itself, that transitively imports `node:sqlite`, and it is never
imported by a unit test. The route follows the identical pattern (Section 5),
with one additional constraint discovered during implementation: Next.js's
App Router route-type checker (`.next/types/app/**`, enforced by `next
build`) rejects any named export from a `route.ts` file other than the
recognized set (`GET`/`POST`/.../`runtime`/`dynamic`/`config`/...) — a
`handleCanonicalDataTrustSiteRequest` export alongside `GET` failed the
build with "Property ... is incompatible with index signature." The
testable, dependency-injected request-handling logic therefore lives in a
sibling `handler.ts` file instead; `route.ts` itself exports only
`runtime`/`dynamic`/`GET` and delegates to `handler.ts`.

## 5. Request contract

```
GET /api/intelligence/data-trust/site?id=<positive integer Site database id>
```

Mirrors the legacy route's own `?id=` query parameter convention
(`app/api/data-trust/site/route.ts`) exactly, per this mission's explicit
instruction to preserve it absent a binding reason not to. Unlike the
legacy route (which silently coerces a missing/invalid `id` to `0` and
returns 404), this new route explicitly validates `id` and returns `400`
for a missing or non-positive-integer value (Section 12) — new, stricter
validation in new code, not a change to the legacy route's own behavior.

## 6. Exact versioned response envelope

```ts
interface DataTrustCanonicalEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "data-trust";
  readonly siteId: string;
  readonly snapshot: {
    readonly id: string;
    readonly kind: "derived" | "synthetic";
    readonly source: "data_importacao" | "arquivo_origem" | "fallback";
  };
  readonly context: {
    readonly contextId: string;
    readonly correlationId: string;
    readonly requestedAt: string;
    readonly requestedBy: string;
    readonly environment: string;
  };
  readonly result: {
    readonly score: Score | null;
    readonly evidence: readonly Evidence[];
    readonly recommendations: readonly Recommendation[];
  };
  readonly adaptation: {
    readonly success: boolean;
    readonly issues: readonly {
      readonly stage: "site" | "snapshot" | "score" | "recommendation";
      readonly code: string;
      readonly field: string;
      readonly severity: "informational" | "moderate" | "significant";
      readonly message: string;
      readonly canContinue: boolean;
    }[];
    readonly limitations: readonly Limitation[];
  };
}
```

Note: this envelope carries no `notFound` field. A not-found Site is
mapped straight to an HTTP 404 with a plain `{ "error": "Site not found." }`
body (Section 12) *before* this envelope is ever constructed — a
`notFound` field on the envelope itself could never be `true` in any
response a real client would see, so it is not declared (post-audit fix;
an earlier version of this envelope carried such a field).

Rules honored (Decision E):

- `result.score` is the primary result — `Score<"data-trust">` from the
  existing, unmodified Data Trust Score Adapter, or `null` if adaptation
  did not succeed.
- `result.evidence` is **always `[]` in Increment 7**. **Corrected claim
  (post-audit fix — the original wording here overstated this)**: the
  legacy Data Trust result does carry evidence-*shaped* sub-data — direct
  inspection of `services/confidence-engine.ts` and
  `services/satellite-validation-engine.ts` shows `dataTrustForSite()`'s
  return nests a Copernicus/satellite validation object (via
  `confidenceForSite → satelliteValidationForSite`) carrying
  `evidenceLevel`, `scene`, `lastSceneDate`, and `validationRecommendation`.
  This is **not** silently discarded by accident: it does not match the
  existing Evidence Adapter's required `LegacyEvidenceItem` input shape
  (`{ type, source, status, summary }`, sourced from the wholly separate
  `evidence-center-engine.ts`'s `evidenceCenterForSite()`, confirmed by
  direct inspection of `services/intelligence-adapters/evidence-adapter.ts`'s
  own required input type), and the one number this sub-data does
  contribute (`satelliteValidationScore`) is already summarized into the
  Score's own `satelliteConfidence` driver by Increment 4's own,
  already-scoped, already-tested Score Adapter (`DATA_TRUST_ADAPTER_UNMAPPED_FIELDS`
  explicitly names `satellite` as unmapped). Producing canonical
  `Evidence[]` from the satellite sub-data's remaining fields
  (`evidenceLevel`/`scene`/`lastSceneDate`/`validationRecommendation`)
  would require a new, explicitly-designed adapter — reshaping a
  `satelliteValidationForSite()`-shaped object into `LegacyEvidenceItem`
  is not a mechanical rename, and inventing that mapping ad hoc inside
  this increment would be exactly the kind of undesigned adapter
  `08_ADAPTER_STRATEGY.md` exists to prevent. That work is out of
  Increment 7's scope; fabricating evidence from nothing (or from a
  hastily-improvised reshaping) is expressly forbidden (Decision E), so
  the truthful choice for this increment is an empty, disclosed array.
  Documented as a known limitation (Section 17), not silently omitted.
- `result.recommendations` contains 0 or 1 items: the legacy Data Trust
  result's own `recommendation: string` field, adapted via the existing,
  unmodified Recommendation Adapter as a `"DATA_TRUST_TEXT"` item
  (`priority: null`, `evidenceContext: null` — both legitimate, already-
  tested null cases, not new adapter behavior).
- `adaptation.issues` aggregates every adapter's structured issues
  (Site, Snapshot's own limitation when the fallback fires, Score,
  Recommendation), each tagged with which stage produced it — a stable
  projection, not a new canonical model.
- No fabricated confidence, timestamps, identifiers, or provenance appear
  anywhere in this envelope. No canonical contract in
  `services/intelligence/**` is modified to produce this shape.

## 7. Snapshot derivation rules (Decision B / ADR-017)

Input: the requested Site's `dataImportacao` and `arquivoOrigem` string
fields (from `siteRow()`'s output, via the outer adapter — Section 8).

**Critical repository-specific finding, confirmed by direct code
inspection, that refines ADR-017's "when present and non-empty" language**:
`lib/db.ts`'s `text()` helper — the function every legacy field in
`siteRow()` is built from — returns `String(value ?? "Não informado")`.
A raw-`NULL` `data_importacao`/`arquivo_origem` column is therefore
**never actually empty or `null`/`undefined`** by the time it reaches this
provider — it is the literal placeholder string `"Não informado"`. This
exact placeholder-recognition problem was already solved once in this
repository, by Increment 3's own `site-entity-adapter.ts`
(`LEGACY_PLACEHOLDER = "Não informado"`, `readLegacyString()`). This
provider reuses the identical recognition rule (trim, then treat both
"empty after trim" and "exactly `Não informado`" as absent) rather than
inventing a second, subtly different one — treating the placeholder as a
genuine value would be a real fabrication (reporting "we know when this
Site was imported" when the legacy row actually carries no such
information), which Decision B's "must not fabricate" requirement
forbids.

Priority order:

1. `dataImportacao`, trimmed, when present and not the placeholder →
   `kind: "derived"`, `source: "data_importacao"`,
   `id: "derived:data-importacao:<trimmed value>"`.
2. Else `arquivoOrigem`, trimmed, when present and not the placeholder →
   `kind: "derived"`, `source: "arquivo_origem"`,
   `id: "derived:arquivo-origem:<trimmed value>"`.
3. Else the fixed literal → `kind: "synthetic"`, `source: "fallback"`,
   `id: "synthetic:no-import-metadata"`.

Requirements met: deterministic (same input → same output); no
`Date.now()`; no random value; no database write; no claim that the id
references a persisted Snapshot row; a `Limitation` (`severity:
"informational"`) is attached whenever the synthetic fallback fires,
disclosing that no real import-time signal was available for this Site.
No hashing is used — the trimmed source value is used directly, prefixed
by its source kind, which is sufficient to avoid collisions between the
two source kinds without inventing a new hashing convention this
repository does not already have.

## 8. Orchestrator responsibilities (Decision A / ADR-016)

`createDataTrustOrchestrator(deps).getCanonicalDataTrustForSite(siteId)`:

1. Call `deps.fetchLegacyDataTrustForSite(siteId)` (the outer adapter,
   Section 9). Returns `null` if the Site does not exist → orchestration
   result reports `notFound: true`, nothing further is attempted.
2. Derive the Snapshot from the returned `site.dataImportacao`/
   `arquivoOrigem` via `deps.deriveSiteSnapshot(...)` — computed
   independently of whether Site Entity Adaptation (next step) succeeds,
   since Snapshot derivation is its own concern (Decision B) and must be
   disclosable even if the Site adaptation later fails for an unrelated
   reason (e.g. missing municipality).
3. Call `deps.adaptLegacySiteRow(site)` (Increment 3, real, unmodified) to
   obtain a canonical `Site`/`EntityReference<"Site">`. **Per
   `02_CANONICAL_DOMAIN_MODEL.md`'s binding rule, this is the only
   sanctioned way to obtain that reference — the Orchestrator never
   constructs one independently.** If this fails, the orchestration result
   is `success: false` with the Site adaptation issues surfaced (tagged
   `stage: "site"`) and the Snapshot still disclosed; no Score/Recommendation
   is attempted (both require a valid `EntityReference<"Site">`).
4. Construct the minimal `CalculationContext`: `contextId`/`correlationId`
   derived deterministically from `siteId` + the injected clock's current
   timestamp (never `crypto.randomUUID()` — consistent with every other
   Genesis Phase 2 module's determinism discipline); `scope` = the
   resolved `EntityReference<"Site">`; `snapshot` = the derived
   `SnapshotId`; `requestedAt` = the injected clock's ISO timestamp;
   `requestedBy` = the fixed literal `"api:intelligence/data-trust/site"`
   (no per-user identity exists yet — Increment 0's floor is a shared
   secret, not per-user auth); `environment` = `"test"` when
   `process.env.NODE_ENV === "test"`, else `"production"`; `extensions =
   {}`. Validated via `validateCalculationContextShape` before use
   (Principle 7).
5. Call `deps.adaptLegacyDataTrustResult(trust, { entityReference,
   calculatedAt: requestedAt, contextId })` (Increment 4, real,
   unmodified).
6. Call `deps.adaptLegacyRecommendation({ type: "DATA_TRUST_TEXT", text:
   trust.recommendation, priority: null, evidenceContext: null }, {
   idSeed: entityReference.id, affectedEntities: [entityReference],
   timestamp: requestedAt })` (Increment 6, real, unmodified) — always
   attempted when Score adaptation succeeded (the recommendation text is
   always present on a legacy Data Trust result), never fabricated.
7. Evidence Adapter is **not invoked** (Section 6/17) — evidence-shaped
   satellite/Copernicus sub-data does exist on this call chain, but it
   does not match the existing `LegacyEvidenceItem` contract and adapting
   it honestly would require a dedicated future adapter, so it is
   intentionally not invoked in Increment 7 and `result.evidence`
   truthfully remains an empty array.
8. Aggregate all issues/limitations, tag each with its originating stage,
   and return one `CanonicalDataTrustOrchestrationResult`.

The Orchestrator performs no persistence, no cache write, no audit-log
write, no mutation, no engine-manifest status change, and no lifecycle
transition — it only calls already-existing, unmodified pure adapters and
one already-existing legacy read function (via the outer adapter), and
returns data.

## 9. Outer adapter responsibilities (Decision C / ADR-018)

`fetchLegacyDataTrustForSite(siteId, db = getWritableDb())`:

- Calls `dataTrustForSite(db, siteId, false)` — the third argument is a
  literal `false`, never omitted (which would default to `true`), never a
  variable that could evaluate to `true`.
- Returns `null` when the site does not exist (`dataTrustForSite` itself
  returns `null` for that case — passed straight through).
- Otherwise narrows the real return value to
  `{ site: SiteRow; trust: LegacyDataTrustResult }` — `LegacyDataTrustResult`
  is Increment 4's own already-exported type
  (`services/intelligence-adapters/data-trust-score-adapter.ts`), reused
  verbatim, not redeclared.
- Performs no canonical translation (no `toIdentifier`, no `Score`/
  `Recommendation` construction) and no HTTP projection — exactly the
  "thin: fetch legacy data, call the pure translation function" rule
  `08_ADAPTER_STRATEGY.md` states for this category, restated for a
  module that itself calls no translation function directly (the
  Orchestrator calls the pure adapters; this module's only job is the
  fetch).
- Uses `getWritableDb()` (the same acquisition helper the legacy route
  uses), **not** `getDb()`'s read-only-pragma connection. This is a
  deliberate choice, empirically verified (post-audit fix — see Section 13
  for the full, prominent disclosure this reasoning deserves, not just a
  mention here): `dataTrustForSite()` unconditionally calls
  `ensureDataTrustTables(db)` regardless of the `persist` argument, and a
  live experiment against an isolated `node:sqlite` database (never the
  project's real `DATABASE/`) confirmed that a `PRAGMA query_only = ON`
  connection throws `"attempt to write a readonly database"` when that
  function's `CREATE TABLE IF NOT EXISTS` statement runs against a
  database where the table does not yet exist — it is only a true,
  silent no-op once the table already exists. `getDb()` would therefore
  make this endpoint crash outright on any database instance where Data
  Trust's tables have never been initialized, which `getWritableDb()`
  does not. The genuinely-read-only guarantee this increment requires for
  *business data* comes from the explicit `persist=false` argument,
  confirmed by direct source inspection to skip both `INSERT` statements
  and the `recordAudit` call entirely — not from the SQLite connection's
  own write permissions, which this path does not rely on for that
  guarantee.

## 10. Projection adapter responsibilities (Decision E)

`projectCanonicalDataTrustResponse(result)`: pure mapping from
`CanonicalDataTrustOrchestrationResult` (the Orchestrator's return type,
imported type-only) to `DataTrustCanonicalEnvelope` (Section 6). No
database access, no call to `dataTrustForSite`, no import of route code,
no authentication, no environment-variable reads, no `Date.now()`, no
random values, no mutation of its input, no fabricated field — every field
is a direct, stable rename/reshape of a field the Orchestrator already
produced. The caller (`handler.ts`) must never call this function for a
`notFound: true` result — that state is mapped to an HTTP 404 before
projection is ever attempted (Section 6, Section 12), so this function
never needs to represent it.

## 11. Authentication behavior

Reuses `requireAdminAuth` (`lib/auth-guard.ts`, Increment 0) verbatim —
the strongest existing mechanism in the repository, applied before any
Orchestrator call, matching the same fail-closed, sanitized-error
discipline already proven by `tests/auth-guard.test.ts`.

**Authentication ordering (post-audit fix):** `route.ts`'s `GET` checks
`requireAdminAuth(request)` first, and returns its response immediately
on failure — strictly before the dynamic `import()` of the real,
DB-touching Orchestrator wiring (Section 4). An earlier version of this
route performed the dynamic import unconditionally, then checked auth
inside `handler.ts` afterward; an independent audit found that ordering
meant the Orchestrator/outer-adapter/legacy-engine module graph was
resolved for every request, including unauthenticated ones. `handler.ts`
no longer performs or accepts an authentication dependency at all — it
only ever runs for an already-authorized request, so there is no double
authentication check.

**Known,
explicitly-carried-forward limitation** (already recorded in
`23_INCREMENT_6_5_ARCHITECTURAL_DECISIONS.md` Decision F, restated here):
`requireAdminAuth` is a shared-secret mechanism scoped to the "Privileged
recalculation" role class, coarser than the "authenticated-read" class
`10_SECURITY_BOUNDARY.md` assigns this endpoint. Reusing it here is a
deliberate, documented, conservative stand-in — not a new, weaker
authentication subsystem — per the frozen decision's own instruction not
to design new authentication in this increment.

## 12. Error mapping

| Condition | Status | Body |
|---|---|---|
| `requireAdminAuth` rejects | whatever it returns (401 or 503) | its own sanitized body, untouched |
| `id` query param missing/blank | 400 | `{ "error": "Missing or invalid 'id' parameter." }` |
| `id` not a positive integer | 400 | same |
| Site not found | 404 | `{ "error": "Site not found." }` |
| Site/Score/Recommendation adaptation did not succeed (`adaptation.success: false`) | 422 | envelope still returned, with `result.score`/`recommendations` empty/partial and `adaptation.issues` populated — a well-formed request against a real Site whose data cannot be fully adapted is not a client error nor a missing resource |
| Unexpected exception | 500 | `{ "error": "Data Trust intelligence assessment unavailable." }`, logged server-side only as `console.error("intelligence_data_trust_site_failed", error instanceof Error ? error.name : "unknown")` — matching `system-health`/legacy routes' existing sanitized-disclosure convention, no stack trace or message ever forwarded to the client |

## 13. Side-effect prohibitions, and the precise read-only classification

No module in this increment persists a business-data row, writes to
cache, writes an audit log, mutates the Runtime Registry, or changes any
manifest's `status`. This is enforced by `persist=false` (Section 9),
confirmed by direct source inspection of `services/data-trust-engine.ts`
to gate both `INSERT` statements and the `recordAudit` call behind a
single `if (persist)` block that this path never enters.

**This canonical path is not, however, unconditionally free of every SQL
write statement, and this document does not claim that it is** (post-audit
fix — an earlier version of this document's "read-only" language did not
carry this qualification prominently enough):

1. `dataTrustForSite(db, siteId, false)` skips business-data `INSERT`
   operations, audit recording, and every write gated behind the
   `persist` branch.
2. It still unconditionally reaches `ensureDataTrustTables(db)` — this is
   not skipped by `persist=false`, because `persist` only gates the
   function's own final `if (persist) { ... }` block, not its first line.
3. On a database where `site_trust_scores`/`site_validation_history`/
   `site_evidence_center` do not yet exist, `ensureDataTrustTables` will
   execute `CREATE TABLE IF NOT EXISTS` for each — a genuine schema write.
   Empirically confirmed (isolated `node:sqlite` experiment, never against
   the project's real database): this statement requires a writable
   connection specifically in that fresh-schema case; against a database
   where the tables already exist, it is confirmed to be a true, silent
   no-op.
4. Therefore: this path is **logically read-only for business data**
   (never inserts, updates, deletes, or audits a row) and **technically
   capable of a one-time schema write** — it is only fully a no-op at the
   schema level once the required tables already exist on the target
   database. It is not "genuinely read-only" in the strict, unqualified,
   zero-SQL-write-statement sense; it is read-only in the sense Principle 6
   and ADR-008 actually care about (no business-data persistence
   riding along on a GET), which this path fully satisfies.
5. `getDb()`'s `query_only` connection cannot be substituted to close this
   gap, because the legacy initializer (`ensureDataTrustTables`) is
   unconditional — doing so would make the route fail outright against
   any database instance that has never had Data Trust's schema
   initialized, which is strictly worse than the disclosed, bounded
   schema-write this section describes.
6. This is **inherited legacy behavior**, not a persistence feature this
   increment introduces: every existing consumer of `dataTrustForSite`
   (the legacy `/api/data-trust/site` route, the dashboard, the CSV
   export, `recalculateDataTrust`) already triggers the identical
   `ensureDataTrustTables` call on every invocation, and always has.
   Principle 2 (wrap legacy code, don't modify it) forbids removing this
   call from the wrapped function as part of an adapter increment.

Full proof: Section 15 (this document) and the mission's own Step 15
(executed; see the independent audit's Section 7 for the isolated
experiment's exact results).

## 14. Explicit non-goals

No migration of existing callers; no replacement of the legacy route; no
persistence; no cache writes; no runtime registry activation; no
background execution; no scheduler; no dual execution yet; no tolerance
comparison yet; no UI changes; no database schema changes.

## 15. Test plan

- **A. Snapshot Provider** — pure unit tests: `dataImportacao` preferred;
  whitespace trimmed; `"Não informado"` placeholder treated as absent for
  both fields (the repository-specific finding, Section 7); `arquivoOrigem`
  fallback; fixed synthetic fallback; deterministic repeated output; no
  `Date.now()`/random dependency (source-inspected); correct
  derived/synthetic disclosure; null/undefined/blank handling.
- **B. Outer adapter** — source-inspection contract tests only (Section 9
  explains why a real behavioral test is not written, consistent with
  this repository's existing, universal convention of never Vitest-testing
  a `node:sqlite`-touching module directly): proves `persist=false` is a
  literal, never omitted; proves no canonical construction (`toIdentifier`,
  `Score`, `Recommendation`) appears in the file; proves it imports
  `dataTrustForSite` and `getWritableDb`, not `getDb`.
- **C. Orchestrator** — pure unit tests against `createDataTrustOrchestrator`
  with an injected fake `fetchLegacyDataTrustForSite` and the **real**
  Site/Score/Recommendation/Snapshot pure functions (mocking only the one
  genuinely DB-touching seam): call ordering; `CalculationContext`
  construction and validation; Snapshot integration; Score/Recommendation
  invocation; issue/limitation aggregation; deterministic output given an
  injected clock; not-found handling; Site-adaptation-failure handling;
  no persistence/cache/audit side effects (nothing in the pure core could
  perform any — verified by construction, no such dependency is even
  injectable).
- **D. Projection adapter** — pure unit tests: exact `schemaVersion`/
  envelope shape; Score primary; Evidence always `[]`; Recommendation
  mapping; Snapshot disclosure; issues/limitations mapping; no input
  mutation; deterministic; no fabricated fields.
- **E. Route** — behavioral tests against an exported, injectable handler
  function (Section 4's testability note applied identically to the
  route): unauthorized fails closed; missing/invalid `id`; not found;
  success; exact content type; exact `schemaVersion`; sanitized 500; and
  contract tests (source-inspection) proving the route never imports
  `dataTrustForSite`/`lib/db` at module top level and does reference the
  Orchestrator.
- **F. Contract/dependency tests** — source-inspection, extending the
  established pattern: no direct legacy-engine import in the route or
  projection adapter; outer adapter isolated from pure translators;
  manifests still `"planned"`; no app/UI file references the new route.
- **G. Side-effect regression** — proves the legacy route file is
  byte-for-byte unchanged (`git diff` empty for that path) and that no
  new file writes to `site_trust_scores`/`site_validation_history`/audit
  tables (source-inspection: no `INSERT`/`recordAudit` call appears
  anywhere in the new files).

## 16. Acceptance criteria

- All test categories A–G pass.
- `git diff --check`, `npx tsc --noEmit`, `npm test`, `npm run build` all
  pass with zero new errors.
- `app/api/data-trust/site/route.ts` has zero diff.
- `data-trust`/`recommendation` manifests remain `status: "planned"`.
- No file outside this increment's declared list is touched.

## 17. Known limitations

- `result.evidence` is always `[]` — the legacy Data Trust result nests
  satellite/Copernicus sub-data (`evidenceLevel`/`scene`/`lastSceneDate`/
  `validationRecommendation`, via `confidenceForSite → satelliteValidationForSite`)
  that is not fabricated into canonical Evidence here because it does not
  match the existing Evidence Adapter's required input shape and would
  need a new, purpose-built adapter to translate honestly (Section 6). Not
  "no evidence data exists" — evidence-shaped data exists but is out of
  this increment's scope to adapt.
- **This canonical path can execute a one-time `CREATE TABLE IF NOT EXISTS`
  schema write** (via the wrapped `ensureDataTrustTables()`) the first time
  it — or any other existing consumer of `dataTrustForSite` — is exercised
  against a database instance where Data Trust's tables have never been
  initialized. Empirically confirmed via an isolated `node:sqlite`
  experiment (Section 13); inherited legacy behavior, not introduced by
  this increment, and never a business-data write. Once those tables
  exist, this path is a true no-op at the schema level on every
  subsequent call.
- The Snapshot is synthetic/derived from import metadata, not a real
  persisted Snapshot entity (ADR-017; a real mechanism is `09_PERSISTENCE_AND_HISTORY.md`
  future work).
- Authentication reuses a coarser-than-ideal shared-secret mechanism
  (Section 11); a properly-scoped authenticated-read mechanism remains
  future work.
- `GLOBAL_RULE`-class `RecommendationId` collisions (Increment 6's own
  documented limitation) do not apply here — this path only ever produces
  `DATA_TRUST_TEXT`-type recommendations, one per Site, keyed by that
  Site's own `EntityReference.id`, which is unique per Site.
- The outer adapter's direct DB behavior is not covered by a Vitest
  behavioral test (Section 15.B) — consistent with, not a deviation from,
  this repository's existing testing conventions for `node:sqlite`-touching
  code.

## 18. Deferred work for Increment 8

Shadow mode, dual execution, and output-comparison sampling against the
legacy `dataTrustForSite(..., true)` path, per `13_MIGRATION_STRATEGY.md`
stages 1–3 — none of that is attempted here; this increment adds the
isolated endpoint only, per Decision D's clarified sequencing.

## 19. Rollback

Delete the six files listed in Section 4; revert any export additions to
`services/intelligence-adapters/index.ts`; delete this document. Nothing
else is touched — `services/intelligence/**`, every legacy engine, every
existing route, and `config/capabilities.json` remain untouched.
