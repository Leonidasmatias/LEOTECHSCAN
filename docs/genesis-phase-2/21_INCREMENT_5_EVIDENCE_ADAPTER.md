# 21 — Increment 5: Evidence Adapter (Genesis Phase 2)

Status: **Implemented**, hardened per an independent pre-commit audit. This
document was updated after that audit — every section below reflects the
implementation as it exists after the hardening pass (Section 11.1, 12,
13, 17), not the pre-audit state. No production behavior changed and no
runtime activation occurred as part of hardening: the corrections are
disclosure/documentation/API-surface fixes only, applied within the same
strictly-additive, adapter-only scope as the rest of this increment.

## 1. Objective

Build a pure, tested bridge between the existing legacy evidence produced
by `services/evidence-center-engine.ts`'s `evidenceCenterForSite()` and the
canonical `Evidence` contract
(`services/intelligence/evidence/evidence.ts`), per
`docs/genesis-phase-2/08_ADAPTER_STRATEGY.md`'s adapter #3. No legacy
behavior, database, API, or UI change. Adapter-only, strictly additive.

## 2. Verified starting baseline

- Repository: `C:/LEOTECHSCAN/APP`
- Branch: `master`
- HEAD: `ae394d1`
- Tag at HEAD: `genesis-phase-2-increment-4-v1`
- `origin/master`: `ae394d1` (matched)
- Working tree: clean
- `npx tsc --noEmit`: PASS
- `npm test`: 32 test files, 332/332 tests PASS
- `npm run build`: PASS

No stop condition triggered.

## 3. Roadmap alignment

As with Increment 4, the mission's requested filename
`docs/genesis-phase-2/05_EVIDENCE_MODEL.md` does not exist — the real file
at `05` is `05_ORCHESTRATION_MODEL.md`. This is a filename-assumption
mismatch, not a material architectural conflict: the actual canonical
Evidence contract lives in code
(`services/intelligence/evidence/evidence.ts`, `provenance.ts`), and its
architectural framing is in `02_CANONICAL_DOMAIN_MODEL.md`'s "Evidence /
Provenance" section and `08_ADAPTER_STRATEGY.md`'s adapter #3 entry — both
read in full for this increment (in addition to the ones already read in
prior increments this session).

`14_IMPLEMENTATION_ROADMAP.md` Increment 5 ("Evidence adapter... Depends on
Increment 4 (Score references need Evidence to exist to cite, even if the
citation is added in a follow-up pass). **Mandatory acceptance
criterion:** every Copernicus-sourced Evidence item carries `reliability`
reflecting simulated status and a `Limitation` disclosing it — verified by
a dedicated test asserting `isTruthfulCopernicusResponse`-equivalent
behavior survives the adapter translation (reusing
`services/copernicus-truth.ts`'s own existing helper where possible)")
matches this mission's brief and confirms Increment 5 is the correct next
roadmap step. No material disagreement found.

**Same deliberate scope narrowing as Increments 2–4**: `08_ADAPTER_STRATEGY.md`
names the file `services/intelligence-adapters/evidence-adapter.ts` (flat,
not a subdirectory) — this increment follows that exact frozen naming over
the mission brief's tentative `services/intelligence-adapters/evidence/`
suggestion, for the same consistency reason applied in Increments 3 and 4
(the frozen document's literal path wins over a "possible location").

## 4. Files inspected

Architecture (this increment, in addition to everything already read in
Increments 0–4 this session): `08_ADAPTER_STRATEGY.md` (re-read, adapter
#3 section), `02_CANONICAL_DOMAIN_MODEL.md` (re-read, "Evidence /
Provenance" and "Dataset Snapshot" sections), `12_DEPENDENCY_GRAPH.md`,
`13_MIGRATION_STRATEGY.md`, `14_IMPLEMENTATION_ROADMAP.md`,
`15_ARCHITECTURE_DECISIONS.md`, `16_QUALITY_GATES.md`,
`20_INCREMENT_4_DATA_TRUST_SCORE_ADAPTER.md`.

Canonical layer: `services/intelligence/evidence/evidence.ts` (`Evidence`
— confirmed it has **no** `limitations` field, unlike `Score`/
`Recommendation`; no entity/site link either — evidence is only ever
*cited* by `EvidenceId`, never itself tied to a subject), `evidence/provenance.ts`
(`DataProvenance` — confirmed all eight fields:
`origin`, `pipeline`, `snapshot`, `source`, `checksum`, `timestamp`,
`version`, `processingMetadata`), `contracts/limitation.ts` (confirmed
`Limitation` is used "identically by `Score`... and `Recommendation`" —
`Evidence` is not named, corroborating the finding above),
`validation/validators.ts` (`validateEvidenceShape`, reused directly),
`types/identifiers.ts` (`EvidenceId`, `SnapshotId`, `DataSourceId`).

Legacy layer: `services/evidence-center-engine.ts`
(`evidenceCenterForSite()` — full function read, including its five-item
`evidences` array literal and the `site_evidence_center` persistence
insert), `services/copernicus-truth.ts` (full file — the dependency-free
truth contract this increment's mandatory acceptance criterion requires
reusing), `services/copernicus-engine.ts` (confirmed
`copernicusTruthMetadata()` is spread into four real response sites,
corroborating it as the authoritative truth-stamp source).

Repository-wide search for `EvidenceItem`, `EvidenceResult`,
`EvidenceEntry`, `EvidenceRecord`, `sourceEvidence`, `trustEvidence`,
`validationEvidence` — **zero matches** anywhere in `*.ts`, confirming
`evidenceCenterForSite()`'s `evidences` array is the sole legacy Evidence
producer, with no competing or alternative shape anywhere in
`services/**`, `sentinel-core/**`, `lib/**`, `app/api/**`, or `tests/**`.

## 5. Legacy Evidence inventory

- **Authoritative producer**: `evidenceCenterForSite(db, siteId, persist)`
  (`services/evidence-center-engine.ts`), confirmed by direct reading. It
  builds exactly five evidence items, each shaped
  `{ type, source, status, summary }`:

  | `type` | `source` | `status` (example) | `summary` (example) |
  |---|---|---|---|
  | `CADASTRO` | `site.arquivoOrigem` | `"Disponivel"` | `"${site} - ${operator} - ${municipio}/${uf}"` |
  | `COORDENADAS` | `"SQLite sites"` | `"Validado"`/`"Pendente"` | `"${latitude}, ${longitude}"` |
  | `COPERNICUS` | `"Sentinel-1 metadata_only"` | `copernicus.validation.evidenceLevel` | `copernicus.recommendation` |
  | `QUALIDADE` | `"Data Trust Engine"` | `trust.trustBadge` | `"Trust Score ${trustScore}"` |
  | `OBSERVACOES` | `"site_notes"` | `"Disponivel"`/`"Sem observacoes"` | `"${count} observacoes locais"` |

- **Consumer**: `app/api/evidence-center/site/route.ts` (returns the whole
  dossier including `evidences`) and `app/api/evidence-center/export/route.ts`
  (CSV export of the *persisted* form). Neither route is touched by this
  increment.
- **No `id` field, no timestamp field, no numeric weight/reliability field**
  anywhere on an in-memory evidence item — confirmed by direct reading, not
  assumed. A `url` field only appears at *persistence* time (the
  `site_evidence_center` `INSERT`, `googleMaps` for `COORDENADAS` only), not
  on the runtime array items this adapter consumes.
- **Serialization**: at persistence, each item is `JSON.stringify`-ed
  verbatim into `evidence_json` — confirming the four-field shape is stable
  and already treated as serializable by the legacy system itself.
- **No existing validator** for this shape anywhere in the repository.

## 6. Canonical Evidence contract

```ts
interface Evidence extends BaseEntity<"Evidence"> {
  readonly kind: "Evidence";
  readonly id: EvidenceId;
  readonly source: string;
  readonly description: string;
  readonly weight: number;
  readonly reliability: UnitInterval;
  readonly snapshot: SnapshotId;
  readonly origin: DataProvenance;
  readonly checksum: string;
  readonly references: readonly string[];
}
```

plus `BaseEntity`'s `createdAt`, `updatedAt`, `version`, `metadata`.
`DataProvenance` (`evidence/provenance.ts`) requires `origin`, `pipeline`,
`snapshot`, `source`, `checksum`, `timestamp`, `version`,
`processingMetadata` — all eight fields, none optional.

**Two findings that shaped this adapter's design directly:**

1. **`Evidence` has no `limitations` field.** `contracts/limitation.ts`'s
   own doc comment states `Limitation` is "used identically by `Score`...
   and `Recommendation`" — `Evidence` is conspicuously not named, and its
   interface confirms this. The roadmap's mandatory acceptance criterion
   asks for "a `Limitation` disclosing" Copernicus's simulated status —
   since the canonical contract has no such field to put one in, and
   modifying `services/intelligence/**` is out of scope without a proven
   blocker (none exists here — this is a documented, evidenced contract
   gap, not something that blocks representing the legacy data), this
   adapter discloses the same fact through the mechanisms `Evidence`
   **does** have: `metadata.simulatedDataDisclosure: true`, a low, capped
   `reliability`, the full `copernicusTruthMetadata()` stamp embedded in
   `origin.processingMetadata` (verifiable with the real
   `isTruthfulCopernicusResponse()` helper), and a structured
   `copernicus_evidence_simulated` adaptation issue. Four independent,
   testable signals — a more thorough disclosure than a single missing
   field, not a workaround that loses information.
2. **`Evidence` has no entity/subject link.** It is only ever *cited* by a
   `Score`/`Recommendation` via `EvidenceId` — so, unlike Increment 4's
   `Score.entity`, this adapter needs no `EntityReference<"Site">` at all.
   It does, however, need a caller-supplied `idSeed` purely to keep
   `EvidenceId`s distinct across subjects (Section 8).

## 7. Adapter input contract

```ts
function adaptLegacyEvidence(
  item: LegacyEvidenceItem,
  context: EvidenceAdapterContext,
): EvidenceAdaptationResult;

function adaptLegacyEvidenceList(
  items: readonly LegacyEvidenceItem[],
  context: EvidenceAdapterContext,
): readonly EvidenceAdaptationResult[];

interface LegacyEvidenceItem {
  readonly type: string;
  readonly source: string;
  readonly status: string;
  readonly summary: string;
}

interface EvidenceAdapterContext {
  readonly idSeed: string;      // e.g. the Site EntityReference id -- keeps EvidenceIds distinct per subject
  readonly snapshot: string;    // no legacy snapshot mechanism exists (02_CANONICAL_DOMAIN_MODEL.md)
  readonly source: string;      // DataProvenance data-source seed
  readonly checksum: string;
  readonly timestamp: string;   // ISO-8601, no legacy timestamp exists
  readonly version?: string;    // optional, defaults to this adapter's own static "0.1.0"
}
```

`LegacyEvidenceItem` is hand-declared (no reusable named type exists in the
repository for it, unlike Increment 3's `SiteRow`) — narrow, evidence-based,
and deliberately typed with `type: string` (not narrowed to the five known
literals) so a hypothetical sixth legacy type does not become a compile
error; it is instead handled at runtime with a non-blocking
`unrecognized_evidence_type` issue. `adaptLegacyEvidenceList` is a thin
wrapper matching the real shape `evidenceCenterForSite()` actually
produces (an array of five items sharing one context) — it does not
duplicate `adaptLegacyEvidence`'s logic.

## 8. Adapter output contract

```ts
interface EvidenceAdaptationResult {
  readonly success: boolean;
  readonly evidence: Evidence | null;
  readonly issues: readonly EvidenceAdaptationIssue[];
  readonly sourceReference: EvidenceSourceReference; // { rawType, rawSource, rawStatus, rawSummary }
  readonly unmappedFields: readonly string[];         // always [] -- see Section 11
}
```

Never throws for malformed legacy data or context — every "bad data" path
returns `success: false` with structured `issues`.

## 9. Validation

`validateEvidenceShape` (`services/intelligence/validation/validators.ts`,
reused directly, not duplicated) runs against every successfully
constructed `Evidence` before it is returned; a failure converts to
`invalid_canonical_shape` issues and forces `success: false`. Same
explicit distinction as Increments 3/4: this increment guarantees
"adaptation completed" and "canonical structure valid" when successful — it
does not guarantee the evidence is complete, sufficient, reliable, or
factually true. Since the pre-commit hardening pass, this exact disclaimer
is also mirrored in-code on `EvidenceAdaptationResult.evidence`'s own
JSDoc (matching `DataTrustAdaptationResult.score`'s equivalent comment in
`services/intelligence-adapters/data-trust-score-adapter.ts`), not only
stated here. `success: true` also does not mean the
Evidence Center feature is operational end-to-end.

## 10. Identity, snapshot, and provenance mapping

- **`EvidenceId`**: `` `evidence:${idSeed}:${type}` `` — deterministic
  given `(idSeed, type)`, no random UUID, no time-dependent generation. A
  missing (or whitespace-only) `idSeed` blocks success (`missing_id_seed`)
  rather than silently colliding across subjects.
- **Identifier collision (documented current behavior, not redesigned by
  hardening)**: two `LegacyEvidenceItem`s sharing the same `type` and the
  same `context.idSeed` produce the **same** `EvidenceId` — proven by a
  dedicated test that deliberately exercises this, both through
  `adaptLegacyEvidence` called twice and through `adaptLegacyEvidenceList`
  with two same-type items in one call. This is not reachable through the
  only real, evidenced legacy producer (`evidenceCenterForSite()` never
  emits two items of the same `type`), so it was assessed, per the
  hardening mission's own instruction, as **not warranting a contract
  redesign**: no collision detection, no automatic deduplication, and no
  random-id fallback were added (all three were explicitly out of scope —
  "do not invent random IDs," "do not silently deduplicate"). The
  limitation is instead made explicit and permanent via the test itself
  (`tests/intelligence-evidence-adapter.test.ts`, "duplicate-type evidence
  within one subject") and this paragraph. `adaptLegacyEvidenceList`
  continues to preserve list order and does not mutate its input even when
  a collision occurs (also proven by a dedicated test).
- **`snapshot`/`origin.snapshot`**: caller-supplied (`context.snapshot`),
  branded via the existing `toIdentifier<"Snapshot">`. Per
  `02_CANONICAL_DOMAIN_MODEL.md`'s "Dataset Snapshot" section: "No
  equivalent exists in the legacy system today... this is a genuine gap, not
  a rename target" — this adapter does not invent one; it requires the
  caller to supply it, exactly as that document anticipates ("a minimal
  Snapshot Provider... is required before any adapter that needs to
  populate... `Evidence.snapshot`").
- **`origin.pipeline`**: constant `"evidence-center"` — the real producing
  function's name, identical across all five evidence types.
- **`origin.origin`**: the legacy item's own `source` field, reused
  verbatim — already the correct "where did this come from" value for
  every one of the five types (e.g. `"Sentinel-1 metadata_only"` for
  Copernicus, `"site_notes"` for observations), confirmed by reading
  `evidence-center-engine.ts`'s literal source strings.
- **`origin.source`/`checksum`/`timestamp`/`version`**: all caller-supplied
  (`context.source`/`checksum`/`timestamp`/`version`), for the same reason
  as Increment 4's `calculatedAt` — none of these exist per-item in legacy
  data, and this adapter must not call `Date.now()` (would break test #5's
  determinism requirement) or fabricate a checksum.
- **`checksum`** (top-level) is set to the same value as `origin.checksum`,
  trivially satisfying the contract's own documented invariant ("must match
  `origin.checksum`... when both are dereferenced from the same snapshot").
- **`references`**: always `[]`. The only legacy field that could plausibly
  populate it (the `googleMaps` URL, built only for `COORDENADAS` at
  *persistence* time from raw lat/lon) is not available on the in-memory
  `LegacyEvidenceItem` this adapter accepts, and reconstructing it by
  parsing the free-text `summary` string would be exactly the kind of
  fragile inference this mission prohibits.

## 11. Weight, reliability, and metadata mapping

No legacy evidence item carries a numeric weight or reliability signal of
its own for any of the five types — confirmed by reading
`evidence-center-engine.ts` in full. Rather than guess a per-type
distinction with no evidence behind it, this adapter applies exactly two
documented policy defaults:

- **`weight`**: constant `1` for every item — the legacy system draws no
  distinction between the five types' relative importance, so a uniform
  default is the only honest choice (it claims no evidence is more or less
  important than another, matching what the legacy data actually shows).
- **`reliability`**: `0.5` (neutral) for `CADASTRO`/`COORDENADAS`/
  `QUALIDADE`/`OBSERVACOES`; **`0.1`** for `COPERNICUS` — the one,
  mandatory, evidence-driven exception, reflecting
  `COPERNICUS_IS_REAL_SATELLITE_EVIDENCE === false`
  (`services/copernicus-truth.ts`). Proven lower than the default by a
  dedicated comparison test, and both literal values (`1`, `0.5`, `0.1`)
  are asserted directly by dedicated tests, not just compared relatively.
- **`metadata`**: `legacyType`, `legacyStatus` always preserved; plus
  `simulatedDataDisclosure: true` for `COPERNICUS` items, or
  `policyDefaultsApplied: true` / `weightSource: "adapter_policy_default"` /
  `reliabilitySource: "adapter_policy_default"` for the other four types.

Every field mapping here is either a direct, verbatim reuse of an existing
legacy value or a documented, uniform policy default — nothing is
recomputed, inferred, or guessed per item beyond the one Copernicus rule
the roadmap itself mandates.

### 11.1 Runtime disclosure of policy defaults (added by pre-commit hardening)

An independent pre-commit audit found that, while `weight`/`reliability`
were correctly documented as policy defaults in code comments and this
document, **non-Copernicus items carried no runtime signal** distinguishing
a policy default from a measured value — only Copernicus items did. A
downstream consumer inspecting only the `Evidence` object (not this
document or the adapter's source) could not tell the two apart for the
other four types. This was corrected:

- **Every** evidence item now carries exactly one type-driven disclosure
  signal, never both and never neither:
  - `COPERNICUS` items: `metadata.simulatedDataDisclosure: true` +
    `origin.processingMetadata` carrying the full `copernicusTruthMetadata()`
    stamp + a `copernicus_evidence_simulated` issue (unchanged from before
    hardening — already the more precise disclosure).
  - The other four types: `metadata.policyDefaultsApplied: true` +
    `metadata.weightSource`/`reliabilitySource: "adapter_policy_default"` +
    a new, non-blocking, `informational` `policy_default_values_applied`
    issue.
- **Behavior B was chosen** (per the hardening mission's own framing):
  Copernicus items receive only their own, more precise disclosure — never
  an additional, redundant generic `policy_default_values_applied` issue.
  This is proven by a dedicated test asserting Copernicus items do **not**
  carry `policy_default_values_applied`, and non-Copernicus items do **not**
  carry `copernicus_evidence_simulated`/`simulatedDataDisclosure`.
- The disclosure is purely additive: `success` remains `true`, the produced
  `Evidence` still passes `validateEvidenceShape`, and the underlying
  `weight`/`reliability` *values* are unchanged (`1`/`0.5`/`0.1` — the
  hardening mission was explicit that values should not change unless the
  canonical contract required it, and it does not).

## 12. Copernicus truthfulness (mandatory acceptance criterion)

Satisfied precisely as the roadmap specifies, by reusing
`services/copernicus-truth.ts`'s real, existing helper — not a
reimplementation:

- `origin.processingMetadata` for a `COPERNICUS`-type item is
  `{ ...copernicusTruthMetadata() }` — the exact same three-field stamp
  (`dataStatus`, `source`, `isRealSatelliteEvidence`) already spread into
  four real `copernicus-engine.ts` response sites.
- A dedicated test calls `isTruthfulCopernicusResponse()` — imported
  directly from `@/services/copernicus-truth` (its real, correct
  architectural home; **no longer re-exported from the adapter barrel**,
  see Section 12.1) — against `evidence.origin.processingMetadata` and
  asserts it returns `true` for Copernicus evidence and `false` for every
  other type — proving the truthfulness contract genuinely survives adapter
  translation, not merely asserted in prose.
- `services/copernicus-truth.ts` is confirmed, by its own header and by a
  dedicated test re-verifying it, to have zero imports of its own —
  reusing it introduces no new dependency surface, and it is not an
  "engine" in the sense this mission's scope forbids (no formula, no
  computation, no I/O; its own header explicitly invites exactly this kind
  of reuse).

### 12.1 Barrel export correction (added by pre-commit hardening)

The independent audit found `isTruthfulCopernicusResponse` was re-exported
from `services/intelligence-adapters/index.ts` — exposing a
`copernicus-truth.ts` (a legacy-layer module) helper as if it were part of
the Evidence Adapter's own public API, blurring the boundary between "the
adapter's API" and "a pass-through of an unrelated module." A
repository-wide search before removal confirmed **no production consumer**
used the barrel path — the only consumer was this increment's own test
file. Correction applied:

- `services/intelligence-adapters/index.ts` no longer exports
  `isTruthfulCopernicusResponse`.
- `services/intelligence-adapters/evidence-adapter.ts` no longer imports or
  re-exports it either — it was never called by the adapter's own logic
  (only `copernicusTruthMetadata()` is), so the import was removed
  entirely, not just the re-export.
- `tests/intelligence-evidence-adapter.test.ts` now imports it directly
  from `@/services/copernicus-truth`, the same path
  `tests/copernicus-truth.test.ts` already used.
- A dedicated contract test confirms neither `index.ts` nor
  `evidence-adapter.ts` references `isTruthfulCopernicusResponse` anymore.

## 13. Structured adaptation issues

Twelve codes (eleven from the original implementation plus one added by
pre-commit hardening), each independently evidenced: `missing_source`,
`missing_description` (both `significant`, blocking — required `Evidence`
fields with no legacy fallback); `missing_id_seed`, `missing_snapshot`,
`missing_provenance_source`, `missing_checksum`, `missing_evaluated_at`,
`invalid_timestamp` (all `significant`, blocking — required
context-supplied values, mirroring Increment 4's pattern exactly, and
proven to reject whitespace-only values the same way as empty strings);
`unrecognized_evidence_type` (`moderate`, non-blocking — a sixth legacy
type is not a structural failure, just noteworthy); `copernicus_evidence_simulated`
(`significant`, **non-blocking** — this is a disclosure, not a construction
failure: the Evidence is still successfully built, just always flagged);
**`policy_default_values_applied`** (`informational`, **non-blocking** —
added by pre-commit hardening, Section 11.1; emitted for every non-Copernicus
item, never alongside `copernicus_evidence_simulated`); `invalid_canonical_shape`
(`significant`, blocking — the same defensive safety net used in
Increments 3/4). No issue message embeds a full input object or a planted
distinctive value — proven by a dedicated test.

## 14. Dependency boundaries

Verified by source inspection
(`tests/intelligence-evidence-adapter-contract.test.ts`, comments stripped
before matching): the adapter never imports or calls
`evidenceCenterForSite()`/`evidence-center-engine.ts`; never imports
`node:sqlite`, `@/lib/db`, `services/site-service.ts`, Next.js, or an API
route; performs no file/network I/O; imports no other legacy engine file
(`data-trust-engine.ts`, `confidence-engine.ts`, `data-quality-engine.ts`,
`duplicates-engine.ts`, `satellite-validation-engine.ts`,
`copernicus-engine.ts` — none appear as real imports) — **the sole legacy
import is `services/copernicus-truth.ts`**, confirmed dependency-free
itself. A full walk of `services/intelligence/**` confirms no file there
references `intelligence-adapters`.

## 15. Runtime registry decision

**No new `EngineId`, no adapter manifest, no registry entry, and no edit
to any manifest field this time** (unlike Increment 4, no existing
manifest text was found to be factually incorrect as a result of this
increment — there is no `"evidence"` manifest in
`services/intelligence-runtime/canonical-engine-manifests.ts` to begin
with, since `"evidence"` is not one of Phase 1's eleven canonical
`EngineId`s and Increment 2 never registered one for it). A dedicated test
confirms `runtimeEngineRegistry.listManifests()` still has exactly 3
entries and no engine is `"active"`.

## 16. Capabilities decision

`config/capabilities.json` (22 entries) is **unchanged**. The pre-existing
`evidence_center` entry (`status: "partial"`, `evidenceType:
"derived_data"`) already truthfully describes the live legacy feature and
is not re-justified by this adapter's existence — no route or UI consumes
the new adapter. A dedicated test confirms the entry's `status` is
unchanged and no entry references `intelligence-adapters` or
`evidence-adapter` anywhere in the file.

## 17. Tests added

- **`tests/intelligence-evidence-adapter.test.ts`** — 52 tests (33 original
  + 19 added by pre-commit hardening): successful adaptation; structural
  validation; input/context immutability; determinism; no cross-call state
  accumulation; JSON serialization; metadata preservation; direct
  source/description mapping; `sourceReference` fidelity; default vs.
  overridden `version`; malformed evidence (missing source/description)
  failing without throwing; missing `idSeed`/`snapshot`/`checksum`/timestamp
  all blocking; invalid timestamp blocking; an unrecognized type not
  blocking but flagged; all five known types adapting successfully;
  always-empty `unmappedFields`; no database/framework/engine dependency
  (no throw); issue-message marker-leak check; a dedicated
  **policy-default-disclosure group** (literal `weight === 1` and
  `reliability === 0.5`, `metadata.policyDefaultsApplied`/`weightSource`/
  `reliabilitySource`, the `policy_default_values_applied` issue present
  and non-blocking/deterministic/serializable, Copernicus does **not**
  duplicate it, non-Copernicus does **not** carry the Copernicus-specific
  signals); a Copernicus-truthfulness group (now asserting the literal
  `0.1` reliability value, not just a relative comparison); an
  **individual-vs-list identity** test; a **whitespace-only context
  fields** group (`idSeed`/`snapshot`/`checksum`/`source`, all rejected
  without throwing); a **Unicode preservation** test (accented
  Portuguese text surviving adaptation and JSON round-tripping);
  a **frozen-input** test (`Object.freeze()` on both the item and the
  context); and a **duplicate-type identifier collision** test documenting
  the current, intentionally-not-redesigned behavior.
- **`tests/intelligence-evidence-adapter-contract.test.ts`** — 13 tests (11
  original + 2 added by pre-commit hardening): no
  `evidence-center-engine.ts` import/call; no `node:sqlite`/`@/lib/db`/
  `site-service.ts`; no Next.js/API-route import; no file/network I/O; no
  other legacy engine import, confirming `copernicus-truth.ts` is the sole
  legacy import and re-verifying it is itself dependency-free;
  `services/intelligence/**` never references `intelligence-adapters`;
  **neither `index.ts` nor `evidence-adapter.ts` references
  `isTruthfulCopernicusResponse` anymore** (the barrel-export correction,
  Section 12.1); no new `EngineId` registered and no engine `"active"`;
  `config/capabilities.json` unchanged and references neither the adapter
  nor `intelligence-adapters`.
- **List-adapter-specific additions** (in the same unit test file): an
  empty-array input adapts to an empty array; the input `items` array is
  never mutated; list order is preserved even when a duplicate-type
  collision occurs.

Total tests for this increment: **65** (52 + 13), up from the pre-hardening
**44** (33 + 11).

## 18. Quality-gate results

Recorded in this increment's final report and the pre-commit hardening
report (conversation's closing messages). Post-hardening expected: `tsc
--noEmit` clean; 34 test files / 397 tests passing (332 pre-increment
baseline + 65 for this increment, up from 44 pre-hardening); `next build`
unchanged in route list and bundle size; diff limited to the five files
this hardening pass is scoped to
(`services/intelligence-adapters/{evidence-adapter.ts,index.ts}`,
`tests/intelligence-evidence-adapter{,-contract}.test.ts`, this document).

## 19. Limitations

- No DB-touching outer layer exists (same staged-scope pattern as
  Increment 4) — this adapter cannot be invoked against real
  `evidenceCenterForSite()` output without a future increment building
  that wrapper and supplying real `snapshot`/`checksum`/`timestamp` values
  at the call site.
- `weight`/`reliability` (except Copernicus's mandated low value) remain
  uniform policy defaults, not measured signals — because none exist in
  the legacy data. This is now **disclosed at runtime** (Section 11.1), not
  just in comments, but the underlying values themselves are still
  defaults. If a future legacy change introduces a genuine
  per-evidence-type reliability signal, this adapter's defaults should be
  revisited against that new evidence, not assumed correct indefinitely.
- `references: []` always — the one plausible source (`COORDENADAS`'s
  `googleMaps` URL) is not available on the in-memory shape this adapter
  accepts, by design (see Section 10).
- `Evidence.limitations` does not exist; the workaround (metadata flag +
  embedded truth stamp + adaptation issue) is a considered, tested
  substitute, not an oversight, but is worth noting if a future increment
  ever proposes adding a `limitations` field to the canonical `Evidence`
  contract itself.
- **Identifier collision for duplicate-type evidence within one subject is
  a known, explicitly documented, and tested limitation, not a defect**
  (Section 10) — deliberately not redesigned per the hardening mission's
  own instruction to choose "the smallest truthful solution" rather than
  expand the adapter's contract for a scenario the only real legacy
  producer never triggers.
- Source-inspection contract tests (both this increment's and the sibling
  Site/Data-Trust adapters') cannot detect a dynamically-constructed import
  path (e.g. `import(computedPath)`) — an accepted, repository-wide
  convention limitation, not unique to this increment.

## 20. Deferred work

The DB-touching outer layer for this adapter; Recommendation Adapter
(Increment 6, which will need to *cite* `EvidenceId`s this adapter
produces); Confidence Adapter; Data Quality Adapter; Municipality/State
Rollup Adapter; the Intelligence Orchestrator; any new API route; wiring
Data Trust's `Score.evidence: []` (Increment 4) to real `EvidenceId`s this
adapter now makes possible; the eight remaining canonical engine manifests
noted since Increment 2.

## 21. Rollback

Delete `services/intelligence-adapters/evidence-adapter.ts`,
`tests/intelligence-evidence-adapter.test.ts`, and
`tests/intelligence-evidence-adapter-contract.test.ts`. Revert the export
block added to `services/intelligence-adapters/index.ts` (and its
doc-comment update) — note this block no longer includes
`isTruthfulCopernicusResponse` after hardening, so a rollback simply
removes the whole Evidence Adapter export block, nothing more granular is
needed. Nothing else was modified — `services/intelligence/**`,
`services/evidence-center-engine.ts`, `services/copernicus-truth.ts`,
`services/copernicus-engine.ts`, `config/capabilities.json`,
`services/intelligence-runtime/**`, every route, and every prior
increment's adapter are all untouched, both before and after the
pre-commit hardening pass.

## 22. Go/No-Go recommendation for the next increment (Recommendation Adapter, Increment 6)

**Go.** This increment's acceptance bar — a pure, tested, non-throwing,
non-mutating Evidence Adapter that reuses existing canonical validators,
satisfies the roadmap's mandatory Copernicus-truthfulness criterion with a
real, verifiable test (not an assertion in prose), and is correctly
excluded from both the runtime registry and the capability registry — is
met. Increment 6's Recommendation Adapter will need to cite `EvidenceId`s;
this increment's `adaptLegacyEvidence`/`adaptLegacyEvidenceList` are the
honest, tested starting point for producing those ids, not a placeholder
concealing a gap.
