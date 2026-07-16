import type { BaseEntity } from "../contracts/entity";
import type { IndicatorId } from "../types/identifiers";
import type { EntityReference } from "../types/common";

/**
 * Canonical reference shape for a named, unit-bearing measure derived from
 * one or more {@link Observation}s about a subject entity (e.g. "site
 * density per km²", "operator overlap ratio").
 *
 * An Indicator is *not* a Score: it carries a measured or derived value and
 * a unit, but no classification, confidence, or driver breakdown. Engines
 * consume Indicators as raw material and produce Scores (see
 * scoring/score.ts) as output — collapsing the two into one contract would
 * make it impossible to tell "a fact we measured" apart from "a judgment an
 * engine rendered".
 */
export interface Indicator extends BaseEntity<"Indicator"> {
  readonly kind: "Indicator";
  readonly id: IndicatorId;
  readonly name: string;
  readonly subject: EntityReference;
  readonly value: number;
  /** Unit of measure for `value` (e.g. "count", "ratio", "km", "%"). */
  readonly unit: string;
}
