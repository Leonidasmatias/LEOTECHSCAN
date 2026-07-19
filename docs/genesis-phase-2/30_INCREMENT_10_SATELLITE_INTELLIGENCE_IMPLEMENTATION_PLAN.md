# Increment 10 — Satellite Intelligence: Implementation Execution Plan

## 1. Mission

This document is the concrete, implementation-ready execution plan for
Increment 10 (Satellite Intelligence), derived strictly from the frozen,
approved planning document
`docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`. It
introduces no new architecture, no new requirement, and no design decision
the planning document did not already make. Its purpose is to sequence
implementation into small, independently verifiable waves, specify every
file precisely enough that implementation requires no further design
judgment, and define exact stop conditions so an implementer never
improvises past what was approved.

This document is itself planning-only. It does not create, modify, or
delete any production or test file, and does not authorize staging,
committing, tagging, or pushing. Implementation begins only after a
separate, explicit authorization referencing this document.

## 2. Frozen baseline

- Repository: `C:\LEOTECHSCAN\APP`
- Branch: `master`
- Commit: `9dc6f02`
- Tag: `genesis-phase-2-increment-10-plan-v1`
- Approved planning document: `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
  (1548 lines, F-1 through F-10 resolved, Critical/High/Medium/Low all 0,
  Planning Ready: YES, Implementation Authorized: YES per the final focused
  planning re-review)
- Prior increment baseline (unaffected, frozen): Increment 9 at commit
  `b49457d`, tag `genesis-phase-2-increment-9-v1`

## 3. Scope and non-goals

**In scope:** implementing exactly the 13 production files and 11 test
files named in the frozen plan's Section 23/24, wiring them together per
the frozen plan's Sections 6/10/14/15/17, and producing a post-implementation
record document (`31_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION.md`,
future, not part of this plan).

**Out of scope (per the frozen plan's Section 29, unchanged here):**

1. Selecting or integrating a real (non-simulated) satellite provider.
2. Provider licensing/commercial terms.
3. A caching layer of any kind.
4. Imagery/binary delivery (bytes, signed URLs, tile services).
5. CV/ML interpretation of satellite imagery.
6. Multi-provider orchestration policy.
7. Asynchronous integration with the Increment 9 Site Intelligence
   Aggregator (explicitly deferred to a future, separately authorized
   increment per the frozen plan's Section 10.3.1/14).

This plan does not revisit, relitigate, or re-derive any of the frozen
plan's own decisions (HTTP mapping, state matrix, EvidenceId formula,
temporal window model, file placement). Where this plan needs an
implementation-level detail the frozen plan named but did not itself spell
out byte-for-byte (e.g. the exact `lookbackDaysFromWindow` conversion
formula), that detail is specified once, in Batch 3's file-by-file
specification, as a narrow, mechanical implementation choice consistent
with the frozen plan's own stated intent — never as a new architectural
decision.

## 4. Repository audit summary

The following files were read directly (not assumed) to ground this
execution plan in the real, current repository state:

**Legacy Copernicus subsystem** (`services/copernicus-engine.ts`,
`services/copernicus-truth.ts`, `config/copernicus_rules.json`):

- `copernicusForSite(db, id, radiusKm=rules.defaultRadiusKm, lookbackDays=rules.defaultLookbackDays, persist=false)`
  returns `null` if the site does not exist; otherwise returns
  `{ site, integration, searchQuery, scenes, validation, recommendation,
  warning, governance, ...copernicusTruthMetadata() }`. `persist` gates
  every `INSERT`/`recordAudit`-equivalent write (`persistEvidence`),
  confirmed by direct source reading — the legacy-provider adapter's
  binding `persist=false` literal requirement (frozen plan Section 22/23)
  is achievable exactly as specified.
- `CopernicusScene` (legacy, provider-shaped) fields: `siteId, site,
  latitude, longitude, provider, mission, productType, acquisitionDate,
  orbitDirection, polarization, relativeOrbit, sceneId, cloudNote,
  sourceUrl, metadata`. Confirms the frozen plan's F-2 finding: this shape
  is genuinely SAR/Copernicus-specific and must never cross the neutral
  provider port directly — only the legacy provider adapter may see it.
- `copernicusTruthMetadata()` (from `copernicus-truth.ts`) returns
  `{ dataStatus: "simulated", source: "local_rule_engine",
  isRealSatelliteEvidence: false }` — the exact, single, reusable source
  the legacy provider adapter's `SatelliteTruthMetadata` construction must
  derive from (frozen plan Section 10.3/F-1).
- `config/copernicus_rules.json`: `defaultRadiusKm: 2`,
  `defaultLookbackDays: 90`, `scoring.recentSceneDays: 45` — confirms the
  frozen plan's reference to `rules.scoring.recentSceneDays (45 days)` as
  the fixed freshness threshold, and `defaultLookbackDays` as the
  request-validation-layer default window source (Section 13).
- `ensureCopernicusTables(db)` is called unconditionally at the top of
  `copernicusForSite`, `copernicusStatus`, and `copernicusCsvRows` — a
  pre-existing, idempotent `CREATE TABLE IF NOT EXISTS`, not introduced by
  this increment, matching the frozen plan's Section 22 disclosure.
- No current Copernicus route or test was found that this increment
  touches; `app/api/copernicus/site/route.ts` (Increment 9's own
  regression test already asserts its `persist=false` call is unchanged)
  remains untouched by Increment 10.

**Increment 9 patterns** (`services/intelligence-runtime/`,
`services/intelligence-adapters/`, `app/api/intelligence/site/`):

- The route/handler split (`route.ts`: `runtime`/`dynamic`/`GET` only,
  `requireAdminAuth` first, dynamic `import()` of the instance module
  after auth succeeds; `handler.ts`: testable logic, zero auth
  dependency) is confirmed by direct reading of
  `app/api/intelligence/site/route.ts` and
  `app/api/intelligence/site/handler.ts` — this is the exact shape Wave 7
  reproduces for the Satellite capability.
- The orchestrator-core / orchestrator-instance split
  (`site-intelligence-aggregator.ts` pure + DI-based;
  `site-intelligence-aggregator-instance.ts` real wiring, the only module
  resolving DB-touching dependencies) is confirmed by direct reading —
  Wave 5 reproduces this shape, adapted for `async`.
- `services/intelligence-adapters/data-trust-read-adapter.ts` and
  `evidence-center-read-adapter.ts` are the two existing, precedent
  DB-touching outer adapters. Both: import `DatabaseSync` (type-only),
  `SiteRow` (type-only), `getWritableDb` (value), and their one legacy
  engine (value); call the legacy function with a literal `false` persist
  argument, never a variable; narrow the legacy return shape to only the
  fields the orchestrator needs; perform no canonical translation. This is
  the exact template for both new `io/` files in Wave 3.
- The intelligence-adapters barrel (`services/intelligence-adapters/index.ts`)
  deliberately does **not** re-export either existing DB-touching outer
  adapter, with an explicit comment explaining why (breaking Vitest
  collection for every pure-adapter test that imports the barrel). Per
  the frozen plan's Section 23 (barrel additions deferred), Increment 10
  adds no barrel export at all — confirmed consistent with this existing
  precedent, not a deviation from it.

**Shared contracts:**

- `services/intelligence-adapters/site-entity-adapter.ts` — imports
  `SiteRow` from `@/lib/types` (zero-import, pure), never
  `services/site-service.ts` directly. The new `io/satellite-site-read-adapter.ts`
  reuses this exact "import the type, not the DB-touching function" split
  for its own `SiteRow`-typed return.
- `services/geospatial/coordinate-quality-engine.ts` —
  `evaluateCoordinateQuality(input, now)` is pure, dependency-free, and
  its own header comment states it exists "purpose-built... for exactly
  the satellite-coordinate-eligibility screening" this increment needs.
  `eligibleForSentinel` is `true` only for `status === "valid"` — the
  strictest tier. Confirmed reusable verbatim, no modification needed.
- `services/intelligence/evidence/evidence.ts` — canonical `Evidence`
  interface confirmed unchanged: `kind, id, source, description, weight,
  reliability, snapshot, origin (DataProvenance), checksum, references`.
  `services/intelligence/evidence/provenance.ts` — `DataProvenance`
  confirmed unchanged: `origin, pipeline, snapshot, source, checksum,
  timestamp, version, processingMetadata`.
- `services/intelligence-adapters/evidence-checksum.ts` (Increment 8
  pattern) — SHA-256 over a fixed-order, unit-separator-joined field
  serialization, versioned with a `sha256-v1:` prefix, via `node:crypto`'s
  `createHash`. The new `satellite-evidence-checksum.ts` follows this
  exact pattern with satellite-specific fields.
- `services/intelligence-adapters/evidence-adapter.ts` (Increment 5/8
  pattern) — confirms the `EvidenceId` construction convention
  (`toIdentifier<"Evidence">(...)`), the `COPERNICUS_RELIABILITY = 0.1`
  precedent for forcing low reliability on simulated-Copernicus-derived
  evidence, and the "exactly one type-driven disclosure issue, never both"
  discipline the new `satellite-evidence-adapter.ts` reuses.
- `lib/auth-guard.ts` — `requireAdminAuth(request): AdminAuthResult`
  confirmed unchanged; fail-closed, 401/503, constant-time comparison.
  Reused verbatim by the new `route.ts`, identical to Increment 9.
- Purity-sweep test mechanics, confirmed by direct reading:
  - `tests/intelligence-data-trust-adapter-contract.test.ts`'s
    `readAdapterFiles()` uses **non-recursive** `fs.readdirSync(ADAPTER_DIR)`
    filtered to `.ts` files directly in `services/intelligence-adapters/`
    — a file under `services/intelligence-adapters/io/` is invisible to
    this sweep, confirming the frozen plan's F-8 resolution needs no new
    `ADAPTER_EXCLUSIONS` entry.
  - `tests/intelligence-runtime-registry.test.ts`'s source-boundary sweep
    over `services/intelligence-runtime/` has **no exclusion list**, and
    for two of its checks (`@/lib/db`, `@/app/api`) matches on **raw,
    non-comment-stripped source** — confirming the frozen plan's own
    caution that new files placed there (the provider port, orchestrator,
    and orchestrator-instance) must never contain those literal
    substrings, even inside a comment.
  - `tests/intelligence-increment-9-side-effects.test.ts` and
    `tests/intelligence-increment-9-contract.test.ts` supply the exact
    source-inspection idioms (`stripComments`, `WRITE_PATTERNS`,
    dynamic-import-before-auth ordering assertions, barrel non-circularity
    assertions) Wave 9's Increment 10 equivalents reuse directly.
- `package.json`: `"test": "vitest run"`, `"build": "next build"` —
  confirmed exact command names for Section 7 (quality gates).
- `config/capabilities.json` already contains `copernicus_catalogue`,
  `sentinel_1_metadata`, `sentinel_1_processing`,
  `sentinel_1_change_detection`, and `sentinel_core`/`sentinel_intelligence_graph`
  entries, all describing the existing legacy/simulated capability
  truthfully. Confirmed: Increment 10 does not add, remove, or edit any
  entry in this file (mirroring Increment 9's own identical restraint,
  verified by that increment's own dedicated "config/capabilities.json
  remains unchanged" test).

## 5. Existing architecture patterns confirmed reusable verbatim

| Pattern | Source precedent | Reused by |
|---|---|---|
| Route/handler split, auth-before-dynamic-import | `app/api/intelligence/site/route.ts`+`handler.ts` | Wave 7 |
| Orchestrator-core / orchestrator-instance split, DI-based | `site-intelligence-aggregator.ts`+`-instance.ts` | Wave 5 |
| DB-touching outer adapter, literal `persist=false`, narrowed return shape | `data-trust-read-adapter.ts`, `evidence-center-read-adapter.ts` | Wave 3 |
| Pure translation adapter, structured issues, `success`/`issues`/`sourceReference` shape | `site-entity-adapter.ts`, `evidence-adapter.ts` | Wave 2, Wave 4 |
| Deterministic checksum via `node:crypto`, fixed field order, unit-separator join | `evidence-checksum.ts` | Wave 4 |
| Coordinate eligibility gate | `coordinate-quality-engine.ts` (reused, not reimplemented) | Wave 2 |
| Sanitized `console.error` diagnostic logging, `.name` only | `handler.ts` (Increment 9 post-audit hardening) | Wave 7 |
| Barrel deliberately excludes DB-touching files | `intelligence-adapters/index.ts` | Wave 3 (no barrel edit) |

## 6. Legacy Copernicus constraints (binding on implementation)

1. Only `services/intelligence-adapters/io/legacy-copernicus-provider.ts`
   may import `services/copernicus-engine.ts` or
   `services/copernicus-truth.ts`. No other new file may.
2. Every call to `copernicusForSite` must pass a literal `false` as the
   fifth argument — never omitted (the legacy default is `false` already,
   but the frozen plan requires the literal for auditability, matching
   Increment 7/8/9's own identical discipline for their own legacy calls),
   never a variable.
3. `satelliteValidationForSite` (the persist=true trap named in the
   frozen plan's Section 3.2) must never be called, directly or
   indirectly, by any new file.
4. `ensureCopernicusTables(db)` remains reachable only through its
   existing, unconditional call sites inside `copernicus-engine.ts`
   itself — no new file calls it directly.
5. No new file writes to `copernicus_scenes` or
   `site_satellite_validation` (enforced by `persist=false` plus the
   Wave 9 side-effect sweep).

## 7. Approved frozen file inventory (verbatim from the frozen plan, Section 23)

**Production files to create (13):**

```
services/intelligence-adapters/satellite-observation-model.ts
services/intelligence-runtime/satellite-intelligence-provider-port.ts
services/intelligence-adapters/satellite-fake-provider.ts
services/intelligence-adapters/io/satellite-site-read-adapter.ts
services/intelligence-adapters/io/legacy-copernicus-provider.ts
services/intelligence-adapters/satellite-observation-adapter.ts
services/intelligence-adapters/satellite-evidence-checksum.ts
services/intelligence-adapters/satellite-evidence-adapter.ts
services/intelligence-adapters/satellite-projection-adapter.ts
services/intelligence-runtime/satellite-intelligence-orchestrator.ts
services/intelligence-runtime/satellite-intelligence-orchestrator-instance.ts
app/api/intelligence/satellite/site/handler.ts
app/api/intelligence/satellite/site/route.ts
```

**Existing files to modify:** none. `services/intelligence-adapters/index.ts`
barrel export is finalized as deferred (frozen plan Section 23) — no edit
in this increment.

**Test files to create (11, names anticipated per the frozen plan Section 23):**

```
tests/intelligence-satellite-observation-adapter.test.ts
tests/intelligence-satellite-evidence-adapter.test.ts
tests/intelligence-satellite-evidence-checksum.test.ts
tests/intelligence-satellite-provider-port-contract.test.ts
tests/intelligence-satellite-site-read-adapter-contract.test.ts
tests/intelligence-satellite-legacy-copernicus-provider-contract.test.ts
tests/intelligence-satellite-intelligence-orchestrator.test.ts
tests/intelligence-satellite-projection-adapter.test.ts
tests/intelligence-satellite-site-route.test.ts
tests/intelligence-increment-10-contract.test.ts
tests/intelligence-increment-10-side-effects.test.ts
```

**Documentation:** this document, plus a future
`31_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION.md` implementation
record, written only after implementation completes (not part of this
plan).

No path, split, or naming above deviates from the frozen plan. Batch 3
specifies each of these 13 production files precisely; Batch 4 maps each
of the 11 test files to the frozen plan's Section 24 test categories.

## 8. Implementation waves

Eleven waves, strictly ordered. Each wave's gate must pass before the next
wave begins. No wave combines unrelated files, and no wave's scope may
expand beyond what is listed here without stopping and reporting (Section
13, Stop Rules).

### Wave 0 — Repository and dependency audit

- **Files to create:** none.
- **Files to inspect:** all files listed in Section 4/5 above, plus a
  fresh `git status --short` / `git diff --check` immediately before any
  file is created, to reconfirm the baseline has not drifted since this
  plan was written.
- **Dependencies:** none (first wave).
- **Responsibilities:** confirm the baseline is still `9dc6f02` on
  `master` with a clean tree; confirm no file in the approved inventory
  (Section 7) already exists (a pre-existing file with one of these exact
  names would mean an unauthorized prior change, not a green field).
- **Non-goals:** no file is created or modified in this wave.
- **Tests:** none created; `git status --short` and `git diff --check`
  are the only commands run.
- **Commands:** `git rev-parse --short HEAD`, `git branch --show-current`,
  `git status --short`, `git diff --check`.
- **Pass/fail gate:** HEAD unchanged, tree clean, none of the 13 approved
  paths exist yet. Fail → stop (Section 13).
- **Rollback boundary:** nothing to roll back (no write occurred).

### Wave 1 — Canonical models and provider port

- **Files to create:** `services/intelligence-adapters/satellite-observation-model.ts`,
  `services/intelligence-runtime/satellite-intelligence-provider-port.ts`.
- **Files to inspect:** frozen plan Sections 9, 10.1, 10.2, 10.5; `services/intelligence/evidence/evidence.ts`;
  `services/intelligence/types/identifiers.ts`.
- **Dependencies:** Wave 0 gate passed.
- **Responsibilities:** declare every canonical type from frozen plan
  Section 9 (`SatelliteTruthMetadata`, `SatelliteProviderIdentity`,
  `SatelliteSpatialMetadata`, `SatelliteTemporalMetadata`,
  `SatelliteQualityMetadata`, `SatelliteObservation`,
  `SatelliteCapabilityState`, `SatelliteAggregateStatus`) in
  `satellite-observation-model.ts`; declare the port interface and its
  request/outcome/temporal-window types from Section 10.1/10.2/10.5 in
  `satellite-intelligence-provider-port.ts`. Both files are pure type/interface
  declarations only — no runtime logic beyond type-level code.
- **Non-goals:** no implementation of the port; no adapter logic; no
  legacy-shaped field anywhere in either file.
- **Tests:** `tests/intelligence-satellite-provider-port-contract.test.ts`
  (neutrality assertions: no `orbitDirection`/`polarization`/`relativeOrbit`/`CopernicusScene`
  reference; async `fetch()` signature).
- **Commands:** `npx tsc --noEmit`; `npx vitest run tests/intelligence-satellite-provider-port-contract.test.ts`.
- **Pass/fail gate:** TypeScript compiles; the neutrality contract test
  passes; `satellite-intelligence-provider-port.ts`'s raw source contains
  none of `node:sqlite`, `next/server`, `next`, `@/lib/db`, `@/app/api`
  (the intelligence-runtime source-boundary sweep's own literal-substring
  check, confirmed in Section 4).
- **Rollback boundary:** delete both files; no other file references them
  yet, so rollback is a clean, isolated revert.

### Wave 2 — Pure observation classification and temporal rules

- **Files to create:** `services/intelligence-adapters/satellite-observation-adapter.ts`.
- **Files to inspect:** frozen plan Section 12 (deterministic intelligence
  rules); `services/geospatial/coordinate-quality-engine.ts`;
  `config/copernicus_rules.json`.
- **Dependencies:** Wave 1 gate passed (imports `SatelliteObservation`,
  `SatelliteProviderScene`, `SatelliteProviderQualitySummary`).
- **Responsibilities:** pure function(s) turning a
  `SatelliteProviderScene` + `SatelliteProviderQualitySummary` +
  `SatelliteTemporalWindow` into a `SatelliteObservation`, applying the
  deterministic cloud-coverage/freshness/quality classification rules from
  Section 12. Reuses `evaluateCoordinateQuality`/`eligibleForSentinel`
  verbatim (imported, not reimplemented) for the coordinate-eligibility
  gate. Injected clock (`now: () => string`), never `Date.now()`/`new Date()`
  internally.
- **Non-goals:** no I/O; no provider call; no evidence construction (Wave 4).
- **Tests:** `tests/intelligence-satellite-observation-adapter.test.ts`
  (quality/freshness classification boundaries, cloud-coverage-null
  handling, missing-`sourceSceneId` exclusion).
- **Commands:** `npx tsc --noEmit`; `npx vitest run tests/intelligence-satellite-observation-adapter.test.ts`.
- **Pass/fail gate:** TypeScript compiles; all classification-boundary
  cases pass; source-inspection confirms no `Date.now()`/`Math.random()`/
  `crypto.randomUUID()`.
- **Rollback boundary:** delete the one file; Wave 1's files are
  unaffected (they have no dependency on Wave 2).

### Wave 3 — Site read adapter and legacy Copernicus provider

- **Files to create:** `services/intelligence-adapters/io/satellite-site-read-adapter.ts`,
  `services/intelligence-adapters/io/legacy-copernicus-provider.ts`.
- **Files to inspect:** `services/intelligence-adapters/data-trust-read-adapter.ts`
  and `evidence-center-read-adapter.ts` (direct templates, Section 5);
  `services/copernicus-engine.ts`, `services/copernicus-truth.ts`; frozen
  plan Section 3.2 (the `satelliteValidationForSite` persist=true trap),
  Section 10.3, Section 22.
- **Dependencies (hardening correction F-4):** Wave 1 only, architecturally —
  both files' "Allowed imports" (Section 9.4/9.5) type-import
  `SatelliteTemporalWindow`/`SatelliteProviderPort`/`SatelliteProviderScene`
  etc. from Wave 1's two files exclusively; `lookbackDaysFromWindow`
  consumes only the Wave 1 `SatelliteTemporalWindow` type, with no import
  of `satellite-observation-adapter.ts` (Wave 2) by either Wave 3 file.
  Wave 2 executing before Wave 3 is a deliberate **execution-order**
  choice (Section 16), not a module dependency — Wave 3 could, in
  principle, be implemented immediately after Wave 1.
- **Responsibilities:** `satellite-site-read-adapter.ts` reads only the
  `SiteRow` (via `getWritableDb()`, mirroring the two existing `io/`
  adapters), never imports either legacy Copernicus module. `legacy-copernicus-provider.ts`
  implements `SatelliteProviderPort`, is the **only** file permitted to
  import `copernicus-engine.ts`/`copernicus-truth.ts`, calls
  `copernicusForSite(db, siteId, radiusKm, lookbackDaysFromWindow(request.temporalWindow), false)`
  with the literal `false`, reshapes the legacy `CopernicusScene[]`/validation
  score into `SatelliteProviderScene[]`/`SatelliteProviderQualitySummary`
  (0–100→0–1 normalization), and returns `SatelliteTruthMetadata` derived
  from `copernicusTruthMetadata()` on every outcome. Both functions are
  `async` per the port contract (Section 10.3.1), even though the legacy
  engine itself is synchronous — wrapped via `Promise.resolve(...)`, never
  a real network call.
- **Non-goals:** no canonical `SatelliteObservation`/`Evidence`
  construction (Waves 2/4 already own that); no HTTP; no persistence
  (`persist=false` literal, never varied).
- **Tests:** `tests/intelligence-satellite-site-read-adapter-contract.test.ts`,
  `tests/intelligence-satellite-legacy-copernicus-provider-contract.test.ts`
  (source-inspection: only this file imports the legacy engine; behavioral:
  `persist=false` literal, truth metadata always present and always
  `realSatelliteEvidence: false`, async `Promise` return confirmed
  behaviorally).
- **Commands:** `npx tsc --noEmit`; `npx vitest run tests/intelligence-satellite-site-read-adapter-contract.test.ts tests/intelligence-satellite-legacy-copernicus-provider-contract.test.ts`.
- **Pass/fail gate:** both contract test files pass; a repository-wide
  grep (`grep -rn "copernicus-engine\|copernicus-truth" services/intelligence-adapters/`)
  matches only inside `legacy-copernicus-provider.ts`.
- **Rollback boundary:** delete both `io/` files; Waves 1/2 are
  unaffected (neither is imported by them yet).

### Wave 4 — Evidence checksum and evidence adapter

- **Files to create:** `services/intelligence-adapters/satellite-evidence-checksum.ts`,
  `services/intelligence-adapters/satellite-evidence-adapter.ts`.
- **Files to inspect:** `services/intelligence-adapters/evidence-checksum.ts`,
  `evidence-adapter.ts` (direct templates); frozen plan Section 10.4
  (EvidenceId formula), Section 9 (canonical `Evidence` reuse).
- **Dependencies:** Wave 1 (types), Wave 2 (`SatelliteObservation` as input).
- **Responsibilities:** `satellite-evidence-checksum.ts` computes a
  deterministic SHA-256 content fingerprint for one observation, mirroring
  `evidence-checksum.ts`'s fixed-order/unit-separator/versioned-prefix
  pattern exactly. `satellite-evidence-adapter.ts` builds one canonical
  `Evidence` per successfully-adaptable `SatelliteObservation`, using the
  exact formula `satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>`
  for `EvidenceId` (Section 10.4), excludes any scene with a null
  `sourceSceneId` (recording a `missing_scene_id` issue, never fabricating
  an id), and sets `origin.source` to a satellite-specific `DataSourceId`
  distinct from `"evidence-center"`.
- **Non-goals:** no HTTP; no orchestration; no I/O.
- **Tests:** `tests/intelligence-satellite-evidence-checksum.test.ts`,
  `tests/intelligence-satellite-evidence-adapter.test.ts` (formula
  exactness, determinism, no collision with Evidence Center's
  `evidence:<siteId>:COPERNICUS` fixture, missing-id handling).
- **Commands:** `npx tsc --noEmit`; `npx vitest run tests/intelligence-satellite-evidence-checksum.test.ts tests/intelligence-satellite-evidence-adapter.test.ts`.
- **Pass/fail gate:** both test files pass; checksum is proven
  deterministic across repeated calls with identical input.
- **Rollback boundary:** delete both files; Waves 1–3 unaffected.

### Wave 5 — Async orchestrator and real wiring instance

- **Files to create:** `services/intelligence-runtime/satellite-intelligence-orchestrator.ts`,
  `services/intelligence-runtime/satellite-intelligence-orchestrator-instance.ts`.
- **Files to inspect:** `site-intelligence-aggregator.ts`+`-instance.ts`
  (direct structural template, adapted for async); frozen plan Sections
  10.3.1, 14, 17.
- **Dependencies:** Waves 1–4 all complete (the orchestrator composes the
  provider port, site read adapter, observation adapter, and evidence
  adapter).
- **Responsibilities:** `satellite-intelligence-orchestrator.ts` is a
  pure, DI-based, `async` core implementing
  `getCanonicalSatelliteIntelligenceForSite(siteId): Promise<SatelliteCapabilityOutcome>`,
  deriving the five-value `SatelliteAggregateStatus` per Section 17.1's
  exact ordered rule, with no `Promise.all` (exactly one provider call per
  request). `satellite-intelligence-orchestrator-instance.ts` is the only
  new module resolving both `io/` files (`satellite-site-read-adapter.ts`,
  `legacy-copernicus-provider.ts`) into a real, wired instance — never
  imported by a unit test.
- **Non-goals:** no HTTP; no projection; no second provider call; no
  concurrency machinery.
- **Tests:** `tests/intelligence-satellite-intelligence-orchestrator.test.ts`
  (full state-matrix derivation using `satellite-fake-provider.ts`, built
  in this same wave as a test-only pure fixture per the frozen plan's
  Section 23 inventory — deterministic, resolves via `Promise.resolve(...)`).
- **Commands:** `npx tsc --noEmit`; `npx vitest run tests/intelligence-satellite-intelligence-orchestrator.test.ts`.
- **Pass/fail gate:** the orchestrator test passes for every Section 17.2
  group (1–11); source-inspection confirms no `Promise.all`, no
  `Date.now()`/`Math.random()`, and the orchestrator's own entry point
  returns a genuine `Promise` (confirmed behaviorally, not just by type).
- **Rollback boundary:** delete both orchestrator files and
  `satellite-fake-provider.ts`; Waves 1–4 unaffected (none of them import
  the orchestrator).

### Wave 6 — Projection adapter

- **Files to create:** `services/intelligence-adapters/satellite-projection-adapter.ts`.
- **Files to inspect:** `site-intelligence-projection-adapter.ts` (direct
  template); frozen plan Section 15.
- **Dependencies:** Wave 5 (consumes `SatelliteCapabilityOutcome`).
- **Responsibilities:** pure, **synchronous** function mapping
  `SatelliteCapabilityOutcome` → `SatelliteIntelligenceEnvelope`, copying
  `truthMetadata` verbatim (never recomputing it), producing no
  `notFound` field and no `adaptation.success` boolean (Section 15/F-5).
- **Non-goals:** no I/O; no status derivation (already decided by Wave 5);
  no HTTP status-code mapping (Wave 7 owns that).
- **Tests:** `tests/intelligence-satellite-projection-adapter.test.ts`
  (truth-metadata passthrough byte-for-byte, schema-version literal,
  JSON-serializability round-trip).
- **Commands:** `npx tsc --noEmit`; `npx vitest run tests/intelligence-satellite-projection-adapter.test.ts`.
- **Pass/fail gate:** test passes; source-inspection confirms the
  function is synchronous (no `async`, no `await`, no `Promise` in its own
  signature).
- **Rollback boundary:** delete the one file; Wave 5 unaffected.

### Wave 7 — API handler and route

- **Files to create:** `app/api/intelligence/satellite/site/handler.ts`,
  `app/api/intelligence/satellite/site/route.ts`.
- **Files to inspect:** `app/api/intelligence/site/route.ts`+`handler.ts`
  (direct template); `lib/auth-guard.ts`; frozen plan Section 15
  (HTTP/retryability table), Section 21 (diagnostic codes).
- **Dependencies:** Wave 6 (projection), Wave 5 (orchestrator instance,
  imported dynamically by `route.ts` only).
- **Responsibilities:** `route.ts`: `runtime`/`dynamic`/`GET` only,
  `requireAdminAuth` checked first, dynamic `import()` of
  `satellite-intelligence-orchestrator-instance.ts` only after auth
  succeeds. `handler.ts`: `async` (required both by Next.js convention
  and by the orchestrator's own `Promise`-returning entry point), owns the
  full HTTP mapping from Section 15's table exactly (400/401-503/404/200/
  503/502/500), and the sanitized `console.error` diagnostic codes from
  Section 21, with zero auth dependency of its own.
- **Non-goals:** no direct database access; no direct legacy-engine
  import; no call to either Increment 9 capability route/handler.
- **Tests:** `tests/intelligence-satellite-site-route.test.ts` (full
  HTTP-mapping behavioral suite, auth-before-dynamic-import ordering,
  sanitized-error assertions).
- **Commands:** `npx tsc --noEmit`; `npx vitest run tests/intelligence-satellite-site-route.test.ts`.
- **Pass/fail gate:** all HTTP-mapping cases pass; auth-ordering assertion
  passes; `route.ts` exports exactly `GET`/`runtime`/`dynamic`.
- **Rollback boundary:** delete both files; Waves 1–6 unaffected (nothing
  else imports the route/handler).

### Wave 8 — Unit and contract tests

- **Files to create:** none new beyond what Waves 1–7 already created
  per-wave (this wave is a checkpoint, not a new-file wave) — it exists to
  run every unit/contract test file created so far **together**, catching
  cross-file interaction issues a per-wave run in isolation cannot.
- **Dependencies:** Waves 1–7 complete.
- **Responsibilities:** run the full Increment-10-scoped Vitest command
  (Section 12's exact command list) once, all files together.
- **Non-goals:** no new production code; no test file created here that
  wasn't already specified in an earlier wave.
- **Tests:** all 9 unit/contract test files from Waves 1–7.
- **Commands:** the full isolated Increment 10 Vitest command (Section 12).
- **Pass/fail gate:** 100% pass, zero skipped, zero flaky (re-run once to
  confirm determinism if any test is new this wave).
- **Rollback boundary:** N/A (no new files); a failure here means
  returning to the specific wave whose file caused it, not a blanket
  rollback.

### Wave 9 — Integration and regression tests

- **Files to create:** `tests/intelligence-increment-10-contract.test.ts`,
  `tests/intelligence-increment-10-side-effects.test.ts`.
- **Files to inspect:** `tests/intelligence-increment-9-contract.test.ts`,
  `tests/intelligence-increment-9-side-effects.test.ts` (direct templates
  for structure, `stripComments`, `WRITE_PATTERNS`, exact-file-inventory
  assertions, Increment-9-unaffected regression assertions).
- **Dependencies:** Wave 8 gate passed.
- **Responsibilities:** `intelligence-increment-10-contract.test.ts`:
  exact production file inventory exists; dependency-boundary assertions
  across all 13 files (mirroring Batch 4's dependency graph); Increment
  9's own routes/handlers/orchestrators are provably unaffected (identical
  regression-protection pattern to Increment 9's own final test file for
  Increments 7/8); `config/capabilities.json` unchanged;
  `services/intelligence-runtime` registry unchanged (no new EngineId).
  `intelligence-increment-10-side-effects.test.ts`: the `WRITE_PATTERNS`
  sweep across all 13 new files; the `copernicusForSite(...)` call site in
  `legacy-copernicus-provider.ts` is confirmed to end in `, false)`
  exactly.
- **Non-goals:** no new production file.
- **Tests:** the two files this wave creates.
- **Commands:** `npx vitest run tests/intelligence-increment-10-contract.test.ts tests/intelligence-increment-10-side-effects.test.ts`.
- **Pass/fail gate:** both pass; specifically confirm zero diff against
  every frozen file (Data Trust, Evidence Center, Site Intelligence
  Aggregator, their routes/handlers) via the same zero-diff method
  Increment 9's own audit used.
- **Rollback boundary:** delete both files; no production file is ever
  touched by this wave, so rollback cannot affect Waves 1–7.

### Wave 10 — Full quality gates and implementation documentation

- **Files to create:** none (documentation of the implementation is a
  separate future document, `31_...IMPLEMENTATION.md`, explicitly not
  part of this wave or this plan).
- **Dependencies:** Wave 9 gate passed.
- **Responsibilities:** run the full repository-wide gate sequence
  (Section 12) once, in order, confirming nothing outside Increment 10's
  own 13 production + 11 test files changed, and that the full existing
  suite (Increments 0–9) still passes unmodified.
- **Non-goals:** no staging, committing, tagging, or pushing (a separate,
  future, explicitly authorized freeze mission, mirroring Increment 9's
  own protocol).
- **Tests:** the entire repository test suite.
- **Commands:** `npx tsc --noEmit`; `npm test`; `npm run build`;
  `git diff --check`; `git status --short`.
- **Pass/fail gate:** all four gates pass in order; `git status --short`
  shows only the 24 new files (13 production + 11 test) as untracked, no
  existing file modified.
- **Rollback boundary:** if any gate fails, return to the specific wave
  responsible (traced via which file's test failed) — never patch
  symptomatically at Wave 10 itself.

## 9. File-by-file specification

One implementation-level detail is fixed here, not present verbatim in the
frozen plan, because Section 23 names `lookbackDaysFromWindow` but does not
spell out its formula: **`lookbackDaysFromWindow(window)` = `Math.max(1,
Math.ceil((Date.parse(window.endAt) - Date.parse(window.startAt)) / 86_400_000))`**
— a mechanical, deterministic day-count derivation from the already-decided
`[startAt, endAt]` window (Section 10.5), with no new architectural
decision (no new field, no new provider behavior, no new HTTP mapping). It
lives inside `legacy-copernicus-provider.ts` only, since it is a
legacy-bridging detail with no meaning outside that one file.

### 9.1 `services/intelligence-adapters/satellite-observation-model.ts`

- **Purpose:** pure canonical type definitions (frozen plan Section 9).
- **Allowed imports:** none required (self-contained type declarations);
  may type-import from `@/services/intelligence/types/identifiers` if a
  branded id type is referenced directly (optional — the frozen plan's
  Section 9 types use plain `string`/`number`/literal-union fields, no
  branded id).
- **Forbidden imports:** `node:sqlite`, `node:crypto`, `next/server`,
  `next`, `@/lib/db`, `@/app/api`, any `*-engine` module, any
  `intelligence-runtime` module.
- **Exports:** `SatelliteTruthMetadata`, `SatelliteProviderIdentity`,
  `SatelliteSpatialMetadata`, `SatelliteTemporalMetadata`,
  `SatelliteQualityMetadata`, `SatelliteObservation`,
  `SatelliteCapabilityState`, `SatelliteAggregateStatus` — exact shapes
  per frozen plan Section 9.
- **Key types:** as listed; all `readonly` fields, no methods, no class.
- **Sync/async:** N/A (types only).
- **Side-effect policy:** none possible (no runtime code).
- **Error behavior:** N/A.
- **Truthfulness requirements:** `SatelliteTruthMetadata.realSatelliteEvidence`
  is typed `boolean` (not narrowed to `false` at the type level — the
  runtime guarantee that it is always `false` today is enforced in
  `legacy-copernicus-provider.ts`, Wave 3, and tested there).
- **Covering test file:** `tests/intelligence-satellite-observation-adapter.test.ts`
  (type usage exercised indirectly through the observation adapter);
  `tests/intelligence-increment-10-contract.test.ts` (existence + no
  forbidden import, source-inspection).

### 9.2 `services/intelligence-runtime/satellite-intelligence-provider-port.ts`

- **Purpose:** pure port interface and request/outcome/temporal-window
  types (frozen plan Section 10.1/10.2/10.5).
- **Allowed imports:** none required; may type-import
  `SatelliteObservation`-adjacent types from `satellite-observation-model.ts`
  only if genuinely needed (the port's own types are self-contained per
  Section 10.2 — no import is expected in practice).
- **Forbidden imports:** `node:sqlite`, `next/server`, `next`, `@/lib/db`,
  `@/app/api`, any `*-engine` module (including `copernicus-engine`/
  `copernicus-truth`), `sentinel-core`. Binding: this file's raw source
  must never contain the literal substrings `@/lib/db` or `@/app/api`,
  even in a comment (per the `intelligence-runtime` source-boundary
  sweep's non-comment-stripped check, confirmed Section 4).
  Additionally, per F-2: no `orbitDirection`, `polarization`,
  `relativeOrbit`, or `CopernicusScene` reference anywhere in this file.
- **Exports:** `SatelliteCoverageMetadata`, `SatelliteProviderScene`,
  `SatelliteProviderQualitySummary`, `SatelliteProviderRequest`,
  `SatelliteProviderOutcome`, `SatelliteProviderPort`,
  `SatelliteTemporalWindow`.
- **Key types/functions:** `SatelliteProviderPort.fetch(request): Promise<SatelliteProviderOutcome>`
  — the only function signature in this file; everything else is a type.
- **Sync/async:** `fetch()` is `async` (returns `Promise`) — binding per
  F-3.
- **Side-effect policy:** none (interface only, no implementation).
- **Error behavior:** N/A (implementations, not this file, decide error
  handling).
- **Truthfulness requirements:** `sourceAttributes` is typed
  `Readonly<Record<string, string | number | boolean | null>>` — values
  only, never functions, never raw provider objects, enforced by the
  TypeScript type itself.
- **Covering test file:** `tests/intelligence-satellite-provider-port-contract.test.ts`.

### 9.3 `services/intelligence-adapters/satellite-fake-provider.ts`

- **Purpose:** pure, deterministic in-memory `SatelliteProviderPort`
  implementation for unit tests only (frozen plan Section 10.3). **F-6
  classification note (informational, no change from the frozen plan):**
  this file is counted among the 13 production files because that is the
  frozen plan's own Section 23 inventory — it is shipped in the
  production source tree, but its purpose remains exclusively
  deterministic test support. `satellite-intelligence-orchestrator-instance.ts`
  (the only real-wiring module, Section 9.11) must never import it —
  only test files may.
- **Allowed imports:** type-only imports from
  `satellite-intelligence-provider-port.ts`.
- **Forbidden imports:** `node:sqlite`, `@/lib/db`, `copernicus-engine`,
  `copernicus-truth`, `next/server`, `next`, any I/O module.
- **Exports:** a factory function, e.g. `createSatelliteFakeProvider(fixture: SatelliteProviderOutcome): SatelliteProviderPort`,
  producing a `fetch()` that resolves via `Promise.resolve(fixture)`
  (never a pending timer, never `setTimeout`).
- **Key functions:** `createSatelliteFakeProvider`.
- **Sync/async:** `fetch()` is `async`, resolves immediately.
- **Side-effect policy:** none; no I/O, no mutation of the fixture it was
  given.
- **Error behavior:** never throws; the caller supplies whichever
  `SatelliteProviderOutcome` (including `unavailable`/`no_coverage`
  variants) it wants exercised.
- **Truthfulness requirements:** N/A (test fixture, not a truth source
  itself — any `SatelliteProviderScene` it returns is caller-supplied).
- **Covering test file:** exercised by
  `tests/intelligence-satellite-intelligence-orchestrator.test.ts`; its
  own determinism is asserted directly in
  `tests/intelligence-satellite-provider-port-contract.test.ts`'s
  "Async port contract" case (frozen plan Section 24).

### 9.4 `services/intelligence-adapters/io/satellite-site-read-adapter.ts`

- **Purpose:** DB-touching outer adapter reading only the site row
  (frozen plan Section 23).
- **Allowed imports:** `DatabaseSync` (type-only, `node:sqlite`),
  `SiteRow` (type-only, `@/lib/types`), `getWritableDb` (value, `@/lib/db`),
  `siteRow` (value, `@/services/site-service` — change control amendment,
  approved: this file uses the canonical `siteRow(raw)` mapping on its own
  selected row rather than independently re-deriving `SiteRow`'s
  established fallback-chain logic, preserving a single source of truth,
  preventing duplicate/diverging row-shaping implementations, and keeping
  satellite site reads shaped identically to every other existing
  `SiteRow` consumer. No other export of `@/services/site-service` is
  authorized, and `@/api/site-query`'s `SITE_SELECT` remains
  unauthorized — a plain, locally-written `SELECT * FROM sites WHERE id = ?`
  is sufficient, since `siteRow()` reads named properties off whatever row
  it receives regardless of column ordering).
- **Forbidden imports:** `copernicus-engine`, `copernicus-truth`, any
  other `*-engine` module, `next/server`, `next`, `@/app/api`,
  `SITE_SELECT`/`@/api/site-query`, any export of `@/services/site-service`
  other than `siteRow`.
- **Exports:** a function, e.g. `fetchSatelliteSiteRow(siteId: number, db?: DatabaseSync): SiteRow | null`,
  mirroring `data-trust-read-adapter.ts`'s own `fetchLegacyDataTrustForSite`
  shape (default parameter `db = getWritableDb()`).
- **Key functions:** `fetchSatelliteSiteRow`.
- **Sync/async:** synchronous (the underlying `SiteRow` fetch is a
  synchronous `better-sqlite3`/`node:sqlite` call, matching both existing
  `io/` precedents) — the orchestrator (Wave 5) wraps this call inside its
  own `async` flow, but this function itself need not be `async`.
- **Side-effect policy:** read-only; no `INSERT`/`UPDATE`/`DELETE`; may
  reach `ensureCopernicusTables`-equivalent schema init only if the
  underlying site-fetch query requires it (it does not — site lookup uses
  the existing `sites` table, already established).
- **Error behavior:** returns `null` when the site does not exist
  (never throws for "not found" — matches both existing `io/` precedents);
  a genuine DB-layer exception propagates uncaught, to be caught by the
  orchestrator's own isolation (matching Increment 9's
  `invokeCapability`-style try/catch pattern, reproduced in Wave 5).
- **Truthfulness requirements:** N/A (returns raw `SiteRow`, no
  truth-metadata claim of its own).
- **Covering test file:** `tests/intelligence-satellite-site-read-adapter-contract.test.ts`.

### 9.5 `services/intelligence-adapters/io/legacy-copernicus-provider.ts`

- **Purpose:** DB-touching. The only file in this increment permitted to
  import `copernicus-engine.ts`/`copernicus-truth.ts`; implements
  `SatelliteProviderPort` (frozen plan Section 23).
- **Allowed imports:** `DatabaseSync` (type-only, `node:sqlite`),
  `getWritableDb` (value, `@/lib/db`), `copernicusForSite` (value,
  `@/services/copernicus-engine`), `copernicusTruthMetadata` (value,
  `@/services/copernicus-truth`), type-only imports from
  `satellite-intelligence-provider-port.ts` and
  `satellite-observation-model.ts`.
- **Forbidden imports:** any other `*-engine` module (`data-trust-engine`,
  `evidence-center-engine`, `confidence-engine`, `data-quality-engine`,
  `duplicates-engine`), `next/server`, `next`, `@/app/api`.
- **Exports:** a factory or object implementing `SatelliteProviderPort`,
  e.g. `createLegacyCopernicusProvider(db?: DatabaseSync): SatelliteProviderPort`
  with `providerCode: "copernicus-legacy-simulated"`.
- **Key functions:** the port's `fetch(request)`; the local, private
  `lookbackDaysFromWindow(window)` helper (Section 9 above).
- **Sync/async:** `fetch()` is `async`; internally calls the synchronous
  `copernicusForSite(...)` and wraps its result via `Promise.resolve(...)` —
  no real network call exists, matching the frozen plan's explicit
  disclosure that this remains simulated.
- **Side-effect policy:** `copernicusForSite(db, siteId, radiusKm, lookbackDaysFromWindow(request.temporalWindow), false)` —
  the literal `false`, never omitted, never a variable; never calls
  `satelliteValidationForSite`.
- **Error behavior (single-owner model, hardening correction F-1):**
  `fetch()` **never rejects**. Any exception thrown by `copernicusForSite`
  (or a malformed/unreachable DB, or any other unexpected failure inside
  this file's own call to the legacy engine) is caught **locally, inside
  this file**, and resolved — never rethrown, never left to propagate —
  as `Promise.resolve({ kind: "unavailable", reason: "unexpected_error" })`.
  This file is the **sole owner** of the decision "did the legacy call
  succeed or not"; the orchestrator (Wave 5) never sees a rejected
  `Promise` from a correctly-implemented provider under normal operation.
  Only `.name` from the caught exception may be used internally to decide
  the mapping; the exception's `.message`/`.stack` is never attached to
  the resolved outcome, logged, or otherwise leaked. The `unavailable`
  outcome variants (`misconfigured`, `timeout`, `rate_limited`,
  `invalid_credentials`, `unexpected_error`) exist for a **future real
  provider's** actual network/auth failures — today, with only the legacy
  simulated engine behind this port, only `unexpected_error` is
  realistically reachable, via exactly the local catch described above.
  **Truth metadata is preserved on this path too:** `SatelliteProviderOutcome`
  itself (Section 10.2) has no `truthMetadata` field — that field lives
  only on the canonical `SatelliteCapabilityOutcome` the orchestrator
  ultimately returns (Section 14). `copernicusTruthMetadata()` is a pure,
  synchronous function whose result never depends on whether
  `copernicusForSite` itself succeeded or threw — this file (or the
  orchestrator composing its result, per Section 9.10 below) still
  attaches a non-null `SatelliteTruthMetadata`, derived from
  `copernicusTruthMetadata()`, to the final `SatelliteCapabilityOutcome`
  for this request, exactly as the frozen plan's F-1 requires for every
  non-`notFound` result — the exception path never becomes an excuse to
  omit it.
- **Truthfulness requirements:** every returned `SatelliteTruthMetadata`
  has `dataReality: "simulated"`, `realSatelliteEvidence: false`,
  `sourceDisclosure` populated, derived from `copernicusTruthMetadata()` —
  no code path ever sets `dataReality: "provider_sourced"` (F-1).
- **Covering test file:** `tests/intelligence-satellite-legacy-copernicus-provider-contract.test.ts`.

### 9.6 `services/intelligence-adapters/satellite-observation-adapter.ts`

- **Purpose:** pure `SatelliteProviderScene` → `SatelliteObservation`,
  deterministic quality/freshness classification (frozen plan Section 12).
- **Allowed imports:** type-only imports from
  `satellite-intelligence-provider-port.ts`,
  `satellite-observation-model.ts`; value import of
  `evaluateCoordinateQuality` from
  `@/services/geospatial/coordinate-quality-engine`.
- **Forbidden imports:** `node:sqlite`, `@/lib/db`, any `*-engine`
  module, `next/server`, `next`.
- **Exports:** a function, e.g. `adaptSatelliteProviderScene(scene: SatelliteProviderScene, context: {...}, now: () => string): SatelliteObservation | { excluded: true; issue: SatelliteOrchestrationIssue }`.
  Exact signature decided at implementation time within this stated
  contract — not a new architectural decision.
- **Key functions:** the adaptation function; freshness classification
  (`recent` / `stale` / `unknown`) against `config/copernicus_rules.json`'s
  `scoring.recentSceneDays` (45); quality classification
  (`high`/`medium`/`low`/`insufficient`).
- **Sync/async:** synchronous, pure.
- **Side-effect policy:** none; injected `now()`, never `Date.now()`/`new Date()`.
- **Error behavior:** never throws; a scene with `sourceSceneId: null` is
  excluded, not converted, with a `missing_scene_id` issue.
- **Truthfulness requirements:** `cloudCoveragePercent` is passed through
  as `number | null` verbatim — never fabricated, never coerced to a
  Copernicus-specific enum literal (F-2 consistency).
- **Covering test file:** `tests/intelligence-satellite-observation-adapter.test.ts`.

### 9.7 `services/intelligence-adapters/satellite-evidence-checksum.ts`

- **Purpose:** pure content-fingerprint checksum for one observation,
  mirroring `evidence-checksum.ts`'s algorithm (frozen plan Section 23).
- **Allowed imports:** `createHash` (value, `node:crypto` — an accepted
  "pure" platform capability per the existing precedent); type-only import
  of `SatelliteObservation`.
- **Forbidden imports:** everything else (`node:sqlite`, `@/lib/db`,
  `next`, any engine).
- **Exports:** `computeSatelliteEvidenceChecksum(observation: SatelliteObservation): string`.
- **Key functions:** as above; internal `serialize`/`normalize` helpers,
  private (not exported), mirroring `evidence-checksum.ts`'s own shape.
- **Sync/async:** synchronous, pure.
- **Side-effect policy:** none.
- **Error behavior:** never throws.
- **Truthfulness requirements:** N/A (structural fingerprint only, no
  truth claim).
- **Covering test file:** `tests/intelligence-satellite-evidence-checksum.test.ts`.

### 9.8 `services/intelligence-adapters/satellite-evidence-adapter.ts`

- **Purpose:** pure, one `SatelliteObservation` → one canonical
  `Evidence`, including the exact `EvidenceId` formula (frozen plan
  Section 10.4/F-4).
- **Allowed imports:** type-only `Evidence` from
  `@/services/intelligence`; `toIdentifier`/`toIsoDateTime` (value,
  `@/services/intelligence`); `createHash` (value, `node:crypto`);
  `computeSatelliteEvidenceChecksum` (value, sibling file); type-only
  `SatelliteObservation`.
- **Forbidden imports:** `node:sqlite`, `@/lib/db`, any `*-engine`
  module, `next`.
- **Exports:** `adaptSatelliteObservationToEvidence(observation: SatelliteObservation, context: {...}): Evidence`.
- **Key functions:** as above; the `EvidenceId` construction
  `satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>` —
  `providerCode` trimmed/lowercased before embedding.
- **Sync/async:** synchronous, pure.
- **Side-effect policy:** none.
- **Error behavior (hardening correction F-2):** never throws; only
  called for observations that already survived **Wave 2**'s own
  missing-id exclusion (`satellite-observation-adapter.ts`, Section 9.6 —
  the sole owner of the missing-`sourceSceneId` exclusion decision; Wave
  6, `satellite-projection-adapter.ts`, has no missing-id responsibility
  of any kind, since it never touches a `SatelliteProviderScene`/
  `SatelliteObservation` directly — it only maps an already-complete
  `SatelliteCapabilityOutcome` to the public envelope). This file assumes
  a non-null `sourceSceneId` on every `SatelliteObservation` it receives,
  matching the frozen plan's stated call ordering; if it is ever called
  directly (e.g. from a test) with an observation whose `sourceSceneId`
  is null, that is a caller contract violation outside this file's own
  responsibility — Wave 2's exclusion, not this file, is what the frozen
  plan and this execution plan both rely on to make that case
  unreachable in the real orchestrator composition (Wave 5).
- **Truthfulness requirements:** `Evidence.reliability` forced low
  (mirroring `COPERNICUS_RELIABILITY = 0.1`'s precedent) since the
  underlying data remains simulated regardless of legacy score;
  `Evidence.origin.source` is a satellite-specific `DataSourceId`,
  distinct from `"evidence-center"`.
- **Covering test file:** `tests/intelligence-satellite-evidence-adapter.test.ts`.

### 9.9 `services/intelligence-adapters/satellite-projection-adapter.ts`

- **Purpose:** pure, synchronous: orchestration result → public envelope,
  including verbatim `truthMetadata` passthrough (frozen plan Section 15).
- **Allowed imports:** type-only imports of `SatelliteCapabilityOutcome`
  (from the orchestrator core, Wave 5) and
  `SatelliteIntelligenceEnvelope`/related types (Section 9/15).
- **Forbidden imports:** `node:sqlite`, `@/lib/db`, `next/server`, `next`,
  any `*-engine` module, any value-level import of the orchestrator
  instance.
- **Exports:** `projectSatelliteIntelligenceResponse(result: SatelliteCapabilityOutcome): SatelliteIntelligenceEnvelope`.
- **Key functions:** as above only.
- **Sync/async:** **synchronous** — explicitly not `async`, matching
  `site-intelligence-projection-adapter.ts`'s own precedent; the `Promise`
  is already resolved by the time the handler calls this function.
- **Side-effect policy:** none; never mutates `result`.
- **Error behavior:** never throws; the caller must never call this for a
  `notFound: true` result (mirrors Increment 9's own identical contract).
- **Truthfulness requirements:** copies `result.truthMetadata` verbatim,
  never recomputes or re-derives it (F-1) — the single place in the
  pipeline that decides `dataReality` remains the Wave 3 provider adapter.
- **Covering test file:** `tests/intelligence-satellite-projection-adapter.test.ts`.

### 9.10 `services/intelligence-runtime/satellite-intelligence-orchestrator.ts`

- **Purpose:** pure core, DI-based, async (frozen plan Section 10.3.1/F-3).
- **Allowed imports:** type-only imports of the port, canonical model, and
  `Evidence` types; no value-level import of any I/O module (everything
  arrives via injected `deps`, mirroring `site-intelligence-aggregator.ts`'s
  own `SiteIntelligenceAggregatorDeps` pattern).
- **Forbidden imports:** `node:sqlite`, `@/lib/db`, `@/app/api`, `next`,
  `next/server`, any `*-engine` module, `sentinel-core`. Binding: raw
  source must never contain `@/lib/db` or `@/app/api` substrings, even in
  a comment.
- **Exports:** `createSatelliteIntelligenceOrchestrator(deps): { getCanonicalSatelliteIntelligenceForSite(siteId: number): Promise<SatelliteCapabilityOutcome> }`,
  plus the `SatelliteIntelligenceOrchestratorDeps` interface.
- **Key functions/types:** the five-value `SatelliteAggregateStatus`
  derivation (Section 17.1's exact ordered rule); `SatelliteCapabilityOutcome`
  (Section 14).
- **Sync/async:** `async` entry point, returns a genuine `Promise`; no
  `Promise.all` (exactly one provider call).
- **Side-effect policy:** none directly reachable — no dependency capable
  of persisting, caching, or auditing is ever injected.
- **Error behavior (single-owner model, hardening correction F-1):** the
  **normal** path is: `deps.provider.fetch(request)` resolves (it never
  rejects, by Section 9.5's own binding contract above) to a
  `SatelliteProviderOutcome`; the orchestrator switches on `.kind`
  (`success` / `unavailable` / `no_coverage`) and derives
  `SatelliteAggregateStatus` per Section 17.1's ordered rule — an
  `unavailable` outcome with `reason: "unexpected_error"` is handled here
  exactly like any other `unavailable` reason, mapping to
  `status: "unavailable"` with the `reason` preserved for Wave 7's
  diagnostic-code selection (Section 21). The orchestrator's **own**
  `try`/`catch` around the `await deps.provider.fetch(...)` call exists
  only as a **defensive fallback**, distinct from and never the primary
  owner of the normal `unavailable`/`unexpected_error` case above — it
  exists solely to guard against a provider implementation *violating*
  its own never-rejects contract (a bug in a future provider), a
  dependency-construction/wiring failure, or an exception in the
  orchestrator's own composition logic (site-read adapter, observation
  adapter, or evidence adapter throwing). Only this defensive fallback —
  never the normal resolved-outcome path — maps to `status: "failed"`
  (Section 17.1 rule 2); a `Promise` rejection reaching this fallback has
  no `reason` to preserve (the provider contract was violated before one
  could be produced), so `"failed"` is the only honest classification
  available, never a fabricated `"unavailable"` with a guessed reason.
  Neither path is ever left uncaught to crash the handler.
- **Truthfulness requirements:** `truthMetadata` is mandatory and
  non-null on every non-`notFound` result (F-1) — structurally guaranteed
  by never constructing a `SatelliteCapabilityOutcome` literal without it.
- **Covering test file:** `tests/intelligence-satellite-intelligence-orchestrator.test.ts`.

### 9.11 `services/intelligence-runtime/satellite-intelligence-orchestrator-instance.ts`

- **Purpose:** real wiring — the only new module resolving both
  DB-touching `io/` files (frozen plan Section 23).
- **Allowed imports:** value imports of `fetchSatelliteSiteRow` (Wave 3),
  `createLegacyCopernicusProvider` (Wave 3),
  `createSatelliteIntelligenceOrchestrator` (Wave 5, sibling), plus
  `CalculationContext`-style `environment()`/`now()` helpers matching
  `site-intelligence-aggregator-instance.ts`'s own pattern.
- **Forbidden imports:** direct `node:sqlite`/`@/lib/db` import (reached
  only transitively, through the two `io/` files) — the file's own raw
  source must not contain those literal substrings, even in a comment,
  matching the intelligence-runtime sweep's binding rule.
- **Exports:** `getCanonicalSatelliteIntelligenceForSite(siteId: number): Promise<SatelliteCapabilityOutcome>`.
- **Key functions:** as above only — a thin wiring function, no logic of
  its own beyond dependency construction.
- **Sync/async:** `async` (delegates to the orchestrator core's own
  `Promise`).
- **Side-effect policy:** none of its own; transitively reaches the two
  `io/` files' own read-only behavior.
- **Error behavior:** delegates entirely to the orchestrator core's own
  isolation.
- **Truthfulness requirements:** N/A (pure wiring, no truth decision of
  its own).
- **Covering test file:** never imported by a unit test directly (matching
  every existing `-instance.ts` precedent); exercised indirectly via
  `tests/intelligence-satellite-site-route.test.ts` and
  `tests/intelligence-increment-10-contract.test.ts`'s source-inspection
  checks.

### 9.12 `app/api/intelligence/satellite/site/handler.ts`

- **Purpose:** testable request logic, async; owns the finalized HTTP
  mapping (Section 15) and sanitized logging (Section 21).
- **Allowed imports:** `NextRequest`/`NextResponse` (value, `next/server`);
  `projectSatelliteIntelligenceResponse` (value, Wave 6); type-only
  `SatelliteCapabilityOutcome` (Wave 5).
- **Forbidden imports:** `requireAdminAuth`/`@/lib/auth-guard` (no
  auth dependency, matching every existing capability handler precedent);
  `@/lib/db`; any `*-engine` module; the orchestrator instance (received
  only via injected `deps`, never imported directly — mirroring
  `SiteIntelligenceRouteDeps`'s own pattern).
- **Exports:** `handleSatelliteIntelligenceRequest(request: NextRequest, deps: SatelliteIntelligenceRouteDeps): Promise<NextResponse>`,
  plus `SatelliteIntelligenceRouteDeps`.
- **Key functions:** request validation (`id`, `temporalWindow` parsing
  and `startAt <= endAt` check → 400 on failure); the full Section 15
  status→HTTP mapping; the Section 21 diagnostic `console.error` calls.
- **Sync/async:** `async` (required by Next.js route-handler convention
  and by the orchestrator's own `Promise`-returning dependency).
- **Side-effect policy:** logging only (`console.error`, sanitized `.name`
  only, never `.message`/`.stack`); no persistence.
- **Error behavior:** every non-2xx condition returns a sanitized JSON
  error body; an uncaught exception anywhere in this handler's own logic
  maps to the identical sanitized 500 as an orchestrator-reported
  `"failed"` status.
- **Truthfulness requirements:** never leaks a raw provider response,
  credential, or signed URL (none exist to leak, by construction).
- **Covering test file:** `tests/intelligence-satellite-site-route.test.ts`.

### 9.13 `app/api/intelligence/satellite/site/route.ts`

- **Purpose:** `runtime`/`dynamic`/`GET` only, auth-first, dynamically
  imports the orchestrator instance.
- **Allowed imports:** `NextRequest`/`NextResponse` (value, `next/server`);
  `requireAdminAuth` (value, `@/lib/auth-guard`);
  `handleSatelliteIntelligenceRequest` (value, sibling `./handler`).
- **Forbidden imports:** any legacy engine; `@/lib/db`; the orchestrator
  instance module statically (must be a dynamic `import()` inside `GET`,
  after the auth check, exactly matching
  `app/api/intelligence/site/route.ts`'s own pattern).
- **Exports:** `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
  `async function GET(request): Promise<NextResponse>` — exactly these
  three, nothing else.
- **Key functions:** `GET` only.
- **Sync/async:** `GET` is `async`.
- **Side-effect policy:** none of its own; auth check only, then
  delegates.
- **Error behavior:** an unauthorized request never reaches the dynamic
  import (auth checked and returned on strictly before it, identical
  ordering discipline to Increment 9).
- **Truthfulness requirements:** N/A (routing only).
- **Covering test file:** `tests/intelligence-satellite-site-route.test.ts`.

### 9.14 Planned test files (all 11, restated for this batch's completeness)

```
tests/intelligence-satellite-observation-adapter.test.ts
tests/intelligence-satellite-evidence-adapter.test.ts
tests/intelligence-satellite-evidence-checksum.test.ts
tests/intelligence-satellite-provider-port-contract.test.ts
tests/intelligence-satellite-site-read-adapter-contract.test.ts
tests/intelligence-satellite-legacy-copernicus-provider-contract.test.ts
tests/intelligence-satellite-intelligence-orchestrator.test.ts
tests/intelligence-satellite-projection-adapter.test.ts
tests/intelligence-satellite-site-route.test.ts
tests/intelligence-increment-10-contract.test.ts
tests/intelligence-increment-10-side-effects.test.ts
```

## 10. Dependency graph

**Legend (hardening correction F-3, editorial graph-direction correction):**
`->` means **`IMPORTER -> IMPORTED MODULE`** — the file on the left has a
real `import` statement reaching the file on the right, exactly as
declared in the left-hand file's own "Allowed imports" list in Section 9.
Every solid arrow in this section, without exception, follows this one
convention: read left-to-right as "imports." `--dynamic import after
auth-->` is a visually distinct arrow style reserved for the one dynamic
`import()` call in this increment (`route.ts`'s own, Section 9.13) — it
is never a static edge and must not be confused with the solid `->`
arrows. "Composition (Wave 5)" (its own labeled subsection below) shows
runtime dependency-injection/data-flow relationships — a function
receiving another module's *output value* as a parameter, without
importing that module's file — using `receives <-`, never a plain `->`,
so it cannot be mistaken for a static import. No arrow in this section
implies anything beyond what Section 9's per-file "Allowed
imports"/"Exports" lists already state.

**Independent pure/model branches** (no imports of each other):

```
satellite-observation-model.ts        (pure, no deps)
satellite-intelligence-provider-port.ts (pure, no deps)
```

**Provider branch:**

```
satellite-fake-provider.ts
        -> satellite-intelligence-provider-port.ts   (type-only import)

io/legacy-copernicus-provider.ts
        -> satellite-intelligence-provider-port.ts   (type-only import)
        -> satellite-observation-model.ts            (type-only import)
        -> copernicus-engine.ts   (value import: copernicusForSite — legacy
                                    module, not one of the 13 approved files)
        -> copernicus-truth.ts    (value import: copernicusTruthMetadata —
                                    legacy module, not one of the 13 approved files)
        -> @/lib/db                (value import: getWritableDb)
```

**Observation branch:**

```
satellite-observation-adapter.ts
        -> satellite-observation-model.ts            (type-only import)
        -> satellite-intelligence-provider-port.ts   (type-only import)
        -> coordinate-quality-engine.ts               (value import: evaluateCoordinateQuality)
```

**Evidence branch:**

```
satellite-evidence-checksum.ts
        -> satellite-observation-model.ts   (type-only import: SatelliteObservation)

satellite-evidence-adapter.ts
        -> satellite-observation-model.ts   (type-only import: SatelliteObservation)
        -> satellite-evidence-checksum.ts   (value import: computeSatelliteEvidenceChecksum, sibling)
```

Confirms F-3's finding directly: `satellite-evidence-checksum.ts` and
`satellite-evidence-adapter.ts` import **only** from
`satellite-observation-model.ts` (Wave 1) and each other — **neither
imports `satellite-observation-adapter.ts` (Wave 2) nor either `io/` file
(Wave 3)**.

**Site-read branch** (independent of every branch above):

```
io/satellite-site-read-adapter.ts
        -> @/lib/db              (value import: getWritableDb)
        -> @/lib/types           (type-only import: SiteRow)
        -> @/services/site-service (value import: siteRow — change
                                     control amendment, Section 9.4)
```

**Composition (Wave 5) — runtime data flow, not import edges:**

```
satellite-intelligence-orchestrator.ts (pure, async, DI)
    receives <- a SatelliteProviderPort implementation      (from the provider branch)
    receives <- a site-row fetch function                   (from the site-read branch)
    receives <- the observation-adaptation function          (from the observation branch)
    receives <- the evidence-adaptation function              (from the evidence branch)
```

None of these are static imports of the orchestrator core itself — the
core only type-imports the port, canonical-model, and Evidence types
(Section 9.10's own "Allowed imports"); the *values* flow in via injected
`deps`, wired together by `satellite-intelligence-orchestrator-instance.ts`
(below), never by the core.

**Real wiring and downstream composition (static imports resume here):**

```
satellite-intelligence-orchestrator-instance.ts
        -> io/satellite-site-read-adapter.ts       (value import)
        -> io/legacy-copernicus-provider.ts        (value import)
        -> satellite-intelligence-orchestrator.ts  (value import, sibling)

satellite-projection-adapter.ts
        -> satellite-intelligence-orchestrator.ts  (type-only import:
                                                      SatelliteCapabilityOutcome —
                                                      the type-owning module
                                                      per Section 9.9/9.10;
                                                      never imports the
                                                      orchestrator-instance)

app/api/.../satellite/site/handler.ts
        -> satellite-projection-adapter.ts          (value import)
    receives <- the orchestrator's async result        (via injected deps,
                                                          Section 9.12 — not
                                                          a static import of
                                                          the orchestrator-instance)

app/api/.../satellite/site/route.ts
        -> app/api/.../satellite/site/handler.ts    (value import)
        --dynamic import after auth-->
        satellite-intelligence-orchestrator-instance.ts
                                    (import() only, inside GET, strictly
                                     after requireAdminAuth succeeds —
                                     never a static top-level import;
                                     Section 9.13)
```

### 10.1 Pure modules (no I/O, no HTTP, deterministic, injected clock)

`satellite-observation-model.ts`, `satellite-intelligence-provider-port.ts`,
`satellite-fake-provider.ts`, `satellite-observation-adapter.ts`,
`satellite-evidence-checksum.ts`, `satellite-evidence-adapter.ts`,
`satellite-intelligence-orchestrator.ts`,
`satellite-projection-adapter.ts`.

### 10.2 I/O modules (database-touching)

`services/intelligence-adapters/io/satellite-site-read-adapter.ts`,
`services/intelligence-adapters/io/legacy-copernicus-provider.ts`,
`services/intelligence-runtime/satellite-intelligence-orchestrator-instance.ts`
(transitively, by wiring the two `io/` files together — contains no
direct `@/lib/db` import of its own, matching the source-boundary sweep's
binding literal-substring rule).

### 10.3 Modules allowed to import legacy Copernicus code

Exactly one: `services/intelligence-adapters/io/legacy-copernicus-provider.ts`.
No other file among the 13 may import `services/copernicus-engine.ts` or
`services/copernicus-truth.ts`, confirmed by Wave 3's gate
(`grep -rn "copernicus-engine\|copernicus-truth" services/intelligence-adapters/`
matching only that one file) and re-confirmed by Wave 9's
`tests/intelligence-increment-10-contract.test.ts`.

### 10.4 Modules allowed to touch the database

Exactly two, directly: `io/satellite-site-read-adapter.ts` (via
`getWritableDb`), `io/legacy-copernicus-provider.ts` (via `getWritableDb`
and, transitively, `copernicusForSite`'s own DB access).
`satellite-intelligence-orchestrator-instance.ts` touches the database
only transitively, through those two — never directly.

### 10.5 Modules allowed to know HTTP

Exactly two: `app/api/intelligence/satellite/site/handler.ts` (imports
`NextRequest`/`NextResponse`, owns the status-code mapping),
`app/api/intelligence/satellite/site/route.ts` (imports
`NextRequest`/`NextResponse`, declares `runtime`/`dynamic`/`GET`). No
`services/**` file imports `next` or `next/server`.

### 10.6 Modules allowed to produce logs

Exactly one: `app/api/intelligence/satellite/site/handler.ts`
(`console.error` with the Section 21 diagnostic codes, sanitized
`.name`-only). No `services/**` file calls `console.error`/`console.log`/
`console.warn` — matching Increment 9's own precedent where all
diagnostic logging lives in the handler, not the orchestrator core.

### 10.7 Confirmed: single legacy-import chokepoint

This graph structurally guarantees the frozen plan's binding requirement
(Section 6 of this document, restated here for the dependency-graph
context): a repository-wide search for any import of
`copernicus-engine`/`copernicus-truth` outside
`io/legacy-copernicus-provider.ts` must return zero matches among the 13
approved files, for the entire lifetime of this increment.

## 11. Test execution matrix

Every category from the frozen plan's Section 24, mapped to its concrete
test file:

| Category | Test file | Key cases | Fixtures/fakes | Command | Expected |
|---|---|---|---|---|---|
| Truth metadata | `intelligence-satellite-legacy-copernicus-provider-contract.test.ts`, `intelligence-satellite-projection-adapter.test.ts` | mandatory presence, `realSatelliteEvidence: false` always, passthrough unchanged, cannot be omitted (TS-level), consistency with `copernicusTruthMetadata()` | none (real `copernicusTruthMetadata()` reused) | `npx vitest run <file>` | all pass |
| Provider neutrality | `intelligence-satellite-provider-port-contract.test.ts` | no `orbitDirection`/`polarization`/`relativeOrbit`/`CopernicusScene` in port source; only `legacy-copernicus-provider.ts` imports the legacy engine | source-inspection, no fixture | `npx vitest run <file>` | all pass |
| Async contracts | `intelligence-satellite-provider-port-contract.test.ts`, `intelligence-satellite-intelligence-orchestrator.test.ts` | `fetch()` returns a genuine `Promise`; fake provider resolves via `Promise.resolve`; orchestrator entry point returns `Promise` behaviorally; no `Promise.all` present | `satellite-fake-provider.ts` | `npx vitest run <file>` | all pass |
| Exception ownership (hardening F-1) | `intelligence-satellite-legacy-copernicus-provider-contract.test.ts`, `intelligence-satellite-intelligence-orchestrator.test.ts` | `legacy-copernicus-provider.ts`'s `fetch()` never rejects when the injected `copernicusForSite` fake throws — resolves `{kind:"unavailable", reason:"unexpected_error"}` instead, with `.message`/`.stack` absent from the resolved value; orchestrator's own `status:"failed"` path is exercised **only** via a deliberately contract-violating fake provider (`fetch()` that rejects), never via the normal `unexpected_error` outcome, proving the two paths are distinct and non-overlapping | a `copernicusForSite`-shaped fake that throws (Wave 3); a contract-violating fake provider whose `fetch()` rejects (Wave 5, negative-path fixture only) | `npx vitest run <file>` | all pass |
| EvidenceId | `intelligence-satellite-evidence-adapter.test.ts` | exact formula construction, determinism, no collision with `evidence:<siteId>:COPERNICUS` | fixed fixture site/scene ids | `npx vitest run <file>` | all pass |
| Missing sourceSceneId | `intelligence-satellite-observation-adapter.test.ts`, `intelligence-satellite-evidence-adapter.test.ts` | scene excluded, `missing_scene_id` issue recorded, no fabricated id | scene fixture with `sourceSceneId: null` | `npx vitest run <file>` | all pass |
| Temporal-window validation | `intelligence-satellite-site-route.test.ts` | missing/malformed window, `startAt > endAt` → 400; default-window construction when omitted | injected fixed clock | `npx vitest run <file>` | all pass |
| Quality/freshness classification | `intelligence-satellite-observation-adapter.test.ts` | boundary at `recentSceneDays` (45 days) exactly and one day over; quality tiers | fixture scenes at boundary dates | `npx vitest run <file>` | all pass |
| Mixed scene outcomes | `intelligence-satellite-intelligence-orchestrator.test.ts` | 3-of-5 usable → `partial`; 1-of-5 usable → `partial`; 0-of-5 usable → `unavailable`, HTTP 502 | `satellite-fake-provider.ts` returning mixed scene batches | `npx vitest run <file>` | all pass |
| Five-value aggregate status | `intelligence-satellite-intelligence-orchestrator.test.ts` | all 11 groups from Section 17.2 | `satellite-fake-provider.ts` per group | `npx vitest run <file>` | all pass |
| HTTP mapping | `intelligence-satellite-site-route.test.ts` | every row of Section 15's table | injected orchestrator dep returning each `SatelliteCapabilityOutcome` variant | `npx vitest run <file>` | all pass |
| Retryability (hardening F-5) | `intelligence-satellite-site-route.test.ts` | retryability is **not** a public response-body field; asserted indirectly and deterministically via the finalized reason→diagnostic/HTTP mapping (Section 15/21), one case per `reason`: `misconfigured`/`invalid_credentials` → `unavailable`, HTTP 503, code `satellite_provider_misconfigured`, sanitized (no `.message`/`.stack`/credential in the logged or response body); `timeout` → `unavailable`, HTTP 503, code `satellite_provider_timeout`, sanitized; `rate_limited` → `unavailable`, HTTP 503, code `satellite_provider_timeout`, sanitized; `unexpected_error` → `unavailable`, HTTP 503, code `satellite_provider_timeout`, sanitized — no `retryable` JSON field is ever asserted or introduced; a client determines retryability purely from the diagnostic code already returned, per Section 15's retryability table | injected orchestrator dep returning each `reason` value | `npx vitest run <file>` | all pass |
| Diagnostic codes | `intelligence-satellite-site-route.test.ts` | each Section 21 code fires exactly once per matching condition, with only sanitized fields | `console.error` spy | `npx vitest run <file>` | all pass |
| persist=false guarantees | `intelligence-satellite-legacy-copernicus-provider-contract.test.ts`, `intelligence-increment-10-side-effects.test.ts` | literal `, false)` at every `copernicusForSite` call site; no `satelliteValidationForSite` reference anywhere | source-inspection | `npx vitest run <file>` | all pass |
| Authentication-first behavior | `intelligence-satellite-site-route.test.ts` | `requireAdminAuth` call index precedes dynamic-import index | source-inspection (index comparison, mirroring Increment 9's own test) | `npx vitest run <file>` | all pass |
| Route dynamic-import behavior | `intelligence-satellite-site-route.test.ts` | `route.ts` never statically imports the orchestrator instance; only `await import(...)` inside `GET` | source-inspection | `npx vitest run <file>` | all pass |
| Increment 9 regression | `intelligence-increment-10-contract.test.ts` | Increment 9's own route/handler/orchestrator/projection files are byte-identical (zero diff) to their frozen state; Increment 9's own test suite still passes unmodified | none (reads real frozen files) | `npx vitest run <file>` plus a full `npm test` in Wave 10 | all pass, zero diff |
| Source-inspection purity | `intelligence-increment-10-contract.test.ts`, plus each Wave's own contract test | no forbidden import per Section 9's per-file allow/forbid lists; no `Date.now()`/`Math.random()`/`crypto.randomUUID()` outside the one accepted `node:crypto` `createHash` usage | source-inspection | `npx vitest run <file>` | all pass |

### 11.1 Full isolated Increment 10 test command (from the frozen plan, Section 25)

```
npx vitest run \
  tests/intelligence-satellite-observation-adapter.test.ts \
  tests/intelligence-satellite-evidence-adapter.test.ts \
  tests/intelligence-satellite-evidence-checksum.test.ts \
  tests/intelligence-satellite-provider-port-contract.test.ts \
  tests/intelligence-satellite-site-read-adapter-contract.test.ts \
  tests/intelligence-satellite-legacy-copernicus-provider-contract.test.ts \
  tests/intelligence-satellite-intelligence-orchestrator.test.ts \
  tests/intelligence-satellite-projection-adapter.test.ts \
  tests/intelligence-satellite-site-route.test.ts \
  tests/intelligence-increment-10-contract.test.ts \
  tests/intelligence-increment-10-side-effects.test.ts
```

## 12. Quality gates

### 12.1 Exact gate sequence (every wave)

1. `git diff --check` — no whitespace errors.
2. `npx tsc --noEmit` — TypeScript compiles across the whole repository,
   not just new files.
3. The wave's own targeted `npx vitest run <files>` command (Section 8,
   per wave).
4. `git status --short` — confirms only the files this wave created are
   untracked; nothing pre-existing was modified.

### 12.2 Exact gate sequence (Wave 10, full repository)

1. `npx tsc --noEmit`
2. `npm test` (equivalent to `vitest run`, per `package.json`'s
   `"test": "vitest run"` script — confirmed by direct reading, Section 4)
3. `npm run build` (equivalent to `next build`, per `package.json`'s
   `"build": "next build"` script)
4. `git diff --check`
5. `git status --short`

No implementation wave may proceed to the next wave if its own gate
fails. Wave 10 may not be entered until Wave 9's gate has passed.

### 12.3 Repository-specific commands confirmed during audit

- `npx vitest run <file...>` — the project's actual test runner
  invocation (Vitest 2.1.x, confirmed via `package.json`'s
  `"vitest": "^2.1.0"` devDependency).
- `npm test` → `vitest run` (full suite, no file filter).
- `npm run build` → `next build` (also functions as the project's
  production TypeScript/route-registration check — confirms the new route
  registers exactly once, mirroring Increment 9's own "route appears once
  in `next build` output" gate).
- No separate `npm run typecheck` script exists in `package.json`;
  `npx tsc --noEmit` is run directly, matching every prior increment's own
  gate sequence.

## 13. Risk register

| Risk | Prevention | Detection | Responsible wave | Stop condition |
|---|---|---|---|---|
| Accidental Copernicus type leakage across the port | Port types (Wave 1) built entirely from generic fields per Section 10.2; `sourceAttributes` bag is the only place provider-specific values may live | `intelligence-satellite-provider-port-contract.test.ts`'s source-inspection for `orbitDirection`/`polarization`/`relativeOrbit`/`CopernicusScene` | Wave 1 | Any forbidden literal found in the port file — stop, do not patch around it, report and re-derive the type from Section 10.2 |
| Truth metadata omission | `SatelliteTruthMetadata` is a mandatory, non-optional field in every type that carries it (Wave 1); constructed once, in Wave 3, from `copernicusTruthMetadata()` | `intelligence-satellite-legacy-copernicus-provider-contract.test.ts`'s "cannot be omitted" case; TypeScript's own non-optional field enforcement | Wave 3 | A code path found that can produce a `SatelliteCapabilityOutcome`/envelope without `truthMetadata` when `notFound` is false — stop, do not add a runtime null-check band-aid, fix the construction path |
| Accidental persistence | Literal `false` fifth argument to `copernicusForSite`, never a variable (Wave 3) | `intelligence-increment-10-side-effects.test.ts`'s `WRITE_PATTERNS` sweep; `persist=false` literal-suffix regex check | Wave 3, re-confirmed Wave 9 | Any `WRITE_PATTERNS` match, or a non-literal-`false` `copernicusForSite` call — stop immediately, this is a data-integrity risk, not a cosmetic one |
| Incorrect lookback conversion | `lookbackDaysFromWindow` formula fixed once, in Section 9 of this document, with a `Math.max(1, ...)` floor | `intelligence-satellite-legacy-copernicus-provider-contract.test.ts` boundary cases (1-day window, multi-month window) | Wave 3 | Conversion produces a negative or zero `lookbackDays` for any tested window — stop, the formula itself needs correction, not a call-site workaround |
| Async propagation errors | Every layer from the port through the handler is `async`/`Promise`-returning by construction (Waves 1, 3, 5); the projection adapter is deliberately kept synchronous (Wave 6) and never awaited internally | `intelligence-satellite-intelligence-orchestrator.test.ts`'s behavioral `Promise` confirmation; `intelligence-satellite-projection-adapter.test.ts`'s synchronous-signature confirmation | Wave 5, Wave 6 | A function expected to be synchronous returns a `Promise` (or vice versa) — stop, this breaks the frozen plan's explicit sync/async boundary (Section 10.3.1/15) |
| HTTP/state mismatch | Section 15's table is transcribed once, in Wave 7, with no reinterpretation | `intelligence-satellite-site-route.test.ts` exercising every table row via injected orchestrator outcomes | Wave 7 | Any `SatelliteCapabilityOutcome`/status combination produces an HTTP code not in Section 15's table — stop, do not invent a new mapping, re-read Section 15/17 |
| EvidenceId instability | Fixed formula (Section 9.8), SHA-256 over a trimmed `sourceSceneId`, no timestamp/random component | `intelligence-satellite-evidence-adapter.test.ts`'s determinism assertion (same input → same id across repeated calls) | Wave 4 | Two calls with identical input produce different ids — stop, this is a correctness bug in the checksum/formula implementation, not a test flake |
| sourceSceneId absence | Explicit exclusion + `missing_scene_id` issue, never a fabricated id (Wave 2/4) | `intelligence-satellite-observation-adapter.test.ts`, `intelligence-satellite-evidence-adapter.test.ts` missing-id cases | Wave 2, Wave 4 | Any code path that invents a `sourceSceneId` or silently drops the scene without recording an issue — stop |
| Test brittleness | Deterministic fake provider (`satellite-fake-provider.ts`) resolves immediately via `Promise.resolve`, never a real timer or real network call; all clocks injected | Wave 8's combined-run check (re-run once to confirm no flake) | Wave 5, Wave 8 | Any test fails intermittently across two consecutive runs with no code change — stop, do not retry-loop past it; the nondeterminism itself is the defect |
| Frozen Increment 9 regression | Zero-diff check against every frozen Increment 9 file, every wave (Wave 9's dedicated regression test) | `intelligence-increment-10-contract.test.ts`'s zero-diff assertions; a full `npm test` run in Wave 10 covering Increment 9's own test files unmodified | Wave 9, Wave 10 | Any Increment 9 file differs from its frozen (`b49457d`) state, or any Increment 9 test fails — stop immediately; this is the highest-severity stop condition in this plan |
| Dynamic-import/auth ordering | `requireAdminAuth` checked and returned on strictly before the dynamic `import()` (Wave 7), mirroring Increment 9's own post-audit-hardened convention applied from the start | `intelligence-satellite-site-route.test.ts`'s index-comparison assertion | Wave 7 | Auth check index is not strictly less than the dynamic-import index — stop, this is a security-boundary defect |
| Logging sensitive provider data | Only `.name` (never `.message`/`.stack`/raw payload/credentials/signed URLs) ever logged (Wave 7, Section 21) | `intelligence-satellite-site-route.test.ts`'s sanitized-logging assertions; `console.error` spy inspecting logged argument shapes | Wave 7 | Any logged value beyond the Section 21 allow-list (diagnostic code, `providerCode`, sanitized `.name`, capability state, bounded rejected-scene count/issue codes) — stop |

## 14. Stop rules

### 14.1 Explicit stop conditions

Implementation must stop immediately, without improvising past the
condition, whenever any of the following occurs:

1. **Frozen baseline changed** — `git rev-parse --short HEAD` no longer
   returns `9dc6f02` (or the then-current frozen commit), or
   `genesis-phase-2-increment-10-plan-v1` no longer points at it, without
   an explicit, separate re-freeze authorization having occurred first.
2. **Plan contradiction discovered** — this execution plan or the frozen
   planning document is found to contradict itself or the real repository
   state (e.g. a named legacy function signature has changed since the
   planning document was written).
3. **Required legacy behavior differs from the approved plan** — direct
   inspection of `copernicus-engine.ts`/`copernicus-truth.ts` at
   implementation time reveals behavior inconsistent with Section 4's
   audit findings above (e.g. `persist` no longer gates every write, or
   `copernicusTruthMetadata()` no longer returns
   `isRealSatelliteEvidence: false`).
4. **Production file outside the approved inventory requires modification** —
   any of the 13 files in Section 7, or any existing file not listed there,
   is found to need a change this plan did not anticipate.
5. **Test failure in a frozen capability** — any test under
   `tests/intelligence-increment-7-*`, `tests/intelligence-increment-8-*`,
   `tests/intelligence-increment-9-*`, or any Data Trust/Evidence
   Center/Site Intelligence Aggregator test, fails at any point during
   Increment 10 implementation.
6. **Build failure unrelated to the current wave** — `npm run build` or
   `npx tsc --noEmit` fails in a way traceable to a file outside the
   current wave's own scope.
7. **Persistence cannot be guaranteed false** — the literal-`false`
   requirement (Section 6/13) cannot be structurally satisfied for any
   reason (e.g. a legacy code path is found that persists regardless of
   the `persist` argument).
8. **Truth metadata cannot be structurally guaranteed** — a code path is
   found where a non-`notFound` result can be constructed without
   `SatelliteTruthMetadata`, and TypeScript's own type system cannot be
   made to prevent it.

### 14.2 In any stop condition

- Stop implementation at the current wave; do not proceed to the next
  wave.
- Do not improvise a workaround, silent scope expansion, or
  reinterpretation of the frozen plan to route around the discrepancy.
- Report the discrepancy precisely: which condition triggered, which
  file/test/command, and the exact observed vs. expected state.
- Do not broaden scope, modify a frozen file, or touch a file outside the
  approved inventory (Section 7) without a new, explicit, separate
  authorization from the user.

### 14.3 Scope-escalation rule

If resolving a stop condition would require modifying any file not listed
in Section 7, or any file frozen by a prior increment, that modification
is out of this plan's authorization entirely — it requires the user's
explicit, separate sign-off, exactly as this session's established
protocol has required for every prior increment (e.g. the single
authorized Increment 8 test fix during Increment 9 implementation, which
was proposed, explicitly authorized, then executed — never assumed).

### 14.4 Rollback rule

Each wave's own "Rollback boundary" (Section 8) is the authoritative
scope of what may be reverted for that wave's own failure — never a
blanket `git reset`/`git clean` across waves, and never touching a file
outside the failing wave's own created-file list. Since nothing is staged
or committed until a future, separately authorized freeze mission
(mirroring Increment 9's own protocol), any wave's rollback is a simple
`rm` of that wave's own newly created files — git history is never
altered by this plan.

## 15. Definition of done

Increment 10 implementation is done only when every one of the following
holds simultaneously:

1. All 13 approved production files (Section 7) exist, each matching its
   Batch 3 specification exactly (allowed/forbidden imports, exports,
   sync/async behavior, side-effect policy).
2. All 11 approved test files (Section 7) exist and pass.
3. Only `services/intelligence-adapters/io/legacy-copernicus-provider.ts`
   imports `copernicus-engine.ts`/`copernicus-truth.ts` (Section 10.3,
   confirmed by repository-wide grep returning exactly one match).
4. Only the two `io/` files touch the database directly (Section 10.4).
5. `satellite-projection-adapter.ts` is synchronous; the provider port,
   orchestrator, and orchestrator-instance are asynchronous (Section
   10.1/10.2/10.5, confirmed behaviorally, not just by type).
6. `SatelliteTruthMetadata` is present and structurally mandatory on every
   non-`notFound` result, with `realSatelliteEvidence: false` on every
   response the legacy provider produces.
7. Every `copernicusForSite` call site ends in a literal `, false)`.
8. No existing production file (any of Increments 0–9's own files) has
   changed — confirmed by a zero-diff check against the frozen baseline.
9. No file outside the approved 24-file inventory (13 production + 11
   test) was created.
10. `npx tsc --noEmit`, `npm test`, `npm run build`, and `git diff --check`
    all pass, in that order, against the full repository.
11. `git status --short` shows exactly the 24 new files as untracked and
    nothing else.
12. `config/capabilities.json` and every canonical engine manifest remain
    byte-identical to their pre-Increment-10 state.
13. Nothing is staged, committed, tagged, or pushed — that remains a
    separate, future, explicitly authorized freeze mission.

## 16. Exact implementation order

Waves must execute strictly in this order; no wave may begin before its
listed dependency wave's gate has passed (Section 8 restates each wave's
own dependency):

```
Wave 0  → Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5
       → Wave 6 → Wave 7 → Wave 8 → Wave 9 → Wave 10
```

Waves 1 and 2 have no dependency on each other's *output* beyond both
depending on Wave 1's own types where Wave 2 needs `SatelliteProviderScene`/
`SatelliteObservation` — Wave 2 depends on Wave 1, not the reverse, so the
strict order above (1 before 2) is correct and not arbitrarily chosen.

**Wave 3's architectural dependency is Wave 1 only (hardening correction
F-4).** Both Wave 3 files' "Allowed imports" (Section 9.4/9.5) reach only
Wave 1's two files (`satellite-observation-model.ts`,
`satellite-intelligence-provider-port.ts`) — neither imports
`satellite-observation-adapter.ts` (Wave 2). The
`lookbackDaysFromWindow` helper consumes only the Wave 1
`SatelliteTemporalWindow` type. Placing Wave 3 after Wave 2 in the linear
order above is a deliberate **execution-control** choice (build the
smaller, self-contained pieces — canonical models, the port, then the
pure observation-classification logic — before the DB-touching files, so
the pure/I/O boundary is exercised in a fixed, predictable sequence every
time), not a static module dependency; nothing prevents Wave 3 from being
implemented immediately after Wave 1, and no wave's own gate (Section 8)
actually requires Wave 2's output as an input. No wave may be reordered,
skipped, or merged with an adjacent wave without a new, explicit
authorization — the sequence above remains binding regardless of which
dependencies are architectural versus execution-control choices.

## 17. Final implementation authorization checkpoint

This document, by itself, does **not** authorize implementation to begin.
Per this project's own established protocol (identical to Increment 9's
own planning → review → hardening → final-focused-re-review → freeze
sequence, and to Increment 10's own planning lifecycle already completed
in this session), a future, separate, explicit mission must:

1. Reference this document by its exact frozen commit/tag (once this
   document is itself frozen — a separate, future freeze mission, not
   part of this one).
2. Explicitly authorize implementation to begin, naming which wave(s) are
   authorized (typically Wave 0 through some bounded stopping point, not
   necessarily all 11 waves in one authorization, mirroring this
   session's own batched-authorization pattern used for planning
   hardening).
3. Restate the binding constraints this document encodes (Sections 6, 13,
   14) as still in force.

Until such a mission is issued, no file in Section 7's inventory may be
created.

### 17.1 Expected implementation artifacts (once authorized)

- 13 production files (Section 7), matching Section 9's specifications.
- 11 test files (Section 7), matching Section 11's matrix.
- A future `31_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION.md`
  record document (written only after all 11 waves' gates pass, not part
  of this plan or its authorization).

### 17.2 Expected final verification commands (once implementation completes)

```
npx tsc --noEmit
npm test
npm run build
git diff --check
git status --short
git diff --stat
```

Expected `git status --short` output at that point: exactly 24 new
(`??`) files, no modified (`M`) files, nothing staged.

### 17.3 Explicit statement

**This document does not itself start implementation.** No file listed in
Section 7 has been created by this document. No test has been created or
modified. No production file has been created or modified. This document
is itself the only file this mission created, and it will remain
untracked and unstaged until a separate, explicit instruction says
otherwise.

## Final Implementation Plan Review Hardening

| Finding | Status | Corrected sections | Resolution |
|---|---|---|---|
| F-1 | RESOLVED | 9.5, 9.10, 11 (new "Exception ownership" row) | `legacy-copernicus-provider.ts`'s `fetch()` is now the single, sole owner of the legacy-call exception: it never rejects, catching any exception locally and resolving `{kind:"unavailable", reason:"unexpected_error"}`, with truth metadata preserved on this path. The orchestrator's own `try`/`catch` is now explicitly a distinct, narrower defensive fallback for provider-contract violations, wiring failures, or its own composition-logic exceptions only — never the primary owner of the normal `unexpected_error` case. A dedicated test-matrix row makes both paths concretely, separately testable. |
| F-2 | RESOLVED | 9.8 | The stray "Wave 6" reference is corrected to "Wave 2" — `satellite-observation-adapter.ts` (Section 9.6) is restated as the sole owner of missing-`sourceSceneId` exclusion; `satellite-projection-adapter.ts` (Wave 6) is explicitly confirmed to have no missing-id responsibility, since it never touches a `SatelliteObservation` directly. |
| F-3 | RESOLVED | 10 | The dependency graph is redrawn as explicit, labeled branches (provider, observation, evidence, site-read) using only real static-import edges taken directly from each file's own "Allowed imports" (Section 9), with a separate "Composition (Wave 5)" subsection using `receives <-` for runtime data-flow relationships that are not imports. The evidence branch now correctly shows `satellite-evidence-checksum.ts`/`satellite-evidence-adapter.ts` importing only from `satellite-observation-model.ts` and each other — never from `satellite-observation-adapter.ts` or either `io/` file. |
| F-4 | RESOLVED | 8 (Wave 3), 16 | Wave 3's stated dependency is corrected to Wave 1 only, matching Section 9.4/9.5's actual "Allowed imports" (neither Wave 3 file imports `satellite-observation-adapter.ts`). Section 16 now states plainly that placing Wave 3 after Wave 2 in the linear execution order is a deliberate execution-control choice, not a module dependency — Wave 3 could be implemented immediately after Wave 1. |
| F-5 | RESOLVED | 11 (Retryability row) | The Retryability row now states explicitly that retryability is not a public response-body field and is never introduced as a `retryable` JSON field, then specifies the concrete, deterministic assertion used instead: one case per `reason` (`misconfigured`/`invalid_credentials`, `timeout`, `rate_limited`, `unexpected_error`), each naming its expected aggregate classification, HTTP status, diagnostic code, and sanitized-logging behavior. |
| F-6 | NOTED — NO CHANGE | 9.3 | `satellite-fake-provider.ts` remains classified exactly as the frozen plan's own Section 23 inventory states — one of the 13 production files, inventory count unchanged, not moved to `tests/`. One short, purely informational clarification was added: it is shipped in the production source tree but is exclusively deterministic test support, and `satellite-intelligence-orchestrator-instance.ts` must never import it. |
| Final editorial graph-direction correction | RESOLVED | 10 | Every solid arrow in Section 10 now follows exactly one convention, `IMPORTER -> IMPORTED MODULE`, stated explicitly in the Legend. The Provider/Observation/Evidence/Site-read branches (previously drawn backwards relative to the Legend's own definition) are inverted to match; the "Real wiring" cluster (already correct) is unchanged. Dynamic import is now visually distinct (`--dynamic import after auth-->`), and runtime composition/data flow uses `receives <-`, never a plain `->`, so it cannot be mistaken for a static import. Every arrow re-checked against Section 9's "Allowed imports" lists; no new import was invented. |

No architectural decision from `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
was changed by this hardening pass — every correction above was applied
exclusively to this execution-plan document's own internal consistency
(exception-handling ownership, a mislabeled wave reference, dependency-graph
accuracy, an over-justified wave-ordering claim, and one test-matrix row's
concreteness). No production file, test file, or frozen document was
touched.
