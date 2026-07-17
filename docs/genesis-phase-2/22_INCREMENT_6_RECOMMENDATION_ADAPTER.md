# 22 — Increment 6: Recommendation Adapter (Genesis Phase 2)

Status: **Implemented**.

## 1. Objective

Build a pure, tested bridge between the legacy Recommendation producers and
the canonical `Recommendation` contract
(`services/intelligence/recommendations/recommendation.ts`), per
`docs/genesis-phase-2/08_ADAPTER_STRATEGY.md`'s adapter #4. This is also
the increment `02_CANONICAL_DOMAIN_MODEL.md`'s "Recommendation" section and
`14_IMPLEMENTATION_ROADMAP.md`'s own Increment 6 entry assign the
three-legacy-shape reconciliation decision to — this document is that
decision record. No legacy behavior, database, API, or UI change.
Adapter-only, strictly additive.

## 2. Verified starting baseline

- Repository: `C:/LEOTECHSCAN/APP`
- Branch: `master`
- HEAD: `a26dc50`
- Tag at HEAD: `genesis-phase-2-increment-5-v1`
- Working tree: clean
- `npx tsc --noEmit`: PASS
- `npm test`: 34 test files, 397/397 tests PASS
- `npm run build`: PASS
- Increment 5 confirmed present exactly as frozen: `services/intelligence-adapters/{evidence-adapter.ts,index.ts}`, both Evidence Adapter test files, and this document's predecessor all present and passing, committed as `a26dc50`.

No stop condition triggered.

## 3. Roadmap alignment

As with Increments 4–5, the mission's requested filename
`docs/genesis-phase-2/03_RECOMMENDATION_MODEL.md` does not exist — the real
file at `03` is `03_INTELLIGENCE_PIPELINE.md`. A filename-assumption
mismatch, not a material conflict: the real canonical Recommendation
contract lives in code (`services/intelligence/recommendations/**`), and
its architectural framing is in `02_CANONICAL_DOMAIN_MODEL.md`'s
"Recommendation" section and `08_ADAPTER_STRATEGY.md`'s adapter #4 entry,
both read in full.

`14_IMPLEMENTATION_ROADMAP.md` Increment 6 ("Recommendation adapter... Per
`08_ADAPTER_STRATEGY.md`'s adapter #4. Depends on Increment 4... and
Increment 5... **Objective includes** the three-shape reconciliation named
in `02_CANONICAL_DOMAIN_MODEL.md` — this increment's design doc... must
explicitly state which legacy source is authoritative for which
recommendation category, not leave it implicit in code") matches this
mission's brief and confirms Increment 6 is the correct next roadmap step.
Section 6 below is that explicit statement.

**Same deliberate flat-file naming as Increments 3–5**:
`08_ADAPTER_STRATEGY.md` names the file
`services/intelligence-adapters/recommendation-adapter.ts` — followed
exactly, matching the established precedent of the frozen document's
literal path winning over a "possible location."

## 4. Files inspected

Architecture: `02_CANONICAL_DOMAIN_MODEL.md` (re-read, "Recommendation"
section), `08_ADAPTER_STRATEGY.md` (re-read, adapter #4), `12_DEPENDENCY_GRAPH.md`,
`13_MIGRATION_STRATEGY.md`, `14_IMPLEMENTATION_ROADMAP.md`,
`15_ARCHITECTURE_DECISIONS.md` (ADR-004, ADR-013), `16_QUALITY_GATES.md`,
`21_INCREMENT_5_EVIDENCE_ADAPTER.md` (the "philosophy" this increment's
disclosure policy explicitly follows).

Canonical layer: `services/intelligence/recommendations/recommendation.ts`
(`Recommendation` — confirmed it **does** have a `limitations` field,
unlike `Evidence`), `recommendations/priority.ts` (`PriorityLevel`,
`CANONICAL_PRIORITY_LEVELS = ["LOW","MEDIUM","HIGH","URGENT"]` — confirmed
**distinct** from `Score`'s `LOW/MODERATE/HIGH/CRITICAL` vocabulary),
`recommendations/impact.ts` (`ImpactAssessment { magnitude, area,
timeframe }`), `recommendations/action.ts` (`RecommendedAction { action,
rationale, sequence }`), `recommendations/index.ts`,
`validation/validators.ts` (`validateRecommendationShape`, confirmed exact
checks: non-empty `reason`/`priority` strings, unit-interval `confidence`,
`impact` is a record, non-empty `affectedEntities` array,
`recommendedActions`/`evidence`/`limitations` are arrays — empty arrays
pass), `types/identifiers.ts` (`RecommendationId`).

Legacy layer, discovered by direct reading and repository-wide search (not
assumed): `services/data-trust-engine.ts` (`recommendation(score)`),
`services/evidence-center-engine.ts` (`technicalRecommendation` field),
`sentinel-core/recommendation/recommendation-engine.ts`
(`getRecommendations()`), `sentinel-core/recommendation/recommendation-rules.ts`
(`recommendationRules`, 6 fixed strings), `app/api/site-recommendation/route.ts`,
`app/api/sentinel-core/recommendations/route.ts`,
`sentinel-core/adapters/planning-adapter.ts` (inspected, confirmed an
inert 1-line stub — `{ target: "strategic-planning", mode:
"recommendation-input" }` — part of `sentinel-core`'s own unimplemented
`adapters/` concept per ADR-013, unrelated to this increment's adapter),
`sentinel-core/inference/inference-engine.ts` (`sig_insights.recommendation`
field), `services/duplicates-engine.ts` (`DuplicateCandidate.recommendation`
field), `services/enterprise-v3-engine.ts` (`strategicRecommendation`/
`finalRecommendation`/`strategicRecommendations` fields).

## 5. Legacy Recommendation discovery

Repository-wide search for `recommendation`, `RecommendationEngine`,
`RecommendationResult`, `RecommendationItem`, `RecommendationType`,
`recommend`, `action`, `priority` (54 files matched — far broader than a
single "authoritative producer" search, confirming Recommendation is
genuinely more scattered across this codebase than Site/Data-Trust/Evidence
were). Sorted by direct reading into:

**Genuinely independent producers, in scope for this increment (Section 6):**
1. `services/data-trust-engine.ts`'s `recommendation(score)` — a pure
   function of the Trust Score, returning one of five fixed Portuguese
   strings.
2. `sentinel-core/recommendation/recommendation-engine.ts`'s
   `getRecommendations(db, scope)` — returns `{ scope, recommendations:
   [...] }`, each item `{ type, priority: number, title, evidence: object |
   null }`, built from four sub-sources capped at 60 total: `GLOBAL_RULE`
   (from the 6 fixed `recommendationRules`), `LOW_TRUST`, `COPERNICUS_VALIDATION`,
   `ROLLOUT_OPPORTUNITY`.

**Not independent — confirmed derivative, not a distinct shape:**
- `services/evidence-center-engine.ts`'s `technicalRecommendation`: direct
  reading shows `technicalRecommendation: trust?.recommendation ||
  "Gerar validacao de confianca antes de decisao tecnica."` — it
  **re-surfaces Data Trust's own string** under a different field name,
  with a static fallback for the null case. `02_CANONICAL_DOMAIN_MODEL.md`
  counts this as one of "three" legacy representations; direct code
  reading refines that to **two** genuinely independent producers plus one
  derivative pass-through. This adapter's `DATA_TRUST_TEXT` type covers
  Evidence Center's case too — no separate handling is needed or added.

**Evaluated and explicitly excluded from this increment (found by this
increment's own broader search, not named by the frozen architecture):**
- `app/api/site-recommendation/route.ts` — an ad hoc, per-site **array**
  of four hardcoded strings, bundled with separate `priority`
  (`"Muito Alta"`/`"Alta"`/`"Media"` — a **third**, route-local priority
  vocabulary) and `expansionPotential` fields. Structurally very different
  from both in-scope producers (a batch of strings sharing one
  priority/potential, not discrete, independently-addressable
  recommendation objects). Consolidating it would require a new,
  under-evidenced design decision (fan out one string per
  `LegacyRecommendationItem`, discarding the shared priority linkage, or
  inventing a batch-level concept the canonical contract doesn't have).
  Recorded here as a genuine finding, not silently missed.
- `sentinel-core/inference/inference-engine.ts`'s `sig_insights.recommendation`
  — belongs to the distinct "Insight" concept (`getInsightsForScope`), a
  different sentinel-core noun entirely, not "Recommendation."
- `services/duplicates-engine.ts`'s `DuplicateCandidate.recommendation` —
  belongs to the distinct "Duplicate Candidate" concept, which
  `02_CANONICAL_DOMAIN_MODEL.md` itself names as "deferred past the first
  five adapters" and `14_IMPLEMENTATION_ROADMAP.md`'s postponed-work list
  schedules as its own, later, independent consolidation effort.
- `services/enterprise-v3-engine.ts`'s `strategicRecommendation`/
  `finalRecommendation`/`strategicRecommendations` — belong to the
  Strategic Planning / Scenario Planner features, never named anywhere in
  the frozen Recommendation architecture.

No STOP condition was triggered by this broader-than-expected discovery —
it does not contradict anything the frozen architecture requires; it
supplies more complete evidence than `02_CANONICAL_DOMAIN_MODEL.md`'s
summary count, exactly as the mission's own "do not assume, search
repository-wide" instruction intends, and the exclusions above are
reasoned, not silent.

**Consumers**: `app/api/sentinel-core/recommendations/route.ts` (serves
`getRecommendationsForScope()`'s raw output) and
`app/api/site-recommendation/route.ts` (serves its own independent shape,
excluded above). Neither route is touched by this increment.

## 6. Canonical Recommendation contract

```ts
interface Recommendation extends BaseEntity<"Recommendation"> {
  readonly kind: "Recommendation";
  readonly id: RecommendationId;
  readonly reason: string;
  readonly priority: PriorityLevel;               // open string; canonical: LOW/MEDIUM/HIGH/URGENT
  readonly confidence: UnitInterval;
  readonly impact: ImpactAssessment;                // { magnitude: UnitInterval, area: string, timeframe: string }
  readonly affectedEntities: readonly [EntityReference, ...EntityReference[]]; // non-empty, REQUIRED
  readonly recommendedActions: readonly RecommendedAction[];
  readonly evidence: readonly EvidenceId[];          // references only
  readonly limitations: readonly Limitation[];       // unlike Evidence, this field genuinely exists
}
```

Two findings that shaped this adapter's design directly:

1. **`Recommendation` has its own `limitations` field** — unlike Evidence
   (Increment 5's Section 6 finding, where `Limitation` was confirmed
   absent from that contract). This adapter uses the contract-native
   mechanism directly for disclosure, no metadata-based workaround needed
   for that part (though metadata disclosure is *also* added, for
   consistency and machine-readability — Section 8).
2. **`affectedEntities` is required and non-empty**, but neither legacy
   producer's own output reliably names a single consistent entity kind:
   `LOW_TRUST`/`COPERNICUS_VALIDATION` are about a Site, `ROLLOUT_OPPORTUNITY`
   is about a Municipality, `GLOBAL_RULE` is about nothing at all, and
   `DATA_TRUST_TEXT` is implicitly about whichever Site's Trust Score
   produced it (not carried in the string itself). This adapter never
   infers an entity reference from a legacy item's `evidenceContext` —
   the caller must supply already-adapted `EntityReference`s explicitly
   (Section 7).

## 7. Adapter input contract

```ts
function adaptLegacyRecommendation(
  item: LegacyRecommendationItem,
  context: RecommendationAdapterContext,
): RecommendationAdaptationResult;

function adaptLegacyRecommendationList(
  items: readonly LegacyRecommendationItem[],
  context: RecommendationAdapterContext,
): readonly RecommendationAdaptationResult[];

interface LegacyRecommendationItem {
  readonly type: string;                              // one of LEGACY_RECOMMENDATION_TYPES, or open
  readonly text: string;                               // the recommendation() string, or sentinel-core's title
  readonly priority: number | null;                    // sentinel-core's incidental ordinal; null for DATA_TRUST_TEXT
  readonly evidenceContext: Record<string, unknown> | null; // sentinel-core's raw sub-object, preserved not parsed
}

interface RecommendationAdapterContext {
  readonly idSeed: string;                             // independent, caller-chosen -- never derived from affectedEntities
  readonly affectedEntities: readonly EntityReference[]; // validated non-empty at runtime
  readonly timestamp: string;                           // ISO-8601, no legacy timestamp exists
  readonly version?: string;                            // optional, defaults to "0.1.0"
}
```

`LEGACY_RECOMMENDATION_TYPES = ["DATA_TRUST_TEXT", "GLOBAL_RULE",
"LOW_TRUST", "COPERNICUS_VALIDATION", "ROLLOUT_OPPORTUNITY"]` — the
unified discriminant covering both in-scope producers. `type` on
`LegacyRecommendationItem` is left as `string`, not narrowed, so a future
sixth type does not become a compile error (mirrors Evidence Adapter's
identical `type: string` design); handled at runtime with a non-blocking
`unrecognized_recommendation_type` issue.

`idSeed` is **independent** of `affectedEntities` — not derived from
`affectedEntities[0]` — because the natural entity anchor varies by legacy
type (see Section 6, finding 2); requiring an explicit seed avoids a
hidden, type-dependent assumption. This mirrors the Evidence Adapter's
identical `idSeed` design, for the same reason (Evidence has no entity
link at all; Recommendation's entity link is present but type-inconsistent).

## 8. Adapter output contract

```ts
interface RecommendationAdaptationResult {
  readonly success: boolean;
  readonly recommendation: Recommendation | null;
  readonly issues: readonly RecommendationAdaptationIssue[];
  readonly sourceReference: RecommendationSourceReference; // { rawType, rawText, rawPriority, rawEvidenceContext }
  readonly unmappedFields: readonly string[];               // always [] -- see Section 12
}
```

Never throws for malformed legacy data or context — every "bad data" path
returns `success: false` with structured `issues`. `RecommendationAdaptationResult.recommendation`'s
JSDoc carries the same "success ≠ trustworthy" disclaimer style Increments
4–5 established (`DataTrustAdaptationResult.score`,
`EvidenceAdaptationResult.evidence`).

## 9. Structural validation

`validateRecommendationShape` (`services/intelligence/validation/validators.ts`,
reused directly, not duplicated) runs against every successfully
constructed `Recommendation`; a failure converts to `invalid_canonical_shape`
issues and forces `success: false`. Same explicit distinction as
Increments 3–5: this increment guarantees "adaptation completed" and
"canonical structure valid" when successful — it does not guarantee the
recommendation is well-prioritized, actionable, or factually correct.

## 10. Identity and timestamp mapping

- **`RecommendationId`**: `` `recommendation:${idSeed}:${type}` `` —
  deterministic given `(idSeed, type)`, no random UUID, no time-dependent
  generation. A missing/whitespace-only `idSeed` blocks success
  (`missing_id_seed`).
- **Identifier collision (documented current behavior, not redesigned,
  same posture as Evidence's Section 10)**: two `LegacyRecommendationItem`s
  sharing the same `type` and `idSeed` produce the same `RecommendationId`
  — proven by a dedicated test, both via repeated `adaptLegacyRecommendation`
  calls and via `adaptLegacyRecommendationList` with two same-type items.
  Not reachable through `sentinel-core/recommendation/recommendation-engine.ts`
  in its current form for `LOW_TRUST`/`COPERNICUS_VALIDATION`/
  `ROLLOUT_OPPORTUNITY` (each site/municipality contributes at most one item
  per type per call), but `GLOBAL_RULE` legitimately produces up to 6 items
  that would all collide under one `idSeed` if adapted together — a real,
  explicitly documented limitation, not redesigned per the "smallest
  truthful solution" principle. `adaptLegacyRecommendationList` still
  preserves list order and does not mutate input even when a collision
  occurs.
- **`createdAt`/`updatedAt`**: both set to `context.timestamp` (caller-supplied,
  ISO-8601) — neither legacy producer carries a timestamp of its own,
  confirmed by direct reading. Missing/invalid timestamp blocks
  (`missing_evaluated_at`/`invalid_timestamp`).

## 11. Disclosure policy for missing canonical fields (Increment 5's philosophy, applied)

Neither legacy producer carries a genuine `priority`/`confidence`/`impact`
signal:

- `data-trust-engine.ts`'s recommendation string has none at all.
- `sentinel-core`'s numeric `priority` is an **incidental sort/truncation
  ordinal**, not a documented urgency scale: `LOW_TRUST`=1,
  `COPERNICUS_VALIDATION`=2, `ROLLOUT_OPPORTUNITY`=3 are fixed per-type
  constants, while `GLOBAL_RULE` uses `index + 1` ranging 1–6
  (`recommendation-rules.ts` has 6 entries) — an inconsistent range with no
  documented "lower number = more urgent" convention anywhere in the
  source. Mapping it to a canonical `PriorityLevel` would be guessing at
  intent (the same reasoning Increment 4's Step 7 applied to Data Trust's
  score range, and Increment 5 applied to Evidence's weight/reliability).

**Policy defaults applied** (disclosed, not hidden — the mission's own
"DISCLOSURE POLICY" explicitly sanctions this path): `priority = "MEDIUM"`,
`confidence = 0.5`, `impact.magnitude = 0.5`, `impact.timeframe =
"unspecified"`. **`impact.area` is the one exception**: a low-risk,
mechanical per-type category label drawn from each legacy type's own
already-known subject matter, not an invented urgency ranking:

| Legacy type | `impact.area` |
|---|---|
| `DATA_TRUST_TEXT` | `"data-quality"` |
| `GLOBAL_RULE` | `"governance"` |
| `LOW_TRUST` | `"data-quality"` |
| `COPERNICUS_VALIDATION` | `"data-quality"` |
| `ROLLOUT_OPPORTUNITY` | `"coverage"` |
| *(unrecognized type)* | `"operational"` (generic fallback) |

Disclosure is triple-channeled, more than Evidence's non-Copernicus case
needed (since Recommendation has a native `limitations` field Evidence
lacks):
1. `Recommendation.limitations` — two entries (policy defaults; empty
   `recommendedActions`), both `informational`.
2. `metadata.policyDefaultsApplied: true` / `prioritySource`/
   `confidenceSource`/`impactSource: "adapter_policy_default"`.
3. A structured, non-blocking, `informational` `policy_default_values_applied`
   adaptation issue.

Unlike Evidence's Copernicus/non-Copernicus split, there is no
more-precise alternative disclosure available here — every recommendation,
regardless of legacy type, gets the same triple disclosure, since neither
legacy source ever provides a genuine priority/confidence/impact signal.

`recommendedActions` is always `[]` — neither legacy source provides a
discrete, ordered action sequence, only a single free-text
recommendation/title (disclosed via the second `limitations` entry above).
`evidence` is always `[]` — no canonical `Evidence` objects are created by
this increment (the same explicit non-goal restated in Increments 4–5).

### 11.1 Legacy priority finite-number handling (added by pre-commit hardening)

An independent pre-commit audit found that `item.priority` (the raw legacy
value) was stored in `metadata.legacyPriority`/`sourceReference.rawPriority`
with no runtime validation at all. Since `JSON.stringify` has no
representation for `NaN`/`Infinity`/`-Infinity` and silently coerces every
one of them to `null` with **zero disclosure**, an unvalidated non-finite
legacy priority could reach a consumer as an unexplained `null` — visually
identical to `DATA_TRUST_TEXT`'s legitimate, meaningful `null` (that source
genuinely has no priority concept at all), but for a completely different,
undisclosed reason. This was corrected:

- `item.priority` is checked with `Number.isFinite()` before it is stored
  anywhere (a `null` value — `DATA_TRUST_TEXT`'s legitimate case — is left
  alone and never flagged).
- A non-finite value (`NaN`, `Infinity`, `-Infinity`, or any other
  non-number a caller might pass despite the `number | null` type) is
  **not preserved** — both `metadata.legacyPriority` and
  `sourceReference.rawPriority` become a deliberate, explicit `null`
  instead, and a new `invalid_legacy_priority` issue (`moderate`,
  non-blocking, `canContinue: true`) discloses exactly why.
- No replacement numeric value is invented — `null` is reused precisely
  because it is already the adapter's existing vocabulary for "no usable
  priority value," not a new concept.
- Adaptation still succeeds (`success: true`) when the rest of the input is
  valid — a non-finite legacy priority is a data-quality observation about
  the *input*, not a reason the canonical `Recommendation` cannot be built;
  canonical `priority` was already the static default `"MEDIUM"`
  regardless, so this has zero effect on the canonical field's value.
- Proven by nine dedicated tests
  (`tests/intelligence-recommendation-adapter.test.ts`, "legacy priority
  finite-number handling"): finite values preserved exactly, `null`
  preserved and not flagged, `NaN`/`Infinity`/`-Infinity` all become
  disclosed `null`, the issue is present/non-blocking/`moderate`,
  adaptation still succeeds, canonical `priority` is unaffected, and a full
  `JSON.stringify`/`JSON.parse` round-trip confirms the `null` in the
  output is the adapter's own explicit, disclosed one — not an
  undifferentiated artifact of `JSON.stringify`'s built-in NaN/Infinity
  coercion.

### 11.2 Structured Adaptation Issues (added by pre-commit hardening)

Every `RecommendationAdaptationIssueCode` value, by name, with its exact
trigger, severity, blocking behavior, and expected outcome — added by
pre-commit hardening to close a documentation completeness gap an
independent audit identified (the original version of this document never
enumerated all codes in one place).

| Code | Trigger | Severity | Blocking (`canContinue`) | Expected outcome |
|---|---|---|---|---|
| `missing_reason` | `item.text` is empty or whitespace-only after trimming | `significant` | Blocking (`false`) | `success: false`, `recommendation: null` |
| `missing_id_seed` | `context.idSeed` is empty or whitespace-only after trimming | `significant` | Blocking (`false`) | `success: false`, `recommendation: null` |
| `missing_affected_entities` | `context.affectedEntities` is absent or an empty array | `significant` | Blocking (`false`) | `success: false`, `recommendation: null` |
| `invalid_affected_entity` | Any entry in `context.affectedEntities` fails `validateEntityReferenceShape` | `significant` | Blocking (`false`) | `success: false`, `recommendation: null`; one issue per invalid entry, indexed by `affectedEntities[n]` |
| `missing_evaluated_at` | `context.timestamp` is empty or whitespace-only after trimming | `significant` | Blocking (`false`) | `success: false`, `recommendation: null` |
| `invalid_timestamp` | `context.timestamp` does not parse via `Date.parse` | `significant` | Blocking (`false`) | `success: false`, `recommendation: null` |
| `unrecognized_recommendation_type` | `item.type` is not one of the five `LEGACY_RECOMMENDATION_TYPES` | `moderate` | Non-blocking (`true`) | Adaptation still succeeds; `impact.area` falls back to `"operational"` |
| `invalid_legacy_priority` | `item.priority` is not `null` and not a finite number (`NaN`/`Infinity`/`-Infinity`/wrong type) | `moderate` | Non-blocking (`true`) | Adaptation still succeeds; `metadata.legacyPriority`/`sourceReference.rawPriority` become `null` instead of the non-finite value (Section 11.1) |
| `policy_default_values_applied` | Always — every successful adaptation, unconditionally | `informational` | Non-blocking (`true`) | Adaptation still succeeds; discloses that `priority`/`confidence`/`impact` are policy defaults |
| `invalid_canonical_shape` | `validateRecommendationShape` rejects the fully-constructed `Recommendation` (defensive; not expected to fire given the construction logic above it) | `significant` | Blocking (`false`) | `success: false`, `recommendation: null`; one issue per structural validator finding |

No issue message ever embeds a full input object, the complete legacy
item, or a raw value beyond what is explicitly named above — proven by a
dedicated marker-leak test covering both the original malformed-input
cases and the new non-finite-priority case.

## 12. Traceability and unmapped fields

`RecommendationSourceReference` preserves `rawType`/`rawText`/
`rawEvidenceContext` verbatim, independent of success. `rawPriority`
preserves the legacy value verbatim **only when it is `null` or a finite
number** — a non-finite value is replaced with an explicit, disclosed
`null` instead (Section 11.1), never left as an ambiguous artifact of
`JSON.stringify`'s own NaN/Infinity coercion. `evidenceContext`
(sentinel-core's raw `{siteId, site, trustScore}`/`{municipio, uf,
records, operators}` sub-object) is preserved as an opaque blob for
traceability — never parsed into structured fields, never used to derive
`affectedEntities` (Section 6). `RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS` is
always `[]`: every `LegacyRecommendationItem` field (`type`, `text`,
`priority`, `evidenceContext`) has a canonical home (`metadata`, `reason`,
`sourceReference`), matching Evidence's precedent.

## 13. Dependency boundaries

Verified by source inspection
(`tests/intelligence-recommendation-adapter-contract.test.ts`, comments
stripped before matching): the adapter never imports or calls any legacy
recommendation producer (`data-trust-engine.ts`, `evidence-center-engine.ts`,
`sentinel-core/recommendation/recommendation-engine.ts`,
`site-recommendation/route.ts`); never imports `node:sqlite`, `@/lib/db`,
`services/site-service.ts`, Next.js, or an API route; performs no
file/network I/O; imports **no legacy service module at all** — unlike
Evidence (which needed `copernicus-truth.ts` for its mandatory
truthfulness criterion), this adapter needs nothing from the legacy layer
beyond the plain data its caller supplies; never imports the Runtime
Registry; has no `Date.now()`/`Math.random()`/`crypto.randomUUID()`
anywhere (determinism). A full walk of `services/intelligence/**` confirms
no file there references `intelligence-adapters`.

## 14. Runtime registry decision

**No new `EngineId`, no adapter manifest, no registry entry, no manifest
edit.** `"recommendation"` is already one of Phase 1's eleven canonical
`EngineId`s and was already registered by Increment 2
(`services/intelligence-runtime/canonical-engine-manifests.ts`,
`status: "planned"`) — its description already correctly anticipated this
adapter ("Recommendation-shaped output already exists scattered across
legacy services... but no canonical Recommendation Adapter exists yet
(08_ADAPTER_STRATEGY.md adapter #4, Increment 6)"). Unlike Increment 4's
Data Trust manifest, **no correction was needed this time** — the existing
description remains accurate even now that the adapter exists, since it
already says the adapter "exists yet" is the missing piece, not something
requiring a factual update. A dedicated test confirms the manifest is
byte-unchanged (`status` still `"planned"`) and no new manifest was added
(`listManifests()` still has exactly 3 entries).

## 15. Capabilities decision

`config/capabilities.json` is **unchanged**. No entry represents
"Recommendation" as a distinct user-facing feature, and no route or UI
consumes this adapter. A dedicated test confirms no entry references
`intelligence-adapters` or `recommendation-adapter` anywhere in the file.

## 16. Public API

Exactly the set the mission specifies, nothing more:
`adaptLegacyRecommendation`, `adaptLegacyRecommendationList`,
`LegacyRecommendationItem`, `LegacyRecommendationType` (+
`LEGACY_RECOMMENDATION_TYPES` constant, the same pattern as Evidence's
`LEGACY_EVIDENCE_TYPES`), `RecommendationAdapterContext`,
`RecommendationAdaptationResult`, `RecommendationAdaptationIssue` (+
`RecommendationAdaptationIssueCode`), `RecommendationSourceReference`,
`RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS`. No unrelated helper is exported
— unlike Evidence's pre-hardening state, this adapter needs no legacy
helper re-export at all (Section 13), so that specific mistake has no
opportunity to recur here.

## 17. Tests added

- **`tests/intelligence-recommendation-adapter.test.ts`** — 57 tests (44
  original + 13 added by pre-commit hardening): successful mapping for
  both producer shapes; structural validation; input/context (including
  nested `affectedEntities`) immutability; determinism; no cross-call
  state accumulation; JSON serialization; metadata preservation
  (`legacyType`/`legacyPriority`, including the `null` case for
  `DATA_TRUST_TEXT`); direct `reason` mapping; `sourceReference` fidelity;
  missing/whitespace-only `reason` blocking without throwing; missing
  `idSeed` blocking; empty and malformed `affectedEntities` blocking;
  missing/invalid timestamp blocking; an unrecognized type not blocking
  but flagged; all five known types adapting successfully; always-empty
  `unmappedFields`; issue-message marker-leak check; a dedicated
  **policy-default-disclosure group** (literal `priority`/`confidence`/
  `impact.magnitude`/`impact.timeframe` values, per-type `impact.area`,
  the generic fallback, metadata flags, the issue, and the two
  `limitations` entries); a **legacy priority finite-number handling
  group** (9 tests: finite preserved, `null` preserved and not flagged,
  `NaN`/`Infinity`/`-Infinity` all become disclosed `null`, the issue
  present/non-blocking/`moderate`, adaptation still succeeds, canonical
  `priority` unaffected, and a full JSON round-trip proving the `null` is
  explicit, not `JSON.stringify`'s own coercion); a **structural-fields**
  group (`recommendedActions`/`evidence` always empty, `affectedEntities`
  preserved in order); a **duplicate affected entities group** (3 tests:
  not deduplicated, order preserved, both entries present, input not
  mutated, deterministic); an **individual-vs-list identity** test; a
  **duplicate-type identifier collision** test (`GLOBAL_RULE`, preserved
  as documented, Section 19); a **Unicode preservation** test; and a
  **frozen-input** test.
- **`tests/intelligence-recommendation-adapter-contract.test.ts`** — 14
  tests (12 original + 2 added by pre-commit hardening): no legacy
  recommendation producer import/call; no `node:sqlite`/`@/lib/db`/
  `site-service.ts`; no Next.js/API-route import; no file/network I/O; no
  legacy service module imported at all; no Runtime Registry import; no
  `Date.now()`/`Math.random()`/`crypto.randomUUID()`; **no `as unknown as`
  cast or bare `any` type remains anywhere in the file**; **the
  `isNonEmptyReadonlyArray` type-predicate guard is present and used**;
  `services/intelligence/**` never references `intelligence-adapters`; no
  new `EngineId` registered and the existing `recommendation` manifest is
  unchanged; no engine `"active"`; `config/capabilities.json` unchanged.

Total tests for this increment: **71** (57 + 14), up from the
pre-hardening **56** (44 + 12).

## 18. Quality-gate results

`npx tsc --noEmit`: PASS. `npm test`: 36 test files, 468/468 passing (397
pre-increment baseline + 71 for this increment, up from 56 pre-hardening).
`npm run build`: PASS, identical route list and bundle sizes. Diff limited
to `services/intelligence-adapters/recommendation-adapter.ts`,
`tests/intelligence-recommendation-adapter{,-contract}.test.ts`, and this
document — `services/intelligence-adapters/index.ts` required no further
change during hardening (the new `invalid_legacy_priority` code flows
through the existing `RecommendationAdaptationIssueCode` type re-export
automatically).

## 19. Limitations

- No DB-touching outer layer exists (same staged-scope pattern as
  Increments 4–5) — this adapter cannot be invoked against real
  `getRecommendations()`/`recommendation()` output without a future
  increment building that wrapper and supplying real `idSeed`/
  `affectedEntities`/`timestamp` at the call site.
- `priority`/`confidence`/`impact.magnitude`/`impact.timeframe` are
  uniform policy defaults, not measured signals, disclosed at runtime
  (Section 11) but still defaults. If a legacy change ever introduces a
  genuine, documented urgency scale, these defaults should be revisited
  against that evidence.
- **Identifier collision for duplicate-type recommendations within one
  subject is a known, explicitly documented and tested limitation,
  deliberately preserved, not resolved, by this hardening pass**: `RecommendationId`
  depends only on `idSeed` + recommendation `type`, never on array
  position (order-dependent IDs were explicitly avoided). `GLOBAL_RULE`
  can legitimately produce up to 6 same-type items
  (`recommendation-rules.ts` has 6 entries); if adapted under one shared
  `idSeed`, all 6 collide to the same `RecommendationId` — reproduced by a
  dedicated, passing test. No current runtime, persistence, caching, or
  UI-keying consumer exists that this collision could affect today. **This
  must be resolved before any future increment relies on
  `RecommendationId` uniqueness for database persistence, caching,
  deduplication, orchestration, or UI keys** — recorded here as a
  standing precondition for that future work, not something this
  hardening pass attempted to fix (redesigning identity was explicitly out
  of scope for this pass).
- Three further legacy "recommendation"-shaped producers were found and
  explicitly excluded from consolidation this increment
  (`site-recommendation/route.ts`, `duplicates-engine.ts`'s
  `DuplicateCandidate.recommendation`, `enterprise-v3-engine.ts`'s
  strategic/scenario recommendation strings) — Section 5. Not silently
  missed, but also not solved here; scope discipline over completeness.
- Source-inspection contract tests cannot detect a dynamically-constructed
  import path — the same accepted, repository-wide limitation noted in
  every prior increment's contract tests.

## 20. Deferred work

The DB-touching outer layer for this adapter; consolidating the three
excluded legacy producers (Section 5), if ever prioritized; Confidence
Adapter; Data Quality Adapter; Duplicate Candidate consolidation
(`14_IMPLEMENTATION_ROADMAP.md`'s own postponed-work list); Municipality/
State Rollup Adapter; the Intelligence Orchestrator; any new API route;
wiring `Recommendation.evidence: []` to real `EvidenceId`s from Increment
5's adapter; the eight remaining canonical engine manifests noted since
Increment 2.

## 21. Rollback

Delete `services/intelligence-adapters/recommendation-adapter.ts`,
`tests/intelligence-recommendation-adapter.test.ts`, and
`tests/intelligence-recommendation-adapter-contract.test.ts`. Revert the
one export block added to `services/intelligence-adapters/index.ts` (and
its doc-comment update). Nothing else was modified —
`services/intelligence/**`, every legacy engine file named in Section 5,
`config/capabilities.json`, `services/intelligence-runtime/**`, every
route, and every prior increment's adapter are all untouched.

## 22. Acceptance criteria

Met: baseline independently verified; complete architectural audit
performed before any code was written; Increment 5 confirmed present
exactly as frozen; legacy producers discovered by direct reading and
repository-wide search, not assumed; the three-shape reconciliation
question `02_CANONICAL_DOMAIN_MODEL.md`/`14_IMPLEMENTATION_ROADMAP.md`
assigned to this increment answered explicitly (Section 5–6), refining
"three" to "two independent + one derivative," with three further,
previously-unnamed candidates evaluated and explicitly excluded; pure,
deterministic, immutable, JSON-serializable adapter built reusing
canonical types/validators, no duplication; disclosure policy follows
Increment 5's established philosophy exactly, extended to use
Recommendation's own `limitations` field where Evidence had none; no
database, Runtime Registry, engine execution, API, or UI touched; 56
focused tests added, all passing; all pre-existing tests remain green;
TypeScript and production build both pass.

## Go/No-Go for the next increment

**Go**, for whichever increment is chartered next (Confidence Adapter,
Data Quality Adapter, or the Intelligence Orchestrator, per
`14_IMPLEMENTATION_ROADMAP.md`'s sequencing). This increment's acceptance
bar is met in full, and its explicit, evidence-based reconciliation record
(Section 5) gives a future increment consolidating the three excluded
producers a documented starting point rather than a blank slate.
