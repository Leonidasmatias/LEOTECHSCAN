# 19 — Increment 3: Site Entity Adapter (Genesis Phase 2)

Status: **Implemented**.

## 1. Objective

Build the first explicit, tested, pure bridge between the legacy site row
shape (`services/site-service.ts`'s `siteRow()`, typed as `lib/types.ts`'s
`SiteRow`) and the canonical `Site` entity
(`services/intelligence/entities/site.ts`) — per
`docs/genesis-phase-2/02_CANONICAL_DOMAIN_MODEL.md`'s "Site" section and
`08_ADAPTER_STRATEGY.md`'s adapter #1. Adapter-only: no other adapter, no
orchestrator, no new API route, no persistence, no engine execution.

## 2. Verified starting baseline

- Repository: `C:/LEOTECHSCAN/APP`
- Branch: `master`
- HEAD: `f06997b`
- Tag at HEAD: `genesis-phase-2-increment-2-v1`
- `origin/master`: `f06997b` (matches local HEAD)
- Working tree: clean
- `npx tsc --noEmit`: PASS (no output)
- `npm test`: 28 test files, 252/252 tests PASS
- `npm run build`: PASS

No stop condition triggered.

## 3. Roadmap alignment

`14_IMPLEMENTATION_ROADMAP.md` Increment 3 ("Site entity adapter... per
`08_ADAPTER_STRATEGY.md`'s adapter #1. **Objective:** first canonical entity
translation, pure, unit-tested, not yet wired into any route.") matches this
mission's brief exactly. `08_ADAPTER_STRATEGY.md` additionally names the
expected file path explicitly: `services/intelligence-adapters/site-entity-adapter.ts`
("pure, `siteRow() → EntityReference<"Site">`/`Site`. No DB access of its
own (the caller already has the row). First because every other adapter
needs an `EntityReference` to attach its output to."). No material
disagreement was found between the frozen documents and this mission's
brief.

## 4. Files inspected

Architecture: `00_EXECUTIVE_SUMMARY.md`, `01_ARCHITECTURE_PRINCIPLES.md`,
`02_CANONICAL_DOMAIN_MODEL.md`, `03_INTELLIGENCE_PIPELINE.md`,
`08_ADAPTER_STRATEGY.md`, `12_DEPENDENCY_GRAPH.md`, `13_MIGRATION_STRATEGY.md`,
`14_IMPLEMENTATION_ROADMAP.md`, `15_ARCHITECTURE_DECISIONS.md`,
`16_QUALITY_GATES.md`, `18_INCREMENT_2_ENGINE_MANIFEST_REGISTRY.md`.

Canonical layer: `services/intelligence/entities/site.ts`,
`contracts/entity.ts` (`BaseEntity`), `types/common.ts`/`identifiers.ts`,
`entities/{tower-company,technology,operator,municipality,state,structure}.ts`,
`entities/index.ts` (`CANONICAL_ENTITY_KINDS`), `validation/validators.ts`
(`validateBaseEntityShape`), `validation/result.ts`, `contracts/limitation.ts`
(`Limitation.severity` vocabulary), `index.ts` (barrel — confirmed `SiteId`/
`MunicipalityId`/etc. are **not** re-exported at the top barrel; they live
only in `services/intelligence/types/identifiers.ts`).

Legacy/transitional layer: `core/site.ts` (`SITE_UNIFIED_COLUMNS`),
`api/site-query.ts` (`SITE_SELECT_COLUMNS`/`SITE_SELECT`),
`services/site-service.ts` (`siteRow()`), `lib/types.ts` (`SiteRow` — the
already-existing TypeScript shape of `siteRow()`'s return value, reused
directly rather than redeclared), `lib/db.ts` (`text()` — the source of the
`"Não informado"` placeholder every string field in `siteRow()` can carry),
`database/schema.ts` (`SITES_TABLE_NAME` only — no live `.db` file exists
in this environment; no data could be sampled directly, see Limitations),
`sentinel-core/entities/site-entity.ts` (confirmed 1-line stub:
`{ type: "SITE", primaryRef: "sites.id" }`, independently corroborating the
identity decision below), `services/geospatial/compact-site.ts` (the
established precedent for a pure, `node:sqlite`-free row-reshaping module).

Repository-wide searches: `SITE_UNIFIED_COLUMNS`, `SITE_SELECT_COLUMNS`,
`siteRow`/`SiteRow`, `detentor_infra`/`tipo_infra` (found in
`docs/genesis-audit/04_DATA_AND_DATABASE.md`: "Campos de proprietário:
`detentor_area`, `detentor_infra`" — confirming `detentorInfra` genuinely
represents an infrastructure-owner/tower-company concept), `tecnologia`
usage (found `services/strategic-data.ts`'s `tecnologia LIKE '%5G%' OR
tecnologia LIKE '%NR%'` — the only existing convention for interpreting this
field, a substring/presence check, never a split-into-array parse).

## 5. Current legacy site representations

| Representation | Role | Notes |
|---|---|---|
| `core/site.ts` (`SITE_UNIFIED_COLUMNS`) / `api/site-query.ts` (`SITE_SELECT_COLUMNS`/`SITE_SELECT`) | Real SQL column contract | Two slightly different column lists exist (`SITE_UNIFIED_COLUMNS` has 15 entries, `SITE_SELECT_COLUMNS` has 28) — both confirmed present, unchanged, not reconciled by this increment (out of scope; an existing, pre-Phase-2 fact, not introduced here). |
| `services/site-service.ts`'s `siteRow()` | The flat, Portuguese-named object every legacy engine consumes | 28 fields; every string field passes through `text()` (`lib/db.ts`), which coerces `null`/`undefined` to the literal placeholder `"Não informado"`; every numeric field passes through `Number(...)` (or `Number(...) \|\| 0` for `populacao`/`altura`). |
| `lib/types.ts`'s `SiteRow` | The existing, already-declared TypeScript type for `siteRow()`'s return value | Zero imports — fully pure. **Reused directly as this adapter's input type**, exported here as `LegacySiteRow`. |
| `sentinel-core/entities/site-entity.ts` | SIG graph-projection stub | 1 line: `{ type: "SITE", primaryRef: "sites.id" }` — corroborates `sites.id` as the already-assumed canonical reference point, independent confirmation of Step 5's identity decision. |

## 6. Canonical Site representation

`services/intelligence/entities/site.ts`'s `Site` interface is a
**reference** contract, not a rich site profile:

```ts
interface Site extends BaseEntity<"Site"> {
  readonly kind: "Site";
  readonly id: SiteId;
  readonly municipalityId: MunicipalityId;
  readonly stateId: StateId;
  readonly operatorId: OperatorId | null;
  readonly towerCompanyId: TowerCompanyId | null;
  readonly technologyIds: readonly TechnologyId[];
}
```

plus `BaseEntity`'s `createdAt`, `updatedAt`, `version`, `metadata`. **It has
no `latitude`/`longitude`/`endereco`/`status`/`altura`/`populacao` fields at
all.** This is a real, load-bearing finding: several of this increment's own
instructions (coordinate parsing, "latitude/longitude never swapped") refer
to fields that do not exist on the canonical `Site` contract itself. This is
not a conflict requiring a stop — it is exactly the situation Step 6 of this
mission's own brief anticipated: *"Do not map fields that do not exist in
the canonical Site contract merely to avoid losing data... leave them
explicitly unmapped and document them."* Coordinates and other rich fields
are therefore preserved only in `SiteAdaptationResult.sourceReference` (for
traceability), never as `Site` entity fields, and never with any
correction/quality logic applied (that is Coordinate Assessment/Data
Quality's job, both out of this increment's scope). Every other referenced
canonical type (`Municipality`, `State`, `Operator`, `TowerCompany`,
`Technology`) is itself a full `BaseEntity`-derived interface with its own
`name`/`code` — but `Site` only ever points at them **by branded id**, never
embeds them; constructing full `Municipality`/`Operator`/etc. entities is
explicitly out of scope for this increment (that is the "Municipality/State
Rollup Adapter" and similar future work named in
`02_CANONICAL_DOMAIN_MODEL.md`, not needed until an engine operating at that
scope is built).

## 7. Identity decision

**Canonical `Site.id` is derived from `sites.id`** (the SQLite integer
primary key), branded via `toIdentifier<"Site">(String(row.id))` — per
`02_CANONICAL_DOMAIN_MODEL.md`'s explicit resolution ("reuse the existing
primary key, branded. No new ID scheme is introduced in Phase 2.0") and
independently corroborated by `sentinel-core/entities/site-entity.ts`'s own
`primaryRef: "sites.id"`.

- **Telecom site code** (`row.site`, e.g. a sigla) is **not** part of
  identity. It is preserved verbatim in `Site.metadata.legacySiteCode` (raw,
  unmodified, even if it is the placeholder string) — satisfying "the
  original legacy identifier must remain available in metadata or source
  reference." A missing/placeholder site code is a non-blocking,
  `informational`-severity issue (`missing_site_code`) — per this
  increment's explicit instruction, "missing telecom site code must not
  prevent adaptation when a stable database ID exists," proven by test
  #17 (`tests/intelligence-site-adapter.test.ts`, two rows with the same
  empty site code still adapt to two distinct `Site.id`s).
- **A missing/invalid database id blocks adaptation** (`invalid_database_id`,
  `significant`, `canContinue: false`) — `Site.id` is a required,
  non-nullable field; there is no fallback to the telecom site code as
  identity (deliberately: `Step 5` explicitly forbids "confusing numeric
  database IDs with telecom site codes").
- No random UUID, no time-dependent id, no hash is used anywhere.
- **`MunicipalityId`** is a deterministic, namespaced string:
  `` `${normalizedUf}|${normalizedMunicipio}` ``, so two different states'
  same-named municipalities (e.g. "Bom Jesus" in both `SP` and `RS`) never
  collapse (proven by a dedicated test). **`StateId`** is the normalized
  `uf` value alone. **`OperatorId`**/**`TowerCompanyId`**/**`TechnologyId`**
  are the normalized source string directly — all of these are, per
  `02_CANONICAL_DOMAIN_MODEL.md`, denormalized string values with no
  dedicated legacy table, so a normalized-string identifier is the accurate,
  non-invented representation of what "identity" already means for them
  today.
- **Normalization for identifier keys** (`toStableKey`): trim, NFD-decompose
  and strip diacritics, upper-case, collapse whitespace — mirroring
  `services/data-quality-engine.ts`'s existing `normalizeAddress()`
  convention (cited by `03_INTELLIGENCE_PIPELINE.md` Stage 2 as "the closest
  existing example"), reimplemented locally rather than imported (importing
  a legacy engine file is out of an adapter's scope) and deliberately
  **not** stripping punctuation the way `normalizeAddress()` does, since a
  name's internal punctuation is not free-text noise the way a street
  address's is.
- **Consequence**: this identity scheme is deterministic and collision-safe
  for reasonably-distinct source strings, but two genuinely different
  operators/technologies whose names normalize to the same key (e.g. a
  typo-only difference beyond whitespace/accents) would collapse to the same
  id — an accepted, documented consequence of using the only stable
  identity these denormalized string fields actually have today, not an
  oversight.

## 8. Field mapping table

| Canonical field | Legacy source | Normalization | Null/empty behavior | Invalid-value behavior | Original preserved? | Issue emitted? |
|---|---|---|---|---|---|---|
| `kind` | constant `"Site"` | — | — | — | — | — |
| `id` | `row.id` | none (identity is the raw integer) | blocks (`significant`) | non-integer/≤0 blocks (`significant`) | raw id kept in `sourceReference.legacyRowId` | `invalid_database_id` |
| `createdAt`/`updatedAt` | `row.dataImportacao` | trim + placeholder-check | blocks (`significant`) | unparseable date blocks (`significant`) | raw string is the value itself when valid | `missing_timestamp` |
| `version` | none (new concept) | constant `1` | n/a | n/a | n/a | none |
| `metadata.legacySiteCode` | `row.site` | none (raw, even if placeholder) | non-blocking | n/a | yes, verbatim | `missing_site_code` (informational) |
| `municipalityId` | `row.municipio` + `row.uf` | `toStableKey`, namespaced by UF | blocks (`significant`) | n/a (free text, nothing to be "invalid") | n/a (identity is derived, not the display string) | `missing_municipality` |
| `stateId` | `row.uf` | `toStableKey` | blocks (`significant`) | n/a | n/a | `missing_uf` |
| `operatorId` | `row.operadora` (the `operadora_classificada ?? operadora_origem` merge `siteRow()` already performs) | `toStableKey` | `null`, non-blocking | n/a | n/a | `missing_operator` (informational) |
| `towerCompanyId` | `row.detentorInfra` | `toStableKey` | `null`, non-blocking | n/a | n/a | `missing_tower_company` (informational) |
| `technologyIds` | `row.tecnologia` | `toStableKey`, single-element array | `[]`, non-blocking | n/a | n/a | `missing_technology` (informational) |
| *(traceability only, not a Site field)* `sourceReference.latitude`/`longitude` | `row.latitude`/`longitude` | `Number(...)`, tolerates a numeric string | `null` if not finite | not finite → issue, raw kept in `rawLatitude`/`rawLongitude` | yes | `invalid_coordinate_number` (moderate, non-blocking) |

`operatorId` uses `row.operadora` specifically (not `row.operadoraOrigem`)
because `siteRow()` itself already defines `operadora` as the resolved,
classification-preferred value
(`text(raw.operadora_classificada ?? raw.operadora_origem)`) — the single
field the existing legacy layer treats as "the" operator value, reused
rather than re-deriving a second convergence rule.

## 9. Normalization rules

Applied, all non-destructive: trim surrounding whitespace; treat an empty
string or the exact literal `"Não informado"` as absence while the raw
value remains readable from the input/`sourceReference`/`metadata`
(depending on field, per the table above); `toStableKey`'s
diacritic-stripping/upper-casing for identifier-key derivation only, never
applied to a value that is itself stored on the entity; `Number(...)`
coordinate parsing that tolerates a numeric string.

**Not implemented, per this increment's explicit prohibition list**:
coordinate correction, lat/lon swapping, municipality/operator/technology
*inference*, duplicate merging, source-value replacement, fuzzy matching,
trust/quality/confidence scoring, geocoding, Copernicus validation. None of
these appear anywhere in `site-entity-adapter.ts`.

## 10. Adaptation issue model

`SiteAdaptationIssue { code, field, severity, message, canContinue }`.
`severity` reuses `services/intelligence/contracts/limitation.ts`'s existing
`"informational" | "moderate" | "significant"` vocabulary rather than
inventing a new one (no canonical adaptation-issue vocabulary existed prior
to this increment).

Nine codes, each independently evidenced (final vocabulary, deliberately
narrower than this mission's example list — see rationale below):
`invalid_database_id`, `missing_municipality`, `missing_uf`,
`missing_timestamp` (all `significant`, `canContinue: false` — each
corresponds to a required, non-nullable `Site`/`BaseEntity` field);
`missing_operator`, `missing_tower_company`, `missing_technology`,
`missing_site_code` (all `informational`, `canContinue: true` — each
corresponds to a nullable field or a field outside the canonical contract
entirely); `invalid_coordinate_number` (`moderate`, `canContinue: true` —
coordinates are traceability-only, never identity-blocking);
`invalid_canonical_shape` (`significant`, `canContinue: false` — a
defensive code path if `validateBaseEntityShape` ever disagrees with this
adapter's own construction logic; not expected to fire in practice, kept
as a safety net per Step 11's instruction to surface validator failures as
structured issues rather than ever claiming false success).

**Deliberately not implemented, with reasons:**
- `unsupported_legacy_value` / generic `placeholder_normalized`: each
  specific `missing_*` code above already communicates "this was absent or
  a placeholder" for its own field; a second, generic code duplicating that
  same fact per field would be redundant noise, not additional signal.
- `unmapped_field` as a **per-row, per-instance** issue: every row would
  emit a dozen-plus identical instances of this (every `SiteRow` field
  outside the canonical `Site` shape is *always* unmapped, by contract, not
  situationally) — that is not a data-quality signal, it is static
  structural information, so it is exposed once, statically, as
  `SITE_ADAPTER_UNMAPPED_FIELDS` (see below) and
  `SiteAdaptationResult.unmappedFields`, per Step 10's explicit
  "unmappedFields or limitations" alternative.
- `encoding_suspected`: evaluated (Step 3's own inquiry #6), not
  implemented. No existing repository code detects mojibake/encoding
  artifacts anywhere (searched; no precedent found), and inventing a
  detection heuristic here would be new, unproven business logic beyond a
  translation adapter's mandate (Principle 17: no new abstraction without a
  concrete, evidenced consumer). What **is** guaranteed and tested: any
  mojibake-like content already present in a raw string passes through this
  adapter completely unmodified (never re-encoded, re-cased beyond the
  documented `toStableKey` key-derivation, or stripped) — proven by a test
  using a deliberately suspicious site-code string. If a real
  encoding-corruption problem is later confirmed in production data,
  detection belongs at Normalization (Pipeline Stage 2) or Data Quality
  (Stage 8), not this entity-shape adapter.

Every issue message is a static, generic string — never a raw legacy value
interpolated into it — verified by a dedicated test that plants a
distinctive marker string in the input and confirms it appears nowhere in
any issue's `message` or serialized form.

## 11. Adapter API

```ts
function adaptLegacySiteRow(input: SiteRow): SiteAdaptationResult;
function toSiteEntityReference(site: Site): EntityReference<"Site">;
```

`SiteAdaptationResult = { success, site: Site | null, issues, sourceReference, unmappedFields }`.
Never throws for malformed legacy data — every "bad data" path returns
`success: false` with structured `issues`, per Step 10's explicit
instruction ("do not throw for normal bad legacy data"). No exception path
exists in this module at all; the only way to reach a throw is via
`toIdentifier`/`toIsoDateTime`'s own guards, and every call site
pre-validates non-emptiness/parseability first, so those throws are
structurally unreachable in practice, not relied upon for control flow.

`toSiteEntityReference` is a small, explicitly-justified convenience
(`08_ADAPTER_STRATEGY.md`'s own stated reason this adapter comes first:
"every other adapter needs an `EntityReference` to attach its output to") —
not a second translation path, just a narrowing of an already-adapted
`Site`.

## 12. Structural validation

`validateBaseEntityShape` (`services/intelligence/validation/validators.ts`,
**reused directly, not duplicated**) is run against every successfully
constructed `Site` before it is returned. No `validateSiteShape` function
exists yet anywhere in `services/intelligence/**` (a real, confirmed gap —
only `Score`/`Evidence`/`Recommendation`/`CalculationContext` have dedicated
structural validators today); this increment does not add one to
`services/intelligence/**` itself (out of scope, would require modifying
the canonical layer without a proven blocker per Principle 13 — a plain
missing convenience function is not "a concrete adapter that genuinely
cannot express real engine output"). The Site-specific required-field
checks (`municipalityId`/`stateId`/`technologyIds` presence,
`operatorId`/`towerCompanyId` nullability) are instead enforced locally,
inline in `adaptLegacySiteRow`, using the same `SiteAdaptationIssue`
structure as every other check in this module — not a second validation
framework, the same one.

## 13. Traceability and raw-value preservation

- `Site.metadata.legacySiteCode` — the raw telecom site code, byte-for-byte,
  even when it is the placeholder string.
- `SiteAdaptationResult.sourceReference` — `legacyRowId` (raw `row.id`),
  `legacySiteCode` (same raw value, present here too for a result-level
  trace independent of whether adaptation reached the point of
  constructing `Site.metadata`), `latitude`/`longitude` (parsed, or `null`)
  alongside `rawLatitude`/`rawLongitude` (always the untouched input,
  whatever type it actually was).
- The input `SiteRow` object itself is never mutated (proven by a test that
  snapshots it before calling the adapter and diffs after) and no field of
  the returned `Site`/`SiteAdaptationResult` holds a live reference into the
  input object — every value is copied out (primitives) or freshly
  constructed (the `metadata`/`sourceReference` objects, `technologyIds`
  array).

## 14. Explicitly unmapped fields

`SITE_ADAPTER_UNMAPPED_FIELDS` (exported, static): `siteId`, `elemento`,
`regional`, `endereco`, `status`, `projeto`, `tipoSite`, `tipoInfra`,
`latitude`, `longitude`, `populacao`, `altura`, `geoScore`, `risco`,
`stationId`, `oriScore`, `oriRisk`, `arquivoOrigem` — every `SiteRow` field
with no representation anywhere in the canonical `Site` contract (`latitude`/
`longitude` are the two exceptions given limited, traceability-only
treatment in `sourceReference`, as described above; they remain in this
list because they are still not `Site` entity fields). This list is
returned verbatim (the same array reference) on every call, not
recomputed per row, since it is a static fact about the two contracts, not
a per-row computation.

## 15. Runtime registry decision

**No change to `services/intelligence-runtime/**`.** Per this mission's own
Step 13 instruction and confirmed against the frozen architecture: engines
are declared via `EngineId`s drawn from
`services/intelligence/registry/engine-identity.ts`'s
`CANONICAL_ENGINE_IDS` (`risk`, `opportunity`, `confidence`, `priority`,
`data-trust`, `recommendation`, `machine-learning`, `simulation`,
`forecast`, `optimization`, `executive-ai`) — `"site"` is not among them,
and `08_ADAPTER_STRATEGY.md` treats "Entity adapters" as an architecturally
distinct category from "Engine," never conflating the two anywhere in the
frozen document set. The Site Entity Adapter therefore does not receive an
`EngineManifest` and is not registered in `runtimeEngineRegistry`
(`services/intelligence-runtime/registry-instance.ts`, untouched by this
increment). No engine's status changes as a side effect of this adapter
existing — `data-trust`'s manifest (Increment 2) remains `"planned"`.

## 16. Capability registry decision

`config/capabilities.json` (22 entries, all inspected) has no entry
representing "Site" as a distinct user-facing feature — every existing key
represents a whole feature area (`mission_control`, `data_trust`,
`evidence_center`, ...). The Site Entity Adapter is purely internal
infrastructure: it exists (`services/intelligence-adapters/site-entity-adapter.ts`),
but is consumed by nothing outside its own tests — no route, no UI, no
other adapter (none exist yet) imports it. Per Principle 16 ("no capability
may be advertised before it is operationally true") and this increment's
own Step 14, `config/capabilities.json` is **left unchanged**.

## 17. Tests added

- **`tests/intelligence-site-adapter.test.ts`** — 27 tests: valid-row
  success; structural validation of the produced entity; deterministic id
  mapping; site-code/identity separation; determinism (identical input →
  identical output, `toEqual`); no input mutation; empty-string and
  known-placeholder normalization (non-blocking); whitespace-trimming
  determinism; placeholder traceability in `metadata`; coordinate
  preservation (numeric and numeric-string input); invalid-coordinate
  issue-without-correction; no lat/lon swap; missing-optional-fields still
  succeed; missing/invalid database id blocks; missing site code does not
  collapse distinct rows; unknown/extra legacy fields do not leak into the
  canonical entity's own key set; static `unmappedFields` exposure;
  mojibake-style string preservation; issues never contain a planted
  distinctive marker; JSON round-trip; no cross-call state accumulation;
  `toSiteEntityReference` narrowing; missing-municipality/UF and
  missing/invalid timestamp blocking; state-namespaced municipality
  identity (two states, same municipality name, distinct ids).
- **`tests/intelligence-site-adapter-contract.test.ts`** — 7 tests
  (source-inspection, comments stripped before matching so prose that
  quotes a forbidden import path as *evidence for not importing it* cannot
  false-positive): no `node:sqlite` import; no Next.js import; no API-route
  import; no file/database I/O (`node:fs`, `fetch`, `@/lib/db`,
  `.prepare(`); no legacy Data Trust/Confidence/Evidence/Recommendation/
  Data-Quality/Duplicates engine import; no import of
  `services/site-service.ts` itself (would transitively reach
  `node:sqlite`); and, walking the entire `services/intelligence/` tree,
  confirmation that **no file there references `intelligence-adapters`** —
  the dependency direction (`legacy row → adapter → canonical entity`) is
  never inverted.

Total new tests: **34** (27 + 7).

## 18. Quality-gate results

Recorded in this increment's final report (conversation's closing message).
Expected: `tsc --noEmit` clean; 30 test files / 286 tests passing (252
baseline + 34 new); `next build` unchanged in route list and bundle size;
diff limited to the files named in the final report.

## 19. Limitations

- **No live database was available in this environment** (`find . -iname
  "*.db"` found nothing under the repository; `DATABASE/` contains only
  `schema.ts`). Every field-shape and placeholder claim in this document is
  evidenced from source code (`lib/db.ts`'s `text()`, `siteRow()`'s
  construction, existing SQL predicates like
  `tecnologia LIKE '%5G%'`), not from sampling real rows. If real data
  later reveals a placeholder value, encoding artifact, or `tecnologia`
  multi-value convention not evidenced here, this adapter's normalization
  rules should be revisited against that real evidence, not assumed correct
  from code inspection alone indefinitely.
- **`createdAt`/`updatedAt` collapse to the same single legacy timestamp**
  (`dataImportacao`) — the legacy system has no separate "first observed"
  vs. "last updated" concept at the site level; both canonical fields
  necessarily carry the same value. A future persistence-aware increment
  that actually tracks revisions could legitimately diverge them.
  `version` is a fixed constant (`1`) for the same reason — no revision
  history exists to derive a real number from, and fabricating one from
  wall-clock time would break determinism (test #5).
- **No `validateSiteShape` function exists in `services/intelligence/**`** —
  a real, pre-existing gap this increment works around locally rather than
  fixing at the canonical layer, per Principle 13 and this increment's own
  scope (no modification to `services/intelligence/**`).
- **Encoding-artifact detection is not implemented** (see Section 10) —
  preservation is guaranteed and tested; active detection/flagging is
  deferred to a future Normalization or Data Quality increment, pending real
  evidence that it is needed.
- **`tecnologia` is treated as a single token, never split** — if production
  data turns out to reliably contain multi-technology strings in a
  consistent, parseable format, a future increment could add splitting, but
  only once that format is evidenced, not invented here.

## 20. Deferred work

Everything explicitly out of this increment's scope remains deferred, per
the roadmap's own sequencing: Data Trust Score Adapter (Increment 4),
Evidence Adapter (Increment 5), Recommendation Adapter (Increment 6),
Municipality/State Rollup Adapter (needed only once an engine operates at
that scope), Confidence/Data Quality adapters (not sequenced in the first
five), the Intelligence Orchestrator, any new API route, and the eight
remaining canonical engine manifests noted as a fast-follow in Increment 2's
own report.

## 21. Rollback

Delete `services/intelligence-adapters/` (both files:
`site-entity-adapter.ts`, `index.ts`), `tests/intelligence-site-adapter.test.ts`,
and `tests/intelligence-site-adapter-contract.test.ts`. Nothing outside
these four new files was modified — `services/intelligence/**`,
`services/intelligence-runtime/**`, `config/capabilities.json`, every route,
and every legacy engine/service file are untouched, so rollback is a pure
file-deletion with no migration, schema, or dependency implication.

## 22. Go/No-Go for the Data Trust Score Adapter (Increment 4)

**Go.** This increment's acceptance bar — a pure, tested, non-throwing,
non-mutating Site Entity Adapter that reuses existing canonical types and
validators, preserves raw legacy values for traceability, never silently
repairs data, and is correctly excluded from the engine-manifest/runtime
registry and the capability registry — is met. Increment 4 needs a
`toSiteEntityReference`-shaped `EntityReference<"Site">` to attach a Data
Trust `Score` to; this increment provides exactly that, via
`toSiteEntityReference(adaptLegacySiteRow(row).site!)` once a row has
successfully adapted. Per `08_ADAPTER_STRATEGY.md` adapter #2's own stated
requirement, Increment 4 must call `dataTrustForSite(db, id, persist=false)`
explicitly (never the legacy default `persist=true`) — a mandatory
acceptance criterion for that increment, not this one, but worth restating
here since it is the very next step.
