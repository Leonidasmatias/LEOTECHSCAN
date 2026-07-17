# 27 — Increment 9: Site Intelligence Aggregator — Architecture Audit and Implementation Plan

Planning-only document. No production code, test, or configuration file is
created or modified by this document. Written per the Increment 9
"Architecture Audit and Implementation Planning" mission, against the
frozen Increment 8 baseline.

## 1. Baseline

Repository: `C:\LEOTECHSCAN\APP`. Branch `master`, HEAD `fa8f180`, tag
`genesis-phase-2-increment-8-v1` points at HEAD, working tree clean,
nothing staged — confirmed before any file for this increment was touched.

## 2. Objective

Introduce, in a future implementation increment (not this one), a
federated Site Intelligence aggregate route:

```
GET /api/intelligence/site?id=<siteId>
```

composing the two currently frozen canonical capabilities — Data Trust
(Increment 7) and Evidence Center (Increment 8) — into one site-level
response, without bypassing either capability's own architectural
boundary, without modifying either frozen contract, and without calling
any legacy engine directly.

## 3. Governing ADRs and documents

- **ADR-020** (`ADR_020_FINAL_INTELLIGENCE_API_ARCHITECTURE.md`) — the
  controlling decision record. Option C (capability routes plus a future
  aggregation endpoint) is accepted; Section 11 already specifies the
  mandatory aggregation dependency direction (`Capability Orchestrator /
  Canonical Application Service → Aggregation Orchestrator → Aggregate
  Projection → Aggregate Route`) and explicitly prohibits internal
  orchestration through HTTP calls; Section 22 lists the aggregator's
  implementation prerequisites, which this plan addresses (Section 16,
  below).
- **ADR-016** (minimal, single-use-case orchestrator pattern) — the
  aggregator's own orchestrator follows the identical minimal, DI-based
  shape as the two capability orchestrators it composes.
- **ADR-017** (minimal Snapshot Provider) — `deriveSiteSnapshot` is reused
  verbatim by both existing capabilities; this plan does not introduce a
  third invocation of it at the aggregate layer (Section 11).
- **ADR-018** (outer adapter as its own seam) — both existing outer read
  adapters remain each capability's own, unmodified, exclusive concern;
  the aggregator never touches either directly.
- **`02_CANONICAL_DOMAIN_MODEL.md`** — the Site Entity Adapter is the only
  sanctioned way to construct an `EntityReference<"Site">`; this rule is
  already satisfied inside each existing capability orchestrator and is
  not re-invoked or bypassed by the aggregator.
- **`08_ADAPTER_STRATEGY.md`** — adapters must not contain new business
  formulas, must preserve source values, must not duplicate an existing
  translation. Directly informs Section 8 (rejecting a second Snapshot
  derivation) and Section 10 (reusing the existing projection functions
  verbatim).
- **`12_DEPENDENCY_GRAPH.md`** — forbidden dependency #3 ("any new
  canonical route calling a legacy engine directly, bypassing the
  Orchestrator") and #5 ("two adapters independently reaching into the
  same legacy engine's internals in incompatible ways") both directly
  constrain this plan's dependency graph (Section 9).
- **`24_INCREMENT_7_CANONICAL_DATA_TRUST_PATH.md`** /
  **`25_INCREMENT_8_CANONICAL_EVIDENCE_PATH.md`** /
  **`26_INCREMENT_8_IMPLEMENTATION_PLAN.md`** — the two frozen capability
  implementation records this plan composes without modifying.

No new ADR is proposed. ADR-020 already anticipates and governs this exact
decision space (Sections 10–22); this plan exists to satisfy ADR-020
Section 22's implementation prerequisites with concrete answers, not to
re-litigate or repeat Option C's own reasoning.

## 4. Current-state audit (source-traced, this session)

Both frozen capabilities share one exact structural pattern, confirmed by
direct inspection of every production file in both:

| Concern | Data Trust (Increment 7) | Evidence Center (Increment 8) |
|---|---|---|
| Outer read adapter | `data-trust-read-adapter.ts`, `dataTrustForSite(db, id, false)` | `evidence-center-read-adapter.ts`, `evidenceCenterForSite(db, id, false)` |
| Orchestrator core | `intelligence-orchestrator.ts`, DI-based, zero I/O | `intelligence-evidence-orchestrator.ts`, DI-based, zero I/O |
| Orchestrator instance | `intelligence-orchestrator-instance.ts`, exports `getCanonicalDataTrustForSite(siteId): CanonicalDataTrustOrchestrationResult` | `intelligence-evidence-orchestrator-instance.ts`, exports `getCanonicalEvidenceForSite(siteId): CanonicalEvidenceOrchestrationResult` |
| Projection adapter | `api-projection-adapter.ts`, `projectCanonicalDataTrustResponse` → `DataTrustCanonicalEnvelope` | `evidence-projection-adapter.ts`, `projectCanonicalEvidenceResponse` → `EvidenceCenterCanonicalEnvelope` |
| Route/handler | `route.ts` (auth first, then dynamic import) / `handler.ts` (no auth dependency) | identical split, identical ordering |
| `now()` | called once per request, injected | called once per request, injected |
| Context id prefix | `context:data-trust:...` / `correlation:data-trust:...` | `context:evidence:...` / `correlation:evidence:...` |
| Snapshot derivation | `deriveSiteSnapshot({dataImportacao, arquivoOrigem})` — pure, deterministic on site-row data, **not** on the clock | identical, verbatim-reused function |
| Site reference | `adaptLegacySiteRow` / `toSiteEntityReference` (Increment 3, verbatim) — needed only to populate `CalculationContext.scope` | identical, verbatim-reused |
| Manifests | 3 total (`data-trust`, `confidence`, `recommendation`), all `status: "planned"`; `evidence` and `site-intelligence` are not, and must not become, `EngineId`s | — |
| DB connection | `getWritableDb()` — confirmed a **memoized module-level singleton** (`lib/db.ts`) | same singleton |

**Key finding governing Sections 7 and 8:** `deriveSiteSnapshot` is a pure
function of `(dataImportacao, arquivoOrigem)` read off the same `sites`
row — it never reads the clock. Both capabilities independently fetch
that row and independently derive a Snapshot from it. Barring a genuine
concurrent write between the two capability calls (no write path exists
anywhere in this read-only chain; the only real writer is the import
pipeline, `importers/multi_operator_import.py`, running out of band), the
two capabilities will always derive an *identical* `SnapshotId` for the
same Site at the same moment — this is a property of the existing design,
not something the aggregator must engineer.

**Key finding governing Section 11:** `getCanonicalDataTrustForSite` and
`getCanonicalEvidenceForSite` are both plain, synchronous functions
(`(siteId: number) => Result`, not `Promise`-returning). Both ultimately
call the same memoized `getWritableDb()` singleton connection,
synchronously, on Node's single thread. There is no concurrency to
exploit and no interleaving hazard to guard against — `Promise.all` over
two already-synchronous calls would add microtask overhead for zero
concurrency benefit and would misleadingly imply parallelism that cannot
occur.

**Key finding governing Section 8 (file plan):** `app/api/intelligence/site/`
does not exist yet — confirmed by directory listing. Only `data-trust/`
and `evidence-center/` exist under `app/api/intelligence/`. No naming
collision.

## 5. Options evaluated

### Option A — HTTP self-composition (rejected)

The aggregate route would call its own two existing HTTP endpoints
internally (`fetch()`). **Rejected**: ADR-020 Section 11 unconditionally
prohibits this ("the aggregator must call in-process canonical
services/orchestrators directly — never `fetch()` its own routes"). It
would also double-authenticate (each internal fetch would need to carry
`x-sentinel-admin-key` again), add JSON serialize/deserialize overhead for
data already in-process, and require a base-URL resolution mechanism this
project has no existing pattern for.

### Option B — Handler composition (rejected)

The aggregate handler would directly call
`handleCanonicalDataTrustSiteRequest`/`handleCanonicalEvidenceCenterSiteRequest`.
**Rejected**: both existing handlers accept a `NextRequest` and return a
`NextResponse` — already-HTTP-shaped, already-status-coded. Calling them
would force the aggregator to either construct synthetic `NextRequest`
objects (fragile, not a pattern used anywhere in this repository) or
parse two already-serialized JSON bodies back out of two `NextResponse`
objects to recover the semantic distinctions (`notFound` vs. `422` vs.
`500`) the raw orchestration result already expresses directly and
losslessly. This also violates Principle 12/13 (the aggregator must not
depend on `NextRequest`/`NextResponse`; HTTP concerns stay in the outer
route/handler layer) the moment the aggregator's own core touches either
type.

### Option C — Orchestrator composition (chosen)

A new Site Intelligence Aggregator Orchestrator calls the two frozen
capability orchestrators' already-public entry points —
`getCanonicalDataTrustForSite(siteId)` and
`getCanonicalEvidenceForSite(siteId)` — directly, in-process, receiving
each capability's raw `CanonicalDataTrustOrchestrationResult`/
`CanonicalEvidenceOrchestrationResult`. This is exactly the dependency
direction ADR-020 Section 11 specifies for the aggregation flow. It
preserves capability ownership (neither capability orchestrator is
modified or aware of the aggregator), avoids legacy access entirely (the
aggregator never imports a legacy engine, `lib/db`, or either outer
adapter), and avoids duplicating projection logic by design (Section 10:
the aggregator receives raw orchestration results, not projected
envelopes — projection happens once, at the aggregate's own projection
layer, by calling the two *existing* projection functions).

**Confirmed, not assumed, from ADR-020's actual text (Section 11):** the
"Future aggregation flow" diagram is exactly `Capability Orchestrator →
Aggregation Orchestrator → Aggregate Projection → Aggregate Route` — this
plan's chosen architecture matches that diagram verbatim; it is not an
independent reinterpretation.

### Option D — Projection composition (rejected)

A new projection layer would compose the two *already-projected* HTTP
envelopes (`DataTrustCanonicalEnvelope`/`EvidenceCenterCanonicalEnvelope`)
directly, without an aggregate orchestrator in between. **Rejected**:
projections are terminal, HTTP-facing artifacts, not an internal
data-exchange contract between orchestration layers — composing at this
level would require the aggregator to make orchestration-level decisions
(status derivation, snapshot-consistency checks, partial-failure
policy) by reverse-engineering them from already-projected envelope
fields, mixing a presentation-layer concern (projection) with an
orchestration-layer concern (deciding overall `status`). ADR-020's own
diagram places "Aggregation Orchestrator" *before* "Aggregate Projection"
for exactly this reason.

### Option E — Shared application-service seam (rejected, deferred)

Introduce narrow capability-reader interfaces wrapping the two frozen
orchestrators (e.g. a `CapabilityReader<TResult>` abstraction) before
calling them. **Rejected as premature**: both orchestrator entry points
already expose exactly the seam the aggregator needs — a single-argument,
synchronous function returning a fully-typed result. Wrapping them in a
new interface layer today would be abstraction introduced for exactly two
call sites, with no second aggregator-like consumer to justify it
(Principle 17, "no abstraction without a concrete need" — the same
reasoning ADR-020 Section 11's own reconciliation note already applies to
deciding whether to generalize Increment 7's orchestrator). Deferred: if
a third aggregation-style consumer emerges, revisit then, not in advance
of it.

## 6. Chosen architecture

**Option C — Orchestrator composition.** The Aggregation Orchestrator
depends only on the two capability orchestrators' public instance
functions (type-imported result shapes from their pure cores, value-level
dependency injection for the functions themselves), never on either
capability's outer adapter, legacy engine, or route/handler layer.

**Explicit statement, per the mission's own A/B/C/D framing (post-review
hardening, F-6):** the Aggregate Orchestrator receives **raw, frozen
capability-orchestrator results** — `CanonicalDataTrustOrchestrationResult`
and `CanonicalEvidenceOrchestrationResult`, the exact same pre-projection
shapes each capability's own route/handler consumes internally — never
HTTP responses, never `NextRequest`/`NextResponse`, never either
capability's route/handler module, and never a prebuilt, already-projected
envelope. The aggregate projection layer (Section 10) is a separate,
later stage that *may invoke* the two existing, frozen projection
functions (`projectCanonicalDataTrustResponse`/
`projectCanonicalEvidenceResponse`) to construct each nested public
envelope — but invoking a projection function from the projection layer
is not the same as the *orchestrator* consuming a projected envelope as
its own input. Orchestration (deciding `status`, comparing snapshots,
classifying capability outcomes) is complete before projection ever runs;
projection is never asked to make an orchestration-level decision.

## 7. Aggregate response contract

```ts
export type SiteIntelligenceCapabilityState = "available" | "unavailable" | "notFound";

export interface SiteIntelligenceCapabilityProjection<TEnvelope> {
  readonly state: SiteIntelligenceCapabilityState;
  readonly envelope: TEnvelope | null;
}

export type SiteIntelligenceStatus = "complete" | "partial" | "failed";

export interface SiteIntelligenceAggregateIssue {
  readonly stage: "snapshot-consistency" | "capability-failure" | "notfound-inconsistency";
  readonly code: string;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
}

export interface SiteIntelligenceAggregateEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "site-intelligence";
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
    readonly status: SiteIntelligenceStatus;
    readonly dataTrust: SiteIntelligenceCapabilityProjection<DataTrustCanonicalEnvelope>;
    readonly evidenceCenter: SiteIntelligenceCapabilityProjection<EvidenceCenterCanonicalEnvelope>;
  };
  readonly adaptation: {
    readonly issues: readonly SiteIntelligenceAggregateIssue[];
  };
}
```

No `notFound` field — mirroring both frozen capabilities' own lesson: a
genuinely not-found Site is mapped to a plain HTTP 404 before this
envelope is ever constructed (Section 8, Case E).

### Nested-envelope versioning coupling (explicit disclosure, post-review
hardening, F-5)

Embedding each capability's **complete** frozen envelope under
`result.dataTrust.envelope`/`result.evidenceCenter.envelope` is a
deliberate design choice (Section 7, Question 1) that carries one
consequence this plan must state plainly rather than leave implicit:

- The aggregate embeds each capability's envelope **whole**, including
  that capability's own `schemaVersion` and `capability` label.
- This means the aggregate's public contract is **intentionally coupled**
  to each nested capability's own future contract evolution: if Data
  Trust or Evidence Center ever ships a breaking `schemaVersion` change
  (e.g. `"2.0"`), the shape nested under the aggregate's own
  `result.<capability>.envelope` changes accordingly, **without** the
  aggregate's own top-level `schemaVersion` (still `"1.0"`) necessarily
  changing.
- This coupling is **accepted, not accidental** — the alternative
  (stripping each nested envelope down to a capability-agnostic subset)
  would require the aggregate projection layer to reinvent or duplicate
  each capability's own projection logic, which Principle 3 and
  `08_ADAPTER_STRATEGY.md` both forbid. Accepting this coupling is the
  direct cost of correctly reusing, rather than duplicating, the two
  existing frozen projection functions.
- **Consumers of the aggregate route must inspect each nested envelope's
  own `schemaVersion` independently** — the aggregate's own top-level
  `schemaVersion` answers "has the aggregate's own shape changed," not
  "has either nested capability's shape changed." Both are visible in
  the same response; neither substitutes for the other.
- **A future breaking change to either nested capability's own envelope
  must trigger an explicit review of the aggregate's own contract** (does
  the aggregate need a new `schemaVersion`, does a consumer's existing
  parsing of `result.<capability>.envelope` need to change) — this is a
  process obligation for that future increment, not something this plan
  can enforce today, and is recorded here precisely so that future
  increment does not have to rediscover it.

### Resolutions to the twelve required questions

1. **Embed the complete frozen capability envelopes** (`DataTrustCanonicalEnvelope`/`EvidenceCenterCanonicalEnvelope` in full), not a stripped result-only payload. Built by calling the two *existing* `projectCanonicalDataTrustResponse`/`projectCanonicalEvidenceResponse` functions verbatim from the aggregate projection layer — this reuses, rather than duplicates, each capability's projection logic (Principle 3), and preserves each capability's own `schemaVersion`/`adaptation.success`/`adaptation.issues` untouched.
2. Not result-payload-only — rejected per above; a stripped payload would force re-deriving each capability's own success/issue semantics at the aggregate layer, duplicating logic that already exists correctly.
3. **Yes, duplicate snapshot/context data appears inside each nested envelope** (each embedded envelope already carries its own `snapshot`/`context`, per its frozen contract) — this is wire-payload duplication, not logic duplication, and is intentionally useful: a consumer can verify the aggregate-level snapshot claim against each capability's own independently-derived one without an extra call.
4. **The Aggregate Orchestrator owns the aggregate-level `snapshot` value**, derived by *comparing* (never re-deriving) the two nested orchestration results' own `snapshot.snapshotId` values. It never calls `deriveSiteSnapshot` itself — doing so would be a third, redundant site-row fetch duplicating a read both capabilities already performed.
5. **Inconsistent snapshots:** if both nested snapshots are non-null but their `snapshotId`s differ, the aggregate's own top-level `snapshot` is reported as `null` (never an arbitrary pick), `result.status` cannot be `"complete"`, and an issue (`stage: "snapshot-consistency"`, `code: "snapshot_mismatch"`, `severity: "significant"`) discloses it, citing both ids in `message`.
6. **Capability origin of adaptation issues is preserved by staying inside each nested envelope** — each embedded envelope's own `adaptation.issues` array is left completely untouched (already stage-tagged internally, e.g. `stage: "evidence"`). The aggregate's own top-level `adaptation.issues` array is reserved for **aggregate-origin issues only** (snapshot mismatch, capability failure, not-found inconsistency) — never a flattened copy of nested issues, which would risk drifting from its own source of truth.
7. **Yes** — capability-level success remains independently visible at two levels: the coarse `result.<capability>.state`, and (when `state === "available"`) the embedded envelope's own `adaptation.success`.
8. **Status derivation (exact):**
   - `"complete"`: both capabilities `state === "available"`, both embedded envelopes' `adaptation.success === true`, and no snapshot mismatch.
   - `"partial"`: at least one capability produced a usable canonical result (`state === "available"`, envelope present) and the request did not qualify as `"complete"` — covers one/both capabilities' `adaptation.success === false`, one capability `state === "unavailable"` (its call threw) while the other is available, a snapshot mismatch, or a not-found inconsistency (Section 8, Case E′).
   - `"failed"` **(corrected, post-review hardening, F-1):** **both** capabilities `state === "unavailable"` — i.e. both capability calls produced no usable canonical result because both threw, or were otherwise unavailable, due to unexpected runtime failure. Precisely: neither `result.dataTrust.envelope` nor `result.evidenceCenter.envelope` exists — there is no real canonical data anywhere in the response. This is **not** the same condition as "both capabilities responded with `adaptation.success: false`" (Case D) — that case still has two real, inspectable envelopes and remains `"partial"`, not `"failed"`. `"failed"` is reserved exclusively for the double-crash case.
9. **An explicit three-value status enum is required**, not a boolean — a boolean cannot represent "one succeeded, one didn't" without discarding information, and ADR-020 Section 14 already anticipates a multi-value per-capability state vocabulary for exactly this reason. Three values (`complete`/`partial`/`failed`) are the minimum this increment's actual two-mandatory-capability scope requires; ADR-020's fuller vocabulary (`notApplicable`/`planned`) is not needed today since neither capability is ever optional or reserved in Increment 9's scope.
10. **Genuine not-found vs. capability failure:** if *both* capability calls report `notFound: true` (which, since both query the identical `sites` table by the identical `siteId`, will always agree in practice), the whole request short-circuits to a plain HTTP 404 before any envelope is built — never entering `result.status` territory, mirroring both frozen capabilities' own not-found handling exactly. See Case E′ and Section 8's evaluation order (post-review hardening, F-4) for the (structurally unreachable today, but not assumed impossible) case where the two capabilities disagree.
11. **One capability returns its own internal 422-equivalent (`adaptation.success: false`) while the other succeeds:** `result.status = "partial"`, aggregate HTTP status remains **200** — the aggregate request itself was well-formed and produced a body containing at least one usable canonical result; the granular failure is fully visible via the affected capability's own embedded `adaptation.success`/`issues`.
12. **HTTP code for partial success: 200; HTTP code for total failure: 500 (corrected, post-review hardening, F-1).** Rejected 207 Multi-Status for `"partial"` (no precedent anywhere in this codebase, poor support in typical HTTP clients/proxies, and no strong justification per the mission's own "avoid unusual HTTP semantics" instruction). Rejected escalating `"partial"` to 422 at the aggregate level (422 is reserved, consistently with both frozen capabilities, for the *aggregate's own* request-level problems — there are none once `id` validates and at least one capability responds with usable data). **`"failed"` maps to HTTP 500, not 200** — see Section 8's corrected matrix and the dedicated rationale below (Question 12a) for why the original "200 for failed" choice was wrong and has been reversed.

### 12a. Why "partial" stays 200 and "failed" is corrected to 500 (post-review hardening, F-1 and F-2)

**"Partial" remains HTTP 200**, for six concrete reasons:

1. The aggregate *operation itself* completed successfully — the
   aggregator's own code ran to completion without an unhandled
   exception; it attempted both capabilities and produced a well-formed,
   fully-serializable response body.
2. At least one capability produced genuinely usable canonical data
   (a real, non-fabricated envelope) — the response is not empty.
3. The response explicitly and honestly reports `result.status:
   "partial"` — the degraded condition is disclosed in the body, not
   hidden behind a success-looking status.
4. Each nested capability preserves its own independent success/failure/
   adaptation state (`state`, and when available, the embedded
   envelope's own `adaptation.success`/`issues`) — nothing is
   collapsed or lost.
5. No failed capability is ever represented as an empty successful
   result — an `unavailable` capability's `envelope` is `null`, never a
   fabricated empty array/object dressed up as success.
6. A client can fully consume the successful capability's real data
   while independently observing the other capability's failure, in the
   same response — exactly the graceful-degradation contract a
   federated aggregator exists to provide.

**This differs in kind from why a single capability route returns 422**
for its own internal adaptation failure: a single capability's HTTP
status answers "did *this one capability's own* business-data adaptation
fully succeed for a Site that exists" — a narrower, capability-scoped
question, answered per-capability inside its own envelope. The
**aggregate's** HTTP status answers a different, broader question: "did
the *composed aggregate operation* produce any usable canonical
intelligence at all." These are not the same question, so there is no
requirement that they share the same status-code convention — the
narrower, capability-scoped answer remains fully visible and unchanged
inside each nested envelope (satisfying anyone who specifically needs
it), while the broader, aggregate-scoped answer is what the aggregate's
own transport status communicates.

**"Failed" is corrected to HTTP 500**, because it is not the same kind of
condition as "partial." `"failed"` is defined precisely as: *both
capability calls produced no usable canonical result because both threw,
or were otherwise unavailable, due to unexpected runtime failure* — there
is no real canonical data anywhere in the response, for either capability.
This is structurally identical to what both frozen capability routes
*already* classify as their own 500 case: each existing route wraps its
entire orchestrator call in a `try/catch` and maps *any* thrown exception
straight to a sanitized 500, regardless of how "gracefully" the exception
is caught and logged — catching an exception and still returning 500 is
exactly what `handleCanonicalDataTrustSiteRequest`/
`handleCanonicalEvidenceCenterSiteRequest` already do today. "The
aggregator's own code didn't crash, it gracefully handled two downstream
exceptions" is **not** a valid basis for a different outcome, because the
existing routes already gracefully handle their own downstream exceptions
and still return 500 for exactly that reason. Returning 200 for a
response containing zero real capability data would also risk masking a
genuine operational incident (e.g. total database unavailability
affecting both calls identically) from HTTP-status-based monitoring and
alerting that would otherwise catch it immediately via a 500.

### 12b. The internal `"notFound"` status value (post-implementation-
audit hardening, F-2)

The independent implementation audit found that the both-notFound
internal result (`bothNotFoundResult`) originally set `status: "failed"`
— a misleading internal representation, since a not-found Site is not a
runtime failure. Externally this was always safe (the handler checks
`result.notFound` strictly before ever inspecting `result.status`), but
the internal label itself was wrong, untested either way, and created a
latent hazard: any future refactor that reordered those two checks would
silently turn a benign 404 into an incorrect 500.

**Resolution:** `SiteIntelligenceStatus` gains a fourth literal,
`"notFound"`, used *exclusively* by `bothNotFoundResult` — never for an
unexpected-runtime-failure condition, and never confused with `"failed"`.
This value is structurally guaranteed, by construction, to co-occur only
with `notFound: true` on the same result object (both fields are set
together, in the same return statement, in the one function that
produces this value). It is **not** a new publicly-reachable state: the
handler's `result.notFound` check runs unconditionally before any
`result.status` comparison, so `"notFound"` can never actually reach
`projectSiteIntelligenceResponse` or any real HTTP response — the fix
makes the *internal* representation honest, independent of, and in
addition to, the caller-discipline that already made the *external*
behavior correct.

This is a minimal, additive type change (one new literal on an existing
union), not a discriminated-union rewrite — the latter was considered
(it would make the impossible state unrepresentable at the type level,
which is strictly stronger) but rejected for this hardening pass because
it would require changing `site-intelligence-projection-adapter.ts`'s own
type dependencies, a file outside this pass's authorized scope. The
chosen fix is deliberately scoped to the two files this hardening pass is
authorized to touch (`site-intelligence-aggregator.ts`,
`app/api/intelligence/site/handler.ts`), and remains fully compatible
with the projection adapter without modifying it, because that file
imports `SiteIntelligenceStatus` by reference rather than redeclaring it.

Tests: `tests/intelligence-site-aggregator.test.ts` test 7b (both-notFound
carries `status: "notFound"`, never `"failed"`); `tests/intelligence-site-route.test.ts`
tests 3b (a deliberately contrived `notFound: true` + `status: "failed"`
fixture, decoupled from the real orchestrator's own construction
discipline, still returns 404 — proving the handler's own check order is
what guarantees correctness, not merely the orchestrator's internal
consistency) and 3c (the real `"notFound"` value also returns 404, not
500).

## 8. Partial-failure matrix

**Final HTTP status matrix (corrected, post-review hardening, F-1; further
hardened post-implementation-audit, F-1/F-2/F-3):**

| Case | Condition | `result.status` (internal) | HTTP status | Notes |
|---|---|---|---|---|
| A | Both capabilities succeed, `adaptation.success: true`, snapshots agree | `complete` | 200 | — |
| B | Data Trust available & successful; Evidence Center `state: unavailable` (threw) or `adaptation.success: false` | `partial` | 200 | Evidence Center's own envelope/state discloses the detail; (post-audit hardening, F-3) a sanitized `console.error("intelligence_site_evidence_center_unavailable", errorName)` is logged server-side when `state: unavailable`, independent of the overall 200 status |
| C | Evidence Center available & successful; Data Trust `unavailable`/`adaptation.success: false` | `partial` | 200 | mirror of B; logs `intelligence_site_data_trust_unavailable` under the same condition |
| D | Both capabilities available, both `adaptation.success: false` (neither threw — two real envelopes present, each disclosing its own issues) | `partial` | 200 | not to be confused with Case I below — both envelopes are real and inspectable here |
| E | Both capabilities report `notFound: true` | `notFound` (post-audit hardening, F-2 — see Section 7's dedicated subsection; **never** `failed`) | 404 | `{"error": "Site not found."}`, identical to both frozen capabilities; the internal `status` value is never inspected for this case — `result.notFound` is checked first, unconditionally |
| E′ | One capability reports `notFound: true`, the other does not (structurally unreachable today — both query the same `sites` row — but not assumed impossible) | `partial` | 200 | `stage: "notfound-inconsistency"` issue recorded (and, per Section 8's evaluation order below, **never also** a `snapshot_mismatch` issue for the same anomaly). **Correction (post-implementation-audit):** no dedicated server-side log entry is currently emitted specifically for this anomaly — F-3's approved scope covered per-capability-unavailable and aggregate-`failed` logging only, not this case; the anomaly remains visible in the response body's `adaptation.issues`. Logging this case is a candidate for a future, separately-scoped hardening pass, not claimed as done here. |
| E″ | (post-implementation-audit, F-1 — formally added here) One capability `unavailable` (threw), the other `notFound`, in either pairing (Data Trust unavailable + Evidence Center notFound, or the mirror) | `failed` | **500** | Neither capability produced a usable envelope — this combination was not enumerated in the original hardened matrix (a genuine gap identified by the independent implementation audit, not merely an implementation oversight); it is formally resolved here as `failed`, matching `failed`'s own precise definition ("neither capability produced a usable canonical result"), never fabricated as `partial`. A sanitized `console.error("intelligence_site_status_failed", {dataTrust, evidenceCenter})` is logged (F-3). Covered by `tests/intelligence-site-aggregator.test.ts` tests 20–21 (both pairings). |
| F | `id` missing / blank / non-positive-integer | *(no envelope built)* | 400 | `{"error": "Missing or invalid 'id' parameter."}`, identical parsing to both frozen routes |
| G | `requireAdminAuth` rejects | *(no envelope built)* | 401 or 503 | its own sanitized body, unchanged, per `lib/auth-guard.ts`'s existing `AdminAuthResult` |
| H | The aggregator's own code throws (e.g. a bug in the aggregate projection step itself) — **not** a per-capability failure, which is caught individually and never escalated this way | *(no envelope built)* | 500 | `{"error": "Site intelligence assessment unavailable."}`, logged as `console.error("intelligence_site_failed", ...)`, no stack trace/message ever forwarded. Deliberately the same diagnostic code the pre-hardening implementation always used for this exact case; distinct from Case I's own `intelligence_site_status_failed` code (F-3), so the two are distinguishable in logs. |
| I | **Both** capabilities `state: unavailable` (both calls threw, or were otherwise unavailable, due to unexpected runtime failure — no usable canonical result from either) | `failed` | **500 (corrected — was 200)** | Structurally identical to Case H's severity: zero real canonical data anywhere in the response. Body: `{"error": "Site intelligence assessment unavailable."}` — the identical, sanitized client-facing body as Case H (deliberately indistinguishable to the client, since both mean "the aggregate route could not produce a usable response due to an unexpected failure"). **Correction (post-implementation-audit, F-3):** server-side logging is **not** identical to Case H — Case I logs `console.error("intelligence_site_status_failed", {dataTrust: errorName, evidenceCenter: errorName})` (both capabilities' sanitized error names), a **distinct** diagnostic code from Case H's `console.error("intelligence_site_failed", errorName)`, specifically so an operator can distinguish "both capabilities cleanly reported unavailable" (Case I) from "the aggregator's/handler's own code threw" (Case H) in production logs — the original hardened plan's claim that these shared one logging convention was inaccurate and is corrected here. |

**Precise definition of `"failed"` (post-review hardening, F-1; extended
post-implementation-audit, F-1):** both capability calls produced no
usable canonical result because both threw, or were otherwise
unavailable, due to unexpected runtime failure. This is reached by
**two** distinct combinations, both formally covered by this plan: Case
I (both capabilities `unavailable`) and Case E″ (one capability
`unavailable`, the other independently `notFound` — either pairing). Both
are categorically different from Case D (both capabilities responded
normally with `adaptation.success: false`) — Case D still has two real,
inspectable envelopes and stays `"partial"`/200; `"failed"` is reserved
exclusively for the case where **no envelope exists for either
capability**, regardless of whether the "missing" side is `unavailable`
or `notFound`. `"failed"` is categorically distinct from `"notFound"`
(Case E, post-implementation-audit F-2) — a genuinely not-found Site is
never a runtime failure, and the two must never share an internal status
label even though `"notFound"` never reaches a real HTTP response (Case
E short-circuits to 404 before `status` is ever inspected). See Section
7, Question 12a, for the full `"failed"`-vs-`"partial"` rationale, and
Section 7's dedicated F-2 subsection for the `"notFound"` value's own
rationale.

**Mandatory isolation requirement this table implies:** each capability
call must be wrapped in its **own** `try/catch` *inside* the Aggregate
Orchestrator — never a single top-level `try/catch` around both calls —
so a thrown exception from one capability can never suppress a
successfully-obtained result from the other. The route/handler's own
outer `try/catch` (Case H) exists only to catch a genuine bug in the
aggregator's own code (e.g., the projection step itself) or to catch the
`"failed"` state's own already-500-mapped response construction; it is
not what classifies Case I as 500 — Case I is classified by the
orchestrator's own `status` derivation, and the handler maps
`status === "failed"` to 500 exactly as deliberately as it maps
`status === "complete"`/`"partial"` to 200.

No failed capability is ever silently represented as an empty successful
result — every `unavailable`/`notFound`-inconsistent condition is
disclosed via `state` and/or an aggregate issue, never omitted, and total
failure is never disclosed via a 200-class status.

### Evaluation order (post-review hardening, F-4)

The Aggregate Orchestrator evaluates capability outcomes in exactly this
order, to guarantee one underlying anomaly is never double-reported as
two separate issues:

1. **Execute both capability calls independently**, each wrapped in its
   own `try/catch` (the mandatory isolation requirement above).
2. **Classify each capability's outcome first**: did its call throw
   (`state: "unavailable"`), or did it return normally
   (`state: "available"` or, if its own `notFound: true`,
   `state: "notFound"`)?
3. **Evaluate not-found consistency next, before anything else that
   depends on the two results' content**: if both capabilities report
   `notFound: true`, short-circuit immediately to the aggregate 404
   (Case E) — no envelope is built, no snapshot comparison is ever
   attempted.
4. **If the two capabilities' not-found states disagree** (one
   `notFound: true`, the other not), record exactly **one** aggregate
   issue (`stage: "notfound-inconsistency"`) and stop evaluating
   not-found-related consistency — proceed to Case E′'s `partial`/200
   outcome. **Do not** proceed to snapshot comparison for this pair: since
   a capability's `snapshot` is `null` if and only if that capability
   reports `notFound: true` (confirmed by tracing both frozen
   orchestrators' code — the only two paths that return `snapshot: null`
   are `emptyResult(siteId, true)`, invoked exclusively when the legacy
   fetch itself returns `null`), a not-found-inconsistent pair will
   *always* also present as "one snapshot present, one `null`." Reporting
   this a second time as a `snapshot_mismatch` issue would describe the
   same underlying anomaly twice under two different names.
5. **Only when both capabilities agree they found the Site** (neither
   reports `notFound: true`) does the orchestrator proceed to compare
   snapshots: **only** when both capabilities also supplied a *non-null*
   `snapshot` (i.e. both are `state: "available"`, not `"unavailable"`)
   is a `snapshotId` equality check performed. If one or both capabilities
   are `unavailable` at this point, there is nothing to compare — no
   snapshot issue is recorded for that pairing; the `unavailable` state
   itself already discloses the degraded condition.
6. **A `snapshot_mismatch` issue is recorded if and only if** both
   snapshots are non-null and their `snapshotId` values differ — this is
   the only path that produces this specific issue code, and it is
   reachable only after steps 3–4 have already established that both
   capabilities agree the Site exists.

This ordering guarantees that Case E′ (not-found inconsistency) and a
genuine snapshot mismatch between two *found* results are always reported
as distinct, single, non-overlapping issues — never both at once for what
is really one anomaly.

## 9. Snapshot and context strategy

- The Aggregate Orchestrator does **not** call `deriveSiteSnapshot`
  itself (Section 7, Question 4) — it only compares the two capability
  results' already-derived snapshots.
- The Aggregate Orchestrator calls its own injected `now()` **exactly
  once**, to stamp its **own** `context.requestedAt`/`contextId`/
  `correlationId` — distinctly prefixed (`context:site-intelligence:...`
  / `correlation:site-intelligence:...`) so they can never be confused
  with either nested capability's own context, even for the same Site at
  the same instant.
- Nested capability timestamps remain **independently generated** by each
  capability's own, unmodified orchestrator instance (each still calls
  `new Date().toISOString()` internally). The aggregate's own
  `context.requestedAt` and each nested envelope's own `context.requestedAt`
  will generally differ by a small, real amount (sequential calls, not a
  shared clock tick) — this is expected, not a defect, and is documented
  as a known characteristic (Section 15), not "fixed."
- Snapshot consistency is checked (Section 7, Question 5) but never
  re-derived — the check is a plain `snapshotId` string comparison, no
  new adapter or business logic.

## 10. Dependency graph

```
app/api/intelligence/site/route.ts
  → requireAdminAuth (checked first, before any dynamic import)
  → (only if authorized) dynamic import of:
      services/intelligence-runtime/site-intelligence-aggregator-instance.ts
        → services/intelligence-runtime/intelligence-orchestrator-instance.ts        (Increment 7, unmodified, reused)
        → services/intelligence-runtime/intelligence-evidence-orchestrator-instance.ts (Increment 8, unmodified, reused)
        → services/intelligence-runtime/site-intelligence-aggregator.ts (pure core)
  → app/api/intelligence/site/handler.ts
      → services/intelligence-adapters/site-intelligence-projection-adapter.ts
          → services/intelligence-adapters/api-projection-adapter.ts        (Increment 7, unmodified, reused directly — not via barrel)
          → services/intelligence-adapters/evidence-projection-adapter.ts   (Increment 8, unmodified, reused directly — not via barrel)
```

**Pure core's own dependency surface** (`site-intelligence-aggregator.ts`,
DI-based, zero I/O):

```
site-intelligence-aggregator.ts
  → (type-only) CanonicalDataTrustOrchestrationResult      from intelligence-orchestrator.ts
  → (type-only) CanonicalEvidenceOrchestrationResult       from intelligence-evidence-orchestrator.ts
  → (type-only) SnapshotDerivation                         from snapshot-provider.ts
  → (value)     getCanonicalDataTrustForSite  — injected via SiteIntelligenceAggregatorDeps, never imported directly
  → (value)     getCanonicalEvidenceForSite   — injected via SiteIntelligenceAggregatorDeps, never imported directly
  → (value)     now / environment            — injected
```

**Confirmed absent** (all four checked by direct construction — no such
import exists in the planned design, and will be enforced by the
Increment 9 contract sweep, Section 12):

- Aggregate Orchestrator → legacy engine — absent (the pure core imports
  no legacy engine, `lib/db`, or `node:sqlite`, even transitively; every
  DB-touching path is confined to the instance file, exactly mirroring
  Increment 7/8's own core/instance split).
- Aggregate Orchestrator → database — absent, same reasoning.
- Aggregate Orchestrator → HTTP route handlers — absent; the core never
  imports `next/server`, `NextRequest`, or `NextResponse`, and never
  imports either capability's `route.ts`/`handler.ts`.
- Aggregate Orchestrator → `NextRequest`/`NextResponse` — absent, same
  reasoning; those types appear only in `app/api/intelligence/site/{route,handler}.ts`.
- Capability orchestrators → aggregate orchestrator — absent by
  construction: neither `intelligence-orchestrator.ts`/`-instance.ts` nor
  `intelligence-evidence-orchestrator.ts`/`-instance.ts` is modified by
  this plan at all; they remain wholly unaware the aggregator exists.
- Projection → database — absent; `site-intelligence-projection-adapter.ts`
  imports only the two existing pure projection functions and their
  envelope types, never `lib/db`, `node:sqlite`, or either engine.
- Route → legacy engine — absent; `app/api/intelligence/site/route.ts`
  imports only `requireAdminAuth` and (dynamically) the aggregator
  instance module.

**Barrel-cycle hazard identified and avoided:** the new projection adapter
must import `projectCanonicalDataTrustResponse`/
`projectCanonicalEvidenceResponse` **directly from their own sibling
files** (`./api-projection-adapter`, `./evidence-projection-adapter`),
**never via `services/intelligence-adapters/index.ts`** — exactly the
existing convention every orchestrator-instance file already follows for
its own adapter imports (confirmed: `intelligence-orchestrator-instance.ts`
imports `adaptLegacySiteRow` from `./site-entity-adapter` directly, not
via the barrel). This eliminates any barrel self-import risk by
construction; the barrel (`index.ts`) is still updated to *add* the new
projection adapter's own exports for external consumers (matching the
precedent both prior increments set), but the new file's own internal
imports never round-trip through it.

## 11. Authentication and route contract

Identical pattern to both frozen capabilities, applied from the start
(no post-audit correction needed this time, since the lesson is already
established):

- `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- `route.ts` exports only `runtime`/`dynamic`/`GET`.
- `GET` checks `requireAdminAuth(request)` **first**; returns its response
  immediately on failure, strictly before the dynamic `import()` of
  `site-intelligence-aggregator-instance.ts`.
- `handler.ts` carries no authentication dependency of its own — it only
  ever runs for an already-authorized request.
- Query parameter: `id` (positive integer), identical `parseSiteId`
  validation logic to both existing routes (duplicated per-route, not
  shared — matching the existing precedent that neither prior route
  shares this six-line function with the other).
- Error sanitization: unexpected exceptions are logged only as
  `console.error("intelligence_site_failed", error instanceof Error ? error.name : "unknown")`
  — never a message or stack trace forwarded to the client.
- Response codes (corrected, post-review hardening, F-1): 400 (invalid
  id) / 401 or 503 (auth) / 404 (both capabilities not-found) / 200
  (`status: "complete"` or `"partial"`, including the
  not-found-inconsistency edge case, which stays `"partial"`) / **500**
  (`status: "failed"` — both capabilities unavailable due to unexpected
  runtime failure — **or** the aggregator's own unexpected exception;
  both map to the identical sanitized 500 body and are indistinguishable
  to the client by design, since both mean "no usable response could be
  produced").
- Content type: `NextResponse.json(...)`, identical to both existing
  routes.
- The aggregator must never be more permissive than either underlying
  capability (ADR-020 Section 16) — trivially satisfied here, since it
  reuses the identical `requireAdminAuth` call and adds no alternate
  authorization path.

## 12. Read-only and side-effect analysis

- Neither the pure aggregator core nor the projection adapter calls
  `getWritableDb()`, `getDb()`, any legacy engine, or either outer read
  adapter — the aggregator's only two "read" operations are calling
  `getCanonicalDataTrustForSite`/`getCanonicalEvidenceForSite`, both of
  which are already-vetted, already-`persist=false`-gated, read-only
  entry points.
- Combined schema-initialization reach is the **union** of both
  capabilities' already-documented paths — no new table, no new
  initializer: `ensureDataTrustTables` (reached by both capabilities
  independently — once via Data Trust's own chain, once via Evidence
  Center's own chain, which also calls it as its first line),
  `ensureCopernicusTables`, `ensureSiteNotes` (both only via Evidence
  Center's chain). Each is an idempotent `CREATE TABLE IF NOT EXISTS`;
  calling `ensureDataTrustTables` twice in one aggregate request (once per
  capability) is a harmless, already-accepted repeated no-op, not a new
  risk.
- `getWritableDb()` is a **memoized singleton** (confirmed, `lib/db.ts`) —
  both capability calls, even when invoked sequentially within one
  aggregate request, share the exact same `DatabaseSync` connection
  object. No new connection is opened by the aggregator itself.
- **Execution model: sequential, synchronous calls — not `Promise.all`,
  not concurrent.** Both capability entry points are plain synchronous
  functions, not `Promise`-returning; Node's single-threaded execution
  model means there is no true concurrency to gain from wrapping them in
  `Promise.all`, and doing so would misleadingly suggest parallelism that
  cannot occur while adding microtask overhead for no benefit. Order:
  Data Trust is called before Evidence Center (matching the two
  capabilities' own increment order and ADR-020's own route-taxonomy
  listing order), each wrapped in its own `try/catch` (Section 8's
  mandatory isolation requirement).
- No `INSERT`/`UPDATE`/`DELETE`/`recordAudit`/file-write pattern is
  reachable from any new file this plan proposes — verified by
  construction (no such call appears in the planned design) and to be
  re-confirmed by the Increment 9 side-effect sweep (Section 13) exactly
  as Increment 8's own sweep did.
- `persist=false` remains guaranteed transitively — the aggregator never
  supplies or overrides either capability's own internal `persist`
  argument; it has no access to do so (that argument is fully internal to
  each capability's own outer adapter, never exposed to callers of
  `getCanonicalDataTrustForSite`/`getCanonicalEvidenceForSite`).

### Existing runtime source-boundary sweep (explicit disclosure, post-
review hardening, F-3)

`tests/intelligence-runtime-registry.test.ts` already contains a describe
block, **"services/intelligence-runtime source boundaries (source
inspection)"** (tests 21–22), that is directly relevant to both new
`services/intelligence-runtime/` files this plan proposes and must be
accounted for explicitly, not merely assumed harmless:

- It enumerates every `.ts` file **directly** in `services/intelligence-runtime/`
  via a flat `fs.readdirSync(dir).filter((f) => f.endsWith(".ts"))` —
  **no exclusion list of any kind** exists in this sweep, unlike the two
  `services/intelligence-adapters/**` purity sweeps (which maintain an
  explicit `ADAPTER_EXCLUSIONS` array). Both new files
  (`site-intelligence-aggregator.ts`,
  `site-intelligence-aggregator-instance.ts`) will be picked up by this
  enumeration automatically the moment they are created — there is no
  opt-out.
- Test 21 checks, on each file's **raw, unstripped source text** (this
  sweep does **not** call a `stripComments` helper, unlike the adapters
  sweeps), for the patterns `from "node:sqlite"`, `from "next/server"`,
  `from "next"` (all import-syntax-anchored, safe to mention in prose),
  **and** the bare substrings `@/lib/db` and `@/app/api` (**not**
  import-syntax-anchored — a plain-text mention anywhere in the file,
  including inside a comment, would trip these two specifically).
- Test 22 checks for the bare substring `sentinel-core`, same caveat.
- **Implementer warning, to be honored during actual implementation (not
  actionable during this planning-only increment):** neither new file's
  own header/inline comments may literally write out the substrings
  `@/lib/db`, `@/app/api`, or `sentinel-core` — even in an explanatory
  sentence such as "this file never imports `@/lib/db`" — or this sweep
  will fail with a false positive. Both existing files this plan reuses
  (`intelligence-orchestrator-instance.ts`,
  `intelligence-evidence-orchestrator-instance.ts`) already avoid this
  correctly today (verified: neither file's source contains either
  substring anywhere), and the two new files must follow the identical
  discipline — describe the "never imports the database directly"
  property in prose without spelling out the literal path, exactly as
  both existing instance files' own header comments already do.
- **Verified, not merely assumed, that both new files will pass this
  sweep as planned:** neither planned file's own source text would
  contain a `from "node:sqlite"`/`"next/server"`/`"next"` import (the
  pure core only takes injected function dependencies and type-only
  imports; the instance file only imports the two existing, already-
  compliant instance modules by their `@/services/intelligence-runtime/...`
  specifiers, which do not match any of the five patterns), and neither
  file's prose needs to name `@/lib/db`/`@/app/api`/`sentinel-core`
  literally to explain its own design.
- **No exclusion entry should be added to this sweep** for either new
  file — both are expected to genuinely satisfy it as written, the same
  way both existing instance files already do. An exclusion here would
  only be justified if a future file in this directory had a genuine,
  irreducible reason to reference one of these paths in its own source
  text, which neither new file does.
- **Confirming, with this explicit accounting now on record, that "zero
  modified test files" (Section 14) remains accurate** — not because this
  sweep is out of scope for the new files (it is squarely in scope, since
  both live directly in `services/intelligence-runtime/`), but because
  the planned source text for both new files independently satisfies it
  without modification, exactly as verified above.

## 13. Test plan

Five new test files (no existing test file requires modification — see
Section 14).

**A. `tests/intelligence-site-aggregator.test.ts`** (pure orchestrator
core, injected fakes for both capability functions) — approx. 20–22
tests: both capabilities succeed (`complete`); Data Trust
available+Evidence unavailable (thrown) → `partial`; Evidence
available+Data Trust unavailable → `partial`; both unavailable →
`failed`, and the resulting orchestration result carries no envelope for
either capability (post-review hardening, F-1: this is the case the
handler must map to HTTP 500, verified at the orchestrator level that
`status === "failed"` is only ever reachable when both capabilities are
`unavailable`, never merely `adaptation.success: false`); both available
but one/both `adaptation.success: false` (not thrown) → `partial`,
distinct from the `failed` case above (both envelopes still present);
both `notFound: true` → aggregate `notFound: true`, snapshot comparison
never attempted (post-review hardening, F-4: proves the evaluation-order
short-circuit); one `notFound`, other not → exactly **one**
`notfound-inconsistency` issue recorded and **no** `snapshot_mismatch`
issue for the same pair (post-review hardening, F-4: proves no
double-reporting); matching snapshots (both capabilities found, both
available) → shared snapshot surfaced; mismatched snapshots (both found,
both available, differing `snapshotId`) → `snapshot: null` +
`snapshot_mismatch` issue, never `complete`; snapshot comparison is
skipped entirely (no issue of either kind) when one capability is
`unavailable` rather than `notFound`; aggregate `context` uses its own
distinct prefix, never colliding with either nested capability's own
context; **capability contexts may carry different `requestedAt`
timestamps without producing any aggregate context-consistency issue,
provided snapshots and scope are otherwise valid (post-review hardening,
F-7 — proves the intentional asymmetry between snapshot comparison,
which IS checked, and context timestamp comparison, which is deliberately
never checked)**; `now()` called exactly once; each capability call
wrapped in its own try/catch (one throwing never suppresses the other's
result); deterministic given an injected clock; no persistence/cache/
audit dependency is even injectable (verified by construction); call
order is Data Trust before Evidence Center.

**B. `tests/intelligence-site-projection-adapter.test.ts`** (pure
projection) — approx. 11–13 tests: exact `schemaVersion`/`capability`
literal; correct `status` passthrough for each of the three values;
correct embedding of both nested envelopes via the *actual* existing
projection functions (not a reimplementation); `state` mapping for
`available`/`unavailable`/`notFound`; no `notFound` field on the aggregate
envelope itself; snapshot/context passthrough when consistent, `null`
when not; no input mutation; deterministic; no fabricated field; no
`Date.now()`/environment read; **the final aggregate envelope survives a
`JSON.stringify`/`JSON.parse` round-trip without data loss or any
non-serializable value (post-review hardening, F-7) — asserted for at
least one `complete`, one `partial`, and one `failed`-shaped input, since
`failed` is the case most likely to contain `null`s throughout and is
therefore the most useful shape to prove serializes cleanly**.

**C. `tests/intelligence-site-route.test.ts`** (route + handler
behavioral, mirroring the combined per-capability route test file
pattern) — approx. 11 tests: unauthorized fails closed before any
capability call; missing/invalid `id` → 400; both-not-found → 404;
not-found-inconsistency handled per Section 8, Case E′ (→ `partial`/200,
never 404 or 500); `complete` → 200; `partial` → 200; **`failed` → 500,
with the identical sanitized error body shape as the aggregator's own
thrown-exception case (post-review hardening, F-1 — this is the
corrected mapping and the single most important behavioral assertion this
file adds)**; aggregator's own thrown exception (a bug in the
aggregator's own code, distinct from both capabilities being
`unavailable`) → sanitized 500; handler has no auth dependency; exact
`schemaVersion` present in the 200 response body.

**D. `tests/intelligence-increment-9-contract.test.ts`** (dependency-
boundary/architecture sweep, mirroring `intelligence-increment-8-contract.test.ts`'s
structure) — approx. 28–32 tests: all five new production files exist;
no `/api/intelligence/site` route existed before this increment (negative
check retired once implemented, replaced by a positive existence check);
aggregator core has no value-level import of any `node:sqlite`-touching
module, uses only type-only imports for orchestrator-core result types,
has no `Date.now()`/`Math.random()`/`process.env`; projection adapter has
no database/engine/route import and imports the two existing projection
functions directly from their sibling files, never via the barrel; route
exports only `runtime`/`dynamic`/`GET`; auth-before-dynamic-import
ordering (index-based, matching Increment 7/8's own test); handler has no
`requireAdminAuth`/database import; Data Trust and Evidence Center
routes/handlers are provably unaffected (byte-identical or equivalent
behavioral re-assertion, mirroring Increment 8's own "Increment 7
unaffected" tests); manifests remain exactly 3, all `"planned"`, no
`evidence` or `site-intelligence` `EngineId` registered;
`config/capabilities.json` unchanged; no component or other route
references the new aggregate route; the planning document and (once
written) the implementation document exist.

**E. `tests/intelligence-increment-9-side-effects.test.ts`** (write-
pattern sweep, mirroring `intelligence-increment-8-side-effects.test.ts`)
— approx. 8–10 tests: no write-indicating pattern in any of the five new
files; both frozen capabilities' own routes remain unchanged (re-asserted
here, not just in Increment 8's own sweep, for this increment's own
regression boundary); no new file references `capabilities.json`,
`canonical-engine-manifests`, or `package.json`; no new file references
`EXPORTACOES`/`node:fs`.

**Estimated total new tests: approximately 77–88** (updated, post-review
hardening, F-7 — the two added tests are folded into files A and B
above), calculated bottom-up from the five files above (20–22 + 11–13 +
11 + 28–32 + 8–10). This is a planning estimate, not a committed exact
count — the real total will be fixed only once each file is actually
written and will be reported precisely in the implementation record,
consistent with this mission's own instruction not to invent false
precision now.

## 14. File inventory

**NEW PRODUCTION FILES**

| File | Responsibility |
|---|---|
| `services/intelligence-runtime/site-intelligence-aggregator.ts` | Pure, DI-based Aggregate Orchestrator core. Calls the two injected capability functions, compares snapshots, derives `status`, aggregates only its own aggregate-origin issues. Zero I/O, zero Next.js import. |
| `services/intelligence-runtime/site-intelligence-aggregator-instance.ts` | Real wiring: imports `getCanonicalDataTrustForSite`/`getCanonicalEvidenceForSite` from the two existing, unmodified instance files, plus a real clock/environment, and exports the production entry point `getCanonicalSiteIntelligence(siteId)`. The only new module that transitively imports `node:sqlite` (via the two existing instance files it reuses) — never imported by a unit test. |
| `services/intelligence-adapters/site-intelligence-projection-adapter.ts` | Pure. Converts the aggregate orchestration result into `SiteIntelligenceAggregateEnvelope`, calling `projectCanonicalDataTrustResponse`/`projectCanonicalEvidenceResponse` directly (sibling imports, not via the barrel) to build each nested embedded envelope. |
| `app/api/intelligence/site/route.ts` | `runtime`/`dynamic`/`GET` only. Auth first, then dynamic import of the aggregator instance, delegating to `handler.ts`. |
| `app/api/intelligence/site/handler.ts` | Testable request logic: `id` parsing/validation, not-found/exception mapping, calls the projection adapter, returns the `NextResponse`. No auth dependency. |

**MODIFIED PRODUCTION FILES**

| File | Change |
|---|---|
| `services/intelligence-adapters/index.ts` | Export-only addition: the new projection adapter's envelope type(s) and `projectSiteIntelligenceResponse` function, following the exact precedent both prior increments set. The DB-touching aggregator-instance file is, like both existing outer/instance modules, deliberately **not** re-exported here. |

No other production file is modified. Both frozen capabilities'
orchestrators, instances, read adapters, projection adapters, routes, and
handlers are untouched.

**NEW TEST FILES**

`tests/intelligence-site-aggregator.test.ts`,
`tests/intelligence-site-projection-adapter.test.ts`,
`tests/intelligence-site-route.test.ts`,
`tests/intelligence-increment-9-contract.test.ts`,
`tests/intelligence-increment-9-side-effects.test.ts` — detailed in
Section 13.

**MODIFIED TEST FILES**

None, confirmed against **both** relevant existing sweeps, not just one
(post-review hardening, F-3 closed a gap here — see Section 12's
dedicated subsection for the full accounting):

1. The two existing "every adapter is pure" sweep tests
   (`tests/intelligence-data-trust-adapter-contract.test.ts`,
   `tests/intelligence-site-adapter-contract.test.ts`) maintain an
   `ADAPTER_EXCLUSIONS` list scoped to DB-touching files *inside*
   `services/intelligence-adapters/**`. The only new file in that
   directory this plan proposes (`site-intelligence-projection-adapter.ts`)
   is pure — it imports only the two existing pure projection functions
   and type-only result shapes, never `node:sqlite` — so it requires no
   exclusion entry and needs no test modification.
2. `tests/intelligence-runtime-registry.test.ts`'s own "services/
   intelligence-runtime source boundaries" sweep (tests 21–22) directly
   enumerates every `.ts` file in `services/intelligence-runtime/` — the
   exact directory both new orchestrator files (`site-intelligence-aggregator.ts`,
   `site-intelligence-aggregator-instance.ts`) would live in, with **no**
   exclusion mechanism at all. Both new files are verified, not merely
   assumed, to satisfy this sweep's exact checks as planned (Section 12's
   dedicated subsection). No exclusion should be added for either file.

Both sweeps are therefore accounted for explicitly, and both are expected
to pass the new files unmodified.

**NEW DOCUMENTATION FILES**

`docs/genesis-phase-2/27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md`
(this document).

**MODIFIED DOCUMENTATION FILES**

None. ADR-020 already governs this decision space; no new ADR is
required or proposed (Section 3).

## 15. Implementation sequence (for a future, separately-approved
implementation increment — not authorized by this plan)

1. `site-intelligence-aggregator.ts` (pure core) + its unit tests.
2. `site-intelligence-projection-adapter.ts` (pure) + its unit tests.
3. `site-intelligence-aggregator-instance.ts` (real wiring).
4. `app/api/intelligence/site/handler.ts` + `route.ts`.
5. `services/intelligence-adapters/index.ts` export additions.
6. Route/handler behavioral tests.
7. Increment 9 contract sweep + side-effect sweep.
8. Full quality gates (`git diff --check`, `npx tsc --noEmit`, `npm test`,
   `npm run build`).
9. Implementation design document
   (`docs/genesis-phase-2/28_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PATH.md`,
   analogous to Sections 24/25 for the two prior increments), written
   after implementation, mirroring this plan's own resolved decisions
   rather than re-deciding them.

## 16. ADR-020 Section 22 prerequisite checklist (addressed by this plan)

| Prerequisite | Status after this plan |
|---|---|
| Two or more canonical capability routes frozen | Satisfied — Data Trust (Increment 7) and Evidence Center (Increment 8), both tagged. |
| Common Snapshot behavior understood, unified or non-unification disclosed | Addressed — Section 4/9: not unified by re-derivation, but reconciled by comparison; mismatch is disclosed, never silently ignored. |
| Capability error contracts stable | Satisfied — both frozen error-mapping tables (24 §12, 25 §16) are unchanged inputs to this plan. |
| Partial-failure policy approved | Addressed by this plan (Section 8) — pending the user's explicit approval of this document, as with every prior planning artifact in this project. |
| Aggregate schema approved | Addressed by this plan (Section 7) — a real design, not ADR-020 §13's conceptual sketch; supersedes that sketch's illustrative-only shape with concrete field names/types. |
| Performance budget defined | Addressed minimally (below) — no artificial timeout/circuit-breaker layer is introduced, since both capability calls are synchronous and in-process, identical in kind to every existing route's own unbounded-by-design execution model: per-capability timeout — none (no async I/O to time out); total request timeout — none (unchanged from both existing routes); concurrency limit — not applicable (sequential, synchronous); cancellation — not applicable (no async cancellation exists anywhere in this Next.js route model today); cache policy — **none**, explicitly consistent with ADR-020 §17's prohibition; maximum capability fan-out — fixed at 2 (Data Trust, Evidence Center only; a third capability is a future increment's own scoping decision, not configurable here); response-size limit — none introduced beyond the sum of both already-bounded capability envelopes. |
| Authorization behavior approved | Addressed — reuses `requireAdminAuth` verbatim, never more permissive than either underlying capability (Section 11). |
| A dedicated implementation increment approved | Not yet — this plan is architecture/planning only; a separate, explicit authorization is required before Section 15's sequence may begin, per this mission's own scope. |

## 17. Risk register

| Risk | Severity | Likelihood | Mitigation | Required test |
|---|---|---|---|---|
| Accidental direct legacy-engine or database access from the aggregator | High | Low | Aggregator core only takes the two capability functions via DI; never imports an engine, `lib/db`, or either outer adapter | Increment 9 contract sweep, no-legacy-import checks |
| Duplicated capability projection/checksum/snapshot logic | Medium | Medium | Aggregate projection calls the two *existing* projection functions verbatim; snapshot is compared, never re-derived | Projection adapter tests proving reuse; aggregator tests proving no second `deriveSiteSnapshot` call |
| Conflicting snapshots across capabilities | Medium | Low (no write path in the read chain; only out-of-band import can cause it) | Explicit comparison, disclosed issue, never a silent pick; `status` cannot be `complete` on mismatch | Snapshot-mismatch scenario test |
| Inconsistent nested timestamps | Low | Expected, not a defect | Documented as a known, accepted characteristic (Section 9) | None required — not a failure condition |
| Wire-payload duplication (both nested envelopes carry their own snapshot/context) | Low | Certain, by design | Accepted tradeoff, explicitly justified (Section 7, Q3) | None required |
| Incorrect status-to-HTTP-code mapping (e.g. total failure mistaken for transport success) | Medium | Medium (already caught once, by the independent planning review) | Fixed, corrected policy: 200 for `complete`/`partial` only; **500 for `failed`** (both capabilities unavailable) and for the aggregator's own crash — never 200 for a response containing zero real capability data (Section 7, Question 12a; Section 8) | Route status-mapping tests (Section 13.C), including the specific `failed` → 500 case |
| Authentication-ordering regression (repeating Increment 7's original defect) | High | Low | Identical auth-first-then-dynamic-import pattern applied from the start, verified by an index-based ordering test from day one (not a post-audit fix this time) | Increment 9 contract sweep ordering test |
| Hidden database writes introduced by the aggregator itself | High | Low | Aggregator never calls `getWritableDb()`/`getDb()`/either legacy engine directly; only calls the two already-vetted, `persist=false`-gated capability functions | Side-effect sweep (Section 13.E) |
| Barrel dependency cycle | Medium | Low | All new inter-adapter imports are direct sibling imports, never via `index.ts`, mirroring existing instance-file convention | Contract sweep string check confirming direct imports |
| Accidental mutation of either frozen capability contract | High | Low | Zero modification to any Data Trust/Evidence Center production file; only additive new files plus one barrel export addition | Re-assertion tests proving both existing routes/handlers unaffected (Section 13.D) |
| Fabricated success (reporting `complete` when data is missing) | High | Low | `status` derivation is conjunctive (`complete` requires both capabilities *and* no mismatch); every degraded condition maps to `partial`/`failed`, never silently to `complete` | Partial-failure matrix tests (Section 13.A) |
| Loss of issue provenance | Medium | Low | Nested envelopes' own issues are left untouched inside their own envelope, never flattened/re-tagged; aggregate-only issues get their own distinct `stage` taxonomy | Capability-origin preservation test |
| Aggregate route becoming a monolith as more capabilities are added later | Medium | Medium (over multiple future increments) | Fan-out fixed at exactly 2 for this increment; explicit note that a third capability should trigger reconsidering the DI shape (Section 5, Option E), mirroring the `ADAPTER_EXCLUSIONS`-growth technical-debt pattern already accepted in Increment 8 | None today — a documented future revisit trigger, not a current defect |

## 18. Acceptance criteria (for the future implementation increment)

- All test categories in Section 13 pass; roughly 77–88 new tests, exact
  count reported at implementation time.
- `git diff --check`, `npx tsc --noEmit`, `npm test`, `npm run build` all
  pass with zero new errors.
- Both frozen capability routes (`app/api/intelligence/data-trust/site/`,
  `app/api/intelligence/evidence-center/site/`) have zero diff.
- `data-trust`/`confidence`/`recommendation` manifests remain
  `status: "planned"`; no `evidence` or `site-intelligence` `EngineId` is
  registered.
- `config/capabilities.json` is unchanged.
- No file outside the declared inventory (Section 14) is touched.
- The aggregate route never returns a fabricated `complete` status when
  either capability did not genuinely succeed.
- **`result.status === "failed"` maps to HTTP 500, never 200** (post-review
  hardening, F-1) — verified by a dedicated test, not merely by code
  review, since this was the single required correction from the
  independent planning review.
- Each capability call is demonstrably isolated (one throwing never
  suppresses the other's result).
- The not-found-consistency check and the snapshot-consistency check
  never both fire for the same request (post-review hardening, F-4).
- Neither new `services/intelligence-runtime/` file contains a literal
  `@/lib/db`, `@/app/api`, or `sentinel-core` substring anywhere in its
  own source text, including comments (post-review hardening, F-3).

## 19. Explicit non-goals

- No implementation occurs in this mission — planning only.
- No modification to Increment 7's or Increment 8's contracts,
  orchestrators, projections, routes, or handlers.
- No new `EngineId`, manifest activation, or capability-registry change.
- No caching, at the aggregate layer or otherwise (ADR-020 §17 remains in
  force).
- No timeout/circuit-breaker/cancellation infrastructure beyond the
  minimal, mostly-"not applicable" answers in Section 16 — none of this
  codebase's existing routes have such infrastructure, and inventing it
  here would be unjustified scope growth.
- No UI change, no caller migration, no legacy route change.
- No redesign of the `?id=` query convention or introduction of path
  parameters.
- No third capability folded into this aggregator.
- No persistence, cache write, audit-log write, or manifest mutation.
- No new authentication/authorization model — `requireAdminAuth` is
  reused verbatim, unchanged.
- No new ADR.

## 20. Open questions

None outstanding as of the original hardened plan. Every design question
the mission's Steps 4–7 raised was resolved with a concrete, binding
answer (Sections 5, 7, 8, 9), including the structurally-unreachable-but-
not-assumed-impossible not-found-inconsistency edge case (Case E′),
rather than being deferred.

**Post-implementation-audit amendment (F-1, F-2, F-3):** the independent
implementation audit found two genuine gaps this plan had not
addressed — the hybrid one-capability-unavailable-plus-one-notFound
combination (never enumerated in the original nine-way state analysis),
and a misleading internal `"failed"` label for the both-notFound case —
plus one convention gap (no server-side logging for capability-level or
aggregate-level failure, unlike every other error path in this project).
All three are now resolved and reflected in Sections 7 (12a, 12b) and 8
(Case E″, Case I's corrected logging note) above. No further open
questions remain after this amendment. One item is explicitly recorded as
**not** addressed by this hardening pass and left for a future,
separately-scoped pass if ever needed: Case E′ (not-found inconsistency)
still has no dedicated server-side log entry — F-3's approved scope
covered only per-capability-unavailable and aggregate-`failed` logging,
not this anomaly, which remains visible only in the response body's
`adaptation.issues`.
