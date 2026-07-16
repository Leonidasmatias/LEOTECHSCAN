import type { BaseEntity } from "../contracts/entity";
import type { StateId } from "../types/identifiers";

/**
 * Canonical reference shape for a Brazilian federative state (UF).
 */
export interface State extends BaseEntity<"State"> {
  readonly kind: "State";
  readonly id: StateId;
  readonly name: string;
  /** The two-letter UF code (e.g. "SP", "RJ"). */
  readonly code: string;
}
