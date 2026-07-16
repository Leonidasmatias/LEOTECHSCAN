import {
  parseSemanticVersion,
  validResult,
  invalidResult,
  type ValidationResult,
  type ValidationIssue,
} from "@/services/intelligence";
import { ENGINE_DECLARATION_STATUSES } from "@/services/intelligence";
import { SECURITY_ROLES, HEALTH_CHECK_KINDS, MANIFEST_SCOPES } from "./engine-manifest";

/**
 * Structural validation for `EngineManifest` (`engine-manifest.ts`), following the exact
 * pattern of `services/intelligence/validation/validators.ts`: shape only, never business
 * plausibility, never echoing the received runtime value back in a message (so a
 * malformed manifest produced from untrusted input cannot leak its contents through an
 * error string) — the same "sanitized error" discipline `lib/auth-guard.ts` established
 * for Increment 0.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

/** Recursively checks that no function value appears anywhere in the manifest — a
 * manifest is data, never executable code (Step 4's "no arbitrary executable functions"
 * requirement). */
function findFunctionPaths(value: unknown, path: string, out: string[]): void {
  if (typeof value === "function") {
    out.push(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findFunctionPaths(item, `${path}[${index}]`, out));
    return;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      findFunctionPaths(value[key], path ? `${path}.${key}` : key, out);
    }
  }
}

function validatePort(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, "expected a ManifestPort object"));
    return;
  }
  if (!isNonEmptyString(value.name)) {
    issues.push(issue(`${path}.name`, "expected a non-empty string"));
  }
  if (!isNonEmptyString(value.shape)) {
    issues.push(issue(`${path}.shape`, "expected a non-empty string"));
  }
  if (typeof value.required !== "boolean") {
    issues.push(issue(`${path}.required`, "expected a boolean"));
  }
}

/**
 * Validates that `value` structurally satisfies the `EngineManifest` contract
 * (`07_ENGINE_MANIFEST.md`). Does not check that `capabilityKey` resolves to a real
 * `config/capabilities.json` entry — that cross-reference is `16_QUALITY_GATES.md`'s
 * separate mechanical check, not this structural validator's job (matching
 * `services/intelligence/validation/validators.ts`'s own stated design boundary).
 */
export function validateEngineManifestShape(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return invalidResult([issue("$", "expected an object")]);
  }
  const issues: ValidationIssue[] = [];

  // EngineDeclaration base fields.
  if (!isNonEmptyString(value.id)) {
    issues.push(issue("id", "expected a non-empty string"));
  }
  if (!isNonEmptyString(value.name)) {
    issues.push(issue("name", "expected a non-empty string"));
  }
  if (!isNonEmptyString(value.description)) {
    issues.push(issue("description", "expected a non-empty string"));
  }
  if (
    typeof value.status !== "string" ||
    !(ENGINE_DECLARATION_STATUSES as readonly string[]).includes(value.status)
  ) {
    issues.push(
      issue("status", `expected one of: ${ENGINE_DECLARATION_STATUSES.join(", ")}`),
    );
  }
  if (!isStringArray(value.capabilities)) {
    issues.push(issue("capabilities", "expected an array of strings"));
  }
  if (value.owner !== undefined && typeof value.owner !== "string") {
    issues.push(issue("owner", "expected a string when present"));
  }
  if (!isRecord(value.version)) {
    issues.push(issue("version", "expected an EngineVersionInfo object"));
  }

  // Manifest-specific required fields.
  const engineVersionParsed =
    typeof value.engineVersion === "string" ? parseSemanticVersion(value.engineVersion) : null;
  if (!isNonEmptyString(value.engineVersion) || !engineVersionParsed) {
    issues.push(issue("engineVersion", "expected a valid semantic version string"));
  }
  const contractVersionParsed =
    typeof value.contractVersion === "string" ? parseSemanticVersion(value.contractVersion) : null;
  if (!isNonEmptyString(value.contractVersion) || !contractVersionParsed) {
    issues.push(issue("contractVersion", "expected a valid semantic version string"));
  }
  if (!isNonEmptyString(value.configurationVersion)) {
    issues.push(issue("configurationVersion", "expected a non-empty string"));
  }
  if (!isNonEmptyString(value.capabilityKey)) {
    issues.push(issue("capabilityKey", "expected a non-empty string"));
  }

  // Dependencies: array of non-empty ids, no duplicates, no self-dependency.
  if (!isStringArray(value.dependencies)) {
    issues.push(issue("dependencies", "expected an array of engine id strings"));
  } else {
    const seen = new Set<string>();
    for (const dependencyId of value.dependencies) {
      if (!isNonEmptyString(dependencyId)) {
        issues.push(issue("dependencies[]", "expected a non-empty engine id string"));
        continue;
      }
      if (seen.has(dependencyId)) {
        issues.push(issue("dependencies", `duplicate dependency id: "${dependencyId}"`));
      }
      seen.add(dependencyId);
      if (isNonEmptyString(value.id) && dependencyId === value.id) {
        issues.push(issue("dependencies", "an engine cannot depend on itself"));
      }
    }
  }

  if (typeof value.supportsPreview !== "boolean") {
    issues.push(issue("supportsPreview", "expected a boolean"));
  }
  if (typeof value.supportsPersistence !== "boolean") {
    issues.push(issue("supportsPersistence", "expected a boolean"));
  }
  if (typeof value.supportsBatch !== "boolean") {
    issues.push(issue("supportsBatch", "expected a boolean"));
  } else if (value.supportsBatch) {
    if (typeof value.maxBatchSize !== "number" || !(value.maxBatchSize > 0)) {
      issues.push(issue("maxBatchSize", "expected a positive number when supportsBatch is true"));
    }
  } else if (value.maxBatchSize !== null) {
    issues.push(issue("maxBatchSize", "expected null when supportsBatch is false"));
  }

  if (value.supportedScopes !== undefined) {
    if (
      !Array.isArray(value.supportedScopes) ||
      !value.supportedScopes.every((scope) => (MANIFEST_SCOPES as readonly string[]).includes(scope))
    ) {
      issues.push(
        issue("supportedScopes", `expected an array containing only: ${MANIFEST_SCOPES.join(", ")}`),
      );
    }
  }

  if (
    typeof value.securityRequirement !== "string" ||
    !(SECURITY_ROLES as readonly string[]).includes(value.securityRequirement)
  ) {
    issues.push(
      issue("securityRequirement", `expected one of: ${SECURITY_ROLES.join(", ")}`),
    );
  }

  if (value.inputs !== undefined) {
    if (!Array.isArray(value.inputs)) {
      issues.push(issue("inputs", "expected an array"));
    } else {
      value.inputs.forEach((port, index) => validatePort(port, `inputs[${index}]`, issues));
    }
  }
  if (value.outputs !== undefined) {
    if (!Array.isArray(value.outputs)) {
      issues.push(issue("outputs", "expected an array"));
    } else {
      value.outputs.forEach((port, index) => validatePort(port, `outputs[${index}]`, issues));
    }
  }

  if (!isRecord(value.observability)) {
    issues.push(issue("observability", "expected a ManifestObservability object"));
  } else {
    if (!isStringArray(value.observability.emitsEvents)) {
      issues.push(issue("observability.emitsEvents", "expected an array of strings"));
    }
    if (
      typeof value.observability.healthCheck !== "string" ||
      !(HEALTH_CHECK_KINDS as readonly string[]).includes(value.observability.healthCheck)
    ) {
      issues.push(
        issue("observability.healthCheck", `expected one of: ${HEALTH_CHECK_KINDS.join(", ")}`),
      );
    }
  }

  const functionPaths: string[] = [];
  findFunctionPaths(value, "", functionPaths);
  for (const path of functionPaths) {
    issues.push(issue(path || "$", "manifests must not contain executable functions"));
  }

  return issues.length > 0 ? invalidResult(issues) : validResult();
}
