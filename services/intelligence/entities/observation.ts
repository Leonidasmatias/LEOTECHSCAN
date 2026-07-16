import type { BaseEntity } from "../contracts/entity";
import type {
  ObservationId,
  DataSourceId,
  SnapshotId,
} from "../types/identifiers";
import type { EntityReference, IsoDateTime } from "../types/common";

/**
 * Canonical reference shape for a single observed fact about some entity,
 * captured from a {@link DataSource} at a {@link Snapshot}.
 *
 * Observations are the atomic unit every higher-level construct (Indicator,
 * Score, Evidence) is ultimately built from. Keeping this contract generic
 * over `subject` (any {@link EntityReference}) — rather than one
 * Observation type per entity kind — is what lets a single Observation
 * pipeline feed every engine, instead of each engine needing its own
 * ingestion shape.
 */
export interface Observation extends BaseEntity<"Observation"> {
  readonly kind: "Observation";
  readonly id: ObservationId;
  readonly subject: EntityReference;
  readonly dataSourceId: DataSourceId;
  readonly snapshotId: SnapshotId;
  readonly observedAt: IsoDateTime;
  /** The raw observed value. Left as a serializable value rather than a
   * fixed type — an Observation might carry a number, a string, or a
   * structured object depending on what was observed. */
  readonly value: string | number | boolean | null;
}
