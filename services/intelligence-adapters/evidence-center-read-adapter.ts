import type { DatabaseSync } from "node:sqlite";
import type { SiteRow } from "@/lib/types";
import type { LegacyEvidenceItem } from "./evidence-adapter";
import { evidenceCenterForSite } from "@/services/evidence-center-engine";
import { getWritableDb } from "@/lib/db";

/**
 * Genesis Phase 2 — Increment 8 (Evidence Center read-only outer adapter).
 *
 * The DB-touching outer half of the Evidence capability path, per
 * `docs/genesis-phase-2/26_INCREMENT_8_IMPLEMENTATION_PLAN.md` Section 5.2
 * (and ADR-018's "outer adapter as its own seam" precedent, already
 * established for Data Trust in Increment 7).
 *
 * This module does exactly two things, per `08_ADAPTER_STRATEGY.md`'s
 * "infrastructure-touching adapters must remain thin" rule: fetch legacy
 * data, and narrow it for the caller. It performs no canonical translation
 * (no `toIdentifier`, no `Evidence` construction -- that is the
 * Orchestrator's and the pure Evidence Adapter's job), no checksum
 * computation, no Snapshot derivation, no HTTP projection, no persistence,
 * no cache write, and no mutation. It is consumed exclusively by the
 * minimal Evidence Orchestrator
 * (`services/intelligence-runtime/intelligence-evidence-orchestrator-instance.ts`)
 * -- never called directly by a route or the projection adapter.
 *
 * `evidenceCenterForSite(db, siteId, false)` is called with a literal
 * `false` third argument, never omitted (the legacy function's own default
 * is `true`) and never a variable that could evaluate to `true`.
 *
 * Uses `getWritableDb()`, the same acquisition helper the legacy routes
 * (`app/api/evidence-center/site/route.ts`,
 * `app/api/evidence-center/export/route.ts`) already use -- deliberately
 * not `getDb()`'s `PRAGMA query_only = ON` connection, because
 * `evidenceCenterForSite()` unconditionally reaches **three** separate
 * schema-initializing calls regardless of the `persist` argument:
 * `ensureDataTrustTables(db)` (its own first line), `ensureCopernicusTables(db)`
 * (via the nested `copernicusForSite()` call), and `ensureSiteNotes(db)`
 * (via the nested `getSiteNotes()` call). Each is a `CREATE TABLE IF NOT
 * EXISTS` statement that is a true no-op once the corresponding table
 * already exists, but requires a writable connection the first time it
 * runs against a database where that table has never been created -- a
 * `query_only` connection would throw "attempt to write a readonly
 * database" in that case. The genuinely-read-only guarantee this
 * increment requires for *business data* comes entirely from the explicit
 * `persist=false` argument (which gates every `INSERT`/`recordAudit` call
 * reachable from `evidenceCenterForSite`, `dataTrustForSite`, and
 * `copernicusForSite` alike, confirmed by direct source inspection), not
 * from the SQLite connection's own write permissions.
 *
 * This module does NOT change `services/evidence-center-engine.ts`'s
 * behavior in any way, and does not make any canonical engine "active".
 */
export interface LegacyEvidenceCenterReadResult {
  readonly site: SiteRow;
  readonly evidences: readonly LegacyEvidenceItem[];
}

/**
 * Fetches the legacy Evidence Center dossier for one Site, read-only, and
 * narrows it to only the fields the Evidence Orchestrator needs: the site
 * row (for Snapshot derivation) and the five-item legacy evidence array
 * (already shaped exactly as `LegacyEvidenceItem` requires). Discards
 * `trust`, `copernicus`, `notes`, `history`, `googleMaps`,
 * `technicalRecommendation`, and `governance` -- none are needed by
 * Snapshot derivation or the Evidence Adapter, and none are smuggled into
 * the canonical result. Returns `null` when the Site does not exist
 * (passed straight through from `evidenceCenterForSite`'s own `null`
 * return for that case).
 */
export function fetchLegacyEvidenceCenterForSite(
  siteId: number,
  db: DatabaseSync = getWritableDb(),
): LegacyEvidenceCenterReadResult | null {
  const dossier = evidenceCenterForSite(db, siteId, false);
  if (!dossier) return null;
  return { site: dossier.site, evidences: dossier.evidences };
}
