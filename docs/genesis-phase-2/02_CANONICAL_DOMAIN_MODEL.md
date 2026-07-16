# 02 — Canonical Domain Model (Genesis Phase 2)

This document is the authoritative definition of every domain concept Genesis Phase 2 builds on. Where a concept already has a canonical contract in `services/intelligence/**`, that contract is treated as binding (Principle 13, `01_ARCHITECTURE_PRINCIPLES.md`) and this document explains how it maps onto the repository's existing legacy/transitional representations — it does not redefine the contract's TypeScript shape.

For each concept: purpose, identity, required/optional fields, invariants, lifecycle, ownership, persistence expectation, canonical contract mapping, legacy representations, and adapter requirement.

---

## Site

**Purpose:** the atomic unit of the entire system — one physical or planned telecom installation.
**Identity:** canonical `Identifier<"Site">`, backed today by the `sites.id` SQLite primary key (integer). No new ID scheme is introduced in Phase 2.0 (Phase 1's roadmap left this open; this document closes it: reuse the existing primary key, branded).
**Required fields (canonical):** `kind: "Site"`, `id`, `createdAt`, `updatedAt`, `version`, `metadata` (from `BaseEntity`) plus whatever `services/intelligence/entities/site.ts` declares as Site-specific (not re-litigated here — see that file).
**Optional fields:** anything not required by `BaseEntity` or the Site entity interface; legacy fields not yet promoted to canonical (e.g. `risco`, `ori_risk` — see Risk, below) stay in `metadata` until a Risk Engine formally adopts them.
**Invariants:** a Site's canonical `id` must always be traceable back to exactly one `sites.id` row; a Site never exists canonically without a corresponding legacy row (Phase 2.0 does not introduce Site creation independent of the existing import pipeline).
**Lifecycle:** created by import (`importers/multi_operator_import.py`), read/updated by every engine, never canonically deleted (soft-state only — matches the existing system, which has no delete path for `sites` rows in anything read this session).
**Ownership:** the import pipeline owns creation; no single engine owns updates — this is intentional and unchanged.
**Persistence expectation:** source-of-truth (`sites` table) is persisted; the canonical `Site` entity view is derived/computed at read time by the Site Entity Adapter (below), not separately persisted, in Phase 2.0.
**Canonical contract mapping:** `services/intelligence/entities/site.ts`.
**Legacy representations (all confirmed present, not consolidated):**
- `core/site.ts`'s `SITE_UNIFIED_COLUMNS` / `api/site-query.ts`'s `SITE_SELECT` — the real column list read from SQLite.
- `services/site-service.ts`'s `siteRow()` — the flat, Portuguese-field-named object every legacy engine actually consumes.
- `sentinel-core/entities/site-entity.ts` — a 77-byte stub; not a real independent representation today, but reserved as the SIG graph's node-level Site projection.
**Adapter requirement:** **Site Entity Adapter** (first adapter in the sequence, `08_ADAPTER_STRATEGY.md`) — pure function `siteRow → EntityReference<"Site"> | Site`, no DB access of its own, no new business logic, no repair of invalid data (Principle: adapters must not silently repair).

## Operator

**Purpose:** the telecom carrier (TIM, Vivo, Claro, Oi, Algar, "Outros") that owns/operates a Site.
**Identity:** canonical `Identifier<"Operator">`; legacy identity is a plain string (`operadora_classificada`/`operadora_origem`), classified by `config/operator_rules.json`'s prefix/contains rules — there is no `operators` table; an Operator is currently a derived string value, not a row with its own primary key.
**Required fields:** name (from the classification rules); canonical entity shape per `services/intelligence/entities/operator.ts`.
**Invariants:** classification is "first matching rule wins" per `operator_rules.json`'s own documented semantics (`"A primeira regra com evidência explícita vence"`) — Phase 2.0 does not change this.
**Lifecycle:** effectively static — new operators require an `operator_rules.json` edit, not a runtime creation path.
**Ownership:** `config/operator_rules.json` is the source of truth for classification.
**Persistence expectation:** derived at read/import time from `operator_rules.json`, stored denormalized on each `sites` row (`operadora_classificada`) — not a separate persisted entity today.
**Canonical contract mapping:** `services/intelligence/entities/operator.ts`.
**Legacy representations:** `operadora_origem`/`operadora_classificada` string columns; `sentinel-core/entities/operator-entity.ts` (99-byte stub, graph projection reserved).
**Adapter requirement:** folded into the Site Entity Adapter's output (an `Operator` `EntityReference` derived from the same row) rather than a separate adapter, since there is no independent Operator data source to adapt from.

## Municipality / State

**Purpose:** geographic/administrative grouping used throughout rollout, market, and risk reporting (LTS/OPI/SRI in `services/sentinel-scoring.ts`).
**Identity:** canonical `Identifier<"Municipality">`/`Identifier<"State">`; legacy identity is the `(municipio, uf)` string pair — again no dedicated table, purely denormalized on `sites`.
**Invariants:** `uf` is expected to equal `estado` (Section 10 of the pre-implementation audit flagged the `uf-estado-inconsistente` data-quality rule for when it doesn't); Phase 2.0 does not resolve which field wins, only records that the inconsistency is a Data Quality finding, not a domain-model defect to silently paper over.
**Lifecycle:** static reference data, sourced from the original import (IBGE-derived per `BASE SPAZIO COM IBGE_n.xlsx`, per file naming — not independently confirmed this session).
**Persistence expectation:** denormalized on `sites`; a canonical Municipality/State entity is a read-time aggregation (`GROUP BY municipio, uf`), same pattern already used by `sentinel-scoring.ts` and `app/api/sites/[id]/intelligence/route.ts`.
**Canonical contract mapping:** `services/intelligence/entities/municipality.ts`, `services/intelligence/entities/state.ts`.
**Legacy representations:** denormalized string columns; `sentinel-core/entities/municipality-entity.ts` (109-byte stub), `state-entity.ts` (79-byte stub).
**Adapter requirement:** a small aggregation adapter (Municipality/State Rollup Adapter), needed only when the first engine that operates at municipality/state scope (e.g. a future canonical LTS/OPI/SRI adapter) is built — not required for the Site/Data-Trust increments this document prioritizes.

## Technology

**Purpose:** the radio technology at a Site (2G/3G/4G/5G and operator-specific variants).
**Identity:** legacy identity is a free-text string (`tecnologia`), not a closed enum anywhere in the code read this session.
**Invariants:** none enforced today beyond non-emptiness checks in Data Quality's `sem-tecnologia` rule.
**Persistence expectation:** denormalized on `sites`.
**Canonical contract mapping:** `services/intelligence/entities/technology.ts`.
**Legacy representations:** `tecnologia` column; `sentinel-core/entities/technology-entity.ts` (97-byte stub).
**Adapter requirement:** folded into the Site Entity Adapter, same as Operator.

## Data Source

**Purpose:** identifies *where* a piece of data came from (an import batch, Copernicus's simulated feed, a manual note) — the canonical anchor for `DataProvenance.source`.
**Identity:** canonical `DataSourceId`; legacy equivalent is `arquivo_origem` (the source Excel filename) at the Site level, and `copernicus_rules.json`'s `provider`/`mission` fields for the (simulated) satellite feed.
**Invariants:** per `services/copernicus-truth.ts`, any Data Source claiming to be Copernicus/Sentinel-1 real satellite evidence must be false today — `COPERNICUS_IS_REAL_SATELLITE_EVIDENCE = false`. This is a domain-model-level invariant, not just a code detail: **no canonical `DataSource` may claim `isRealSatelliteEvidence: true` until a real Stage 3 client exists**, and this invariant must be checked by the Evidence Adapter (`08_ADAPTER_STRATEGY.md`), not left to convention.
**Persistence expectation:** import-time sources are recorded in `import_audit` (prior-audit-sourced, not re-verified); no persisted `DataSource` table exists at the granularity the canonical entity implies.
**Canonical contract mapping:** `services/intelligence/entities/data-source.ts`.
**Legacy representations:** `arquivo_origem` column; `import_audit` table; `copernicus_rules.json` config.
**Adapter requirement:** Data Source Adapter, needed by the Evidence Adapter (Increment 5 in `14_IMPLEMENTATION_ROADMAP.md`) — not required before then.

## Dataset Snapshot

**Purpose:** the immutable point-in-time anchor every `CalculationContext.snapshot`/`Evidence.snapshot`/`DataProvenance.snapshot` refers to, so results are reproducible against a fixed state rather than "whatever the data happens to be right now."
**Identity:** canonical `SnapshotId`. **No equivalent exists in the legacy system today** beyond `sig_snapshots` (1 row, prior-audit-sourced) and the informal `imported_at` metadata timestamp — this is a genuine gap, not a rename target.
**Invariants:** a Snapshot, once referenced by a persisted `Score`/`Evidence`, must never change its meaning retroactively (append-only).
**Lifecycle:** in Phase 2.0's conceptual model, a Snapshot is created at minimum once per import run; whether finer-grained snapshots (e.g. per-recalculation-batch) are needed is deferred — see `09_PERSISTENCE_AND_HISTORY.md`.
**Persistence expectation:** **new** persisted concept, conceptual-only in this phase (Principle 8; no schema migration in Phase 2.0).
**Canonical contract mapping:** `SnapshotId` (`services/intelligence/types/identifiers.ts`, not read line-by-line this session but referenced throughout the contract layer).
**Legacy representations:** `imported_at` metadata field; `sig_snapshots` (sentinel-core, 1 row).
**Adapter requirement:** a minimal Snapshot Provider (returns "the current import's `imported_at` as a synthetic snapshot id" until a real snapshot mechanism exists) is required before any adapter that needs to populate `CalculationContext.snapshot`/`Evidence.snapshot` — this is a small, concrete, unblocking piece of work, not deferred.

## Calculation Context

**Purpose/contract:** exactly `services/intelligence/context/calculation-context.ts` — the single parameter every canonical engine accepts. Not redefined here.
**Ownership in Phase 2:** constructed once per request/batch by the Orchestrator (`05_ORCHESTRATION_MODEL.md`), never by an individual engine adapter.
**Persistence expectation:** ephemeral per execution; `contextId` is referenced by `ExecutionMetadata` for traceability, not the context object itself.
**Legacy representations:** none — no legacy function accepts anything resembling a single context object; every legacy engine has its own ad-hoc parameter list (Section 5 of the pre-implementation audit).
**Adapter requirement:** none — this is infrastructure the Orchestrator provides, not something adapted from legacy data.

## Score

**Purpose/contract:** `services/intelligence/scoring/score.ts`. See "Trust, Confidence, Quality, Risk" section below for the semantic freeze this mission requires, and `15_ARCHITECTURE_DECISIONS.md` (ADR-003) for the canonical scale decision.
**Legacy representations:** `data-trust-engine.ts`'s `trustScore`; `confidence-engine.ts`'s 8 sub-confidences + `overallConfidence`; `sentinel-scoring.ts`'s LTS/OPI/SRI/TCI; `satellite-validation-engine.ts`'s `validationScore`.
**Adapter requirement:** one Score Adapter per legacy score-producing engine, starting with Data Trust (`08_ADAPTER_STRATEGY.md`).

## Score Driver

**Purpose/contract:** `ScoreDriver` (`services/intelligence/scoring/classification.ts`) — the explainability unit inside a Score.
**Legacy representations:** none directly — legacy engines return flat sub-scores (e.g. `coordinateConfidence`, `addressConfidence`) without an explicit weight/contribution/explanation triple. **Closest legacy equivalent:** `confidence-engine.ts`'s 8 named sub-confidences, each of which already has an implicit weight (the hardcoded multiplier) and an implicit explanation (its computation rule) — the Score Adapter's job is to make both explicit.
**Adapter requirement:** produced inline by each Score Adapter, not a separate adapter of its own.

## Evidence / Provenance

**Purpose/contract:** `services/intelligence/evidence/evidence.ts`, `evidence/provenance.ts`. See Section "Evidence" invariant above re: Copernicus truth-contract.
**Legacy representations:** `evidence-center-engine.ts`'s 5-item ad-hoc array; `import_audit`'s SHA-256 provenance (import-step only).
**Adapter requirement:** Evidence Adapter (`08_ADAPTER_STRATEGY.md`, Increment 5).

## Recommendation

**Purpose/contract:** `services/intelligence/recommendations/recommendation.ts`.
**Legacy representations (three, not consolidated — pre-implementation audit Section 17):** `data-trust-engine.ts`'s free-text `recommendation` string; `sentinel-core/recommendation/recommendation-engine.ts`'s own recommendation objects; `evidence-center-engine.ts`'s embedded `technicalRecommendation`.
**Adapter requirement:** Recommendation Adapter (Increment 6) — this is also where the three legacy shapes are reconciled into one producer, per the pre-implementation audit's recommendation; Phase 2.0 does not pre-decide *which* legacy source wins, only that the adapter is where that decision gets made and tested.

## Validation Finding

**Purpose:** a single structural or business-rule problem found in a Site's data (**new canonical name** for what `data-quality-engine.ts` currently calls a `QualityIssue`).
**Identity:** no canonical contract exists yet in `services/intelligence/**` — **this is a genuine gap this document identifies**, not previously named as a required new contract by Phase 1. Recommendation: a `ValidationFinding` interface should be added to `services/intelligence/` as a Phase 2 (not 2.0) implementation task, shaped like `QualityIssue` (`id`, `category`, `severity`, `label`, `total`, `sample`) but upgraded to `BaseEntity`-derived and evidence-linked, consistent with every other canonical concept.
**Legacy representations:** `services/data-quality-engine.ts`'s `QualityIssue` type (8 fixed rules).
**Adapter requirement:** Validation Finding Adapter — not sequenced in the first five adapters (`08_ADAPTER_STRATEGY.md`), since Data Quality was not selected as the first wired engine (Data Trust was, per Phase 1's own roadmap and the pre-implementation audit's independent agreement).

## Duplicate Candidate

**Purpose/contract:** already well-named in the legacy system (`services/duplicates-engine.ts`'s `DuplicateCandidate` type: `type`, `severity`, `key`, `total`, `sample`, `recommendation`) — this document adopts the existing name as the canonical one rather than inventing a new term, since it already fits the domain well.
**Canonical contract mapping:** none yet; like Validation Finding, recommend promoting this to a `services/intelligence/` contract in a future Phase 2 increment, not Phase 2.0.
**Adapter requirement:** deferred past the first five adapters.

## Coordinate Assessment

**Purpose/contract:** already exists and is the best-designed non-canonical contract in the repository: `services/geospatial/coordinate-quality-engine.ts`'s `CoordinateQualityResult` (`status`, `eligibleForMapping`, `eligibleForSentinel`, `confidence`, `reasons`, `warnings`, `evaluatedAt`, `algorithmVersion`). Recommend adopting this shape near-verbatim as a canonical contract in a future increment — it already has explainability (`reasons`), versioning (`algorithmVersion`), and a confidence value, which is more than most legacy engines provide.
**Adapter requirement:** low-effort future adapter (`CoordinateAssessment → Score` with `type: "coordinate-quality"`, or embed as a driver inside Data Quality's future Score) — not in the first five.

## Engine / Engine Execution

**Purpose/contract:** `services/intelligence/registry/engine-identity.ts` (`EngineDeclaration`) for **Engine**; **Engine Execution** is a **new** concept this document introduces, corresponding to one call of `ExecutionMetadata` plus its outcome (success/failure/duration) — see `04_ENGINE_LIFECYCLE.md`.
**Persistence expectation:** Engine declarations are in-memory (per `EngineRegistry`'s own design — "declare, never instantiate"); Engine Executions should be logged (conceptually, `11_OBSERVABILITY_MODEL.md`) but are not currently persisted anywhere in the legacy system.

## Pipeline Run

**Purpose:** **new** concept — one end-to-end execution of the Intelligence Pipeline (`03_INTELLIGENCE_PIPELINE.md`) across one or more stages, for one site, a batch, or the full dataset.
**Identity:** a `correlationId`, shared by every `CalculationContext`/`ExecutionMetadata` produced during that run.
**Persistence expectation:** conceptually should be logged as a summary record (rows processed, stages completed, failures) — see `09_PERSISTENCE_AND_HISTORY.md`'s batch-checkpoint discussion. No legacy equivalent exists (the closest is `geospatial_processing_runs`, Stage 1, which logs geospatial migration runs specifically).

## Audit Event

**Purpose/contract:** already exists and works: `services/audit-trail.ts`'s `audit_trail` table (`event_type`, `entity_type`, `entity_id`, `description`, `metadata_json`, `created_at`). Phase 2.0 treats this as the base to extend for Domain Events (`06_EVENT_MODEL.md`), not to replace.

---

## Resolving the Site/entity overlap (mandatory per mission Step 4)

Four representations of "a Site" (and, by extension, Operator/Municipality/State/Technology) exist simultaneously. None is deleted or renamed by this document. Their roles, going forward:

| Representation | Role | Status |
|---|---|---|
| `core/site.ts` + `api/site-query.ts` (`SITE_UNIFIED_COLUMNS`/`SITE_SELECT`) | The real SQL column contract against the `sites` table | **Infrastructure-specific — source of truth for what columns exist.** Unchanged. |
| `services/site-service.ts`'s `siteRow()` | The flat, Portuguese-named object every legacy engine consumes | **Legacy — the production representation today.** Unchanged; remains the input to the Site Entity Adapter. |
| `services/intelligence/entities/site.ts` | The typed, `BaseEntity`-derived canonical Site | **Canonical — the target representation for anything claiming to be Genesis Phase 2 output.** |
| `sentinel-core/entities/site-entity.ts` (and its Operator/Municipality/State/Technology siblings) | The SIG knowledge-graph's node-level Site projection | **Graph-projection — a read-optimized view for `sentinel-core`'s specific graph-query use case, not a general-purpose domain representation.** Currently a stub; see `15_ARCHITECTURE_DECISIONS.md` ADR-013 for the sentinel-core coexistence decision. |

The Site Entity Adapter is the **only** sanctioned place a `siteRow()` object becomes a canonical `Site`/`EntityReference<"Site">`. No other adapter, engine, or route should perform this conversion independently — doing so would recreate exactly the "nine incompatible dialects" problem `docs/genesis-phase-1/00_EXECUTIVE_SUMMARY.md` built the contract layer to prevent.

---

## Trust, Confidence, Quality, and Risk — frozen semantics

This section validates the mission's proposed definitions against the repository's actual code (not just against the proposal's abstract descriptions) and freezes the result.

### DATA QUALITY

**Definition (adopted, matches the mission's proposal and the existing `data-quality-engine.ts` closely):** the condition of the data itself, measured dataset-wide and per-record, independent of any specific decision being made with it.

**Dimensions, validated against the repository:**
- **Completeness** — implemented today (`sem-coordenadas`, `sem-endereco`, `sem-municipio`, `sem-uf`, `sem-tecnologia`, `dados-incompletos` rules).
- **Validity** — implemented today (`coordenadas-invalidas`).
- **Consistency** — implemented today (`uf-estado-inconsistente`).
- **Uniqueness** — **not implemented inside `data-quality-engine.ts`** — this is `duplicates-engine.ts`'s job today, a separate module. Canonically, Uniqueness remains a Data Quality *dimension* even though today it is computed by a different file; Phase 2's Validation Finding contract (above) should eventually unify both under one `ValidationFinding` stream, without merging the two engines' internal logic (Principle 2).
- **Accuracy** — **not implemented anywhere found this session.** No mechanism checks whether a filled-in field is *correct* (only whether it is present/well-formed). Recorded here as a real gap, not silently assumed covered.
- **Freshness** — **not implemented.** No engine considers `dataImportacao`'s age as a quality signal today, despite Trust's formula referencing `dataImportacao`/`arquivoOrigem` presence (not recency).
- **Coordinate integrity** — implemented (`coordinate-quality-engine.ts`, the most rigorous module in the repository for this dimension).
- **Provenance completeness** — partially implemented (`import_audit` covers the import step; nothing checks whether a *record* has traceable provenance beyond that).

**Scope:** may be reported dataset-wide (today's `dataQualitySnapshot`) or per-record (today's per-issue `sample`, and the future per-Site `ValidationFinding` set). Both scopes are canonical; they are not in conflict.

### DATA TRUST

**Definition (adopted, matches the mission's proposal and matches `data-trust-engine.ts`'s actual formula closely — see below):** whether Sentinel can safely rely on a specific record for an operational or strategic decision. **Per-Site**, not dataset-wide.

**Inputs, validated against the repository's actual formula (Section 6, pre-implementation audit):**
- **Data quality** — via `confidence-engine.ts`'s field-completeness sub-scores (78% weight in the current formula) — confirmed.
- **Source reliability** — via `importConfidence` (90 if imported-with-provenance, 30 otherwise; 12% weight) — confirmed, though this is a coarse binary, not a graduated reliability score.
- **Validation history** — **not currently an input to the trust *formula* itself** (it is an *output*, written to `site_validation_history` after the fact) — this is worth noting precisely: today's Trust calculation does not look backward at its own history to inform the new score (e.g. "has this site's trust been volatile?"). Recorded as a gap for a future Trust Engine v2, not fixed in Phase 2.0.
- **Evidence agreement / conflict level** — **not implemented.** Today's formula does not check whether, e.g., Copernicus evidence and cadastral evidence agree or conflict; it only folds Copernicus's score in as one weighted input (via Confidence's `satelliteConfidence`).
- **Freshness** — not implemented (same gap as Data Quality's Freshness dimension).
- **Critical-field reliability** — approximated by `duplicatePenalty`/`alertPenalty` (8-point deductions), which are closer to "known problem penalties" than a general critical-field-reliability model.

**Conclusion:** the mission's proposed Trust definition is directionally correct for this repository, but the *actual* implementation is narrower than the proposal implies — it is a weighted-completeness-plus-penalty formula, not yet a full evidence-agreement/history-aware trust model. Phase 2.0 freezes the *definition* (per-Site reliability-for-decisions) without pretending the current formula already fully satisfies it; closing that gap is future engine work (`03_INTELLIGENCE_PIPELINE.md`'s "missing implementation" column), not a Phase 2.0 documentation fiction.

### CONFIDENCE

**Definition (adopted from the mission's proposal):** the strength of support for a *specific* score, finding, conclusion, or recommendation — i.e. Confidence is a property of an individual `Score`/`Recommendation` (its `.confidence: UnitInterval` field), not a standalone dataset-wide or per-Site metric.

**Critical finding, validated against the repository (not previously stated this precisely in the pre-implementation audit):** `services/confidence-engine.ts`, despite its name, does **not** compute "strength of support for a specific score" in the canonical sense above. It computes a per-Site, field-completeness-weighted sub-score that today feeds directly into Trust — semantically, it is a **Data Trust input**, not a canonical Confidence value in the mission's now-frozen sense.

**Resolution (binding for Phase 2):** `confidence-engine.ts`'s output maps onto canonical `Score.confidence`/`Evidence.reliability` signals when a future Score/Evidence Adapter is built for it, and it remains one of Data Trust's weighted drivers exactly as it does today. But **no adapter should register `confidence-engine.ts` as the implementation of the canonical `"confidence"` `ScoreType`** — that type remains reserved (per `services/intelligence/scoring/classification.ts`'s own `CANONICAL_SCORE_TYPES` list) for a genuinely different future engine: one that answers "how much should I trust *this specific* Risk/Opportunity/Recommendation score," not "how complete is this Site's data." This naming collision is a real, previously-undocumented semantic mismatch this audit-and-freeze exercise surfaces, and `15_ARCHITECTURE_DECISIONS.md` records it as ADR-004.

### RISK

**Definition (adopted verbatim from the mission's proposal):** a potential negative operational, strategic, geographic, competitive, infrastructure, or data-related condition. **Risk is explicitly not a synonym for poor Data Quality or low Data Trust** — a Site can have excellent data quality and high trust while still being, e.g., in a geographically risky location (natural-disaster exposure) or a strategically risky market position (over-saturated coverage). Conversely a Site can have poor data quality without being operationally "at risk" in the business sense.

**Current state (Section 17, pre-implementation audit, restated here as the domain-model consequence):** three unconsolidated proto-Risk signals exist (`risco`/`ori_risk` persisted columns, an inline dashboard `risk` recalculation, and municipal `SRI`). **None is canonical.** No Risk Engine exists. Phase 2.0 does not design the Risk Engine itself (that is real future design work, explicitly postponed per the pre-implementation audit's Section 18) — it only freezes the definition above so that whenever a Risk Engine is designed, it is designed against this definition, not against whichever of the three existing signals happens to be closest at hand.

### Canonical score scales

See `15_ARCHITECTURE_DECISIONS.md`, ADR-003, for the full decision record. Summary: canonical `Score.value` and `Evidence.reliability`/`Score.confidence` use a **0–1 continuous scale** (the latter two are already contract-mandated `UnitInterval`; `value` is contract-unconstrained but Phase 2 adopts 0–1 as its own convention for consistency). Existing 0–100 legacy scores (Trust, Confidence sub-scores, LTS/OPI/SRI/TCI) are converted at the adapter boundary via `canonical = legacy / 100`, with the original 0–100 value preserved in a `ScoreDriver.explanation`/`metadata` field for human/legacy-UI readability — never silently discarded.

**Classification bands:** reuse `CANONICAL_SCORE_CLASSIFICATIONS` (`LOW`/`MODERATE`/`HIGH`/`CRITICAL`) as the default band set; engines may extend with documented additional values (the contract's own open-string design already permits this) — e.g. an `INSUFFICIENT_DATA` classification, used below.

**Unknown vs. zero (binding rule):** a canonical `Score.value` of exactly `0` must mean "measured, and the measured value is genuinely zero" — never "we don't know." Any engine that cannot compute a value (missing required input, insufficient evidence) must emit `classification: "INSUFFICIENT_DATA"` and a `Limitation` with `severity: "significant"` explaining what's missing, rather than defaulting `value` to `0`. This rule directly targets a real, present-day risk: several legacy engines already default to `0`/low values when data is missing (e.g. `confidence-engine.ts`'s `filled()` fallback to `15`/`20`/`10` rather than an explicit "unknown" state) — those defaults are acceptable *inside* the legacy formula (Principle 2: adapters don't change legacy math), but a canonical Score Adapter wrapping that output must translate "the legacy formula defaulted because data was missing" into an explicit `INSUFFICIENT_DATA` signal at the canonical layer, not just pass the numeric default through silently.

**Confidence requirement for classifications:** a `Score` with `classification: "CRITICAL"` should carry `confidence >= 0.5` by convention (not contract-enforced, since business validation is explicitly out of scope for the structural validators per `docs/genesis-phase-1/09_IMPLEMENTATION_GUIDE.md`) — a low-confidence CRITICAL classification should instead be `HIGH` with a `Limitation` noting the uncertainty, reserving `CRITICAL` for genuinely well-supported alarms. This is a **SHOULD**-level engine-authoring convention, not a MUST, recorded here so future engine authors don't have to rediscover it independently.
