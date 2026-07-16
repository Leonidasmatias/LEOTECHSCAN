import type { UnitInterval } from "../types/common";

/**
 * Structured assessment of the expected impact of acting on a
 * Recommendation.
 *
 * Modeled as magnitude + area + timeframe (rather than a single free-text
 * "impact" string) so a consumer can sort/filter recommendations by how big
 * the effect is, where it applies, and how soon it would materialize,
 * without parsing prose.
 */
export interface ImpactAssessment {
  /** Relative magnitude of the expected impact. */
  readonly magnitude: UnitInterval;

  /** The area/domain the impact applies to (e.g. "coverage",
   * "revenue", "data-quality"). Left open rather than enumerated for the
   * same forward-compatibility reason as `ScoreType`. */
  readonly area: string;

  /** Expected timeframe for the impact to materialize (e.g.
   * "immediate", "next-quarter", "long-term"). Left as free text since
   * different engines reason about time at different granularities. */
  readonly timeframe: string;
}
