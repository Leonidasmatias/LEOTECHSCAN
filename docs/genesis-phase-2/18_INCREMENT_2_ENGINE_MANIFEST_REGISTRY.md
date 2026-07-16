# 18 — Increment 2: Engine Manifest / Runtime Registry (Genesis Phase 2)

Status: **Implemented** (infrastructure scope only — see "Roadmap reconciliation" for how
this differs from the roadmap's full Increment 2 acceptance criteria).

## Roadmap reconciliation

`docs/genesis-phase-2/14_IMPLEMENTATION_ROADMAP.md` numbers increments as:

- **Increment 0** — native baseline verification and security floor. Done, tagged
  `genesis-phase-2-increment-0-v1` (commit `306dcf5`).
- **Increment 1** — Architecture Freeze itself ("formally close this Genesis Phase 2.0
  mission — the seventeen documents in `docs/genesis-phase-2/` become the binding
  reference for every subsequent increment"; acceptance criterion: `00_EXECUTIVE_SUMMARY.md`'s
  "Architecture frozen: Yes" status is true). **This was already satisfied before
  Increment 0 began** — commit `aa32e3a`, tag `genesis-phase-2-architecture-v1`, the
  seventeen frozen documents under `docs/genesis-phase-2/`. `00_EXECUTIVE_SUMMARY.md` line 3
  already reads "Architecture frozen: **Yes**". No architecture-freeze work is repeated by
  this increment; no second architecture-freeze commit was created; no historical
  commit/tag was renumbered.
- **Increment 2** — Engine manifest and registry runtime: "build `services/intelligence-runtime/`
  (the `EngineRegistry` singleton + the `EngineManifest` type/validator from
  `07_ENGINE_MANIFEST.md`), and register the eleven canonical engine ids at `\"planned\"`
  status... no engine logic yet." This is the increment this document records.

No conflicting text was found in the frozen documents — the roadmap's own numbering
matches exactly what this mission's brief described (Architecture Freeze already done,
next executable increment is Engine Manifest + Runtime Registry). No STOP condition on
roadmap disagreement was triggered.

**Deliberate scope narrowing versus the roadmap's literal Increment 2 text**, decided
during implementation and recorded here rather than silently applied: the roadmap's
Increment 2 acceptance criterion is "`GET /api/intelligence/engines` (new, minimal) lists
all eleven engines at `planned`." This mission's own "Absolute scope" explicitly forbids
new API endpoints in this pass, and its Step 6 instruction overrides "register all eleven"
with "add only the minimum manifests justified by the current repository... do not add
manifests for speculative engines that have no concrete roadmap consumer in the next
increments." Given that instruction, this increment:

- builds the full manifest model and validator generically (it accepts any of the eleven
  canonical ids, or any future id — nothing about the type or validator is limited to 3
  engines);
- populates full `EngineManifest` declarations (the richer 07-shape, not Phase 1's plain
  `EngineDeclaration`) for exactly **three** engines with concrete near-term roadmap
  consumers: `data-trust` (Increment 4), `confidence` (declared per Phase 1's own
  baseline and ADR-004), `recommendation` (Increment 6);
- does **not** yet populate full manifests for the remaining eight canonical ids
  (`risk`, `opportunity`, `priority`, `machine-learning`, `simulation`, `forecast`,
  `optimization`, `executive-ai`) or build the `/api/intelligence/engines` listing route.

This is flagged, not hidden: closing this gap (bulk-registering the remaining eight
placeholders at `planned` status plus the read-only listing endpoint) is cheap and is
recorded as a **candidate fast-follow**, not silently claimed as done. See "Limitations"
and "Go/no-go" below.

## Why Architecture Freeze was not repeated

`aa32e3a` / `genesis-phase-2-architecture-v1` already produced all seventeen frozen
documents, `00_EXECUTIVE_SUMMARY.md` already asserts "Architecture frozen: Yes", and that
commit predates Increment 0 in this repository's actual history (`git log`: `aa32e3a` →
then `306dcf5`, the Increment 0 commit, on top of it). Redoing it would create a second,
redundant architecture-freeze commit and contradict "Do not renumber existing historical
commits or tags" / "Do not create a second architecture-freeze commit" — both explicitly
forbidden for this mission.

## Baseline

Re-verified natively at the start of this session, before any file in this increment was
touched:

- Repository root: `C:/LEOTECHSCAN/APP`
- Branch: `master`
- HEAD: `306dcf5`
- Tag at HEAD: `genesis-phase-2-increment-0-v1`
- `origin/master`: `306dcf5` (matches local HEAD)
- Working tree: clean
- `npx tsc --noEmit`: PASS (no output)
- `npm test`: 26 test files, 223/223 tests PASS
- `npm run build`: PASS (identical route list/bundle sizes to the prior recorded build)

No stop condition (repository root, branch, HEAD, tag, working tree, origin sync, or any
baseline gate) was triggered.

## Files inspected before implementation

- `docs/genesis-phase-2/00_EXECUTIVE_SUMMARY.md`, `04_ENGINE_LIFECYCLE.md`,
  `07_ENGINE_MANIFEST.md`, `12_DEPENDENCY_GRAPH.md`, `14_IMPLEMENTATION_ROADMAP.md`,
  `15_ARCHITECTURE_DECISIONS.md`, `16_QUALITY_GATES.md`, `17_INCREMENT_0_SECURITY_FLOOR.md`
- `services/intelligence/index.ts` (public barrel — confirms the full contract surface
  intended for reuse)
- `services/intelligence/registry/engine-registry.ts`, `engine-identity.ts`, `index.ts`
- `services/intelligence/versioning/version.ts`, `compatibility.ts`, `index.ts`
- `services/intelligence/errors/intelligence-error.ts`, `error-codes.ts`, `index.ts`
- `services/intelligence/validation/validators.ts`, `result.ts`, `index.ts`
- `services/intelligence/types/common.ts`, `identifiers.ts`, `index.ts`
- `services/intelligence/entities/index.ts` (confirms `CANONICAL_ENTITY_KINDS` includes
  `"Evidence"`, `"Score"`, `"Recommendation"` as **entity kinds**, distinct from
  `CANONICAL_ENGINE_IDS`)
- `config/capabilities.json` (all 22 current entries)
- `tests/intelligence-registry.test.ts` (existing `EngineRegistry` test pattern, reused)
- A repository-wide search for `EngineRegistry`, `EngineDeclaration`, `EngineIdentity`,
  `CANONICAL_ENGINE_IDS`, and any import of `@/services/intelligence` outside `tests/`
  and `services/intelligence/` itself, to confirm current usage.

## What already existed vs. what this increment adds

- `EngineRegistry` (Phase 1) exists, is fully implemented, and is well-tested
  (`tests/intelligence-registry.test.ts`) — but **zero production consumers**:
  `new EngineRegistry()` is called nowhere outside that one test file (confirmed by
  repository-wide search; also independently documented by
  `docs/GENESIS_PHASE_2_PRE_IMPLEMENTATION_AUDIT.md` line 141). No duplicate or parallel
  registry implementation existed anywhere before this increment (Stop condition 11 did
  not trigger).
- `EngineDeclaration` (Phase 1) is a plain, flat declaration (id/name/description/status/
  version/capabilities/owner) — it has no manifest-level fields (`capabilityKey`,
  `dependencies`, `supportsBatch`, `securityRequirement`, etc.). This increment's
  `EngineManifest` extends it, per `07_ENGINE_MANIFEST.md`'s own resolution, rather than
  replacing or modifying it.
- `CANONICAL_ENGINE_IDS` (Phase 1, `services/intelligence/registry/engine-identity.ts`)
  already names exactly eleven ids: `risk`, `opportunity`, `confidence`, `priority`,
  `data-trust`, `recommendation`, `machine-learning`, `simulation`, `forecast`,
  `optimization`, `executive-ai`. `EngineId` is deliberately open (`string & {}`), so new
  ids are structurally permitted but the eleven above are the only ones Phase 1 itself
  named.
- No `services/intelligence-runtime/` directory, `EngineManifest` type, manifest
  validator, or runtime registry wrapper existed before this increment. This is entirely
  new, additive code.
- `services/intelligence/**` was **not modified** by this increment (confirmed by the
  final diff below) — every new file lives under the new, separate
  `services/intelligence-runtime/` directory, per `14_IMPLEMENTATION_ROADMAP.md` Increment
  2's own file list ("default to keeping it in intelligence-runtime/ per Principle 13's
  conservatism about touching services/intelligence/ itself").

## Manifest model

New directory: `services/intelligence-runtime/`.

- **`engine-manifest.ts`** — `EngineManifest` (extends Phase 1's `EngineDeclaration`),
  `ManifestPort`, `ManifestObservability`, the `SecurityRole`/`HealthCheckKind`/
  `ManifestScope` closed unions (restating `10_SECURITY_BOUNDARY.md`'s six roles and
  `07_ENGINE_MANIFEST.md`'s two other closed vocabularies), and `freezeManifest()` (a
  recursive-freeze utility). Every field is `readonly`. The shape has no free-form
  metadata bag and no field capable of holding a secret or environment value by
  construction — there is nowhere in the type for one to go.
- **`engine-manifest-validation.ts`** — `validateEngineManifestShape(value: unknown)`,
  following `services/intelligence/validation/validators.ts`'s exact pattern: structural
  only, returns the shared `ValidationResult`/`ValidationIssue` types (imported, not
  redeclared), never echoes a received runtime value back into an issue message.
- **`canonical-engine-manifests.ts`** — the three concrete initial manifests (see below).
- **`runtime-engine-registry.ts`**, **`registry-instance.ts`**, **`index.ts`** — the
  runtime registry boundary (next section).

### Validation rules implemented

- `id`, `name`, `description` — non-empty strings (inherited `EngineDeclaration` fields).
- `status` — must be one of Phase 1's existing closed
  `ENGINE_DECLARATION_STATUSES` (`"planned" | "active" | "deprecated"`) — this union was
  **not** extended, per Principle 13 and `07_ENGINE_MANIFEST.md`'s own instruction.
- `capabilities` — array of strings (inherited).
- `version` — must be present (an `EngineVersionInfo`-shaped object).
- `engineVersion`, `contractVersion` — must parse as a valid semantic version via the
  existing, reused `parseSemanticVersion()` (`services/intelligence/versioning/compatibility.ts`)
  — no second semver parser was written.
- `configurationVersion`, `capabilityKey` — non-empty strings.
- `dependencies` — array of non-empty engine-id strings; duplicate ids rejected; an id
  equal to the manifest's own `id` rejected ("cannot depend on itself").
- `supportsPreview`, `supportsPersistence`, `supportsBatch` — booleans.
- `maxBatchSize` — must be a positive number when `supportsBatch` is `true`; must be
  `null` when `supportsBatch` is `false`.
- `supportedScopes` — if present, every entry must be one of `site`/`municipality`/
  `state`/`global`.
- `securityRequirement` — must be one of `10_SECURITY_BOUNDARY.md`'s six roles.
- `inputs`/`outputs` — if present, each entry validated as a `ManifestPort`
  (`name`/`shape` non-empty strings, `required` boolean).
- `observability` — must be an object; `emitsEvents` an array of strings; `healthCheck`
  one of `none`/`self`/`dependency-chain`.
- **No executable functions anywhere in the manifest** — a recursive scan
  (`findFunctionPaths`) rejects any function-typed value at any depth.
- `capabilityKey` is validated **structurally only** (non-empty string) — it is not
  cross-checked against the live `config/capabilities.json` in this increment.
  `07_ENGINE_MANIFEST.md` itself assigns that cross-reference to `16_QUALITY_GATES.md`'s
  separate mechanical script, not to the structural shape validator (matching
  `validators.ts`'s own stated "structural only, not business-rule" boundary). That
  script was not built in this increment (no new API endpoint, no build-tooling changes
  requested). Consequence: `confidence`'s and `recommendation`'s `capabilityKey` values
  below do **not** currently resolve to a `config/capabilities.json` entry — documented
  as a known, deliberate gap in "Limitations," not silently glossed over.

## Runtime registry ownership

`RuntimeEngineRegistry` (`runtime-engine-registry.ts`) composes around Phase 1's
`EngineRegistry` — it holds one private `EngineRegistry` instance and does not
reimplement duplicate-detection or not-found handling: every `DuplicateEngineDeclarationError`
and `EngineNotRegisteredError` a caller sees is the same typed error class
`EngineRegistry` already raises, unmodified. `RuntimeEngineRegistry` adds exactly three
things `EngineRegistry` doesn't have: (1) manifest-shape validation before declaring, (2)
a check that every declared dependency id is already registered, and (3) freezing the
manifest before storage. Its public surface is `register`, `getManifest`, `hasManifest`,
`listManifests`, `listManifestsByStatus` — no `update`/`unregister`/`execute`/`run` method
exists, so a caller cannot mutate a prior declaration or execute anything through it.

**Single owner**: `registry-instance.ts` exports one singleton,
`runtimeEngineRegistry`, matching `00_EXECUTIVE_SUMMARY.md` Q12's answer verbatim
("A singleton in `services/intelligence-runtime/registry-instance.ts`... Only
manifest-declaring adapter modules register into it at module load; no runtime/dynamic
registration from request-handling code"). Construction is a pure, synchronous loop over
the fixed, ordered `CANONICAL_ENGINE_MANIFESTS` array — no I/O, no environment read, no
randomness — so it is deterministic by construction and behaves identically on every
process start.

**Dependency-cycle prevention**: `register()` requires every dependency id to already be
registered. Because registration is a single forward pass with no "declare now, resolve
later" step, a cycle (A depends on B, B depends on A) is structurally impossible to
construct — whichever of A/B is registered first would fail immediately on the
not-yet-registered other. This is enforced by construction, not by a separate
graph-traversal cycle detector (a simpler mechanism was sufficient given the roadmap's
current dependency shape).

**No database, no Next.js, no legacy-engine execution, no `sentinel-core` coupling**:
verified both by direct code review (no such imports appear in any of the five new
`.ts` files) and by `tests/intelligence-runtime-registry.test.ts`'s source-inspection
tests, which read every file in `services/intelligence-runtime/` via `fs.readFileSync`
and assert none of them import `node:sqlite`, `next`/`next/server`, `@/lib/db`,
`@/app/api/**`, `sentinel-core`, or any `services/*-engine.ts` module.

## Initial canonical manifests

Evaluated per Step 6, against real repository evidence:

| Engine id | Canonical `EngineId`? | Legacy implementation? | Canonical adapter? | Concrete near-term consumer? | Decision |
|---|---|---|---|---|---|
| `data-trust` | Yes (Phase 1's 11) | Yes — `services/data-trust-engine.ts` | No | Increment 4 (Data Trust Score Adapter) | **Manifest registered**, `status: "planned"` |
| `confidence` | Yes (Phase 1's 11) | Yes — `services/confidence-engine.ts`, but ADR-004 (`15_ARCHITECTURE_DECISIONS.md`) determined its actual behavior is a Trust *input*, not the canonical Confidence concept | No | Reserved by Phase 1's own baseline (declared, not implemented) | **Manifest registered**, `status: "planned"`, explicitly does not wrap `confidence-engine.ts` |
| `recommendation` | Yes (Phase 1's 11) | Partial/scattered (e.g. `data-trust-engine.ts`'s `recommendation()` text, dashboard alerts) — no dedicated engine file | No | Increment 6 (Recommendation Adapter) | **Manifest registered**, `status: "planned"` |
| `risk` | Yes (Phase 1's 11) | No | No | **None** — `00_EXECUTIVE_SUMMARY.md` Q3 explicitly states "a Risk Score is explicitly out of scope for Phase 2.0 and not scheduled in `14_IMPLEMENTATION_ROADMAP.md`" | **Evaluated, not registered this increment** — no concrete roadmap consumer, matches the mission's own exclusion rule |
| `data-quality` | **No** — not one of Phase 1's 11 canonical `EngineId`s at all | Yes — `services/data-quality-engine.ts` | No | Not sequenced in Increments 3–6 | **Evaluated, not registered** — registering it would require first adding a new id to the canonical set, a reviewed decision this increment does not make unilaterally |
| `evidence` | **No** — `"Evidence"` is a canonical **entity/contract kind** (`CANONICAL_ENTITY_KINDS`, `services/intelligence/entities/index.ts`), not an `EngineId`. There is no "Evidence Engine" concept anywhere in the frozen architecture; Evidence is *cited* by Score/Recommendation adapters, never computed by its own engine. | Partially — `services/evidence-center-engine.ts` exists but produces a dossier, not a Score | N/A | Increment 5 names an "Evidence adapter," but adapts the existing `Evidence` **contract**, not a new engine | **Evaluated, not registered** — this is a category distinction worth surfacing: "Evidence adapter" (Increment 5) does not imply an "evidence" `EngineId` |

Every registered manifest declares `dependencies: []`. This is not an oversight:
`07_ENGINE_MANIFEST.md`'s own dependency-declaration rule states a dependency "becomes
declarable" only once the depended-upon engine's adapter exists — no adapter exists for
any engine yet in this increment (adapters begin at Increment 3), so no manifest can
honestly declare a dependency yet, even where `12_DEPENDENCY_GRAPH.md` names a future
relationship (e.g. Recommendation eventually depending on a Score adapter, and citing
Evidence as a peer, not a `dependencies`-array entry, per that document's own text:
"Score Adapters cite Evidence by `EvidenceId` reference (never embed) → Evidence Adapter
is a peer dependency of every Score Adapter, not a child of it").

## Truthful lifecycle statuses

All three registered manifests are `status: "planned"`. None is `"active"`. This
matches `04_ENGINE_LIFECYCLE.md`'s definition precisely: `"planned"` covers "every engine
Genesis Phase 1 declares but does not implement... this phase is architecture only" —
still true here, since no canonical adapter exists for any of the three. A legacy
engine's existence (`data-trust-engine.ts`, `confidence-engine.ts`) is explicitly not
conflated with the canonical engine being operational — this is asserted by a test
(`intelligence-runtime-registry.test.ts`, "no registered canonical engine is marked
operational/active prematurely") and is true of every manifest in
`canonical-engine-manifests.ts`.

## Capability-registry consistency decision

`config/capabilities.json` was inspected in full (22 entries) and **left unchanged**.
Reasoning: this increment adds infrastructure with zero production consumers so far (no
route reads the new registry, no UI surfaces it) — updating a **user-facing** truth file
to reflect internal infrastructure that nothing yet uses would misrepresent what the
interface can actually claim (Principle 16). `16_QUALITY_GATES.md`'s gate 12 states the
default explicitly: "updated only if the increment's own stage calls for it (default:
unchanged, since most increments precede stage 6)" — this increment precedes stage 6 by a
wide margin (it precedes even the first adapter, Increment 3).

One existing entry, `data_trust` (`status: "operational"`), is reused as-is for the
`data-trust` manifest's `capabilityKey` — a legitimate, honest match, since that key
already describes the real, operational *legacy* Data Trust feature the manifest's
description explicitly distinguishes itself from. `confidence`'s and `recommendation`'s
chosen `capabilityKey` values (`confidence_scoring`, `recommendation_engine`) do **not**
currently resolve to any entry in `config/capabilities.json` — a documented, known gap
(see "Limitations"), not an invented mapping presented as real.

## API behavior changed: **No.** Database changed: **No.**

No route, response shape, status code, formula, schema, or UI file was touched. No new
dependency was added; `package.json`/`package-lock.json` are untouched. Authentication
behavior from Increment 0 (`lib/auth-guard.ts`, the two protected POST routes) is
untouched.

## Tests

- **`tests/intelligence-engine-manifest.test.ts`** — 12 tests. Valid manifest passes;
  every registered canonical manifest independently passes; invalid semver fails; missing
  `id` fails; invalid `status` fails; non-positive `maxBatchSize` under `supportsBatch`
  fails (both `0` and negative, plus the `null`-when-batch-true case, plus a correct
  positive case); duplicate dependency ids fail; self-dependency fails; an
  open/unknown engine id (`"a-brand-new-future-engine"`) still validates successfully,
  proving `EngineId`'s open-endedness is preserved; a validation-error message never
  contains the malformed value itself (a planted canary string); `freezeManifest()`
  produces a genuinely immutable object (top-level, nested `observability`, and nested
  `inputs` array all frozen; a mutation attempt throws); a manifest containing an
  executable function anywhere is rejected.
- **`tests/intelligence-runtime-registry.test.ts`** — 17 tests, covering: deterministic
  singleton initialization (registration order matches `CANONICAL_ENGINE_MANIFESTS`'s
  declared order); the three expected manifests are present; `risk`/`data-quality`/
  `evidence` are confirmed absent; duplicate registration on a fresh registry throws
  `DuplicateEngineDeclarationError`; unknown-id lookup throws `EngineNotRegisteredError`;
  a registered manifest's identity/version match what was passed in; the registry exposes
  no `execute`/`run`/`invoke` method (structurally cannot run anything); no registered
  manifest is `"active"`; repeated `listManifests()` calls return the same ordering and
  the same count (no duplication); a dependency on a not-yet-registered id throws, the
  same dependency succeeds once the parent is registered first; every registered
  manifest currently declares `dependencies: []`; and three source-inspection tests
  confirm no file in `services/intelligence-runtime/` imports `node:sqlite`,
  `next`/`next/server`, `@/lib/db`, `@/app/api/**`, `sentinel-core`, or any
  `services/*-engine.ts` module as an actual import (comments referencing those legacy
  files as evidence are permitted and do occur, by design, in
  `canonical-engine-manifests.ts`'s descriptions).

Total new tests this increment: **29** (12 + 17), all pure, no `node:sqlite`, no I/O.

## Quality gates

Recorded verbatim in the final report (this document is written before that final run
completes; see the conversation's closing message for the actual before/after numbers).
Expected: `tsc --noEmit` clean, all pre-existing 223 tests plus 29 new tests passing
(252 total), `next build` unchanged in route list and bundle size, diff limited to the
files named below.

## Limitations

- **Eight of the eleven canonical engine ids have no `EngineManifest` yet**
  (`opportunity`, `priority`, `machine-learning`, `simulation`, `forecast`,
  `optimization`, `executive-ai`, and `risk`) — deliberately narrowed per this mission's
  own Step 6 instruction, as reconciled above. Phase 1's plain `EngineDeclaration`
  concept still conceptually covers "declared" for all eleven (unchanged,
  `services/intelligence/registry/**` untouched); this increment's richer manifest layer
  covers only three. Closing this gap (bulk `planned` manifests for the remaining eight)
  is a cheap, low-risk fast-follow, not attempted here to avoid inventing
  `capabilityKey`/`securityRequirement` values with no real evidence behind them.
- **No `GET /api/intelligence/engines` route** — the roadmap's literal Increment 2
  acceptance criterion names this endpoint; this mission's "Absolute scope" explicitly
  forbids new API endpoints this pass. The registry is fully queryable in-process
  (`runtimeEngineRegistry.listManifests()`) but nothing outside `services/intelligence-runtime/`
  and its tests currently imports it.
- **`capabilityKey` is not cross-checked against `config/capabilities.json`** — deferred
  to `16_QUALITY_GATES.md`'s separate mechanical script, not built this increment.
  `confidence_scoring` and `recommendation_engine` are forward-declared keys that do not
  yet resolve to a real entry — a known, truthful gap, not a silent invention.
  `data_trust` (used by the `data-trust` manifest) does resolve — it is the one
  already-correct match.
- **No orchestrator, no adapter, no engine logic** — by design; this increment is
  infrastructure only, exactly as chartered.

## Rollback

Delete the entire `services/intelligence-runtime/` directory (all six files:
`engine-manifest.ts`, `engine-manifest-validation.ts`, `canonical-engine-manifests.ts`,
`runtime-engine-registry.ts`, `registry-instance.ts`, `index.ts`), and delete
`tests/intelligence-engine-manifest.test.ts` and `tests/intelligence-runtime-registry.test.ts`.
Nothing outside these eight new files was modified — `services/intelligence/**`,
`config/capabilities.json`, every route, and every legacy engine are all untouched, so
rollback is a pure file-deletion with no migration, schema, or dependency implication.

## Go/no-go for the Site Entity Adapter (Increment 3)

**Go**, with the fast-follow noted above (remaining eight placeholder manifests + the
listing endpoint) recorded as optional, low-risk follow-up work, not a blocker. This
increment's core acceptance bar — a reusable, validated, tested `EngineManifest` model
and a `RuntimeEngineRegistry` that composes around Phase 1's existing `EngineRegistry`
without duplicating it, without executing any legacy engine, and without falsely marking
any canonical engine operational — is met. Increment 3 (Site Entity Adapter) depends on
this increment only for sequencing clarity per the roadmap, not on any specific manifest
content here, so it may proceed once separately chartered.
