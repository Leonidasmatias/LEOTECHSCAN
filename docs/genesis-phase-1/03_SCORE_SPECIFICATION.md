# 03 — Score Specification

`services/intelligence/scoring/score.ts` defines the official `Score` contract. This document
explains every field and why it is there.

## Why one `Score` shape for every engine

Risk, Opportunity, Confidence, Priority, and Data Trust are five different judgments about five
different things, but they are all, structurally, the same kind of statement: "here is a number
about this entity, here is what that number means, here is how sure we are, and here is why."
Before this contract, each of those five engines — and every future one — would be free to invent
its own result shape. `Score` is the one shape all of them return, so a consumer (a dashboard, an
audit log, another engine) needs to understand exactly one output format to work with all of
them.

## Field-by-field

| Field | Type | Why it exists |
|---|---|---|
| `id` (fills the brief's "identifier") | `ScoreId` | Inherited from `BaseEntity`. A produced score has its own lifecycle — it can be recalculated, superseded, or annotated — independent of the entity it scores, which is why `Score` is itself a canonical entity rather than a value embedded in something else. |
| `entity` | `EntityReference` | The entity this score is about. Generic over every canonical entity kind, so one `Score` type serves all of them. |
| `type` | `ScoreType` (open string, e.g. `"risk"`) | What kind of score this is. Left open-ended (`scoring/classification.ts`) so a future engine can introduce a new score type without a contract-breaking change. |
| `value` | `number` | The raw numeric result. Deliberately unconstrained in range — different score types have different natural scales — because `classification` is what gives the number comparable meaning across types. |
| `classification` | `ScoreClassification` (open string, e.g. `"HIGH"`) | Human-meaningful bucket for `value`. Same open-ended rationale as `type`. |
| `confidence` | `UnitInterval` (0–1) | How sure the producing engine is, independent of the value itself — a HIGH score can be reported with LOW confidence, and that distinction must survive into the contract rather than being averaged away. |
| `engineVersion` | `SemVerString` | Which version of the *engine implementation* produced this score (see `06_VERSIONING.md`). |
| `contractVersion` | `SemVerString` | Which version of *this Score contract shape* the value conforms to — deliberately separate from `engineVersion`, so an engine can be upgraded without the contract changing, and vice versa. |
| `drivers` | `readonly ScoreDriver[]` | The factors that produced `value`, each with a `factor`, `weight`, `contribution`, and `explanation`. This is what makes a score explainable rather than an opaque number: given `value: 0.82`, `drivers` answers "which factors pushed it there, and by how much." |
| `evidence` | `readonly EvidenceId[]` | References (not embedded copies) to the `Evidence` records supporting this score — see `04_EVIDENCE_MODEL.md` for why evidence is reusable rather than duplicated per score. |
| `limitations` | `readonly Limitation[]` | Known reasons this score should not be fully trusted, each carrying a severity (`informational`/`moderate`/`significant`) so a reader can filter or sort by how much a limitation should matter. |
| `calculatedAt` | `IsoDateTime` | When the underlying calculation ran — distinct from `BaseEntity.createdAt` (when this *record* was created), because a score computed offline can be imported later. |
| `executionMetadata` | `ExecutionMetadata` | Which engine, under which `CalculationContext`, took how long, and any non-fatal notes from that specific run — see `07_CONTEXT.md`. |
| `metadata` (fills the brief's "future compatibility") | `Metadata` | Inherited from `BaseEntity`. A forward-compatible extension point, so a future engine can attach additional detail without a contract-breaking field addition. |

## Why `identifier` and `future compatibility` are not separate, duplicate fields

The mission brief lists `identifier` and "future compatibility" as things the Score contract must
support. `Score extends BaseEntity`, which already provides `id` (satisfying "identifier") and
`metadata` (satisfying "future compatibility"). Adding a second, parallel `identifier` field or a
second `extensions` field alongside these would violate "no duplicated interfaces" for no
benefit — every field in this contract exists exactly once, under exactly one name.
