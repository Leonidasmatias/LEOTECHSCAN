# Increment 10 — Implementation Contract

## 1. Purpose

This document is the governing execution contract for Increment 10
(Satellite Intelligence). It does not design, redesign, or explain the
architecture, and it does not plan the work — those are the exclusive
jobs of the two documents it sits below in authority. Its only job is to
state the mandatory rules every implementation Wave must follow while
turning the already-frozen architecture and already-frozen execution
plan into real files: what "ready to start a Wave" means, what "done"
means, what every Wave must produce as evidence of its own correctness,
who/what may change what, and the exact conditions under which
implementation must stop rather than improvise. Where this contract and
either frozen document could be read as saying two different things,
this contract yields — it has no authority to override, reinterpret, or
narrow either frozen document; it only adds process discipline around
them.

## 2. Scope

This contract governs Increment 10 implementation only — Waves 0 through
10, exactly as sequenced in the implementation plan's Section 16. It
covers every one of the 13 approved production files and 11 approved test
files (implementation plan Section 7), and no others. It does not cover:
Increment 9 or any earlier increment (frozen, out of scope, never
touched); any future real-provider integration, caching, imagery
delivery, CV/ML interpretation, multi-provider orchestration, or Site
Intelligence asynchronous integration (architecture plan Section 29,
explicitly out of this increment's scope); or the future
`31_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION.md` record (a
different, later document, written only once every Wave's gate has
passed — not to be confused with this contract, which is a different
document despite living at a similarly-numbered position because it was
created before that record; this contract does not choose a final
filename for that future record and defers to whatever numbering is
correct once it is actually written).

**Wave 0 is explicitly read-only (hardening correction F-2).** Unlike
Waves 1–10, Wave 0 (implementation plan Section 8) creates no production
file, creates no test file, and modifies no existing file. Wave 0 may
only inspect the repository, verify the frozen baseline, and produce
command evidence in the mission's own report — nothing it does is ever
persisted to a new or existing file. The generic Definition of Ready
(Section 8) and Definition of Done (Section 9) below remain fully
applicable to Wave 0 without implying any file creation: for Wave 0,
"every file the Wave's own specification lists under 'Files to create'"
and "every test file the Wave's own specification lists" are both the
empty set, per implementation plan Section 8's own Wave 0 entry, so
those Definition-of-Done items are satisfied trivially, not skipped.
Completing Wave 0 confirms the repository matches this contract's own
recorded baseline (Section 4) and that no approved file already exists
prematurely — **it does not by itself authorize Wave 1 or any later
Wave.** Authorization to begin Wave 1 (or any Wave) is always a
separate, explicit act (Section 8, item 6; Section 27), never an
automatic consequence of the prior Wave's own completion.

## 3. Authority hierarchy

Five tiers, strictly ordered, each binding on everything below it
(hardening correction F-1 — previously four tiers, with the last two
merged; now split into their own distinct tiers):

1. **`docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`**
   (the architecture plan) — the sole source of *what* Increment 10 is:
   canonical models, provider abstraction, state matrix, HTTP mapping,
   evidence identity, file placement. Frozen at commit `9dc6f02`, tag
   `genesis-phase-2-increment-10-plan-v1`.
2. **`docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`**
   (the implementation plan) — the sole source of *how* Increment 10 is
   built: the 11-wave sequence, the file-by-file specification, the
   dependency graph, the test matrix, the risk register. Frozen at commit
   `92d8b5f`, tag `genesis-phase-2-increment-10-implementation-plan-v1`.
   Every decision in this document is itself already bound by tier 1; it
   introduces no architecture of its own.
3. **This document** (the implementation contract) — the sole source of
   *the rules of engagement* while executing tier 2: readiness/done
   criteria, checklists, git policy, AI collaboration boundaries, audit
   trail requirements, stop conditions. It invents no new "what" or "how"
   — only "under what discipline." Bound by tiers 1 and 2.
4. **Wave-specific execution instructions** — the specific mission
   prompt that authorizes and scopes one Wave's work (e.g. "begin Wave
   0," "correct finding F-2"). A wave-specific instruction may **narrow**
   what is done in a given moment (which wave, which finding, which
   files) — it may never **override** tiers 1–3. An instruction that
   would require contradicting the architecture plan, the implementation
   plan, or this contract is not a valid instruction to silently follow;
   it is a stop condition (Section 18), to be reported back before any
   action is taken, exactly as this project's own established pattern
   already requires (e.g. this contract's own creation was itself scoped
   by a wave-specific instruction bound by tiers 1–3, never permitted to
   invent architecture).
5. **Code and tests** — the actual files a Wave produces. Code and tests
   are **implementation evidence only** — proof that tiers 1–4 were
   correctly followed, never an independent source of architectural or
   governance truth. Code and tests are always checked *against* tiers
   1–3 (Section 20's traceability matrix, Section 9's Definition of
   Done); they never get checked the other way around, and a passing
   test suite never by itself justifies a decision that contradicts a
   higher tier. **Any contradiction discovered between code/tests and a
   higher-authority artifact means the code/tests are wrong** — never
   grounds to reinterpret, "clarify," or quietly amend the architecture
   plan, the implementation plan, or this contract. Such a contradiction
   is itself a stop condition (Section 18).

No tier may reinterpret a higher tier. A Wave that believes a higher-tier
document is wrong, incomplete, or inconsistent with the real repository
does not improvise a fix — it stops and reports (Section 18). Lower-tier
artifacts (a wave prompt, a piece of code, a test) can never silently
amend a higher-tier artifact (this contract, the implementation plan, the
architecture plan) — any actual amendment to a higher tier follows
Section 19's change-control process, never an implicit reinterpretation
discovered mid-Wave.

## 4. Frozen references

| Reference | File | Commit | Tag |
|---|---|---|---|
| Architecture plan | `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md` | `9dc6f02` | `genesis-phase-2-increment-10-plan-v1` |
| Implementation plan | `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md` | `92d8b5f` | `genesis-phase-2-increment-10-implementation-plan-v1` |
| Prior increment baseline (frozen, unaffected) | Increment 9 (Site Intelligence Aggregator) | `b49457d` | `genesis-phase-2-increment-9-v1` |

**Architecture decisions are frozen.** Every decision recorded in the
architecture plan — the five-value `SatelliteAggregateStatus`, the
neutral async provider port, the `EvidenceId` formula, the HTTP/
retryability/diagnostic mapping, the file/directory placement, the
truthfulness guarantees — is final for this increment. No Wave may
reinterpret, narrow, broaden, or "improve" any of them.

**Implementation decisions are frozen.** Every decision recorded in the
implementation plan — the 11-wave sequence and each wave's exact file
list/dependencies/gate, the per-file allowed/forbidden imports, the
single-owner exception model (legacy-copernicus-provider.ts never
rejects; the orchestrator's own catch is a narrower defensive fallback
only), the Wave-2-only ownership of missing-`sourceSceneId` exclusion,
the dependency graph, and the test matrix — is final for this increment.
No Wave may reinterpret them.

## 5. Governance principles

1. **Two-document authority, one contract.** Every "what" traces to
   document 29; every "how" traces to document 30; every "under what
   discipline" traces to this document. A Wave never needs to guess which
   document answers a given question — Section 3's hierarchy always
   resolves it.
2. **Evidence over assertion.** A Wave is not "done" because an
   implementer believes it is done — it is done when its Definition of
   Done (Section 9) is met and its checklists (Section 21) are filled
   with real, checkable evidence (command output, file existence, grep
   results), exactly as every prior increment in this project's history
   required.
3. **Small, reversible steps.** Waves stay small and independently
   gated (implementation plan Section 8) precisely so a failure is cheap
   to isolate and cheap to roll back (Section 17) — this contract does
   not permit collapsing, reordering, or batching waves to save time.
4. **No silent scope growth.** A Wave that discovers it needs a file, an
   import, or a behavior not already named in document 29 or 30 does not
   add it — it stops (Section 18) and requests explicit, separate
   authorization (Section 19).
5. **Truth before completeness.** Every truthfulness guarantee
   (Section 12) is non-negotiable and takes priority over shipping a
   Wave on schedule — a Wave that can only pass its gate by weakening a
   truthfulness guarantee has failed its gate, not found a shortcut.

## 6. Architectural immutability rules

The following, and only the following, are the architecture-plan
decisions most likely to tempt a reinterpretation mid-implementation.
Each is restated here as a hard rule, not because this contract has
independent authority over it, but so no Wave can claim it was
unaware:

1. `SatelliteAggregateStatus` is exactly the five values `"complete" |
   "partial" | "unavailable" | "failed" | "notFound"`, derived by the
   architecture plan's Section 17.1 ordered rule. No sixth value, no
   renamed value, no reordering of the derivation rule.
2. The provider port (`SatelliteProviderPort`) is genuinely neutral —
   no `orbitDirection`/`polarization`/`relativeOrbit`/`CopernicusScene`-shaped
   field crosses it. No Wave may "temporarily" leak a legacy-shaped field
   through it for convenience.
3. `SatelliteTruthMetadata` is mandatory and non-optional on every
   non-`notFound` `SatelliteCapabilityOutcome`. No Wave may make it
   optional, defaulted, or conditionally omitted.
4. `EvidenceId` is exactly
   `satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>`.
   No alternate formula, no additional segment, no different hash.
5. The HTTP/retryability/diagnostic mapping (architecture plan Section
   15/17/21) is exhaustive and final. No Wave may introduce a status
   code, diagnostic code, or retryability classification not already in
   that table.
6. File/directory placement (architecture plan Section 23, restated in
   implementation plan Section 7) is final — the two-file `io/` split,
   the provider port's location in `intelligence-runtime/`, and every
   other path are not implementation-time preferences.
7. `persist=false` is a literal, never a variable, at every
   `copernicusForSite` call site. Only
   `services/intelligence-adapters/io/legacy-copernicus-provider.ts` may
   import `services/copernicus-engine.ts`/`services/copernicus-truth.ts`.
8. Increment 9 (Data Trust, Evidence Center, Site Intelligence
   Aggregator, and their routes/handlers/orchestrators) is frozen at
   `b49457d` and must remain byte-identical throughout Increment 10.

## 7. Implementation immutability rules

The following implementation-plan decisions are equally final:

1. The 11-wave sequence and ordering (implementation plan Section 16) —
   `Wave 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10`, strictly linear, no
   reordering, skipping, or merging without a new, explicit authorization.
2. The exact 13-file production inventory and 11-file test inventory
   (implementation plan Section 7) — no thirteenth-plus production file,
   no twelfth-plus test file, no renamed file, without a new, explicit
   authorization.
3. The single-owner exception model (implementation plan Section 9.5/9.10,
   hardening F-1): `legacy-copernicus-provider.ts`'s `fetch()` never
   rejects — any exception from `copernicusForSite` is caught locally and
   resolved as `{kind:"unavailable", reason:"unexpected_error"}`. The
   orchestrator's own `try`/`catch` is a narrower, distinct defensive
   fallback for provider-contract violations, wiring failures, or the
   orchestrator's own composition-logic exceptions only — never a second,
   competing owner of the normal case.
4. Missing-`sourceSceneId` exclusion belongs exclusively to Wave 2
   (`satellite-observation-adapter.ts`, implementation plan Section 9.6) —
   never to Wave 6 (`satellite-projection-adapter.ts`, which has no
   missing-id responsibility of any kind) or any other file.
5. The dependency graph (implementation plan Section 10, as corrected)
   — every static import edge, the `IMPORTER -> IMPORTED MODULE`
   convention, and the distinct labeling of dynamic imports and runtime
   composition — governs which file may import which. No Wave may add an
   import not already present in that graph and in the corresponding
   per-file "Allowed imports" list (Section 9) without a new, explicit
   authorization.
6. The test matrix (implementation plan Section 11) and quality-gate
   sequence (Section 12) are final — no category may be dropped, and no
   gate may be skipped or reordered.
7. `satellite-fake-provider.ts` remains classified exactly as document
   29/30 state: one of the 13 production files, shipped in the
   production source tree, exclusively deterministic test support, never
   imported by `satellite-intelligence-orchestrator-instance.ts`.
8. **Auth-first dynamic import is frozen (hardening correction F-3;
   implementation plan Section 9.13, mirroring Increment 9's own
   identical, already-hardened convention).** Authentication
   (`requireAdminAuth`) must complete successfully before the dynamic
   `import()` of `satellite-intelligence-orchestrator-instance.ts` is
   ever reached. `app/api/intelligence/satellite/site/route.ts` must not
   statically import the orchestrator instance at module top level —
   only a dynamic `import()` call, placed strictly after the auth check
   returns successfully, inside `GET`, is permitted. No provider,
   database, or satellite-runtime dependency (the orchestrator instance,
   either `io/` file, or the legacy Copernicus engine, transitively) may
   be loaded — resolved, imported, or otherwise reached — before the auth
   gate succeeds. This ordering is frozen by documents 29 and 30 and may
   not be weakened, reordered, or made conditional by any Wave; no Wave
   may introduce any new authentication behavior beyond what those two
   documents already specify (`requireAdminAuth`, reused verbatim, with
   no new mechanism).

## 8. Definition of Ready (per Wave)

A Wave may begin only when **all** of the following hold:

1. The immediately preceding Wave's own Definition of Done (Section 9)
   is fully satisfied and its Wave-level checklist (Section 21) is
   complete.
2. `git status --short` shows a clean tree except for files this Wave's
   own predecessor(s) legitimately created; `git diff --check` is clean.
3. `git rev-parse --short HEAD` and `git tag --points-at HEAD` still
   match the frozen baseline this contract records (Section 4), unless a
   new, explicit freeze has occurred and been recorded via an update to
   this contract's own audit trail (Section 24) — never silently assumed.
4. The Wave's own file list, dependencies, responsibilities, non-goals,
   and pass/fail gate (implementation plan Section 8, per wave) have been
   re-read in full immediately before starting — not recalled from
   memory.
5. No open Critical/High/Medium finding exists against any file this
   Wave will touch, from any prior review of this increment.
6. Explicit authorization to begin this specific Wave has been given
   (Section 19) — a Definition-of-Ready pass does not itself authorize
   starting; it only confirms starting would be safe once authorized.

## 9. Definition of Done (per Wave)

A Wave is done only when **all** of the following hold:

1. Every file the Wave's own specification (implementation plan Section
   8) lists under "Files to create" exists, matches its Section 9
   file-by-file specification exactly (purpose, allowed/forbidden
   imports, exports, sync/async behavior, side-effect policy, error
   behavior, truthfulness requirements), and no file outside that list
   was created or modified.
2. Every test file the Wave's own specification lists exists and passes.
3. The Wave's own exact "Commands" (implementation plan Section 8, per
   wave) were run, in order, and all passed.
4. The Wave's own exact "Pass/fail gate" (implementation plan Section 8,
   per wave) is objectively satisfied — not approximated.
5. `git status --short` shows only this Wave's own newly created files
   as untracked; no pre-existing file (including any Increment 9 file)
   changed.
6. `git diff --check` is clean.
7. The Wave's Implementation Checklist, Testing Checklist, and Review
   Checklist (Section 21) are complete and recorded in the audit trail
   (Section 24).
8. No Critical/High/Medium finding remains open against any file this
   Wave touched.

**Increment-level Definition of Done** (all 11 waves complete) is,
verbatim, the implementation plan's own Section 15 — this contract does
not restate or re-derive it; it only requires that every Wave's own
Definition of Done above be satisfied on the way there.

## 10. Coding contract

- **Determinism:** no `Date.now()`, `Math.random()`, or
  `crypto.randomUUID()` in any pure module; every clock is injected
  (`now: () => string`), matching every prior increment's own convention
  and the implementation plan's own per-file specifications.
- **No fabrication:** a value that cannot be honestly derived (a missing
  `sourceSceneId`, an unknown cloud-coverage percentage) is represented
  as `null`/excluded with a disclosed issue — never invented, defaulted
  to a plausible-looking value, or silently dropped without a recorded
  issue.
- **No premature abstraction:** implementation follows "no abstraction
  without a concrete need" (architecture plan's own repeatedly-cited
  Principle 17) — no speculative parameter, no unused extension point,
  no `Promise.all` for a single provider call.
- **No comments narrating this contract or the mission:** code comments,
  when needed at all, explain a non-obvious invariant or workaround —
  never "per the implementation contract" or "as required by Wave 3,"
  which belong in commit messages and the audit trail, not source code.
- **Exact signatures where document 30 pins them; implementer's choice
  only where document 30 explicitly says so** (e.g. Section 9's disclosed
  `lookbackDaysFromWindow` formula is pinned; a function's exact
  parameter name is not, per Section 9.6's own "exact signature decided
  at implementation time within this stated contract" disclosure).

## 11. Dependency contract

- Every import a file makes must appear in that file's own "Allowed
  imports" list (implementation plan Section 9) and in the dependency
  graph (Section 10). An import not listed in both is forbidden, full
  stop — not "probably fine."
- Only `services/intelligence-adapters/io/legacy-copernicus-provider.ts`
  may import `services/copernicus-engine.ts` or
  `services/copernicus-truth.ts`. Verified, every Wave from Wave 3
  onward, via `grep -rn "copernicus-engine\|copernicus-truth"
  services/intelligence-adapters/` returning exactly one matching file.
- Only `io/satellite-site-read-adapter.ts` and
  `io/legacy-copernicus-provider.ts` touch the database directly;
  `satellite-intelligence-orchestrator-instance.ts` touches it only
  transitively, through those two.
- `satellite-projection-adapter.ts` is synchronous; the provider port,
  `legacy-copernicus-provider.ts`, the orchestrator core, and the
  orchestrator instance are asynchronous — verified behaviorally
  (a real `Promise` is returned/awaited), not merely by type signature.
- No file under `services/**` imports `next` or `next/server`; only
  `app/api/intelligence/satellite/site/handler.ts` and `route.ts` may.
- No file under `services/**` calls `console.error`/`console.log`/
  `console.warn`; only `handler.ts` may.

## 12. Truthfulness contract

- `SatelliteTruthMetadata` (`dataReality: "simulated"`,
  `realSatelliteEvidence: false`, `sourceDisclosure` populated) is
  present and non-null on every non-`notFound` `SatelliteCapabilityOutcome`
  and every public envelope, in every code path — including the
  exception/`unavailable` path (implementation plan Section 9.5's
  hardening correction).
- `dataReality: "provider_sourced"` must never appear anywhere in this
  increment's code — no code path may set it, since no real satellite
  provider exists.
- `copernicusTruthMetadata()` (from `services/copernicus-truth.ts`) is
  the single, sole source `legacy-copernicus-provider.ts` derives
  `SatelliteTruthMetadata` from — never recomputed, re-derived, or
  hand-constructed elsewhere.
- `projectSatelliteIntelligenceResponse` copies `truthMetadata` verbatim,
  byte-for-byte, from the internal result — never re-derives it.
- A gap in legacy data (missing scene id, unknown cloud coverage, stale
  imagery) is disclosed via a `Limitation`/issue — never silently
  fabricated or silently dropped without a recorded issue.

## 13. Evidence contract

- One canonical `Evidence` record per successfully-adapted
  `SatelliteObservation` only — never for an excluded (missing-id)
  scene.
- `EvidenceId` is exactly
  `satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>`
  — `providerCode` trimmed and lowercased before embedding; deterministic
  across repeated calls with identical input; proven, by construction and
  by test, incapable of colliding with Evidence Center's own
  `evidence:<siteId>:COPERNICUS` format.
- `Evidence.reliability` is forced low (mirroring the
  `COPERNICUS_RELIABILITY = 0.1` precedent), regardless of the legacy
  validation score's own value, since the underlying data remains
  simulated.
- `Evidence.origin.source` is a satellite-specific `DataSourceId`,
  distinct from Evidence Center's own `"evidence-center"` value — the two
  evidence streams are never conflated.
- Evidence construction never touches the database, never persists, and
  never mutates its input.

## 14. Testing contract

- Every one of the 11 test files named in implementation plan Section 7
  is created and passes before its owning Wave's gate is considered
  satisfied (Section 9 above).
- Every test category in implementation plan Section 11's matrix is
  covered by the named concrete test file(s) with the named key cases —
  no category silently dropped, no test file repurposed to cover a
  different category than its row states.
- Determinism is mandatory: `satellite-fake-provider.ts` resolves
  immediately via `Promise.resolve`, never a real timer or real network
  call; any test that fails intermittently across two consecutive runs
  with no code change is a defect to fix, never a flake to retry past
  (implementation plan Section 13's "Test brittleness" risk row).
- Source-inspection tests (import-boundary sweeps, write-pattern sweeps,
  auth-ordering assertions) are run with comments stripped where the
  existing precedent test files strip them, and are checked against raw
  source (no stripping) where the existing `intelligence-runtime`
  source-boundary sweep precedent requires it (implementation plan
  Section 4) — a new file must never contain a forbidden literal
  substring even inside a comment, in that specific sweep's scope.
- Increment 9's own full test suite is run, unmodified, and must pass
  unmodified, at minimum in Wave 9 and again in Wave 10.

## 15. Review contract

- Every Wave's output is reviewed against this contract's Section 9
  Definition of Done before the next Wave may begin (Section 8, item 1).
- A review that finds a Critical, High, or Medium issue blocks
  progression to the next Wave until the issue is resolved and
  re-reviewed — mirroring this project's own established
  planning-review-hardening-re-review cycle, applied here at Wave
  granularity.
- A review never modifies a file itself — findings are reported, then
  corrected only under separate, explicit authorization to make that
  specific correction (mirroring the pattern already used for the
  architecture plan's and implementation plan's own hardening passes).
- A review's findings, verdicts, and any corrections applied are recorded
  in the audit trail (Section 24) — a verbal or unrecorded "looks fine"
  is not a review.

## 16. Merge contract

*(Applies once this repository's workflow introduces branch merges for
this increment's work; today's established pattern commits directly to
`master` after each freeze, so this section states the rule that governs
either case.)* No Wave's output may be merged/committed to `master`
ahead of an earlier, still-incomplete Wave. Each freeze commit (Section
22) contains only the files the freeze mission explicitly names — never
an unrelated file, never a partial Wave's files mixed with a later Wave's
files. A merge/commit is preceded by the full Definition of Done
(Section 9) for everything it contains, not a partial subset.

## 17. Rollback contract

- Each Wave's own "Rollback boundary" (implementation plan Section 8,
  per wave) is the authoritative scope of what may be reverted for that
  Wave's own failure — never a blanket `git reset --hard`/`git clean -fd`
  across waves, and never touching a file outside the failing Wave's own
  created-file list.
- Rollback of an unfrozen (uncommitted) Wave is a simple deletion of that
  Wave's own newly created files — git history is never altered.
- Rollback of a frozen (committed/tagged) Wave requires a new, explicit,
  separate authorization before any revert commit, tag deletion, or
  force-push is attempted — never performed unilaterally, and never via
  `git push --force`/`--force-with-lease`/`git tag -d` on an already-pushed
  tag without that explicit authorization.
- A rollback is itself logged in the audit trail (Section 24) with the
  reason, scope, and result.

## 18. Stop rules

Restates and extends implementation plan Section 14's own stop
conditions — this contract adds no new condition beyond what that
section already lists, but binds every Wave to check for them explicitly
before proceeding:

1. Frozen baseline changed without a recorded, separate re-freeze
   authorization.
2. A contradiction is discovered between document 29, document 30, this
   contract, or the real repository state.
3. Real legacy behavior (`copernicus-engine.ts`/`copernicus-truth.ts`)
   differs from what document 30's Section 4 audit recorded.
4. A file outside the approved 24-file inventory needs modification.
5. Any test under `tests/intelligence-increment-7-*`,
   `-increment-8-*`, `-increment-9-*`, or any Data Trust/Evidence
   Center/Site Intelligence Aggregator test fails.
6. A build or typecheck failure traces to a file outside the current
   Wave's own scope.
7. `persist=false` cannot be structurally guaranteed.
8. `SatelliteTruthMetadata` cannot be structurally guaranteed on every
   non-`notFound` result.
9. An ambiguity is found that this contract, document 29, or document 30
   does not already resolve (Section 23, AI Collaboration Contract).

**In any stop condition:** stop at the current Wave; do not improvise a
workaround or silent scope expansion; report the discrepancy precisely
(which condition, which file/test/command, observed vs. expected); do
not broaden scope or touch a file outside the approved inventory without
a new, explicit, separate authorization.

## 19. Change control process

**Governing model (hardening correction F-4, resolving the prior
ambiguity):** a frozen document — document 29, document 30, or this
contract once it is itself frozen — is never silently edited or
rewritten under its existing freeze baseline. "Applying a change to the
authorized document" never means quietly mutating the file that an
already-pushed tag points to; it always means the explicit, multi-step
process below, ending in a *new* commit and a *new* tag, with the prior
commit and tag left untouched.

When a change to document 29, 30, or 31 becomes necessary:

1. **Stop implementation immediately.** No Wave proceeds past the point
   the need for a change was discovered.
2. **Record the contradiction, defect, or newly discovered requirement**
   precisely — which document, which section, what was observed vs. what
   the frozen document says.
3. **Open a separately authorized planning-amendment mission.** A Wave
   mission's own authorization never doubles as amendment authorization
   — amending a frozen document is always its own, separate mission.
4. **The amendment method itself must be explicitly authorized before
   any edit is made**, choosing one of exactly two forms:
   - editing the existing Markdown file's content, landed in a **new**
     Git commit (the same mechanism this session has used throughout for
     documents 29 and 30's own hardening passes — the file's *content*
     changes, but only via a new commit, never by altering a commit that
     already exists and is already tagged/pushed); or
   - creating a new successor/amendment document, left for the user to
     choose when this form is preferred over the first.
   Neither form may be assumed by default — the choice belongs to the
   explicit amendment authorization in step 3/4, never inferred by a
   Wave or an AI collaborator.
5. **The previous commit and tag remain immutable historical baselines.**
   `9dc6f02`/`genesis-phase-2-increment-10-plan-v1` and
   `92d8b5f`/`genesis-phase-2-increment-10-implementation-plan-v1` (and
   this contract's own future freeze commit/tag, once created) are never
   altered, reset, or repointed by any amendment — they remain
   permanently dereferenceable exactly as they were at freeze time, for
   audit purposes.
6. **The changed planning state requires, in full, before execution may
   resume:** review of the change; correction of any finding the review
   raises; re-review; a new freeze commit; a new annotated tag; a push of
   both; and explicit reauthorization of execution referencing the new
   baseline — the identical planning → review → hardening → re-review →
   freeze cycle already used for documents 29 and 30 themselves in this
   session, applied again to whichever document changed.
7. **Forbidden, without exception:** force push, tag movement, tag
   replacement, history rewrite (`git rebase`/`git filter-branch`-style
   operations on already-pushed commits), or silent reuse of an old
   freeze tag to point at new content. An old tag always means exactly
   the content it pointed to when it was created.
8. **No Wave may resume until the new planning baseline is explicitly
   approved** — the mere existence of a new commit/tag is not itself
   that approval; a separate, explicit reauthorization (mirroring
   Section 8, item 6's per-Wave authorization requirement) is required.

No Wave, review, or AI collaborator may self-authorize a change under
any of these three documents, may choose which amendment form (in-place
new-commit edit vs. successor document) applies without that choice
being explicitly given, or may treat a passing review of the amendment
as sufficient without the full freeze-and-reauthorize sequence above.

## 20. Traceability matrix

| Concern | Authoritative section |
|---|---|
| Canonical models, truth metadata shape | Architecture plan §9 |
| Provider port, neutrality, async | Architecture plan §10 |
| Deterministic quality/freshness rules | Architecture plan §12 |
| Request/response contracts | Architecture plan §13/15 |
| State matrix | Architecture plan §17 |
| Observability/diagnostics | Architecture plan §21 |
| File inventory | Architecture plan §23; Implementation plan §7 |
| Wave sequence and gates | Implementation plan §8/16 |
| Per-file allowed/forbidden imports | Implementation plan §9 |
| Dependency graph | Implementation plan §10 |
| Test matrix | Implementation plan §11 |
| Quality gates | Implementation plan §12 |
| Risk register | Implementation plan §13 |
| Stop rules | Implementation plan §14; this contract §18 |
| Definition of Done (increment-level) | Implementation plan §15 |
| Readiness/Done (Wave-level), checklists, audit trail | This contract §8/9/21/24 |
| AI collaboration boundaries | This contract §23 |
| Freeze/release/production gating | This contract §25/26/27 |

## 21. Governance matrix

| Role | May | May not |
|---|---|---|
| Any Wave implementer (human or AI) | Create exactly the files their Wave specifies; run gates; report findings | Modify document 29/30; modify a frozen file; expand scope; stage/commit/tag/push without explicit authorization |
| Reviewer (human or AI) | Read, run gates, classify findings, report | Edit any file while reviewing; self-authorize a correction |
| Freeze executor | Stage/commit/tag/push exactly the files an explicit freeze mission names | Freeze anything not explicitly named; force-push; skip verification steps |
| User | Authorize scope changes, corrections, freezes, and Wave starts | — |

**Checklists required per Wave** (recorded in the audit trail, Section
24): Definition-of-Ready checklist (Section 8), Implementation checklist
(files created match Section 9 file-by-file spec), Testing checklist
(every named test file created and passing), Review checklist (findings
classified, Critical/High/Medium = 0), Approval checklist (explicit
authorization recorded before the next Wave begins).

## 22. Git policy

- Every commit follows this project's own established Git Safety
  Protocol: no `git push --force`/`--force-with-lease` without explicit
  authorization; no `git reset --hard`/`git clean -fd` without explicit
  authorization; never skip hooks (`--no-verify`) or bypass signing;
  always create new commits rather than amending, unless explicitly
  instructed otherwise; stage specific files by name, never `git add -A`/`.`.
- Nothing is staged, committed, tagged, or pushed except under an
  explicit, separate freeze/release mission — implementation Waves 0–10
  themselves never stage, commit, tag, or push (mirroring the exact
  discipline already used throughout this increment's planning phases).
- Every freeze commit message and tag name is specified exactly by the
  authorizing mission — never improvised.
- `git status --short`/`git diff --check` are run before and after every
  file-creating operation, every Wave, without exception.

## 23. AI Collaboration Contract

- **AI may explain.** Describing what a frozen document says, what a
  file does, or why a decision was made is always permitted.
- **AI may implement.** Writing the exact files a Wave's Definition of
  Ready authorizes, exactly as specified in document 30's Section 9, is
  permitted once that Wave is explicitly authorized to begin.
- **AI may refactor only inside approved boundaries.** A refactor is
  permitted only within a single already-authorized file, only to
  correct a defect against that file's own specification — never to
  "improve," generalize, or restructure beyond what the specification
  requires.
- **AI may never redefine frozen architecture.** No AI collaborator may
  alter, reinterpret, or silently work around any decision in document
  29 or document 30, regardless of how the AI itself judges the decision
  once implementation reveals a difficulty.
- **AI may never invent behavior.** Any field, function signature detail,
  error path, or test case not already specified by document 29 or 30 is
  either (a) genuinely left open by those documents as an implementer's
  free choice within a stated contract (rare, and only where explicitly
  disclosed, e.g. implementation plan Section 9.6's signature note), or
  (b) a stop condition (Section 18, item 9) — never silently decided.
- **AI must stop on ambiguity.** When document 29, document 30, and the
  real repository do not together resolve a question unambiguously, the
  AI stops, states the ambiguity precisely, and waits for explicit
  resolution — it never guesses, defaults, or proceeds "reasonably."
- **AI never self-authorizes scope, staging, commits, tags, or pushes**
  beyond what the current, explicit mission instruction states.

## 24. Audit trail policy

Every Wave leaves, at minimum, the following record (in the mission
report that closes that Wave, not as separate files unless a future
mission explicitly requests a persisted log):

- **Implementation Log:** exactly which files were created/modified,
  with a one-line summary of each.
- **Review Log:** what was checked, against which section of document 29/30/this
  contract, and the result.
- **Corrections:** any finding raised and the exact, minimal correction
  applied (or "no change needed").
- **Re-review:** confirmation that a corrected Wave was re-checked before
  being considered done.
- **Freeze:** commit hash and tag name, when a freeze occurs.
- **Commit:** the exact commit message used.
- **Tag:** the exact tag name and annotation used.
- **Approval:** the explicit authorization that permitted the Wave to
  begin and the explicit confirmation that closed it.

No Wave is considered complete without all eight elements present in its
closing report.

## 25. Release gate

Increment 10 may be released (i.e. its freeze commit/tag created) only
when:

1. All 11 Waves' Definitions of Done (Section 9) are individually
   satisfied.
2. The increment-level Definition of Done (implementation plan Section
   15) is satisfied in full.
3. `npx tsc --noEmit`, `npm test`, `npm run build`, `git diff --check`
   all pass, in that order, against the full repository.
4. `git status --short` shows exactly the 24 approved new files as
   untracked (or, post-staging, as the sole staged set) — nothing else.
5. Zero Critical/High/Medium findings remain open anywhere in the
   increment.
6. Increment 9's own full test suite still passes, unmodified.
7. A separate, explicit freeze authorization has been issued, naming the
   exact commit message and tag.

## 26. Production gate

Increment 10 reaching production (i.e. being deployed/exposed on a real
running environment, distinct from being merged/frozen in git) requires,
in addition to the Release Gate (Section 25):

1. A separate, explicit production-deployment authorization — freezing
   this increment's code in git is never itself a deployment action.
2. Confirmation that `app/api/intelligence/satellite/site/route.ts` is
   registered exactly once in a real `next build` output, matching the
   same check every prior increment's own freeze required.
3. Confirmation that no environment-specific configuration (secrets,
   provider credentials) is required for this increment to run — none
   exist to configure, since the underlying provider remains the
   simulated legacy engine; this fact must be re-verified true at
   deployment time, not merely assumed from document 29's own disclosure.
4. Confirmation that `config/capabilities.json` and every canonical
   engine manifest remain byte-identical to their pre-Increment-10 state.

## 27. Final authorization policy

This contract does not itself authorize any implementation. Consistent
with Section 3's authority hierarchy and every prior stage of this
increment's own lifecycle (architecture plan → independent review →
hardening → final re-review → freeze; implementation plan → review →
hardening → final re-review → freeze), a future, separate, explicit
mission must:

1. Reference this contract by its own exact frozen commit/tag (once this
   document is itself frozen — a separate, future freeze mission, not
   part of this one).
2. Name exactly which Wave(s) are authorized to begin (Wave 0 at
   minimum, per the implementation plan's own freeze report — "Wave 0
   Authorized: YES, Wave 1 Authorized: NO").
3. Restate that this contract's rules (Sections 6–19 in particular)
   remain in force for the authorized Wave(s).

Until such a mission is issued, no production or test file listed in
either frozen document's inventory may be created.

## Implementation Contract Review Hardening

| Finding | Status | Corrected section | Resolution |
|---|---|---|---|
| F-1 | RESOLVED | 3 | Five-tier authority hierarchy — the previous four-tier structure (which merged "wave-specific execution instructions" and "code and tests" into one combined tier) is split into five explicit tiers. Tier 4 (wave-specific execution instructions) may narrow scope but never override tiers 1–3; tier 5 (code and tests) is stated explicitly as implementation evidence only, never a source of architectural or governance truth, with any code/test-vs-higher-tier contradiction meaning the code/tests are wrong. |
| F-2 | RESOLVED | 2 | Wave 0 is now explicitly stated as read-only: creates no production file, no test file, modifies no existing file, only inspects/verifies/reports. The generic Definition of Ready/Done is confirmed to still apply via vacuous satisfaction of the (empty) file/test lists, and Wave 0's completion is stated not to authorize Wave 1 or any later Wave by itself. |
| F-3 | RESOLVED | 7 | A new item 8 states auth-first dynamic import as a frozen, immutable rule: `requireAdminAuth` must succeed before the dynamic `import()` of the orchestrator instance; `route.ts` must never statically import it; no provider/database/satellite-runtime dependency may load before the auth gate succeeds; no new authentication mechanism may be introduced. |
| F-4 | RESOLVED | 19 | The ambiguous "the change is applied to the one authorized document only" is replaced with an explicit 8-step governing model: stop, record, open a separate amendment mission, explicitly choose between an in-place-edit-via-new-commit or a successor document (never assumed), leave prior commits/tags immutable, run the full review→correction→re-review→freeze→tag→push→reauthorization cycle, and forbid force push/tag movement/history rewrite/silent tag reuse. No Wave may resume until the new baseline is explicitly approved. |

No architectural decision from `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
or implementation decision from
`docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
was changed by this hardening pass — every correction above was applied
exclusively to this contract's own governance text (authority-tier
structure, Wave 0's scope statement, one restated immutable rule already
implied by the frozen documents, and the change-control model's own
precision). No production file, test file, or either frozen planning
document was touched.
