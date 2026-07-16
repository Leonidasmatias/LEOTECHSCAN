import type { BaseEntity } from "../contracts/entity";
import type { StructureId, SiteId, TowerCompanyId } from "../types/identifiers";

/**
 * Canonical reference shape for a physical structure (tower, rooftop,
 * monopole, ...) located at a site. Separated from `Site` because a single
 * site can host more than one structure, and a structure can outlive or
 * predate any particular site record.
 */
export interface Structure extends BaseEntity<"Structure"> {
  readonly kind: "Structure";
  readonly id: StructureId;
  readonly siteId: SiteId;
  readonly towerCompanyId: TowerCompanyId | null;
  /** Free-form structure classification (e.g. "monopole", "guyed",
   * "rooftop"). Left as `string` rather than an enum for the same reason
   * as `Technology.name`: new structure types should not require a
   * contract-breaking change. */
  readonly structureType: string;
}
