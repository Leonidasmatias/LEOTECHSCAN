import type { BaseEntity } from "../contracts/entity";
import type { DataSourceId } from "../types/identifiers";

/**
 * Canonical reference shape for a source of data feeding the Intelligence
 * Foundation (an importer, an external API, a manual upload, ...).
 *
 * Every {@link Observation} and every piece of {@link Evidence} traces back
 * to a DataSource, which is what makes "explainable intelligence" possible:
 * an engine can always answer "where did this come from?" by walking this
 * reference, rather than baking provenance into ad-hoc comments.
 */
export interface DataSource extends BaseEntity<"DataSource"> {
  readonly kind: "DataSource";
  readonly id: DataSourceId;
  readonly name: string;
  /** Free-form origin classification (e.g. "importer", "external-api",
   * "manual-entry", "satellite-feed"). */
  readonly originType: string;
}
