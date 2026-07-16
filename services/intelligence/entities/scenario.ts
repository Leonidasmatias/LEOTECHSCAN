import type { BaseEntity } from "../contracts/entity";
import type { ScenarioId } from "../types/identifiers";
import type { Metadata } from "../types/common";

/**
 * Canonical reference shape for a named "what-if" scenario that a
 * Simulation, Forecast, or Optimization engine can be asked to evaluate
 * against.
 *
 * A Scenario is deliberately opaque about *what* it changes
 * (`assumptions` is a metadata bag, not a typed diff) because Genesis
 * Phase 1 does not implement Simulation/Forecast/Optimization — it only
 * gives those future engines a common way to say "here is the scenario I
 * was asked to evaluate" when they emit a Score or Recommendation.
 */
export interface Scenario extends BaseEntity<"Scenario"> {
  readonly kind: "Scenario";
  readonly id: ScenarioId;
  readonly name: string;
  readonly description: string;
  readonly assumptions: Metadata;
}
