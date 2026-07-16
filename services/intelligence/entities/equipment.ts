import type { BaseEntity } from "../contracts/entity";
import type {
  EquipmentId,
  StructureId,
  TechnologyId,
  OperatorId,
} from "../types/identifiers";

/**
 * Canonical reference shape for a piece of network equipment installed on
 * a structure (an antenna, a radio unit, ...), scoped to one technology and
 * one operator.
 */
export interface Equipment extends BaseEntity<"Equipment"> {
  readonly kind: "Equipment";
  readonly id: EquipmentId;
  readonly structureId: StructureId;
  readonly technologyId: TechnologyId;
  readonly operatorId: OperatorId;
}
