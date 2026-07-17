# 28 — Increment 9: Site Intelligence Aggregator — Implementation Record

Implementation record, written per
`27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md` (hardened, reviewed,
re-checked: PASS). Per ADR-020 (Option C: federated capability routes,
additive aggregation layer), this increment builds the federated Site
Intelligence Aggregator composing the two frozen canonical Intelligence
capabilities without modifying either.

## 1. Baseline

Branch `master`, HEAD `fa8f180`, tag `genesis-phase-2-increment-8-v1`,
working tree clean except the approved Increment 9 planning document,
confirmed before any implementation file in this increment was touched.

## 2. Architecture implemented

**Option C — Orchestrator composition**, exactly as specified by the
hardened plan and ADR-020 Section 11's own aggregation-flow diagram:

```
Existing Data Trust Orchestrator instance ────┐
                                              ├─ Site Intelligence Aggregator (pure core)
Existing Evidence Center Orchestrator instance ┘
                                                       │
                                                       ▼
                                        Site Intelligence Projection Adapter
                                                       │
                                                       ▼
                                              Handler / Route
```

The Aggregator receives raw, frozen capability-orchestrator results
(`CanonicalDataTrustOrchestrationResult`/`CanonicalEvidenceOrchestrationResult`)
via the two capabilities' already-public entry points
(`getCanonicalDataTrustForSite`, `getCanonicalEvidenceForSite`) — never an
HTTP response, `NextRequest`, `NextResponse`, handler, route, or
already-projected envelope. Projection happens only after all
orchestration decisions (outcome classification, not-found consistency,
snapshot comparison, status derivation) are complete, by calling the two
existing frozen projection functions
(`projectCanonicalDataTrustResponse`, `projectCanonicalEvidenceResponse`)
to build each nested embedded envelope — no projection logic is
duplicated.

## 3. Files created

| File | Kind |
|---|---|
| `services/intelligence-runtime/site-intelligence-aggregator.ts` | Pure, DI-based Aggregate Orchestrator core |
| `services/intelligence-runtime/site-intelligence-aggregator-instance.ts` | Real wiring (the only new module resolving both frozen capability instance modules) |
| `services/intelligence-adapters/site-intelligence-projection-adapter.ts` | Pure Aggregate Projection Adapter |
| `app/api/intelligence/site/route.ts` | `runtime`/`dynamic`/`GET` only; auth-first, dynamic import |
| `app/api/intelligence/site/handler.ts` | Testable request-handling logic; no auth dependency |
| `tests/intelligence-site-aggregator.test.ts` | Pure orchestrator core tests |
| `tests/intelligence-site-projection-adapter.test.ts` | Pure projection tests |
| `tests/intelligence-site-route.test.ts` | Route/handler behavioral tests |
| `tests/intelligence-increment-9-contract.test.ts` | Dependency-boundary/architecture sweep |
| `tests/intelligence-increment-9-side-effects.test.ts` | Write-pattern regression sweep |

## 4. Files modified

| File | Change |
|---|---|
| `services/intelligence-adapters/index.ts` | Export-only addition: `SiteIntelligenceCapabilityProjection`, `SiteIntelligenceAggregateEnvelope`, `projectSiteIntelligenceResponse`. The new DB-touching instance module is, like both prior increments' instance modules, deliberately not re-exported here. |
| `tests/intelligence-increment-8-contract.test.ts` | **One authorized deviation from the plan, approved by the user before editing (see Section 15).** |

No frozen capability file (Data Trust or Evidence Center orchestrator,
instance, read adapter, projection adapter, route, or handler) was
modified. No legacy engine, legacy route, manifest, or `config/capabilities.json`
was touched.

## 5. Aggregate contract

```ts
interface SiteIntelligenceAggregateEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "site-intelligence";
  readonly siteId: string;
  readonly snapshot: { id: string; kind: "derived" | "synthetic"; source: "data_importacao" | "arquivo_origem" | "fallback" } | null;
  readonly context: { contextId: string; correlationId: string; requestedAt: string; requestedBy: string; environment: string } | null;
  readonly result: {
    readonly status: "complete" | "partial" | "failed";
    readonly dataTrust: { state: "available" | "unavailable" | "notFound"; envelope: DataTrustCanonicalEnvelope | null };
    readonly evidenceCenter: { state: "available" | "unavailable" | "notFound"; envelope: EvidenceCenterCanonicalEnvelope | null };
  };
  readonly adaptation: { readonly issues: readonly SiteIntelligenceIssue[] };
}
```

No `notFound` field — a genuinely not-found Site (both capabilities
agree) maps to a plain HTTP 404 before this envelope is ever constructed.
Each nested envelope is embedded **whole**, including its own
`schemaVersion`/`capability` label — an intentional, disclosed coupling
(plan Section 7) accepted to avoid duplicating either capability's own
projection logic. Aggregate-origin issues (`snapshot-consistency`,
`capability-failure`, `notfound-inconsistency`) appear only in the
top-level `adaptation.issues`; each nested envelope's own issues remain
untouched inside its own envelope — no duplication, no lost provenance.

## 6. Status derivation

- **`complete`**: both capabilities `state: "available"`, both nested
  `adaptation.success === true`, snapshots agree, no not-found
  inconsistency.
- **`partial`**: at least one capability produced a usable result
  (`state: "available"`) and the request did not qualify as `complete` —
  covers one-sided crash, one/both `adaptation.success === false`,
  snapshot mismatch, and not-found inconsistency.
- **`failed`**: neither capability produced a usable result
  (`state !== "available"` for both) — precisely, both threw/were
  otherwise unavailable due to unexpected runtime failure. Covers both
  the ordinary double-crash case and the hybrid combination (one
  capability `unavailable`, the other independently `notFound`, either
  pairing) — **post-audit hardening (F-1): this hybrid combination is now
  formally documented** in `27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md`
  Section 8 (Case E″) as an approved, recorded plan extension, no longer
  an undocumented deviation. Covered by tests 20 (Data Trust unavailable
  + Evidence Center notFound) and 21 (the mirror pairing) in
  `intelligence-site-aggregator.test.ts`.
- **`notFound`** (internal only — post-audit hardening, F-2): used
  exclusively by the both-capabilities-agree-not-found path
  (`bothNotFoundResult`), replacing an earlier, misleading internal use of
  `"failed"` for this case. Structurally guaranteed, by construction, to
  co-occur only with `notFound: true`, and never externally reachable —
  `handler.ts` checks `result.notFound` strictly before ever inspecting
  `result.status`. See plan Section 7, Question 12b, for the full
  rationale. Covered by test 7b (`intelligence-site-aggregator.test.ts`)
  and tests 3b/3c (`intelligence-site-route.test.ts`, the latter proving
  the handler's own check *order*, not just the orchestrator's internal
  consistency, is what guarantees correctness).

## 7. HTTP matrix

| Condition | HTTP |
|---|---|
| Invalid/missing `id` | 400 |
| `requireAdminAuth` rejects | 401 or 503 |
| Both capabilities agree Site not found (internal `status: "notFound"`, never inspected) | 404 |
| `status: "complete"` | 200 |
| `status: "partial"` (including not-found inconsistency) | 200 |
| `status: "failed"` (both unavailable, or one unavailable + one notFound) | **500**, sanitized |
| Unexpected exception in the aggregator/handler's own code | **500**, identical sanitized *client-facing* body |

`failed` and the aggregator's own crash produce byte-identical sanitized
**client-facing** bodies (`{"error": "Site intelligence assessment
unavailable."}`), deliberately indistinguishable to the client, since
both mean "no usable response could be produced" (plan Section 7,
Question 12a). **Post-audit hardening (F-3): they are, however,
deliberately distinguishable server-side** — `status: "failed"` logs
`console.error("intelligence_site_status_failed", {dataTrust, evidenceCenter})`
(both capabilities' sanitized error names), while the aggregator/handler's
own crash logs the pre-existing `console.error("intelligence_site_failed", errorName)`
— two distinct diagnostic codes, so an operator can tell "both
capabilities cleanly reported unavailable" apart from "our own code
broke" in production logs. Additionally, a single capability becoming
`unavailable` — even when masked by the other succeeding, producing an
overall `partial`/200 response — now logs its own sanitized diagnostic
(`intelligence_site_data_trust_unavailable` /
`intelligence_site_evidence_center_unavailable`), closing the
observability gap the independent audit identified (F-3): previously, no
server-side trace existed for a single crashed capability at all.

## 8. Not-found/snapshot evaluation order

Implemented exactly per the hardened plan: execute both capability calls
independently (each isolated in its own `try/catch`) → classify each
outcome (`available`/`unavailable`/`notFound`) → evaluate not-found
consistency first (both `notFound` → aggregate `notFound`, short-circuit
before any snapshot comparison) → if not-found states disagree, record
exactly one `notfound-inconsistency` issue and skip snapshot comparison
entirely for that pair → only when both capabilities agree the Site
exists and both supplied a non-null snapshot is a `snapshotId` equality
check performed. Verified by tests 7–12 and 19 in
`intelligence-site-aggregator.test.ts`: a not-found inconsistency never
also produces a `snapshot_mismatch` issue for the same request.

## 9. Issue provenance

Nested capability issues remain exactly where each capability's own
orchestrator/projection already puts them (inside `result.<capability>.envelope.adaptation.issues`),
untouched. The aggregate's own top-level `adaptation.issues` contains
only aggregate-origin issues (`snapshot-consistency`, `capability-failure`,
`notfound-inconsistency`). Verified by projection-adapter tests 9–10: a
capability's own adaptation issue never appears in the top-level list,
and an aggregate issue never appears inside a nested envelope.

## 10. Read-only proof

- Neither the pure Aggregator core nor the projection adapter calls
  `getWritableDb()`, `getDb()`, any legacy engine, or either outer read
  adapter — confirmed by source inspection and by
  `intelligence-increment-9-side-effects.test.ts`'s write-pattern sweep
  (13 tests, all passing) across all five new files.
- The instance wiring file calls only the two existing, already-`persist=false`-gated
  capability entry points; it introduces no new schema-initialization
  path (verified: no `ensure*Tables` reference anywhere in the new
  files).
- Both capability calls are synchronous, non-`Promise`-returning
  functions; the Aggregator calls them sequentially, never via
  `Promise.all` (verified by a dedicated contract-sweep assertion) —
  there is no concurrency to exploit, and `Promise.all` would only add
  microtask overhead while misleadingly implying parallelism.
- Each capability call is wrapped in its own `try/catch` inside the
  Aggregator core — verified behaviorally (tests 2, 3, 15) that one
  capability throwing never suppresses the other's real result.

## 11. Test inventory and exact count

Updated post-audit hardening (F-1, F-2, F-3): 9 tests added across two
files.

| File | Tests |
|---|---|
| `tests/intelligence-site-aggregator.test.ts` | 22 (was 20; +7b, +21) |
| `tests/intelligence-site-projection-adapter.test.ts` | 17 |
| `tests/intelligence-site-route.test.ts` | 18 (was 11; +3b, +3c, +8b, +8c, +8d, +8e, +8f) |
| `tests/intelligence-increment-9-contract.test.ts` | 49 |
| `tests/intelligence-increment-9-side-effects.test.ts` | 13 |
| **New tests, total** | **119** |

## 12. Quality-gate results

Re-run in full after the post-audit hardening pass (F-1, F-2, F-3):

- `git diff --check`: clean (only harmless LF→CRLF advisory warnings on
  the two modified, tracked files — matching Increment 7/8's own
  precedent; new/untracked files never appear in this check).
- `npx tsc --noEmit`: clean, zero errors.
- `npm test`: **794/794 passed**, 54 test files (785 + 9 new hardening
  tests; before the earlier authorized fix, exactly one pre-existing test
  had failed for the documented, authorized reason in Section 15 — full
  suite has been green on every run since).
- `npm run build`: **succeeded** (`✓ Compiled successfully in 2.1s`).
  `/api/intelligence/site` appears **exactly once** in the route list,
  alongside `/api/intelligence/data-trust/site` and
  `/api/intelligence/evidence-center/site`, both unchanged.

## 13. Build result

`next build` completed successfully; all 49 routes listed, including the
three canonical Intelligence routes as dynamic (`ƒ`) server-rendered
routes, matching the frozen capabilities' own existing classification.

## 14. Deviations from plan

One deviation, explicitly authorized by the user before it was made (see
Section 15) — no other deviation from the hardened plan occurred. Every
architectural decision (composition seam, HTTP status mapping, evaluation
order, nested-envelope embedding, barrel export discipline, runtime
source-boundary sweep compliance) was implemented exactly as specified.

## 15. Authorized deviation: one existing Increment 8 test updated

**File modified:** `tests/intelligence-increment-8-contract.test.ts`
(one test, lines 53–56).

**Reason:** this test was written during Increment 8 to prove Increment 8
itself did not prematurely introduce the aggregate route
(`app/api/intelligence/site/`), correctly enforcing ADR-020 Section 21's
non-goal for that increment at the time. Once Increment 9 legitimately
created that route, the test's literal assertion
(`expect(fs.existsSync(aggregateDir)).toBe(false)`) became factually
obsolete — not because anything was implemented incorrectly, but because
the assertion's premise ("this route doesn't exist yet") was scoped to a
point in time Increment 9's entire approved purpose is to move past.

**Process followed:** implementation was paused immediately upon
discovering this single test failure (the only failure in the entire
785-test suite); the deviation was reported to the user with two proposed
options before any edit was made; the user explicitly authorized option
(a); only then was the edit applied.

**Exact change:** the assertion now reads
`expect(fs.existsSync(aggregateDir)).toBe(true)`, and the test's
description was renamed from "no aggregate route exists
(/api/intelligence/site)" to "did not itself introduce the aggregate
route (/api/intelligence/site) -- Increment 9 is the approved increment
that does, and it now exists" — preserving the historical intent (that
Increment 8 itself did not jump ahead) while correctly reflecting the
repository's current, approved state.

**No frozen production capability was modified** by this change — it is
a test-only correction to one boundary assertion in a pre-existing
regression sweep, not a change to Data Trust or Evidence Center's own
contract, orchestrator, projection, route, or handler.

## 16. Risk observations

- No new risk beyond those already identified and mitigated in the
  hardened plan's risk register (Section 17). All planned mitigations
  were implemented as designed: per-capability `try/catch` isolation,
  evaluation-order discipline, direct sibling imports (no barrel cycle),
  and explicit avoidance of the runtime source-boundary sweep's matched
  substrings.
- The hybrid edge case of "one capability unavailable, the other
  independently `notFound`" (originally an implementation-time
  observation, only self-disclosed here as a risk note) was subsequently
  identified by the independent implementation audit as an undocumented
  plan deviation (finding F-1) — **now resolved**: see Section 19 below.
- The audit also identified two further findings, F-2 (a misleading
  internal `status: "failed"` label for the both-notFound case) and F-3
  (silent server-side error swallowing for capability- and aggregate-level
  failures) — both **now resolved**, see Section 19.

## 17. Git status (as of this document's original writing, before the
post-audit hardening pass — see Section 19 for the current inventory)

```
 M services/intelligence-adapters/index.ts
 M tests/intelligence-increment-8-contract.test.ts
?? app/api/intelligence/site/
?? docs/genesis-phase-2/27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md
?? docs/genesis-phase-2/28_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_IMPLEMENTATION.md
?? services/intelligence-adapters/site-intelligence-projection-adapter.ts
?? services/intelligence-runtime/site-intelligence-aggregator-instance.ts
?? services/intelligence-runtime/site-intelligence-aggregator.ts
?? tests/intelligence-increment-9-contract.test.ts
?? tests/intelligence-increment-9-side-effects.test.ts
?? tests/intelligence-site-aggregator.test.ts
?? tests/intelligence-site-projection-adapter.test.ts
?? tests/intelligence-site-route.test.ts
```

Nothing staged. No commit, tag, or push performed.

## 18. Recommendation for independent implementation audit

Ready. All quality gates pass; the file inventory matches the hardened
plan exactly plus the one authorized, user-approved deviation; the
aggregate route composes both frozen capabilities without modifying
either; read-only behavior is preserved and verified; no new manifest,
`EngineId`, persistence, or caching was introduced. Recommend the next
step be an independent adversarial implementation audit before any
freeze (commit/tag/push) is authorized, consistent with this project's
established Increment 7/8 protocol.

## 19. Post-audit hardening pass (F-1, F-2, F-3)

The independent adversarial implementation audit (PASS WITH REQUIRED
FIXES; 0 CRITICAL, 0 HIGH, 3 MEDIUM, 4 LOW findings) identified three
MEDIUM findings, all now resolved in a focused, scoped hardening pass.

**F-1 — Status semantics for the hybrid state (RESOLVED).** The audit
found that `status derivation` classified the combination "one capability
`unavailable`, the other independently `notFound`" as `failed` — correct
in direction (conservative, no fabricated success) but never formally
authorized by the plan's original, literal "failed requires both
capabilities `unavailable`" wording. Resolution: formally documented as
Case E″ in `27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md` Section
8, with the "failed" definition in Section 7 (Question 12a) extended to
explicitly cover both the double-crash case and this hybrid combination.
No production-code behavior changed — only the documentation, which was
the gap, plus two new regression tests covering both pairings (tests 20
and 21, `tests/intelligence-site-aggregator.test.ts`).

**F-2 — Both-notFound internal representation (RESOLVED).** The audit
found `bothNotFoundResult` set `status: "failed"` for a condition that is
not a runtime failure at all. Resolution: `SiteIntelligenceStatus` gained
a fourth literal, `"notFound"` (`services/intelligence-runtime/site-intelligence-aggregator.ts`),
used exclusively by `bothNotFoundResult`, structurally coupled to
`notFound: true` by construction (both set together in the same return
statement). External behavior is unchanged (still always 404 before
`status` is ever inspected) — the fix makes the *internal*
representation honest in addition to the pre-existing, correct *external*
behavior. This required no change to `site-intelligence-projection-adapter.ts`
(outside this pass's authorized scope) because that file imports
`SiteIntelligenceStatus` by reference, not by redeclaration — the new
literal propagates automatically. Three new tests added: test 7b
(`intelligence-site-aggregator.test.ts`, proving the internal value is
`"notFound"`, never `"failed"`) and tests 3b/3c
(`intelligence-site-route.test.ts` — 3b uses a deliberately contrived
fixture decoupling the handler's own check-order correctness from the
orchestrator's construction discipline; 3c proves the real value also
returns 404).

**F-3 — Sanitized operational logging (RESOLVED).** The audit found zero
`console.error` calls anywhere across the per-capability failure path and
the aggregate-`failed` path, unlike every other error path in this
project's established convention. Resolution, entirely in
`app/api/intelligence/site/handler.ts` (deliberately kept out of the pure
orchestrator core, consistent with this project's existing convention
that logging happens only at the handler layer): `console.error("intelligence_site_data_trust_unavailable", errorName)`
and `console.error("intelligence_site_evidence_center_unavailable", errorName)`
fire independently whenever either capability's `state === "unavailable"`
(regardless of overall `status`, so a single crashed capability masked by
a `partial`/200 overall response is now visible server-side too);
`console.error("intelligence_site_status_failed", {dataTrust, evidenceCenter})`
fires for the aggregate `"failed"` case, using a diagnostic code
deliberately distinct from the pre-existing `"intelligence_site_failed"`
(the aggregator/handler's own thrown-exception path) so the two remain
distinguishable in production logs. Only stable diagnostic codes and
already-sanitized `.name` values are ever logged — never `.message`,
`.stack`, request headers, or payload data. Six new tests added
(`tests/intelligence-site-route.test.ts` 8b–8f) proving: each diagnostic
fires with the expected code and sanitized content; none of it ever
leaks into the client-facing response body; no logging occurs for a
fully `complete` response; and the aggregator/handler-crash path (test
8, pre-existing) remains on its own distinct code.

**Scope discipline:** only `services/intelligence-runtime/site-intelligence-aggregator.ts`,
`app/api/intelligence/site/handler.ts`, `tests/intelligence-site-aggregator.test.ts`,
`tests/intelligence-site-route.test.ts`, and both documentation files were
touched in this pass. `site-intelligence-projection-adapter.ts`,
`site-intelligence-aggregator-instance.ts`, `route.ts`, and both
`intelligence-increment-9-{contract,side-effects}.test.ts` files were not
modified — not needed for any of F-1/F-2/F-3, and not touched to avoid
unauthorized scope growth. No frozen Data Trust or Evidence Center
production file was touched.

**Updated quality-gate results (re-run in full, from the beginning,
after this pass):** `git diff --check` clean; `npx tsc --noEmit` clean;
`npm test` **794/794 passed** (54 files; 119 Increment 9 tests, up from
110); `npm run build` succeeded, `/api/intelligence/site` still appears
exactly once.

**Updated git status:**

```
 M services/intelligence-adapters/index.ts
 M tests/intelligence-increment-8-contract.test.ts
?? app/api/intelligence/site/
?? docs/genesis-phase-2/27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md
?? docs/genesis-phase-2/28_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_IMPLEMENTATION.md
?? services/intelligence-adapters/site-intelligence-projection-adapter.ts
?? services/intelligence-runtime/site-intelligence-aggregator-instance.ts
?? services/intelligence-runtime/site-intelligence-aggregator.ts
?? tests/intelligence-increment-9-contract.test.ts
?? tests/intelligence-increment-9-side-effects.test.ts
?? tests/intelligence-site-aggregator.test.ts
?? tests/intelligence-site-projection-adapter.test.ts
?? tests/intelligence-site-route.test.ts
```

Unchanged in shape from Section 17 above — `app/api/intelligence/site/handler.ts`,
`route.ts`, and `services/intelligence-runtime/site-intelligence-aggregator.ts`
were never staged or committed at any point during this hardening pass
(or before it), so they remain untracked new files under the
`app/api/intelligence/site/` directory entry, exactly as before. Editing
an untracked file does not change its untracked status. Only the same
two pre-existing tracked files (`services/intelligence-adapters/index.ts`,
`tests/intelligence-increment-8-contract.test.ts`) show as modified.

Nothing staged. No commit, tag, or push performed. Recommend a final,
focused re-check confirming F-1/F-2/F-3 resolution before Increment 9 is
frozen.
