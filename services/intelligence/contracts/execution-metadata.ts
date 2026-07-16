import type { IsoDateTime } from "../types/common";

/**
 * Metadata describing the specific engine run that produced a Score or
 * Recommendation.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * A Score's `engineVersion`/`contractVersion` (versioning/version.ts)
 * answer "what shape of engine produced this." `ExecutionMetadata` answers
 * a different question: "which specific run, against which context, took
 * how long, and did it emit any non-fatal notes." Without this, debugging
 * an unexpected Score means asking "when was this computed and against
 * what" with no structured answer — this contract is that structured
 * answer, shared identically by Score and Recommendation.
 */
export interface ExecutionMetadata {
  /** Identifier of the engine that executed (see registry/engine-registry.ts
   * for the set of declared engine ids). Left as `string` here rather than
   * importing `EngineId` to keep this contract free of a dependency on the
   * registry module — engines and scores can be typed independently. */
  readonly engineId: string;

  /** The {@link CalculationContext} id this execution ran under (see
   * context/calculation-context.ts). */
  readonly contextId: string;

  /** When execution completed. */
  readonly executedAt: IsoDateTime;

  /** Wall-clock duration of the execution, in milliseconds. */
  readonly durationMs: number;

  /** Non-fatal notes emitted during execution (e.g. "fell back to a
   * default weight for factor X"). Distinct from `limitations`
   * (contracts/limitation.ts), which describe limits on trusting the
   * *result*; these describe the *run* itself. */
  readonly notes: readonly string[];
}
