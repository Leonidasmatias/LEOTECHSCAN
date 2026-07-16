import type { BaseEntity } from "../contracts/entity";
import type { TechnologyId } from "../types/identifiers";

/**
 * Canonical reference shape for a radio access technology generation
 * (e.g. "2G", "3G", "4G", "5G").
 *
 * Represented as a plain `name` rather than a fixed enum so that future
 * technologies do not require a breaking contract change — only a new
 * Technology record.
 */
export interface Technology extends BaseEntity<"Technology"> {
  readonly kind: "Technology";
  readonly id: TechnologyId;
  readonly name: string;
}
