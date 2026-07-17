import { adaptLegacySiteRow, toSiteEntityReference } from "@/services/intelligence-adapters/site-entity-adapter";
import { adaptLegacyEvidence } from "@/services/intelligence-adapters/evidence-adapter";
import { deriveSiteSnapshot } from "@/services/intelligence-adapters/snapshot-provider";
import { computeEvidenceChecksum } from "@/services/intelligence-adapters/evidence-checksum";
import { fetchLegacyEvidenceCenterForSite } from "@/services/intelligence-adapters/evidence-center-read-adapter";
import type { CalculationContext } from "@/services/intelligence";
import { createEvidenceOrchestrator, type CanonicalEvidenceOrchestrationResult } from "./intelligence-evidence-orchestrator";

/**
 * Genesis Phase 2 — Increment 8. Real production wiring for the minimal
 * Evidence Orchestrator (`intelligence-evidence-orchestrator.ts`). This is
 * the only module, besides
 * `services/intelligence-adapters/evidence-center-read-adapter.ts` itself,
 * that transitively imports `node:sqlite` in this increment (via
 * `fetchLegacyEvidenceCenterForSite` -> `services/evidence-center-engine.ts`
 * -> `services/site-service.ts` -> `lib/db.ts`) -- it must never be
 * imported by a unit test. Route-level and Orchestrator-level unit tests
 * import `createEvidenceOrchestrator` directly with injected fakes instead.
 *
 * Every dependency here besides `fetchLegacyEvidenceCenterForSite` is
 * itself a pure, unmodified adapter reused from an earlier increment
 * (`adaptLegacySiteRow`/`toSiteEntityReference` from Increment 3,
 * `deriveSiteSnapshot` from Increment 7/ADR-017, `adaptLegacyEvidence` from
 * Increment 5) or new to this increment
 * (`computeEvidenceChecksum`).
 */
function environment(): CalculationContext["environment"] {
  return process.env.NODE_ENV === "test" ? "test" : "production";
}

const evidenceOrchestrator = createEvidenceOrchestrator({
  fetchLegacyEvidenceCenterForSite,
  deriveSiteSnapshot,
  adaptLegacySiteRow,
  toSiteEntityReference,
  computeEvidenceChecksum,
  adaptLegacyEvidence,
  now: () => new Date().toISOString(),
  environment,
});

/**
 * The real, DB-backed entry point the canonical route calls (via a dynamic
 * `import()` inside the route's `GET` handler, never a static top-level
 * import -- see `app/api/intelligence/evidence-center/site/route.ts`'s own
 * header comment for why).
 */
export function getCanonicalEvidenceForSite(siteId: number): CanonicalEvidenceOrchestrationResult {
  return evidenceOrchestrator.getCanonicalEvidenceForSite(siteId);
}
