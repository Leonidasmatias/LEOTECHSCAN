import type { BaseEntity } from "../contracts/entity";
import type { TowerCompanyId } from "../types/identifiers";

/**
 * Canonical reference shape for a tower/tenancy company (tower-co) that may
 * own or co-host physical structures independently of any single operator.
 */
export interface TowerCompany extends BaseEntity<"TowerCompany"> {
  readonly kind: "TowerCompany";
  readonly id: TowerCompanyId;
  readonly name: string;
}
