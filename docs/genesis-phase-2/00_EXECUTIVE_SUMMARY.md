# 00 — Executive Summary (Genesis Phase 2.0 — Architecture Consolidation)

**Status:** Documentation-only mission. No source code, API, database schema, dependency, or persisted data was modified to produce this document set. Architecture frozen: **Yes**, subject to the baseline caveat below.

**Baseline caveat (restated, applies to the whole document set):** `device_bash` was unavailable throughout this mission, exactly as it was throughout the preceding Genesis Phase 2 pre-implementation audit. Per this mission's own Step 1 fallback rule, no command output was simulated or inferred. The user explicitly provided and authorized reliance on the same native baseline used in the prior audit (branch `master`, commit `06c7d3f`, tag `genesis-phase-1-v1`, clean working tree, `tsc` PASS, 205/205 tests PASS, production build PASS) as trusted input for a documentation-only continuation. That baseline is **user-asserted, not independently re-verified in this session** — this document set treats it as given, consistent with the pre-implementation audit's own disclosure.

## Why Phase 2.0 exists

The pre-implementation audit (`docs/GENESIS_PHASE_2_PRE_IMPLEMENTATION_AUDIT.md`) established, from direct repository evidence, that Genesis Phase 1's canonical contract layer (`services/intelligence/**`) has **zero production consumers** — a complete, well-formed set of types and validators that nothing in the running application calls. It also found a working, uncoordinated legacy engine layer (`services/*-engine.ts`) that already computes trust, confidence, quality, and duplicate signals in production, a proven pure/adapter split in exactly one subsystem (`services/geospatial/**`), a naming collision with an unrelated third subsystem (`sentinel-core/**`), and two concrete defects (GET-with-persisted-side-effects on two routes; no authentication anywhere in `app/api/**`). Phase 2.0 exists because implementing Phase 2 directly onto that foundation — without first resolving *how* the canonical layer will actually reach production code — would repeat the pattern that left Phase 1 unconsumed. This mission designs and freezes that "how" before any adapter, orchestrator, or endpoint is written.

## What was decided

Seventeen documents now define, at a binding level of detail, how the canonical `services/intelligence/**` layer will be connected to the running application without rewriting or breaking anything that exists today: architectural principles (`01`), the canonical domain model and the Trust/Confidence/Quality/Risk semantic freeze (`02`), the intelligence pipeline (`03`), engine lifecycle (`04`), a single orchestrator (`05`), a conventional (non-event-sourced) domain event model (`06`), a code-plus-derived-JSON engine manifest format (`07`), an eight-category adapter strategy with the first five adapters detailed (`08`), a persistence and history design (`09`), a six-role security boundary (`10`), a no-third-party observability model (`11`), current- and target-state dependency graphs with five forbidden target dependencies (`12`), a seven-stage per-capability migration strategy (`13`), a thirteen-increment implementation roadmap (`14`), fifteen Architecture Decision Records (`15`), and quality gates binding every future increment (`16`).

## What remains unchanged

No file outside `docs/genesis-phase-2/` was modified. Every legacy engine (`services/*-engine.ts`), every existing route (`app/api/**`), the database schema, `config/*.json`, `package.json`, and `sentinel-core/**` remain exactly as the pre-implementation audit found them. No adapter, orchestrator, authentication mechanism, or new endpoint exists yet — this mission designed them, it did not build them.

## What Phase 2 implementation may now begin

`14_IMPLEMENTATION_ROADMAP.md`'s Increment 0 (native baseline re-verification plus a minimal security floor on the two highest-risk unauthenticated write routes) may begin once a future mission is explicitly chartered for implementation. This document set is the binding reference that increment — and every increment after it — must build against.

## Blockers

1. **Native baseline re-verification.** This entire mission, like the audit before it, ran without `device_bash`. Before any implementation increment begins, the native `tsc`/test/build sequence must actually be re-run on `leonidas-pc` and its real output recorded — not carried forward again as an assertion.
2. **Mission authorization.** This mission's own closing instruction is to stop after documentation and verification. A separate, explicitly chartered implementation mission is required before Increment 0 starts.

No other blocker was identified — the seventeen documents resolve every open architectural question the pre-implementation audit raised.

## First implementation increment

`14_IMPLEMENTATION_ROADMAP.md` Increment 0 — native baseline verification and security floor (auth check on `POST /api/data-trust/recalculate` and `POST /api/sentinel-core/build`).

## Go/no-go recommendation

**Go**, conditional on Blocker 1 (native re-verification) being satisfied before Increment 0's other half (the security floor) is considered complete — the two halves of Increment 0 are independent and re-verification does not need to block starting the security-floor work, only completing the increment's acceptance criteria.

---

## Required Architectural Decisions — explicit answers

1. **What is the canonical Site model, and how does it relate to `core/site.ts`, `api/site-query.ts`, and `services/site-service.ts`?** `services/intelligence/entities` defines the canonical `BaseEntity`-derived Site shape (Phase 1, already frozen, not re-opened by this mission). `core/site.ts` (raw row shape), `api/site-query.ts` (`SITE_SELECT`/`SITE_SELECT_COLUMNS`), and `services/site-service.ts` (`siteRow()`) remain the legacy data-access path, unchanged. The relationship is adapter-mediated: the Site Entity Adapter (`08_ADAPTER_STRATEGY.md` adapter #1, `14_IMPLEMENTATION_ROADMAP.md` Increment 3) is the *only* code permitted to translate a legacy site row into a canonical `EntityReference<"Site">`/Site entity. No other new code performs this translation independently (`02_CANONICAL_DOMAIN_MODEL.md`'s overlap-resolution table).

2. **What is the official intelligence pipeline all engines must follow?** The sixteen-stage pipeline in `03_INTELLIGENCE_PIPELINE.md`, run by the single `IntelligenceOrchestrator` (`05_ORCHESTRATION_MODEL.md`). It applies to every canonical-path execution; legacy engines invoked directly by existing routes are not retrofitted onto it (Principle 4 — no existing route's behavior changes).

3. **What precisely distinguishes Data Quality from Data Trust from Confidence from Risk, and is a Risk Score in scope for Phase 2?** Frozen in `02_CANONICAL_DOMAIN_MODEL.md`: Data Quality measures record completeness/correctness against fixed rules (`data-quality-engine.ts`, engine-independent of any specific site's trust); Trust is `data-trust-engine.ts`'s `trustScore` — a site-level composite that consumes Confidence as its dominant input; Confidence, despite its name, is semantically a **Trust input** in the existing code (`confidence-engine.ts`'s actual behavior), a mismatch explicitly recorded as ADR-004 rather than silently resolved; Risk has no existing engine — `02_CANONICAL_DOMAIN_MODEL.md` reserves the concept but a Risk Score is **explicitly out of scope for Phase 2.0 and not scheduled in `14_IMPLEMENTATION_ROADMAP.md`** (listed under postponed work).

4. **What is the canonical score scale, and how do legacy 0–100 scores map to it?** Canonical `Score.value` is 0–1 (`02_CANONICAL_DOMAIN_MODEL.md`, matching Phase 1's existing contract). Legacy engines return 0–100. The conversion is mechanical: `canonical = legacy / 100`, applied by each adapter, with exactly one conversion function per legacy engine reused by every adapter that needs it (`12_DEPENDENCY_GRAPH.md` forbidden-dependency rule 5).

5. **Who is responsible for orchestrating engine execution — a single orchestrator, or per-engine self-orchestration?** A single `IntelligenceOrchestrator` (`05_ORCHESTRATION_MODEL.md`), instantiated once as a singleton living in a new `services/intelligence-runtime/` module. No per-engine self-orchestration.

6. **May engines call other engines directly, or must all cross-engine interaction go through the orchestrator?** All cross-engine interaction in the **canonical** layer goes through the orchestrator (`12_DEPENDENCY_GRAPH.md` forbidden dependency 3). Existing legacy-to-legacy direct calls (e.g. `data-trust-engine.ts → confidence-engine.ts`) are grandfathered, not extended, and not replicated in any new code (Principle 11).

7. **What exactly gets persisted vs. computed on demand, for every engine output?** Defined per data classification in `09_PERSISTENCE_AND_HISTORY.md`: current-state results persist (mirroring existing tables like `site_trust_scores`); full historical versioning of every calculation is a deliberate future capability (Increment 9), not built in Phase 2.0; canonical-path reads default to non-persisting (`persist=false`) until a capability completes migration stage 3 (`13_MIGRATION_STRATEGY.md`).

8. **How is calculation history versioned — every run, or only meaningful changes?** `09_PERSISTENCE_AND_HISTORY.md` proposes version-traceability columns (engine version, manifest version, correlationId) added at Increment 9; the mission does not resolve "every run vs. only meaningful changes" as a single global rule — it is deferred to Increment 9's own design, which must choose per the actual write volume observed, flagged as an open operational decision rather than architecturally pre-committed (consistent with `13_MIGRATION_STRATEGY.md`'s treatment of coexistence duration).

9. **Are domain events required for every engine execution, or only for state transitions?** Domain events are required for pipeline-level and engine-execution-level state transitions (`PipelineCompleted`/`PipelineFailed`/`EngineExecutionFailed`, etc. — the thirteen events catalogued in `06_EVENT_MODEL.md`), not for every internal computation step. This is Option 2 (conventional persistence of meaningful events), not full event sourcing.

10. **Is full event sourcing justified, or is conventional persistence with an audit trail sufficient?** Conventional persistence with an audit trail is sufficient and is the decision (`06_EVENT_MODEL.md`, ADR-006 in `15_ARCHITECTURE_DECISIONS.md`) — full event sourcing is not justified at this system's scale (single-process, single-database, no other consumers of an event stream), per Principle 17.

11. **Where do engine manifests live — in code, in `config/*.json`, or both?** Both: TypeScript is the source of truth (`services/intelligence/registry` or `services/intelligence-runtime/`, per `07_ENGINE_MANIFEST.md`'s type definition), with a derived JSON representation generated from it for any tooling/UI that needs a data-only view — never a hand-maintained JSON file that could drift from the code.

12. **Where does the runtime `EngineRegistry` instance live, and who is allowed to register engines into it?** A singleton in `services/intelligence-runtime/registry-instance.ts` (`05_ORCHESTRATION_MODEL.md`, `14_IMPLEMENTATION_ROADMAP.md` Increment 2). Only manifest-declaring adapter modules register into it at module load; no runtime/dynamic registration from request-handling code.

13. **How do legacy engines coexist with canonical adapters during migration — wrapped, replaced, or run in parallel?** Wrapped, then run in parallel (shadow mode → dual execution, `13_MIGRATION_STRATEGY.md` stages 1–2) before ever being trusted; never replaced outright. Legacy engine source files are not modified (Principle 2) — adapters call them as-is.

14. **How do canonical results reach the existing API layer — new endpoints, response transformation, or both?** New, additive-only endpoints only (`13_MIGRATION_STRATEGY.md` stage 4, e.g. `GET /api/intelligence/data-trust/site`). Existing endpoints are never transformed in place to return canonical shapes — that would break existing callers (Principle 4).

15. **How are old APIs migrated to the canonical model without breaking the existing UI?** The seven-stage strategy in `13_MIGRATION_STRATEGY.md`: shadow mode, dual execution, output comparison against a documented tolerance, additive canonical endpoint, feature-flagged UI migration, legacy deprecation only after a proven zero-rollback coexistence period, and legacy retirement only after measured zero traffic — each stage individually reversible until deprecation.

16. **What security boundary applies to every operation, even if authentication is not implemented yet?** The six-role classification in `10_SECURITY_BOUNDARY.md` (public read, authenticated read, privileged recalculation, privileged export, administrative engine operation, system-only batch operation) applies to every operation's *classification* immediately — every route already has a designated role in this mission's mapping table — even though *enforcement* does not exist until Increment 0 and is extended incrementally after.

17. **What observability is mandatory for every engine execution, even before a monitoring platform exists?** Per `11_OBSERVABILITY_MODEL.md`: structured (JSON-shaped) logging with `correlationId`, `ExecutionMetadata` (duration, notes) persisted to a conventional record (not just embedded in the returned Score), and events for failures/completions — all built on the existing `console.error`/SQLite pattern, no third-party platform required.

18. **What is the long-term role of `sentinel-core/`, if any, in the canonical architecture?** `sentinel-core/**` remains a separate, coexisting subsystem (the "Sentinel Intelligence Graph") — not consolidated into `services/intelligence/**`, not retired by this mission (ADR-013, `15_ARCHITECTURE_DECISIONS.md`). Its fate (build out for real vs. formally retire the expectation) is explicitly deferred to a future, separately-scoped decision, named in `14_IMPLEMENTATION_ROADMAP.md`'s postponed-work list.

19. **How does the capability registry (`config/capabilities.json`) stay truthful as canonical adapters are introduced?** It is updated only at migration stage 6 (deprecation), not earlier (`13_MIGRATION_STRATEGY.md`) — a capability is never marked more "operational" than it actually is merely because a shadow computation or an untrafficked canonical endpoint exists (Principle 16, "don't advertise before true, in either direction").

20. **What must be true before Implementation Increment 1 may begin?** Per `14_IMPLEMENTATION_ROADMAP.md`: Increment 1 *is* the architecture freeze itself, so its own precondition is that every required decision above has a recorded, non-vague answer (satisfied by this document) — and per Increment 0's dependency ordering, the native baseline must have been actually re-verified (Blocker 1 above) and the minimal security floor on the two named routes must be in place before the roadmap's substantive canonical-code increments (2 onward) begin.

---

*End of Genesis Phase 2.0 document set (17 files, `docs/genesis-phase-2/`). Mission scope: documentation only. No Phase 2 implementation was performed.*
