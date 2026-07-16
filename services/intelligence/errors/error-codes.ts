/**
 * The closed set of error codes every {@link IntelligenceError} carries.
 *
 * WHY A CLOSED SET, UNLIKE ENGINE IDS OR SCORE TYPES
 * ---------------------------------------------------------------------------
 * Score types and engine ids are open-ended because new engines and new
 * kinds of score are exactly what future phases are expected to add. Error
 * codes are different: they identify a fixed set of *structural* failure
 * modes in the Intelligence Foundation itself (a bad contract, an
 * unregistered engine, an incompatible version, a corrupted evidence
 * chain). Adding a new failure mode is a considered contract change, not a
 * routine addition — so this is a closed union, and extending it is meant
 * to be visible in a diff.
 */
export const INTELLIGENCE_ERROR_CODES = [
  "CONTRACT_VALIDATION_FAILED",
  "VERSION_INCOMPATIBLE",
  "ENGINE_NOT_REGISTERED",
  "DUPLICATE_ENGINE_DECLARATION",
  "EVIDENCE_INTEGRITY_FAILED",
  "UNKNOWN_ENTITY_REFERENCE",
] as const;

export type IntelligenceErrorCode = (typeof INTELLIGENCE_ERROR_CODES)[number];
