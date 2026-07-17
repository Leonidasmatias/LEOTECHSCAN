# 23 — Increment 6.5: Architectural Decision Pass / Roadmap Reconciliation

Documentation-and-architecture-only increment. No runtime code was added, no
API route was created, no database was touched, no engine was activated, and
nothing in this increment changes the observable behavior of any existing
route, adapter, or test. Its sole purpose is to resolve four blockers the
Increment 7 pre-implementation audit found, and to record the resolutions as
binding decisions before Increment 7's own implementation starts.

## 1. Origin

The Increment 7 pre-implementation audit (read-only, no files changed)
found four problems that a literal implementation of `14_IMPLEMENTATION_ROADMAP.md`'s
original one-paragraph Increment 7 description would either violate or
silently paper over:

1. No `IntelligenceOrchestrator` exists anywhere in the repository, yet
   `12_DEPENDENCY_GRAPH.md`'s forbidden dependency #3 already prohibits any
   new canonical route from calling a legacy engine directly, bypassing an
   Orchestrator that doesn't exist.
2. No Snapshot Provider exists, yet `CalculationContext.snapshot: SnapshotId`
   is a non-optional field of the real canonical context type.
3. The Data Trust Score Adapter (Increment 4) is, by its own header comment,
   only the pure inner translator — the DB-touching outer layer
   `08_ADAPTER_STRATEGY.md` originally specified beside it was deferred to
   "a later, separately-chartered increment," without that increment being
   named.
4. `13_MIGRATION_STRATEGY.md` and `14_IMPLEMENTATION_ROADMAP.md` sequence
   Stage 4 (Increment 7) before Stages 1–3 (Increment 8) — apparently the
   reverse of the migration strategy's own stated gating rule.

This document resolves all four, formally revises Increment 7's scope, and
records two further decisions (response shape, security) needed before that
increment can start.

## 2. Repository state at the time of this decision pass

```
toplevel : C:/LEOTECHSCAN/APP
HEAD     : 01f1bd5
branch   : master
tag@HEAD : genesis-phase-2-increment-6-v1
status   : clean
```

## 3. Decision A — Minimal read-only IntelligenceOrchestrator

**Approved direction, as specified by this mission:** Increment 7 must
include a minimal, read-only `IntelligenceOrchestrator`. Its initial
responsibility is limited to: receiving a canonical Data Trust site request;
obtaining the required legacy data through the approved outer adapter
boundary (Decision C); constructing the minimal canonical context (using
Decision B's Snapshot Provider); calling the existing pure canonical
adapters (Increments 4–6); returning a canonical result for projection
(Decision E). It performs no persistence, no cache writes, no audit-log
writes, no mutation, and no engine activation or lifecycle transition.

The new canonical route must call this Orchestrator. It must not call
`dataTrustForSite()` or any legacy engine directly. **No exception to the
dependency graph is approved** — `12_DEPENDENCY_GRAPH.md`'s forbidden
dependency #3 stands as written, unmodified by this pass.

Full rationale, alternatives considered, and revisit trigger: **ADR-016**,
`15_ARCHITECTURE_DECISIONS.md`.

**Scope boundary, restated for implementers:** this is *not* the full
`IntelligenceOrchestrator` described in `05_ORCHESTRATION_MODEL.md`
(execution-plan construction across many engines, parallel-safe stages,
cancellation, replay mode, dependency-graph-cycle validation at startup).
It is the minimum slice of that responsibility list needed for one use
case: "get canonical Data Trust assessment for one Site, read-only." The
full Orchestrator remains future work, generalized incrementally as more
canonical routes need it (revisit trigger in ADR-016).

## 4. Decision B — Minimal Snapshot Provider

**Approved:** a minimal, read-only Snapshot Provider for Increment 7,
producing a deterministic `SnapshotId` from already-existing source/import
metadata. Requirements (all binding):

- deterministic — same input always produces the same `SnapshotId`;
- never generates a random ID;
- never uses `Date.now()` as identity;
- never writes to the database;
- never fabricates a false persisted snapshot record — the result is
  always disclosed as synthetic/derived, never presented as a genuine
  persisted Snapshot;
- prefers the current import's `imported_at`/equivalent stable timestamp
  when available.

**Fallback policy (required by this mission's Decision B instruction, since
the repository was checked and does not guarantee a clean, always-present
import timestamp per Site):**

1. Prefer `siteRow().dataImportacao` (`data_importacao` column,
   `core/site.ts`'s `SITE_UNIFIED_COLUMNS`) when present and non-empty.
2. If absent, prefer `siteRow().arquivoOrigem` (`arquivo_origem`, the
   source import filename) when present.
3. If both are absent, use a fixed, documented literal —
   `"synthetic:no-import-metadata"` — never a random or time-based value.
   A result built on this fallback must carry a `Limitation`/metadata flag
   disclosing that no real import-time signal was available for this Site,
   consistent with the "adapters must not silently repair invalid data"
   rule (`08_ADAPTER_STRATEGY.md`).

Full rationale, alternatives considered, and revisit trigger: **ADR-017**,
`15_ARCHITECTURE_DECISIONS.md`.

## 5. Decision C — Data Trust outer layer

**Approved, added formally to Increment 7's scope:** the previously
deferred DB-touching outer layer for the Data Trust canonical path.

- May call `dataTrustForSite()` only with persistence disabled
  (`persist=false`) — never the legacy default (`persist=true`).
- Must be isolated from the pure canonical translators — it is a distinct
  module from `services/intelligence-adapters/data-trust-score-adapter.ts`.
- Must **not** be placed inside `api-projection-adapter.ts` — projection
  (canonical → HTTP JSON shape) and DB access (legacy fetch) are different
  adapter categories (`08_ADAPTER_STRATEGY.md` categories 2 and 6) and stay
  separate seams.
- Must expose a narrow, read-only interface consumed only by the
  Orchestrator (Decision A) — not called directly by the route, not called
  directly by the projection adapter.
- Must preserve the legacy route (`app/api/data-trust/site/route.ts`)
  completely unchanged — confirmed, as read this session, that route still
  calls `dataTrustForSite(getWritableDb(), id, true)` and this decision
  does not touch that file.

Full rationale, alternatives considered, and revisit trigger: **ADR-018**,
`15_ARCHITECTURE_DECISIONS.md`.

## 6. Decision D — Roadmap / Migration order reconciliation

**Approved clarification, not a rule change:** "Stage 3 blocks Stage 4"
(`13_MIGRATION_STRATEGY.md`) means Stage 3's comparison gates *activation* —
no existing caller may be switched onto the canonical endpoint, and the
canonical path may not become a default or replacement for anything —
until Stage 3 passes. It does **not** mean the mere existence of an
isolated, additive, zero-caller endpoint is forbidden before Stage 3
completes.

Under this clarification:

- Increment 7 may add an additive, authenticated, read-only canonical
  endpoint before Increment 8's shadow comparison is completed.
- The endpoint must remain non-default, non-replacement, and have no
  migrated callers for as long as Increment 8 has not passed.
- Increment 8 remains the mandatory shadow-mode / dual-execution /
  tolerance-comparison / migration-gate increment — nothing about this
  decision weakens or skips it.
- No existing caller may be switched to the canonical endpoint until
  Increment 8's comparison gates pass (this remains Increment 11's own
  precondition, unchanged).

This clarification has been written into both `13_MIGRATION_STRATEGY.md`
(Stage 3 and Stage 4 bullets) and `14_IMPLEMENTATION_ROADMAP.md`
(Increment 7 and Increment 8 entries), so the two documents read
consistently rather than one silently overriding the other. Full rationale,
alternatives considered, and revisit trigger: **ADR-019**,
`15_ARCHITECTURE_DECISIONS.md`.

## 7. Revised Increment 7 — Canonical Read-Only Data Trust Path

This section is the authoritative scope statement; `14_IMPLEMENTATION_ROADMAP.md`'s
Increment 7 entry has been rewritten to match it verbatim in substance.

**Required deliverables:**

1. Minimal read-only Snapshot Provider (Decision B).
2. Data Trust read-only outer adapter/service boundary (Decision C).
3. Minimal `IntelligenceOrchestrator` for Data Trust site requests (Decision A).
4. Pure API Projection Adapter.
5. Authenticated `GET /api/intelligence/data-trust/site`.
6. Unit tests.
7. Contract/dependency tests.
8. Route tests.
9. Side-effect regression tests (the legacy route unchanged).
10. Increment documentation.

**Explicit non-goals:**

- no migration of existing callers;
- no replacement of the legacy route;
- no persistence;
- no cache writes;
- no runtime registry activation;
- no background execution;
- no scheduler;
- no dual execution yet;
- no tolerance comparison yet;
- no UI changes;
- no database schema changes.

## 8. Decision E — Response shape

**Approved, conservative direction:** the first canonical endpoint returns a
versioned envelope containing:

- canonical `Score<"data-trust">` as the primary result;
- canonical `Evidence[]` only when truthfully derivable from the current
  legacy result — never fabricated to fill out the shape;
- canonical `Recommendation[]` only when truthfully derivable from the
  current legacy result;
- snapshot/context metadata (the Decision B `SnapshotId`, `contextId`,
  `correlationId`, disclosure of synthetic-snapshot status where
  applicable);
- limitations and adaptation issues (reusing the existing
  `RecommendationAdaptationIssue`-style structured-issue pattern
  established in Increments 4–6, not a new ad hoc error shape);
- no fabricated fields;
- no attempt to mirror the legacy response byte-for-byte — the legacy
  route's exact JSON shape is not a target, since that would recreate
  legacy-shape coupling in new code.

The exact schema (field names, envelope version number, whether
`evidence`/`recommendations` are always-present-but-possibly-empty arrays
versus omitted when not derivable) is **not fixed by this decision** — it
must be written out in full in Increment 7's own implementation document
before code is written, per this mission's Step 5 instruction. Canonical
domain contracts (`services/intelligence/**`) are not changed by this
decision, and are not expected to need changing for this envelope, since
the envelope is a projection *of* those contracts, not a replacement for
them; if implementation later proves a genuine contradiction, that is a
separately-reviewed contract change, not something to slip in silently
during Increment 7.

## 9. Decision F — Security

The new endpoint is:

- **authenticated read** (`10_SECURITY_BOUNDARY.md`'s role vocabulary) —
  not public;
- **read-only** — no `persist` parameter, hardcoded `false` at every layer
  (Decision A/C);
- **non-public** — must fail closed (401/403-class response) for
  unauthenticated requests, per the same fail-closed discipline already
  established in `lib/auth-guard.ts`'s `requireAdminAuth` (Increment 0);
- **no weaker than other protected intelligence endpoints** — concretely,
  as read this session, the only enforcement mechanism that currently
  exists at all is `requireAdminAuth`, a shared-secret check scoped to the
  coarser "Privileged recalculation" class (`POST /api/data-trust/recalculate`,
  `POST /api/sentinel-core/build`). No finer-grained "authenticated-read"
  mechanism exists yet. **Flagged, not silently resolved:** until a
  properly-scoped authenticated-read mechanism exists, Increment 7's
  implementation must not expose the route with weaker protection than
  `requireAdminAuth` provides today — reusing that same mechanism as a
  conservative stand-in is acceptable and is the recommended default,
  even though it is semantically coarser than "authenticated-read" ideally
  calls for. This mismatch is a revisit trigger for whenever a real
  role-based auth mechanism is designed (`10_SECURITY_BOUNDARY.md`'s own
  "Revisit trigger" already anticipates this).

This mission does not implement the route; this section records the
binding constraint the eventual implementation must satisfy.

## 10. Consistency audit

Full-repository search performed after all edits above, across
`docs/genesis-phase-2/**`, for: `Increment 7`, `Stage 3`, `Stage 4`,
`Orchestrator`, `Snapshot Provider`, `canonical endpoint`, `direct legacy
engine calls`/`bypassing the Orchestrator`, `caller migration`,
`activation`.

| Document | Relevant text found | Consistent? |
|---|---|---|
| `13_MIGRATION_STRATEGY.md` | Stage 3/4 bullets, now carrying the Decision D clarification inline | Yes |
| `14_IMPLEMENTATION_ROADMAP.md` | Increment 7 fully rewritten per Section 7 above; Increment 8 entry now cross-references the clarified gate | Yes |
| `15_ARCHITECTURE_DECISIONS.md` | ADR-016 (Orchestrator), ADR-017 (Snapshot Provider), ADR-018 (outer layer), ADR-019 (Stage 3/4) added; ADR-005 (centralized orchestration), ADR-008 (read-only GET), ADR-015 (legacy API coexistence) all still read consistently with the new ADRs — no contradiction found | Yes |
| `12_DEPENDENCY_GRAPH.md` | Forbidden dependency #3 ("any new canonical route calling a legacy engine directly, bypassing the Orchestrator") — unchanged, and now actually satisfiable, since Decision A requires the route to call the Orchestrator instead | Yes, no edit required |
| `05_ORCHESTRATION_MODEL.md` | "The orchestrator's first real traffic is the new canonical endpoints introduced starting at Implementation Increment 7" — unchanged, and now concretely true rather than aspirational, since Increment 7's scope now includes building that Orchestrator | Yes, no edit required |
| `08_ADAPTER_STRATEGY.md` | Adapter #2's two-half description ("thin DB-touching outer layer... plus a pure inner translator") and adapter #5's description — unchanged; both are now concretely scheduled (Decisions C/A/E) rather than left ambiguous about when the deferred half gets built | Yes, no edit required |
| `20_INCREMENT_4_DATA_TRUST_SCORE_ADAPTER.md` | "Deferred work" section listing "the DB-touching outer layer for this adapter" and "the Intelligence Orchestrator" — unchanged (historical record of Increment 4's own scope decision); both items are now picked up by name in Increment 7's revised scope (Section 7 above) | Yes, no edit required — historical document, correctly left as-is |
| `22_INCREMENT_6_RECOMMENDATION_ADAPTER.md` | GLOBAL_RULE collision limitation — unrelated to Increment 7's blockers, unaffected by this pass | Yes, no edit required |

No remaining contradiction was found across the searched terms after the
edits in Sections 3–6 above.

## 11. Stale manifest description (documentation metadata only)

`services/intelligence-runtime/canonical-engine-manifests.ts`'s
`RECOMMENDATION_MANIFEST.description` still read (before this pass) "no
canonical Recommendation Adapter exists yet ... This manifest declares the
concept only" — stale since Increment 6 built
`services/intelligence-adapters/recommendation-adapter.ts`. Verified before
editing: no test in `tests/**` asserts on this description string
(confirmed via search), and the field is a plain string with no effect on
`status`, `capabilities`, `capabilityKey`, or any other structurally- or
behaviorally-significant field. It is corrected in this pass to read
consistently with `DATA_TRUST_MANIFEST`'s own (already-updated-in-Increment-4)
description style. `status` remains `"planned"` — this edit does not
activate the engine, change its capability, or alter registry behavior in
any way; confirmed by the unchanged `npm test`/`tsc`/`build` results in
Section 13 below.

## 12. Rollback

Revert the edits to `13_MIGRATION_STRATEGY.md`, `14_IMPLEMENTATION_ROADMAP.md`,
`15_ARCHITECTURE_DECISIONS.md`, and
`services/intelligence-runtime/canonical-engine-manifests.ts`'s
`RECOMMENDATION_MANIFEST.description` string; delete this file. Nothing
else was created or modified by Increment 6.5.

## 13. Go/No-Go for Increment 7

**Go**, conditioned on the deliverable list in Section 7 being followed in
full — Increment 7 is no longer scope-understated, no longer in conflict
with the frozen dependency graph, and no longer in conflict with the
migration strategy's own gating language. The three previously-missing
prerequisites (Orchestrator, Snapshot Provider, outer adapter layer) are
now named, scoped, and decided rather than silently assumed away.
