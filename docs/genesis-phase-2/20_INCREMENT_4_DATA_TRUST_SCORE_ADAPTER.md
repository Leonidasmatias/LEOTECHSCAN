# 20 — Increment 4: Data Trust Score Adapter (Genesis Phase 2)

Status: **Implemented**.

## 1. Objective

Build a pure, tested bridge between the existing legacy Data Trust result
(`services/data-trust-engine.ts`'s `dataTrustForSite()`) and the canonical
`Score` contract (`services/intelligence/scoring/score.ts`), per
`docs/genesis-phase-2/08_ADAPTER_STRATEGY.md`'s adapter #2. No legacy
formula, weight, database behavior, API response, UI behavior, or
persistence changes. Adapter-only.

## 2. Verified starting baseline

- Repository: `C:/LEOTECHSCAN/APP`
- Branch: `master`
- HEAD: `b31f30c`
- Tag at HEAD: `genesis-phase-2-increment-3-v1`
- `origin/master`: `b31f30c` (matched)
- Working tree: clean
- `npx tsc --noEmit`: PASS
- `npm test`: 30 test files, 286/286 tests PASS
- `npm run build`: PASS

No stop condition triggered.

## 3. Roadmap alignment

The mission's requested document list included several filenames that do
not exist in `docs/genesis-phase-2/` (`04_SCORE_CONTRACT.md`,
`05_EVIDENCE_MODEL.md`, `09_DATA_TRUST_ENGINE_V2.md`). This is not a
material conflict with the frozen architecture — it is a filename
assumption mismatch. The actual files at those numbers
(`04_ENGINE_LIFECYCLE.md`, `05_ORCHESTRATION_MODEL.md`,
`09_PERSISTENCE_AND_HISTORY.md`) were read instead, along with the real
canonical Score/Evidence contracts, which live in
`services/intelligence/scoring/**` and `services/intelligence/evidence/**`
(code, not a numbered doc). `14_IMPLEMENTATION_ROADMAP.md` Increment 4
("Data Trust Score adapter... Depends on Increment 3 (needs
`EntityReference<"Site">`)... the adapter must call
`dataTrustForSite(db, id, persist=false)` explicitly... this is a
**mandatory acceptance-criterion**") and `08_ADAPTER_STRATEGY.md`'s adapter
#2 description match this mission's brief. No material disagreement found.

**One deliberate scope narrowing, consistent with Increments 2 and 3's own
precedent**: `08_ADAPTER_STRATEGY.md` describes adapter #2 as having two
halves — "a thin DB-touching outer layer calling
`dataTrustForSite(db, id, persist=false)` ... plus a pure inner
translator." This mission's own stop condition 19 ("the adapter would need
to call the database... or legacy engine internally") and Absolute Scope
("Database writes" excluded) forbid building the DB-touching half in this
pass. This increment therefore builds **only the pure inner translator**.
The DB-touching outer layer (the part that actually calls
`dataTrustForSite(db, id, persist=false)`) is explicit, named, deferred work
— not silently dropped, not claimed as done.

## 4. Files inspected

Architecture: `00_EXECUTIVE_SUMMARY.md`, `01_ARCHITECTURE_PRINCIPLES.md`,
`02_CANONICAL_DOMAIN_MODEL.md`, `03_INTELLIGENCE_PIPELINE.md`,
`04_ENGINE_LIFECYCLE.md`, `07_ENGINE_MANIFEST.md`, `08_ADAPTER_STRATEGY.md`,
`09_PERSISTENCE_AND_HISTORY.md`, `12_DEPENDENCY_GRAPH.md`,
`13_MIGRATION_STRATEGY.md`, `14_IMPLEMENTATION_ROADMAP.md`,
`15_ARCHITECTURE_DECISIONS.md` (ADR-003, ADR-004), `16_QUALITY_GATES.md`,
`18_INCREMENT_2_ENGINE_MANIFEST_REGISTRY.md`,
`19_INCREMENT_3_SITE_ENTITY_ADAPTER.md`.

Canonical layer: `services/intelligence/scoring/score.ts` (`Score`),
`scoring/classification.ts` (`ScoreType`, `ScoreClassification`,
`CANONICAL_SCORE_TYPES` — confirmed `"data-trust"` is one of the five
canonical score types listed, `ScoreDriver`), `contracts/execution-metadata.ts`
(`ExecutionMetadata`), `contracts/limitation.ts` (`Limitation`'s severity
vocabulary, reused), `evidence/evidence.ts` (confirmed `Score.evidence` is
`readonly EvidenceId[]` — references only, no embedded `Evidence` objects
required), `validation/validators.ts` (`validateScoreShape`,
`validateEntityReferenceShape`, reused directly), `types/identifiers.ts`
(`ScoreId`), `index.ts` (confirmed `ScoreId` is not re-exported at the top
barrel, same as Increment 3's finding for `SiteId`).

Legacy layer: `services/data-trust-engine.ts` (`dataTrustForSite`,
`recalculateDataTrust`, `dataTrustDashboard`, `level()`, `recommendation()`,
`duplicatePenalty()`), `services/confidence-engine.ts`
(`confidenceForSite()` — full formula, including its `overallConfidence`
weights), `services/satellite-validation-engine.ts`
(`satelliteValidationScore` — confirmed 0–100-ish scale, `Number(...)`
coerced from a `validationScore` field), `config/sentinel_rules.json`
(inspected — Data Trust's formula does not read weights from this file;
`confidence-engine.ts`'s weights are hardcoded, matching the
pre-implementation audit's own finding), `lib/types.ts` (confirmed: no
`DataTrustResult`/similar type exists there, unlike `SiteRow`).

Adapters: `services/intelligence-adapters/site-entity-adapter.ts`,
`index.ts` (both inspected per Step 9; neither modified beyond the barrel
export addition).

Runtime registry: `services/intelligence-runtime/canonical-engine-manifests.ts`,
`runtime-engine-registry.ts`, `registry-instance.ts`, `engine-manifest.ts`,
`engine-manifest-validation.ts` — all inspected; only
`canonical-engine-manifests.ts`'s `DATA_TRUST_MANIFEST.description` string
was edited (Section 15 below).

`config/capabilities.json` — all 22 entries inspected; unchanged.

## 5. Canonical score/result contract

`Score` (`services/intelligence/scoring/score.ts`), extending
`BaseEntity<"Score">`:

```ts
interface Score extends BaseEntity<"Score"> {
  readonly kind: "Score";
  readonly id: ScoreId;
  readonly entity: EntityReference;
  readonly type: ScoreType;                    // "data-trust" is canonical
  readonly value: number;                       // UNCONSTRAINED range
  readonly classification: ScoreClassification; // open string
  readonly confidence: UnitInterval;             // [0,1], REQUIRED
  readonly engineVersion: SemVerString;
  readonly contractVersion: SemVerString;
  readonly drivers: readonly ScoreDriver[];
  readonly evidence: readonly EvidenceId[];      // references only
  readonly limitations: readonly Limitation[];
  readonly calculatedAt: IsoDateTime;
  readonly executionMetadata: ExecutionMetadata;
}
```

Key findings directly shaping this adapter's design:

- **`value` is deliberately unconstrained** — "not forced into [0, 1] or
  [0, 100] because different score types have different natural ranges;
  `classification` is what gives a value comparable meaning across types."
  `validateScoreShape` only checks `typeof value.value === "number" &&
  !Number.isNaN(value.value)` — it does **not** reject `Infinity` or an
  out-of-range value structurally. This adapter applies its own, stricter,
  documented business-sanity checks beyond bare structural validity (see
  Section 11).
- **`evidence` is `readonly EvidenceId[]`** — references, never embedded
  `Evidence` objects. Confirms a Score can be legitimately represented with
  `evidence: []` in this increment, since no Evidence Adapter exists yet
  (Increment 5).
- **`classification` is open-ended** (`CanonicalScoreClassification |
  (string & {})`) — the four canonical levels (`LOW`/`MODERATE`/`HIGH`/
  `CRITICAL`) are a *suggested* vocabulary, not a closed union. This
  directly resolves Step 11's classification-mapping question (Section 14).
- **`"data-trust"` is one of exactly five `CANONICAL_SCORE_TYPES`**
  (`risk`, `opportunity`, `confidence`, `priority`, `data-trust`) —
  confirming `type: "data-trust"` is the correct, evidenced, canonical
  value, not an invented string.

## 6. Legacy Data Trust implementation inventory

- **Authoritative per-site result**: `dataTrustForSite(db, siteId, persist)`
  (`services/data-trust-engine.ts`). Returns (verified by direct reading):
  `{ site, trustScore, trustLevel, trustBadge, recommendation,
  duplicateSuggestionPenalty, activeAlertPenalty, ...confidenceForSite()'s
  spread output }`. `trustScore` is computed as
  `Math.max(0, Math.min(100, Math.round(confidence.overallConfidence * 0.78
  + importConfidence * 0.12 + 10 - duplicate - alertPenalty)))` — **always**
  an integer clamped to `[0, 100]` by the legacy formula itself, before this
  adapter ever sees it.
- **`confidenceForSite(db, site)`** (`services/confidence-engine.ts`)
  returns `{ coordinateConfidence, addressConfidence,
  municipalityConfidence, operatorConfidence, technologyConfidence,
  satelliteConfidence, cadastralConfidence, operationalConfidence,
  overallConfidence, satellite }` — all nine confidence fields are
  0–100-scale numbers computed from a hardcoded formula (weights `0.2,
  0.12, 0.12, 0.1, 0.1, 0.16, 0.1, 0.1` summing to exactly `1.0`, confirmed
  by reading line 39); `satellite` is a nested object from
  `satelliteValidationForSite()`, not a flat number.
- **Batch summary, a different shape entirely**: `recalculateDataTrust(db,
  limit)` returns `{ processed, limit }` — not a per-site, Score-shaped
  result at all. Confirms only one authoritative per-site shape exists
  (`dataTrustForSite()`'s), satisfying stop conditions 16/17 (no ambiguity,
  no incompatible shapes requiring a discriminator).
- **No version constant anywhere** in `data-trust-engine.ts` or
  `confidence-engine.ts` — confirmed by full-file reading, not assumed.
- **No timestamp field** anywhere in `dataTrustForSite()`'s return value —
  a real, confirmed gap (Section 9).
- **Side effects**: `dataTrustForSite(db, id, persist=true)` (the default)
  writes to `site_trust_scores`/`site_validation_history` and calls
  `recordAudit`. This adapter never calls this function at all (Section 3),
  so no side effect question arises from this increment's own code.
- **Classification/label fields**: `trustBadge` (`Platinum`/`Gold`/
  `Silver`/`Bronze`/`Critical`, from `level()`) and `trustLevel` (the exact
  same five-tier ladder, Portuguese-language: `Muito Alto`/`Alto`/`Medio`/
  `Baixo`/`Critico`) — both derived from the identical thresholds in the
  same `level(score)` function, i.e. two parallel labels for one
  classification, not two different classification axes. Neither is a Risk
  classification — `level()` is called only from within `trustScore`'s own
  computation.
- **`recommendation`**: a free-text Portuguese string, also from `level()`'s
  five-tier ladder — this is explicitly one of the "three, not
  consolidated" legacy Recommendation shapes named in
  `02_CANONICAL_DOMAIN_MODEL.md`'s "Recommendation" section, reserved for
  the future Recommendation Adapter (Increment 6), not this increment.

## 7. Authoritative legacy output shape

`LegacyDataTrustResult` (hand-declared in
`services/intelligence-adapters/data-trust-score-adapter.ts`; no reusable
named type exists for it anywhere in the repository, unlike Increment 3's
`SiteRow`): the nine confidence fields, `trustScore`, `trustLevel`,
`trustBadge`, `recommendation`, `duplicateSuggestionPenalty`,
`activeAlertPenalty` — a **narrower** structural view than
`dataTrustForSite()`'s real return value, deliberately excluding `site`
(Increment 3's own adapter already handles it; composing that adapter's
entire input contract into this one is exactly what Step 9 warns against)
and `satellite` (already summarized by `satelliteConfidence`). A caller may
still pass the real, wider object — TypeScript's structural typing accepts
it; this adapter simply never reads those two fields.

## 8. Adapter input contract

```ts
function adaptLegacyDataTrustResult(
  input: LegacyDataTrustResult,
  context: DataTrustAdapterContext,
): DataTrustAdaptationResult;

interface DataTrustAdapterContext {
  readonly entityReference: EntityReference<"Site">;
  readonly calculatedAt: string;    // ISO-8601, caller-supplied
  readonly contextId?: string;      // optional, defaults to a static placeholder
}
```

`entityReference` must already be the `EntityReference<"Site">` produced by
Increment 3's own adapter
(`toSiteEntityReference(adaptLegacySiteRow(row).site)`) for the same site —
this adapter never calls `adaptLegacySiteRow` internally (Step 9's explicit
instruction) and never derives Site identity from a telecom site code
(`LegacyDataTrustResult` has no site-code field at all — structurally
impossible to do so even by accident, proven by a dedicated test).

## 9. Adapter output contract

```ts
interface DataTrustAdaptationResult {
  readonly success: boolean;
  readonly score: Score | null;
  readonly issues: readonly DataTrustAdaptationIssue[];
  readonly sourceReference: DataTrustSourceReference; // { rawTrustScore, rawTrustBadge, rawTrustLevel }
  readonly unmappedFields: readonly string[];          // ["site", "satellite"]
}
```

Never throws for malformed legacy data or context. Every "bad data" path
returns `success: false` with structured `issues` (Step 6's explicit
instruction).

## 10. Entity reference decision

The adapter accepts an already-adapted `EntityReference<"Site">`, supplied
explicitly by the caller via `context.entityReference` — the smallest type
needed (Step 9), not a full `Site`, and not a call into
`adaptLegacySiteRow`. `validateEntityReferenceShape`
(`services/intelligence/validation/validators.ts`, reused directly) checks
`kind` and `id` structurally; a missing or malformed reference blocks
success (`missing_entity_reference`/`invalid_entity_reference`, both
`significant`). Increment 3's Site Entity Adapter is not modified in any
way (confirmed: `git diff` shows no changes to `site-entity-adapter.ts`).

## 11. Score range and conversion decision

- **Legacy score field**: `trustScore`, confirmed `[0, 100]` integer,
  clamped by the legacy formula itself.
- **Canonical field**: `Score.value`, contract-unconstrained.
- **Conversion**: `canonical = legacy / 100` — the exact, frozen,
  evidence-based rule from ADR-003 (`15_ARCHITECTURE_DECISIONS.md`:
  "canonical `Score.value`... uses a 0–1 continuous scale by Phase 2
  convention... Conversion at the adapter boundary:
  `canonical = legacy / 100`") and `08_ADAPTER_STRATEGY.md`'s adapter #2
  spec ("`value = trustScore / 100`"). **Not guessed** — this is the single
  documented, frozen conversion rule, applied mechanically.
- **Rounding**: none applied by this adapter (the legacy `trustScore` is
  already an integer from `Math.round` inside the legacy formula; dividing
  it by 100 introduces no new rounding decision).
- **Clamping**: **none**. An out-of-range legacy `trustScore` (only
  reachable with adversarial/malformed input, since the real formula always
  clamps to `[0, 100]`) converts mechanically (e.g. `150 → 1.5`) and is
  flagged via a non-blocking `score_out_of_range` issue — never silently
  clamped back into `[0, 1]`, per Step 7's explicit prohibition and the
  contract's own "value is deliberately unconstrained" design.
- **Invalid-value behavior**: `NaN`/`Infinity`/non-number `trustScore`
  blocks success (`non_finite_score`/`missing_score`, `significant`) —
  never silently replaced with `0`.
- **Numeric-string handling**: **rejected**, not parsed. Unlike Increment
  3's coordinate fields (where `Number(...)`-tolerant parsing was already an
  established repository convention, e.g. `services/geospatial/compact-site.ts`'s
  `num()`), there is **no repository evidence** that a Data Trust score is
  ever represented as a numeric string anywhere — the legacy formula always
  produces a genuine `number`. Coercing a string here would be guessing at
  intent (Step 7: "Do not infer whether 0.85 means 0.85 or 85"), so a
  `typeof input.trustScore !== "number"` value is rejected
  (`missing_score`), not parsed.
- **Original score preservation**: `DataTrustSourceReference.rawTrustScore`
  carries the untouched legacy value.

## 12. Raw score preservation

`sourceReference.rawTrustScore`/`rawTrustBadge`/`rawTrustLevel` preserve the
legacy values verbatim, independent of whether adaptation succeeds. The
successful `Score`'s `metadata.legacyRecommendation`/`legacyTrustLevel`
additionally preserve the free-text recommendation and the Portuguese
parallel label.

## 13. Component breakdown mapping

Per `08_ADAPTER_STRATEGY.md`'s exact wording ("drivers built from the eight
confidence sub-scores plus the duplicate/alert penalties"), `drivers`
contains exactly ten entries when all components are present and finite:

| Driver factor | Weight | Source |
|---|---|---|
| `coordinateConfidence` | 0.2 | `confidence-engine.ts` line 39 (`overallConfidence` formula) |
| `addressConfidence` | 0.12 | same |
| `municipalityConfidence` | 0.12 | same |
| `operatorConfidence` | 0.1 | same |
| `technologyConfidence` | 0.1 | same |
| `satelliteConfidence` | 0.16 | same |
| `cadastralConfidence` | 0.1 | same |
| `operationalConfidence` | 0.1 | same |
| `duplicateSuggestionPenalty` | 1 (subtractive) | `data-trust-engine.ts`'s `trustScore` formula (`- duplicate`) |
| `activeAlertPenalty` | 1 (subtractive) | same (`- alertPenalty`) |

Weights are **transcribed verbatim** from the real source lines, not read
from config (neither file externalizes them today) and not recomputed —
`contribution = weight × (rawValue / 100)` for the eight sub-scores,
`contribution = -(rawValue / 100)` for the two penalties. **A missing or
non-finite component is omitted from `drivers` (never defaulted to `0`) and
raises a non-blocking `invalid_component_value` issue** — proven by a
dedicated test that deletes `cadastralConfidence` from the input. Drivers
are never summed to verify they equal `trustScore` — `Score.value` always
comes directly from `trustScore / 100`, independent of the drivers array
(a dedicated test constructs components that would sum to a wildly
different total and confirms `value` is unaffected). A documented,
accepted risk: if `confidence-engine.ts`'s weights are ever externalized
(Principle 2's named future refactor), these hardcoded driver weights must
be updated by hand to match — flagged explicitly in the adapter's own
source comment, not silently left to drift.

## 14. Classification mapping

`Score.classification` is set to the legacy `trustBadge` value **verbatim**
(`"Platinum"`/`"Gold"`/`"Silver"`/`"Bronze"`/`"Critical"`) — no translation,
no reinterpretation. Since `ScoreClassification` is contract-open-ended,
this is fully structurally valid without inventing a mapping. Because none
of the five legacy values matches one of the four canonical suggested
levels (`LOW`/`MODERATE`/`HIGH`/`CRITICAL`), every successful adaptation
emits a non-blocking, `informational` `unmapped_classification` issue,
proven by a dedicated test. `trustLevel` (the Portuguese parallel label) is
preserved in `metadata.legacyTrustLevel`, not discarded. `recommendation`
is explicitly **not** treated as a classification or a canonical
Recommendation — it is out of scope (Increment 6) and preserved only as
plain text in `metadata.legacyRecommendation`.

## 15. Timestamp mapping

`dataTrustForSite()` returns **no timestamp field at all** — confirmed by
full-file reading, not assumed. `Score.calculatedAt`/`createdAt`/
`updatedAt`/`executionMetadata.executedAt` all require an ISO-8601 value.
This adapter **does not call `Date.now()`** (that would break determinism
— test #4 requires identical input to produce identical output on every
call) and does not fabricate a timestamp. Instead, `context.calculatedAt`
is a **required, caller-supplied** ISO-8601 string; missing or unparseable
values block success (`missing_evaluated_at`/`invalid_timestamp`, both
`significant`) — mirroring Increment 3's identical precedent for
`dataImportacao`.

## 16. Version and methodology mapping

`engineVersion`/`contractVersion` are static constants (`"0.1.0"`/`"1.0.0"`)
chosen to **mirror Increment 2's already-registered `"data-trust"` manifest
declaration** (`services/intelligence-runtime/canonical-engine-manifests.ts`),
not read from it programmatically (avoiding a new cross-directory coupling
between the adapter and runtime-registry layers that no frozen document
requires) and not invented independently. A `Limitation` (`informational`)
on every successful `Score` states explicitly that these values mirror the
registered manifest, not an internal version the legacy formula itself
asserts — `services/data-trust-engine.ts` has no version constant,
confirmed by reading the file. `configurationVersion` is a manifest-level
concept (`04_ENGINE_LIFECYCLE.md`'s four versioning axes); `Score` has no
such field, so nothing to map there.

**Minimal, justified manifest correction (Step 15's narrow allowance
exercised)**: `DATA_TRUST_MANIFEST.description`
(`services/intelligence-runtime/canonical-engine-manifests.ts`) previously
read "no Data Trust Score Adapter... has been built yet" — now factually
incorrect, since this increment builds exactly that adapter. Corrected to
state the adapter now exists at its real path but "is not wired into this
registry, any route, or an Orchestrator, so this declaration remains
`'planned'`, not `'active'`." **Only this one string field changed** —
`status`, `engineVersion`, `contractVersion`, `supportsPreview`,
`supportsPersistence`, `supportsBatch`, `maxBatchSize`,
`securityRequirement`, and `dependencies` are byte-for-byte unchanged,
verified by a dedicated test
(`tests/intelligence-data-trust-adapter-contract.test.ts`, "the data-trust
manifest's operational fields are unchanged").

## 17. Structured adaptation issues

Ten codes, each independently evidenced: `missing_score`,
`non_finite_score` (both `significant`, blocking — `Score.value` cannot be
honestly derived); `score_out_of_range` (`moderate`, non-blocking — a
data-quality observation about the input, not a structural failure);
`missing_entity_reference`, `invalid_entity_reference`,
`missing_evaluated_at`, `invalid_timestamp` (all `significant`, blocking —
each corresponds to a required field with no legacy-evidenced fallback);
`invalid_component_value` (`moderate`, non-blocking — that one driver is
omitted, the Score still constructs); `unmapped_classification`
(`informational`, non-blocking); `invalid_canonical_shape`
(`significant`, blocking — defensive safety net if
`validateScoreShape` ever disagrees with this adapter's own construction,
not expected to fire in practice). **Deliberately not implemented**, with
reasons: `invalid_score_type`/`ambiguous_score_range`/`source_shape_mismatch`
(only one authoritative shape exists — Section 6/7, nothing to disambiguate);
`missing_engine_version`/`missing_methodology_version` (this adapter always
supplies a static value itself — never "missing" from its own
perspective; the *absence of a legacy-asserted* version is instead recorded
as a `Limitation`, the contract-correct place for "known limits on trusting
this result," not an adaptation-process issue); `unsupported_component`
(every field in the narrow `LegacyDataTrustResult` type is mapped
somewhere — Section 7); `inconsistent_component_total` (drivers are never
summed/verified against `trustScore` at all — Section 13, so there is
nothing to detect an inconsistency in). No issue message embeds a full
input object or a planted distinctive value — proven by a dedicated test.

## 18. Structural validation

`validateScoreShape` (`services/intelligence/validation/validators.ts`,
reused directly, not duplicated) runs against every successfully
constructed `Score` before it is returned; a failure converts to
`invalid_canonical_shape` issues and forces `success: false` — structurally
invalid output is never returned as a success. No parallel validation
framework was built. Explicit distinction, restated per Step 14: this
increment guarantees only (2) adaptation completed and (3) canonical
structure valid, when successful — it does **not** prove (4) the Data
Trust score is trustworthy or (5) the `"data-trust"` engine is
operational.

## 19. Dependency boundaries

Verified by source inspection
(`tests/intelligence-data-trust-adapter-contract.test.ts`): the adapter
imports no `node:sqlite`, no Next.js, no API route, no `@/lib/db`, no
`services/site-service.ts`, no other legacy engine file
(`data-trust-engine.ts`, `confidence-engine.ts`,
`evidence-center-engine.ts`, `data-quality-engine.ts`,
`duplicates-engine.ts`, `satellite-validation-engine.ts` — none appear as
an actual import, only as prose citations inside comments, and the test
strips comments before matching to avoid a false pass on that basis); no
file/network I/O. A full walk of `services/intelligence/**` confirms no
file there references `intelligence-adapters` — the dependency direction
(legacy result + entity reference → adapter → canonical `Score`) is never
inverted.

## 20. Runtime registry decision

**No new `EngineId`, no adapter manifest, no new registry entry.** The
Data Trust Score Adapter is infrastructure, not an engine — consistent
with Increment 3's identical reasoning for the Site Entity Adapter and this
mission's own Step 15 expected decision. The **only** runtime-registry
change is the one narrow, justified `DATA_TRUST_MANIFEST.description`
correction (Section 16) — `status` remains `"planned"`, and a dedicated
test confirms `runtimeEngineRegistry.listManifestsByStatus("active")` is
still empty and `listManifests()` still has exactly 3 entries.

## 21. Capabilities decision

`config/capabilities.json` (22 entries) is **unchanged**. The pre-existing
`data_trust` entry (`status: "operational"`) describes the real, live
legacy feature (`app/api/data-trust/**`) and was already true before this
increment — it is not re-justified or altered by this adapter's existence,
since no route or UI consumes the new adapter. A dedicated test confirms
no entry references `intelligence-adapters` or
`data-trust-score-adapter` anywhere in the file.

## 22. Tests added

- **`tests/intelligence-data-trust-adapter.test.ts`** — 34 tests covering:
  valid-result success; structural validation of the produced `Score`;
  entity-reference preservation; determinism; no input/context mutation;
  JSON round-trip; no cross-call state accumulation; zero and maximum score
  handling; rejected (not parsed) numeric-string scores; non-reinterpreted
  fractional scores; `NaN`/`Infinity` rejection; negative and above-range
  score conversion without clamping; no rounding beyond the legacy
  integer; no recomputation from components; missing-component
  non-zero-omission; exact driver contribution math; unmapped-fields
  exposure; classification preservation and flagging; missing entity
  reference blocking; proof the adapter never derives identity from a site
  code (`LegacyDataTrustResult` has no such field); missing/invalid
  timestamp blocking; always-present version fields; the
  no-invented-methodology-version `Limitation`; truthful self-identification
  (`type: "data-trust"`); issue-message marker-leak check; empty
  `evidence` array; deterministic `ScoreId`; and `sourceReference`
  fidelity.
- **`tests/intelligence-data-trust-adapter-contract.test.ts`** — 12 tests
  (source inspection, comments stripped): no `data-trust-engine.ts`
  import/call, no `node:sqlite`; no Next.js; no API-route import; no
  `@/lib/db`/`site-service.ts` import; no file/network I/O; no other legacy
  engine import; `services/intelligence/**` never references
  `intelligence-adapters`; the `data-trust` manifest's operational fields
  are unchanged and no new `EngineId` was registered; no engine is
  `"active"`; `config/capabilities.json` has exactly one unchanged
  `data_trust` entry and references neither the adapter file nor
  `intelligence-adapters` anywhere.

Total new tests: **46** (34 + 12).

## 23. Quality-gate results

Recorded in this increment's final report (conversation's closing
message). Expected: `tsc --noEmit` clean; 32 test files / 332 tests passing
(286 baseline + 46 new); `next build` unchanged in route list and bundle
size; diff limited to the files named in the final report.

## 24. Explicit non-goals (restated, per this mission's own requirement)

- **Adapter existence does not make Data Trust Engine v2 complete.** No
  "v2" engine was designed or built; this increment only translates the
  existing v1 legacy output's shape.
- **Adapter existence does not make the `"data-trust"` canonical engine
  active.** Its manifest status remains `"planned"` (Section 20).
- **Legacy formulas were not changed.** `services/data-trust-engine.ts` and
  `services/confidence-engine.ts` are byte-for-byte untouched (confirmed by
  `git diff`).
- **No canonical `Evidence` objects were created.** `Score.evidence` is
  always `[]` in this increment's output (Section 5/12).
- **No production route consumes the adapter yet.** No `app/api/**` file
  was touched; the adapter has zero callers outside its own tests.

## 25. Remaining limitations

- The DB-touching outer layer (calling `dataTrustForSite(db, id,
  persist=false)`) does not exist yet — this adapter cannot be invoked
  against real data without a future increment building that thin wrapper
  and supplying `context.calculatedAt`/`entityReference` from real
  `Date`/Increment 3 output at the call site.
- `confidence` reuses `overallConfidence` as a proxy meta-confidence signal
  (Section 5/16's `Limitation`) — this is an evidenced, documented
  approximation, not an independently-computed "confidence in this score"
  metric, since the legacy engine has no such concept of its own.
- Driver weights are hardcoded, mirroring today's `confidence-engine.ts`
  constants — a documented drift risk if those weights are ever
  externalized to config (Section 13).
- `ScoreId` derivation (`` `data-trust:${entityReference.id}` ``) assumes
  one current Data Trust score per site — consistent with today's
  "latest row wins" legacy persistence model
  (`09_PERSISTENCE_AND_HISTORY.md`), but does not yet express real
  versioning/history (out of scope; `version` is a fixed `1` for the same
  reason Increment 3's `Site.version` is).

## 26. Deferred work

The DB-touching outer layer for this adapter; Evidence Adapter (Increment
5); Recommendation Adapter (Increment 6, which will need
`recommendation`/`trustLevel` currently parked in this adapter's
`metadata`); Confidence Adapter (a genuinely distinct future engine per
ADR-004, not `confidence-engine.ts`); Data Quality Adapter; Municipality/
State Rollup Adapter; the Intelligence Orchestrator; any new API route;
the eight remaining canonical engine manifests noted as a fast-follow since
Increment 2.

## 27. Rollback

Delete `services/intelligence-adapters/data-trust-score-adapter.ts`,
`tests/intelligence-data-trust-adapter.test.ts`, and
`tests/intelligence-data-trust-adapter-contract.test.ts`. Revert the two
export blocks added to `services/intelligence-adapters/index.ts`. Revert
the single `description` string in
`services/intelligence-runtime/canonical-engine-manifests.ts`'s
`DATA_TRUST_MANIFEST` back to its Increment 2 wording. Nothing else was
modified — `services/intelligence/**`, `services/data-trust-engine.ts`,
`services/confidence-engine.ts`, `config/sentinel_rules.json`,
`config/capabilities.json`, every route, and Increment 3's Site Entity
Adapter are all untouched.

## 28. Go/No-Go for the Evidence Adapter (Increment 5)

**Go.** This increment's acceptance bar — a pure, tested, non-throwing,
non-mutating Data Trust Score Adapter that reuses existing canonical
validators, preserves raw legacy values, changes no formula or weight,
never silently clamps/rounds/recomputes, and is correctly excluded from
the runtime registry (beyond one narrow, justified, documented text
correction) and the capability registry — is met. Increment 5's Evidence
Adapter will need a `Score`-shaped or `EvidenceId`-referencing input; this
increment's `Score.evidence: []` is the honest starting point for that
future adapter to populate, not a placeholder concealing a gap.
