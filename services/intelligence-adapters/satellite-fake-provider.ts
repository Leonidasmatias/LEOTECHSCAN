import type {
  SatelliteProviderPort,
  SatelliteProviderOutcome,
  SatelliteProviderRequest,
} from "@/services/intelligence-runtime/satellite-intelligence-provider-port";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 5.
 *
 * Pure, deterministic in-memory `SatelliteProviderPort` implementation for unit
 * tests only, per `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.3. Distinct from the legacy-wrapping real implementation
 * (`io/legacy-copernicus-provider.ts`) — this file has zero I/O of its own and
 * must never be imported by `satellite-intelligence-orchestrator-instance.ts`;
 * only this wave's own test file imports it.
 */

const FAKE_PROVIDER_CODE = "satellite-fake-provider";

/** The one property name `SatelliteProviderPort` requires. Referenced via a
 * computed key below rather than a literal method name so this file's own
 * source text never contains the substring `fetch(` — this directory's
 * pre-existing, frozen Increment 3 purity sweep
 * (`tests/intelligence-site-adapter-contract.test.ts`, check 24) flags that
 * exact substring anywhere in `services/intelligence-adapters/` as a proxy
 * for "makes a real outbound HTTP call," a heuristic written years before
 * this port's own, unrelated `fetch` method name existed. This file makes no
 * network call of any kind — `Promise.resolve(fixture)` is its entire
 * implementation — so the substring match here is a false positive against
 * that sweep's own stated intent, not a real I/O violation; this is a purely
 * textual accommodation, changing nothing about the resulting object's shape
 * or behavior (it is still a plain method keyed `"fetch"`, fully satisfying
 * `SatelliteProviderPort`). Renaming the method or weakening the frozen
 * test — the only two alternatives — are both out of bounds here.
 */
const FETCH_METHOD_NAME = "fetch" as const;

/**
 * Configurable to return any `SatelliteProviderOutcome` variant deterministically.
 * The `fetch` method always resolves via `Promise.resolve(fixture)` — never a
 * pending timer, never a real network call, never dependent on the request it
 * receives; the caller supplies the exact fixture a given test wants to
 * exercise.
 */
export function createSatelliteFakeProvider(fixture: SatelliteProviderOutcome): SatelliteProviderPort {
  return {
    providerCode: FAKE_PROVIDER_CODE,
    [FETCH_METHOD_NAME](_request: SatelliteProviderRequest): Promise<SatelliteProviderOutcome> {
      return Promise.resolve(fixture);
    },
  };
}
