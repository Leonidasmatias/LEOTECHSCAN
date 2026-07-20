import { fetchSatelliteSiteRow } from "@/services/intelligence-adapters/io/satellite-site-read-adapter";
import { createLegacyCopernicusProvider } from "@/services/intelligence-adapters/io/legacy-copernicus-provider";
import { adaptSatelliteProviderScene } from "@/services/intelligence-adapters/satellite-observation-adapter";
import { adaptSatelliteObservationToEvidence } from "@/services/intelligence-adapters/satellite-evidence-adapter";
import type { CalculationContext } from "@/services/intelligence";
import {
  createSatelliteIntelligenceOrchestrator,
  type SatelliteCapabilityOutcome,
} from "./satellite-intelligence-orchestrator";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 5. Real
 * production wiring for the minimal Satellite Intelligence Orchestrator
 * (`satellite-intelligence-orchestrator.ts`). This is the only module
 * resolving both Wave 3 `io/` files (`satellite-site-read-adapter.ts`,
 * `legacy-copernicus-provider.ts`) into a real, wired instance — it must
 * never be imported by a unit test. Orchestrator-level unit tests import
 * `createSatelliteIntelligenceOrchestrator` directly with injected fakes
 * instead (`services/intelligence-adapters/satellite-fake-provider.ts` for
 * the provider; plain fixture functions for everything else).
 *
 * `dataset`/`sourceType` are the two provider-identity facts the neutral
 * `SatelliteProviderPort` interface itself does not carry — supplied here,
 * matching the one legacy provider this file wires in, so the orchestrator
 * core never hardcodes a Copernicus/Sentinel-specific fact.
 *
 * This file has no direct database import of its own — it reaches the
 * database only transitively, through the two already-authorized Wave 3
 * `io/` files it wires together, matching every existing `-instance.ts`
 * precedent in this codebase.
 */
function environment(): CalculationContext["environment"] {
  return process.env.NODE_ENV === "test" ? "test" : "production";
}

const satelliteIntelligenceOrchestrator = createSatelliteIntelligenceOrchestrator({
  fetchSiteRow: (siteId: number) => fetchSatelliteSiteRow(siteId),
  provider: createLegacyCopernicusProvider(),
  dataset: "Sentinel-1 GRD",
  sourceType: "sar",
  adaptObservation: adaptSatelliteProviderScene,
  adaptEvidence: adaptSatelliteObservationToEvidence,
  now: () => new Date().toISOString(),
  environment,
});

/**
 * The real, DB-backed entry point a future route/handler (Wave 7, not yet
 * authorized) will call via a dynamic `import()` inside its own `GET`
 * handler, never a static top-level import — mirroring every existing
 * capability route's own established ordering discipline.
 */
export function getCanonicalSatelliteIntelligenceForSite(siteId: number): Promise<SatelliteCapabilityOutcome> {
  return satelliteIntelligenceOrchestrator.getCanonicalSatelliteIntelligenceForSite(siteId);
}
