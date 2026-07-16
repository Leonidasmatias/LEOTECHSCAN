/**
 * A single, explainable limitation attached to a Score or a Recommendation.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * "Explainable Intelligence" cuts both ways: an engine must explain not
 * only *why* it produced a result, but *where that result should not be
 * trusted*. Modeling limitations as bare strings (as a first draft of this
 * contract did) makes them unfilterable and unsortable — a UI cannot show
 * "significant" limitations more prominently than "informational" ones if
 * severity is buried in prose. This shared type is used identically by
 * `Score` (scoring/score.ts) and `Recommendation`
 * (recommendations/recommendation.ts) so both surfaces render limitations
 * the same way.
 */
export interface Limitation {
  /** Human-readable statement of the limitation. */
  readonly description: string;

  /** How much this limitation should weigh on the reader's trust in the
   * result it is attached to. */
  readonly severity: "informational" | "moderate" | "significant";
}
