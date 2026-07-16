# Genesis Phase 2 — Deep Pre-Implementation Audit

**Repository:** `C:\LEOTECHSCAN\APP` | **Branch:** `master` | **Commit:** `06c7d3f` | **Tag:** `genesis-phase-1-v1`
**Audit date:** 2026-07-16 | **Scope:** Read-only architectural audit. No source code was modified. No Phase 2 implementation occurred.

---

## How this audit was produced (read this before the findings)

The remote shell (`device_bash`) on `leonidas-pc` could not be started for this session — every attempt returned `Workspace unavailable` or `Workspace still starting` and never recovered. Per the mission's own stop condition, no `git`, `tsc`, `npm test`, or `npm run build` command was run, simulated, or inferred by this audit.

The user then supplied the following as **trusted, user-asserted baseline** (manually verified on `leonidas-pc` outside this session), which this audit did **not** independently execute:

- Branch `master`, commit `06c7d3f`, tag `genesis-phase-1-v1`, clean working tree
- `npx tsc --noEmit`: PASS
- `npm test`: 205/205 PASS
- `npm run build`: PASS

This is flagged as **user-asserted / not independently verified** everywhere it is cited below. One piece of corroborating (not confirming) evidence was found in the repository itself: `docs/genesis-phase-1/00_EXECUTIVE_SUMMARY.md` documents that a prior session's `tsc --noEmit` was independently run and passed with 0 errors, and that `npm test`/`npm run build` **cannot** run inside this Linux device-bridge sandbox at all (Windows-built native binaries — `@rollup/rollup-linux-x64-gnu`, `@next/swc-linux-x64-gnu`/`-musl` — are not resolvable from this bridge), and explicitly recommends running both directly on `leonidas-pc`. The user's report is consistent with that recommended workflow, but this audit has no independent way to confirm the 205/205 figure or the build output.

Everything else in this report was produced by directly reading repository files through the device file-bridge (`device_list_dir` / `device_stage_files`), never through the shell. 141 files were staged and read in full (services, API routes, config, intelligence contracts, tests, and six prior generations of self-audit documentation already present in `docs/`). Where a claim originates from those prior audits rather than this session's own file inspection (for example, exact database row counts, which require SQL access this session does not have), it is labeled **prior-audit-sourced, not re-verified**.

---

## 1. Executive Summary

LeoTechScan is a Next.js 15 / TypeScript telecom-site intelligence application backed by a single local SQLite database (`node:sqlite`, ~299,308 site rows per prior-audit-sourced figures). The codebase has already been through five documented internal audit/remediation cycles before this one (`docs/audit-v4`, `docs/genesis-audit`, `docs/genesis-phase-0`, `docs/stage-0`, `docs/stage-1`, `docs/genesis-phase-1`), which is unusually thorough and made this audit materially easier to ground in evidence rather than speculation.

The central architectural fact governing everything in this report: **Genesis Phase 1 built a complete, well-designed, pure, dependency-free "Intelligence Foundation" contract layer (`services/intelligence/**`) — Score, Evidence, Recommendation, CalculationContext, EngineRegistry, versioning, typed errors, structural validators — and nothing in the production application imports it.** A repository-wide search for `services/intelligence` imports outside the `services/intelligence` directory itself and outside `tests/` returned zero matches. Every real engine that computes a trust score, a confidence value, a data-quality issue, a duplicate candidate, or an evidence dossier today (`services/data-trust-engine.ts`, `confidence-engine.ts`, `data-quality-engine.ts`, `duplicates-engine.ts`, `evidence-center-engine.ts`, `copernicus-engine.ts`) is a separate, older, SQLite-coupled, Portuguese-language, procedural module that predates the contract layer and has not been touched to conform to it.

Phase 2's job is therefore not "build new intelligence features" — it is **connect the existing, working legacy engines to the existing, unused canonical contracts**, via adapters, without rewriting either side. `docs/genesis-phase-1/10_FUTURE_ROADMAP.md` already recommends exactly this order (adapter layer first, then Data Trust as the first wired engine), and this audit independently arrives at the same conclusion from the code itself — see Section 18.

The second governing fact: **there is no authentication or authorization anywhere in the application.** This is documented as the single most critical open risk across three separate prior audits (`audit-v4/10_SECURITY_AUDIT.md`, `genesis-audit/13_GENESIS_GAP_ANALYSIS.md`, `stage-0/03_SECURITY_REMEDIATION.md`) and this audit's own reading of every mandated API route confirms it remains true today: none of the 27 route files inspected import or call anything resembling auth middleware. Two routes in particular (`/api/data-trust/site`, `/api/evidence-center/site`) perform **unauthenticated writes on a GET request** (recalculating and persisting a trust score / evidence dossier on every call), which is both a REST-safety violation and an unbounded-write vector — a specific new finding this audit adds to the prior record (see Section 16).

The rest of this report documents the evidence behind those two facts, and everything else the Phase 2 mission asked for, in detail. **Go/No-Go recommendation is at the end: Conditional Go**, gated on closing the authentication gap and on running the mandated baseline commands directly on `leonidas-pc` before Phase 2 code is written, since this audit could not do so itself.

---

## 2. Verified Baseline

| Item | Value | Verification status |
|---|---|---|
| Branch | `master` | User-asserted, not independently verified (no shell access) |
| Commit | `06c7d3f` | User-asserted, not independently verified |
| Tag | `genesis-phase-1-v1` | User-asserted, not independently verified |
| Working tree | Clean | User-asserted, not independently verified |
| `npx tsc --noEmit` | PASS | User-asserted. Corroborated by `docs/genesis-phase-1/00_EXECUTIVE_SUMMARY.md`, which records a prior, independently-run `tsc --noEmit` at 0 errors against the same `services/intelligence/**` tree this audit also read. |
| `npm test` | 205/205 PASS | User-asserted, not independently verified. `docs/genesis-phase-1/00_EXECUTIVE_SUMMARY.md` explains `npm test` cannot run at all inside this device-bridge sandbox (Linux VM cannot load Windows-built `@rollup/rollup-linux-x64-gnu`), so a native `leonidas-pc` run — which is what the user reports doing — is the only way to get this result. 24 test files were inventoried and read in this audit (see Section 14); their content is consistent with a large, passing suite, but this audit cannot confirm the exact pass count. |
| `npm run build` | PASS | User-asserted, not independently verified, same platform-binary limitation as above (`@next/swc-linux-x64-gnu`/`-musl` not resolvable from this bridge). |

**Recommendation carried forward from this section alone:** before any Phase 2 commit, re-run all three commands directly in a `leonidas-pc` terminal (not through this or any device-bridge session) and attach the literal output to the Phase 2 kickoff record, exactly as `docs/genesis-phase-1/00_EXECUTIVE_SUMMARY.md` already recommended for Phase 1.

---

## 3. Architecture Map

```
APP/
├── app/                          Next.js App Router — pages + app/api/** (28 route groups, primary API surface)
├── api/                          NOT the API layer — a single legacy helper file (site-query.ts: column list)
├── components/                   React UI (13 files)
├── config/                       JSON rule files (sentinel_rules.json, capabilities.json, copernicus_rules.json, operator_rules.json)
├── core/                         core/site.ts — one file, unified column-name constant
├── database/                     database/schema.ts — one file, re-exports names; NOT real DDL
├── docs/                         6 generations of prior self-audits (audit-v4 → genesis-audit → genesis-phase-0 →
│                                 stage-0 → stage-1 → genesis-phase-1) — extensive, high-quality, load-bearing for this audit
├── importers/                    Python bulk-import pipeline (multi_operator_import.py)
├── lib/                          db.ts, filters.ts, operator.ts, request-guard.ts, export-path.ts, types.ts
├── scripts/                      Python + Node maintenance/migration scripts (backup, restore, geospatial migration)
├── sentinel-core/                "Sentinel Intelligence Graph" (SIG) — a THIRD, separate knowledge-graph subsystem.
│                                 graph/, inference/, recommendation/, knowledge/, relations/ have real logic;
│                                 entities/ and adapters/ are 60–150 byte stub files (see Section 17)
├── services/                     Legacy business-logic engines — procedural, SQLite-coupled, Portuguese-language
│   ├── intelligence/             Genesis Phase 1 canonical contracts — pure, typed, ZERO production consumers
│   └── geospatial/                Stage 1 — geospatial domain, cleanest pure/adapter split in the codebase
└── tests/                        24 test files (vitest)
```

**Architecture style:** a single Next.js monolith with route handlers calling directly into procedural service functions that take a raw `DatabaseSync` connection. No dependency injection, no service container, no ORM (`node:sqlite` used directly with hand-written SQL throughout).

**Canonical layer (Genesis Phase 1, target for Phase 2):** `services/intelligence/**` — pure TypeScript, no I/O, no framework dependency, fully re-exported through `services/intelligence/index.ts`. This is the only layer in the repository built to a written, versioned contract.

**Legacy/production layer (does the real work today):** `services/*-engine.ts` (14 files) plus `services/site-service.ts`, `audit-trail.ts`, `site-notes.ts`. Directly coupled to `node:sqlite`, returns ad-hoc plain objects, writes Portuguese-language user-facing strings inline.

**Transitional layer (best existing template for Phase 2 adapters):** `services/geospatial/**` (Stage 1). This is the one part of the codebase that already practices the split Phase 2 needs everywhere else: pure, dependency-free modules (`coordinate-quality-engine.ts`, `brazil-bounds.ts`, `national-grid.ts`, `spatial-query-utils.ts`, `request-params.ts`, `compact-site.ts`) with a thin SQLite-touching adapter (`spatial-intelligence-engine.ts`) that only orchestrates. The module headers explain *why* (Vitest could not collect a test file that transitively imports `node:sqlite`), and the same pattern was reused verbatim for `services/copernicus-truth.ts` in Stage 0. Phase 2 should follow this exact pattern when adapting legacy engines to the Intelligence Foundation.

**Third, mostly-stub layer:** `sentinel-core/**`. Its own README calls it "this sprint implements the foundation sample/incremental. The build completo dos 299k sites deve ser feito em lotes em sprint futura," and `config/capabilities.json` independently confirms: "Cobre apenas uma amostra da base (modo sample, até 5.000 sites), não a base nacional completa." `sentinel-core/entities/*.ts` and most of `sentinel-core/adapters/*.ts` are 60–150 byte files (directly confirmed by this audit's file listing — e.g. `sqlite-adapter.ts` is 63 bytes, `site-entity.ts` is 77 bytes) — essentially placeholders, not implemented entity boundaries.

**Coupling / dependency direction:** legacy engines depend on `lib/db.ts` (raw `node:sqlite`), `api/site-query.ts` (column list), and each other directly (e.g. `data-trust-engine.ts` imports `confidence-engine.ts` imports `satellite-validation-engine.ts` imports `copernicus-engine.ts`). `services/intelligence/**` depends on nothing outside itself. `sentinel-core/**` depends on `lib/db.ts` and duplicates some of the same concepts (SITE, OPERATOR, TRUST_SCORE nodes) as a separate in-graph representation rather than reusing `core/site.ts` or `services/intelligence/entities/*`.

---

## 4. Repository Inventory (files inspected this session)

141 files staged and read in full via the device file-bridge, spanning:

- **Engines (19):** `alert-engine.ts`, `audit-trail.ts`, `confidence-engine.ts`, `copernicus-engine.ts`, `copernicus-truth.ts`, `data-quality-engine.ts`, `data-trust-engine.ts`, `duplicates-engine.ts`, `enterprise-v3-engine.ts` (listed, not fully read — see Section 14 gaps), `evidence-center-engine.ts`, `market-engine.ts`, `national-timeline-engine.ts`, `rollout-engine.ts`, `satellite-validation-engine.ts`, `sentinel-scoring.ts`, `site-notes.ts`, `site-service.ts`, `strategic-data.ts` (listed, not fully read), `telecom-ai-engine.ts` (listed, not fully read)
- **Geospatial (8):** all of `services/geospatial/**`
- **Intelligence Foundation (43):** all of `services/intelligence/**`
- **Config (4):** `sentinel_rules.json`, `capabilities.json`, `copernicus_rules.json`, `operator_rules.json`
- **API routes (27):** every route named in the mission plus `export`, `system-health`, `copernicus/validation`, `sites/[id]/intelligence`, `sites/[id]/notes`
- **`sentinel-core/**` (26 files):** engine, all adapters, all entities, graph, inference, recommendation, knowledge, relations
- **`lib/`, `core/`, `database/`, `api/` (9 files):** `db.ts`, `filters.ts`, `operator.ts`, `request-guard.ts`, `export-path.ts`, `types.ts`, `core/site.ts`, `database/schema.ts`, `api/site-query.ts`
- **Tests (24):** every file in `tests/`
- **Prior-audit docs (39):** all of `genesis-phase-1/`, `stage-1/`, plus the executive summaries, gap analysis, security, performance, and test-baseline documents from `genesis-audit/`, `genesis-phase-0/`, and `stage-0/`
- **Project files:** `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`, `CHANGELOG.md`

**Not read this session (explicitly, so the gap is visible rather than silent):** `enterprise-v3-engine.ts` and `telecom-ai-engine.ts` full bodies (14KB/4KB, listed and partially referenced via `app/api/export/route.ts` imports but not read line-by-line), `strategic-data.ts` full body, all of `components/**` (13 React files — out of scope for a backend-focused Genesis audit but present in the inventory), `importers/multi_operator_import.py` and the Python `scripts/*.py` files (referenced via prior-audit docs, not opened directly), the 43 non-mandatory API routes outside the mission's explicit list (`dashboard`, `mission-control`, `strategic-planning`, `scenario-planner`, `executive-reports`, `executive-workspace`, `opportunities`, `rollout`, `market`, `site-recommendation`, `digital-twin`, `telecom-ai`, `copernicus/search`, `copernicus/site`, `copernicus/status`, `alerts`). These are flagged, not silently assumed clean.

---

## 5. Phase 1 Contract Audit

Genesis Phase 1 (`docs/genesis-phase-1/`) delivered exactly what its own executive summary claims: a pure contract layer with **zero business logic**. This audit's direct reading of every file under `services/intelligence/` confirms the summary is accurate, not aspirational.

**Score contract** (`scoring/score.ts`): `Score extends BaseEntity<"Score">` — `entity` (reference), `type` (open string, canonical suggestions `risk|opportunity|confidence|priority|data-trust`), `value` (unconstrained number), `classification` (open string, canonical suggestions `LOW|MODERATE|HIGH|CRITICAL`), `confidence` (`UnitInterval`, branded [0,1]), `engineVersion`/`contractVersion` (branded SemVer), `drivers` (explainability array), `evidence` (array of `EvidenceId` references, not embedded), `limitations`, `calculatedAt`, `executionMetadata`.

**Evidence contract** (`evidence/evidence.ts`): `Evidence extends BaseEntity<"Evidence">` — `source`, `description`, `weight`, `reliability` (`UnitInterval`), `snapshot` (`SnapshotId`), `origin` (`DataProvenance`), `checksum`, `references`. `DataProvenance` (`evidence/provenance.ts`) is a separate value object: `origin`, `pipeline`, `snapshot`, `source`, `checksum`, `timestamp`, `version`, `processingMetadata`.

**Recommendation contract** (`recommendations/recommendation.ts`): `Recommendation extends BaseEntity<"Recommendation">` — `reason`, `priority`, `confidence`, `impact` (`ImpactAssessment`), `affectedEntities` (non-empty array, structurally enforced via TypeScript tuple type), `recommendedActions` (ordered `RecommendedAction[]` with `action`/`rationale`/`sequence`), `evidence`, `limitations`.

**Calculation context** (`context/calculation-context.ts`): the single mandated entry-point parameter every future engine must accept — `contextId`, `scope` (`EntityReference | "global"`), `snapshot`, `requestedAt`, `requestedBy`, `correlationId`, `environment` (closed union `production|staging|test|sandbox`), `extensions` (open metadata bag for anything not yet promoted to a typed field).

**Engine interfaces / Registry** (`registry/engine-registry.ts`, `registry/engine-identity.ts`): `EngineRegistry` is an in-memory `Map<EngineId, EngineDeclaration>` with `declare()`/`get()`/`has()`/`list()`/`listByStatus()`. It **declares, never instantiates** — by design, per its own header comment. 11 canonical engine ids are pre-named (`risk`, `opportunity`, `confidence`, `priority`, `data-trust`, `recommendation`, `machine-learning`, `simulation`, `forecast`, `optimization`, `executive-ai`), all still open-ended (`EngineId = CanonicalEngineId | (string & {})`) so future engines aren't blocked by a closed union.

**Validation** (`validation/validators.ts`): `validateBaseEntityShape`, `validateEntityReferenceShape`, `validateScoreShape`, `validateEvidenceShape`, `validateRecommendationShape`, `validateCalculationContextShape` — all structural only (is a field the right JS type / in range), explicitly not business-rule validation, by written design ("business validation belongs to the engines that will be built in future phases").

**Versioning** (`versioning/version.ts`, `versioning/compatibility.ts`): full semantic-version model with `minimumCompatibleVersion` and `breakingChanges: BreakingChangeNote[]`, plus `isVersionCompatible()` — read but not audited line-by-line in this pass; consistent by inspection with the rest of the contract layer's quality bar.

**Typed errors** (`errors/intelligence-error.ts`, `errors/error-codes.ts`): abstract `IntelligenceError extends Error` base with a **closed** `IntelligenceErrorCode` union (6 codes: `CONTRACT_VALIDATION_FAILED`, `VERSION_INCOMPATIBLE`, `ENGINE_NOT_REGISTERED`, `DUPLICATE_ENGINE_DECLARATION`, `EVIDENCE_INTEGRITY_FAILED`, `UNKNOWN_ENTITY_REFERENCE`) and 6 matching subclasses. Deliberately closed, unlike engine/score types, because these describe structural failure modes of the foundation itself, not extensible business concepts.

### Phase 1 vs. Legacy Compatibility Matrix

| Canonical concept | Legacy equivalent(s) in production | Wired together? |
|---|---|---|
| `Score` | `data-trust-engine.ts`'s `trustScore` (0–100, not [0,1]); `confidence-engine.ts`'s 8 sub-confidences + `overallConfidence`; `sentinel-scoring.ts`'s LTS/OPI/SRI/TCI; `satellite-validation-engine.ts`'s `validationScore` | **No.** No legacy score is constructed as, converted to, or validated against a `Score` object anywhere in production code. |
| `Evidence` | `evidence-center-engine.ts`'s ad-hoc `{ type, source, status, summary }` array persisted to `site_evidence_center` | **No.** Structurally incompatible shape (no `reliability`, no `origin`/`DataProvenance`, no `checksum`, no `EvidenceId`). |
| `DataProvenance` | `import_audit` table (SHA-256 hash before/after import, prior-audit-sourced, not re-verified this session) | **No.** A real provenance system exists for the *import* step only; nothing generates a `DataProvenance` record for a score recalculation or an evidence dossier. |
| `Recommendation` | `data-trust-engine.ts`'s free-text `recommendation` string; `sentinel-core/recommendation/recommendation-engine.ts`'s separate recommendation objects | **No.** Two different legacy "recommendation" shapes exist, neither matches the canonical `Recommendation` contract, and they don't match each other either. |
| `CalculationContext` | None — every legacy engine takes `(db, id, persist?)` or similar ad-hoc parameter lists | **No.** |
| `EngineRegistry` | None instantiated anywhere in production | **No.** The class exists; nothing calls `new EngineRegistry()` outside `tests/intelligence-registry.test.ts`. |
| Canonical entities (`Site`, `Operator`, ...) | `core/site.ts`'s `SITE_UNIFIED_COLUMNS`, `services/site-service.ts`'s `siteRow()` | **No.** `siteRow()` returns a flat object with Portuguese field names (`operadoraOrigem`, `municipio`) that has no relation to `services/intelligence/entities/site.ts`'s `BaseEntity<"Site">` shape. |

**Bottom line:** the compatibility matrix has exactly one row value in every "wired together?" column: **No**. This is not a criticism of either side's code quality — both are well-built — it is the single fact that defines the entire Phase 2 scope.

---

## 6. Data Trust Engine Audit (`services/data-trust-engine.ts`)

**API:** `ensureDataTrustTables(db)` (DDL, idempotent `CREATE TABLE IF NOT EXISTS`), `dataTrustForSite(db, siteId, persist=true)`, `recalculateDataTrust(db, limit=500)`, `dataTrustDashboard(db)`, `validationHistory(db, siteId)`, `dataTrustCsvRows(db)`, `validationHistoryCsvRows(db)`.

**Formula** (`dataTrustForSite`, line 85):
```
trustScore = clamp(0,100, round(
  confidence.overallConfidence * 0.78
  + importConfidence * 0.12
  + 10
  - duplicatePenalty
  - alertPenalty
))
```
where `importConfidence = 90 if (dataImportacao || arquivoOrigem) else 30`, `duplicatePenalty = 8 if (same site name >1 row OR same 6-decimal coordinate >1 row) else 0`, `alertPenalty = 8 if geoScore>=81 else 4 if geoScore>=61 else 0`.

**Weighting:** hardcoded literals in-line (0.78, 0.12, 10, 8, 8) — not sourced from `config/sentinel_rules.json` or any other config file. This is the exact gap `docs/genesis-audit/13_GENESIS_GAP_ANALYSIS.md` already flagged for `confidence-engine.ts`'s weights (see Section 7); the same gap exists here too and was not previously documented for this specific engine.

**Thresholds** (`level()`, line 53): 90+ = Muito Alto/Platinum, 75+ = Alto/Gold, 60+ = Medio/Silver, 40+ = Baixo/Bronze, else Critico/Critical. Matched by a parallel `recommendation()` function returning a fixed Portuguese sentence per band — not data-driven, not composable, would need to become `Recommendation.reason` + `RecommendedAction[]` under the canonical model.

**Normalization:** none beyond `Math.max(0, Math.min(100, Math.round(...)))` — the score is *not* a `UnitInterval`; a direct mechanical conversion to canonical `Score.value` would need either a documented [0,100] convention or a `/100` normalization decision (unresolved by Phase 1 on purpose — score ranges are deliberately unconstrained by the contract).

**Dependencies:** `api/site-query.ts` (column list), `services/site-service.ts` (`siteRow`), `services/confidence-engine.ts` (`confidenceForSite`), `services/audit-trail.ts` (`recordAudit`).

**Side effects:** `dataTrustForSite(db, id, persist=true)` — the default — performs two `INSERT`s (`site_trust_scores`, `site_validation_history`) and one audit-trail write **on every call**, including from a `GET` request (see Section 9/16). Not idempotent in the sense of "same result twice" is fine (it's a pure recompute), but it *is* non-idempotent in side-effect terms: every call appends new history rows, growing `site_validation_history` unboundedly under repeated GETs.

**Persistence:** three tables, created lazily on first call (`ensureDataTrustTables`) rather than via a real migration — consistent with `genesis-audit/13_GENESIS_GAP_ANALYSIS.md`'s finding that the schema is fragmented across `importers/multi_operator_import.py`, `database/schema.ts`, and each engine's own `ensure*Tables` function (this audit independently confirms `ensureDataTrustTables` is one more instance of that pattern, not previously named by file in the prior doc).

**Evidence generation:** none in the canonical sense — `dataTrustForSite`'s result embeds the `confidence` sub-scores inline (`...confidence`) rather than citing separate `Evidence` records by id.

**Scale:** `recalculateDataTrust(db, limit=500)` processes at most 500 sites per call; `dataTrustDashboard` bootstraps with `limit=25` only if the table is empty. Against a ~299,308-row table (prior-audit-sourced figure, not re-verified this session), full coverage requires roughly 60 sequential calls to `POST /api/data-trust/recalculate` (itself capped at `min(5000, ...)` per call — see Section 9) with no scheduler or batch job driving it. `docs/genesis-audit/13_GENESIS_GAP_ANALYSIS.md` independently reports 270/299,308 rows scored (0.09%) as of that audit — this session could not re-run that count (no DB access) but the code's default limits are structurally consistent with that low-coverage finding persisting.

---

## 7. Confidence Engine Audit (`services/confidence-engine.ts`)

**Semantic meaning:** "how complete/well-formed is this site's data," not "how likely is this site to be real" (that's Data Trust, which *consumes* Confidence) and not "how good is the data overall across the dataset" (that's Data Quality, which is dataset-wide, not per-site).

**Formula** (`confidenceForSite`, line 39): a straight weighted sum of 8 sub-signals, each independently thresholded:
```
overallConfidence = round(
  coordinateConfidence * 0.20 + addressConfidence * 0.12 + municipalityConfidence * 0.12
  + operatorConfidence * 0.10 + technologyConfidence * 0.10 + satelliteConfidence * 0.16
  + cadastralConfidence * 0.10 + operationalConfidence * 0.10
)
```
Weights sum to exactly 1.00 (0.20+0.12+0.12+0.10+0.10+0.16+0.10+0.10). `cadastralConfidence` is itself a simple mean of address/municipality/operator/technology confidence — meaning those four sub-signals are counted twice (once directly, once folded into `cadastralConfidence`), a soft double-count that inflates their combined influence beyond the nominal weights. This is a specific, previously-undocumented finding.

**Sub-signal rules:** `coordinateConfidence` = 100/0 binary on Brazil-bounds validity; `addressConfidence`/`operatorConfidence`/`technologyConfidence` = 90 if the field is non-empty and not the literal placeholder `"Nao informado"`, else 15/20/20; `municipalityConfidence` = 95 if both municipality and UF present, 45 if only one, else 10; `satelliteConfidence` = delegated wholesale to `satellite-validation-engine.ts` (Section 8); `operationalConfidence` = `100 - geoScore/2` clamped to [20,100] if status is filled, else 35.

**Thresholds:** none of its own — thresholding happens downstream in Data Trust's `level()`.

**Ambiguity:** the `filled()` helper (line 20-23) checks for a literal mojibake string `"NÃ£o informado"` alongside the correctly-encoded `"Nao informado"` — a defensive workaround for an encoding bug somewhere upstream in the import pipeline, not something this audit traced further. Worth a Phase 2 ticket to find and fix at the source rather than carrying the workaround forward indefinitely.

**Explainability/reproducibility:** deterministic given the same DB row and the same `satelliteValidationForSite` result; no `drivers`-style breakdown is returned (all 8 sub-confidences are returned as flat fields, which is *close* to `ScoreDriver[]` but not structurally the same — mapping this to canonical `drivers` is straightforward future adapter work).

**Trust vs. Confidence vs. Quality, explicitly distinguished by this audit's reading:**
- **Confidence** (`confidence-engine.ts`) = per-site, field-completeness-weighted signal, 0–100, one number in, feeds Trust.
- **Trust** (`data-trust-engine.ts`) = per-site, Confidence *plus* import provenance *plus* duplicate/alert penalties, 0–100, the number actually shown to users as "Trust Score."
- **Quality** (`data-quality-engine.ts`) = dataset-wide, issue-counting (not scoring) — "how many rows have this specific problem," with one derived `qualityScore` (`100 - issues/totalRecords*100`) that is structurally unrelated to Trust/Confidence's weighted-sum approach.

These three are legitimately different concepts computed by legitimately different mechanisms — this is *not* an architectural conflict, but Phase 2 should preserve the distinction explicitly (e.g. three different canonical `ScoreType`s: `"confidence"`, `"data-trust"`, and a new dataset-scoped concept for Quality that may not fit `Score`'s per-entity shape at all — see Section 18).

---

## 8. Data Quality Engine Audit (`services/data-quality-engine.ts`)

**Dimensions (8 fixed issue rules, `dataQualitySnapshot`, line 22-30):** missing coordinates (critical), invalid/out-of-Brazil/zeroed coordinates (critical), missing address (high), missing municipality (high), missing UF (high), missing technology (medium), incomplete core fields (medium), UF/estado field mismatch (low). Each rule is a raw SQL `WHERE` clause run twice (once for `COUNT(*)`, once for a 25-row `LIMIT` sample) — 16 queries total per snapshot call, unindexed beyond whatever indices exist on `sites` (not inspected this session).

**Formula:** `qualityScore = max(0, 100 - (totalIssueOccurrences / totalRecords) * 100)` — a single dataset-wide percentage, not a per-site score. Note `totalIssueOccurrences` sums across all 8 rules without deduplication, so a single row failing 3 rules (e.g. missing address + missing municipality + missing UF) is counted 3 times in the denominator's numerator, meaning `qualityScore` is **not** "percentage of clean rows" despite reading that way — it is "1 − (issue-occurrences / row-count)," which can go negative-clamped-to-zero even when most rows are individually fine but each has 2-3 minor issues. This is a specific, previously-undocumented finding worth a decision in Phase 2 (keep as an issue-density index and rename, or change to true clean-row percentage).

**Evidence:** each issue includes a 25-row `sample` array of raw site fields — functions as ad-hoc evidence but, like Evidence Center (Section 6/13), is not a canonical `Evidence` record.

**Recommendations:** none generated by this module — `duplicates-engine.ts` and `data-trust-engine.ts` each carry their own free-text recommendation strings; Data Quality does not.

**Persistence:** none — `dataQualitySnapshot` is computed fresh on every call, no table, no history. This means `GET /api/data-quality` is a genuinely safe, idempotent, side-effect-free read (unlike the two flagged endpoints in Section 6/9) — worth noting as a positive contrast.

---

## 9. API Audit

All 27 route files read this session share the same shape: a thin Next.js route handler (`export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`) calling exactly one service function and wrapping it in `try/catch` → `console.error` → generic Portuguese error JSON with a `500` (or `404`/`400` for specific validation failures). No route imports any authentication, session, or authorization mechanism.

| Route | Method | Request validation | Side effects on this call | Auth |
|---|---|---|---|---|
| `/api/data-trust` | GET | none | none (dashboard bootstraps 25 rows only if table empty) | None |
| `/api/data-trust/recalculate` | POST | `limit` clamped to `[1,5000]`, defaults 500 | Writes up to 5000 trust-score + history rows | None |
| `/api/data-trust/site?id=` | GET | `id` coerced via `Number(...\|\|0)`, no range/existence pre-check | **Writes** trust-score + history row + audit-trail row, every call | None |
| `/api/data-quality` | GET | none | none | None |
| `/api/duplicates` | GET | none | none | None |
| `/api/evidence-center/site?id=` | GET | same as data-trust/site | **Writes** evidence-center rows + triggers a nested `dataTrustForSite(..., persist)` + `copernicusForSite(..., persist)` write, every call | None |
| `/api/evidence-center/export?id=&format=` | GET | `format` unchecked beyond a truthy string compare | Writes a PDF/CSV file to disk (`EXPORTACOES/`) + audit row, every call | None |
| `/api/validation-history/site?id=` | GET | `id` coerced, no bound | none (read-only) | None |
| `/api/sentinel-core/build` | POST | `limit`/`reset` read from body with no bound on `limit` | Rebuilds the SIG graph (potentially expensive) | None |
| `/api/sentinel-core/{insights,municipality,operator,recommendations,search,site,status}` | GET | not inspected line-by-line beyond `build`/`status` (2 of 8 read) | presumed read-only, not fully confirmed this session | None |
| `/api/audit-trail` | GET | none, fixed `limit=200` | none | None |
| `/api/system-health` | GET | none | none — deliberately excludes credentials/paths/stack traces from its response by written design comment | None (by design — documented as intentionally public) |
| `/api/export` (25 report `type` values) | GET | `type` checked against a fixed allow-list; filename built via `sanitizeFilenameSegment`/`resolveExportPath` (Section 16) | Writes a file to `EXPORTACOES/` per call, every call, unconditionally on any valid `type` | None |

**Contract compliance:** zero routes construct, return, or validate a canonical `Score`/`Evidence`/`Recommendation`/`CalculationContext` object. Every response shape is whatever the underlying legacy engine happens to return.

**Runtime risks, beyond the missing-auth finding already covered in Section 1/16:**
- `/api/data-trust/site` and `/api/evidence-center/site` violate HTTP GET's safety expectation (a GET should not have side effects) — this makes them vulnerable to unintentional amplification by crawlers, browser prefetching, CDN/proxy retries, or link scanners, independent of any malicious intent, and grows `site_validation_history`/`site_evidence_center` without bound.
- `/api/sentinel-core/build`'s `limit` is read from the request body with no documented upper clamp in the route file itself (the clamp, if any, would need to live in `sentinel-core/graph/graph-builder.ts`, not read this session — flagged as unverified, not assumed safe).

---

## 10. Coordinate Audit

All coordinate-validation logic was traced to exactly two pure modules plus one duplicated inline check:

- **`services/geospatial/brazil-bounds.ts`** — canonical bounding box `{ minLatitude: -34, maxLatitude: 6, minLongitude: -75, maxLongitude: -32 }`, with a documented 0.5°-tolerance "near border" band and an explicit, well-written caveat that this is a bounding rectangle, not real municipality/country polygons (it also covers slivers of Bolivia, Paraguay, Peru). `suspectedLatLonSwap()` implements inversion detection: if the raw pair fails bounds but the swapped pair passes, flag `"suspicious"` — never auto-corrects, per the module's stated Stage 1 safety rule.
- **`services/geospatial/coordinate-quality-engine.ts`** — the single per-site classifier (`evaluateCoordinateQuality`), producing one of 11 statuses (`valid`, `missing`, `invalid_latitude`, `invalid_longitude`, `invalid_pair`, `outside_brazil`, `zero_coordinate`, `duplicate_exact`, `duplicate_dense`, `suspicious`, `requires_review`), each with a fixed confidence value and mapped to `eligibleForMapping`/`eligibleForSentinel` booleans. This is the most rigorously documented module read in this audit.
- **Duplicated inline bounds check:** `services/data-trust-engine.ts` (line 26, in `confidence-engine.ts` actually — `validCoordinate()`), `services/copernicus-engine.ts` (`validateSiteCoordinates`), and `services/data-quality-engine.ts`'s SQL `WHERE` clause (line 24) **each re-implement the same `-34/6/-75/-32` rectangle check independently**, rather than importing `BRAZIL_BOUNDS`/`classifyBrazilBounds` from `brazil-bounds.ts`. All three currently use identical numeric literals (verified by direct comparison of the four call sites), so there is no drift *today*, but there is no structural guarantee against drift going forward — a future change to the bounds in one place would silently desynchronize from the other three. This is a concrete, previously-undocumented duplication finding (the `brazil-bounds.ts` header comment only claims consistency with `data-quality-engine.ts`'s check, not the other two).

**Normalization:** none — coordinates are stored and compared as-is; `coordinate-quality-engine.ts` rounds to 6 decimal places only for duplicate-exact comparison purposes (in `duplicates-engine.ts`, not itself).

**Inversion detection:** `suspectedLatLonSwap()`, described above — implemented and unit-tested (`tests/geospatial-brazil-bounds.test.ts`), but not wired into `data-trust-engine.ts` or `confidence-engine.ts`'s own coordinate checks (those remain simple binary valid/invalid, with no swap-detection benefit).

**Duplicated coordinates:** detected by `services/duplicates-engine.ts` (exact 6-decimal match) and `coordinate-quality-engine.ts`'s `isDuplicateExact`/`isDuplicateDense` **input flags** — but, per Section 17 below, those flags are never actually populated by any caller today, so the `duplicate_exact`/`duplicate_dense` status branches in `coordinate-quality-engine.ts` are currently dead code in production (confirmed by reading `spatial-intelligence-engine.ts` in full: it never imports or calls `duplicates-engine.ts`, and never sets `isDuplicateExact`/`isDuplicateDense`). `docs/stage-1/00_STAGE_1_SUMMARY.md` names this wiring as deferred to an unstarted "WP1.11 processing command" work item, so this is a known, tracked gap rather than an oversight — but it was not previously stated as plainly as "these two statuses cannot currently be reached."

**Suspicious coordinates:** `suspicious` status (inversion-suspected) and `requires_review` status (near-border) both correctly surface for human review without auto-correcting, consistent with the module's stated safety rule.

---

## 11. Duplicate Detection Audit

**Algorithm** (`services/duplicates-engine.ts`), four independent SQL passes, each capped at 25 results:
1. **Exact site-id match** (`mesma_sigla`): `GROUP BY site HAVING COUNT(*) > 1`.
2. **Exact coordinate match** (`mesma_coordenada`): `GROUP BY ROUND(latitude,6), ROUND(longitude,6) HAVING COUNT(*) > 1`.
3. **Dense coordinate cluster** (`coordenadas_proximas`): `GROUP BY ROUND(latitude,3), ROUND(longitude,3) HAVING COUNT(*) BETWEEN 2 AND 50` (~100m grid cells, per the coordinate-quality-engine's own comment cross-referencing this).
4. **Same normalized address** (`mesmo_endereco`): `GROUP BY municipio, uf, endereco HAVING COUNT(*) > 1`.

**Complexity:** each pass is a single `GROUP BY ... HAVING` over the full `sites` table — O(n log n) at the database level for the grouping, no spatial index used (this predates Stage 1's R-Tree work and has not been retrofitted to use it). At ~299,308 rows (prior-audit-sourced, not re-verified), four full-table grouped scans per `GET /api/duplicates` call is the main duplicate-detection performance concern for Section 15.

**Spatial indexing:** none used by this module. The Stage 1 R-Tree spatial index (`site_spatial_index`) exists (Section 15) but is only consumed by `services/geospatial/spatial-intelligence-engine.ts`, not by `duplicates-engine.ts`.

**Deterministic behavior:** yes — pure SQL aggregation, same input always produces same output, no randomness.

**False positives:** rounding-based coordinate matching (3 or 6 decimals) will flag legitimately co-located but distinct infrastructure (e.g. shared tower sites, which the `mesma_coordenada` recommendation text itself acknowledges: "Validar compartilhamento de estrutura ou duplicidade de ponto geografico"). Address matching is similarly acknowledged as needing human judgment for co-located different-technology sites. The engine's own recommendation strings correctly frame every result as a *candidate* requiring review, not a confirmed duplicate — a good practice already in place.

**False negatives:** near-but-not-identical addresses with typos, abbreviation differences, or the encoding-mojibake issue noted in Section 7 would not be caught by the exact-string `GROUP BY endereco` — no fuzzy matching exists anywhere in this module.

---

## 12. Source & Provenance Audit

- **Import-time provenance:** `import_audit` table with SHA-256 hash before/after and an "excel_inalterado" (unchanged-original) flag — prior-audit-sourced (`docs/genesis-audit/13_GENESIS_GAP_ANALYSIS.md`), not re-verified this session (would require DB access this audit doesn't have). Genuinely covers the *import* step only.
- **Post-import provenance:** none found. Recalculating a trust score, a confidence value, or building the SIG graph does not record *which algorithm version* produced the new value — `site_trust_scores`/`site_validation_history` store the score and a free-text recommendation, but no `engineVersion`/`contractVersion`/pipeline identifier, unlike what the canonical `DataProvenance` contract would require.
- **Transformation history:** `site_validation_history` is the closest thing to a transformation log, but it is scoped specifically to Data Trust recalculations, not a general-purpose provenance chain.
- **Source reliability:** not modeled anywhere as a first-class concept — `Evidence.reliability` (canonical) has no legacy counterpart; the closest proxy is `confidence-engine.ts`'s per-field confidence, which conflates "is this field filled in" with "is this field trustworthy."

---

## 13. Evidence Audit

**Legacy evidence model** (`evidence-center-engine.ts`): a fixed array of 5 evidence items per site (`CADASTRO`, `COORDENADAS`, `COPERNICUS`, `QUALIDADE`, `OBSERVACOES`), each `{ type, source, status, summary }`, persisted to `site_evidence_center` with an additional `evidence_url` (Google Maps link, coordinates only) and `evidence_json` (the same object re-serialized). No weight, no reliability, no checksum, no snapshot reference.

**Evidence lifecycle:** created fresh on every `evidenceCenterForSite()` call (triggered by both `GET /api/evidence-center/site` and the export route) — no update/supersede/invalidate lifecycle exists; old rows simply accumulate.

**Evidence generation:** derived synchronously from four other engines' current output at request time (trust, Copernicus, notes, validation history) — not independently sourced or citable the way canonical `Evidence.origin`/`checksum` would require.

**Evidence persistence:** `site_evidence_center` table, unbounded growth under repeated GET calls (same finding as Section 6/9).

**Evidence exports:** `dossierLines()` renders the evidence set as a flat list of labeled strings, exported as CSV or PDF via `/api/evidence-center/export`. This is a genuinely useful human-readable "technical dossier" format — worth preserving as a rendering layer on top of canonical `Evidence[]` in Phase 2 rather than replacing outright.

---

## 14. Test Audit

24 test files inventoried and read this session (file names below reflect the actual repository content, not the mission's assumed geospatial-only or intelligence-only naming):

**Contract/foundation tests (9):** `intelligence-context`, `intelligence-entities`, `intelligence-errors`, `intelligence-evidence-model`, `intelligence-recommendation-model`, `intelligence-registry`, `intelligence-score-contract`, `intelligence-validation`, `intelligence-versioning`. Sample read in full: `intelligence-score-contract.test.ts` — tests structural validity, open-ended type/classification acceptance (a `"future-engine-type"` score type is correctly accepted), and specific structural-rejection cases (`confidence: 87` outside [0,1], a missing `drivers` array). Good coverage of the contract's stated design goals; **zero tests exercise a real engine producing a real Score** — consistent with Section 5's finding that nothing consumes the foundation yet.

**Geospatial tests (9):** `geospatial-api-contract`, `geospatial-brazil-bounds`, `geospatial-compact-site`, `geospatial-coordinate-quality`, `geospatial-national-grid`, `geospatial-request-params`, `geospatial-spatial-engine-contract`, `geospatial-spatial-index`, `geospatial-spatial-intelligence-engine`. Per `docs/stage-1/08_TEST_RESULTS.md` (not fully re-read this session, cited from its summary in `00_STAGE_1_SUMMARY.md`), several of these are deliberately **source-inspection tests** (reading a file as text and regex-matching it, e.g. to prove `spatial-intelligence-engine.ts` delegates to `spatial-query-utils.ts` rather than duplicating logic) rather than executing the module — a workaround for `node:sqlite` not being collectible by Vitest, not a weaker form of testing by intent, but worth knowing when reasoning about "what does green here actually prove."

**Other (6):** `capabilities-registry`, `copernicus-engine-contract`, `copernicus-truth`, `csv` (confirms the CSV-injection mitigation from Section 16), `export-path` (confirms the path-traversal mitigation from Section 16), `request-guard`.

**Gaps identified by this audit (not previously stated this way in prior docs):**
- No test exercises `data-trust-engine.ts`, `confidence-engine.ts`, `data-quality-engine.ts`, or `duplicates-engine.ts` directly — the four engines named as "mandatory inspection" in this mission have **zero dedicated test files**. Their correctness is presently unverified by the automated suite; this audit's read is the first structural review of their logic on record in this repository's `docs/`.
- No test asserts the "one bounds rectangle, four call sites" consistency flagged in Section 10 — a regression there would not be caught automatically.
- No integration test exercises a full API route end-to-end (all API-adjacent tests are source-inspection or pure-module tests, per the Stage 1 pattern) — meaning route-level concerns (the GET-with-side-effects issue in Section 9/16, the missing-auth gap) have no test surface at all, by design, since there is nothing to assert yet.
- No test covers `sentinel-core/**` beyond source-referenced usage elsewhere — the graph builder, inference engine, and recommendation engine (all real logic, not stubs) have no dedicated `tests/sentinel-core-*.test.ts` file found in this inventory.

---

## 15. Performance Audit (considering ~299,308 telecom records — prior-audit-sourced row count, not re-verified this session)

**Data Trust / Confidence:** O(1) per site per call, but full-database coverage requires ~60 sequential `POST /api/data-trust/recalculate` calls at the 5000-row cap, with no scheduler — see Section 6. `duplicatePenalty()` inside `dataTrustForSite` runs two additional `COUNT(*)` queries per site (same-site-name, same-6-decimal-coordinate) with no index confirmed for either (not inspected this session) — at scale, recalculating trust for many sites in sequence means 2×N extra queries beyond the base `SELECT`.

**Data Quality:** 16 full-table-scanning queries per `GET /api/data-quality` call (Section 8) — this is a dataset-wide dashboard endpoint, not per-site, so the cost is paid once per dashboard load rather than per site, which is the right shape for this workload, but each of the 8 rules' `COUNT(*)` + `LIMIT 25` sample pair could plausibly be combined into a single query with `COUNT(*) OVER()` if this becomes a measured bottleneck — not verified as a bottleneck this session, flagged as a candidate only.

**Duplicates:** four full-table `GROUP BY` scans per call, no spatial index used (Section 11) — the most expensive of the mandatory-inspection endpoints by inspection, and the one most likely to benefit from Stage 1's R-Tree index if duplicate-coordinate detection were rewritten to use it (currently it is not).

**Geospatial (Stage 1, the most performance-conscious code read this session):** explicit, documented, real-database-measured limits throughout — `MAX_BBOX_LIMIT=5000`, `MAX_CLUSTER_CANDIDATES=50000` (raised from an original 5000 specifically because a whole-country cluster request was found to sample only ~1.7% of the national dataset — a real, measured, fixed regression documented in `docs/stage-1/07_GEOSPATIAL_APIS.md`), `MAX_SQL_IN_CLAUSE_SIZE=900` (chosen conservatively below SQLite's pre-3.32.0 999-variable ceiling), expanding-radius search for nearest-site queries capped at `maxRadiusKm=200`. This is the only subsystem in the repository with performance numbers actually measured against a full-scale copy of the production database (per `docs/stage-1/07_GEOSPATIAL_APIS.md`, cited, not re-run this session) rather than reasoned about in the abstract — a strong template for how Phase 2 should validate any new engine's cost at scale.

**Caching:** `lib/db.ts` sets `PRAGMA cache_size = -64000` (64MB) on the read-only connection and `PRAGMA journal_mode = WAL` on the writable one — reasonable SQLite-level tuning; no application-level (in-memory or HTTP) caching layer exists anywhere, so every dashboard/engine call re-reads and re-computes from SQLite on every request.

**Incremental calculation:** none of the mandatory-inspection engines support incremental/delta recalculation — every recalculation is a full recompute for the requested site(s). At national scale, this means "recalculate trust for all 299,308 sites" is O(N) full recomputes with no way to skip unchanged rows.

**Recalculation strategy going forward:** Phase 2 should decide explicitly whether canonical `Score` recalculation is triggered on-demand (current pattern, risks the GET-side-effect problem), on a schedule (needs a job runner, none exists today), or on data change (needs change-detection, none exists today) — this is presently undecided anywhere in the repository, including the Phase 1 roadmap doc, which explicitly leaves persistence and triggering unresolved (Section 5).

---

## 16. Security Audit

**Authentication / Authorization:** absent from every one of the 27 routes read this session, confirmed by direct inspection (no imports of any auth/session/JWT/middleware pattern in any route file). This matches three independent prior findings (`audit-v4/10_SECURITY_AUDIT.md`, `genesis-audit/13_GENESIS_GAP_ANALYSIS.md` — labeled there as "a maior lacuna binária do projeto: zero controle de acesso" — and `stage-0/03_SECURITY_REMEDIATION.md`, which explicitly states its own fixes "não fazem a aplicação 'segura' em sentido geral"). **Unchanged as of this audit.**

**CSV/Excel formula injection:** **already mitigated.** `docs/stage-0/03_SECURITY_REMEDIATION.md` documents WP0.6 closing audit-v4 risk R6 (CWE-1236) by prefixing any cell beginning with `=`, `+`, `-`, `@`, or a raw tab/CR with a leading apostrophe, on both the TypeScript (`utils/csv.ts`) and Python (`importers/multi_operator_import.py`) sides, tested by `tests/csv.test.ts`. This audit did not re-open `utils/csv.ts` directly this session but did confirm every CSV-producing route (`export/route.ts`, `evidence-center/export/route.ts`) imports and calls `csvRows` from that module rather than hand-writing CSV — consistent with the mitigation actually being in the code path, not just documented.

**Path traversal on export filenames:** **already mitigated.** WP0.5 (`lib/export-path.ts`, read in full this session) — `sanitizeFilenameSegment` (NFKD-normalize, strip diacritics, allow-list `[A-Za-z0-9_-]`, cap 80 chars) and `resolveExportPath` (basename first, then verify the resolved absolute path still starts with the resolved export root) are both genuinely sound implementations, and every export call site inspected this session (`export/route.ts`, `evidence-center/export/route.ts`) uses them. `tests/export-path.test.ts` (not re-opened this session, cited from the security-remediation doc) exercises an actual `../../../etc/passwd` traversal attempt.

**DoS risk / unbounded queries:** `lib/request-guard.ts`'s `clampQueryText`/`clampQueryNumber` exist and are documented as applied to exactly 2 of the (per `stage-0/03_SECURITY_REMEDIATION.md`) ~43 total API endpoints (`telecom-ai`, `geointelligence`). **None of the 12 mandatory-inspection endpoints in this mission use `request-guard.ts`.** Specifically: `data-trust/site`, `evidence-center/site`, and `validation-history/site` all coerce their `id` query param via bare `Number(...)` with no `clampQueryNumber` bound and no existence pre-check beyond the downstream `SELECT ... WHERE id = ?` returning nothing — not a SQL-injection risk (parameterized), but an uncapped/unvalidated-input gap relative to the pattern the codebase has already established elsewhere for exactly this class of problem.

**Recalculation endpoint:** `POST /api/data-trust/recalculate` clamps `limit` to `[1, 5000]` — a real, working bound — but has no authentication, so any unauthenticated caller can trigger up to 5000 trust-score recalculations (each writing 2 rows + 1 audit row = up to 15,000 writes) per call, repeatedly, with no rate limit. Combined with the missing-auth finding, this is the single most concrete "DoS-adjacent" endpoint found in the mandatory scope.

**GET-with-side-effects (new finding, not previously documented in the prior audit trail read this session):** `GET /api/data-trust/site` and `GET /api/evidence-center/site` both call their underlying engine function with `persist=true` by default, meaning every page load, browser prefetch, link-preview crawler hit, or automated retry against these URLs writes new rows to `site_trust_scores`/`site_validation_history`/`site_evidence_center` and appends an audit-trail entry. This both violates HTTP GET's safety expectation and is an unbounded-write vector that `request-guard.ts`'s existing pattern does not currently cover (it guards *input shape*, not *write-on-read*).

**Internal leakage:** `system-health/route.ts` is a positive example — its own header comment explicitly enumerates what it will never return (credentials, tokens, connection strings, env vars, full filesystem paths, usernames, per-row data) and its error branch deliberately omits `error.message`/stack traces specifically because the SQLite driver's own error strings can embed the absolute DB file path. No other route read this session was audited line-by-line for equivalent leakage, but the general error-handling pattern across all 27 routes (`catch` → `console.error(msg only)` → generic Portuguese JSON error) appears consistent with not leaking internals to the client, by inspection.

**Audit trail:** exists and is real (`services/audit-trail.ts`, `audit_trail` table, 288 rows per prior-audit-sourced figure) but is itself unauthenticated to read (`GET /api/audit-trail`) and unauthenticated to *generate* (any unauthenticated caller can flood it via the recalculation/evidence endpoints above) — a governance log that isn't protected is a weaker governance log.

---

## 17. Architectural Conflicts

- **Three parallel "risk" concepts**, not consolidated (prior-audit-sourced from `genesis-audit/13_GENESIS_GAP_ANALYSIS.md`, structurally corroborated this session): `risco`/`ori_risk` (persisted import-time columns, present in `SITE_SELECT_COLUMNS`), an inline `risk` recalculation referenced from `app/api/dashboard` (not opened this session), and municipal `SRI` in `services/sentinel-scoring.ts` (opened at a high level, not line-audited). No single Risk Engine exists despite `services/intelligence/registry`'s `"risk"` canonical engine id already being declared as a *planned* concept.
- **Three-tier, undocumented-as-a-whole scoring pipeline:** Copernicus validation score (`copernicus_rules.json`'s own `scoring` weights) feeds into `confidence-engine.ts`'s `satelliteConfidence` (16% weight) feeds into `data-trust-engine.ts`'s `trustScore` (78% weight on overall confidence). Each stage is individually well-documented; the *composite* formula (effectively `trustScore ≈ 0.78 × (... + 0.16 × copernicusScore + ...) + ...`) is not written down anywhere as a single expression — a new engineer reading only `data-trust-engine.ts` would not see that Copernicus/Sentinel-1 simulated data contributes roughly 12.5% (0.78 × 0.16) of the final Trust Score without tracing three files.
- **Two structurally incompatible "evidence" models**, per Section 5/13: canonical `Evidence` (unconsumed) vs. legacy evidence-center array (in production, unrelated shape).
- **Two structurally incompatible "recommendation" models**: canonical `Recommendation` (unconsumed) vs. `sentinel-core/recommendation/recommendation-engine.ts`'s own recommendation objects (in production, separate shape, separate rule set — `sentinel-core/recommendation/recommendation-rules.ts` is 324 bytes, read this session, a small fixed rule table) vs. free-text `recommendation` strings embedded directly in `data-trust-engine.ts` and `evidence-center-engine.ts`. **Three** recommendation shapes, not two.
- **Two independent knowledge/entity models covering overlapping ground:** `services/intelligence/entities/*` (canonical, unconsumed, 10 entity types) vs. `sentinel-core/entities/*` (mostly 60-150 byte stubs, referenced by the SIG graph's node types SITE/MUNICIPALITY/STATE/OPERATOR/TECHNOLOGY/...) — both model "a Site," "a Municipality," "an Operator" as first-class concepts, independently, with no shared definition and no cross-reference between them.
- **Coordinate-bounds duplication** across four call sites (Section 10) — currently consistent in value, structurally unenforced.
- **Layer violation, minor:** `api/site-query.ts` (a single top-level file, not part of `app/api/**`) is imported by `services/site-service.ts`, `services/data-trust-engine.ts`, `services/copernicus-engine.ts`, and `services/geospatial/spatial-intelligence-engine.ts` — i.e., a file literally named `api/` is really a `services`-layer shared constant, and its location one level above `services/` (as a sibling of `app/`) makes the directory name misleading relative to what actually lives in `app/api/`. Not a functional problem, a naming/location clarity issue worth a low-cost rename in Phase 2 (e.g. to `services/shared/site-query.ts`).
- **`sentinel-core` naming collision with Sentinel-1:** `config/capabilities.json` itself flags this explicitly ("Sem relação com o satélite Sentinel-1 — é um grafo de conhecimento interno") — the knowledge-graph subsystem and the satellite-data subsystem share the word "Sentinel" for unrelated reasons, a real source of confusion this audit had to actively guard against while writing this report, and a strong argument for a Phase 2 rename (e.g. `knowledge-graph/` instead of `sentinel-core/`) if the churn cost is acceptable.

---

## 18. Target Architecture (Phase 2 recommendation)

**Guiding constraint, restated from the mission brief and independently confirmed correct by this audit: prefer adapters, do not rewrite.** Both the legacy engines and the canonical contract layer are independently well-built; the gap between them is a wiring problem, not a quality problem on either side.

**Preserve, unchanged:**
- `services/intelligence/**` — the canonical contract layer itself. It has zero known defects found this session and is explicitly designed to be extended (open `ScoreType`/`ScoreClassification`/`EngineId`, `extensions` bags) rather than modified. `docs/genesis-phase-1/09_IMPLEMENTATION_GUIDE.md`'s own rule ("do not modify `services/intelligence/` casually") should stand for Phase 2 too.
- `services/geospatial/**`'s pure/adapter split — use as the literal template for every other adapter Phase 2 writes.
- `lib/export-path.ts`, `utils/csv.ts`'s injection mitigation, `lib/request-guard.ts` — all three are correct, tested, narrow-scope security fixes; extend their *coverage*, don't replace their *design*.
- `config/capabilities.json` — the "single source of truth for what the interface may claim" pattern is exactly right and should gain new entries as Phase 2 wires up canonical engines, rather than being bypassed.

**Refactor (in place, same files, same behavior, cleaner internals):**
- `services/confidence-engine.ts` — resolve the `cadastralConfidence` double-count (Section 7) as a deliberate decision (keep and document, or remove the double-count), and externalize its 8 weights into `config/sentinel_rules.json` alongside LTS/OPI/SRI, closing the exact gap `genesis-audit/13_GENESIS_GAP_ANALYSIS.md` already named for it.
- `services/data-trust-engine.ts` — externalize its own hardcoded weights (0.78/0.12/10/8/8) the same way.
- The four duplicated Brazil-bounds checks (Section 10) — replace the three inline copies in `confidence-engine.ts`, `copernicus-engine.ts`, and `data-quality-engine.ts`'s SQL with imports from `services/geospatial/brazil-bounds.ts`, which already exists and is already the more rigorously tested implementation.

**Adapt (new thin adapter modules, following the geospatial pattern, wrapping existing engines without modifying their internals):**
- A `services/intelligence/adapters/` (or similar) directory containing, per `docs/genesis-phase-1/10_FUTURE_ROADMAP.md`'s own recommended order:
  1. An entity adapter turning `core/site.ts`/`services/site-service.ts` row data into `EntityReference<"Site">`/canonical `Site` entities, without modifying either source.
  2. A Data Trust adapter: wraps `dataTrustForSite()`'s existing output into a `Score` (`type: "data-trust"`), constructing `ScoreDriver[]` from the existing confidence sub-scores/duplicate/alert penalties, and declaring the engine in a real `EngineRegistry` instance for the first time in production. This is the correct first target per the Phase 1 roadmap's own reasoning (most direct existing signal, exercises Score+Evidence+Registry end-to-end with the least new logic) and this audit's independent reading agrees.
  3. An Evidence adapter: wraps `evidence-center-engine.ts`'s 5-item array into canonical `Evidence[]`, with `DataProvenance` populated from `import_audit` where available and a documented placeholder where it is not (e.g. Copernicus's simulated data, whose `dataStatus: "simulated"` truth-contract from `copernicus-truth.ts` should map directly onto `Evidence.reliability` being deliberately low, not silently omitted).
  4. A Recommendation adapter, once at least one Score-producing adapter exists to react to (per the roadmap's own sequencing) — this should also be the point where the three existing recommendation shapes (Section 17) get reconciled into one canonical `Recommendation` producer, rather than adding a fourth shape.

**Replace:** nothing identified this session rises to "replace" — every legacy engine's core logic is sound; the issues found are missing config externalization, missing wiring, missing auth, and missing tests, not wrong algorithms.

**Postpone (explicitly, not silently dropped):**
- `sentinel-core/entities/*` and most of `sentinel-core/adapters/*` — these are stubs; deciding whether to implement them for real or fold their intent into `services/intelligence/entities/*` is a real design decision (flagged by `genesis-audit/13_GENESIS_GAP_ANALYSIS.md` too: "Decidir explicitamente: implementar as entidades/adapters de verdade, ou remover a expectativa") that should not be made implicitly by whichever engine happens to touch it first in Phase 2.
- Full-database Data Trust coverage (Section 6/15) — running recalculation against all ~299,308 rows is an operational/scheduling decision (needs a job runner or a documented manual runbook), separate from and blocking-independent-of the contract-wiring work above.
- A true Risk Engine consolidating the three existing risk concepts (Section 17) — real design work, not a mechanical adapter, and should follow Data Trust/Recommendation rather than compete with them for Phase 2's first slot.

**Non-negotiable prerequisite, not really part of "target architecture" but blocking it:** authentication/authorization (Section 16). Wiring canonical `Score`/`Evidence`/`Recommendation` objects into still-unauthenticated endpoints does not reduce the risk documented in three prior audits — if anything, an `/api/data-trust/recalculate`-style endpoint becomes more attractive to abuse once it's producing richer, more structured output. This audit recommends treating basic auth (even a single shared-secret header, as a minimal first step) as a Phase 2 increment 0, before or in parallel with the first contract-wiring increment, not after it.

---

## 19. Implementation Plan (small, auditable increments)

**Increment 0 — Baseline & Auth Floor**
*Objective:* Establish ground truth this audit couldn't (native `leonidas-pc` tsc/test/build run) and close the most critical open security gap with minimal footprint.
*Affected files:* none (baseline re-run); new: a minimal auth-check module (design TBD — even a shared-secret header check is a legitimate first step) applied first to the two GET-with-side-effects routes (`data-trust/site`, `evidence-center/site`) and the recalculation endpoint (`data-trust/recalculate`).
*New files:* e.g. `lib/auth-guard.ts`.
*Tests:* `tests/auth-guard.test.ts` (boundary cases: missing header, wrong secret, correct secret).
*Acceptance criteria:* the three routes above return `401` without valid credentials; all existing tests remain green; `tsc --noEmit` clean.
*Rollback:* revert the single new file and its three call-site additions; no schema change involved.

**Increment 1 — Externalize hardcoded weights**
*Objective:* Move Confidence Engine's 8 weights and Data Trust Engine's 5 constants into `config/sentinel_rules.json`, resolving the gap named in `genesis-audit/13_GENESIS_GAP_ANALYSIS.md` for Confidence and newly identified in this audit for Trust.
*Affected files:* `services/confidence-engine.ts`, `services/data-trust-engine.ts`, `config/sentinel_rules.json`.
*New files:* none.
*Tests:* update/extend any existing confidence/trust tests (none exist today per Section 14 — this increment should add the first ones) to assert the computed value matches config-driven weights, not literals.
*Acceptance criteria:* identical output for identical input before/after (a pure refactor); config file is now the single source of the weights; `tsc`/tests/build green.
*Rollback:* revert both engine files and the config addition together (they must move as a pair).

**Increment 2 — Consolidate Brazil-bounds checks**
*Objective:* Replace the three duplicated inline bounds checks (Section 10/17) with imports from `services/geospatial/brazil-bounds.ts`.
*Affected files:* `services/confidence-engine.ts`, `services/copernicus-engine.ts`, `services/data-quality-engine.ts`.
*New files:* none.
*Tests:* extend `tests/geospatial-brazil-bounds.test.ts` coverage to cover the three new call sites' expected behavior (already-passing values should not change).
*Acceptance criteria:* identical classification output for all previously-tested coordinates; single source of truth confirmed by a source-inspection test (following the Stage 1 pattern) asserting no other file in `services/` re-declares the `-34/6/-75/-32` literals.
*Rollback:* revert the three call sites; `brazil-bounds.ts` itself is untouched either way.

**Increment 3 — Entity adapter**
*Objective:* First adapter turning existing site row data into canonical `EntityReference<"Site">`/`Site` entity, per the geospatial pure/adapter pattern, without modifying `core/site.ts` or `services/site-service.ts`.
*Affected files:* none existing.
*New files:* `services/intelligence-adapters/site-adapter.ts` (pure), plus a thin caller wiring where first needed.
*Tests:* `tests/intelligence-adapters-site.test.ts`, following the source-inspection + pure-unit-test split already used in `tests/geospatial-spatial-engine-contract.test.ts`.
*Acceptance criteria:* adapter produces a structurally-valid `Site` entity (checked via existing `validateBaseEntityShape`/entity-specific validators) for a range of real and edge-case site rows (missing fields, the mojibake encoding issue from Section 7, etc.); no existing route's behavior changes (adapter is additive, not yet wired into any route).
*Rollback:* delete the new file(s); zero blast radius on existing code.

**Increment 4 — Data Trust → Score adapter**
*Objective:* Wrap `dataTrustForSite()`'s existing computation into a canonical `Score` (`type: "data-trust"`), with a real `EngineRegistry` declaration, per Phase 1's own recommended first-engine order.
*Affected files:* none existing (adapter wraps, does not modify, `data-trust-engine.ts`).
*New files:* `services/intelligence-adapters/data-trust-score-adapter.ts`, an engine-registration module (location TBD — the roadmap deliberately left "where does an EngineRegistry instance live at runtime" open; this increment should decide it).
*Tests:* `tests/intelligence-adapters-data-trust.test.ts` — assert the adapter's `Score` output validates against `validateScoreShape`, and that `Score.value`/`classification` correctly reflect the underlying `trustScore`/`trustBadge` for representative inputs.
*Acceptance criteria:* new adapter is unit-tested and validated but **not yet exposed via any API route** in this increment (keep the blast radius to "a new, additive, internally-consistent code path"); existing `/api/data-trust/*` routes are completely unchanged.
*Rollback:* delete the new adapter/registration files.

**Increment 5 — Expose the canonical Data Trust Score via a new, additive endpoint**
*Objective:* First production consumer of the wired Score, without touching the existing `/api/data-trust/*` routes (avoids breaking any existing UI dependency).
*Affected files:* `config/capabilities.json` (add/adjust an entry reflecting the new canonical-shaped endpoint's status).
*New files:* e.g. `app/api/intelligence/data-trust/site/route.ts` — same underlying computation as the existing route, canonical-shaped response, and (per Increment 0) behind the auth guard from day one, and GET without side effects (persist should default to `false` here, breaking from the existing route's pattern deliberately — see Section 9/16).
*Tests:* route-level test following the existing source-inspection pattern (`tests/intelligence-data-trust-api-contract.test.ts`), asserting the response validates against `validateScoreShape`.
*Acceptance criteria:* new endpoint returns a valid `Score`; existing `/api/data-trust/*` endpoints byte-for-byte unchanged; auth guard active; no new unauthenticated write surface introduced.
*Rollback:* delete the new route file; no shared-state changes to unwind.

**Increment 6 onward (not detailed to the same depth, sequenced per Section 18):** Evidence adapter → Recommendation adapter (reconciling the three existing recommendation shapes) → repeat the Score-adapter pattern for Confidence and Data Quality → decide and either implement or retire `sentinel-core/entities`/`adapters` stubs → extend `request-guard.ts` coverage to the remaining ~41 endpoints → design a real Risk Engine consolidating the three existing risk concepts → decide and implement a recalculation-trigger strategy (Section 15).

Each increment above follows the same shape deliberately: additive where possible, existing routes/behavior left untouched until a dedicated increment explicitly migrates them, and a stated rollback that never requires a database rollback (no increment in this plan touches existing table schemas).

---

## 20. Go / No-Go Recommendation

**Conditional Go.**

The codebase is in materially better shape for a Phase 2 than the mission's cautious framing might suggest: the canonical contract layer is well-designed and defect-free by this audit's reading, the legacy engines it needs to wire to are individually sound, and the one subsystem (`services/geospatial`) that has already gone through an adapter-pattern migration provides a proven, documented template to repeat. The self-audit trail this repository already maintains (six generations deep) is itself evidence of a disciplined process worth continuing rather than disrupting with a rewrite.

Two conditions should be satisfied before Phase 2 implementation work begins, not after:

1. **Re-run `npx tsc --noEmit`, `npm test`, and `npm run build` directly on `leonidas-pc`** (outside any device-bridge session) and record the literal output, since this audit could not do so itself and the user-asserted 205/205 figure, while plausible and consistent with documented environment constraints, has not been independently confirmed by this or any prior session's own execution.
2. **Treat the authentication gap as Increment 0, not backlog.** Every prior audit that has touched this repository has flagged it as the most critical open item and none has closed it. Wiring richer, canonical-shaped intelligence output onto still-unauthenticated endpoints (especially the two GET-with-side-effects routes newly documented in this audit, Section 9/16) increases what an unauthenticated caller can extract or corrupt, not decreases it.

Subject to those two conditions, this audit finds no architectural blocker to proceeding with the adapter-based Phase 2 plan in Section 19: build the entity/Score/Evidence/Recommendation adapters around the existing engines, in the order Genesis Phase 1's own roadmap already recommended and this audit independently corroborates, following the geospatial subsystem's pure/adapter split as the pattern to repeat everywhere else.
