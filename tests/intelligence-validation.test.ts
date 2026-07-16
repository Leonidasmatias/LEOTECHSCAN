import { describe, expect, it } from "vitest";
import {
  assertValid,
  validResult,
  invalidResult,
  ContractValidationError,
  toIdentifier,
} from "@/services/intelligence";

describe("validation result helpers", () => {
  it("validResult produces a passing, issue-free result", () => {
    expect(validResult()).toEqual({ valid: true, issues: [] });
  });

  it("invalidResult carries the given issues", () => {
    const issues = [{ path: "value", message: "expected a number" }];
    expect(invalidResult(issues)).toEqual({ valid: false, issues });
  });
});

describe("assertValid", () => {
  it("does not throw for a valid result", () => {
    expect(() => assertValid("Score", validResult())).not.toThrow();
  });

  it("throws ContractValidationError for an invalid result, with a combined message", () => {
    const result = invalidResult([{ path: "value", message: "expected a number" }]);
    let thrown: unknown = null;
    try {
      assertValid("Score", result);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ContractValidationError);
    expect((thrown as Error).message).toContain("value: expected a number");
  });
});

describe("toIdentifier", () => {
  it("brands a non-empty string as an Identifier", () => {
    const id = toIdentifier<"Site">("site-1");
    expect(id).toBe("site-1");
  });

  it("rejects an empty string", () => {
    expect(() => toIdentifier<"Site">("")).toThrow(ContractValidationError);
  });
});
