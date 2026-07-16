# 05 — Orchestration Model (Genesis Phase 2)

## The main rule

Engines must not call one another through hidden direct dependencies. This document defines the one canonical orchestration model that replaces that pattern for **new** code; it does not retroactively rewire existing legacy call chains (Principle 11, `01_ARCHITECTURE_PRINCIPLES.md`).

## Decision: one generic orchestrator (not multiple, not a hybrid)

**Decision:** a single `IntelligenceOrchestrator`, generic across all engines, not one orchestrator per bounded context (e.g. not a separate "Trust Orchestrator" and "Geospatial Orchestrator").

**Why, based on the repository, not abstract preference:**
- Scale: ~15 engines, one database, one deployment target, one Next.js process. Multiple orchestrators would each need their own dependency-resolution and failure-isolation logic — duplicated infrastructure for no repository-demonstrated benefit (Principle 17: no abstraction without a concrete consumer; nothing in this codebase needs bounded-context isolation at the orchestration layer today).
- Precedent: the one subsystem that already has an internal "orchestrator-shaped" module — `sentinel-core/engine.ts` — is itself a single, flat set of exported functions delegating to `graph-builder`/`graph-query`/`inference-engine`/`recommendation-engine`, not a per-concern split. This repository's own existing pattern, where one exists, is unified, not federated.
- The stages in `03_INTELLIGENCE_PIPELINE.md` are largely sequential and interdependent (Trust depends on Confidence depends on Satellite Validation depends on Copernicus) — a single orchestrator can express that dependency chain directly; splitting it across multiple orchestrators would require an orchestrator-to-orchestrator protocol, which is strictly more machinery for the same problem.

**Revisit trigger:** if a future engine family (e.g. a real Machine Learning engine with its own training/serving lifecycle, genuinely disjoint from the SQL-query-shaped pipeline above) needs orchestration primitives the generic model doesn't fit, split at that point — not preemptively.

## `IntelligenceOrchestrator` responsibilities

1. **Execution plan construction** — given a requested `EngineId` (or a named pipeline like "single-site full assessment"), resolve the ordered/parallel set of stages to run, consulting each involved engine's manifest `dependencies` field (`07_ENGINE_MANIFEST.md`).
2. **Dependency resolution** — verify every declared dependency is `ready` (per `04_ENGINE_LIFECYCLE.md`) before starting; refuse to start (not degrade silently) if a hard dependency is `failed`/`disabled`.
3. **Stage sequencing** — runs `03_INTELLIGENCE_PIPELINE.md`'s stages in dependency order. Today's real chain (Trust → Confidence → Satellite Validation → Copernicus) becomes an explicit sequence the orchestrator drives, once those stages are behind adapters — not before (Principle 11's grandfather clause).
4. **Parallel-safe stages** — stages with no data dependency on each other (e.g. Coordinate Validation and Duplicate Detection for the same Site, once Stage 6 → Stage 4 wiring exists per `03_INTELLIGENCE_PIPELINE.md`) may run concurrently; the orchestrator determines this from the manifest's declared inputs/outputs, not from hardcoded stage-pair knowledge.
5. **Failure isolation** — one stage's failure (`04_ENGINE_LIFECYCLE.md`'s `failed` state) must not corrupt or silently proceed past a dependent stage; the orchestrator marks the dependent stage's execution as `failed` with a clear causation link (`causationId`, `06_EVENT_MODEL.md`), never substitutes a default value (Principle 5/the "unknown vs. zero" rule).
6. **Timeout handling** — every stage execution carries a timeout (value TBD per engine in its manifest, not fixed globally — a full-dataset batch stage legitimately needs a longer timeout than a single-Site preview); a timed-out stage is `failed`, not silently retried indefinitely.
7. **Cancellation** — a `Pipeline Run` (`02_CANONICAL_DOMAIN_MODEL.md`) may be cancelled mid-execution; already-completed stage results are not discarded (partial completion, below).
8. **Correlation IDs** — the orchestrator generates one `correlationId` per Pipeline Run and threads it through every `CalculationContext.correlationId`/`ExecutionMetadata` it constructs, so `11_OBSERVABILITY_MODEL.md`'s tracing can reconstruct the whole run from any one stage's log line.
9. **Execution metadata** — the orchestrator, not the individual engine, is responsible for stamping `executedAt`/`durationMs` onto `ExecutionMetadata` — engines report their own computation; the orchestrator wraps it with the surrounding context. (Engines may still report internal sub-timings into `notes`.)
10. **Persistence policy** — the orchestrator, not each engine ad hoc, decides *whether* a given run's results are persisted, based on the caller's requested mode (preview vs. persisted recalculation, `03_INTELLIGENCE_PIPELINE.md`) — this directly fixes the architectural root cause of the GET-side-effect problem (Section 9/16, pre-implementation audit): once the orchestrator owns this decision, no individual adapter can independently decide to write on a read request.
11. **Dry-run mode** — computes and validates a full plan (dependency graph, stage list) without executing any stage — useful for `16_QUALITY_GATES.md`'s pre-deployment checks.
12. **Replay mode** — re-executes a past Pipeline Run's plan against the *same* declared `Snapshot` (`02_CANONICAL_DOMAIN_MODEL.md`) for reproducibility/debugging — depends on Snapshot support existing (currently minimal, per the domain model document); until then, replay mode can only guarantee "same code, same config, current data," not true point-in-time replay, and must say so.
13. **Partial completion behavior** — if stage 3 of 5 fails, stages 1–2's results are retained and marked `completed`; stages 4–5 are marked `skipped` (a new, explicit outcome distinct from `failed`) rather than left ambiguous.
14. **Dependency graph validation** — at orchestrator startup (or on-demand via a dry-run), verify no cycle exists among registered engines' declared dependencies — a structural safety net directly enforcing Principle 10/11 rather than trusting manifests by convention.

## Where the orchestrator lives, and where `EngineRegistry` lives

Per Phase 1's own explicitly-left-open question ("where does an `EngineRegistry` instance live at runtime?") and mission requirement #12: **decision — a module-level singleton**, instantiated once in a new `services/intelligence-runtime/` module (not inside `services/intelligence/` itself, preserving Principle 13 — the contract layer stays a library, not a runtime singleton holder). The `IntelligenceOrchestrator` is constructed in the same module, taking the singleton `EngineRegistry` as a constructor dependency (not a second, independent registry instance) — one registry, one orchestrator, both explicit, both testable by constructing fresh instances in tests rather than relying on the module-level singleton (which only production route handlers use).

**Why a singleton and not per-request or DI-container-managed:** the registry's own content (which engines exist, their declared metadata) does not vary per request — it is closer to static configuration than to request-scoped state. A DI container is exactly the kind of abstraction Principle 17 rules out absent a concrete need (this is a single Next.js app, not a multi-tenant or plugin-host system).

## Legacy coexistence

Existing routes calling legacy engines directly (all 27 routes read in the pre-implementation audit) are **not** routed through the `IntelligenceOrchestrator` in Phase 2.0 or its immediate implementation increments — they remain exactly as they are (Principle 4). The orchestrator's first real traffic is the new canonical endpoints introduced starting at Implementation Increment 7 (`14_IMPLEMENTATION_ROADMAP.md`).
