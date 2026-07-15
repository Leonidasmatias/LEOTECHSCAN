// STAGE 0 — WP0.5 Export Path Protection (audit-v4 risk R7).
//
// Any filename segment built from data (e.g. a site identifier) must be neutralized before
// touching the filesystem, and every resolved output path must be proven to stay inside the
// canonical export root. Together these close the path-traversal / arbitrary-write risk found
// in the V4 audit without changing any export's public behavior for well-formed input.
//
// Extracted out of app/api/export/route.ts (WP0.10) so these pure functions can be unit
// tested directly -- Next.js route.ts files may only export HTTP method handlers and a small
// set of config constants, so the logic itself has to live in a plain module.
import path from "node:path";

export function sanitizeFilenameSegment(value: unknown, fallback = "item"): string {
  const cleaned = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

export function resolveExportPath(exportDir: string, filename: string): string {
  const safeName = path.basename(filename).replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!safeName || safeName === "." || safeName === "..") {
    throw new Error("Nome de arquivo de exportação inválido.");
  }
  const root = path.resolve(exportDir) + path.sep;
  const resolved = path.resolve(exportDir, safeName);
  if (!resolved.startsWith(root)) {
    throw new Error("Caminho de exportação fora da raiz permitida (EXPORTACOES).");
  }
  return resolved;
}
