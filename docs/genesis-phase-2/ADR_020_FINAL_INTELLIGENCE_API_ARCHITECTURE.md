# ADR-020 — Final Intelligence API Architecture

## 2. Status

Accepted

## 3. Date

2026-07-17

## 4. Decision owners

Genesis Phase 2 Architecture

## 5. Context

Increment 7 introduced and froze the first canonical Intelligence capability
route: `GET /api/intelligence/data-trust/site?id=<siteId>`. Its response
contract (`DataTrustCanonicalEnvelope`) is immutable for future increments
unless a separately approved versioning decision explicitly replaces it —
modifying it in place, or retrofitting new fields into it to serve an
unrelated capability, would break the exact guarantee Increment 7 was built
to prove: that a canonical route can be added additively, without disturbing
anything that already depends on it (Principle 4, ADR-015).

Increment 8 is expected to introduce a second canonical Intelligence
capability route: `GET /api/intelligence/evidence-center/site?id=<siteId>`.
The Increment 8 architectural audit (read-only, this repository, prior
session) established that `evidenceCenterForSite()` already produces an
`evidences` array structurally compatible with `LegacyEvidenceItem`, that the
existing, unmodified canonical Evidence Adapter (Increment 5) can consume
that shape directly, that Increment 8 should introduce its own read adapter,
orchestrator, projection, and authenticated route, that it must not retrofit
or mutate the frozen Increment 7 response, that Evidence is a supporting
canonical capability rather than automatically a new mission `EngineId`, and
that canonical routes must continue to wrap legacy engines rather than
rewrite them (Principle 2).

With two canonical capabilities about to exist side by side, three questions
become unavoidable and must be answered once, architecturally, rather than
re-litigated informally at the start of every future increment:

- **Modifying a frozen contract is unacceptable.** Once a capability route
  ships and is tagged, any future increment that needs a different shape
  must add a new, additive thing — a new route, a new envelope version, or a
  new aggregation layer — never silently reshape what already exists and may
  already have callers.
- **A single monolithic Intelligence endpoint now would create premature
  coupling.** Collapsing Data Trust and Evidence (and every future
  capability) into one endpoint today would force every capability's
  adaptation/projection/versioning/error-handling to evolve in lockstep, for
  a scale (two capabilities, about to become three or four) that does not
  yet demonstrate any need for that coupling — the same "no abstraction
  without a concrete consumer" reasoning `05_ORCHESTRATION_MODEL.md` and
  Principle 17 already apply elsewhere in this project.
- **Capability-only routes with no future aggregation model would eventually
  fragment consumers.** A UI or external caller that legitimately wants "the
  whole site intelligence picture" would otherwise be forced to make N
  separate authenticated calls, N times, forever, with no architecturally
  sanctioned path to a consolidated view — a real, foreseeable future need
  this ADR should not pretend doesn't exist, even though it is explicitly
  not being built yet.

## 6. Decision drivers

- Contract stability
- Capability isolation
- Independent testability
- Legacy containment
- Additive evolution
- Deterministic behavior
- Authentication consistency
- Observability
- Performance control
- Partial-failure handling
- Future UI and external API needs
- Avoidance of a distributed monolith inside one HTTP envelope

## 7. Considered options

### Option A — Independent capability routes only

**Advantages:** simplest mental model; each capability is fully isolated;
no shared aggregation machinery to design, build, or keep correct; matches
exactly what Increments 7 and 8 already do.
**Disadvantages:** no architecturally sanctioned path to a consolidated
"whole site" view; a consumer needing several capabilities must orchestrate
N authenticated calls itself, outside this system's control; no growth path
without ad hoc, uncoordinated per-consumer aggregation.
**Architectural risks:** informal, inconsistent aggregation logic re-invented
by each consumer (UI, external integration) instead of once, correctly, here.
**Migration implications:** none — this is the current state; choosing this
option permanently would require a future ADR to introduce aggregation
later anyway, at higher cost once consumers have already built their own
ad hoc workarounds.

### Option B — One monolithic Intelligence endpoint only

**Advantages:** one call for a consumer that wants everything; one envelope
to document.
**Disadvantages:** couples every capability's release cadence, versioning,
and error handling together; a bug or slow dependency in one capability can
degrade or fail the entire endpoint; makes independent testability and
capability isolation materially harder; forces premature agreement on a
combined schema before even two capabilities' real shapes are proven in
production; effectively asks Increment 8 (or whichever increment builds
this) to also design and freeze an aggregation contract it has no evidence
yet to design well.
**Architectural risks:** becomes "a distributed monolith inside one HTTP
envelope" — the exact anti-pattern this decision explicitly avoids; a single
point of contract-versioning contention across otherwise-unrelated
capabilities.
**Migration implications:** would require decomposing back into capability
routes later if any of the disadvantages above materialize in practice — a
strictly more expensive path than starting decomposed and adding
aggregation additively.

### Option C — Capability routes plus a future aggregation endpoint

**Advantages:** capability routes remain simple, isolated, independently
testable, and permanent (Option A's benefits, fully preserved); a
consolidated view becomes possible without coupling capabilities to each
other, only to a separate, thin aggregation layer that depends on them, not
the reverse; the aggregation layer can be deferred until real evidence
(two or more real capabilities, real consumer demand) justifies its design,
consistent with Principle 17.
**Disadvantages:** more total files/routes over time than Option A alone;
some infrastructure (auth, projection scaffolding, route/handler split) is
necessarily repeated per capability until/unless a shared library for that
scaffolding is later extracted.
**Architectural risks:** if the aggregation layer is ever built carelessly,
it could accidentally re-introduce Option B's coupling problems one level up
— mitigated by the dependency rules and non-goals recorded below (Sections
11, 14, 21).
**Migration implications:** none required now; the aggregation layer is
additive when/if it is eventually built, and its prerequisites (Section 22)
are explicit and checkable rather than a matter of judgment at that time.

## 8. Accepted decision

**Option C is accepted.** The final Intelligence API architecture is a
layered, federated model: stable, independent capability routes (Layer 1,
permanent) plus an additive, future aggregation endpoint (Layer 2, not
authorized for implementation by this ADR).

## 9. Final route taxonomy

Canonical naming convention:

```
/api/intelligence/<capability>/<subject>
```

For site-scoped GET routes, the current convention remains:

```
/api/intelligence/<capability>/site?id=<siteId>
```

Examples already frozen or planned: `/api/intelligence/data-trust/site`
(Increment 7, frozen), `/api/intelligence/evidence-center/site` (Increment
8, planned). Possible future capability examples —
`/api/intelligence/recommendation/site`, `/api/intelligence/risk/site`,
`/api/intelligence/context/site` — are architectural possibilities named
here for taxonomy illustration only, not authorization to implement them.

The future aggregator may use:

```
/api/intelligence/site?id=<siteId>
```

This ADR does not redesign any already-frozen route, and does not introduce
path parameters (e.g. `/api/intelligence/data-trust/sites/{id}`) as a
required migration for any existing or planned route — the `?id=` query
convention, already established by Increment 7 and adopted by Increment 8,
continues unchanged.

## 10. Capability contract ownership

Each capability owns:

- its outer read adapter
- its pure canonical adapters
- its orchestrator
- its projection
- its schema version
- its error mapping
- its tests
- its architecture document

The aggregation layer owns only:

- orchestration across capabilities
- request-scoped coordination
- aggregate timeout policy
- partial-result policy
- aggregate response projection
- aggregate observability

**Terminology clarification (see Section 17 of this ADR's consistency
audit reporting, and the note below):** "its orchestrator," as used here, is
the minimal, single-use-case, dependency-injected request orchestrator
pattern Increment 7 established (`ADR-016`) — not the full, generic,
cross-engine `IntelligenceOrchestrator` `05_ORCHESTRATION_MODEL.md`/`ADR-005`
describes. See Section 11's note for how these two concepts are reconciled,
not contradicted.

## 11. Dependency rules

Mandatory dependency direction, per capability:

```
Legacy Engine
    ↓
Outer Read Adapter
    ↓
Canonical Adapter
    ↓
Capability Orchestrator
    ↓
Capability Projection
    ↓
Capability Route
```

Future aggregation flow:

```
Capability Orchestrator / Canonical Application Service
    ↓
Aggregation Orchestrator
    ↓
Aggregate Projection
    ↓
Aggregate Route
```

**Prohibited, unconditionally:**

- Aggregate Route → Legacy Engine
- Route → Database
- Projection Adapter → Database
- Pure Adapter → Database
- Capability A → Capability B HTTP route
- Internal orchestration through HTTP calls inside the same application
  (the aggregator must call in-process canonical services/orchestrators
  directly — never `fetch()` its own routes)

**Reconciliation note on orchestration (ADR-005 / ADR-016 consistency,
recorded here rather than left implicit):** `05_ORCHESTRATION_MODEL.md`
and `ADR-005` decide that the eventual, full, cross-engine
`IntelligenceOrchestrator` — the one responsible for dependency resolution,
stage sequencing, and failure isolation across the entire canonical engine
graph — must be a single, generic instance, not one per bounded context.
`ADR-016` (Increment 6.5) narrowed this for Increment 7's actual delivery: a
*minimal*, single-use-case orchestrator, explicitly not that full model, with
its own recorded revisit trigger ("the moment a second canonical route/use
case needs orchestration, generalize... rather than writing a second
one-off"). This ADR's "each capability owns its orchestrator" language
(Section 10) is **not** a decision to permanently multiply full,
generic-orchestrator-class infrastructure per capability, and does not
supersede ADR-005. It records the practical reality that, at this stage,
each capability's *thin, DI-based request-wiring* module (Increment 7's
`intelligence-orchestrator.ts` shape) is built independently, because only
one such module has ever been built before Increment 8. Whether Increment
8 generalizes Increment 7's existing orchestrator or builds a second minimal
one is an implementation-time decision for Increment 8 itself, not fixed by
this ADR — but whichever path Increment 8 takes, both remain "capability
orchestrators" in this ADR's sense, and both are expected to eventually
converge toward `05_ORCHESTRATION_MODEL.md`'s single generic model once a
third or later capability's needs make the shared shape clear (Principle
17: generalize from evidence, not in advance of it). No prior ADR requires
supersession; this note exists to make an otherwise-implicit reconciliation
explicit.

## 12. Response independence

- Each capability response has its own `schemaVersion`.
- The aggregate response (once built) has its own, separate `schemaVersion`.
- A change to the aggregate response does not imply a capability contract
  change.
- A change to one capability must not silently alter another capability.
- Frozen capability contracts (Increment 7's `DataTrustCanonicalEnvelope`,
  and Increment 8's evidence envelope once frozen) remain stable
  independently of one another and of the aggregate envelope's own evolution.

## 13. Aggregated envelope concept (conceptual only — not an Increment 8 contract)

```
{
  "schemaVersion": "1.0",
  "siteId": "...",
  "snapshot": { ... },
  "context": { ... },
  "capabilities": {
    "dataTrust": {
      "status": "available",
      "result": { ... }
    },
    "evidence": {
      "status": "available",
      "result": { ... }
    }
  },
  "issues": [],
  "generatedAt": "..."
}
```

This shape is illustrative only, to anchor the architectural conversation.
It is not a TypeScript interface, not a frozen schema, and not an Increment
8 (or any currently-approved increment's) implementation contract. Its exact
fields, naming, and semantics remain open until the aggregator is actually
scoped, under its own dedicated design document, at the time its
prerequisites (Section 22) are satisfied.

## 14. Partial-failure policy (future, not authorized for implementation now)

- Capability endpoints fail according to their own already-defined contracts
  (each capability route's own error mapping table, e.g. Increment 7's
  400/404/422/500 scheme).
- The future aggregate endpoint may return successful partial data when one
  *optional* capability fails.
- Every capability entry in the aggregate response must expose an explicit
  state such as `available`, `unavailable`, `failed`, `notApplicable`, or
  `planned` — never an ambiguous, ungoverned absence.
- Failures must never be silently converted into empty successful results;
  an unavailable capability must be disclosed as unavailable, not omitted or
  defaulted.
- Which capabilities are *required* versus *optional* for the aggregate
  endpoint to still return a 200 must be explicitly defined and approved
  before the aggregator is implemented — not decided ad hoc during its
  build.
- **No partial-failure behavior is authorized for implementation by this
  ADR alone.** This section records intent for a future, separately-approved
  design, not a specification to build against today.

## 15. Snapshot strategy

- Capability routes may independently derive the same deterministic site
  Snapshot (each capability's own outer adapter fetches the site row it
  needs and derives a Snapshot from it, per `ADR-017`'s minimal Snapshot
  Provider — already reused verbatim by Increment 7, and expected to be
  reused verbatim by Increment 8).
- A future aggregation orchestrator should derive or resolve one
  request-level Snapshot and pass it to participating capability
  orchestrators where their contracts allow dependency injection (both
  Increment 7's and Increment 8's orchestrators already accept an injected
  Snapshot-deriving dependency, so this is architecturally already possible,
  not a redesign).
- The aggregator must not combine capability outputs drawn from
  incompatible Snapshots without explicitly disclosing the mismatch in the
  aggregate response.
- Snapshot unification (or an explicit, disclosed decision not to unify) is
  a prerequisite for implementing the aggregate route (Section 22).

## 16. Authentication and authorization

- All canonical Intelligence routes remain authenticated.
- Authentication must execute before any dynamic production import and
  before any database access — the exact ordering Increment 7's own
  post-audit required-fix pass established and verified (auth check first,
  dynamic `import()` of DB-touching wiring only after success).
- The current admin-level shared-secret guard (`requireAdminAuth`,
  Increment 0) may remain in place temporarily for every capability route,
  including Increment 8's.
- Finer-grained, capability-scoped authorization (matching
  `10_SECURITY_BOUNDARY.md`'s richer role vocabulary) remains future work,
  not required by this ADR.
- The future aggregator must not weaken the authorization already required
  by any underlying capability it orchestrates — it may only be at least as
  strict, never more permissive.

## 17. Performance policy (future, not authorized now)

A future aggregator must define, before implementation:

- per-capability timeout
- total request timeout
- concurrency limits
- cancellation behavior
- cache policy, if any
- maximum capability fan-out
- response-size limits

**Caching is not authorized in Increment 8** or by this ADR for any existing
or planned capability route.

## 18. Observability policy (future, not implemented by this ADR)

Future canonical observability must be able to distinguish, at minimum:

- route
- capability
- orchestration stage
- duration
- partial failure
- adapter limitation
- snapshot
- schema version

This ADR records the requirement; it does not add telemetry, logging
fields, or an event-emission implementation.

## 19. Manifest and capability registry policy

- An API capability route is not automatically a canonical `EngineId`.
- Evidence remains a supporting canonical capability (per
  `08_ADAPTER_STRATEGY.md`'s adapter-category taxonomy and the Increment 8
  architectural audit's own finding that "evidence" is not among the eleven
  mission-named `CANONICAL_ENGINE_IDS`), unless a separate, dedicated ADR
  explicitly promotes it to a mission engine in its own right.
- Increment 8 must not add a new `EngineId` to
  `services/intelligence-runtime/canonical-engine-manifests.ts` merely
  because it adds a route.
- Planned engine manifests (`data-trust`, `confidence`, `recommendation`,
  all currently `status: "planned"`) remain unchanged unless independently
  approved by their own, separately-reviewed change.

## 20. Migration policy

- Legacy routes remain untouched during Genesis Phase 2 increments
  (Principle 4) — confirmed unchanged through Increments 7 and 8's own
  audits, and required to remain so going forward.
- Canonical capability routes are introduced additively, one capability at
  a time.
- Consumers may migrate capability by capability, at their own pace, once
  `13_MIGRATION_STRATEGY.md`'s stage-5/6 criteria are separately satisfied
  for each capability.
- No legacy route removal occurs without usage evidence, a compatibility
  plan, a defined deprecation period, and separate approval —
  `13_MIGRATION_STRATEGY.md`'s existing seven-stage process, unchanged by
  this ADR.
- The future aggregator does not automatically deprecate any capability
  route, and its existence is never grounds, by itself, to begin
  deprecating a capability route or a legacy route.

## 21. Increment 8 consequence

This ADR explicitly authorizes the planned Increment 8 architecture to
create:

```
GET /api/intelligence/evidence-center/site?id=<siteId>
```

as a peer capability route to the Increment 7 Data Trust route, following
the same pattern (outer read adapter, capability orchestrator, projection,
route/handler split, authentication ordering) already established and
corrected through Increment 7's own implementation and audit cycle.

Increment 8 must not:

- modify the Increment 7 Data Trust envelope;
- introduce the aggregate endpoint;
- connect `EvidenceId`s into Increment 7's Score or Recommendation
  contracts (deferred to a future, separately-scoped increment per the
  Increment 8 architectural audit's own "Future extensibility" note);
- activate new manifests;
- migrate callers;
- modify the legacy Evidence Center routes
  (`app/api/evidence-center/{site,export}/route.ts`).

## 22. Aggregator implementation trigger

Before `GET /api/intelligence/site?id=<siteId>` may be implemented, at
minimum the following must hold:

- two or more canonical capability routes frozen;
- common Snapshot behavior understood and either unified or its
  non-unification explicitly disclosed;
- capability error contracts stable;
- partial-failure policy approved (Section 14, formally, not just recorded
  as intent here);
- aggregate schema approved (a real design, not Section 13's conceptual
  sketch);
- performance budget defined (Section 17, formally);
- authorization behavior approved;
- a dedicated implementation increment approved.

The existence of the Data Trust and Evidence routes makes architectural
exploration of the aggregator appropriate — this ADR itself is part of that
exploration — but does not automatically authorize immediate aggregator
implementation.

## 23. Consequences

**Positive:**

- Frozen contracts remain stable.
- Capability development remains isolated.
- Consumers can request only what they need.
- Future unified experiences remain architecturally possible without being
  forced now.
- Failures are contained to the capability that produced them.
- Legacy dependencies stay behind adapters, never exposed directly.

**Negative:**

- More routes and files over time than a monolithic endpoint would have.
- Repeated authentication and projection infrastructure per capability
  until/unless a shared scaffolding library is later extracted.
- Possible repeated site lookups (each capability's own outer adapter
  fetches the site row it needs) before any aggregate orchestration exists
  to share that fetch.
- Increased documentation burden — one design document per capability.
- Eventual need for a shared orchestration abstraction once enough
  capabilities exist to make the shared shape clear.
- Potential Snapshot divergence across capabilities if not governed
  (Section 15).

## 24. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Endpoint proliferation | Fixed naming taxonomy (Section 9); each new capability route requires its own audit + ADR-referenced design doc, not ad hoc addition |
| Duplicate orchestration logic | Section 11's reconciliation note; revisit trigger from ADR-016 remains active — generalize once a third capability's needs make the shared shape clear |
| Inconsistent envelopes | Response independence (Section 12) — each capability versions itself, but the same envelope *shape conventions* (schemaVersion, snapshot, context, adaptation/issues) are expected to be followed by every new capability, by convention, not by a shared type today |
| Snapshot mismatch | Section 15 — no combination across incompatible Snapshots without disclosure; unification is an explicit aggregator prerequisite |
| Internal HTTP coupling | Section 11's explicit prohibition — aggregator must use in-process services, never internal `fetch()` |
| Accidental contract mutation | Section 21's explicit non-goal for Increment 8; same discipline expected of every future capability increment |
| Aggregation latency | Section 17's future performance policy (timeouts, fan-out limits, cancellation) — required before aggregator implementation, not optional |
| Capability authorization mismatch | Section 16 — aggregator may never be more permissive than its weakest underlying capability |
| Partial-result ambiguity | Section 14's explicit per-capability state vocabulary (`available`/`unavailable`/`failed`/`notApplicable`/`planned`) — no silent omission permitted |

## 25. Non-goals

This ADR does not:

- implement Increment 8;
- create the aggregate endpoint;
- alter Increment 7;
- alter legacy routes;
- activate manifests;
- define UI migration;
- define external public API exposure;
- authorize caching;
- authorize engine rewrites;
- authorize database migrations.

## 26. Validation criteria

- Are capability routes permanent? **Yes.**
- Will there be a future aggregate route? **Yes, after explicit prerequisites (Section 22).**
- Does the aggregate route replace capability routes? **No.**
- May the aggregator call legacy engines directly? **No.**
- May Increment 8 modify the Increment 7 envelope? **No.**
- May Increment 8 create a dedicated Evidence capability route? **Yes.**
- Is Evidence automatically a new canonical EngineId? **No.**
- Is the aggregate route authorized for implementation now? **No.**

## 27. Decision summary

The final Intelligence API architecture is a federated canonical capability
model with an additive aggregation layer. Capability routes are stable,
independently versioned contracts and remain permanent. A future aggregate
site-intelligence route may orchestrate canonical capability services but
must not call legacy engines directly, duplicate capability logic, replace
capability routes, or mutate their frozen contracts.
