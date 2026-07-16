# 09 — Persistence and History (Genesis Phase 2)

No schema migration is proposed or performed by this document (mission Step 12 is explicit: conceptual level only). Everything below is a target shape for a future, separately-approved migration.

## Data classification

- **Source-of-truth data:** `sites` (the imported rows themselves), `import_audit` (import provenance). Never derived, never recomputed — only re-imported.
- **Derived data:** every engine's computed output — `site_trust_scores`, `site_validation_history`, `site_evidence_center`, `site_geospatial_status`, `site_coordinate_quality`, `sig_nodes`/`sig_edges`/`sig_insights`, `copernicus_scenes`, `site_satellite_validation`. All of these can, in principle, be fully regenerated from source-of-truth data plus the engine code/config that produced them (Option 2's "conventional persistence," not event-sourced reconstruction — regeneration means *re-running the engine*, not *replaying an event log*).
- **Ephemeral calculation:** any canonical Score/Evidence/Recommendation computed in preview mode (`persist=false`, per Principle 6) — exists only for the duration of the HTTP response, never touches disk.
- **Persisted calculation:** the same computation, run in privileged recalculation mode, written to a derived-data table.
- **Immutable history:** `site_validation_history` already behaves this way (append-only, never updated in place, per the pre-implementation audit's reading of `data-trust-engine.ts`) — this pattern is adopted as the canonical model for all future calculation history, not just Trust's.
- **Current-state projection:** `site_trust_scores` as read today (`ORDER BY id DESC LIMIT 1`, i.e. "latest row wins") is an ad hoc current-state projection over what is structurally already an append-only history table. **Decision (ADR-010, `15_ARCHITECTURE_DECISIONS.md`): keep both concepts, but name them explicitly going forward** — a future schema should have an explicit `is_current` flag or a separate `current_*` table rather than relying on "highest id" as an implicit current-state marker, which is fragile under concurrent writes and cannot be indexed as cheaply as an explicit flag.
- **Superseded results:** any history row that is not the current one — already implicitly true today, formalized as a named concept so a future retention/cleanup policy has something explicit to act on.

## Recalculation policy

Two modes, per `03_INTELLIGENCE_PIPELINE.md`: preview (never persists) and persisted recalculation (always appends a new history row, never updates one in place — matching the existing, correct `INSERT`-only pattern in `data-trust-engine.ts`). **Decision: no third "silent recalculation" mode** — every persisted write is either explicitly requested (a privileged recalculation call) or explicitly scheduled (a future batch job, itself a privileged, logged operation) — never an implicit side effect of a read, which is exactly the defect Principle 6 exists to prevent going forward.

## Retention, cleanup, deduplication

- **Retention:** not decided in Phase 2.0 — flagged as an open question requiring a business decision (how long should Trust history be kept per Site?), not an architectural one. Revisit trigger: when `site_validation_history`'s row count, growing unboundedly today per the pre-implementation audit's GET-side-effect finding, becomes an operational concern (measurable via `11_OBSERVABILITY_MODEL.md`'s row-count metrics).
- **Cleanup:** any future cleanup job must itself be a bounded, resumable, audited operation (Principle 15), never an ad hoc `DELETE` script run manually against production.
- **Deduplication:** once GET-side-effect writes are fixed (`13_MIGRATION_STRATEGY.md`), the *rate* of history growth drops to "one row per actual recalculation," which may make deduplication unnecessary — Phase 2.0 does not propose deduplication logic ahead of confirming the root cause (unwanted writes) is actually fixed first.

## Transaction boundaries, idempotency, checkpoints

- **Transaction boundaries:** each single-Site persisted calculation should write all of its derived rows (e.g. Trust's score row + history row + audit row) in one SQLite transaction — today's `data-trust-engine.ts` does *not* wrap its three writes (`site_trust_scores` INSERT, `site_validation_history` INSERT, `recordAudit` INSERT) in an explicit transaction (confirmed by reading the file: three separate `db.prepare(...).run(...)` calls, no `BEGIN`/`COMMIT`). This is a **previously-undocumented finding**: a crash between the second and third write would leave an orphaned trust-score update with no matching audit entry. Recorded here as a target-state requirement (explicit transactions around every multi-table write), not fixed in Phase 2.0.
- **Idempotency keys:** a future batch recalculation should be keyed by `(engineId, entityId, configurationVersion)` so a retried batch job does not produce duplicate history rows for the same logical recalculation — `node:sqlite`'s `INSERT ... WHERE NOT EXISTS`-style guard, following the exact pattern `copernicus-engine.ts`'s `persistEvidence()` already uses for scene deduplication (`SELECT id FROM copernicus_scenes WHERE scene_id = ? LIMIT 1` before inserting) — a real, working precedent in this codebase to generalize, not a new idea.
- **Batch checkpoints:** a full-dataset recalculation (`03_INTELLIGENCE_PIPELINE.md`'s full-dataset mode) must record progress (e.g. "processed up to site id N") so a restart resumes rather than reprocesses from zero — no existing engine does this (Data Trust's `recalculateDataTrust` processes `ORDER BY id LIMIT ?` with no offset/cursor tracked across calls) — a genuine gap, named here as a target requirement for `Pipeline Run` persistence (`02_CANONICAL_DOMAIN_MODEL.md`).

## Partial failure, retry, rollback

- **Partial failure:** per `05_ORCHESTRATION_MODEL.md`'s partial-completion behavior — a batch that fails at site 3,000 of 5,000 retains sites 1–2,999's persisted results (already-committed transactions are not rolled back) and records a checkpoint at 2,999 for resume.
- **Retry:** governed by the idempotency key above — a retried batch overwrites nothing, appends only what wasn't already recorded for that `configurationVersion`.
- **Rollback:** at the calculation level, "rollback" means appending a new history row that supersedes a bad one (matching the append-only/immutable-history model) — never `DELETE`/`UPDATE`-ing a past calculation, which would break traceability (Principle 8/9). At the schema level (a future migration), rollback follows whatever mechanism the eventual migration tool provides — out of scope for this conceptual document.

## Engine-version / configuration-version / snapshot traceability

Every future persisted calculation row should carry, at minimum: `engine_version`, `contract_version`, `configuration_version` (the three axes from `04_ENGINE_LIFECYCLE.md`), and a `snapshot_id`/`correlation_id` pair (from `02_CANONICAL_DOMAIN_MODEL.md`'s Dataset Snapshot and Pipeline Run concepts). **None of these columns exist on any current table** (confirmed: `site_trust_scores`' full column list, read directly from `ensureDataTrustTables`, has no version columns at all) — this is the single most concrete, actionable conceptual-schema recommendation in this document, and the natural first target when a real migration is eventually approved.

## Addressing the four specific problems named in the mission

1. **Lazy table creation inside engines** (`ensureDataTrustTables`, `ensureCopernicusTables`, `ensureAuditTrail`, `ensureSiteNotes` — all confirmed to follow this pattern by direct reading): **target state — a single, versioned migration file** (following `scripts/geospatial_migrate.py`'s already-correct `CREATE TABLE IF NOT EXISTS` idempotent-migration pattern, the best precedent in the repository) replaces the four scattered `ensure*` functions. Not fixed in Phase 2.0; named as the concrete target.
2. **Write side effects on GET routes:** target state is `05_ORCHESTRATION_MODEL.md`'s persistence-policy-owned-by-orchestrator design — once new canonical routes go through the orchestrator, GET-with-side-effects becomes structurally impossible for *new* routes. The two existing offending routes are fixed only via an explicit, separately-approved `13_MIGRATION_STRATEGY.md` step, not as a side effect of this document.
3. **Unbounded validation/evidence history growth:** addressed by (2) removing the write-amplification root cause, plus the future retention/cleanup policy above (deliberately left as an open business question, not architecturally hand-waved as "solved").
4. **No calculation-version metadata:** addressed by the version/snapshot traceability columns above — the concrete conceptual-schema proposal this document commits to.
5. **No full-dataset resumable recalculation mechanism:** addressed by the batch-checkpoint design above, dependent on `Pipeline Run` persistence.
