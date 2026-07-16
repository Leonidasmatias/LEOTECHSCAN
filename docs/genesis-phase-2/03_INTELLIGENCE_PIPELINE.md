# 03 — Intelligence Pipeline (Genesis Phase 2)

The official Sentinel intelligence pipeline, stage by stage. "Existing implementation that can be reused" cites real files read during the pre-implementation audit; "missing implementation" is stated plainly, not implied.

| # | Stage | Responsibility |
|---|---|---|
| 1 | Data ingestion | Bring source Excel/CSV data into `sites` |
| 2 | Normalization | Canonicalize field values (addresses, encodings, operator names) |
| 3 | Schema validation | Confirm required columns/types are present |
| 4 | Coordinate validation | Classify each Site's lat/lon |
| 5 | Source validation | Confirm data-source identity and truth-status (real vs. simulated) |
| 6 | Duplicate detection | Find candidate duplicate Sites |
| 7 | Rule evaluation | Apply `config/*.json` rule sets (operator classification, Copernicus rules) |
| 8 | Data-quality assessment | Aggregate Validation Findings |
| 9 | Evidence construction | Build the Evidence set backing later scores |
| 10 | Confidence calculation | Per-field/per-Site completeness signal |
| 11 | Trust calculation | Per-Site decision-reliability Score |
| 12 | Risk and opportunity engines | **Not implemented** (Section "Risk," `02_CANONICAL_DOMAIN_MODEL.md`) |
| 13 | Recommendation generation | Produce actionable next steps |
| 14 | Persistence | Write Score/Evidence/Recommendation history |
| 15 | API projection | Serve canonical shapes over HTTP |
| 16 | Audit and observability | Record what happened, for whom, when |

## Stage detail

### 1. Data ingestion
- **Input:** source `.xlsx` files (`BASE SPAZIO COM IBGE_n.xlsx`, `VIVO SITES.xlsx`, per the connected folder's inventory).
- **Output:** rows in `sites`, an `import_audit` entry.
- **Sync/async:** synchronous, command-line invoked (`npm run import` → `scripts/import_excel.py`; the heavier `importers/multi_operator_import.py` for multi-operator batches).
- **May persist:** yes — this stage's entire purpose is persistence.
- **Allowed dependencies:** none inside the Intelligence Pipeline (it is upstream of everything else, a separate Python pipeline).
- **Failure behavior:** not audited line-by-line this session; `import_audit`'s SHA-256 hash-before/after and `excel_inalterado` flag (prior-audit-sourced) imply some failure/integrity detection exists.
- **Retry behavior:** manual (re-run the script) — no automated retry.
- **Idempotency:** not confirmed this session — flagged as unverified, not assumed safe for repeated runs against the same source file.
- **Evidence generated:** the `import_audit` row itself functions as evidence-of-import.
- **Version metadata:** none observed (no `pipelineVersion`/`importerVersion` field confirmed this session).
- **Mandatory/optional:** mandatory — nothing downstream exists without it.
- **Existing implementation reusable:** yes, entirely — `importers/multi_operator_import.py`, `scripts/import_excel.py`.
- **Missing:** any automated/scheduled trigger; a formal `DataSource`/`Snapshot` record beyond the informal `imported_at` metadata field (`02_CANONICAL_DOMAIN_MODEL.md`, "Dataset Snapshot").

### 2. Normalization
- **Responsibility:** canonicalize free-text values — the closest existing example is `data-quality-engine.ts`'s `normalizeAddress()` (NFD-strip-diacritics-uppercase-collapse-whitespace).
- **Input:** raw imported field values. **Output:** normalized values, used today only inside `duplicates-engine.ts`'s address-matching pass, not written back to `sites`.
- **Sync/async:** synchronous, pure function.
- **May persist:** no (today) — normalization is computed on read, not stored.
- **Allowed dependencies:** none (pure string transform).
- **Idempotency:** yes, by construction (pure function of its input).
- **Existing implementation reusable:** `normalizeAddress()` — yes, directly.
- **Missing:** normalization for operator/technology/municipality free-text fields beyond `operator_rules.json`'s prefix matching; no normalization pass runs at *import* time, only ad hoc inside `duplicates-engine.ts` at *query* time — meaning two engines reading the same raw field could theoretically normalize it differently if a second normalizer were ever added without reusing this one (a Principle-2/Principle-11 risk to guard against explicitly).

### 3. Schema validation
- **Responsibility:** confirm a row has the expected shape/types before anything computes against it.
- **Existing implementation reusable:** `services/intelligence/validation/validators.ts`'s structural validators — but these validate *canonical contract shapes* (Score, Evidence, ...), not raw imported rows. **No structural validator exists for a raw `sites` row today.**
- **Missing:** a raw-row schema validator. Not urgent — the import pipeline's own column-mapping logic implicitly performs this today — but worth naming as a gap rather than conflating with the canonical validators, which serve a different boundary (contract output, not raw input).

### 4. Coordinate validation
- **Existing implementation reusable, in full:** `services/geospatial/coordinate-quality-engine.ts` + `brazil-bounds.ts` — the most complete stage in the entire pipeline, already pure, already unit-tested, already versioned (`algorithmVersion`).
- **Input:** `{ latitude, longitude, isDuplicateExact?, isDuplicateDense? }`. **Output:** `CoordinateQualityResult` (`02_CANONICAL_DOMAIN_MODEL.md`, "Coordinate Assessment").
- **Sync/async:** synchronous, pure.
- **May persist:** the *adapter* around it may (`site_geospatial_status`/`site_coordinate_quality`, Stage 1 tables) — the pure module itself does not.
- **Allowed dependencies:** `brazil-bounds.ts` only.
- **Failure/retry:** not applicable — a pure function over well-typed input cannot fail in the I/O sense.
- **Idempotency:** yes, by construction.
- **Evidence generated:** `reasons`/`warnings` arrays function as evidence-in-waiting; not yet wrapped as canonical `Evidence`.
- **Version metadata:** `algorithmVersion` field, already present — the best example of Principle 8 (versioned calculations) already existing in the codebase, ahead of the rest of the pipeline.
- **Missing:** the `isDuplicateExact`/`isDuplicateDense` **input wiring from Stage 6** (see below) — confirmed absent by direct code inspection during the pre-implementation audit (Section 10/17). This stage is complete in isolation but not yet connected to Stage 6's output.

### 5. Source validation
- **Existing implementation reusable:** `services/copernicus-truth.ts` — the dependency-free truth contract confirming Copernicus data is always `dataStatus: "simulated"`. **This is source validation for exactly one source (Copernicus)**, and it is excellent: explicit, tested, impossible to silently regress (per its own header comments).
- **Missing:** an equivalent truth/reliability contract for *other* sources — the original Excel imports have no analogous "is this source real/verified/stale" contract; `import_audit`'s hash check is closer to *integrity* validation than *reliability* validation.

### 6. Duplicate detection
- **Existing implementation reusable:** `services/duplicates-engine.ts`, in full (four SQL passes — Section 11, pre-implementation audit).
- **May persist:** currently no (computed fresh per `GET /api/duplicates` call).
- **Missing:** the wiring into Stage 4's `isDuplicateExact`/`isDuplicateDense` inputs (same gap named above, from the other side) — `docs/stage-1/00_STAGE_1_SUMMARY.md` names this as deferred WP1.11 work; this pipeline document treats it as **Stage 6 → Stage 4 feedback**, formally naming the currently-implicit dependency the Coordinate Assessment stage's header comment already gestures at.

### 7. Rule evaluation
- **Existing implementation reusable:** `config/operator_rules.json` (classification), `config/copernicus_rules.json` (scoring/mock-mode rules), `config/sentinel_rules.json` (LTS/OPI/SRI weights, thresholds, enterprise-v3 config).
- **Missing:** a single, named "Rule Evaluation" stage boundary — today each config file is read directly by whichever engine needs it (`copernicus-engine.ts` imports `copernicus_rules.json` inline), rather than through a shared rule-evaluation service. Not a defect (Principle 17: don't add abstraction without a consumer) — noted as an intentional non-change, not an oversight.

### 8. Data-quality assessment
- **Existing implementation reusable:** `services/data-quality-engine.ts`, in full (Section 8, pre-implementation audit — including the documented `qualityScore` double-counting caveat).
- **Missing:** per-Site `ValidationFinding` output (today's output is dataset-wide with samples, not a per-Site canonical list — see `02_CANONICAL_DOMAIN_MODEL.md`).

### 9. Evidence construction
- **Existing implementation reusable:** `services/evidence-center-engine.ts` (the 5-item ad-hoc array).
- **Missing:** canonical `Evidence[]` output — this is exactly the Evidence Adapter's job (`08_ADAPTER_STRATEGY.md`).

### 10. Confidence calculation
- **Existing implementation reusable:** `services/confidence-engine.ts`, in full — **with the semantic caveat frozen in `02_CANONICAL_DOMAIN_MODEL.md`**: this stage's *legacy* output is a Data Trust input, not canonical Confidence.

### 11. Trust calculation
- **Existing implementation reusable:** `services/data-trust-engine.ts`, in full — the first, and per the roadmap the *only mandatory*, Score-adapter target for the first implementation increment.
- **May persist:** yes, today (`site_trust_scores`, `site_validation_history`) — but with the GET-side-effect problem already flagged (Principle 6, `01_ARCHITECTURE_PRINCIPLES.md`).

### 12. Risk and opportunity engines
- **Missing entirely.** No canonical or legacy Risk Engine exists (`02_CANONICAL_DOMAIN_MODEL.md`, "Risk"). Opportunity exists only as `calculateOpi` (municipal, inside `sentinel-scoring.ts`), not per-Site, not canonical.

### 13. Recommendation generation
- **Existing implementation reusable (three shapes, unconsolidated):** `data-trust-engine.ts`'s free-text string, `sentinel-core/recommendation/recommendation-engine.ts`, `evidence-center-engine.ts`'s embedded text.
- **Missing:** canonical `Recommendation` output (Recommendation Adapter, Increment 6).

### 14. Persistence
- **Existing implementation reusable:** each engine's own `ensure*Tables`/`INSERT` pattern.
- **Missing:** unified persistence adapter, calculation versioning, snapshot traceability — all deferred to `09_PERSISTENCE_AND_HISTORY.md`, conceptual only in Phase 2.0.

### 15. API projection
- **Existing implementation reusable:** every `app/api/**` route read this session.
- **Missing:** any canonical-shaped endpoint at all (Section 5, pre-implementation audit — zero production consumers of `services/intelligence`).

### 16. Audit and observability
- **Existing implementation reusable:** `services/audit-trail.ts`.
- **Missing:** engine-execution-level observability (`11_OBSERVABILITY_MODEL.md`) — today's audit trail records business events ("trust recalculated for site X"), not execution metrics (duration, rows processed, cache hits).

## Execution modes

- **Single-site pipeline:** stages 4/8/9/10/11/13 run for one Site, synchronously, in response to a request. This is what today's `/api/data-trust/site`, `/api/evidence-center/site` already do, minus the canonical shaping.
- **Batch pipeline:** stages run for a bounded set of Sites (today's `recalculateDataTrust(db, limit)`), synchronous within the request but capped (Principle 15).
- **Full-dataset pipeline:** stages run for all ~299,308 Sites. **No existing mechanism does this in one operation for Trust/Confidence/Quality** — the closest is Stage 1's geospatial migration script (`scripts/geospatial_migrate.py`, `scripts/geospatial-spatial-index.mjs`), which processes the full dataset via a standalone script, not an API-triggered pipeline. This mode requires the resumable/checkpointed design in `09_PERSISTENCE_AND_HISTORY.md` before it can exist safely for Trust/Confidence — not designed to run synchronously inside an HTTP request.
- **Read-only preview mode:** stages compute but do not persist (`persist=false` throughout) — the mode every new canonical endpoint must default to (Principle 6).
- **Persisted recalculation mode:** stages compute and persist, explicitly requested (mirrors today's `recalculate` endpoints) — reserved for privileged callers once `10_SECURITY_BOUNDARY.md`'s roles are enforced.
