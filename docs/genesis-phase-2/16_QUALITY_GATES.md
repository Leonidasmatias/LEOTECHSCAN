# 16 — Quality Gates (Genesis Phase 2)

These gates bind every future Phase 2 **implementation** increment (`14_IMPLEMENTATION_ROADMAP.md`). This document defines the gates; it does not run them (documentation-only mission).

## Mandatory gates — every increment, no exceptions

1. **Git working tree check.** Working tree clean before starting; only the increment's declared files changed at completion (`git status --short` reviewed against the increment's own "Affected/new files" list).
2. **TypeScript.** `tsc --noEmit` clean — zero new errors, zero suppressed errors (no new `@ts-ignore`/`@ts-expect-error` introduced without a documented, reviewed reason).
3. **Unit tests.** All new pure logic (adapters' inner translators, manifest validators, registry logic) covered by unit tests with no I/O.
4. **Contract tests.** Any code touching `services/intelligence/**` shapes re-validated against `validateScoreShape`/`validateEvidenceShape`/etc. (existing pattern in `tests/intelligence-score-contract.test.ts`) — extended, never weakened.
5. **Adapter tests.** Every new adapter has a test proving it: (a) calls the wrapped legacy engine in read-only mode where applicable (Increment 4's mandatory check is the canonical example), (b) introduces no new business formula (spot-checked by asserting adapter output is a pure function of legacy engine output, not of any new computation), (c) preserves source values without silent transformation beyond the documented scale conversion.
6. **API tests.** Any new or changed route tested for status codes, response shape, and — critically — that no *existing* route's behavior changed (regression test on the legacy route, not just the new one).
7. **Security tests.** Role classification from `10_SECURITY_BOUNDARY.md` has a corresponding test asserting the enforced behavior (401/403 where required) once enforcement exists; before enforcement exists, a test asserting the route is *still correctly classified* in the manifest/registry (documentation-as-code check).
8. **Performance tests where relevant.** Any change touching a full-dataset/batch path (`09_PERSISTENCE_AND_HISTORY.md`) measured against the existing baseline (e.g. prior audits' recorded full-recalculation timing) — regression beyond a documented threshold blocks the gate.
9. **Build.** `next build` (production build) clean.
10. **Source-code diff review.** Human review confirming the diff matches the increment's stated objective and affected-files list — no incidental changes to files outside that list.
11. **Documentation update.** The relevant `docs/genesis-phase-2/*.md` file(s) updated if the increment's actual implementation deviates from what was designed (the frozen documents are the reference, but a deviation must be reconciled, not left silently inconsistent — see Principle 16 in `01_ARCHITECTURE_PRINCIPLES.md`).
12. **Capability registry consistency.** `config/capabilities.json` reviewed — updated only if the increment's own stage (per `13_MIGRATION_STRATEGY.md`) calls for it (default: unchanged, since most increments precede stage 6).
13. **Rollback proof.** The increment's documented rollback procedure (`14_IMPLEMENTATION_ROADMAP.md`, per-increment) actually exercised (reverted in a test/staging pass) before being considered complete, not merely described.

## Additional gates — before specific actions

- **Before exposing a new endpoint:** security classification recorded (`10_SECURITY_BOUNDARY.md`); read-only vs. mutating explicitly stated and tested; response shape matches `services/intelligence/**` contracts exactly (no ad hoc shape drift).
- **Before persisting canonical calculations:** the shadow-mode and dual-execution stages (`13_MIGRATION_STRATEGY.md` stages 1–2) must have already run for that capability with no unresolved comparison failures; the persistence schema itself must have passed its own migration review (`09_PERSISTENCE_AND_HISTORY.md`).
- **Before enabling batch recalculation:** bounded batch size, checkpoint persistence, and idempotency key all present and tested (`09_PERSISTENCE_AND_HISTORY.md`, `14_IMPLEMENTATION_ROADMAP.md` Increment 10) — partial-completion behavior explicitly tested (kill mid-batch, resume, verify no duplicate/missing rows).
- **Before deprecating a legacy route:** `13_MIGRATION_STRATEGY.md`'s deprecation criteria fully met (documented coexistence duration elapsed, zero flag-triggered rollbacks, continuous comparison passes) — not a judgment call at implementation time, a checklist against that document.
- **Before claiming a capability as production-ready:** `04_ENGINE_LIFECYCLE.md`'s production-readiness gate fully satisfied (all listed criteria, not a subset) and `config/capabilities.json` updated to reflect it truthfully (Principle 16) — an engine is never marked ready because a deadline arrived.

## What happens on gate failure

A failed gate blocks progression to the next increment in `14_IMPLEMENTATION_ROADMAP.md`'s sequence. It does not block or revert prior, already-passed increments unless the failure reveals a defect in one of them (in which case the defect is fixed at its source, per Principle 2's "wrap, don't modify" applying only to *legacy* code — new Phase 2 code is fully correctable).
