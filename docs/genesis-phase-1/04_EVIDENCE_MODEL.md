# 04 — Evidence Model

`services/intelligence/evidence/evidence.ts` and `services/intelligence/evidence/provenance.ts`
define the official evidence and data-provenance contracts.

## Why evidence is its own reusable contract

"Explainable Intelligence" is a stated architectural principle of this phase, and evidence is what
makes it real: a `Score` or `Recommendation` is only as explainable as the evidence it can point
to. Every engine listed in the mission brief needs to cite *something* to justify its output.
Without one shared `Evidence` contract, each engine would invent its own justification format, and
nothing downstream — a UI rendering "why did this happen," an audit log, a second engine reading
a first engine's evidence — could treat them uniformly. `Evidence` is designed once here and
referenced by id (`EvidenceId`) from both `Score` and `Recommendation`, so the same piece of
evidence can support more than one score or recommendation without being copied.

## `Evidence` field-by-field

| Field | Type | Why it exists |
|---|---|---|
| `id` | `EvidenceId` | Evidence is a canonical entity in its own right (it has a lifecycle — it can be superseded or re-weighted independently of what cites it), hence `Evidence extends BaseEntity` rather than being a bare value object. |
| `source` | `string` | Human-readable origin (e.g. "Copernicus satellite validation"). Complements `origin` (below) with something a person reading a Recommendation can understand without dereferencing anything. |
| `description` | `string` | What this evidence shows, in plain language. |
| `weight` | `number` | Relative importance of this evidence within the set supporting one score or recommendation. Not required to sum to 1 across a set — callers needing normalized weights normalize them; this field only expresses relative intent. |
| `reliability` | `UnitInterval` | How trustworthy this evidence is judged to be, independent of its weight. A highly-weighted but low-reliability input is a legitimate, explainable state — "the most decisive input we have is also the least certain one" — which is why weight and reliability are two fields, not one. |
| `snapshot` | `SnapshotId` | The immutable data snapshot this evidence was drawn from, kept as a direct field because "which snapshot" is checked far more often than the rest of the lineage. |
| `origin` | `DataProvenance` | The full machine-tractable lineage (see below). |
| `checksum` | `string` | Content-integrity checksum of the evidence payload, for the same cheap-comparison reason as `snapshot` — must match `origin.checksum` when both are dereferenced from the same snapshot, but is kept as its own field for callers that only need to detect drift, not explain it. |
| `references` | `readonly string[]` | Free-form citations (URLs, document ids, ticket numbers) a reader can follow to verify the evidence independently. |

## `DataProvenance` field-by-field

`DataProvenance` (`evidence/provenance.ts`) is the official data-provenance model — the answer to
"where did this data come from, through what pipeline, at what point in time, with what
integrity guarantee." It is a value object (no `id`/`kind`/lifecycle of its own): it describes the
lineage of a piece of data; it is not itself a thing the system tracks independently.

| Field | Type | Why it exists |
|---|---|---|
| `origin` | `string` | Where the underlying data originated (e.g. "anatel-import", "copernicus-api"). |
| `pipeline` | `string` | The named processing pipeline that produced the current representation of the data. |
| `snapshot` | `SnapshotId` | The immutable snapshot this provenance describes. |
| `source` | `DataSourceId` | The data source the snapshot was captured from. |
| `checksum` | `string` | Content-integrity checksum, used to detect drift between when evidence was recorded and when it is later re-examined. |
| `timestamp` | `IsoDateTime` | When this provenance record was produced. |
| `version` | `SemVerString` | The pipeline/contract version that produced this record. |
| `processingMetadata` | `Metadata` | Free-form processing detail (row counts, transformation flags) not warranting its own typed field. |

## Reusability in practice

Because `Evidence` is referenced by `EvidenceId` rather than embedded, the same evidence record —
say, a single Copernicus satellite validation — can be cited by a Data Trust score, a Risk score,
and a site-revalidation Recommendation simultaneously, without three copies of the same
description, weight, and provenance drifting independently. Any future engine that needs to cite
evidence does so by producing or referencing an `EvidenceId`, never by inventing its own
evidence shape.
