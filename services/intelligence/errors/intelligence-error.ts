import type { IntelligenceErrorCode } from "./error-codes";
import type { EngineId } from "../registry/engine-identity";
import type { Metadata } from "../types/common";

/**
 * The base class for every error the Intelligence Foundation raises.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * The mission is explicit: "No string errors. No ad-hoc exceptions." A
 * `throw new Error("engine not found")` cannot be caught selectively, does
 * not carry structured detail, and gives every catch site the same amount
 * of information: none. Every failure mode in this foundation is instead a
 * typed subclass of `IntelligenceError`, carrying a closed `code` (see
 * error-codes.ts) a caller can `switch` on, plus whatever structured
 * `details` are relevant to that specific failure.
 */
export abstract class IntelligenceError extends Error {
  public abstract readonly code: IntelligenceErrorCode;
  public readonly details: Metadata;

  protected constructor(message: string, details: Metadata = {}) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

/**
 * Raised when a value does not satisfy a contract's structural
 * requirements (see validation/validators.ts).
 */
export class ContractValidationError extends IntelligenceError {
  public readonly code = "CONTRACT_VALIDATION_FAILED" as const;

  constructor(contractName: string, issues: readonly string[]) {
    super(
      `Value does not satisfy the "${contractName}" contract: ${issues.join("; ")}`,
      { contractName, issues },
    );
  }
}

/**
 * Raised when a candidate version is not compatible with a declared
 * minimum compatible version (see versioning/compatibility.ts).
 */
export class VersionIncompatibilityError extends IntelligenceError {
  public readonly code = "VERSION_INCOMPATIBLE" as const;

  constructor(candidate: string, minimumCompatibleVersion: string) {
    super(
      `Version "${candidate}" is not compatible with minimum compatible version "${minimumCompatibleVersion}"`,
      { candidate, minimumCompatibleVersion },
    );
  }
}

/**
 * Raised when {@link EngineRegistry.get} (registry/engine-registry.ts) is
 * called with an id that has not been declared.
 */
export class EngineNotRegisteredError extends IntelligenceError {
  public readonly code = "ENGINE_NOT_REGISTERED" as const;

  constructor(engineId: EngineId) {
    super(`No engine is registered with id "${engineId}"`, { engineId });
  }
}

/**
 * Raised when {@link EngineRegistry.declare} is called twice with the same
 * engine id.
 */
export class DuplicateEngineDeclarationError extends IntelligenceError {
  public readonly code = "DUPLICATE_ENGINE_DECLARATION" as const;

  constructor(engineId: EngineId) {
    super(`Engine "${engineId}" has already been declared`, { engineId });
  }
}

/**
 * Raised when a piece of Evidence's checksum does not match its recorded
 * provenance, or otherwise fails an integrity check.
 */
export class EvidenceIntegrityError extends IntelligenceError {
  public readonly code = "EVIDENCE_INTEGRITY_FAILED" as const;

  constructor(evidenceId: string, reason: string) {
    super(`Evidence "${evidenceId}" failed an integrity check: ${reason}`, {
      evidenceId,
      reason,
    });
  }
}

/**
 * Raised when a contract references an {@link EntityReference} whose kind
 * is not a recognized canonical entity kind.
 */
export class UnknownEntityReferenceError extends IntelligenceError {
  public readonly code = "UNKNOWN_ENTITY_REFERENCE" as const;

  constructor(kind: string) {
    super(`"${kind}" is not a recognized canonical entity kind`, { kind });
  }
}
