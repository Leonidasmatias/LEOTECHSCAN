# Stage 0 — Change Plan

Every file created or modified during Stage 0, grouped by work package. Nothing outside this list was touched. No file was deleted, renamed, or moved; no schema in the production database was altered (WP0.8 changes the *importer's* logic, not the current database's schema — see `04_IMPORT_SAFETY.md`); no production data was written to.

## WP0.3 — Capability Truth Registry
- `config/capabilities.json` — **new**. 22 capability entries (key, displayName, status, evidenceType, backendAvailable, dataSource, limitations, lastValidatedAt).

## WP0.4 — Correct Copernicus/Sentinel-1 Representation
- `services/copernicus-engine.ts` — **modified**. Removed the dead credential-conditioned branch; `fetchSentinel1Metadata`, `copernicusForSite`, `copernicusStatus` now unconditionally report `dataStatus: "simulated"`, `source: "local_rule_engine"`, `isRealSatelliteEvidence: false`, plus an explicit warning string. Expanded `limitations`.
- `components/CapabilityBadge.tsx` — **new**. `CapabilityBadge` / `CapabilityNote` components and `getCapability()` helper, reading `config/capabilities.json` as the single source of truth.
- `app/globals.css` — **modified, additive only**. Added `.cap-badge` and per-status color rules.
- `components/CopernicusModules.tsx`, `SentinelCoreModules.tsx`, `MissionControl.tsx`, `DataTrustModules.tsx`, `Sprint2BModules.tsx`, `Sprint4Modules.tsx` — **modified**. Badges/notes wired to their respective screens; `MissionControl.tsx`'s "SENTINEL-1 V2 · MISSION CONTROL" eyebrow corrected to plain "MISSION CONTROL".
- `services/copernicus-truth.ts` — **new** (WP0.10 follow-up: extracted from `services/copernicus-engine.ts` to fix a test-collection failure, see `05_TEST_BASELINE.md`'s "Follow-up, attempt 2"). Dependency-free module (zero imports) holding the truth-contract constants (`COPERNICUS_DATA_STATUS`, `COPERNICUS_SOURCE`, `COPERNICUS_IS_REAL_SATELLITE_EVIDENCE`, `MOCK_SCENE_ID_PREFIX`), `copernicusTruthMetadata()`, `isTruthfulCopernicusResponse()`, `allScenesAreMarkedSynthetic()`.
- `services/copernicus-engine.ts` — **modified** (same follow-up). Now imports and calls `copernicusTruthMetadata()` / `MOCK_SCENE_ID_PREFIX` from `services/copernicus-truth.ts` at all four response-construction sites instead of hardcoding the triplet and the scene-id prefix inline. Verified behaviorally equivalent — same output, same fields, same values.

## WP0.5 — Export Path Protection
- `lib/export-path.ts` — **new** (WP0.10 follow-up: extracted from `app/api/export/route.ts` so the logic is unit-testable; behavior unchanged). Contains `sanitizeFilenameSegment` and `resolveExportPath`.
- `app/api/export/route.ts` — **modified**. All 12 `path.join(exportDir, …)` call sites replaced with `resolveExportPath(exportDir, …)`; site-CSV/PDF filenames now built from `sanitizeFilenameSegment(site.site, …)` instead of the raw value; the 3 `X-Export-Path` response headers now send `path.basename(filePath)` instead of the full absolute path.

## WP0.6 — CSV/Excel Formula Injection sanitizer
- `utils/csv.ts` — **rewritten**. `sanitizeCsvValue`, `csvCell`, `csvRows` now prefix any cell starting with `= + - @` or a raw tab/CR with a leading apostrophe.
- `importers/multi_operator_import.py` — **modified** (this same file also carries the WP0.8 changes below). Added `sanitize_csv_value()` / `_FORMULA_TRIGGER_CHARS`, wired into `write_csv()`.

## WP0.7 — Basic API Protection
- `next.config.ts` — **rewritten**. Adds standard security response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, `Permissions-Policy`). Does not add authentication.
- `lib/request-guard.ts` — **new**. `clampQueryText`, `clampQueryNumber`.
- `app/api/telecom-ai/route.ts` — **modified**. Free-text `q` param clamped via `clampQueryText`.
- `app/api/geointelligence/route.ts` — **modified**. `siteId` and `radiusKm` clamped via `clampQueryNumber` (radius was previously unbounded).

## WP0.8 — Preserve Derived Tables During Import
- `importers/multi_operator_import.py` — **modified**. `read_sheet()`'s three internal `conn.commit()` calls removed; all `conn.executescript()` calls inside the write transaction replaced with a new `_exec_statements()` helper (Python's `executescript()` implicitly commits and would have defeated the fix). `import_all()` rewritten to run DROP+CREATE+inserts for `sites`/`metadata`/`import_audit` only, inside one `BEGIN IMMEDIATE` … `COMMIT`/`ROLLBACK` transaction, never touching any other table. See `04_IMPORT_SAFETY.md` for the full before/after and test results.

## WP0.9 — Database Backup/Restore scripts
- `scripts/backup_database.py` — **new**. Timestamped, integrity-verified `VACUUM INTO` snapshot with a JSON manifest; never overwrites an existing backup.
- `scripts/restore_database.py` — **new**. Dry-run by default; `--yes` to actually restore; takes an automatic safety backup of the current target before overwriting it; verifies tamper/corruption via manifest hash before touching anything.

## WP0.10 — Initial Automated Tests
- `vitest.config.ts` — **new**, **later modified twice**. First attempt added `test.server.deps.external` / `ssr.external` for `node:`-prefixed specifiers, aiming to fix a Vitest-only `node:sqlite` resolution failure — **this did not work** (the failure persisted with the specifier already stripped to bare `sqlite` by the time the check ran). Left in place as harmless defense-in-depth, but the actual fix was architectural, not configuration (see below and `05_TEST_BASELINE.md`'s "Follow-up" sections).
- `tests/csv.test.ts`, `tests/request-guard.test.ts`, `tests/export-path.test.ts`, `tests/capabilities-registry.test.ts` — **new**.
- `tests/copernicus-truth.test.ts` — **new, then rewritten**. Originally imported `@/services/copernicus-engine` directly (which transitively reaches `node:sqlite` via `@/lib/db`); rewritten to import only the new dependency-free `@/services/copernicus-truth` module, removing the transitive path to `node:sqlite` entirely — the actual fix for the collection failure.
- `tests/copernicus-engine-contract.test.ts` — **new**. Source-inspection companion test (reads `services/copernicus-engine.ts` as text via `fs.readFileSync`, never imports it) confirming the engine actually uses the shared truth module rather than drifting back to its own hardcoded copy.
- `package.json` — **modified**. Added `"test": "vitest run"` script and `vitest` devDependency.

## WP0.11 — System Health Endpoint
- `app/api/system-health/route.ts` — **new**. `GET /api/system-health`.

## WP0.12 — Truthful Capability Badges in UI
- `components/Sprint2BModules.tsx` — **modified**. Added badges/notes for `alert_center`, `market_intelligence` (previously unbadged).
- `components/Sprint3Modules.tsx` — **modified**. Added the `CapabilityBadge`/`CapabilityNote` import plus badges/notes for `data_quality`, `duplicate_detection`, `national_timeline`.
- `components/Dashboard.tsx` — **modified**. Added a badge/note for `site_mapping` on the national map section.
- `components/SentinelCoreModules.tsx` — **modified**. Added a second badge/note for the broader `sentinel_core` capability alongside the existing `intelligence_graph` one.
- `components/CopernicusModules.tsx` — **modified**. Added explicit `unavailable` badges/notes for `sentinel_1_processing` and `sentinel_1_change_detection` in the governance panel, since neither has any UI section of its own to attach to.

## Documentation (this stage)
- `docs/stage-0/00_STAGE_0_SUMMARY.md` through `08_REMAINING_RISKS.md` — **new**, 9 files.
