import type { DatabaseSync } from "node:sqlite";
import type { SiteRow } from "@/lib/types";
import type { LegacyDataTrustResult } from "./data-trust-score-adapter";
import { dataTrustForSite } from "@/services/data-trust-engine";
import { getWritableDb } from "@/lib/db";

/**
 * Genesis Phase 2 — Increment 7 (Data Trust read-only outer adapter).
 *
 * The previously-deferred, DB-touching outer half of `08_ADAPTER_STRATEGY.md`'s
 * adapter #2 (Increment 4 built only the pure inner translator -- see that module's
 * own header comment). Formally scoped into Increment 7 by
 * `docs/genesis-phase-2/23_INCREMENT_6_5_ARCHITECTURAL_DECISIONS.md` Decision C
 * (ADR-018).
 *
 * This module does exactly two things, per `08_ADAPTER_STRATEGY.md`'s "infrastructure-
 * touching adapters must remain thin" rule: fetch legacy data, and shape it for the
 * caller. It performs no canonical translation (no `toIdentifier`, no `Score`/
 * `Recommendation` construction -- that is the Orchestrator's and the pure adapters'
 * job), no HTTP projection, no persistence, no cache write, and no mutation. It is
 * consumed exclusively by the minimal `IntelligenceOrchestrator`
 * (`services/intelligence-runtime/intelligence-orchestrator-instance.ts`) -- never
 * called directly by a route or the API Projection Adapter.
 *
 * `dataTrustForSite(db, siteId, false)` is called with a literal `false` third
 * argument, never omitted (the legacy function's own default is `true`) and never a
 * variable that could evaluate to `true`. This is a mandatory, binding requirement of
 * Decision C, verified independently by this repository's contract tests
 * (`tests/intelligence-data-trust-read-adapter-contract.test.ts`).
 *
 * Uses `getWritableDb()`, the same acquisition helper the legacy route
 * (`app/api/data-trust/site/route.ts`) already uses -- deliberately not `getDb()`'s
 * `PRAGMA query_only = ON` connection, because `dataTrustForSite()` unconditionally
 * calls `ensureDataTrustTables(db)` (a `CREATE TABLE IF NOT EXISTS` schema statement)
 * regardless of the `persist` argument, and a query-only connection would reject that
 * statement even though it is a pre-existing, idempotent, no-op-when-tables-exist
 * statement, not a business-data write. The genuinely-read-only guarantee this
 * increment requires comes from the explicit `persist=false` argument (confirmed by
 * direct source inspection of `services/data-trust-engine.ts` to skip both `INSERT`
 * statements and the `recordAudit` call entirely when `persist` is falsy), not from
 * the SQLite connection's own write permissions. See
 * `docs/genesis-phase-2/24_INCREMENT_7_CANONICAL_DATA_TRUST_PATH.md` Section 9/15 for
 * the full reasoning.
 *
 * This module does NOT change `services/data-trust-engine.ts`'s formula, weights, or
 * behavior in any way, and does not make the canonical `"data-trust"` engine "active" --
 * it remains `status: "planned"` after this increment, exactly as before.
 */
export interface LegacyDataTrustReadResult {
  readonly site: SiteRow;
  readonly trust: LegacyDataTrustResult;
}

/**
 * Fetches the legacy Data Trust result for one Site, read-only. Returns `null` when
 * the Site does not exist (passed straight through from `dataTrustForSite`'s own
 * `null` return for that case).
 */
export function fetchLegacyDataTrustForSite(
  siteId: number,
  db: DatabaseSync = getWritableDb(),
): LegacyDataTrustReadResult | null {
  const result = dataTrustForSite(db, siteId, false);
  if (!result) return null;
  const { site, ...trust } = result;
  return { site, trust: trust as LegacyDataTrustResult };
}
