// STAGE 0 -- Pure Copernicus/Sentinel-1 truth contract (audit-v4 risk R1 / WP0.4).
//
// This module is deliberately dependency-free: it imports nothing, and nothing it exports ever
// touches a database. It exists so the truthfulness of every Copernicus/Sentinel-1 response --
// "this is simulated, not real satellite evidence" -- can be tested in complete isolation from
// services/copernicus-engine.ts, which transitively imports node:sqlite via
// services/site-service.ts -> lib/db.ts. Vitest's Vite-based module pipeline could not reliably
// resolve node:sqlite at test-collection time (see docs/stage-0/05_TEST_BASELINE.md's
// "Follow-up" section for the full history of that problem and why externalization config
// alone did not fix it) -- pulling the truth contract itself out of the DB-touching module is
// what actually removes the dependency, rather than trying to configure around it.
//
// Do not add any import to this file that reaches node:sqlite, directly or transitively
// (lib/db.ts, services/site-service.ts, api/site-query.ts, or anything importing those). If a
// future change needs database access to compute one of these values, that's a sign the value
// doesn't belong in this module -- it belongs back in services/copernicus-engine.ts.

/** Every Copernicus/Sentinel-1 response in this codebase reports its data as simulated. There
 * is no real HTTP client to the Copernicus Data Space Ecosystem in this version -- see the
 * STAGE 0 TRUTH CORRECTION comments in services/copernicus-engine.ts for the history of why
 * this must never become credential-conditioned again. */
export const COPERNICUS_DATA_STATUS = "simulated" as const;

/** Every Copernicus/Sentinel-1 response attributes its data to the local synthetic rule engine,
 * never to an external provider. */
export const COPERNICUS_SOURCE = "local_rule_engine" as const;

/** Always false until a real Stage 3 client (see docs/audit-v4/14_ROADMAP_V4.md) actually
 * exists. Configured credentials (COPERNICUS_ACCESS_TOKEN / COPERNICUS_CLIENT_ID) must never
 * flip this to true -- presence of credentials is not proof of real data. */
export const COPERNICUS_IS_REAL_SATELLITE_EVIDENCE = false as const;

/** Every synthetic scene's sceneId must start with this prefix so it can never be mistaken for
 * a real Copernicus product identifier. */
export const MOCK_SCENE_ID_PREFIX = "MOCK_S1_";

/** What every Sentinel-1-related entry in config/capabilities.json is expected to declare as
 * its status today -- there is no real client behind any of them yet. */
export const EXPECTED_SENTINEL1_CAPABILITY_STATUS = "simulated" as const;

export type CopernicusTruthMetadata = {
  dataStatus: typeof COPERNICUS_DATA_STATUS;
  source: typeof COPERNICUS_SOURCE;
  isRealSatelliteEvidence: typeof COPERNICUS_IS_REAL_SATELLITE_EVIDENCE;
};

/**
 * The single place that constructs the truth stamp every Copernicus/Sentinel-1 response must
 * carry. services/copernicus-engine.ts spreads this into fetchSentinel1Metadata(),
 * copernicusForSite(), and copernicusStatus() rather than writing the three fields out by hand
 * in four separate places -- so there is exactly one place to get this right, and one place a
 * future regression would have to slip past.
 */
export function copernicusTruthMetadata(): CopernicusTruthMetadata {
  return {
    dataStatus: COPERNICUS_DATA_STATUS,
    source: COPERNICUS_SOURCE,
    isRealSatelliteEvidence: COPERNICUS_IS_REAL_SATELLITE_EVIDENCE,
  };
}

/**
 * Validates that an arbitrary response object actually carries the truthful contract. Used by
 * tests/copernicus-truth.test.ts, and available for any future runtime assertion that wants to
 * double-check a response's shape before it reaches a client.
 */
export function isTruthfulCopernicusResponse(candidate: unknown): candidate is CopernicusTruthMetadata {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  return (
    value.dataStatus === COPERNICUS_DATA_STATUS &&
    value.source === COPERNICUS_SOURCE &&
    value.isRealSatelliteEvidence === COPERNICUS_IS_REAL_SATELLITE_EVIDENCE
  );
}

/** True only if every scene id in a batch is unambiguously marked as synthetic. */
export function allScenesAreMarkedSynthetic(sceneIds: readonly string[]): boolean {
  return sceneIds.every((id) => id.startsWith(MOCK_SCENE_ID_PREFIX));
}
