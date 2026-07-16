import type { BaseEntity } from "../contracts/entity";
import type { MunicipalityId, StateId } from "../types/identifiers";

/**
 * Canonical reference shape for a municipality.
 *
 * Kept deliberately minimal (name + owning state) — geospatial detail
 * (boundaries, coordinates, area) is out of scope for Genesis Phase 1 and
 * belongs to the existing Geospatial Stage 1 module, which this phase must
 * not modify. Engines that need geospatial data pair this reference with
 * the geospatial module themselves.
 */
export interface Municipality extends BaseEntity<"Municipality"> {
  readonly kind: "Municipality";
  readonly id: MunicipalityId;
  readonly name: string;
  readonly stateId: StateId;
}
