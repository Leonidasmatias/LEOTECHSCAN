import { describe, expect, it } from "vitest";
import {
  IntelligenceError,
  ContractValidationError,
  VersionIncompatibilityError,
  EngineNotRegisteredError,
  DuplicateEngineDeclarationError,
  EvidenceIntegrityError,
  UnknownEntityReferenceError,
  INTELLIGENCE_ERROR_CODES,
} from "@/services/intelligence";

describe("typed intelligence errors", () => {
  it("are all instances of both Error and IntelligenceError", () => {
    const errors: IntelligenceError[] = [
      new ContractValidationError("Score", ["value: expected a number"]),
      new VersionIncompatibilityError("2.0.0", "1.0.0"),
      new EngineNotRegisteredError("risk"),
      new DuplicateEngineDeclarationError("risk"),
      new EvidenceIntegrityError("evidence-1", "checksum mismatch"),
      new UnknownEntityReferenceError("NotAnEntity"),
    ];
    for (const error of errors) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(IntelligenceError);
      expect(INTELLIGENCE_ERROR_CODES).toContain(error.code);
      expect(error.name).toBe(error.constructor.name);
    }
  });

  it("carries structured details rather than only a message string", () => {
    const error = new EngineNotRegisteredError("risk");
    expect(error.details).toEqual({ engineId: "risk" });
    expect(error.code).toBe("ENGINE_NOT_REGISTERED");
  });

  it("gives each error class a distinct, closed code", () => {
    const codes = [
      new ContractValidationError("x", []).code,
      new VersionIncompatibilityError("a", "b").code,
      new EngineNotRegisteredError("x").code,
      new DuplicateEngineDeclarationError("x").code,
      new EvidenceIntegrityError("x", "y").code,
      new UnknownEntityReferenceError("x").code,
    ];
    expect(new Set(codes).size).toBe(codes.length);
  });
});
