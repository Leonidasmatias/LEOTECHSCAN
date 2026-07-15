# Stage 0 — Import Safety: Preserve Derived Tables During Import (WP0.8)

This is the highest-risk work package in Stage 0, because getting it wrong destroys real data. Everything below is evidence from an actual test run, not a description of intended behavior.

## The problem (audit-v4 risk R4 / backlog B0.9)

The previous `import_all()` built an entirely new database file from scratch — `CREATE_SQL` only defines `sites`, `metadata`, and `import_audit` — then used `Path.replace()` to atomically swap the whole file in. Every table the running application creates on its own (`site_notes`, `site_trust_scores`, `copernicus_scenes`, `site_satellite_validation`, `audit_trail`, `sig_nodes`, `sig_edges`, `sig_snapshots`, `sig_insights`, `site_validation_history`, `site_evidence_center` — 11 tables) simply did not exist in the freshly-built file, because the whole-file swap discarded whatever was there before. Reimporting the Excel sources silently wiped 11 tables' worth of data the application itself had generated.

## The fix

`import_all()` (in `importers/multi_operator_import.py`) now imports **in place**, inside a single SQLite transaction, touching only the three tables this importer owns:

```
BEGIN IMMEDIATE
  DROP TABLE IF EXISTS sites; DROP TABLE IF EXISTS metadata; DROP TABLE IF EXISTS import_audit;
  CREATE TABLE sites (...); CREATE TABLE metadata (...); CREATE TABLE import_audit (...);
  <inserts from each source file>
  <recreate indexes>
COMMIT   -- or ROLLBACK on any exception
```

SQLite's DDL is transactional, so the DROP+CREATE+inserts either all take effect together at `COMMIT`, or — on any exception, or an interrupted process before `COMMIT` — are rolled back as a unit and the prior `sites`/`metadata`/`import_audit` content is left exactly as it was. No statement anywhere in this function references any of the 11 derived tables, so they are never dropped, truncated, or otherwise touched.

## Two bugs caught before any test ran

Both were caught by manually re-tracing the transaction boundary before writing a single test, not by a test failing:

1. **`read_sheet()`'s three internal `conn.commit()` calls.** These were left over from the old design and would have committed the outer transaction partway through a multi-file import — meaning a failure on file 2 of 3 would leave file 1's data committed and files 2–3 rolled back, a partial import masquerading as atomic. Removed; `import_all()` now owns the only commit/rollback in the whole function.
2. **`conn.executescript()`'s implicit commit.** Python's `sqlite3.Connection.executescript()` issues a `COMMIT` before running and its own statements aren't subject to the caller's transaction — using it for the DROP/CREATE/index statements inside the transaction would have silently defeated the whole fix. Replaced with a small `_exec_statements()` helper that splits on `;` and runs each statement through `conn.execute()` instead.

## Test methodology

Testing happened against an isolated copy of the real production database, never the database itself, per explicit instruction. Steps:

1. Copied the production `leotechscan.db` to a scratch location, verified byte-identical via SHA-256 (`1adeae6060394c282b3771e8adffe871ee2be69e7203c1359a32e10a83617010`) against the known production hash.
2. Recorded baseline row counts for all 16 tables in the copy.
3. Built a synthetic 2-row TIM-format Excel fixture (`SITE_ID`s `TEST_SITE_001`/`TEST_SITE_002`, matching every column `TIM_COLUMNS` requires) — no real site data anywhere in it.
4. Ran the real `import_all()` (the fixed version, byte-for-byte the same code now in `importers/multi_operator_import.py`) against the copy with the synthetic fixture as the only source.
5. Compared full table-by-table row counts, `sites` content, `metadata` content, and `import_audit` content before and after.
6. Repeated with a deliberately malformed source file (missing every required TIM column except `SITE_ID`) to force the exception path, and compared the database's state before and after that forced failure.

## Results

**Positive path** — importing the 2-row synthetic fixture:

| Table | Before | After | |
|---|---|---|---|
| sites | 299308 | **2** | replaced, as intended |
| metadata | 6 | 6 | replaced, as intended |
| import_audit | 2 | 1 | replaced, as intended (1 row for the 1 file imported) |
| audit_trail | 288 | 288 | **unchanged** |
| copernicus_scenes | 1270 | 1270 | **unchanged** |
| sig_edges | 5355 | 5355 | **unchanged** |
| sig_insights | 35 | 35 | **unchanged** |
| sig_nodes | 2497 | 2497 | **unchanged** |
| sig_snapshots | 1 | 1 | **unchanged** |
| site_evidence_center | 55 | 55 | **unchanged** |
| site_notes | 1 | 1 | **unchanged** |
| site_satellite_validation | 271 | 271 | **unchanged** |
| site_trust_scores | 270 | 270 | **unchanged** |
| site_validation_history | 270 | 270 | **unchanged** |

All 11 derived tables retained their exact baseline counts. The 2 `sites` rows came through with correct field mapping (site, operadora_origem=TIM, municipio, estado, tecnologia, site_id, station_id all matched the fixture). `metadata` correctly recorded `schema_version`, `imported_at`, `source_name`, `row_count: "2"`, `operators: {"TIM": 2}`. The export snapshot (`export_reports()`, run on a fresh read-only connection after commit) correctly regenerated `sites_consolidados.csv`, `sites_por_operadora.csv`, and `auditoria_importacao.csv` — and the exported latitude/longitude values (`-23.55`, `-46.63`) came through correctly prefixed by the WP0.6 sanitizer (`'-23.55`), confirming that fix works end-to-end through the real import path, not just in isolation.

One incidental observation, not a defect: `sqlite_stat1` (SQLite's own query-planner statistics table, not application data) dropped from 5 rows to 0 after the reimport, because the indexes were recreated and `ANALYZE` hadn't run again yet at the time of the check. This is normal SQLite behavior, not something Stage 0's fix caused to regress — noted here so it isn't mistaken for a 12th derived table being lost. See `08_REMAINING_RISKS.md`.

**Rollback path** — forcing a failure with a malformed source file:

The malformed file (only `SITE_ID` present, all 20 other required TIM columns missing) correctly triggered `RuntimeError: Colunas TIM obrigatorias ausentes em malformed_TIM_test.xlsx: TIPO_DE_ELEMENTO, TECNOLOGIA, ...` from inside `read_sheet()`, before any row was inserted for that file. `import_all()`'s `except` block caught it, called `conn.rollback()`, and logged `import_failed_rolled_back`. A full before/after snapshot of every table's row counts, the `sites` table's content, and the `metadata` table's content showed **zero differences** — the database was left in a state fully identical to before the failed import attempt was made, byte-for-byte in every table checked. The log file correctly recorded the full traceback.

## What this means for a production reimport

The fix is verified to do what it's supposed to do: a reimport replaces `sites`/`metadata`/`import_audit` and nothing else, and a failed reimport leaves the database exactly as it was. It does not mean reimporting is risk-free in every conceivable way — always take a WP0.9 backup before running a reimport against the real database, as a matter of routine, not because this fix is suspected to be wrong.
