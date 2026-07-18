/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 1.
 *
 * Pure port interface and its request/outcome/temporal-window types, per
 * `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
 * Section 10.1/10.2/10.5. Lives in `intelligence-runtime/`, not
 * `intelligence-adapters/`: this is a contract the orchestrator core
 * depends on, the same kind of thing as Increment 9's own
 * `SiteIntelligenceAggregatorDeps` injected-function shape — it belongs
 * beside the orchestrator it serves.
 *
 * Genuinely provider-neutral: no SAR-specific or Copernicus-aliased field
 * of any kind crosses this file. Anything provider-specific is confined
 * to the bounded, sanitized `sourceAttributes` bag on
 * `SatelliteProviderScene`, which never gains first-class canonical
 * status. No implementation, no I/O, no database access of any kind, no
 * routing framework import.
 */

export interface SatelliteCoverageMetadata {
  readonly footprintDescription: string | null;
  readonly radiusKm: number;
}

/**
 * One provider-neutral scene/observation candidate, already reshaped by
 * the adapter that produced it — never a passthrough of a provider's own
 * native response shape.
 */
export interface SatelliteProviderScene {
  readonly sourceSceneId: string | null;
  readonly capturedAt: string | null;
  readonly publishedAt: string | null;
  readonly retrievedAt: string;
  readonly spatialResolutionMeters: number | null;
  readonly cloudCoveragePercent: number | null;
  readonly noDataCoveragePercent: number | null;
  readonly coverage: SatelliteCoverageMetadata | null;
  /**
   * Bounded, sanitized, provider-specific preservation for provenance
   * only — values only, never functions, never raw provider response
   * objects, never credentials or URLs bearing a token.
   */
  readonly sourceAttributes: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Already normalized by the adapter (0-1 scale, canonical
 * classification) — the port itself never sees or forwards a raw legacy
 * 0-100 score.
 */
export interface SatelliteProviderQualitySummary {
  readonly overallScore: number;
  readonly overallClassification: "high" | "medium" | "low" | "insufficient";
}

/**
 * Neutral UTC temporal-window request model — replaces a provider-shaped
 * lookback-day count. `startAt <= endAt` is enforced at request-validation
 * time, not by this type.
 */
export interface SatelliteTemporalWindow {
  readonly startAt: string;
  readonly endAt: string;
  readonly maximumImageryAgeDays: number | null;
}

export interface SatelliteProviderRequest {
  readonly siteId: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm: number;
  readonly temporalWindow: SatelliteTemporalWindow;
}

export type SatelliteProviderOutcome =
  | { readonly kind: "success"; readonly scenes: readonly SatelliteProviderScene[]; readonly qualitySummary: SatelliteProviderQualitySummary }
  | { readonly kind: "unavailable"; readonly reason: "misconfigured" | "timeout" | "rate_limited" | "invalid_credentials" | "unexpected_error" }
  | { readonly kind: "no_coverage" };

/**
 * Asynchronous from Increment 10 onward — a real satellite provider is
 * network-bound, and modeling `timeout`/`rate_limited` behind a
 * synchronous interface would have been internally incoherent.
 */
export interface SatelliteProviderPort {
  readonly providerCode: string;
  fetch(request: SatelliteProviderRequest): Promise<SatelliteProviderOutcome>;
}
