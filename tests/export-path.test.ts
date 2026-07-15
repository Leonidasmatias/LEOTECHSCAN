// STAGE 0 -- WP0.10 Initial Automated Tests (7 of 10 and 8 of 10).
// Covers WP0.5 Export Path Protection (audit-v4 risk R7): path-traversal containment and
// filename sanitization. Uses only in-memory paths -- never touches the real EXPORTACOES
// directory or any file on disk.
import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveExportPath, sanitizeFilenameSegment } from "@/lib/export-path";

describe("lib/export-path resolveExportPath (WP0.5)", () => {
  const exportDir = path.resolve("/tmp/leotechscan-test-exports");

  it("test 7/10: collapses path-traversal attempts to stay confined inside the export root", () => {
    // path.basename() strips any directory components before the containment check runs, so a
    // traversal attempt collapses to a plain filename inside exportDir rather than escaping it.
    const traversalResult = resolveExportPath(exportDir, "../../../etc/passwd");
    expect(traversalResult.startsWith(path.resolve(exportDir) + path.sep)).toBe(true);
    expect(traversalResult).not.toContain("etc" + path.sep + "passwd");

    // A filename that is exactly ".." after basename()-ing must be explicitly rejected.
    expect(() => resolveExportPath(exportDir, "..")).toThrow(/inválido/);
  });

  it("test 7b/10 (well-formed input still resolves correctly inside the root)", () => {
    const result = resolveExportPath(exportDir, "relatorio-2026.csv");
    expect(result).toBe(path.resolve(exportDir, "relatorio-2026.csv"));
  });
});

describe("lib/export-path sanitizeFilenameSegment (WP0.5)", () => {
  it("test 8/10: strips diacritics/unsafe characters, caps length, and applies the fallback", () => {
    expect(sanitizeFilenameSegment("São Paulo/Câmpinas")).toBe("Sao-Paulo-Campinas");
    expect(sanitizeFilenameSegment("../../evil")).not.toContain("/");
    expect(sanitizeFilenameSegment("../../evil")).not.toContain("..");
    expect(sanitizeFilenameSegment("x".repeat(200)).length).toBeLessThanOrEqual(80);
    expect(sanitizeFilenameSegment("", "fallback-value")).toBe("fallback-value");
    expect(sanitizeFilenameSegment(null, "fallback-value")).toBe("fallback-value");
  });
});
