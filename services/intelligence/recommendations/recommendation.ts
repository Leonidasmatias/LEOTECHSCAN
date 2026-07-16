import type { BaseEntity } from "../contracts/entity";
import type { Limitation } from "../contracts/limitation";
import type { RecommendationId, EvidenceId } from "../types/identifiers";
import type { EntityReference, UnitInterval } from "../types/common";
import type { PriorityLevel } from "./priority";
import type { ImpactAssessment } from "./impact";
import type { RecommendedAction } from "./action";

/**
 * The official Recommendation contract.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * A Score (scoring/score.ts) answers "what is true about this entity." A
 * Recommendation answers a different question: "given that, what should
 * someone do about it." The two are deliberately separate contracts — not
 * every engine that produces Scores needs to produce Recommendations (a
 * Confidence Engine might only ever score), and a Recommendation Engine
 * needs a single input/output shape regardless of which upstream engine's
 * Scores it is reacting to. Defining this contract once here means the
 * (out-of-scope, future) Recommendation Engine has no shape decisions left
 * to make — only the reasoning behind filling it in.
 */
export interface Recommendation extends BaseEntity<"Recommendation"> {
  readonly kind: "Recommendation";
  readonly id: RecommendationId;

  /** Human-readable explanation of why this recommendation is being
   * made. */
  readonly reason: string;

  /** How urgently this recommendation should be acted on. */
  readonly priority: PriorityLevel;

  /** How confident the producing engine is that acting on this
   * recommendation is correct. */
  readonly confidence: UnitInterval;

  /** Structured assessment of the expected effect of acting on this
   * recommendation. */
  readonly impact: ImpactAssessment;

  /** Every entity this recommendation concerns. A recommendation must
   * affect at least one entity — a recommendation about nothing is not a
   * recommendation. */
  readonly affectedEntities: readonly [EntityReference, ...EntityReference[]];

  /** The ordered set of actions that make up this recommendation. */
  readonly recommendedActions: readonly RecommendedAction[];

  /** References to the {@link Evidence} records supporting this
   * recommendation. */
  readonly evidence: readonly EvidenceId[];

  /** Known limitations on trusting or acting on this recommendation. */
  readonly limitations: readonly Limitation[];
}
