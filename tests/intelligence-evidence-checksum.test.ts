// GENESIS PHASE 2 -- Increment 8 (Evidence checksum helper).
// Pure unit tests for services/intelligence-adapters/evidence-checksum.ts.
// No I/O, no node:sqlite -- constructed entirely from plain object literals.
import { describe, it, expect } from "vitest";
import { computeEvidenceChecksum } from "@/services/intelligence-adapters";
import type { LegacyEvidenceItem } from "@/services/intelligence-adapters";

function item(overrides: Partial<LegacyEvidenceItem> = {}): LegacyEvidenceItem {
  return {
    type: "CADASTRO",
    source: "vivo_sites.xlsx",
    status: "Disponivel",
    summary: "SITE042 - VIVO - Sao Paulo/SP",
    ...overrides,
  };
}

describe("computeEvidenceChecksum", () => {
  it("1. is deterministic across repeated calls with identical input", () => {
    const a = computeEvidenceChecksum(item());
    const b = computeEvidenceChecksum(item());
    expect(a).toBe(b);
  });

  it("2. produces the exact sha256-v1 prefix format", () => {
    const checksum = computeEvidenceChecksum(item());
    expect(checksum).toMatch(/^sha256-v1:[0-9a-f]{64}$/);
  });

  it("3. hex digest is lowercase", () => {
    const checksum = computeEvidenceChecksum(item());
    const digest = checksum.slice("sha256-v1:".length);
    expect(digest).toBe(digest.toLowerCase());
  });

  it("4. trims whitespace from every field before hashing", () => {
    const padded = computeEvidenceChecksum(
      item({ type: "  CADASTRO  ", source: "  vivo_sites.xlsx  ", status: "  Disponivel  ", summary: "  SITE042 - VIVO - Sao Paulo/SP  " }),
    );
    expect(padded).toBe(computeEvidenceChecksum(item()));
  });

  it("5. distinct representative inputs produce distinct checksums", () => {
    const a = computeEvidenceChecksum(item({ type: "CADASTRO" }));
    const b = computeEvidenceChecksum(item({ type: "COORDENADAS" }));
    const c = computeEvidenceChecksum(item({ summary: "different summary text entirely" }));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it("6. field-boundary safety: shifting content across the type/source boundary changes the checksum (not naively concatenation-equivalent)", () => {
    const a = computeEvidenceChecksum(item({ type: "AB", source: "CD" }));
    const b = computeEvidenceChecksum(item({ type: "ABC", source: "D" }));
    expect(a).not.toBe(b);
  });

  it("7. is deterministic across many repeated calls (no clock/random dependency)", () => {
    const checksums = Array.from({ length: 10 }, () => computeEvidenceChecksum(item()));
    expect(new Set(checksums).size).toBe(1);
  });

  it("8. does not mutate its input", () => {
    const input = item();
    const frozen = Object.freeze(input);
    expect(() => computeEvidenceChecksum(frozen)).not.toThrow();
    computeEvidenceChecksum(frozen);
    expect(input).toEqual(item());
  });

  it("9. handles empty-string fields without throwing", () => {
    expect(() => computeEvidenceChecksum(item({ type: "", source: "", status: "", summary: "" }))).not.toThrow();
    const checksum = computeEvidenceChecksum(item({ type: "", source: "", status: "", summary: "" }));
    expect(checksum).toMatch(/^sha256-v1:[0-9a-f]{64}$/);
  });

  it("10. handles whitespace-only fields identically to empty fields", () => {
    const whitespace = computeEvidenceChecksum(item({ type: "   ", source: "   ", status: "   ", summary: "   " }));
    const empty = computeEvidenceChecksum(item({ type: "", source: "", status: "", summary: "" }));
    expect(whitespace).toBe(empty);
  });

  it("11. carries a version prefix distinguishing it from a future algorithm change", () => {
    const checksum = computeEvidenceChecksum(item());
    expect(checksum.startsWith("sha256-v1:")).toBe(true);
  });

  it("12. never throws for typical legacy evidence content across all five known types", () => {
    for (const type of ["CADASTRO", "COORDENADAS", "COPERNICUS", "QUALIDADE", "OBSERVACOES"]) {
      expect(() => computeEvidenceChecksum(item({ type }))).not.toThrow();
    }
  });
});
