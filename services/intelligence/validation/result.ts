/**
 * A single structural validation issue.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * "Only structural validation" (per the mission's Validation section) means
 * these helpers check shape — is `confidence` a number, does `evidence`
 * exist as an array — not business rules like "is this risk score
 * plausible given the site's history." A single, uniform issue shape lets
 * every validator in `validators.ts` report failures the same way, so
 * callers do not need per-validator error handling.
 */
export interface ValidationIssue {
  /** Dot-path to the field that failed validation (e.g.
   * "evidence[0].weight"). */
  readonly path: string;

  /** Human-readable description of what was expected. */
  readonly message: string;
}

/**
 * The result of a structural validation check.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/** Convenience constructor for a passing result. */
export function validResult(): ValidationResult {
  return { valid: true, issues: [] };
}

/** Convenience constructor for a failing result. */
export function invalidResult(
  issues: readonly ValidationIssue[],
): ValidationResult {
  return { valid: false, issues };
}
