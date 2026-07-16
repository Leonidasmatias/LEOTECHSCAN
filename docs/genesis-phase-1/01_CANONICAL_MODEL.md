# 01 — Canonical Entity Model

## Why a canonical model, separate from what already exists

The repository already has several notions of "an entity": `core/site.ts` describes the raw
imported column schema; `sentinel-core/entities/*.ts` describes lightweight type/primary-key
markers used by the existing knowledge graph. Both are correct for what they were built for —
describing how a site arrives from an Excel import, and how the graph module links records
together. Neither is a general-purpose contract a Risk Engine and a Forecast Engine can both
depend on without depending on each other, or on import/graph implementation detail they have no
business knowing about.

`services/intelligence/entities/` is a third, deliberately narrower model: the minimum reference
shape every intelligence engine needs to say "this result is about that thing." It does not
replace `core/site.ts` or `sentinel-core/entities/` — it does not modify them, import from them,
or duplicate their fields — it sits alongside them as the vocabulary intelligence engines use
among themselves.

## The `BaseEntity` contract

Every canonical entity (`services/intelligence/contracts/entity.ts`) has exactly five fields:

- `kind` — a string discriminant (e.g. `"Site"`), enabling exhaustive `switch` narrowing.
- `id` — a branded `Identifier<TKind>` (`services/intelligence/types/common.ts`), so a `SiteId`
  can never be silently passed where an `OperatorId` is expected.
- `createdAt` / `updatedAt` — ISO-8601 timestamps for the entity's representation in the
  Intelligence Foundation, not necessarily the same as when the real-world thing was created.
- `version` — a monotonically increasing revision counter for this specific record, distinct from
  `engineVersion`/`contractVersion` (see `06_VERSIONING.md`), which version the *shape* of a
  contract, not one record.
- `metadata` — an open, JSON-serializable bag for anything that does not warrant a typed field.

These five fields are the intersection of what every engine named in the mission brief needs from
*any* entity it touches — nothing more. Anything an individual entity needs beyond that lives on
the entity itself.

## The sixteen canonical entities

| Entity | File | What it references |
|---|---|---|
| `Site` | `entities/site.ts` | Municipality, State, Operator, TowerCompany, Technologies |
| `Municipality` | `entities/municipality.ts` | State |
| `State` | `entities/state.ts` | — |
| `Operator` | `entities/operator.ts` | — |
| `Technology` | `entities/technology.ts` | — |
| `TowerCompany` | `entities/tower-company.ts` | — |
| `Structure` | `entities/structure.ts` | Site, TowerCompany |
| `Equipment` | `entities/equipment.ts` | Structure, Technology, Operator |
| `Observation` | `entities/observation.ts` | any entity (via `EntityReference`), DataSource, Snapshot |
| `DataSource` | `entities/data-source.ts` | — |
| `Snapshot` | `entities/snapshot.ts` | DataSource |
| `Indicator` | `entities/indicator.ts` | any entity (via `EntityReference`) |
| `Scenario` | `entities/scenario.ts` | — |
| `Score` | `scoring/score.ts` | any entity, Evidence |
| `Evidence` | `evidence/evidence.ts` | Snapshot, DataProvenance |
| `Recommendation` | `recommendations/recommendation.ts` | any entity, Evidence |

`Score`, `Evidence`, and `Recommendation` are declared in their own dedicated directories
(`scoring/`, `evidence/`, `recommendations/`) rather than in `entities/`, because each carries
substantially more structure than a reference entity and each has its own dedicated
specification document (`03`, `04`, and the Recommendation section of `02`). `entities/index.ts`
re-exports all three so every canonical entity remains reachable from one import —
`@/services/intelligence` — without re-declaring (and risking drifting from) their real
definitions. This is what "no duplicated interfaces" means in practice: one file per entity,
never two.

## Why reference-only, not the full domain schema

Every relationship (`Site.municipalityId`, `Structure.siteId`, ...) is a branded id, not an
embedded object. A `Site` does not carry its `Municipality`'s data inline. This is deliberate:
embedding would mean every engine that only needs a site's id would still need a full municipality
object in scope, and updates to a municipality would need to propagate into every embedded copy.
Reference-only entities keep each contract's payload proportional to what it actually needs, and
keep "what is the current state of this municipality" answerable in exactly one place.

## What `EntityReference` is for

`services/intelligence/types/common.ts` also defines `EntityReference<TKind>` — a bare
`{ kind, id }` pointer, used wherever a contract needs to refer to "some entity" generically
(`Observation.subject`, `Indicator.subject`, `Score.entity`,
`Recommendation.affectedEntities`, `CalculationContext.scope`). It is the mechanism that lets a
single `Observation` type, a single `Score` type, and a single `CalculationContext` type serve
every canonical entity kind, instead of needing one `SiteObservation`, one
`MunicipalityObservation`, and so on.
