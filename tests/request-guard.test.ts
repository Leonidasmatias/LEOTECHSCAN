// STAGE 0 -- WP0.10 Initial Automated Tests (5 of 10 and 6 of 10).
// Covers WP0.7 Basic API Protection request-shape guards. Pure functions, no network/DB.
import { describe, it, expect } from "vitest";
import { clampQueryText, clampQueryNumber } from "@/lib/request-guard";

describe("lib/request-guard clampQueryText (WP0.7)", () => {
  it("test 5/10: truncates text past maxLen and returns the fallback for empty/missing input", () => {
    expect(clampQueryText("x".repeat(1000), 300, "default")).toHaveLength(300);
    expect(clampQueryText(null, 300, "default")).toBe("default");
    expect(clampQueryText("", 300, "default")).toBe("default");
    expect(clampQueryText("short", 300, "default")).toBe("short");
  });
});

describe("lib/request-guard clampQueryNumber (WP0.7)", () => {
  it("test 6/10: clamps into [min, max] and falls back on non-finite/invalid input", () => {
    expect(clampQueryNumber("999999999", { min: 0.1, max: 500, fallback: 30 })).toBe(500);
    expect(clampQueryNumber("-50", { min: 0.1, max: 500, fallback: 30 })).toBe(0.1);
    expect(clampQueryNumber("not-a-number", { min: 0.1, max: 500, fallback: 30 })).toBe(30);
    expect(clampQueryNumber(undefined, { min: 0, max: 100_000_000, fallback: 7 })).toBe(7);
    expect(clampQueryNumber("42", { min: 0, max: 100, fallback: 0 })).toBe(42);
  });
});
