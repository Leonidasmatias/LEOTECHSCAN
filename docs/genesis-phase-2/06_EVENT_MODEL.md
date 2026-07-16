# 06 — Event Model (Genesis Phase 2)

## Decision: domain events with conventional persistence (Option 2). Not Option 1 (no events), not Option 3 (full event sourcing).

**Why not Option 1 (no event architecture):** the repository already has `services/audit-trail.ts` — a conventional, working, if informally-typed, event log. Choosing "no events" would mean ignoring an existing, working pattern rather than formalizing it. The pre-implementation audit's Section 16 also flags the audit trail as under-protected but real; strengthening its structure (typed events) is lower-risk than removing the concept.

**Why not Option 3 (full event sourcing):** event sourcing requires that current state be *reconstructible* from the event log — the log becomes the source of truth, and `sites`/`site_trust_scores`/etc. become derived projections. **Nothing in this repository demonstrates that requirement.** The source of truth is, and per Principle 1 remains, the SQLite tables themselves (`sites` above all). Rebuilding state from history is not a capability any current feature needs (no "time travel" UI, no CQRS read-model rebuild, no requirement surfaced in any of the six generations of prior audits read this session). Adopting full event sourcing would be exactly the kind of abstraction Principle 17 forbids: a large, invasive architecture change with no named consumer. **Revisit trigger:** if a future requirement genuinely needs "reconstruct the system's state as of any past moment" (e.g. full time-travel debugging of the Trust score), revisit this decision then, informed by that concrete need — not before.

**What Option 2 means concretely:** typed event records, each shaped like today's `audit_trail` row but with a closed, documented payload schema per event type (unlike today's free-form `metadata_json`), persisted conventionally (an extension of `audit_trail`, or a sibling table — schema decision deferred to `09_PERSISTENCE_AND_HISTORY.md`, conceptual only in Phase 2.0). Events are **facts about what happened**, used for audit, observability, and future consumers (e.g. a notification system) — not the mechanism by which current state is computed or reconstructed.

## Candidate domain events

| Event | Producer | Consumers (initial) | Payload (conceptual) | Persistence | Replay-safe | Sensitive data |
|---|---|---|---|---|---|---|
| `SiteImported` | Import pipeline | Audit trail, future Pipeline triggers | `siteId`, `sourceFile`, `importBatchId` | Required | Yes (describes a fact, re-emitting is harmless if deduplicated by `importBatchId`) | Low — source filename only |
| `SiteNormalized` | Normalization stage (`03_INTELLIGENCE_PIPELINE.md` Stage 2) | Duplicate Detection, Coordinate Validation | `siteId`, `fieldsChanged` | Optional (SHOULD, not MUST — high volume, low individual value) | Yes | None |
| `CoordinatesValidated` | Coordinate Validation adapter | Data Quality, Duplicate Detection (feedback loop), audit | `siteId`, `status`, `algorithmVersion` | Required | Yes | None |
| `DuplicateCandidateDetected` | Duplicate Detection stage | Data Quality, Coordinate Validation (feedback loop) | `type`, `key`, `siteIds`, `severity` | Required | Yes, but re-running detection may find a different candidate set as data changes — the *event* is a point-in-time fact, not a live query | None |
| `DataQualityAssessed` | Data Quality adapter | Trust calculation, dashboards | `scope` (site or dataset), `qualityScore`/finding count | Required | Yes | None |
| `EvidenceCreated` | Evidence Adapter | Trust, Confidence, Recommendation | `evidenceId`, `entity`, `source`, `reliability` | Required | Yes | Depends on `source` — Copernicus evidence must always carry the truth-contract fields (`02_CANONICAL_DOMAIN_MODEL.md`) |
| `ConfidenceCalculated` | Confidence adapter | Trust calculation | `siteId`, `value`, `contractVersion` | Required | Yes | None |
| `TrustCalculated` | Data Trust adapter | Recommendation, dashboards, audit | `siteId`, `value`, `classification`, `engineVersion`, `configurationVersion` | Required | Yes | None |
| `RecommendationGenerated` | Recommendation adapter | API projection, audit | `recommendationId`, `affectedEntities`, `priority` | Required | Yes | None |
| `PipelineCompleted` | Orchestrator | Observability, audit | `correlationId`, `stagesRun`, `durationMs` | Required | Yes | None |
| `PipelineFailed` | Orchestrator | Observability, audit, alerting (future) | `correlationId`, `failedStage`, `errorCode` | Required | Yes | Error message must be sanitized per `10_SECURITY_BOUNDARY.md`'s disclosure policy (mirrors `system-health/route.ts`'s existing practice of never forwarding raw error/stack text) |
| `EngineExecutionFailed` | Orchestrator (per-stage) | Observability, `04_ENGINE_LIFECYCLE.md`'s health status | `engineId`, `contextId`, `errorCode` | Required | Yes | Same sanitization rule |
| `EngineDeprecated` | Manual/administrative action | `13_MIGRATION_STRATEGY.md`, capabilities registry | `engineId`, `deprecatedSince`, `sunsetDate` | Required | Yes | None |

Every event carries, at minimum: `eventName`, `version` (the event schema's own version, independent of engine/contract versions — a fifth versioning axis, deliberately kept out of `04_ENGINE_LIFECYCLE.md`'s four since it belongs to the event, not the engine), `timestamp`, `correlationId`, and, where causally downstream of another event, `causationId`.

## What is explicitly NOT being built in Phase 2.0

- No message broker, no pub/sub infrastructure, no async event bus. Events in this model are **persisted records**, consumed by querying the store (SQL), not by subscription. This matches the existing `audit_trail` read pattern (`GET /api/audit-trail`) exactly.
- No event replay-to-rebuild-state capability (that would be Option 3).
- No guarantee of exactly-once delivery to "consumers," because there is no delivery mechanism yet — "consumers" in the table above describes *intended future readers of the persisted record*, not live subscribers.
