// STAGE 0 — WP0.6 CSV/Excel Formula Injection sanitizer (audit-v4 risk R6, CWE-1236).
//
// Any exported cell whose text starts with a character Excel/Sheets/LibreOffice will
// interpret as the start of a formula (=, +, -, @) — or with a raw tab/carriage-return,
// which some parsers also treat as a formula boundary — gets a leading apostrophe. That
// forces spreadsheet software to render it as literal text instead of evaluating it,
// closing the "=cmd|'/c calc'!A1"-style injection vector without changing normal text.
//
// Known, accepted tradeoff: a legitimate negative number ("-5") is also prefixed and will
// display as literal text ("-5") rather than a computed numeric cell. These CSV exports are
// reports for humans to read, not spreadsheets meant for live arithmetic, so this is the
// standard OWASP-recommended mitigation and is treated as safe-by-default.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function sanitizeCsvValue(value: unknown): string {
  const text = String(value ?? "");
  return FORMULA_TRIGGER.test(text) ? `'${text}` : text;
}

export function csvCell(value: unknown) {
  const text = sanitizeCsvValue(value).replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRows(rows: unknown[][]) {
  return "\uFEFF" + rows.map((line) => line.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
