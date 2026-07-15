// STAGE 0 -- WP0.10 Initial Automated Tests (1 of 10 and 2 of 10 and 3 of 10 and 4 of 10).
// Covers WP0.6's CSV/Excel Formula Injection sanitizer (audit-v4 risk R6, CWE-1236). These
// tests use only in-memory literal strings -- no real Excel file or database is touched.
import { describe, it, expect } from "vitest";
import { sanitizeCsvValue, csvCell, csvRows } from "@/utils/csv";

describe("utils/csv sanitizeCsvValue (WP0.6 formula injection guard)", () => {
  it("test 1/10: prefixes every known Excel/Sheets formula-trigger character with an apostrophe", () => {
    expect(sanitizeCsvValue("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizeCsvValue("+1234")).toBe("'+1234");
    expect(sanitizeCsvValue("-5")).toBe("'-5"); // documented accepted tradeoff: legit negatives also prefixed
    expect(sanitizeCsvValue("@cmd")).toBe("'@cmd");
    expect(sanitizeCsvValue("\tHIDDEN")).toBe("'\tHIDDEN");
    expect(sanitizeCsvValue("\rHIDDEN")).toBe("'\rHIDDEN");
  });

  it("test 2/10: passes ordinary text through unprefixed, and stringifies non-triggering values", () => {
    // sanitizeCsvValue's return type is always `string` -- unlike the Python-side
    // sanitize_csv_value() (used by the importer), which preserves the original type when no
    // formula-trigger character is present. That asymmetry is harmless today because the only
    // caller, csvCell(), immediately stringifies its result either way -- but it means this
    // function is not a drop-in behavioral match for its Python counterpart, only an equivalent
    // one for CSV-cell purposes. Documented here so a future caller doesn't assume type passthrough.
    expect(sanitizeCsvValue("Sao Paulo")).toBe("Sao Paulo");
    expect(sanitizeCsvValue(42)).toBe("42");
    expect(sanitizeCsvValue(null)).toBe("");
    expect(sanitizeCsvValue(undefined)).toBe("");
  });
});

describe("utils/csv csvCell / csvRows (export report formatting)", () => {
  it("test 3/10: csvCell quotes every value and escapes embedded quotes/newlines", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1 line2"');
    expect(csvCell("=EVIL()")).toBe(`"'=EVIL()"`);
  });

  it("test 4/10: csvRows emits a UTF-8 BOM, semicolon-delimited fields, and CRLF row endings", () => {
    const out = csvRows([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain('"a";"b"\r\n');
    expect(out).toContain('"1";"2"\r\n');
  });
});
