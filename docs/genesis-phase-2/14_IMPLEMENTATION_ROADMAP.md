# 14 — Implementation Roadmap (Genesis Phase 2)

This roadmap is the controlled sequence Genesis Phase 2 **implementation** (a future, separate mission — not this one) should follow. Nothing in this document is executed by this mission (Principle: documentation-only, restated from the mission brief).

## Increment 0 — Native baseline verification and security floor

- **Objective:** establish ground truth this and the prior audit could not (native `leonidas-pc` tsc/test/build run), and close the highest-severity open risk with minimal footprint before any new canonical code exists to also secure.
- **Affected files:** none (verification only) for the baseline half. For the security-floor half: a new minimal auth-check applied to `POST /api/data-trust/recalculate` and `POST /api/sentinel-core/build` at minimum (the two most compute/write-intensive unauthenticated endpoints per the pre-implementation audit).
- **New files:** e.g. `lib/auth-guard.ts`.
- **Dependencies:** none.
- **Tests:** `tests/auth-guard.test.ts`.
- **Acceptance criteria:** native baseline output recorded verbatim; the two named routes return `401`/`403` without valid credentials; all existing tests remain green; `tsc --noEmit` clean; no other route's behavior changes.
- **Observability:** auth failures logged (sanitized, no credential material in logs, per `10_SECURITY_BOUNDARY.md`'s disclosure policy).
- **Security:** this increment *is* the security work for this scope.
- **Backward compatibility:** every other route unchanged.
- **Rollback:** revert the new file and its two call-site insertions.
- **Documentation:** update `10_SECURITY_BOUNDARY.md`'s status table to reflect which routes are now actually enforced vs. still only classified.
- **Quality gates:** full set per `16_QUALITY_GATES.md`.

## Increment 1 — Architecture freeze

- **Objective:** formally close this Genesis Phase 2.0 mission — the seventeen documents in `docs/genesis-phase-2/` become the binding reference for every subsequent increment.
- **Affected/new files:** none beyond what this mission itself produces.
- **Acceptance criteria:** `00_EXECUTIVE_SUMMARY.md`'s "Architecture frozen: Yes" status is true, i.e. every required decision in this roadmap's own Step 18/19 questions has a recorded answer, not an open question.

## Increment 2 — Engine manifest and registry runtime

- **Objective:** build `services/intelligence-runtime/` (the `EngineRegistry` singleton + the `EngineManifest` type/validator from `07_ENGINE_MANIFEST.md`), and register the eleven canonical engine ids at `"planned"` status (matching Phase 1's own baseline) — no engine logic yet.
- **New files:** `services/intelligence-runtime/registry-instance.ts`, `services/intelligence/registry/engine-manifest.ts` (or similar — the manifest type extension, added to `services/intelligence/` only if it's judged a genuine contract addition rather than runtime-layer code; default to keeping it in `intelligence-runtime/` per Principle 13's conservatism about touching `services/intelligence/` itself).
- **Dependencies:** Increment 1 (frozen architecture to build against).
- **Tests:** manifest shape validation tests, registry singleton tests.
- **Acceptance criteria:** `GET /api/intelligence/engines` (new, minimal) lists all eleven engines at `"planned"`, matches `07_ENGINE_MANIFEST.md`'s schema.
- **Security:** the new listing route classified per `10_SECURITY_BOUNDARY.md` (Authenticated read) — enforced if Increment 0's auth mechanism is ready, otherwise logged as a known gap, not silently left unauthenticated indefinitely.
- **Backward compatibility:** fully additive.
- **Rollback:** delete new files/route.

## Increment 3 — Site entity adapter

- Per `08_ADAPTER_STRATEGY.md`'s adapter #1. **Objective:** first canonical entity translation, pure, unit-tested, not yet wired into any route.
- **Dependencies:** Increment 2 (needs the registry to declare against, even if not strictly required to compile — declared here for sequencing clarity).
- **Tests, acceptance criteria, rollback:** as detailed in the pre-implementation audit's own Increment 3 (this roadmap adopts that plan verbatim, now formally placed inside the frozen architecture).

## Increment 4 — Data Trust Score adapter

- Per `08_ADAPTER_STRATEGY.md`'s adapter #2. Depends on Increment 3 (needs `EntityReference<"Site">`).
- **Critical detail, new in this document:** the adapter must call `dataTrustForSite(db, id, persist=false)` explicitly (Principle 6) — this is a **mandatory acceptance-criterion**, not an implementation detail: a code review that finds the adapter calling the legacy function with its default `persist=true` fails this increment's quality gate outright.

## Increment 5 — Evidence adapter

- Per `08_ADAPTER_STRATEGY.md`'s adapter #3. Depends on Increment 4 (Score references need Evidence to exist to cite, even if the citation is added in a follow-up pass).
- **Mandatory acceptance criterion:** every Copernicus-sourced Evidence item carries `reliability` reflecting simulated status and a `Limitation` disclosing it — verified by a dedicated test asserting `isTruthfulCopernicusResponse`-equivalent behavior survives the adapter translation (reusing `services/copernicus-truth.ts`'s own existing helper where possible).

## Increment 6 — Recommendation adapter

- Per `08_ADAPTER_STRATEGY.md`'s adapter #4. Depends on Increment 4 (needs ≥1 Score to react to, per Phase 1's roadmap sequencing) and Increment 5 (cites Evidence).
- **Objective includes** the three-shape reconciliation named in `02_CANONICAL_DOMAIN_MODEL.md` — this increment's design doc (written when the increment starts, not now) must explicitly state which legacy source is authoritative for which recommendation category, not leave it implicit in code.

## Increment 7 — Canonical read-only endpoint

- Per `08_ADAPTER_STRATEGY.md`'s adapter #5 (API Projection Adapter) plus `13_MIGRATION_STRATEGY.md` stage 4 for Data Trust specifically: `GET /api/intelligence/data-trust/site`.
- **Mandatory:** genuinely read-only (no `persist` parameter at all, or `persist` hardcoded false) — this route is the proof that Principle 6 is achievable, not just declared.
- **Security:** classified per `10_SECURITY_BOUNDARY.md`, enforced if Increment 0's mechanism supports it by this point.

## Increment 8 — Shadow execution and output comparison

- `13_MIGRATION_STRATEGY.md` stages 1–3, for Data Trust. **Objective:** accumulate evidence that the canonical path matches the legacy path within the documented tolerance, before anything depends on the canonical path being correct.
- **Acceptance criteria:** comparison report showing ≥99% of sampled sites within the ±2-point tolerance (or documented, understood exceptions for the remainder — not silently ignored outliers).

## Increment 9 — Persistence / version history

- Builds the conceptual schema from `09_PERSISTENCE_AND_HISTORY.md` for real, as its own reviewed migration (the first schema change since this mission began, explicitly out of Phase 2.0's own scope but now in-scope for Phase 2 implementation).
- **Dependencies:** Increment 8 (don't persist canonical calculations you haven't yet proven correct against the legacy baseline).

## Increment 10 — Batch recalculation safety

- Implements the resumable/checkpointed full-dataset mode (`03_INTELLIGENCE_PIPELINE.md`) for Data Trust, using Increment 9's schema.
- **Mandatory:** bounded batch size (manifest `maxBatchSize`), checkpoint persistence, idempotency key — all three, per `09_PERSISTENCE_AND_HISTORY.md`, none optional for a full-dataset-scale operation (Principle 15).

## Increment 11 — Existing API migration

- `13_MIGRATION_STRATEGY.md` stages 5–6 for Data Trust: UI feature-flagged onto the canonical endpoint, then legacy route deprecation once the coexistence proof exists.
- **This is also where the GET-side-effect fix for `/api/data-trust/site` specifically lands**, if not already expedited earlier under Increment 0's security-floor scope (`13_MIGRATION_STRATEGY.md`'s note on this).

## Increment 12 — Legacy deprecation

- `13_MIGRATION_STRATEGY.md` stage 7, only after zero measured traffic on the deprecated legacy route for the documented period.
- **Explicitly not a Phase 2.0 or even a near-term Phase 2 deliverable** — recorded here for completeness of the sequence, not as something to schedule yet.

## Explicitly postponed past this entire roadmap (not silently dropped — see pre-implementation audit Section 18 for the original list, reaffirmed here)

- Repeating Increments 3–12 for Confidence, Data Quality, Duplicates, Evidence Center's remaining pieces, and any future Risk Engine — each follows this same roadmap shape independently, started only after Data Trust's full cycle (through Increment 11 at least) proves the pattern works end-to-end once, per Principle 1.
- Deciding `sentinel-core/entities`/`adapters`' fate (implement for real vs. retire the expectation) — `15_ARCHITECTURE_DECISIONS.md` ADR-013.
- Extending `lib/request-guard.ts` coverage to the remaining ~41 non-mandatory-scope endpoints.
- Designing a real, consolidated Risk Engine.
- Full-database Data Trust coverage as an operational/scheduling decision, separate from the contract-wiring work above.
