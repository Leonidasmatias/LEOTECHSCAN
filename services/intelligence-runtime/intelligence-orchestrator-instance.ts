import { adaptLegacySiteRow, toSiteEntityReference } from "@/services/intelligence-adapters/site-entity-adapter";
import { adaptLegacyDataTrustResult } from "@/services/intelligence-adapters/data-trust-score-adapter";
import { adaptLegacyRecommendation } from "@/services/intelligence-adapters/recommendation-adapter";
import { deriveSiteSnapshot } from "@/services/intelligence-adapters/snapshot-provider";
import { fetchLegacyDataTrustForSite } from "@/services/intelligence-adapters/data-trust-read-adapter";
import type { CalculationContext } from "@/services/intelligence";
import { createDataTrustOrchestrator, type CanonicalDataTrustOrchestrationResult } from "./intelligence-orchestrator";

/**
 * Genesis Phase 2 — Increment 7. Real production wiring for the minimal Data Trust
 * Orchestrator (`intelligence-orchestrator.ts`). This is the only module, besides
 * `services/intelligence-adapters/data-trust-read-adapter.ts` itself, that
 * transitively imports `node:sqlite` in this increment (via `fetchLegacyDataTrustForSite`
 * -> `services/data-trust-engine.ts` -> `services/site-service.ts` -> `lib/db.ts`) --
 * it must never be imported by a unit test. Route-level and Orchestrator-level unit
 * tests import `createDataTrustOrchestrator` directly with injected fakes instead
 * (see `docs/genesis-phase-2/24_INCREMENT_7_CANONICAL_DATA_TRUST_PATH.md` Section 4).
 *
 * Every dependency here besides `fetchLegacyDataTrustForSite` is itself a pure,
 * unmodified adapter from an earlier increment.
 */
function environment(): CalculationContext["environment"] {
  return process.env.NODE_ENV === "test" ? "test" : "production";
}

const dataTrustOrchestrator = createDataTrustOrchestrator({
  fetchLegacyDataTrustForSite,
  deriveSiteSnapshot,
  adaptLegacySiteRow,
  toSiteEntityReference,
  adaptLegacyDataTrustResult,
  adaptLegacyRecommendation,
  now: () => new Date().toISOString(),
  environment,
});

/**
 * The real, DB-backed entry point the canonical route calls (via a dynamic `import()`
 * inside the route's `GET` handler, never a static top-level import -- see
 * `app/api/intelligence/data-trust/site/route.ts`'s own header comment for why).
 */
export function getCanonicalDataTrustForSite(siteId: number): CanonicalDataTrustOrchestrationResult {
  return dataTrustOrchestrator.getCanonicalDataTrustForSite(siteId);
}
