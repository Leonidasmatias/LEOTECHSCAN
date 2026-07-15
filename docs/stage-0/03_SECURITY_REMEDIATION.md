# Stage 0 — Security Remediation (WP0.5 / WP0.6 / WP0.7)

Three specific, narrowly-scoped fixes for issues the V4 audit found. None of these make the application "secure" in a general sense — see `08_REMAINING_RISKS.md` for what's still open, most importantly the complete absence of authentication (audit-v4 risk R2).

## WP0.5 — Export Path Protection (closes audit-v4 risk R7)

**Before:** export filenames were built with `path.join(exportDir, filename)`, where `filename` could include a site's own `site` field value verbatim. A site record containing path-traversal sequences (`../../`) or absolute-path-like content could, in principle, cause a write outside the intended `EXPORTACOES` directory.

**After:** `lib/export-path.ts` provides two functions, used at all 12 export call sites plus the 2 site-specific ones:
- `sanitizeFilenameSegment(value, fallback)` — NFKD-normalizes, strips combining diacritics, replaces anything outside `[A-Za-z0-9_-]` with a hyphen, trims, caps at 80 characters.
- `resolveExportPath(exportDir, filename)` — basenames the filename first (discarding any directory component), then verifies the resolved absolute path still starts with the resolved `exportDir` plus a path separator, throwing if not.

Also fixed: 3 endpoints were echoing the full absolute server filesystem path back to the client in an `X-Export-Path` response header. These now send `path.basename(filePath)` only.

**Tested:** `tests/export-path.test.ts` (2 of the 10 WP0.10 tests) exercises a traversal attempt (`../../../etc/passwd`) and confirms the resolved path stays inside the export root, that a filename that resolves to exactly `..` is rejected outright, and that diacritics/length are handled correctly on `sanitizeFilenameSegment`.

## WP0.6 — CSV/Excel Formula Injection (closes audit-v4 risk R6, CWE-1236)

**Before:** CSV exports (from both the Next.js export routes and the Python importer's own report generation) wrote cell values verbatim. A cell beginning with `=`, `+`, `-`, or `@` — or a raw tab/carriage-return — is executed as a formula by Excel/Sheets/LibreOffice when the CSV is opened, the classic `=cmd|'/c calc'!A1`-style vector.

**After:** both the TypeScript side (`utils/csv.ts`) and the Python side (`importers/multi_operator_import.py`'s `sanitize_csv_value`) prefix any such cell with a leading apostrophe before it's written, forcing spreadsheet software to render it as literal text.

**Accepted tradeoff, stated explicitly in both files' comments:** a legitimate negative number like `-5` also gets prefixed and will display as text rather than a computed cell. This is the standard OWASP-recommended mitigation and is treated as safe-by-default for report-style exports that are read, not recalculated.

**Note on type behavior:** the TypeScript `sanitizeCsvValue` always returns a `string` (stringifying its input even when no trigger character matches), while the Python `sanitize_csv_value` preserves the original value's type when no trigger matches. This asymmetry is harmless today — TypeScript's only caller (`csvCell`) immediately stringifies anyway — but it means the two are not drop-in equivalents; anyone adding a new caller to either function should check this doc first. Caught and documented via `tests/csv.test.ts`'s test 2, which initially asserted the wrong (type-preserving) behavior for the TS side until actual execution proved otherwise.

**Tested:** `tests/csv.test.ts` (tests 1–4 of 10) and the Python side was exercised as part of the WP0.8 integration test (`04_IMPORT_SAFETY.md`) — the synthetic TIM fixture's negative latitude/longitude values (`-23.55`, `-46.63`) came through the exported CSV correctly prefixed (`'-23.55`), confirmed in that test's actual output.

## WP0.7 — Basic API Protection (partial mitigation of audit-v4 risk R2)

This does **not** add authentication, session management, or rate limiting. Two narrow things were added:

1. **Security response headers** (`next.config.ts`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control: off`, `Permissions-Policy` disabling camera/microphone/geolocation/interest-cohort. Standard defensive headers, applied to every route.
2. **Input-shape guards** (`lib/request-guard.ts`): `clampQueryText` (truncates free-text query params to a max length, with a fallback for empty input) and `clampQueryNumber` (clamps a numeric param into `[min, max]`, falling back on non-finite input). Applied to exactly 2 endpoints so far: `app/api/telecom-ai/route.ts` (the `q` free-text param) and `app/api/geointelligence/route.ts` (`siteId` and `radiusKm` — the latter was previously fully unbounded, meaning an attacker-supplied huge radius could force an unbounded-cost bounding-box scan).

**Explicitly not claimed:** coverage of the other ~41 documented API endpoints. `lib/request-guard.ts`'s own header comment states this plainly — extending it further is Stage 1+ backlog, not something this stage silently implies it already did.

**Tested:** `tests/request-guard.test.ts` (tests 5–6 of 10) covers both guard functions directly with boundary values (over-length text, out-of-range numbers, non-numeric input, missing input).
