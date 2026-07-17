// GENESIS PHASE 2 -- Increment 7 (Minimal Snapshot Provider).
// Pure unit tests for services/intelligence-adapters/snapshot-provider.ts.
// No I/O, no node:sqlite -- constructed entirely from plain object literals.
import { describe, it, expect } from "vitest";
import { deriveSiteSnapshot, type SnapshotProviderInput } from "@/services/intelligence-adapters";

function input(overrides: Partial<SnapshotProviderInput> = {}): SnapshotProviderInput {
  return { dataImportacao: "2026-01-01", arquivoOrigem: "sites_jan_2026.xlsx", ...overrides };
}

describe("deriveSiteSnapshot", () => {
  it("1. prefers dataImportacao when present and non-placeholder", () => {
    const result = deriveSiteSnapshot(input());
    expect(result.kind).toBe("derived");
    expect(result.source).toBe("data_importacao");
    expect(result.snapshotId).toBe("derived:data-importacao:2026-01-01");
    expect(result.limitation).toBeNull();
  });

  it("2. trims whitespace from dataImportacao", () => {
    const result = deriveSiteSnapshot(input({ dataImportacao: "  2026-01-01  " }));
    expect(result.snapshotId).toBe("derived:data-importacao:2026-01-01");
  });

  it("3. falls back to arquivoOrigem when dataImportacao is empty", () => {
    const result = deriveSiteSnapshot(input({ dataImportacao: "" }));
    expect(result.kind).toBe("derived");
    expect(result.source).toBe("arquivo_origem");
    expect(result.snapshotId).toBe("derived:arquivo-origem:sites_jan_2026.xlsx");
    expect(result.limitation).toBeNull();
  });

  it("4. falls back to arquivoOrigem when dataImportacao is the legacy 'Não informado' placeholder", () => {
    const result = deriveSiteSnapshot(input({ dataImportacao: "Não informado" }));
    expect(result.source).toBe("arquivo_origem");
  });

  it("5. trims whitespace from arquivoOrigem fallback", () => {
    const result = deriveSiteSnapshot(input({ dataImportacao: "", arquivoOrigem: "  file.xlsx  " }));
    expect(result.snapshotId).toBe("derived:arquivo-origem:file.xlsx");
  });

  it("6. uses the fixed synthetic fallback when both fields are absent", () => {
    const result = deriveSiteSnapshot(input({ dataImportacao: "", arquivoOrigem: "" }));
    expect(result.kind).toBe("synthetic");
    expect(result.source).toBe("fallback");
    expect(result.snapshotId).toBe("synthetic:no-import-metadata");
  });

  it("7. uses the fixed synthetic fallback when both fields are the legacy placeholder", () => {
    const result = deriveSiteSnapshot(input({ dataImportacao: "Não informado", arquivoOrigem: "Não informado" }));
    expect(result.kind).toBe("synthetic");
    expect(result.snapshotId).toBe("synthetic:no-import-metadata");
  });

  it("8. discloses a limitation only when the synthetic fallback fires", () => {
    const synthetic = deriveSiteSnapshot(input({ dataImportacao: "", arquivoOrigem: "" }));
    expect(synthetic.limitation).not.toBeNull();
    expect(synthetic.limitation?.severity).toBe("informational");

    const derived = deriveSiteSnapshot(input());
    expect(derived.limitation).toBeNull();
  });

  it("9. is deterministic across repeated calls with identical input", () => {
    const a = deriveSiteSnapshot(input());
    const b = deriveSiteSnapshot(input());
    expect(a.snapshotId).toBe(b.snapshotId);
    expect(a.kind).toBe(b.kind);
    expect(a.source).toBe(b.source);

    const syntheticA = deriveSiteSnapshot(input({ dataImportacao: "", arquivoOrigem: "" }));
    const syntheticB = deriveSiteSnapshot(input({ dataImportacao: "", arquivoOrigem: "" }));
    expect(syntheticA.snapshotId).toBe(syntheticB.snapshotId);
  });

  it("10. produces different, non-colliding ids for the two source kinds given similar raw values", () => {
    const fromImport = deriveSiteSnapshot(input({ dataImportacao: "abc", arquivoOrigem: "xyz" }));
    const fromFile = deriveSiteSnapshot(input({ dataImportacao: "", arquivoOrigem: "abc" }));
    expect(fromImport.snapshotId).not.toBe(fromFile.snapshotId);
    expect(fromImport.snapshotId).toBe("derived:data-importacao:abc");
    expect(fromFile.snapshotId).toBe("derived:arquivo-origem:abc");
  });

  it("11. does not mutate its input", () => {
    const frozenInput = Object.freeze(input());
    expect(() => deriveSiteSnapshot(frozenInput)).not.toThrow();
  });

  it("12. never throws for whitespace-only fields", () => {
    expect(() => deriveSiteSnapshot(input({ dataImportacao: "   ", arquivoOrigem: "   " }))).not.toThrow();
    const result = deriveSiteSnapshot(input({ dataImportacao: "   ", arquivoOrigem: "   " }));
    expect(result.kind).toBe("synthetic");
  });
});
