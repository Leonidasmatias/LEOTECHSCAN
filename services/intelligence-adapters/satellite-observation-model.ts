/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 1.
 *
 * Pure canonical type definitions for the Satellite Intelligence
 * capability, per `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
 * Section 9. These types are capability-specific — living here, in
 * `services/intelligence-adapters/`, not added to the generic, frozen
 * `services/intelligence/**` contract layer — exactly mirroring how
 * Increment 9's own capability-specific types live in
 * `intelligence-runtime/` rather than as additions to
 * `services/intelligence/`.
 *
 * No runtime logic: type/interface declarations only. No imports: every
 * field below is a plain string/number/boolean/literal-union, never a
 * branded identifier from `services/intelligence/types/identifiers.ts`.
 */

/**
 * MANDATORY, non-optional, carried once at the result/envelope level
 * (`SatelliteCapabilityOutcome`/`SatelliteIntelligenceEnvelope`) — never
 * omittable, never inferred from a provider name string alone. Only an
 * adapter that can affirmatively prove a real provider response may ever
 * report `dataReality: "provider_sourced"`.
 */
export interface SatelliteTruthMetadata {
  readonly dataReality: "simulated" | "provider_sourced";
  readonly realSatelliteEvidence: boolean;
  readonly simulationReason: string | null;
  readonly sourceDisclosure: string;
}

export interface SatelliteProviderIdentity {
  readonly providerCode: string;
  readonly dataset: string;
  readonly sourceType: "sar" | "optical" | "unknown";
  readonly retrievedAt: string;
}

export interface SatelliteSpatialMetadata {
  readonly siteCoordinates: { readonly latitude: number; readonly longitude: number };
  readonly requestedRadiusKm: number;
  readonly coordinateEligibility: "eligible" | "ineligible";
  readonly coordinateStatus: string;
}

export interface SatelliteTemporalMetadata {
  readonly captureTime: string | null;
  readonly retrievedAt: string;
  readonly imageryAgeDays: number | null;
  readonly freshness: "recent" | "stale" | "unknown";
}

/**
 * Provider-neutral: nullable numeric fields, never a Copernicus/SAR-specific
 * enum literal. A `null` value honestly means "this source did not report
 * this metric."
 */
export interface SatelliteQualityMetadata {
  readonly cloudCoveragePercent: number | null;
  readonly noDataCoveragePercent: number | null;
  readonly spatialResolutionMeters: number | null;
  readonly sourceConfidence: number;
  readonly qualityClassification: "high" | "medium" | "low" | "insufficient";
  readonly usable: boolean;
}

/** One normalized observation — one provider scene maps to one of these. */
export interface SatelliteObservation {
  readonly observationId: string;
  readonly observationType: "sar_scene_metadata";
  readonly provider: SatelliteProviderIdentity;
  readonly spatial: SatelliteSpatialMetadata;
  readonly temporal: SatelliteTemporalMetadata;
  readonly quality: SatelliteQualityMetadata;
  readonly derivationMethod: string;
  readonly evidenceId: string;
  readonly limitations: readonly string[];
}

export type SatelliteCapabilityState = "available" | "unavailable" | "notFound";

export type SatelliteAggregateStatus = "complete" | "partial" | "unavailable" | "failed" | "notFound";
