import type { BaseEntity } from "../contracts/entity";
import type { OperatorId } from "../types/identifiers";

/**
 * Canonical reference shape for a mobile network operator (e.g. Vivo,
 * Claro, TIM, Oi).
 */
export interface Operator extends BaseEntity<"Operator"> {
  readonly kind: "Operator";
  readonly id: OperatorId;
  readonly name: string;
}
