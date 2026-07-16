# 01 — Architecture Principles (Genesis Phase 2)

These principles are binding for every Genesis Phase 2 implementation increment. Each is classified MUST / SHOULD / MAY / MUST NOT. A principle classified MUST cannot be waived by an individual increment; waiving it requires a new ADR (see `15_ARCHITECTURE_DECISIONS.md`) revisiting this document, not a one-off exception buried in a PR.

1. **Incremental evolution over rewrite.** — **MUST.** Every increment in `14_IMPLEMENTATION_ROADMAP.md` must leave the system shippable and the existing UI functional at every commit. No "big bang" cutover of an engine, a route, or the database is permitted. Rationale: the pre-implementation audit found every existing engine individually sound; the gap is wiring, not quality — a rewrite would trade a known-good legacy implementation for an unproven one.

2. **Adapters over direct legacy modification.** — **MUST**, with one **SHOULD**-level exception. New canonical behavior is added via adapters (`08_ADAPTER_STRATEGY.md`) that wrap existing engines, not by rewriting the engines themselves. The exception (SHOULD, not MUST, and only for the two specific items already named in the pre-implementation audit): externalizing hardcoded weights in `confidence-engine.ts`/`data-trust-engine.ts` into config, and consolidating the four duplicated Brazil-bounds checks onto `services/geospatial/brazil-bounds.ts`. Both are behavior-preserving refactors, not new logic, and were already scoped as Increments 1–2 in the prior audit.

3. **Pure domain logic separated from infrastructure.** — **MUST.** Every new module that computes something (a score, a classification, a validation result) must be importable and testable without `node:sqlite`, without Next.js, and without a live database. `services/geospatial/**`'s pure/adapter split is the enforced template (see `08_ADAPTER_STRATEGY.md`).

4. **Existing API compatibility until explicit migration.** — **MUST.** No existing route under `app/api/**` changes its request shape, response shape, or side-effect behavior as a side effect of Phase 2 work. Any change to an existing route is its own explicitly-scoped, explicitly-approved increment under `13_MIGRATION_STRATEGY.md`, never a byproduct of adapter work elsewhere.

5. **No hidden side effects.** — **MUST.** Every function that writes to the database, the filesystem, or the audit trail must make that fact discoverable from its name, its manifest (`07_ENGINE_MANIFEST.md`), or its signature — never solely from reading its body. This principle exists specifically because of the audit's finding that `dataTrustForSite`/`evidenceCenterForSite` persist by default from what look like read operations.

6. **GET requests must remain read-only.** — **MUST**, applied prospectively. Every new canonical endpoint defaults `persist=false`/equivalent and never writes on GET. The two existing offending routes (`/api/data-trust/site`, `/api/evidence-center/site`) are **not** silently fixed by this principle — fixing them is an explicit, separately-approved migration step (`13_MIGRATION_STRATEGY.md`), because Phase 2.0 is documentation-only and because fixing them changes existing API behavior (Principle 4).

7. **Every intelligence output must be explainable.** — **MUST.** Any value presented as a `Score` or `Recommendation` must carry non-empty `drivers`/`recommendedActions` with human-readable `explanation`/`rationale` text. An adapter that cannot populate `drivers` meaningfully must not claim the canonical contract — it should stay non-canonical until it can.

8. **Every persisted calculation must be versioned.** — **MUST**, for every *new* persisted table Phase 2 introduces (`09_PERSISTENCE_AND_HISTORY.md`). Not retroactive to existing tables in this phase (would require a schema migration, explicitly out of scope for Phase 2.0).

9. **Every calculation must be traceable to evidence and provenance.** — **MUST** for canonical (`services/intelligence`-shaped) output; **SHOULD**, not MUST, for legacy engines left unmigrated, since retrofitting full `DataProvenance` onto every legacy engine is a larger effort than Phase 2.0 can freeze a plan for in one pass.

10. **All engine dependencies must be explicit.** — **MUST.** Every engine's manifest (`07_ENGINE_MANIFEST.md`) declares the other engines/adapters it depends on. A dependency not in the manifest is a defect, full stop, regardless of whether it "happens to work."

11. **Engines must not call each other through hidden imports.** — **MUST NOT**, for any *new* engine or adapter. Existing direct legacy imports (Data Trust → Confidence → Satellite Validation → Copernicus; Evidence Center → Data Trust → Copernicus/Notes/Validation History) are grandfathered — documented in `12_DEPENDENCY_GRAPH.md` as legacy coupling — and MAY remain until the specific engines involved are migrated behind the orchestrator, not before and not silently extended to new code.

12. **Orchestration must be centralized.** — **MUST**, for canonical pipeline execution (`05_ORCHESTRATION_MODEL.md`). Legacy routes calling legacy engines directly remain outside the orchestrator's scope until migrated (Principle 4/11 interaction).

13. **Existing canonical contracts remain stable unless a proven blocker exists.** — **MUST.** `services/intelligence/**` is not modified casually (this restates `docs/genesis-phase-1/09_IMPLEMENTATION_GUIDE.md`'s own rule). A "proven blocker" means a concrete adapter, written and tested, that genuinely cannot express real engine output within the existing contract — not a hypothetical future need.

14. **Security is a boundary concern, not an afterthought.** — **MUST.** Every new canonical endpoint and every new privileged operation is designed against the security boundary in `10_SECURITY_BOUNDARY.md` from its first draft, even though the boundary's actual enforcement mechanism (authentication) is not implemented in Phase 2.0. "Designed against" means: the manifest declares the required role; the route is written so a future auth middleware can be inserted without a rewrite.

15. **Large-scale calculations must support bounded and resumable execution.** — **MUST**, for any new batch/full-dataset operation. No new code may attempt to process all ~299,308 sites in a single unbounded pass. This generalizes `services/geospatial`'s existing hard-cap pattern (`MAX_BBOX_LIMIT`, `MAX_CLUSTER_CANDIDATES`, chunked `IN (...)` batching) to every future engine.

16. **No capability may be advertised before it is operationally true.** — **MUST.** `config/capabilities.json` is the enforced source of truth (Principle restated in ADR form in `15_ARCHITECTURE_DECISIONS.md`); a capability's `status` field may not read `"operational"` until the corresponding engine/endpoint is actually wired, tested, and (per Principle 14) has a defined security boundary — matching the file's own stated purpose ("Single source of truth for what the LeoTechScan interface may claim").

17. **No new abstraction may be added without a concrete consumer.** — **MUST.** This is the principle that rules out full event sourcing (`06_EVENT_MODEL.md`), multiple bounded-context orchestrators (`05_ORCHESTRATION_MODEL.md`), and a generic plugin system for engines — none of which the current repository, at its current scale (~15 engines, one database, one deployment target), demonstrates a real need for. Every abstraction introduced in this document is justified against an existing, named consumer.

## How to use this document

Every subsequent document in `docs/genesis-phase-2/` must be readable as a direct consequence of these seventeen principles. Where a later document appears to conflict with one of them, the conflict must be resolved explicitly in `15_ARCHITECTURE_DECISIONS.md`, not silently.
