import type { SemVerString } from "../types/common";

/**
 * A parsed semantic version, per the `MAJOR.MINOR.PATCH[-prerelease][+build]`
 * grammar (https://semver.org).
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * "Immutable contracts, versioned models" is a stated architectural
 * principle of Genesis Phase 1. A version that is just a string is
 * unversioned in practice — nothing stops "1.10.0" from sorting before
 * "1.9.0" as a string, or two engines from disagreeing about what
 * "compatible" means. This structured form, plus the pure comparison
 * functions in `compatibility.ts`, is what makes versioning a contract
 * rather than a convention.
 */
export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | null;
  readonly build: string | null;
}

/**
 * A single documented breaking change between contract versions.
 *
 * Kept as structured data (not a CHANGELOG entry) so tooling — and future
 * engines checking compatibility programmatically — can enumerate breaking
 * changes without parsing prose.
 */
export interface BreakingChangeNote {
  /** The version at which this breaking change was introduced. */
  readonly version: SemanticVersion;

  /** Human-readable summary of what broke. */
  readonly summary: string;

  /** Optional guidance for migrating across this breaking change. */
  readonly migrationNotes: string | null;
}

/**
 * The official versioning contract every engine declaration
 * (registry/engine-registry.ts) and every Score/Recommendation-producing
 * engine must carry.
 *
 * Distinguishing `engineVersion` from `contractVersion` is deliberate: an
 * engine's internal implementation can change (a new model, a bug fix)
 * without the shape of what it emits changing, and vice versa — the
 * Intelligence Foundation's contracts can gain a new optional field without
 * every engine needing a version bump. Conflating the two would force a
 * contract version bump on every implementation change, defeating the
 * purpose of having contracts stable enough to build against.
 */
export interface EngineVersionInfo {
  /** Version of the engine's implementation. */
  readonly engineVersion: SemanticVersion;

  /** Version of the contract shape the engine's output conforms to. */
  readonly contractVersion: SemanticVersion;

  /** The oldest contract version a consumer must support to safely read
   * this engine's output. */
  readonly minimumCompatibleVersion: SemanticVersion;

  /** The contract version this engine's output shape was deprecated as of,
   * if any. `null` while the shape is current. */
  readonly deprecatedSince: SemanticVersion | null;

  /** Every documented breaking change in this engine's contract history,
   * oldest first. */
  readonly breakingChanges: readonly BreakingChangeNote[];
}

/**
 * Re-exported for convenience so callers working with raw engine/contract
 * version strings (as they arrive from configuration, an API payload, etc.)
 * can refer to the branded string type from the same module as the parsed
 * form.
 */
export type { SemVerString };
