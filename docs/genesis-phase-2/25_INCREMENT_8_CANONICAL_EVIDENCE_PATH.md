# 25 — Increment 8: Canonical Evidence Path

Frozen implementation record, written per
`26_INCREMENT_8_IMPLEMENTATION_PLAN.md`. Per ADR-020 (Final Intelligence API
Architecture, Option C), this increment builds the second, independent,
additive canonical Intelligence capability route: a read-only Evidence path
alongside Increment 7's frozen Data Trust path.

## 1. Purpose

Serve a canonical, read-only projection of a Site's Evidence Center dossier
at `GET /api/intelligence/evidence-center/site`, proving that a second
canonical capability route can be added additively, reusing an
already-built, already-tested pure Evidence Adapter (Increment 5) without
modifying it, without bypassing the minimal Orchestrator pattern, and
without touching Increment 7's frozen contract, any legacy engine, or any
legacy route.

## 2. Frozen baseline

Code baseline: commit `c4258eb`, tag `genesis-phase-2-increment-7-v1`.
Architecture baseline: `ADR_020_FINAL_INTELLIGENCE_API_ARCHITECTURE.md` and
`26_INCREMENT_8_IMPLEMENTATION_PLAN.md`, both approved before this
increment's own code was written.

## 3. ADR authority

ADR-020 (Option C: federated capability routes, additive aggregation
layer deferred); ADR-016 (minimal, single-use-case orchestrator pattern,
reused here as a second, independent instance per ADR-020's own
reconciliation note, not a generalization of Increment 7's orchestrator);
ADR-017 (Snapshot Provider, reused verbatim); ADR-018 (outer adapter as its
own seam, extended to a second instance here); ADR-019 (Stage 3/4
sequencing, unaffected).

## 4. Scope

New: `services/intelligence-adapters/evidence-checksum.ts`,
`services/intelligence-adapters/evidence-center-read-adapter.ts`,
`services/intelligence-runtime/intelligence-evidence-orchestrator.ts`,
`services/intelligence-runtime/intelligence-evidence-orchestrator-instance.ts`,
`services/intelligence-adapters/evidence-projection-adapter.ts`,
`app/api/intelligence/evidence-center/site/{route,handler}.ts`.
Modified: `services/intelligence-adapters/index.ts` (exports only),
`tests/intelligence-{data-trust-adapter,site-adapter}-contract.test.ts`
(one-line `ADAPTER_EXCLUSIONS` addition each).

## 5. Non-goals

No modification to `services/intelligence-adapters/evidence-adapter.ts`
(Increment 5, reused verbatim — no verified contract defect required
touching it). No modification to Increment 7's route, handler, orchestrator,
or envelope. No aggregate endpoint. No new `EngineId`/manifest/capability
change. No modification to any legacy engine or legacy route. No caller
migration, no UI change, no caching, no schema/package change. No wiring of
`EvidenceId`s into Increment 7's Score/Recommendation contracts.

## 6. Legacy Evidence architecture

`evidenceCenterForSite(db, siteId, persist)` (`services/evidence-center-engine.ts`):
unconditionally calls `ensureDataTrustTables(db)`, performs its own raw
`SITE_SELECT` fetch, calls `dataTrustForSite(db, siteId, persist)` (which
itself unconditionally calls `ensureDataTrustTables` again and gates its own
two business-data `INSERT`s behind `persist`), calls
`copernicusForSite(db, siteId, undefined, undefined, persist)` (which
unconditionally calls `ensureCopernicusTables(db)` and gates its own
scene/validation `INSERT`s behind `persist`), calls
`getSiteNotes(db, siteId)` (which unconditionally calls
`ensureSiteNotes(db)`; the function itself is a pure `SELECT`), calls
`validationHistory(db, siteId)` (pure `SELECT`), builds a fixed, five-item
`evidences` array (`CADASTRO`, `COORDENADAS`, `COPERNICUS`, `QUALIDADE`,
`OBSERVACOES`, in that order, each shaped `{type, source, status, summary}`),
and, only `if (persist)`: five `INSERT INTO site_evidence_center` statements
plus one `recordAudit("EVIDENCE_CENTER_OPENED", ...)` call. Two legacy
routes (`app/api/evidence-center/site/route.ts`,
`app/api/evidence-center/export/route.ts`) call this with `persist=true`
hardcoded — the same GET-with-side-effects pattern as the legacy Data Trust
route; the export route additionally writes a real file to
`../EXPORTACOES/`. Neither route is touched by this increment.

## 7. Canonical architecture

```
GET /api/intelligence/evidence-center/site?id=
  → requireAdminAuth → (if authorized) dynamic import → getCanonicalEvidenceForSite(id)
      → fetchLegacyEvidenceCenterForSite (outer adapter, persist=false)
      → deriveSiteSnapshot (reused verbatim from Increment 7/ADR-017)
      → adaptLegacySiteRow / toSiteEntityReference (reused verbatim from Increment 3,
        needed only to populate CalculationContext.scope -- Evidence's own canonical
        contract carries no site back-reference field)
      → per evidence item: computeEvidenceChecksum, then adaptLegacyEvidence
        (Increment 5, reused verbatim, called individually per item -- never the
        batch wrapper adaptLegacyEvidenceList, since each item needs its own checksum)
  → projectCanonicalEvidenceResponse → HTTP envelope
```

## 8. Route contract

`GET /api/intelligence/evidence-center/site?id=<positive integer Site
database id>` — same `?id=` convention as Increment 7 and the legacy
route. Missing/non-positive-integer/whitespace-only `id` → 400.

## 9. Outer adapter

`fetchLegacyEvidenceCenterForSite(siteId, db = getWritableDb())` calls
`evidenceCenterForSite(db, siteId, false)` — the third argument is a
literal `false`, never omitted, never a variable that could evaluate to
`true`. Returns `null` when the Site does not exist. Otherwise narrows the
real dossier to `{ site: SiteRow; evidences: readonly LegacyEvidenceItem[] }`
— discarding `trust`, `copernicus`, `notes`, `history`, `googleMaps`,
`technicalRecommendation`, `governance`, none of which Snapshot derivation
or the Evidence Adapter need. Performs no canonical translation, no
checksum computation, no Snapshot derivation, no HTTP projection, no
persistence. Deliberately excluded from `services/intelligence-adapters/index.ts`'s
barrel (imported directly by the orchestrator instance only), for the same
`node:sqlite`-collection reason as `data-trust-read-adapter.ts`.

## 10. Checksum rules

`computeEvidenceChecksum(item)` (`services/intelligence-adapters/evidence-checksum.ts`):
pure, deterministic content fingerprint over `{type, source, status,
summary}` only (never `siteId`, `timestamp`, `snapshot`, or array
position). Each field is trimmed; a fixed field order
(`type, source, status, summary`) is joined with the ASCII Unit Separator
(decimal 31, built via `String.fromCharCode(31)`, never a literal embedded
control byte in source, so it stays visible and unambiguous); the joined
string is hashed with `node:crypto`'s built-in `createHash("sha256")`
(UTF-8 encoded); the output is `"sha256-v1:" + <64 lowercase hex
characters>`. No external package; no `Date.now()`/`Math.random()`. This is
a content fingerprint, not a cryptographic proof or tamper-proof signature
— it exists to detect drift in an evidence item's own payload, nothing
more. Two items with byte-identical content (after trimming) produce
identical checksums by design; a SHA-256 collision between genuinely
different content is acknowledged as astronomically unlikely and not
separately mitigated, consistent with SHA-256's standard, accepted use for
content fingerprinting. The `sha256-v1:` prefix is the checksum's own
versioning mechanism — a future algorithm change would use a new prefix,
never silently reuse this one.

## 11. Snapshot rules

`deriveSiteSnapshot` (Increment 7/ADR-017) is reused **verbatim,
unmodified** — no edit to `snapshot-provider.ts`. Derived once per
request from `legacy.site.dataImportacao`/`arquivoOrigem`, then reused as
the same `SnapshotId` for every evidence item's
`EvidenceAdapterContext.snapshot` (all five items describe the same Site
at the same request instant, so they share one Snapshot). When the Site is
not found, Snapshot derivation is never attempted.

## 12. Evidence adaptation rules

`adaptLegacyEvidence` (Increment 5) is reused **verbatim, unmodified** —
called individually, once per legacy evidence item, in the array's own
fixed order (never re-sorted), each with its own
`EvidenceAdapterContext = { idSeed: String(siteId), snapshot: <shared
SnapshotId>, source: "evidence-center", checksum: <that item's own
checksum>, timestamp: <shared requestedAt> }` (no `version` field supplied
— the adapter's own `"0.1.0"` default applies, matching Increment 7's
identical choice for Data Trust/Recommendation). `idSeed` is the raw
`String(siteId)`, not a canonical `EntityReference` id — `Evidence`'s own
contract has no site back-reference field at all, so no such reference is
needed for `EvidenceId` derivation itself (only for `CalculationContext.scope`,
Section 13). `context.source` (`DataSourceId`) is one uniform value,
`"evidence-center"`, shared by the whole batch — the Evidence Center legacy
subsystem genuinely is the data source for every item, distinct from each
item's own already-correct `origin.origin` value (its own legacy `source`
string, e.g. `"vivo_sites.xlsx"`), which the adapter sets independently and
is untouched by this increment. Copernicus truth-metadata disclosure
(`copernicusTruthMetadata()`, forced-low `reliability`) is handled entirely
internally by the unmodified adapter — the Orchestrator does not
special-case it. **Note (discovered during implementation): `Evidence`'s
own canonical contract carries no `limitations` field** (unlike
`Score`/`Recommendation`) — its disclosure mechanism is `issues` plus
`metadata`/`origin.processingMetadata` only; the Orchestrator's own
`limitations` aggregation therefore only ever contains the Snapshot's own
limitation (when the synthetic fallback fires), never a per-Evidence-item
one.

## 13. Orchestrator responsibilities

`createEvidenceOrchestrator(deps).getCanonicalEvidenceForSite(siteId)`:

1. Call `deps.fetchLegacyEvidenceCenterForSite(siteId)`. `null` → `notFound: true`, nothing further attempted.
2. Derive the Snapshot from the returned site row, independent of Site Entity Adaptation's own outcome (disclosable even if that later fails).
3. Call `deps.adaptLegacySiteRow(site)` (Increment 3, unmodified) to obtain a canonical `EntityReference<"Site">` — **the only sanctioned way to obtain one**, per `02_CANONICAL_DOMAIN_MODEL.md`'s binding rule, needed here solely to populate `CalculationContext.scope` (Evidence itself has no site field). Failure → `success: false` with the Site adaptation issues surfaced (tagged `stage: "site"`), Snapshot still disclosed, no evidence attempted.
4. Construct and structurally validate the minimal `CalculationContext` (same pattern as Increment 7: `contextId`/`correlationId` derived from `siteId` + the injected clock's timestamp, distinctly prefixed `context:evidence:...`/`correlation:evidence:...` so a correlation id can never be confused with Data Trust's own `context:data-trust:...` even for the same site at the same instant).
5. For each legacy evidence item, in order: compute its own checksum, build its own context, call `adaptLegacyEvidence` individually (never the batch wrapper `adaptLegacyEvidenceList`, since each item needs a distinct checksum that wrapper's single shared context cannot express).
6. Aggregate every item's issues (tagged `stage: "evidence"`, with the item's own legacy `type` prefixed onto the issue's `field`, e.g. `"CADASTRO.source"`, so five items' otherwise-identically-named issues stay individually traceable in the aggregated list) and the Snapshot's own limitation when applicable.
7. `success` is `true` only if every item adapted successfully — a genuinely empty legacy evidence list (hypothetically, since the real legacy engine always returns exactly five) produces a genuinely successful, empty result; a partially- or fully-failed batch is honestly reported as `success: false`, with only the successfully-adapted items appearing in `evidence` (never a placeholder for a failed one).

No persistence, no cache write, no audit-log write, no mutation, no
engine-manifest status change, no lifecycle transition — structurally
impossible, since no dependency capable of any of these is ever injected.

## 14. Projection and envelope

```ts
interface EvidenceCenterCanonicalEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "evidence-center";
  readonly siteId: string;
  readonly snapshot: { readonly id: string; readonly kind: "derived" | "synthetic"; readonly source: "data_importacao" | "arquivo_origem" | "fallback" } | null;
  readonly context: { readonly contextId: string; readonly correlationId: string; readonly requestedAt: string; readonly requestedBy: string; readonly environment: string } | null;
  readonly result: { readonly evidence: readonly Evidence[] };
  readonly adaptation: { readonly success: boolean; readonly issues: readonly EvidenceEnvelopeIssue[]; readonly limitations: readonly Limitation[] };
}
```

Own, independent `schemaVersion`/`capability` — **not** a modification of
Increment 7's `DataTrustCanonicalEnvelope`. Payload under `result.evidence`,
consistent with Increment 7's own `result.<payload>` convention. **No
`notFound` field** — a not-found result is mapped to a plain 404 error body
by the handler before this function is ever called, applying Increment 7's
own hard-won lesson from the start rather than requiring a later
correction.

## 15. Authentication

Reuses `requireAdminAuth` (`lib/auth-guard.ts`, Increment 0) verbatim.
`route.ts` checks it first, returning immediately on failure, **before**
the dynamic `import()` of the DB-touching Orchestrator wiring — applying
Increment 7's own post-audit required-fix pass from the very first version
written this time, verified by an index-based ordering contract test. Same
carried-forward, documented granularity limitation as Increment 7 (Decision
F, ADR-020 Section 16): `requireAdminAuth` is coarser than the
"authenticated-read" class this route is classified under, accepted as a
conservative stand-in, not weakened further.

## 16. Error mapping

| Condition | Status | Body |
|---|---|---|
| `requireAdminAuth` rejects | 401 or 503 | its own sanitized body |
| `id` missing/blank/non-positive-integer/whitespace-only | 400 | `{ "error": "Missing or invalid 'id' parameter." }` |
| Site not found | 404 | `{ "error": "Site not found." }` |
| Any evidence item's adaptation failed | 422 | envelope returned, `result.evidence` containing only successfully-adapted items, `adaptation.issues` populated |
| Unexpected exception | 500 | `{ "error": "Evidence intelligence assessment unavailable." }`, logged only as `console.error("intelligence_evidence_center_site_failed", error instanceof Error ? error.name : "unknown")` |

## 17. Read-only and schema-write classification

**Logically read-only for business data** (no `INSERT`/`recordAudit`
reachable anywhere in the chain with `persist=false`, confirmed by direct
source inspection of `evidence-center-engine.ts`, `data-trust-engine.ts`,
and `copernicus-engine.ts`) **and technically capable of a one-time schema
write across three separate, independently reachable initializer paths**:
`ensureDataTrustTables`, `ensureCopernicusTables`, `ensureSiteNotes` — one
more path than Increment 7's Data Trust route (which reaches only the
first). Each is a `CREATE TABLE IF NOT EXISTS` statement, a true no-op
once its table already exists, but requiring a writable connection the
first time it runs against a database where that table has never been
created. **`getWritableDb()` is therefore mandatory, not `getDb()`'s
`PRAGMA query_only = ON` connection** — a query-only connection would throw
"attempt to write a readonly database" against any database instance where
even one of these three tables has never been initialized. This is
inherited legacy behavior (every existing consumer of
`evidenceCenterForSite`, including the two untouched legacy routes,
already triggers all three initializer paths identically on every
invocation) — not a new persistence feature this increment introduces, and
not something Principle 2 permits removing from the wrapped legacy
function.

## 18. Side-effect prohibitions

No module in this increment persists a business-data row, writes to
cache, writes an audit log, writes a file, mutates the Runtime Registry, or
changes any manifest's status. Enforced by `persist=false` alone (Section
17) — never by the SQLite connection's own write permissions. Verified by
`tests/intelligence-increment-8-side-effects.test.ts`'s source-inspection
sweep across every new file, plus explicit confirmation that no new file
references `writeFile`/`EXPORTACOES` (the legacy export route's own,
untouched filesystem-write behavior, which this increment's canonical path
never reaches).

## 19. Manifest/registry status

No new `EngineId` registered. `data-trust`/`recommendation` manifests
remain `status: "planned"`; `runtimeEngineRegistry.hasManifest("evidence")`
is `false`. Evidence remains a supporting canonical capability
(`08_ADAPTER_STRATEGY.md` adapter #3), not a mission-named
`CANONICAL_ENGINE_ID` — consistent with ADR-020 Section 19 and the
Increment 8 architectural audit's own finding.

## 20. Legacy compatibility

`app/api/evidence-center/site/route.ts`, `app/api/evidence-center/export/route.ts`,
and `app/api/copernicus/site/route.ts` all have **zero diff** (confirmed
via `git status`/`git diff --name-only` and a dedicated regression test
proving each still calls its legacy engine with the exact same arguments
as before this increment). `services/evidence-center-engine.ts`,
`services/copernicus-engine.ts`, `services/data-trust-engine.ts`,
`services/site-notes.ts`, `services/audit-trail.ts` are all untouched.

## 21. Test strategy

Seven new test files (checksum, outer-adapter contract, orchestrator,
projection, route, Increment-8 contract sweep, side-effect sweep) plus a
one-line `ADAPTER_EXCLUSIONS` addition to each of the two pre-existing
"every adapter is pure" sweep tests. Full detail: `26_INCREMENT_8_IMPLEMENTATION_PLAN.md`
Section 11.

## 22. Acceptance criteria

Identical, capability-adjusted list to `26_INCREMENT_8_IMPLEMENTATION_PLAN.md`
Section 15 — all 15 criteria verified during this increment's own quality
gates (see the implementation's final report for exact results).

## 23. Known limitations

- The outer adapter's direct DB behavior is not covered by a Vitest
  behavioral test — consistent with, not a deviation from, this
  repository's existing testing conventions for `node:sqlite`-touching
  code (same accepted limitation as Increment 7's outer adapter).
- `Evidence`'s own contract carries no `limitations` field — the
  aggregated `limitations` array in both the internal result and the
  envelope only ever reflects the Snapshot's own synthetic-fallback
  limitation, never a per-item one (Section 12).
- Authentication reuses a coarser-than-ideal shared-secret mechanism
  (Section 15) — same, already-documented carried-forward limitation as
  Increment 7.
- The satellite/Copernicus sub-data nested inside the *Data Trust* legacy
  result (a separate, still-unadapted signal Increment 7's own audit
  flagged) remains untouched and unrelated to this increment's Evidence
  Center-sourced path — not resolved here, and not conflated with it.
- The growing `ADAPTER_EXCLUSIONS` list (now two entries across two
  pre-existing test files) is recorded as accepted technical debt; a third
  DB-touching outer adapter added to `services/intelligence-adapters/` in
  a future increment should trigger reconsidering a dedicated I/O-adapter
  directory rather than a third exclusion entry.
- **Duplicate-type `EvidenceId` collision (post-audit finding F-1).**
  `EvidenceId` comes entirely from the reused, unmodified Evidence Adapter
  (Increment 5): `evidence:${idSeed}:${evidenceType}`. This Orchestrator
  supplies `idSeed = String(siteId)`, shared by every item in one request
  (Section 12). Two legacy items that happen to share the same `type`
  therefore collapse onto the identical `EvidenceId`, even when their
  `source`/`status`/`summary` content — and therefore their checksum — are
  genuinely different. Today's `evidenceCenterForSite()` always emits
  exactly five items with five distinct types
  (`CADASTRO`/`COORDENADAS`/`COPERNICUS`/`QUALIDADE`/`OBSERVACOES`), so this
  collision is **not reachable in today's production flow** — reaching it
  would require the legacy engine itself to emit a duplicate type, which
  Principle 2 forbids introducing as part of this adapter-wiring increment.
  Increment 8 **intentionally does not redesign the frozen Evidence Adapter's
  identity scheme** to close this gap — the same structural characteristic
  was already found, accepted, and documented for Recommendation's identical
  `recommendation:${idSeed}:${type}` scheme (Increment 6's `GLOBAL_RULE`
  collision), and this is the same kind of accepted, inherited limitation,
  not a new defect this increment introduces. A dedicated regression test
  (`tests/intelligence-evidence-orchestrator.test.ts`, test 19) now proves
  and documents this exact behavior, using the real checksum, Snapshot,
  Site Entity Adaptation, and Evidence Adapter implementations (only the
  outer, DB-touching adapter is faked), so it is not merely asserted here
  but empirically demonstrated. **Any future redesign of Evidence identity
  (e.g. incorporating the checksum or an array index into `EvidenceId`)
  must be introduced as an explicit, versioned change** — silently changing
  `EvidenceId`'s derivation would be a breaking change to every consumer
  that has already stored or compared an `EvidenceId`, and is out of this
  increment's scope.
- **Checksum delimiter edge case (post-audit finding F-3, optional).** The
  checksum serialization delimiter (the ASCII Unit Separator,
  `String.fromCharCode(31)`) is chosen to be extremely unlikely to appear
  in legacy Portuguese business text, but it is not structurally impossible
  for a legacy `source`/`status`/`summary` field to contain it. If it did,
  two different `(type, source, status, summary)` tuples could in
  principle serialize to the identical joined string and therefore produce
  the identical checksum, despite being semantically different content.
  Current business data makes this practically unreachable (`type` is
  always one of five hardcoded literals, and ordinary business text does
  not contain raw control characters), so no code change is made for this
  increment. A future checksum version could adopt a length-prefixed
  encoding (e.g. `"4:type|7:source|..."`) to close this gap entirely,
  should it ever prove necessary — under its own new version prefix; the
  current `sha256-v1:` scheme remains unchanged by this note.

## 24. Deferred work

Wiring `EvidenceId`s into Increment 7's Score/Recommendation contracts
(explicitly out of scope, ADR-020 Section 21); the aggregate
`/api/intelligence/site` route (explicitly out of scope, ADR-020 Sections
14/17/22); adapting the Data Trust legacy result's own nested
satellite/Copernicus sub-data into canonical Evidence (a separate, future,
purpose-built adapter question, Increment 7's own audit finding, untouched
here).

## 25. Rollback strategy

Delete the seven new production files; revert the export additions to
`services/intelligence-adapters/index.ts`; delete the seven new test
files; revert the one-line `ADAPTER_EXCLUSIONS` addition in each of the
two modified existing test files; delete this document. Nothing else in
the repository is touched by this increment, so nothing else requires
rollback.
