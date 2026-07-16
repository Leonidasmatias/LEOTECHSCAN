# 11 — Observability Model (Genesis Phase 2)

## Decision: no third-party observability platform. Everything below is implementable with structured logging to stdout/console (already the codebase's existing pattern — every route uses `console.error`) plus SQLite-persisted metrics/audit tables, consistent with the existing local Next.js + SQLite architecture.

**Why:** the application is a single-process, single-database, locally-deployed system (per every prior audit's environment description). A third-party APM/tracing platform (Datadog, OpenTelemetry collector + backend, etc.) would introduce a network dependency and an operational cost with no repository-demonstrated justification (Principle 17) — the existing `console.error` + `audit_trail` pattern, extended, covers everything this document requires.

## Required observability, per concern

- **Pipeline runs:** logged as `PipelineCompleted`/`PipelineFailed` events (`06_EVENT_MODEL.md`), carrying `correlationId`, stages run, total duration.
- **Engine executions:** each stage's `ExecutionMetadata` (`durationMs`, `notes`) is already part of the canonical `Score`/`Recommendation` contract — Phase 2.0 requires the Orchestrator to *also* log this to a conventional observability record (not just embed it in the returned Score), so execution history survives even for preview-mode (non-persisted) runs, and so dashboards can query execution metrics without querying business-data tables.
- **SQL time, rule evaluation time, adapter time, persistence time:** four separate timing buckets an engine's `ExecutionMetadata.notes` (or a structured extension of it) should be able to report, following the geospatial subsystem's existing practice of documenting measured performance numbers directly in its own docs (`docs/stage-1/07_GEOSPATIAL_APIS.md`) — Phase 2.0 generalizes "measure and record it" from a documentation habit into a structured, queryable field.
- **Rows processed / rows skipped:** required for every batch/full-dataset execution (directly supports the checkpoint mechanism in `09_PERSISTENCE_AND_HISTORY.md`).
- **Cache usage:** relevant today mainly at the SQLite level (`PRAGMA cache_size`, `lib/db.ts`) — no application-level cache exists yet (pre-implementation audit Section 15); this field is reserved for when one is introduced, not populated before then.
- **Errors, retries, partial failures:** map directly to `04_ENGINE_LIFECYCLE.md`'s `failed` state and `05_ORCHESTRATION_MODEL.md`'s partial-completion behavior — every occurrence emits `EngineExecutionFailed`/`PipelineFailed`.
- **Memory:** not measured by any existing code; recommend `process.memoryUsage()` sampling only for full-dataset batch runs (where it matters), not per-request (where the overhead isn't justified) — a SHOULD, not a MUST.
- **Batch checkpoints:** persisted per `09_PERSISTENCE_AND_HISTORY.md`'s `Pipeline Run` design.
- **Output counts:** how many Scores/Evidence/Recommendations a run produced — part of `PipelineCompleted`'s payload.

## Logs, metrics, traces, audit, health

- **Logs:** structured (JSON-shaped, not free text) `console.error`/`console.log` calls, always including `correlationId` when one exists — a direct, low-cost upgrade of the existing pattern (every route already logs a fixed string + a sanitized error name; adding `correlationId` and structuring as JSON is additive, not a rewrite).
- **Metrics:** derived from the persisted `Pipeline Run`/`Engine Execution` records (`09_PERSISTENCE_AND_HISTORY.md`) via SQL aggregation — no separate metrics store. E.g. "average Data Trust recalculation duration this week" is a `SELECT AVG(duration_ms) ... WHERE engine_id = 'data-trust'` against the execution log, not a Prometheus query.
- **Traces:** `correlationId` propagation through `CalculationContext`/`ExecutionMetadata` (`05_ORCHESTRATION_MODEL.md`) is the entire tracing mechanism — sufficient for a single-process system where "trace" means "reconstruct one Pipeline Run's stage sequence from log lines sharing an id," not cross-service distributed tracing (there are no other services).
- **Audit records:** `services/audit-trail.ts`, extended per `06_EVENT_MODEL.md`.
- **Health checks:** extend `app/api/system-health/route.ts`'s existing pattern (already correct in its non-disclosure design) to additionally report each registered engine's `04_ENGINE_LIFECYCLE.md` health status (`ready`/`degraded`/`disabled` counts), mirroring how it already reports `capabilitiesSummary()`'s status counts — a direct, small extension of an existing, working endpoint, not a new subsystem.
- **Readiness:** an engine (or the whole app) is "ready" per `04_ENGINE_LIFECYCLE.md`'s definition; surfaced via the extended `system-health` response (`status: "ok"` today already distinguishes reachable-vs-degraded at the DB level — the engine-level extension follows the same shape).
- **Degraded status:** surfaced the same way, per engine.

## What this document explicitly does not require

- No distributed tracing infrastructure (no other services to trace across).
- No metrics push to an external time-series database.
- No log aggregation platform — `console.error` output is already captured by whatever process manager runs `next start` on `leonidas-pc` (Windows-native, per every prior audit's environment notes); Phase 2.0 does not change how logs are collected, only how they're structured.
