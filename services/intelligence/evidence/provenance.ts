import type { DataSourceId, SnapshotId } from "../types/identifiers";
import type { IsoDateTime, SemVerString, Metadata } from "../types/common";

/**
 * The official data-provenance model.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * "Explainable Intelligence" (one of the Genesis Phase 1 architectural
 * principles) is only possible if every output can be traced back to
 * exactly where its inputs came from, through exactly which pipeline, at
 * exactly what point in time — without an engine author having to invent
 * that trace format themselves. `DataProvenance` is that trace format. It
 * is a value object (no `id`/`kind`, unlike the canonical entities): it
 * describes the lineage of a piece of data, it is not itself a thing the
 * system tracks a lifecycle for.
 *
 * `Evidence` (evidence.ts) embeds a `DataProvenance` via its `origin`
 * field; any future contract that needs to describe "where did this come
 * from" should reuse this type rather than inventing a parallel one.
 */
export interface DataProvenance {
  /** Where the underlying data originated (e.g. "anatel-import",
   * "copernicus-api", "manual-entry"). */
  readonly origin: string;

  /** The named processing pipeline that produced the current
   * representation of the data (e.g. "excel-import-v3",
   * "geospatial-enrichment"). */
  readonly pipeline: string;

  /** The immutable snapshot this data was captured as part of. */
  readonly snapshot: SnapshotId;

  /** The data source the snapshot was captured from. */
  readonly source: DataSourceId;

  /** Content-integrity checksum of the data at the referenced snapshot,
   * used to detect drift between when evidence was recorded and when it is
   * later re-examined. */
  readonly checksum: string;

  /** When this provenance record was produced. */
  readonly timestamp: IsoDateTime;

  /** The pipeline/contract version that produced this record (see
   * versioning/version.ts). */
  readonly version: SemVerString;

  /** Free-form processing metadata (e.g. row counts, transformation
   * flags) that does not warrant its own typed field. */
  readonly processingMetadata: Metadata;
}
