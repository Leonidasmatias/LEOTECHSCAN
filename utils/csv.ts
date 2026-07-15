export function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRows(rows: unknown[][]) {
  return "\uFEFF" + rows.map((line) => line.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
