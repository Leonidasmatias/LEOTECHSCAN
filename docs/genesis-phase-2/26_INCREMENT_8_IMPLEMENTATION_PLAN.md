# 26 — Increment 8 Implementation Plan: Canonical Evidence Path

Planning-only document. No production code, test, route, adapter, engine,
manifest, configuration, database schema, or package file was modified to
produce this plan. Written against frozen baseline `c4258eb`
(`genesis-phase-2-increment-7-v1`) plus the uncommitted
`ADR_020_FINAL_INTELLIGENCE_API_ARCHITECTURE.md`.

## 1. Executive summary

Increment 8 adds the second canonical Intelligence capability route,
`GET /api/intelligence/evidence-center/site?id=<siteId>`, as a peer to
Increment 7's frozen Data Trust route, per ADR-020's Option C (federated
capability APIs). The hard problem is already solved: the existing,
unmodified Evidence Adapter (Increment 5) already consumes exactly the
shape `evidenceCenterForSite()` already produces. Increment 8 is therefore
almost entirely wiring — an outer read adapter, a small new checksum helper,
a capability-scoped Orchestrator, a dedicated projection/envelope, and a
route/handler pair — following the exact pattern Increment 7 established
and then corrected during its own audit cycle (route/handler split,
authentication before dynamic import, no dead envelope fields, empirically
justified `getWritableDb()` choice). This plan resolves every open design
question so implementation requires no architectural invention.

## 2. Authoritative architecture decisions

- **ADR-020** (Final Intelligence API Architecture): Option C accepted.
  Increment 8 builds a peer capability route; must not modify Increment 7's
  envelope; must not build the aggregate route; "evidence" is not
  automatically a new `EngineId`.
- **ADR-016** (Minimal read-only IntelligenceOrchestrator, Increment 6.5):
  minimal, single-use-case, DI-based orchestrator pattern — reused for
  Evidence, not generalized into one shared orchestrator this increment
  (per ADR-020 §11's reconciliation note: generalize once a third
  capability's needs make the shared shape clear, not before).
  Note: `services/intelligence-runtime/intelligence-orchestrator.ts` is
  the Increment 7 module name; Increment 8's own orchestrator is a
  **separate, new module**, not an edit to that file.
- **ADR-017** (Minimal Snapshot Provider): `deriveSiteSnapshot` is reused
  **verbatim, unmodified** — Increment 8 does not touch
  `services/intelligence-adapters/snapshot-provider.ts`.
- **ADR-018** (Data Trust read-only outer adapter as its own seam): the
  same seam discipline applies to the new Evidence outer adapter — DB
  access isolated from pure translators and from the projection adapter.
- **ADR-019** (Stage 3/4 sequencing): unaffected; Increment 8's route is
  additive with zero migrated callers, identical posture to Increment 7's.
- **08_ADAPTER_STRATEGY.md**: Evidence Adapter is adapter #3; this
  increment adds the DB-fetching half `08_ADAPTER_STRATEGY.md` always
  described but Increment 5 deliberately deferred.
- **12_DEPENDENCY_GRAPH.md** forbidden dependency #3 (no route bypassing
  the Orchestrator to call a legacy engine) applies identically here.
- **16_QUALITY_GATES.md**: unchanged gate list applies verbatim.

## 3. Exact scope

In scope:
1. `services/intelligence-adapters/evidence-checksum.ts` (new, pure).
2. `services/intelligence-adapters/evidence-center-read-adapter.ts` (new,
   DB-touching, thin).
3. `services/intelligence-runtime/intelligence-evidence-orchestrator.ts`
   (new, pure core, DI-based).
4. `services/intelligence-runtime/intelligence-evidence-orchestrator-instance.ts`
   (new, real wiring).
5. `services/intelligence-adapters/evidence-projection-adapter.ts` (new,
   pure) — its own envelope, independent of Increment 7's.
6. `app/api/intelligence/evidence-center/site/handler.ts` (new).
7. `app/api/intelligence/evidence-center/site/route.ts` (new).
8. Corresponding tests (Section 11).
9. `docs/genesis-phase-2/25_INCREMENT_8_CANONICAL_EVIDENCE_PATH.md` (new,
   written *during* implementation, not by this planning task).
10. A narrow, documented exclusion added to the two existing "every adapter
    is pure" contract tests (`tests/intelligence-site-adapter-contract.test.ts`,
    `tests/intelligence-data-trust-adapter-contract.test.ts`), naming the
    new outer adapter file — the same pattern Increment 7 already
    established for `data-trust-read-adapter.ts`.

## 4. Exact non-goals

- No modification to `services/intelligence-adapters/evidence-adapter.ts`
  (Increment 5) — reused verbatim; no verified contract defect was found
  that would justify touching it.
- No modification to Increment 7's route, handler, orchestrator, envelope,
  or projection adapter.
- No aggregate endpoint (`GET /api/intelligence/site`).
- No new `EngineId`/manifest registration; no `config/capabilities.json`
  change.
- No modification to any legacy file: `services/evidence-center-engine.ts`,
  `services/copernicus-engine.ts`, `services/data-trust-engine.ts`,
  `services/site-notes.ts`, `services/audit-trail.ts`.
- No modification to any legacy route:
  `app/api/evidence-center/site/route.ts`,
  `app/api/evidence-center/export/route.ts`,
  `app/api/copernicus/site/route.ts` (and no other `app/api/copernicus/**`
  route).
- No caller migration; no UI change.
- No caching (ADR-020 §17 explicitly prohibits it for this increment).
- No database schema/migration change.
- No package/lockfile change.
- No wiring of `EvidenceId`s into Increment 7's Score/Recommendation
  contracts (explicitly deferred by ADR-020 §21).
- No reorganization of `services/intelligence-adapters/` into a dedicated
  I/O-adapter directory (Section 9 below explains why, and records this as
  a documented future trigger, not a task for this increment).

## 5. Final component design

### 5.1 Route (`app/api/intelligence/evidence-center/site/route.ts`)

Verified against the actual, current Increment 7 files (not assumed):
`app/api/intelligence/data-trust/site/route.ts` authenticates first
(`const auth = requireAdminAuth(request); if (!auth.authorized) return
auth.response;`), then dynamically imports the production Orchestrator
module, then delegates to `handler.ts`. `handler.ts` contains zero
reference to `requireAdminAuth`/`@/lib/auth-guard` (confirmed by direct
read) and exports only `handleCanonicalDataTrustSiteRequest` plus its
`CanonicalDataTrustRouteDeps` type. `route.ts` exports only `runtime`,
`dynamic`, `GET` (Next.js's App Router route-type checker forced this
split during Increment 7 — `next build` failed with "Property ... is
incompatible with index signature" the first time an extra named export
was added alongside `GET`).

Increment 8's `route.ts`/`handler.ts` must reproduce this exact structure
verbatim, with the auth-before-import ordering correct **from the first
version written** (not requiring its own post-hoc fix pass, since the
lesson is now already known):

```
route.ts:
  GET(request):
    auth = requireAdminAuth(request)
    if (!auth.authorized) return auth.response
    { getCanonicalEvidenceForSite } = await import(
      "@/services/intelligence-runtime/intelligence-evidence-orchestrator-instance"
    )
    return handleCanonicalEvidenceCenterSiteRequest(request, { getCanonicalEvidenceForSite })

handler.ts:
  handleCanonicalEvidenceCenterSiteRequest(request, deps):
    siteId = parseSiteId(request)          // identical parsing rule to Increment 7
    if siteId === null: 400
    try:
      result = deps.getCanonicalEvidenceForSite(siteId)
      if result.notFound: 404 (plain error body, never the envelope)
      envelope = projectCanonicalEvidenceResponse(result)
      return 200 (if result.success) else 422
    catch: 500, sanitized, console.error only
```

Confirmed requirements this design satisfies: route authenticates before
dynamic import; handler contains no authentication; route exports only
`runtime`/`dynamic`/`GET`; no database import in either file (only a
type-only import of the Orchestrator's result type in `handler.ts`,
exactly mirroring Increment 7's `import type { CanonicalDataTrustOrchestrationResult }`
pattern).

### 5.2 Outer read adapter (`services/intelligence-adapters/evidence-center-read-adapter.ts`)

Verified against the actual, current `data-trust-read-adapter.ts` (direct
read, not assumption): it imports `dataTrustForSite` (value import) and
`getWritableDb` (value import, not `getDb`), accepts an optional injected
`db: DatabaseSync = getWritableDb()` parameter, calls the legacy function
with a **literal** `false` third argument, and returns a narrow, hand-typed
shape composed from the legacy return value — no canonical construction,
no HTTP projection.

Exact signature and responsibility for Evidence:

```ts
export interface LegacyEvidenceCenterReadResult {
  readonly site: SiteRow;                          // for Snapshot derivation (dataImportacao/arquivoOrigem)
  readonly evidences: readonly LegacyEvidenceItem[]; // exactly evidenceCenterForSite()'s own `evidences` array,
                                                      // already shaped {type, source, status, summary}
}

export function fetchLegacyEvidenceCenterForSite(
  siteId: number,
  db: DatabaseSync = getWritableDb(),
): LegacyEvidenceCenterReadResult | null {
  const dossier = evidenceCenterForSite(db, siteId, false);
  if (!dossier) return null;
  return { site: dossier.site, evidences: dossier.evidences };
}
```

Narrows away `dossier.trust`, `dossier.copernicus`, `dossier.notes`,
`dossier.history`, `dossier.googleMaps`, `dossier.technicalRecommendation`,
`dossier.governance` — none of these are needed by the Evidence Adapter or
by Snapshot derivation, and none are silently smuggled into the canonical
result (Section 6's model catalog already named every one of these as
belonging to a different concern — Data Trust's own already-frozen path,
or not canonical at all). This mirrors exactly how
`data-trust-read-adapter.ts` narrows away `satellite` from its own legacy
result.

Does not construct canonical `Evidence`, does not project HTTP, does not
persist, does not expose a raw `DatabaseSync`/row object beyond the
already-existing, already-pure `SiteRow` type. Uses `getWritableDb()`, not
`getDb()` — see Section 9 for the full, evidenced justification (three
separate `ensure*Tables` schema-init paths, not one).

### 5.3 Checksum helper — Section 7 has the full specification; module
placement resolved here: **Option A, a separate file**,
`services/intelligence-adapters/evidence-checksum.ts`. Repository
convention strongly favors this: every existing pure helper in this
codebase (`site-entity-adapter.ts`'s `toStableKey`,
`snapshot-provider.ts`'s `readLegacyString`) lives inside its own module
next to the thing that uses it, and Increment 7 already established the
precedent of a small, standalone, purely-computational adapter file
(`snapshot-provider.ts` itself) sitting beside the larger adapters it
serves. A checksum helper folded into the Orchestrator module would blur
that module's own "DI-based wiring only" responsibility (Section 5.5) with
a genuinely separate, independently-testable pure computation.

### 5.4 Data Source / Pipeline / version identities

Verified against actual precedent (`evidence-adapter.ts`'s own source and
its own test fixture):

- **`EvidenceAdapterContext.source` (`DataSourceId`)**: `"evidence-center"`
  — one uniform value for the whole batch (the adapter's own
  `adaptLegacyEvidenceList` shares one context across all items; there is
  no per-item slot for a different `DataSourceId`). This is architecturally
  honest: the Evidence Center legacy subsystem genuinely *is* the data
  source for every item in this batch, regardless of each item's own,
  already-distinct `origin.origin` value (which the adapter independently
  sets to each item's own legacy `source` string — `"vivo_sites.xlsx"`,
  `"SQLite sites"`, `"Sentinel-1 metadata_only"`, `"Data Trust Engine"`,
  `"site_notes"` — untouched, already correct, already tested).
- **Pipeline**: **not a context field at all.** `evidence-adapter.ts`
  hardcodes `EVIDENCE_CENTER_PIPELINE = "evidence-center"` internally and
  assigns it to `origin.pipeline` itself — the Orchestrator supplies
  nothing for this; it is not part of `EvidenceAdapterContext`.
- **Adapter/contract version (`context.version`)**: **omit it.**
  `EvidenceAdapterContext.version` is optional and defaults to the
  adapter's own `EVIDENCE_ADAPTER_DEFAULT_VERSION = "0.1.0"` when omitted —
  exactly how Increment 7's Orchestrator already treats
  `DataTrustAdapterContext`/`RecommendationAdapterContext` (neither ever
  sets an explicit `version`, letting each pure adapter's own tested
  default apply). Inventing a new version value here would be a needless,
  unprecedented deviation.
- **Checksum algorithm version**: not a field on `EvidenceAdapterContext`
  at all (only the raw `checksum` string is). Versioning belongs to the
  checksum helper itself — encoded as a literal prefix on its own output
  (Section 7), not threaded through the Evidence Adapter's contract.

### 5.5 Orchestrator

`services/intelligence-runtime/intelligence-evidence-orchestrator.ts`
(pure core) + `intelligence-evidence-orchestrator-instance.ts` (real
wiring) — same two-file split as Increment 7's
`intelligence-orchestrator.ts`/`-instance.ts`, for the identical, verified
reason: keeping the core DI-based (no `node:sqlite` import at all, only
`import type` for anything originating in the DB-touching outer adapter)
so it stays unit-testable with zero I/O, per this repository's own,
repeatedly-confirmed convention that a Vitest file transitively importing
`node:sqlite` cannot be safely collected.

```ts
// AMENDED POST-IMPLEMENTATION (see "Post-implementation amendment following
// independent audit F-2" after this code block) -- this interface now shows
// all eight actual dependencies, not the six originally planned here.
export interface EvidenceOrchestratorDeps {
  readonly fetchLegacyEvidenceCenterForSite: (siteId: number) => LegacyEvidenceCenterReadResult | null;
  readonly deriveSiteSnapshot: (input: SnapshotProviderInput) => SnapshotDerivation;   // reused verbatim
  readonly adaptLegacySiteRow: (input: SiteRow) => SiteAdaptationResult;               // reused verbatim -- added per F-2 amendment below
  readonly toSiteEntityReference: (site: Site) => EntityReference<"Site">;             // reused verbatim -- added per F-2 amendment below
  readonly computeEvidenceChecksum: (item: LegacyEvidenceItem) => string;              // new
  readonly adaptLegacyEvidence: (
    item: LegacyEvidenceItem,
    context: EvidenceAdapterContext,
  ) => EvidenceAdaptationResult;                                                       // reused verbatim -- called once per item, not via the batch wrapper (see step 5 below)
  readonly now: () => string;
  readonly environment: () => CalculationContext["environment"];
}

export interface CanonicalEvidenceOrchestrationResult {
  readonly notFound: boolean;
  readonly success: boolean;
  readonly siteId: string;
  readonly snapshot: SnapshotDerivation | null;
  readonly context: OrchestrationContextSummary | null;   // same shape as Increment 7's
  readonly evidence: readonly Evidence[];
  readonly issues: readonly OrchestrationIssue[];          // same {stage, code, field, severity, message, canContinue} shape
  readonly limitations: readonly Limitation[];
}
```

### Post-implementation amendment following independent audit F-2

This is an amendment, not a rewrite of the plan's own history: the
original text above (before this amendment) listed six dependencies. The
independent post-implementation audit (finding F-2, MEDIUM) found that
implementation validation correctly required **two additional**
dependencies beyond those six: `adaptLegacySiteRow` and
`toSiteEntityReference`. The actual, correct, already-implemented
dependency count is therefore **eight**, not six. The code block above has
been updated in place to show all eight; this section records why, without
erasing the fact that the original plan under-specified this.

**Why these two dependencies are necessary:** `CalculationContext.scope`
is a mandatory field on the `CalculationContext` contract, and it must be
either the literal string `"global"` or a valid `EntityReference`. This
Orchestrator's scope is genuinely one specific Site, never `"global"`, so
a real `EntityReference<"Site">` is required. `02_CANONICAL_DOMAIN_MODEL.md`'s
binding rule forbids constructing an `EntityReference<"Site">` by any means
other than the sanctioned Site Entity Adapter — no orchestrator, adapter,
or route may build one independently. `adaptLegacySiteRow` performs the
sanctioned Site adaptation from the legacy `SiteRow`; `toSiteEntityReference`
performs the sanctioned narrowing from the resulting canonical `Site` to
the `EntityReference<"Site">` the `CalculationContext` needs. Both are
reused verbatim from Increment 3, unmodified.

Site adaptation's own issues are propagated into the aggregated
orchestration issues (tagged `stage: "site"`), not discarded or ignored —
if Site adaptation fails, the Orchestrator reports `success: false` with
those issues surfaced, and does not attempt Evidence adaptation (since no
valid `CalculationContext` can be constructed without a valid scope).

**No new architecture was introduced by this refinement.** Both
dependencies are the exact same, already-reused, already-unmodified
Increment 3 adapter that Increment 7's own Orchestrator already depends on
for the identical reason. `ADR-016` (minimal, single-use-case orchestrator)
and `ADR-020` (federated capability APIs, per-capability orchestrator
ownership) both remain fully satisfied — this amendment adds a correctly-scoped
dependency to an already-approved design, it does not change what kind of
thing the Evidence Orchestrator is or does.

**Ordering of operations** (`getCanonicalEvidenceForSite(siteId)`):

1. Call `deps.fetchLegacyEvidenceCenterForSite(siteId)`. `null` → return
   `{ notFound: true, success: false, siteId: String(siteId), snapshot: null, context: null, evidence: [], issues: [], limitations: [] }`, nothing further attempted.
2. Derive the Snapshot from `legacy.site.dataImportacao`/`arquivoOrigem` via
   `deps.deriveSiteSnapshot(...)` — **one Snapshot per request**, computed
   once, reused for every evidence item's `EvidenceAdapterContext.snapshot`
   (all items in one request share the same site, hence the same
   Snapshot — there is exactly one Snapshot derivation call per request,
   not one per evidence item).
3. Build the shared `requestedAt`/`contextId`/`correlationId`/`environment`
   exactly as Increment 7's Orchestrator does (`context:evidence:${siteId}:${requestedAt}`
   naming the capability explicitly in the id, distinguishing it from
   Data Trust's `context:data-trust:${siteId}:${requestedAt}` so a
   correlation id can never be confused between the two capabilities even
   if the same site is queried through both routes in the same instant).
4. **For each legacy evidence item, in the array's own existing order**
   (`evidenceCenterForSite()`'s `evidences` array is always exactly the
   five items CADASTRO/COORDENADAS/COPERNICUS/QUALIDADE/OBSERVACOES, in
   that fixed order — the Orchestrator preserves this order, never
   re-sorts): compute `deps.computeEvidenceChecksum(item)` — **one checksum
   per evidence item**, not one for the whole batch (a checksum's purpose
   is per-content drift detection; a single batch-wide checksum would not
   let a consumer detect which specific item changed).
5. **Do not call the batch convenience wrapper `adaptLegacyEvidenceList`.**
   That wrapper takes one shared `EvidenceAdapterContext` for the whole
   list (confirmed: `adaptLegacyEvidenceList(items, context)`'s own
   signature has no per-item context slot), but each item needs its *own*
   `checksum` (step 4). The Orchestrator therefore **calls
   `adaptLegacyEvidence` individually, once per item**, each with its own
   context object — identical in every field (`idSeed`, `snapshot`,
   `source`, `timestamp`) except `checksum`, which is that item's own
   computed value. This is not a deviation from the adapter's contract —
   `adaptLegacyEvidenceList` is itself documented as "not a second
   translation path — every item is still adapted independently by
   `adaptLegacyEvidence`"; the Orchestrator simply performs that same
   per-item independence explicitly, in the array's own order, so each
   item's distinct checksum can be threaded through.
6. **`idSeed` composition**: `String(siteId)` for every item — Evidence has
   no canonical Site back-reference field at all (confirmed: `Evidence`'s
   interface has no `siteId`/`subjectId`), so no Site Entity Adaptation
   step is required for this capability (a deliberate, documented
   simplification relative to Data Trust/Recommendation's own orchestrator,
   both of which need a real `EntityReference<"Site">` because their
   canonical contracts embed one). `EvidenceId` becomes deterministic:
   `evidence:${siteId}:${evidenceType}` (via the adapter's own existing
   `toIdentifier<"Evidence">(`evidence:${idSeed}:${evidenceType}`)`
   construction, unmodified), unique per site per evidence type.
7. Aggregate every item's issues (tagged `stage: "evidence"`, with the
   item's own `type` folded into the issue's existing `field`/`message`
   text, exactly as each item's own adapter call already reports which
   type it concerns) and every successfully-produced `Evidence`'s
   `limitations` (both the Copernicus and non-Copernicus disclosure
   entries the adapter itself already documents), plus the Snapshot's own
   limitation when the synthetic fallback fires (identical pattern to
   Increment 7).
8. **Copernicus truth metadata treatment**: no special handling needed by
   the Orchestrator — `adaptLegacyEvidence` already embeds
   `copernicusTruthMetadata()` into `Evidence.origin.processingMetadata`
   for the COPERNICUS-type item and forces its `reliability` low, entirely
   internally. The Orchestrator does not need to inspect or re-derive this.
9. **Success determination**: `success = true` only if **every** item
   adapted successfully (`adaptLegacyEvidence` returned `success: true`
   for all five) — unlike Data Trust's single-Score success criterion,
   Evidence's primary result is inherently a *set*; a genuinely honest
   `success` flag should not claim success while silently dropping a
   failed item. Items that fail still contribute their issues; `evidence`
   only ever contains the items that actually succeeded (never a
   placeholder for a failed one).
10. Return the aggregated `CanonicalEvidenceOrchestrationResult`.

No persistence, no cache write, no audit-log write, no mutation, no engine
manifest status change — identical, structurally-enforced guarantee to
Increment 7 (no such dependency exists in `EvidenceOrchestratorDeps` at
all).

**Reconciliation with ADR-005/ADR-016 (per ADR-020 §11):** this is a
second, independent, minimal capability orchestrator, not a generalization
of Increment 7's existing one and not a new shared generic orchestrator.
Consistent with ADR-020's explicit position that this choice is
implementation-time and does not by itself trigger convergence — that
remains deferred to a future capability's evidence.

### 5.6 Production wiring (`intelligence-evidence-orchestrator-instance.ts`)

Identical shape to Increment 7's own instance file: imports the real,
pure `deriveSiteSnapshot` (verbatim reuse), the new real
`computeEvidenceChecksum`, the real, pure `adaptLegacyEvidence` (verbatim
reuse, called once per item — never `adaptLegacyEvidenceList`, per Section
5.5 step 5), the real `fetchLegacyEvidenceCenterForSite` (the one
DB-touching import in this file, plus the outer adapter file itself),
`now: () => new Date().toISOString()`, and the same
`environment(): CalculationContext["environment"]` helper reading
`process.env.NODE_ENV`. Exports `getCanonicalEvidenceForSite(siteId)`.

### 5.7 Projection adapter and envelope — see Section 6.

## 6. Exact contracts

### 6.1 HTTP envelope (dedicated, independent of Increment 7's)

```ts
interface EvidenceCenterCanonicalEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "evidence-center";
  readonly siteId: string;
  readonly snapshot: {
    readonly id: string;
    readonly kind: "derived" | "synthetic";
    readonly source: "data_importacao" | "arquivo_origem" | "fallback";
  } | null;
  readonly context: {
    readonly contextId: string;
    readonly correlationId: string;
    readonly requestedAt: string;
    readonly requestedBy: string;
    readonly environment: string;
  } | null;
  readonly result: {
    readonly evidence: readonly Evidence[];
  };
  readonly adaptation: {
    readonly success: boolean;
    readonly issues: readonly EvidenceEnvelopeIssue[];
    readonly limitations: readonly Limitation[];
  };
}
```

**Top-level field resolved: `result.evidence`, not a bare top-level
`evidence`.** Consistency with Increment 7's own established envelope
shape (`result: { score, evidence, recommendations }`) outweighs a
capability-specific shortcut — a future consumer reading both capability
envelopes should find the same `result.<payload>` convention, not a
special case for Evidence. This does not require touching Increment 7's
envelope (that field already exists there, always `[]` — Increment 8 does
not change its meaning or content, it only *populates* the equivalent slot
truthfully within Evidence's own, independent envelope type).

**No `notFound` field** — applying Increment 7's own hard-won Fix 4 lesson
from the start: a not-found result is mapped to a plain 404 error body by
the route/handler, before this projection function is ever called;
`CanonicalEvidenceOrchestrationResult.notFound` remains internal (exactly
as Increment 7's `CanonicalDataTrustOrchestrationResult.notFound` still
does), never surfacing in the envelope type or its serialized output.

Exact 200 response shape: `schemaVersion: "1.0"`, `capability:
"evidence-center"`, `siteId`, non-null `snapshot`, non-null `context`,
`result.evidence` containing between 0 and 5 `Evidence` records (0 only if
every item's adaptation genuinely failed, per Section 5.5 point 9 — never
fabricated to appear non-empty), `adaptation.success`/`issues`/`limitations`
populated per the aggregation rules above.

### 6.2 Checksum specification (Section 7 below has full detail; contract
summary): `computeEvidenceChecksum(item: LegacyEvidenceItem): string` —
pure, deterministic, one call per evidence item, output format
`"sha256-v1:<hex>"`.

## 7. Checksum specification

**File:** `services/intelligence-adapters/evidence-checksum.ts` (Section
5.3 already resolves placement: Option A).

**Input fields:** exactly the four fields present on `LegacyEvidenceItem`
— `type`, `source`, `status`, `summary` — nothing else (no context fields,
no site id, no timestamp; the checksum is a content fingerprint of the
evidence item's own payload only, matching `Evidence.checksum`'s own
documented purpose: "content-integrity checksum of the evidence payload").

**Deterministic serialization rule:** construct a **new** literal object
with hardcoded key order (never reuse the input object's own iteration
order), trim each string field, join with a fixed, unambiguous delimiter
that is not JSON (avoids JSON-escaping edge cases entirely) and is
extremely unlikely to appear in legacy Portuguese business text:

```ts
function serialize(item: LegacyEvidenceItem): string {
  const clean = (value: string) => (value ?? "").trim();
  const UNIT_SEPARATOR = String.fromCharCode(31); // ASCII Unit Separator (code point 31, hex 1F)
  return [clean(item.type), clean(item.source), clean(item.status), clean(item.summary)].join(UNIT_SEPARATOR);
}
```

The ASCII Unit Separator (decimal code point 31, hex `1F`) is the
delimiter — a real, standard control character reserved for exactly this
purpose, never expected in human-authored evidence text. Built via
`String.fromCharCode(31)` in source code (never typed as a literal raw
byte in a file, which would be invisible and easy to corrupt via editing
or copy-paste) so its intent stays self-documenting. **Field ordering:**
fixed as
`type, source, status, summary` — the same order the interface itself
declares them in, chosen for readability, not semantic necessity (any
fixed order would be equally deterministic).

**Whitespace/null normalization:** `(value ?? "").trim()` on every field —
matches this repository's own established convention
(`site-entity-adapter.ts`'s `readLegacyString`, `snapshot-provider.ts`'s
identical trim rule) rather than inventing a new one. No case-folding, no
diacritic stripping (unlike `toStableKey`, which is for *identifier keys*,
not content fingerprints — case and accents are part of the content being
fingerprinted here, not noise to normalize away).

**Hash algorithm:** `node:crypto`'s built-in `createHash("sha256")` —
already-precedented as an acceptable "pure" (no real I/O, fully
deterministic, in-memory-only) platform capability in this repository
(`lib/auth-guard.ts` already imports `node:crypto`'s `timingSafeEqual` and
is unit-tested directly, with no `node:sqlite`-style Vitest exclusion
needed). **No external npm package** — `node:crypto` is a Node platform
built-in, not a dependency addition; no `package.json` change is implied
or required.

**Output format:** `"sha256-v1:" + digest`, where `digest` is the
lowercase hex-encoded SHA-256 digest of the serialized string (UTF-8
encoded). The `sha256-v1:` prefix is the checksum's own, self-contained
versioning mechanism (Section 5.4) — a future algorithm change would use a
new prefix (e.g. `sha256-v2:`), never silently reusing the same prefix for
a different serialization rule.

**Content fingerprint, not cryptographic proof:** explicitly documented
(in the module's own header comment, to be written during implementation)
that this checksum exists to detect accidental drift between when
evidence was recorded and when it is later re-examined — it is not a
security control, not a tamper-proof signature, and carries no
authentication guarantee. SHA-256 is used here purely for its strong
collision resistance as a hash function, not for any cryptographic
protocol property.

**Collision limitations:** two evidence items with byte-identical
`type`/`source`/`status`/`summary` (after trimming) produce the identical
checksum — this is correct, expected behavior (identical content should
fingerprint identically), not a defect. A theoretical SHA-256 collision
between two *different* serialized strings is acknowledged as
astronomically unlikely and not specifically mitigated further, consistent
with SHA-256's standard, accepted use for content fingerprinting
throughout the industry.

**Versioning strategy:** the `sha256-v1:` prefix *is* the version. No
separate exported version constant is needed unless a second algorithm
variant is ever added, at which point both prefixes would need to remain
recognized by any future consumer that parses this field — not a concern
for Increment 8, since nothing parses the checksum today, it is only
carried through as an opaque string.

**Explicitly forbidden, per the mission's own instruction (and already
consistent with every existing pure module in this repository):**
`Math.random()`, `Date.now()`, `new Date()`, locale-dependent string
methods (`toLocaleString`, `localeCompare`), reliance on unstable object
key iteration order, and any external package beyond Node's own built-in
`node:crypto`.

## 8. Snapshot specification

**Confirmed: Increment 8 reuses `deriveSiteSnapshot` unchanged** — no
edit to `services/intelligence-adapters/snapshot-provider.ts` is needed or
permitted. Its existing signature (`SnapshotProviderInput = {dataImportacao,
arquivoOrigem}` → `SnapshotDerivation`) already accepts exactly the two
fields the Evidence outer adapter's own `SiteRow` result carries.

- **Source legacy site fields:** `legacy.site.dataImportacao`,
  `legacy.site.arquivoOrigem` — the same two fields, from the same
  `SiteRow` shape, Increment 7 already uses; no new field is introduced.
- **Request timestamp behavior:** unrelated to Snapshot derivation
  (Snapshot is derived from import metadata, not request time); the
  request's own `requestedAt` is a separate, injected-clock value used
  only for `context.requestedAt`/`EvidenceAdapterContext.timestamp`
  (Section 5.5 point 3), never for Snapshot derivation.
- **Snapshot propagation:** derived **once per request** (Section 5.5
  point 2), then passed as the same `SnapshotId` into every item's
  `EvidenceAdapterContext.snapshot` — all five evidence items in one
  response share one Snapshot, since they all describe the same Site at
  the same request instant.
- **Relationship between `SnapshotId` and Evidence provenance:** each
  `Evidence.snapshot` field, and each `Evidence.origin.snapshot` field
  (inside `DataProvenance`), receive the identical `SnapshotId` value —
  confirmed consistent with `adaptLegacyEvidence`'s own construction,
  which sets both from the same `context.snapshot` input.
- **Behavior when site is not found:** identical to Increment 7— the
  outer adapter returns `null`, the Orchestrator returns `notFound: true`
  immediately, and Snapshot derivation is never attempted (there is no
  site row to derive it from).

## 9. Read-only classification

Verified by direct source inspection of the actual, current files (not
assumption):

- `evidenceCenterForSite(db, siteId, persist)` — calls
  `ensureDataTrustTables(db)` unconditionally (schema-init path #1),
  performs its own raw `SITE_SELECT` fetch, then calls
  `dataTrustForSite(db, siteId, persist)` (propagates the flag —
  Increment 7 already proved this function's own business-data writes are
  fully gated behind `persist`), then `copernicusForSite(db, siteId,
  undefined, undefined, persist)` (propagates the flag; `copernicusForSite`
  calls `ensureCopernicusTables(db)` unconditionally — schema-init path
  #2 — and its own business-data writes, inside `persistEvidence()`, are
  gated behind its own `if (persist)` check, confirmed by direct read of
  `services/copernicus-engine.ts`), then `getSiteNotes(db, siteId)` (calls
  `ensureSiteNotes(db)` unconditionally — schema-init path #3; the
  function itself is a pure `SELECT`), then `validationHistory(db,
  siteId)` (pure `SELECT`, already verified read-only by Increment 7's own
  audit), then builds the five-item `evidences` array, then, only `if
  (persist)`: 5× `INSERT INTO site_evidence_center` plus one
  `recordAudit("EVIDENCE_CENTER_OPENED", ...)` (which itself calls
  `ensureAuditTrail(db)` — a fourth schema-init path, but only reachable
  when `persist` is true, so irrelevant to the `persist=false` path this
  increment uses).

- **Three schema-init paths are reachable even with `persist=false`:**
  `ensureDataTrustTables`, `ensureCopernicusTables`, `ensureSiteNotes` —
  one more than Increment 7's single `ensureDataTrustTables` path, because
  Evidence Center's dossier construction pulls in Copernicus and Site
  Notes as additional legacy dependencies Data Trust's own path never
  touches.
- **Why `getWritableDb()` is necessary, not `getDb()`:** identical,
  now-doubly-confirmed reasoning to Increment 7's own empirically-tested
  conclusion — each of these three `ensure*Tables` functions runs an
  unconditional `CREATE TABLE IF NOT EXISTS`, which requires a writable
  connection specifically on a database instance where that table has
  never been created, and is a true no-op only once it already exists. A
  `PRAGMA query_only = ON` connection (`getDb()`) would throw "attempt to
  write a readonly database" against a fresh/incomplete database on any
  one of these three paths — strictly worse than the disclosed, bounded
  schema-write `getWritableDb()` accepts.
- **Why `persist=false` is mandatory:** it is the only mechanism that
  actually gates the five `INSERT INTO site_evidence_center` statements,
  the `recordAudit("EVIDENCE_CENTER_OPENED", ...)` call, `dataTrustForSite`'s
  own two business-data `INSERT`s, and `copernicusForSite`'s own scene/
  validation `INSERT`s — omitting it, or passing anything other than a
  literal `false`, would silently reintroduce every one of those writes.
- **Classification, precisely, per ADR-020/Increment 7's own established
  language:** this path is **logically read-only for business data**
  (never inserts/updates/deletes/audits a row when `persist=false` is
  passed correctly) and **technically capable of a one-time schema
  write** across three separate tables' worth of `ensure*Tables` calls —
  fully a no-op at the schema level only once all three tables already
  exist on the target database. This must be disclosed as prominently in
  Increment 8's own design document as it eventually was (after a required
  fix) in Increment 7's.
- **What side-effect tests must cover:** every one of the four
  `ensure*Tables`-adjacent facts above, restated as source-inspection
  assertions (the literal `false` argument; the choice of `getWritableDb`
  over `getDb`; absence of any `INSERT`/`recordAudit` call inside the new
  outer adapter itself); plus a repeat of Increment 7's own legacy-route
  regression proof, now covering three legacy routes instead of one
  (`app/api/evidence-center/site/route.ts`,
  `app/api/evidence-center/export/route.ts`, and confirming
  `app/api/copernicus/site/route.ts`'s pre-existing `persist=false` call
  remains untouched too, since it is directly adjacent, already-correct
  precedent this increment must not disturb).

## 10. Error mapping

| Condition | Status | Body |
|---|---|---|
| `requireAdminAuth` rejects | 401 or 503 (unchanged, whatever the guard itself returns) | its own sanitized body |
| `id` missing/blank | 400 | `{ "error": "Missing or invalid 'id' parameter." }` |
| `id` not a positive integer (non-numeric, negative, zero, decimal, whitespace-only) | 400 | same body |
| Site not found | 404 | `{ "error": "Site not found." }` |
| Every evidence item's adaptation failed, or some subset failed such that `adaptation.success` is `false` (site found, dossier legacy fetch succeeded, but canonical adaptation could not fully succeed) | 422 | envelope still returned, with `result.evidence` containing only the items that did succeed (0–4 of 5) and `adaptation.issues` populated for every failure |
| Unexpected exception | 500 | `{ "error": "Evidence intelligence assessment unavailable." }`, logged only as `console.error("intelligence_evidence_center_site_failed", error instanceof Error ? error.name : "unknown")` — no stack trace or message ever forwarded |

No fabricated successful empty-evidence response for any failure path —
an empty `result.evidence` array is only ever returned when every
adaptation genuinely failed (reflected honestly via `adaptation.success:
false` and populated `issues`), never silently substituted for an error.

## 11. Test matrix

| File | Responsibility |
|---|---|
| `tests/intelligence-evidence-checksum.test.ts` | deterministic output; stable field order; distinct inputs generally differ; no clock/random dependency (source-inspected: no `Date.now`/`Math.random`); whitespace/null normalization; exact `"sha256-v1:"` prefix format; checksum-version behavior (changing the prefix would be a new version, not silently reusing this one) |
| `tests/intelligence-evidence-center-read-adapter-contract.test.ts` | source-inspection: `evidenceCenterForSite(db, siteId, false)` literal; `getWritableDb` imported, not `getDb`; no canonical construction (`toIdentifier`/`Score`/`Evidence` kind literals); no `INSERT`/`recordAudit`; narrow return shape (no `trust`/`copernicus`/`notes`/`history` leaking through) |
| `tests/intelligence-evidence-orchestrator.test.ts` | not-found behavior; five-item ordering preserved; one Snapshot derivation per request (mock call-count assertion); one checksum call per item (5 calls, distinct items); deterministic `EvidenceId`s across repeated calls; exact `EvidenceAdapterContext` construction per item (shared snapshot/source/timestamp, per-item checksum); injected clock/environment usage, never a real one; no DB import (source-inspected, mirroring Increment 7's own core-file check) |
| `tests/intelligence-evidence-projection-adapter.test.ts` | exact envelope key set (no `notFound`); exact `Evidence[]` passthrough under `result.evidence`; empty-evidence case only asserted alongside `adaptation.success: false` (never presented as an unqualified success); issues/limitations mapping; `schemaVersion`/`capability` literals |
| `tests/intelligence-evidence-center-route.test.ts` | behavioral, against the exported, injectable handler (mirroring `intelligence-data-trust-route.test.ts`'s post-audit-corrected shape: handler has no auth dependency); id validation (missing/invalid/whitespace); 404; 422; 500 with no message leak; 200 with exact content type; no internal field leakage (no stray `notFound` key in any response body) |
| `tests/intelligence-increment-8-contract.test.ts` | source-inspection sweep mirroring `intelligence-increment-7-contract.test.ts`: exact production file set exists; dependency direction (outer adapter only reachable from the orchestrator instance, never from the route/handler/projection adapter directly); route exports exactly `runtime`/`dynamic`/`GET`; auth-before-dynamic-import ordering (index-based, from day one); no DB import in route/handler; no legacy engine import anywhere outside the outer adapter; manifests still `"planned"` (reused `runtimeEngineRegistry` checks); Increment 7's envelope/route file content unchanged (a literal diff-style assertion, or a hash/substring check against known Increment 7 markers); no aggregate route file exists (`app/api/intelligence/site` absent) |
| `tests/intelligence-increment-8-side-effects.test.ts` | mirrors `intelligence-increment-7-side-effects.test.ts`: sweep every new file for write-indicating patterns; confirm the one `evidenceCenterForSite` call passes `false` literally; confirm all three legacy routes (`evidence-center/site`, `evidence-center/export`, `copernicus/site`) are byte-for-byte unchanged; confirm no new file references `EXPORTACOES`/`writeFile`/`mkdir` (the export route's filesystem-write behavior must never be reachable from the new canonical path); confirm no package.json/schema/config file referenced or changed |
| **Existing adapter-purity contract tests** (`tests/intelligence-site-adapter-contract.test.ts`, `tests/intelligence-data-trust-adapter-contract.test.ts`) | add exactly one string to each file's existing `ADAPTER_EXCLUSIONS` array — `"evidence-center-read-adapter.ts"` — alongside the already-present `"data-trust-read-adapter.ts"` entry. No other line in either file changes; no assertion is weakened; every other file in `services/intelligence-adapters/` remains swept by every existing check. |
| **Regression suite** | the full existing suite (currently 42 files / 557 tests at `c4258eb` plus the uncommitted ADR) must remain green; explicitly re-run `tests/intelligence-evidence-adapter.test.ts` and `tests/intelligence-evidence-adapter-contract.test.ts` (Increment 5's own, unmodified) to prove Increment 8 introduced no regression in the adapter it reuses. |

**Exact targeted Vitest command** (to be run during implementation, not
now):

```
npx vitest run \
  tests/intelligence-evidence-checksum.test.ts \
  tests/intelligence-evidence-center-read-adapter-contract.test.ts \
  tests/intelligence-evidence-orchestrator.test.ts \
  tests/intelligence-evidence-projection-adapter.test.ts \
  tests/intelligence-evidence-center-route.test.ts \
  tests/intelligence-increment-8-contract.test.ts \
  tests/intelligence-increment-8-side-effects.test.ts \
  tests/intelligence-site-adapter-contract.test.ts \
  tests/intelligence-data-trust-adapter-contract.test.ts \
  tests/intelligence-evidence-adapter.test.ts \
  tests/intelligence-evidence-adapter-contract.test.ts
```

## 12. Exact file inventory

**New production files (7):**
1. `services/intelligence-adapters/evidence-checksum.ts`
2. `services/intelligence-adapters/evidence-center-read-adapter.ts`
3. `services/intelligence-runtime/intelligence-evidence-orchestrator.ts`
4. `services/intelligence-runtime/intelligence-evidence-orchestrator-instance.ts`
5. `services/intelligence-adapters/evidence-projection-adapter.ts`
6. `app/api/intelligence/evidence-center/site/handler.ts`
7. `app/api/intelligence/evidence-center/site/route.ts`

**Modified production files (1):**
1. `services/intelligence-adapters/index.ts` — new export additions for
   `evidence-checksum.ts` and `evidence-projection-adapter.ts` only
   (both pure, DB-free); **`evidence-center-read-adapter.ts` is
   deliberately excluded from this barrel**, exactly matching
   `data-trust-read-adapter.ts`'s own precedent, for the identical
   `node:sqlite`-collection reason.

**New test files (7):**
1. `tests/intelligence-evidence-checksum.test.ts`
2. `tests/intelligence-evidence-center-read-adapter-contract.test.ts`
3. `tests/intelligence-evidence-orchestrator.test.ts`
4. `tests/intelligence-evidence-projection-adapter.test.ts`
5. `tests/intelligence-evidence-center-route.test.ts`
6. `tests/intelligence-increment-8-contract.test.ts`
7. `tests/intelligence-increment-8-side-effects.test.ts`

**Modified test files (2):**
1. `tests/intelligence-site-adapter-contract.test.ts` — add one string to
   the existing `ADAPTER_EXCLUSIONS` array.
2. `tests/intelligence-data-trust-adapter-contract.test.ts` — add one
   string to the existing `ADAPTER_EXCLUSIONS` array.

**New documentation files (1, produced *during* implementation, not by
this plan):**
1. `docs/genesis-phase-2/25_INCREMENT_8_CANONICAL_EVIDENCE_PATH.md`

**Files explicitly forbidden from modification:**
- `app/api/evidence-center/site/route.ts`
- `app/api/evidence-center/export/route.ts`
- `app/api/copernicus/site/route.ts`
- `app/api/copernicus/status/route.ts`, `search/route.ts`, `validation/route.ts`
- `services/evidence-center-engine.ts`
- `services/copernicus-engine.ts`
- `services/copernicus-truth.ts`
- `services/data-trust-engine.ts`
- `services/confidence-engine.ts`
- `services/satellite-validation-engine.ts`
- `services/site-notes.ts`
- `services/audit-trail.ts`
- `services/intelligence-adapters/evidence-adapter.ts`
- `services/intelligence-adapters/snapshot-provider.ts`
- `services/intelligence-adapters/data-trust-read-adapter.ts`
- `services/intelligence-adapters/api-projection-adapter.ts`
- `services/intelligence-runtime/intelligence-orchestrator.ts`
- `services/intelligence-runtime/intelligence-orchestrator-instance.ts`
- `services/intelligence-runtime/canonical-engine-manifests.ts`
- `app/api/intelligence/data-trust/site/route.ts`
- `app/api/intelligence/data-trust/site/handler.ts`
- `config/capabilities.json`
- `package.json`, any lockfile
- Any database schema/migration file
- Any UI/`components/**` file

## 13. Implementation sequence

| # | Step | Expected file(s) | Purpose | Dependency | Acceptance check | Rollback |
|---|---|---|---|---|---|---|
| 1 | Checksum helper | `evidence-checksum.ts` | deterministic content fingerprint | none | unit tests (Section 11) pass in isolation | delete file |
| 2 | Outer read adapter | `evidence-center-read-adapter.ts` | read-only legacy fetch | none | `tsc` clean; contract test passes | delete file |
| 3 | Orchestrator core | `intelligence-evidence-orchestrator.ts` | DI-based wiring, zero I/O | 1, 2 (type-only) | pure unit tests pass, no DB import (source-inspected) | delete file |
| 4 | Production instance | `intelligence-evidence-orchestrator-instance.ts` | real wiring | 1, 2, 3 | `tsc` clean | delete file |
| 5 | Projection adapter | `evidence-projection-adapter.ts` | envelope mapping | 3 (type-only) | unit tests pass | delete file |
| 6 | Handler | `app/api/intelligence/evidence-center/site/handler.ts` | request logic, no auth | 4 (type-only), 5 | unit tests pass | delete file |
| 7 | Route | `app/api/intelligence/evidence-center/site/route.ts` | auth + dynamic import + delegate | 4, 6 | `next build` succeeds, route listed once | delete file |
| 8 | Unit tests | all seven new test files | prove each module | 1–7 | all green | delete files |
| 9 | Contract tests | `intelligence-increment-8-contract.test.ts` + two narrow exclusion edits | dependency-boundary proof | 1–7 | all green | delete file; revert two one-line edits |
| 10 | Side-effect tests | `intelligence-increment-8-side-effects.test.ts` | schema/write proof | 1–7 | all green | delete file |
| 11 | Architecture document | `25_INCREMENT_8_CANONICAL_EVIDENCE_PATH.md` | frozen design record | 1–10 | matches implementation exactly | delete file |
| 12 | Targeted gates | — | fast feedback | 1–11 | exact command in Section 11 passes | n/a |
| 13 | Full gates | — | regression proof | 12 | `tsc`/`npm test`/`npm run build` all clean; 42+9=51 test files (existing 42 unchanged in count except the two modified files' internal exclusion, which changes zero test counts, plus 7 new files); route appears once in build output | n/a |
| 14 | Independent audit | — | adversarial verification | 13 | matches Increment 7's own two-pass (initial + focused re-audit) precedent | n/a |

## 14. Quality gates

Exact commands, to be run during implementation (not this planning task):

```
git diff --check
npx tsc --noEmit
<the exact targeted vitest command in Section 11>
npm test
npm run build
```

Required confirmations:
- Exact test-arithmetic reconciliation stated in the implementation report
  (baseline count at the time implementation starts, e.g. current 557 +
  ADR-020's own zero test-file impact, plus every new test file's exact
  count, reconciled to the final `npm test` total — no approximate
  bookkeeping, matching the discipline the Increment 7 focused re-audit
  already enforced).
- `/api/intelligence/evidence-center/site` appears **exactly once** in
  `npm run build`'s route listing.
- `git diff -- app/api/evidence-center/site/route.ts app/api/evidence-center/export/route.ts app/api/copernicus/site/route.ts`
  is empty.
- `git diff -- config/capabilities.json services/intelligence-runtime/canonical-engine-manifests.ts package.json`
  is empty (no manifest/config/package change).
- No schema/migration file appears in `git status --short`.
- Nothing staged before the implementation's own final approval step.
- No commit/tag/push during implementation itself — only at an explicitly
  separate, later "freeze" step, mirroring Increment 7's own multi-turn
  discipline (implement → independent audit → required-fix pass →
  focused re-audit → final documentation fix → final freeze).

## 15. Acceptance criteria

1. `GET /api/intelligence/evidence-center/site?id=` exists and is reachable.
2. Increment 7's Data Trust route, handler, orchestrator, and envelope are
   byte-for-byte unchanged.
3. `services/intelligence-adapters/evidence-adapter.ts` (Increment 5) is
   reused with zero modification.
4. The checksum helper is deterministic (identical input → identical
   output across repeated calls and across process restarts, i.e. no
   process-local or time-local state).
5. Exactly one canonical `Evidence` record is produced per successfully-
   adapted legacy evidence item — never more, never fewer, never merged.
6. No canonical `Evidence` is fabricated for a failed adaptation; a failed
   item contributes only issues, never a placeholder `Evidence`.
7. Authentication (`requireAdminAuth`) executes strictly before the
   dynamic production import, verified by an index-based ordering test.
8. Neither `route.ts` nor `handler.ts` contains a database import (only
   type-only imports where a type originates in a DB-touching module).
9. The one `evidenceCenterForSite` call in the new outer adapter passes a
   literal `false` third argument.
10. The canonical path is logically read-only for business data (no
    `INSERT`/`recordAudit` reachable with `persist=false`), verified by
    source-inspection side-effect tests.
11. The three-schema-init-path caveat (`ensureDataTrustTables`,
    `ensureCopernicusTables`, `ensureSiteNotes`) is documented prominently
    in `25_INCREMENT_8_CANONICAL_EVIDENCE_PATH.md`'s own dedicated
    "Known limitations"/side-effect section, not merely mentioned in
    passing.
12. No legacy route or legacy engine file has any diff.
13. No new `EngineId` is registered; no manifest's `status` changes; no
    `config/capabilities.json` entry is added or altered.
14. No aggregate endpoint (`GET /api/intelligence/site`) exists anywhere
    in the repository after this increment.
15. `git diff --check`, `npx tsc --noEmit`, the full targeted test run,
    `npm test`, and `npm run build` all pass with zero errors.

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Repeating Increment 7's original auth-ordering mistake | Section 5.1 specifies the corrected ordering from the first version written, not as a post-hoc fix |
| Repeating Increment 7's original dead-`notFound`-field mistake | Section 6.1 specifies no `notFound` field in the envelope from the start |
| Under-disclosing the (now three-path) schema-write nuance | Section 9 requires it prominently in the design doc's own limitations section, not just its side-effect rationale |
| Silently fabricating `Evidence` for a failed item | Section 5.5 point 9 and Section 15 item 6 make this an explicit, tested acceptance criterion |
| Checksum implementation drifting into a "security" claim it can't support | Section 7's explicit "content fingerprint, not cryptographic proof" documentation requirement |
| Growing exclusion-list technical debt in the two shared purity contract tests | Section 3/9 (below) documents this explicitly as a second occurrence and a future ADR trigger, not silently repeated without comment |
| Accidentally reachable filesystem-write path (via the export route's behavior) | Section 3 non-goals and Section 11's side-effect test explicitly assert no `EXPORTACOES`/`writeFile` reference in any new file |
| Scope creep into Score/Recommendation `EvidenceId` wiring | Explicitly listed as a non-goal (Section 4), matching ADR-020 §21's own prohibition |

## 17. Rollback plan

Delete all seven new production files, the two production-file additions
to `services/intelligence-adapters/index.ts` (revert to the current,
Increment 7-era export list), all seven new test files, revert the two
one-line exclusion-array edits in the existing purity contract tests, and
delete `docs/genesis-phase-2/25_INCREMENT_8_CANONICAL_EVIDENCE_PATH.md`.
Nothing else in the repository is touched by this increment, so nothing
else requires rollback.

## 18. Independent audit checklist

Mirrors the exact discipline already applied to Increment 7 (two full
audit passes plus a required-fix verification plus a final focused
re-audit): after implementation, an independent audit must re-verify,
from the actual repository content (not this plan's claims):

- Baseline/git state exactly as this plan's Section 14 describes.
- Every claim in Sections 5–10 against the actual, as-written source.
- The read-only classification (Section 9) via direct source trace, and,
  where practical, an isolated `node:sqlite` experiment analogous to the
  one that empirically confirmed Increment 7's identical claim.
- The auth-ordering and no-dead-field fixes are present from the *first*
  audited version, not requiring their own required-fix pass this time.
- Test arithmetic reconciles exactly.
- No forbidden file (Section 12's list) has any diff.

## 19. GO / NO-GO recommendation

**GO.** Every open design question has been resolved against the actual,
verified repository content, not assumption. The riskiest unknowns
(checksum design, per-item vs. batch adaptation, Snapshot-per-request vs.
per-item, `idSeed` composition, envelope field naming, schema-write
disclosure) are all resolved with concrete, evidenced answers in this
document. Implementation should be able to proceed directly from this
plan without inventing architecture mid-coding.
