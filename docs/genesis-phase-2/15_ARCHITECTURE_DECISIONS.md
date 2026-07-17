# 15 — Architecture Decision Records (Genesis Phase 2)

Each ADR: context, decision, alternatives considered, consequences, status, revisit trigger.

---

### ADR-001 — Adapters instead of rewrite

**Context:** the pre-implementation audit found every legacy engine individually sound and the canonical contract layer well-designed but unconsumed; the gap is wiring, not quality.
**Decision:** Genesis Phase 2 wires legacy engines to canonical contracts via thin adapters (`08_ADAPTER_STRATEGY.md`), following `services/geospatial`'s proven pure/adapter split. No engine is rewritten as part of this wiring.
**Alternatives considered:** (a) rewrite each engine directly against the canonical contracts — rejected, discards working, tested logic for unproven logic, violates Principle 1; (b) leave the canonical contracts unused and build a second, parallel set of ad hoc APIs — rejected, recreates the exact "nine incompatible dialects" problem Phase 1 was built to prevent.
**Consequences:** slower short-term feature velocity (every new capability needs an adapter, not just a route) in exchange for long-term consistency and testability.
**Status:** Accepted.
**Revisit trigger:** if a specific adapter proves the canonical contract genuinely cannot express real engine output (Principle 13's "proven blocker" bar), revisit the contract, not this ADR.

---

### ADR-002 — Canonical domain model ownership

**Context:** four overlapping representations of "a Site" exist (`core/site.ts`, `services/site-service.ts`, `services/intelligence/entities/site.ts`, `sentinel-core/entities/site-entity.ts`).
**Decision:** `services/intelligence/entities/*` is canonical; the other three are legacy/infrastructure/graph-projection respectively (full table in `02_CANONICAL_DOMAIN_MODEL.md`). Only the Site Entity Adapter converts between them.
**Alternatives considered:** designating `core/site.ts` (already named "core") as canonical — rejected, it is a column-list constant, not a typed domain entity, and doesn't carry lifecycle/versioning; merging all four into one file — rejected, violates Principle 2 (no direct legacy modification) and Principle 13.
**Consequences:** four representations persist simultaneously, permanently unless a future phase actively consolidates them — an accepted, documented cost, not an oversight.
**Status:** Accepted.
**Revisit trigger:** if a second adapter independently needs to perform the `siteRow → canonical` conversion, that is itself the trigger to check the first adapter is being reused, not a signal to revisit this ADR.

---

### ADR-003 — Canonical score scale

**Context:** legacy scores use 0–100 (Trust, Confidence sub-scores, LTS/OPI/SRI/TCI); the canonical `Score.confidence`/`Evidence.reliability` are contract-mandated `UnitInterval` (0–1); `Score.value` is contract-unconstrained.
**Decision:** canonical `Score.value` uses a 0–1 continuous scale by Phase 2 convention (not contract enforcement — the contract deliberately leaves `value` open). Conversion at the adapter boundary: `canonical = legacy / 100`, with the original legacy value preserved for traceability (`02_CANONICAL_DOMAIN_MODEL.md`).
**Alternatives considered:** keep `Score.value` on each engine's native scale (0–100 for Trust, whatever a future ML engine's native output is for others) — rejected, defeats the purpose of a canonical contract if consumers still need per-engine scale knowledge to compare two Scores; use 0–100 canonically instead of 0–1 — rejected, inconsistent with `confidence`/`reliability` already being 0–1, would force two different conventions inside one contract family.
**Consequences:** every Score Adapter must implement the same, tested, shared conversion function — a small, mandatory piece of shared code (not yet built; `08_ADAPTER_STRATEGY.md` names it as required).
**Status:** Accepted.
**Revisit trigger:** if a future engine's native output genuinely cannot be meaningfully mapped to 0–1 (e.g. an unbounded value), revisit — not anticipated for any known future engine (Risk, Opportunity) at this time.

---

### ADR-004 — Trust/Confidence/Quality separation, and the Confidence naming mismatch

**Context:** the mission's proposed semantic split (Quality = data condition, Trust = decision reliability, Confidence = per-score support strength, Risk = distinct negative-condition concept) was validated against the repository; `services/confidence-engine.ts`'s actual behavior (per-Site field-completeness) matches canonical Trust-input semantics, not canonical Confidence semantics.
**Decision:** freeze the mission's four definitions as written (`02_CANONICAL_DOMAIN_MODEL.md`). `confidence-engine.ts`'s output is treated as a Data Trust driver going forward, not as the implementation of the canonical `"confidence"` `ScoreType`. The canonical `"confidence"` type remains reserved, unimplemented, for a future engine matching the frozen definition.
**Alternatives considered:** renaming `confidence-engine.ts` to match its actual role (e.g. `field-completeness-engine.ts`) — rejected for Phase 2.0 as a source-code change (out of scope for a documentation-only mission) but recorded as a reasonable future Principle-2-class refactor; redefining canonical "Confidence" to match what `confidence-engine.ts` already does — rejected, would make the canonical vocabulary repository-specific rather than durable, and would foreclose ever building a genuine per-score confidence engine under the more useful, mission-specified definition.
**Consequences:** a naming mismatch persists in the codebase (a file called `confidence-engine.ts` that isn't canonically "Confidence") until a future rename; this ADR makes that mismatch explicit and intentional rather than silently confusing.
**Status:** Accepted.
**Revisit trigger:** when `confidence-engine.ts` is renamed (a candidate for the Increment 1/2-class refactors named in the pre-implementation audit), close this ADR and fold its content into the rename's own change record.

---

### ADR-005 — Centralized orchestration

**Context:** per `05_ORCHESTRATION_MODEL.md`.
**Decision:** one `IntelligenceOrchestrator`, not multiple bounded-context orchestrators.
**Alternatives considered:** per-bounded-context orchestrators (Trust orchestrator, Geospatial orchestrator, ...) — rejected, unjustified by current scale (Principle 17); no orchestration at all, keep direct calls — rejected, is exactly the "engines calling each other through hidden imports" pattern this mission is meant to stop for new code.
**Consequences:** the Orchestrator becomes a single point every new canonical execution passes through — a deliberate chokepoint for enforcing Principles 5/6/10/11/12/15 uniformly.
**Status:** Accepted.
**Revisit trigger:** a future engine family genuinely disjoint from the SQL-query-shaped pipeline (e.g. a real ML training/serving lifecycle).

---

### ADR-006 — Domain events, not full event sourcing

**Context:** per `06_EVENT_MODEL.md`.
**Decision:** Option 2 (domain events, conventionally persisted, extending `audit_trail`'s existing pattern).
**Alternatives considered:** Option 1 (no events) — rejected, ignores a working existing pattern; Option 3 (full event sourcing) — rejected, no repository-demonstrated need to reconstruct state from history, would be a large unjustified abstraction (Principle 17).
**Consequences:** events are queryable records, not a live pub/sub system — any future feature needing real-time event delivery (e.g. a live dashboard) needs its own, separately-designed mechanism, not assumed to fall out of this decision for free.
**Status:** Accepted.
**Revisit trigger:** a concrete requirement to reconstruct past system state from event history alone.

---

### ADR-007 — Engine manifests: code + derived JSON

**Context:** per `07_ENGINE_MANIFEST.md`.
**Decision:** manifests authored as typed TypeScript, JSON is a generated projection (e.g. via a new `/api/intelligence/engines` route reading the live registry), never hand-authored JSON as source of truth.
**Alternatives considered:** JSON-only (rejected — repeats the `sentinel_rules.json`/`confidence-engine.ts` weight-drift failure mode at a more critical layer); code-only, no JSON (rejected — couples `system-health`-class lightweight consumers to the full engine dependency graph).
**Consequences:** requires a small serialization step (build-time or registry-read-time) that does not exist today — Increment 2 work.
**Status:** Accepted.
**Revisit trigger:** none anticipated; this is a low-risk, mechanical decision.

---

### ADR-008 — Read-only GET semantics

**Context:** two existing routes write on GET (Section 9/16, pre-implementation audit).
**Decision:** every new canonical route is genuinely read-only on GET (Principle 6); the two existing offending routes are fixed only via the explicit, separately-approved migration path in `13_MIGRATION_STRATEGY.md`, not silently changed by this mission or by adapter work generally.
**Alternatives considered:** silently disabling the legacy routes' persistence now — rejected, is an undocumented behavior change (violates Principle 4), and this mission is explicitly forbidden from modifying APIs.
**Consequences:** the security/DoS exposure these two routes represent persists until the migration reaches them — this is a real, accepted-for-now risk, explicitly not hidden by this decision (flagged again in `00_EXECUTIVE_SUMMARY.md`'s blockers).
**Status:** Accepted, with the residual risk explicitly carried forward, not resolved.
**Revisit trigger:** if the residual risk is judged unacceptable to carry until Increment 11, expedite the specific fix under Increment 0 instead (`13_MIGRATION_STRATEGY.md` already names this option).

---

### ADR-009 — Persistence versioning (four axes)

**Context:** no existing persisted calculation table carries engine/contract/configuration-version or snapshot metadata.
**Decision:** every *new* persisted calculation table (not retroactively, per Principle 8) carries `engine_version`, `contract_version`, `configuration_version`, `snapshot_id`/`correlation_id` (`09_PERSISTENCE_AND_HISTORY.md`).
**Alternatives considered:** version only at the code level (git history) — rejected, doesn't let a query answer "which version of the algorithm produced this row" without archaeology; retrofit existing tables now — rejected, is a schema migration, explicitly out of Phase 2.0's scope.
**Status:** Accepted.
**Revisit trigger:** when the first real schema migration (Increment 9) is designed, this ADR's four columns are its starting requirements list.

---

### ADR-010 — Current-state vs. historical-state storage

**Context:** `site_trust_scores` is read via "latest row wins" (`ORDER BY id DESC LIMIT 1`) over what is structurally an append-only table — an implicit, fragile current-state projection.
**Decision:** future schemas make the current-state/historical-state distinction explicit (an `is_current` flag or separate current-state table), rather than relying on "highest id."
**Alternatives considered:** keep the implicit convention — rejected, fragile under concurrent writes, not indexable as cheaply, and undocumented as a deliberate design (looks accidental, not intentional).
**Status:** Accepted (conceptual; not implemented in Phase 2.0).
**Revisit trigger:** Increment 9's schema design.

---

### ADR-011 — Authentication as Increment 0

**Context:** three prior audits and this mission's own pre-implementation audit all name missing authentication as the highest-severity open risk; the GET-side-effect finding sharpens the urgency further.
**Decision:** authentication (at minimum, the two highest-risk endpoints named in `14_IMPLEMENTATION_ROADMAP.md` Increment 0) is scheduled as the first implementation increment, not backlog, not bundled into later capability-specific migration work.
**Alternatives considered:** treat auth as a normal backlog item, prioritized alongside feature work — rejected, given the unanimous prior-audit severity rating and the concrete new DoS-adjacent finding (unauthenticated `POST /api/data-trust/recalculate` writing up to 15,000 rows per call).
**Status:** Accepted.
**Revisit trigger:** none — this is the mission's own required conclusion, not open for revision by a later increment's convenience.

---

### ADR-012 — Geospatial module as adapter reference

**Context:** `services/geospatial/**` is the only subsystem that has already completed a pure/adapter migration successfully, with measured real-database performance validation.
**Decision:** every rule in `08_ADAPTER_STRATEGY.md` is extracted from and validated against this specific subsystem, not from abstract adapter-pattern literature.
**Status:** Accepted.
**Revisit trigger:** none.

---

### ADR-013 — sentinel-core coexistence, not consolidation, in Phase 2.0

**Context:** `sentinel-core/**` is a working (if partial/sample-scale) knowledge-graph feature with real endpoints (`/api/sentinel-core/**`); its `entities/`/most of its `adapters/` are unimplemented stubs (60–150 bytes); `genesis-audit/13_GENESIS_GAP_ANALYSIS.md` already flagged this as an undecided fork ("implement the entities/adapters for real, or remove the expectation that they exist as a separate layer").
**Decision:** coexist for Phase 2.0 and its immediate implementation increments. `sentinel-core` is not merged into `services/intelligence`, not deleted, not actively developed further as part of this roadmap. When its stub entities are eventually implemented for real (a future, separately-scoped decision), that implementation should consume canonical entities (via a Graph-Projection Adapter, `08_ADAPTER_STRATEGY.md` category 8) rather than re-deriving its own independent entity model — but that choice is deferred, not made now.
**Alternatives considered:** decide the fork now (implement or retire the stubs) — rejected, this mission is documentation-only and retiring or implementing production code is out of scope; merge `sentinel-core`'s concepts into `services/intelligence/entities` now — rejected, same reason, and premature given `sentinel-core`'s own stated scope limits (sample-only, up to 5,000 sites) don't yet demonstrate what a "real" implementation needs to look like.
**Consequences:** the naming collision with Sentinel-1 (Section 17, pre-implementation audit) persists; a future rename (e.g. to `knowledge-graph/`) remains a live, cheap option not foreclosed by this ADR.
**Status:** Accepted (deferral, not resolution).
**Revisit trigger:** the moment any future work actually needs to implement `sentinel-core/entities/*` for real.

---

### ADR-014 — Capabilities registry as truth source

**Context:** `config/capabilities.json`'s own header comment already declares it the single source of truth for interface claims; the pre-implementation audit found this discipline real and working, just not yet extended to engine manifests.
**Decision:** `config/capabilities.json` remains the user-facing truth source (Principle 16); engine manifests (`07_ENGINE_MANIFEST.md`) are a separate, more granular, code-adjacent truth source that must stay consistent with it via `16_QUALITY_GATES.md`'s mechanical `capabilityKey` cross-check — not merged into one file.
**Alternatives considered:** replace `capabilities.json` with the generated engine-manifest JSON — rejected, `capabilities.json` is deliberately coarser and human-curated (it describes user-facing claims, including for things that aren't "engines" at all, like `site_mapping`), a different audience than the engine manifest's technical/operational detail.
**Status:** Accepted.
**Revisit trigger:** none anticipated.

---

### ADR-015 — Legacy API coexistence strategy

**Context:** per `13_MIGRATION_STRATEGY.md`.
**Decision:** legacy routes are never modified as a side effect of canonical work (Principle 4); new canonical routes live in a new namespace (`app/api/intelligence/**`); migration follows the seven-stage strategy with explicit, per-capability tolerance/coexistence criteria before any traffic switch.
**Alternatives considered:** version the existing routes in place (e.g. `?version=2` query param) — rejected, more invasive to existing callers than an additive new namespace; switch the UI immediately once an adapter exists, skip shadow/comparison stages — rejected, no proof of correctness before user-facing exposure, unacceptably risky given the pre-implementation audit's finding that some legacy formulas have undocumented quirks (e.g. `data-quality-engine.ts`'s issue-double-counting) that a naive comparison might otherwise treat as bugs in the *new* code.
**Status:** Accepted.
**Revisit trigger:** none anticipated.

---

### ADR-016 — Minimal read-only IntelligenceOrchestrator for Increment 7

**Context:** the Increment 7 pre-implementation audit (`docs/genesis-phase-2` audit record; see `23_INCREMENT_6_5_ARCHITECTURAL_DECISIONS.md` Decision A for the full analysis) found that no `IntelligenceOrchestrator` exists anywhere in the repository, yet `12_DEPENDENCY_GRAPH.md`'s forbidden dependency #3 already prohibits any new canonical route from calling a legacy engine directly, and `05_ORCHESTRATION_MODEL.md` already states the Orchestrator's first real traffic begins at Increment 7. Building Increment 7 by having the route call the legacy engine (or the adapter's future DB-touching layer) directly would recreate the exact hidden-direct-dependency pattern this mission exists to stop, inside brand-new code.
**Decision:** Increment 7 includes building a minimal, read-only `IntelligenceOrchestrator`, scoped only to a single use case ("get canonical Data Trust assessment for one Site"). It receives the request, calls the Data Trust outer adapter (ADR-017) to obtain legacy data, constructs the minimal `CalculationContext` (using the Snapshot Provider, ADR-017), calls the existing pure Data Trust Score / Evidence / Recommendation adapters, and returns a canonical result. It performs no persistence, no cache writes, no audit-log writes, no mutation, and no engine lifecycle transition (`data-trust`/`recommendation` manifests remain `"planned"`). No exception to `12_DEPENDENCY_GRAPH.md`'s forbidden dependency #3 is granted.
**Alternatives considered:** grandfather a documented, Principle-11-style exception letting the route call the legacy engine directly, deferring the real Orchestrator to a later increment — rejected, because unlike Principle 11's grandfathered *legacy* chains, this would be **new** code choosing to violate a binding rule for convenience, which the dependency graph explicitly singles out as the pattern to prevent; build the full generic `IntelligenceOrchestrator` described in `05_ORCHESTRATION_MODEL.md` (execution-plan construction, parallel-safe stages, timeout handling, replay mode, etc.) — rejected as premature, since only one use case exists to build it against today (Principle 17); a full build now would be speculative generality with a single caller.
**Consequences:** Increment 7's scope grows beyond its original one-line roadmap description, but the growth is the minimum necessary to stay compliant with already-frozen rules, not a new invention. The full-featured Orchestrator (dependency resolution across many engines, parallel stages, cancellation, replay) remains future work, built out incrementally as more canonical routes need it — this minimal version must not be mistaken for that final design.
**Status:** Accepted.
**Revisit trigger:** the moment a second canonical route/use case needs orchestration — at that point, generalize the minimal Increment 7 Orchestrator toward `05_ORCHESTRATION_MODEL.md`'s full responsibility list rather than writing a second one-off.

---

### ADR-017 — Minimal Snapshot Provider for Increment 7

**Context:** `02_CANONICAL_DOMAIN_MODEL.md`'s "Dataset Snapshot" section already calls for "a minimal Snapshot Provider ... required before any adapter that needs to populate `CalculationContext.snapshot`" — and `CalculationContext.snapshot: SnapshotId` (`services/intelligence/context/calculation-context.ts`) is a non-optional field. No such provider exists in the repository. The closest available per-Site signal is the `data_importacao` column (`core/site.ts`'s `SITE_UNIFIED_COLUMNS`, surfaced as `siteRow().dataImportacao`); its format is not contract-guaranteed clean or always present (no independent verification found this session).
**Decision:** a minimal, read-only Snapshot Provider is built for Increment 7. It derives a deterministic `SnapshotId` preferring, in order: (1) the requested Site's own `dataImportacao` value when present and non-empty; (2) `arquivoOrigem` (the source import filename) when `dataImportacao` is absent but `arquivoOrigem` is present; (3) an explicit, fixed, documented fallback literal (e.g. `"synthetic:no-import-metadata"`) when neither is available — never `Date.now()`, never a random value, and the result is always disclosed as synthetic/derived (not presented as a real persisted snapshot record) via the canonical result's metadata/limitations.
**Alternatives considered:** block Increment 7 entirely until a real, persisted Snapshot mechanism is designed (`09_PERSISTENCE_AND_HISTORY.md`) — rejected, that is out of Phase 2.0's persistence scope and would stall the entire canonical-endpoint line of work for a concern this minimal provider adequately covers for a read-only, non-persisted context; use `Date.now()` as a quick placeholder — rejected outright, explicitly forbidden (breaks determinism/reproducibility, and this mission's own instructions prohibit it).
**Consequences:** Snapshots produced this way are only as stable as `dataImportacao`/`arquivoOrigem` — if a future import overwrites these without changing the underlying data meaningfully, the "same" data could report a different synthetic snapshot id. This is accepted as a known, documented limitation of the minimal provider, not silently glossed over, and is exactly why the contract calls it a *synthetic* snapshot rather than a real one.
**Status:** Accepted.
**Revisit trigger:** `09_PERSISTENCE_AND_HISTORY.md`'s real Snapshot mechanism (Increment 9+) — once it exists, this minimal provider is replaced, not extended.

---

### ADR-018 — Data Trust read-only outer adapter as its own seam

**Context:** the Data Trust Score Adapter (Increment 4) is, by its own header comment, "only the pure inner translator" — it never calls `dataTrustForSite()`. The DB-touching outer layer `08_ADAPTER_STRATEGY.md` originally specified alongside it was explicitly deferred to "a later, separately-chartered increment that actually wires an adapter into a route or the Orchestrator" — that increment is Increment 7.
**Decision:** Increment 7 formally adds this outer layer to its own scope, as a distinct module from both the pure translator (`data-trust-score-adapter.ts`) and the API Projection Adapter (`api-projection-adapter.ts`) — it must not be folded into either. It calls `dataTrustForSite(db, id, persist=false)` only, exposes a narrow read-only interface consumed exclusively by the Orchestrator (ADR-016), and leaves the legacy route (`app/api/data-trust/site/route.ts`, still calling `persist=true` today) completely unchanged.
**Alternatives considered:** place the DB-fetch inline inside `api-projection-adapter.ts` since it's "just one more thing the route needs" — rejected, blurs the adapter-strategy category boundary between category 2 (Score adapter, DB-touching half) and category 6 (API projection, HTTP-shape-only) that `08_ADAPTER_STRATEGY.md` deliberately keeps separate, and would make the projection adapter untestable without a database; place it inside the Orchestrator itself — rejected, the Orchestrator's job is sequencing/policy, not owning any one engine's DB access pattern, and every future engine's outer adapter should follow the same seam, not be special-cased inside the orchestrator.
**Consequences:** three distinct modules now exist for the Data Trust canonical path (pure translator, outer adapter, projection adapter) plus the Orchestrator — more files than a single "just wire it up" implementation, but each stays independently testable per `16_QUALITY_GATES.md` gate 3/4/5, matching `services/geospatial`'s proven split.
**Status:** Accepted.
**Revisit trigger:** none anticipated; this restates `08_ADAPTER_STRATEGY.md`'s adapter #2 design, now formally scheduled rather than left as unscoped deferred work.

---

### ADR-019 — Stage 3/Stage 4 sequencing clarification

**Context:** the Increment 7 pre-implementation audit found `14_IMPLEMENTATION_ROADMAP.md` sequencing Increment 7 (Migration Strategy stage 4, canonical endpoint addition) before Increment 8 (stages 1–3, shadow mode through output comparison) — the reverse of `13_MIGRATION_STRATEGY.md`'s own stated stage order, where stage 3's comparison is written as blocking "progression to stage 4."
**Decision:** "comparison failures block progression to stage 4" is clarified (not changed) to mean: stage 3 gates *activation* — no existing caller may be switched to the canonical endpoint, and the canonical path may not become a default or replacement for anything — until stage 3 passes. It does not gate the mere existence of an isolated, additive, zero-caller, non-default endpoint. Increment 7 may therefore proceed before Increment 8, provided its endpoint stays inert in exactly that sense; Increment 11 (UI migration, stage 5) remains hard-gated on Increment 8's passing comparison, unchanged.
**Alternatives considered:** renumber the roadmap so Increment 8's stages 1–3 precede Increment 7's stage 4, matching the migration strategy's literal stage order — rejected, this would block adding *any* new canonical route until a full shadow/dual-execution/comparison cycle exists for it, which is a stricter bar than `13_MIGRATION_STRATEGY.md`'s own reasoning actually requires (that document's stages exist to protect real callers from an unproven canonical path, not to gate an endpoint nobody yet calls); leave the contradiction unresolved and decide ad hoc at implementation time — rejected, exactly the kind of silent inconsistency `16_QUALITY_GATES.md` gate 11 and Principle 16 exist to prevent.
**Consequences:** `13_MIGRATION_STRATEGY.md` and `14_IMPLEMENTATION_ROADMAP.md` both carry this clarification going forward (see their Increment 6.5 edits); any future capability following this same roadmap shape (Confidence, Data Quality, etc.) inherits the same clarified reading, not a fresh ambiguity each time.
**Status:** Accepted.
**Revisit trigger:** if a future increment's "additive endpoint" is ever found to have acquired a real caller before its own stage-8-equivalent comparison passed, that is a process failure against this ADR, not evidence the ADR's reasoning was wrong — investigate the process gap, don't reopen the sequencing question.
