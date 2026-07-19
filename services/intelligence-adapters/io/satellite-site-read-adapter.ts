import type { DatabaseSync } from "node:sqlite";
import type { SiteRow } from "@/lib/types";
import { getWritableDb } from "@/lib/db";
import { siteRow } from "@/services/site-service";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 3.
 *
 * DB-touching outer adapter reading only the site row, per
 * `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
 * Section 23 and `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.4 (as amended by the Wave 3 Change Control decision, tag
 * `genesis-phase-2-increment-10-wave-3-change-control-v1`, approving
 * reuse of the canonical `siteRow(raw)` mapping). Mirrors
 * `data-trust-read-adapter.ts`/`evidence-center-read-adapter.ts`'s own
 * established shape.
 *
 * Never imports either legacy Copernicus module — that import is
 * exclusively `legacy-copernicus-provider.ts`'s own privilege. Performs
 * no writes, no schema initialization, no orchestration, no satellite
 * interpretation of any kind.
 */
export function fetchSatelliteSiteRow(
  siteId: number,
  db: DatabaseSync = getWritableDb(),
): SiteRow | null {
  const raw = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId) as
    | Record<string, unknown>
    | undefined;
  if (!raw) return null;
  return siteRow(raw);
}
