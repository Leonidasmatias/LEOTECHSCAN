import { getCanonicalDataTrustForSite } from "@/services/intelligence-runtime/intelligence-orchestrator-instance";
import { getCanonicalEvidenceForSite } from "@/services/intelligence-runtime/intelligence-evidence-orchestrator-instance";
import type { CalculationContext } from "@/services/intelligence";
import { createSiteIntelligenceAggregator, type SiteIntelligenceOrchestrationResult } from "./site-intelligence-aggregator";

/**
 * Genesis Phase 2 — Increment 9. Real production wiring for the minimal
 * Site Intelligence Aggregator (`site-intelligence-aggregator.ts`). This
 * is the only module in this increment that transitively resolves both
 * frozen capability instance modules (via `getCanonicalDataTrustForSite`
 * and `getCanonicalEvidenceForSite`) -- it must never be imported by a
 * unit test. Route-level and Orchestrator-level unit tests import
 * `createSiteIntelligenceAggregator` directly with injected fakes
 * instead.
 *
 * Every dependency here is a reused, unmodified entry point from an
 * earlier increment: `getCanonicalDataTrustForSite` (Increment 7) and
 * `getCanonicalEvidenceForSite` (Increment 8). Neither capability
 * orchestrator, instance, or route is changed by this increment.
 *
 * Both capability calls are synchronous, non-Promise functions -- there
 * is no concurrency to gain from wrapping them in `Promise.all`, and
 * doing so would misleadingly imply parallelism that cannot occur while
 * adding microtask overhead for no benefit. The pure aggregator core
 * calls them sequentially, each isolated in its own try/catch.
 */
function environment(): CalculationContext["environment"] {
  return process.env.NODE_ENV === "test" ? "test" : "production";
}

const siteIntelligenceAggregator = createSiteIntelligenceAggregator({
  getCanonicalDataTrustForSite,
  getCanonicalEvidenceForSite,
  now: () => new Date().toISOString(),
  environment,
});

/**
 * The real, wired entry point the canonical route calls (via a dynamic
 * `import()` inside the route's `GET` handler, never a static top-level
 * import -- see `app/api/intelligence/site/route.ts`'s own header comment
 * for why).
 */
export function getCanonicalSiteIntelligence(siteId: number): SiteIntelligenceOrchestrationResult {
  return siteIntelligenceAggregator.getCanonicalSiteIntelligence(siteId);
}
