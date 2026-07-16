/**
 * Canonical (but extensible) score classification levels.
 *
 * WHY THIS IS OPEN-ENDED
 * ---------------------------------------------------------------------------
 * A fixed union (`"LOW" | "MEDIUM" | "HIGH"`) would need to change — a
 * contract-breaking change, per versioning/version.ts — every time a future
 * engine needs a level this list didn't anticipate (a Confidence Engine
 * might want "INSUFFICIENT_DATA"; an Executive AI summary might want
 * "REQUIRES_REVIEW"). `ScoreClassification` is therefore `string`, not a
 * closed union. `CANONICAL_SCORE_CLASSIFICATIONS` documents the levels every
 * engine should reach for before inventing a new one, without forbidding a
 * new one when genuinely needed.
 */
export const CANONICAL_SCORE_CLASSIFICATIONS = [
  "LOW",
  "MODERATE",
  "HIGH",
  "CRITICAL",
] as const;

export type CanonicalScoreClassification =
  (typeof CANONICAL_SCORE_CLASSIFICATIONS)[number];

export type ScoreClassification = CanonicalScoreClassification | (string & {});

/**
 * Canonical (but extensible) score type identifiers, mirroring the engines
 * named in the mission brief. Same open-ended rationale as
 * {@link ScoreClassification}.
 */
export const CANONICAL_SCORE_TYPES = [
  "risk",
  "opportunity",
  "confidence",
  "priority",
  "data-trust",
] as const;

export type CanonicalScoreType = (typeof CANONICAL_SCORE_TYPES)[number];

export type ScoreType = CanonicalScoreType | (string & {});

/**
 * A single contributing factor behind a Score's numeric value.
 *
 * Drivers are what make a Score explainable rather than an opaque number:
 * given a Score of 0.82, `drivers` answers "which factors pushed it there,
 * and by how much."
 */
export interface ScoreDriver {
  /** Name of the contributing factor (e.g. "coverage-overlap",
   * "site-age"). */
  readonly factor: string;

  /** Relative importance assigned to this factor in the calculation. */
  readonly weight: number;

  /** The factor's actual contribution to the final value, after weighting
   * (i.e. `weight` is the input importance, `contribution` is the
   * realized effect). */
  readonly contribution: number;

  /** Human-readable explanation of why this factor contributed the way it
   * did. */
  readonly explanation: string;
}
