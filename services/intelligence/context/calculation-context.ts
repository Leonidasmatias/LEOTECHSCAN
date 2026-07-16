import type { EntityReference, IsoDateTime, Metadata } from "../types/common";
import type { SnapshotId } from "../types/identifiers";

/**
 * The single execution context every intelligence engine receives.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * The mission is explicit: "Every intelligence engine shall receive exactly
 * one execution context. No arbitrary parameters." That rule exists because
 * arbitrary parameter lists are how engines quietly diverge — one engine
 * takes `(entityId, options)`, another takes `(scope, flags, snapshotId)`,
 * and composing or orchestrating engines uniformly becomes impossible.
 * `CalculationContext` is the one object every engine's entry point accepts
 * instead. An engine that needs information not already on this contract
 * should extend `extensions`, not add a second parameter.
 */
export interface CalculationContext {
  /** Unique identifier for this specific execution, used to correlate a
   * Score/Recommendation's `ExecutionMetadata.contextId` back to the
   * context that produced it. */
  readonly contextId: string;

  /** What this execution is being asked to evaluate: a specific entity, a
   * scenario, or the literal string `"global"` for system-wide runs. */
  readonly scope: EntityReference | "global";

  /** The data snapshot this execution must operate against, so results are
   * reproducible against a fixed point in time rather than "whatever the
   * data happens to be right now". */
  readonly snapshot: SnapshotId;

  /** When this execution was requested. */
  readonly requestedAt: IsoDateTime;

  /** Who or what requested this execution (e.g. "user:leonidas",
   * "engine:risk", "scheduler:nightly-batch"). Free text rather than a
   * closed union because callers are not limited to end users — one engine
   * invoking another is a legitimate requester. */
  readonly requestedBy: string;

  /** Correlates this execution with a broader request/trace (e.g. a single
   * user action that triggers several engines). Distinct from `contextId`,
   * which identifies only this one execution. */
  readonly correlationId: string;

  /** The environment this execution is running in. Engines may use this to
   * decide, for example, whether to enforce stricter validation. */
  readonly environment: "production" | "staging" | "test" | "sandbox";

  /** Forward-compatible extension point for context fields future engines
   * need that do not yet warrant a typed field on this contract. */
  readonly extensions: Metadata;
}
