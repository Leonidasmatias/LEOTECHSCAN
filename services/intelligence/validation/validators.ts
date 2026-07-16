import { ContractValidationError } from "../errors/intelligence-error";
import { CANONICAL_ENTITY_KINDS } from "../entities/index";
import type { Identifier, IsoDateTime } from "../types/common";
import type { ValidationResult, ValidationIssue } from "./result";
import { validResult, invalidResult } from "./result";

/**
 * Structural validation helpers for the Intelligence Foundation's
 * contracts.
 *
 * WHY THESE EXIST, AND WHY THEY STOP WHERE THEY DO
 * ---------------------------------------------------------------------------
 * TypeScript's structural typing guarantees shape *at compile time*, for
 * values the compiler can see. It guarantees nothing about a JSON payload
 * that just arrived over an API boundary, was read from a file, or was
 * deserialized from another engine's output — those are `unknown` until
 * something checks them. These functions are that check. They verify shape
 * only (is `confidence` a number in range, does `drivers` exist as an
 * array) — never business plausibility (is this confidence *reasonable*
 * given the entity). That line is deliberate: business validation belongs
 * to the engines that will be built in future phases, against data they
 * understand; this phase only guarantees the language those engines will
 * speak is well-formed.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isUnitIntervalNumber(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1 && !Number.isNaN(value);
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

/**
 * Validates that `value` structurally satisfies {@link BaseEntity}
 * (contracts/entity.ts): `kind`, `id`, `createdAt`, `updatedAt`, `version`,
 * `metadata`.
 */
export function validateBaseEntityShape(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return invalidResult([issue("$", "expected an object")]);
  }
  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(value.kind)) {
    issues.push(issue("kind", "expected a non-empty string"));
  }
  if (!isNonEmptyString(value.id)) {
    issues.push(issue("id", "expected a non-empty string identifier"));
  }
  if (!isNonEmptyString(value.createdAt)) {
    issues.push(issue("createdAt", "expected an ISO-8601 date-time string"));
  }
  if (!isNonEmptyString(value.updatedAt)) {
    issues.push(issue("updatedAt", "expected an ISO-8601 date-time string"));
  }
  if (typeof value.version !== "number" || !Number.isFinite(value.version)) {
    issues.push(issue("version", "expected a finite number"));
  }
  if (!isRecord(value.metadata)) {
    issues.push(issue("metadata", "expected an object"));
  }
  return issues.length > 0 ? invalidResult(issues) : validResult();
}

/**
 * Validates that `value` structurally satisfies {@link EntityReference}
 * (types/common.ts): `kind` (a recognized canonical entity kind) and `id`.
 */
export function validateEntityReferenceShape(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return invalidResult([issue("$", "expected an object")]);
  }
  const issues: ValidationIssue[] = [];
  if (
    typeof value.kind !== "string" ||
    !(CANONICAL_ENTITY_KINDS as readonly string[]).includes(value.kind)
  ) {
    issues.push(
      issue(
        "kind",
        `expected one of: ${CANONICAL_ENTITY_KINDS.join(", ")}`,
      ),
    );
  }
  if (!isNonEmptyString(value.id)) {
    issues.push(issue("id", "expected a non-empty string identifier"));
  }
  return issues.length > 0 ? invalidResult(issues) : validResult();
}

/**
 * Validates that `value` structurally satisfies the {@link Score} contract
 * (scoring/score.ts), in addition to the base entity shape.
 */
export function validateScoreShape(value: unknown): ValidationResult {
  const baseResult = validateBaseEntityShape(value);
  if (!isRecord(value)) {
    return baseResult;
  }
  const issues: ValidationIssue[] = [...baseResult.issues];

  if (!isRecord(value.entity)) {
    issues.push(issue("entity", "expected an EntityReference object"));
  }
  if (!isNonEmptyString(value.type)) {
    issues.push(issue("type", "expected a non-empty string"));
  }
  if (typeof value.value !== "number" || Number.isNaN(value.value)) {
    issues.push(issue("value", "expected a number"));
  }
  if (!isNonEmptyString(value.classification)) {
    issues.push(issue("classification", "expected a non-empty string"));
  }
  if (!isUnitIntervalNumber(value.confidence)) {
    issues.push(issue("confidence", "expected a number in [0, 1]"));
  }
  if (!isNonEmptyString(value.engineVersion)) {
    issues.push(issue("engineVersion", "expected a semantic version string"));
  }
  if (!isNonEmptyString(value.contractVersion)) {
    issues.push(issue("contractVersion", "expected a semantic version string"));
  }
  if (!Array.isArray(value.drivers)) {
    issues.push(issue("drivers", "expected an array"));
  }
  if (!Array.isArray(value.evidence)) {
    issues.push(issue("evidence", "expected an array of evidence ids"));
  }
  if (!Array.isArray(value.limitations)) {
    issues.push(issue("limitations", "expected an array"));
  }
  if (!isNonEmptyString(value.calculatedAt)) {
    issues.push(issue("calculatedAt", "expected an ISO-8601 date-time string"));
  }
  if (!isRecord(value.executionMetadata)) {
    issues.push(issue("executionMetadata", "expected an ExecutionMetadata object"));
  }
  return issues.length > 0 ? invalidResult(issues) : validResult();
}

/**
 * Validates that `value` structurally satisfies the {@link Evidence}
 * contract (evidence/evidence.ts), in addition to the base entity shape.
 */
export function validateEvidenceShape(value: unknown): ValidationResult {
  const baseResult = validateBaseEntityShape(value);
  if (!isRecord(value)) {
    return baseResult;
  }
  const issues: ValidationIssue[] = [...baseResult.issues];

  if (!isNonEmptyString(value.source)) {
    issues.push(issue("source", "expected a non-empty string"));
  }
  if (!isNonEmptyString(value.description)) {
    issues.push(issue("description", "expected a non-empty string"));
  }
  if (typeof value.weight !== "number" || Number.isNaN(value.weight)) {
    issues.push(issue("weight", "expected a number"));
  }
  if (!isUnitIntervalNumber(value.reliability)) {
    issues.push(issue("reliability", "expected a number in [0, 1]"));
  }
  if (!isNonEmptyString(value.snapshot)) {
    issues.push(issue("snapshot", "expected a non-empty snapshot identifier"));
  }
  if (!isRecord(value.origin)) {
    issues.push(issue("origin", "expected a DataProvenance object"));
  }
  if (!isNonEmptyString(value.checksum)) {
    issues.push(issue("checksum", "expected a non-empty string"));
  }
  if (!Array.isArray(value.references)) {
    issues.push(issue("references", "expected an array"));
  }
  return issues.length > 0 ? invalidResult(issues) : validResult();
}

/**
 * Validates that `value` structurally satisfies the {@link Recommendation}
 * contract (recommendations/recommendation.ts), in addition to the base
 * entity shape.
 */
export function validateRecommendationShape(value: unknown): ValidationResult {
  const baseResult = validateBaseEntityShape(value);
  if (!isRecord(value)) {
    return baseResult;
  }
  const issues: ValidationIssue[] = [...baseResult.issues];

  if (!isNonEmptyString(value.reason)) {
    issues.push(issue("reason", "expected a non-empty string"));
  }
  if (!isNonEmptyString(value.priority)) {
    issues.push(issue("priority", "expected a non-empty string"));
  }
  if (!isUnitIntervalNumber(value.confidence)) {
    issues.push(issue("confidence", "expected a number in [0, 1]"));
  }
  if (!isRecord(value.impact)) {
    issues.push(issue("impact", "expected an ImpactAssessment object"));
  }
  if (!Array.isArray(value.affectedEntities) || value.affectedEntities.length === 0) {
    issues.push(issue("affectedEntities", "expected a non-empty array"));
  }
  if (!Array.isArray(value.recommendedActions)) {
    issues.push(issue("recommendedActions", "expected an array"));
  }
  if (!Array.isArray(value.evidence)) {
    issues.push(issue("evidence", "expected an array of evidence ids"));
  }
  if (!Array.isArray(value.limitations)) {
    issues.push(issue("limitations", "expected an array"));
  }
  return issues.length > 0 ? invalidResult(issues) : validResult();
}

/**
 * Validates that `value` structurally satisfies the
 * {@link CalculationContext} contract (context/calculation-context.ts).
 */
export function validateCalculationContextShape(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return invalidResult([issue("$", "expected an object")]);
  }
  const issues: ValidationIssue[] = [];

  if (!isNonEmptyString(value.contextId)) {
    issues.push(issue("contextId", "expected a non-empty string"));
  }
  if (value.scope !== "global" && !isRecord(value.scope)) {
    issues.push(issue("scope", 'expected an EntityReference or the string "global"'));
  }
  if (!isNonEmptyString(value.snapshot)) {
    issues.push(issue("snapshot", "expected a non-empty snapshot identifier"));
  }
  if (!isNonEmptyString(value.requestedAt)) {
    issues.push(issue("requestedAt", "expected an ISO-8601 date-time string"));
  }
  if (!isNonEmptyString(value.requestedBy)) {
    issues.push(issue("requestedBy", "expected a non-empty string"));
  }
  if (!isNonEmptyString(value.correlationId)) {
    issues.push(issue("correlationId", "expected a non-empty string"));
  }
  const validEnvironments = ["production", "staging", "test", "sandbox"];
  if (typeof value.environment !== "string" || !validEnvironments.includes(value.environment)) {
    issues.push(issue("environment", `expected one of: ${validEnvironments.join(", ")}`));
  }
  if (!isRecord(value.extensions)) {
    issues.push(issue("extensions", "expected an object"));
  }
  return issues.length > 0 ? invalidResult(issues) : validResult();
}

/**
 * Throws a {@link ContractValidationError} if `result` is not valid.
 * Centralizes the "validate, then assert" pattern so callers do not need to
 * repeat the same `if (!result.valid) throw ...` at every call site.
 */
export function assertValid(contractName: string, result: ValidationResult): void {
  if (!result.valid) {
    throw new ContractValidationError(
      contractName,
      result.issues.map((i) => `${i.path}: ${i.message}`),
    );
  }
}

/**
 * The single sanctioned way to produce a branded {@link Identifier} from a
 * raw string.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * `Identifier<TKind>` is a compile-time brand with no runtime
 * representation — a plain string cannot be assigned to it without an
 * assertion. Rather than let every call site sprinkle its own `as
 * Identifier<...>` casts (easy to get wrong, impossible to grep for
 * consistently), this one function is the sanctioned boundary where a
 * validated string becomes a typed identifier. It performs no validation
 * of its own beyond non-emptiness, by design: deciding whether a
 * particular string is a *meaningful* id for a given entity kind is a
 * business concern for a future engine, not a structural one for this
 * foundation.
 */
export function toIdentifier<TKind extends string>(value: string): Identifier<TKind> {
  if (value.length === 0) {
    throw new ContractValidationError("Identifier", ["expected a non-empty string"]);
  }
  return value as Identifier<TKind>;
}

/**
 * The single sanctioned way to produce a branded {@link IsoDateTime} from a
 * raw string, mirroring {@link toIdentifier}'s role for identifiers.
 *
 * Validates only that the string parses as a date at all (structural), not
 * that it is a *meaningful* timestamp for any particular field — deciding
 * whether, say, a `calculatedAt` in the future is acceptable is a business
 * concern for a future engine, not a structural one for this foundation.
 */
export function toIsoDateTime(value: string): IsoDateTime {
  if (Number.isNaN(Date.parse(value))) {
    throw new ContractValidationError("IsoDateTime", [
      `"${value}" does not parse as a valid date-time`,
    ]);
  }
  return value as IsoDateTime;
}
