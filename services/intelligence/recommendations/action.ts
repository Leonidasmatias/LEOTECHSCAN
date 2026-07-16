/**
 * A single recommended action within a Recommendation's action plan.
 *
 * Recommendations often imply more than one step (e.g. "re-validate via
 * Copernicus, then re-run the trust score"); modeling actions as an ordered
 * list of `RecommendedAction` — rather than one free-text `action` string —
 * lets a consumer render or execute them as a sequence.
 */
export interface RecommendedAction {
  /** Human-readable description of the action to take. */
  readonly action: string;

  /** Why this specific action is recommended. */
  readonly rationale: string;

  /** Position of this action within the overall recommended sequence,
   * starting at 1. Actions with the same `sequence` are unordered relative
   * to each other (may be taken in parallel). */
  readonly sequence: number;
}
