import type { BaseEntity } from "../contracts/entity";
import type { SnapshotId, DataSourceId } from "../types/identifiers";
import type { IsoDateTime } from "../types/common";

/**
 * Canonical reference shape for an immutable, point-in-time capture of data
 * from a {@link DataSource}.
 *
 * Snapshots are what let a Score or a piece of Evidence say "this was true
 * as of this exact capture" rather than "this is true" (which becomes false
 * the moment underlying data changes). Every engine that produces
 * time-sensitive output should anchor it to a Snapshot, not to "now".
 */
export interface Snapshot extends BaseEntity<"Snapshot"> {
  readonly kind: "Snapshot";
  readonly id: SnapshotId;
  readonly dataSourceId: DataSourceId;
  readonly capturedAt: IsoDateTime;
  /** Content-integrity checksum of the captured data (see
   * evidence/provenance.ts for how this is used to detect drift). */
  readonly checksum: string;
}
