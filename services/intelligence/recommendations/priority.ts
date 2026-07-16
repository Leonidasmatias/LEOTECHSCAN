/**
 * Canonical (but extensible) recommendation priority levels. Same
 * open-union rationale as `ScoreClassification` (scoring/classification.ts):
 * a fixed enum would force a contract-breaking change every time a new
 * engine needs a level this list did not anticipate.
 */
export const CANONICAL_PRIORITY_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;

export type CanonicalPriorityLevel = (typeof CANONICAL_PRIORITY_LEVELS)[number];

export type PriorityLevel = CanonicalPriorityLevel | (string & {});
