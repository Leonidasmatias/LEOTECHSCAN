import { evaluateCoordinateQuality } from "@/services/geospatial/coordinate-quality-engine";
import type { SatelliteProviderScene, SatelliteProviderQualitySummary } from "@/services/intelligence-runtime/satellite-intelligence-provider-port";
import type {
  SatelliteObservation,
  SatelliteProviderIdentity,
  SatelliteSpatialMetadata,
  SatelliteTemporalMetadata,
  SatelliteQualityMetadata,
} from "./satellite-observation-model";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 2.
 *
 * Pure `SatelliteProviderScene` → `SatelliteObservation` translation,
 * applying the deterministic cloud-coverage/freshness/quality
 * classification rules from
 * `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
 * Section 12. Reuses `evaluateCoordinateQuality`/`eligibleForSentinel`
 * verbatim for the coordinate-eligibility gate — never reimplemented.
 *
 * No I/O, no provider call, no evidence record construction (Wave 4's
 * own job): this file never imports `node:crypto`, never opens a
 * database, never calls the legacy Copernicus engine. The clock is
 * always injected (`now: () => string`), never `Date.now()`/`new Date()`.
 */

/**
 * The exact `SatelliteOrchestrationIssue.stage` value this adapter ever
 * produces — mirrors `missing_scene_id` (`stage: "observation"`,
 * `severity: "significant"`, `canContinue: true`) per the frozen plan's
 * Section 10.4 (F-4), the same shape convention every prior increment's
 * own structured-issue types (e.g. Increment 9's `SiteIntelligenceIssue`)
 * already establish.
 */
export type SatelliteOrchestrationIssueCode = "missing_scene_id";

export interface SatelliteOrchestrationIssue {
  readonly stage: "observation";
  readonly code: SatelliteOrchestrationIssueCode;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
  readonly canContinue: boolean;
}

/**
 * Caller-supplied context this adapter cannot derive on its own — the
 * same "context object" pattern every prior increment's own adapter
 * uses (e.g. `EvidenceAdapterContext`) for values a pure, dependency-free
 * translation function has no way to compute itself.
 *
 * `deriveEvidenceId` exists solely because the true `EvidenceId` formula
 * (`satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>`,
 * frozen plan Section 10.4/F-4) requires `node:crypto`'s `createHash` —
 * an import this file is not authorized to make (implementation plan
 * Section 9.6's own "Allowed imports" list does not include it; that
 * hash computation is Wave 4's exclusive responsibility, per this
 * file's own "no evidence construction (Wave 4)" non-goal). Injecting
 * the already-computed-elsewhere id function, rather than importing
 * `node:crypto` directly or fabricating a placeholder, is the only way
 * to populate `SatelliteObservation.evidenceId` correctly (one distinct
 * value per scene, matching its own `sourceSceneId`) without violating
 * either constraint.
 */
export interface SatelliteObservationAdapterContext {
  readonly siteId: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm: number;
  readonly providerCode: string;
  readonly dataset: string;
  readonly sourceType: "sar" | "optical" | "unknown";
  /** The canonical freshness threshold (Section 12) — always sourced
   * upstream from `config/copernicus_rules.json`'s `scoring.recentSceneDays`
   * (45), never hardcoded or re-read from the JSON file by this adapter. */
  readonly maximumImageryAgeDays: number | null;
  readonly qualitySummary: SatelliteProviderQualitySummary;
  readonly deriveEvidenceId: (sourceSceneId: string) => string;
}

export type SatelliteObservationAdaptationResult =
  | SatelliteObservation
  | { readonly excluded: true; readonly issue: SatelliteOrchestrationIssue };

function issue(
  code: SatelliteOrchestrationIssueCode,
  severity: SatelliteOrchestrationIssue["severity"],
  message: string,
  canContinue: boolean,
): SatelliteOrchestrationIssue {
  return { stage: "observation", code, severity, message, canContinue };
}

function daysBetween(laterIso: string, earlierIso: string): number {
  const laterMs = Date.parse(laterIso);
  const earlierMs = Date.parse(earlierIso);
  return Math.max(0, Math.round((laterMs - earlierMs) / 86_400_000));
}

function classifyFreshness(
  imageryAgeDays: number | null,
  maximumImageryAgeDays: number | null,
): SatelliteTemporalMetadata["freshness"] {
  if (imageryAgeDays === null || maximumImageryAgeDays === null) return "unknown";
  return imageryAgeDays <= maximumImageryAgeDays ? "recent" : "stale";
}

/**
 * Adapts one `SatelliteProviderScene` into one canonical
 * `SatelliteObservation`, deterministically and without I/O. A scene
 * with `sourceSceneId: null` cannot be adapted at all (frozen plan
 * Section 10.4/F-4) — it is excluded, never converted, with a
 * `missing_scene_id` issue recorded; no identifier is ever fabricated.
 */
export function adaptSatelliteProviderScene(
  scene: SatelliteProviderScene,
  context: SatelliteObservationAdapterContext,
  now: () => string,
): SatelliteObservationAdaptationResult {
  if (scene.sourceSceneId === null) {
    return {
      excluded: true,
      issue: issue(
        "missing_scene_id",
        "significant",
        "Provider scene has no sourceSceneId; it cannot be adapted into a canonical observation.",
        true,
      ),
    };
  }
  const sourceSceneId = scene.sourceSceneId;

  const provider: SatelliteProviderIdentity = {
    providerCode: context.providerCode,
    dataset: context.dataset,
    sourceType: context.sourceType,
    retrievedAt: scene.retrievedAt,
  };

  const coordinateQuality = evaluateCoordinateQuality(
    { latitude: context.latitude, longitude: context.longitude },
    now,
  );
  const spatial: SatelliteSpatialMetadata = {
    siteCoordinates: { latitude: context.latitude, longitude: context.longitude },
    requestedRadiusKm: context.radiusKm,
    coordinateEligibility: coordinateQuality.eligibleForSentinel ? "eligible" : "ineligible",
    coordinateStatus: coordinateQuality.status,
  };

  const imageryAgeDays = scene.capturedAt === null ? null : daysBetween(scene.retrievedAt, scene.capturedAt);
  const freshness = classifyFreshness(imageryAgeDays, context.maximumImageryAgeDays);
  const temporal: SatelliteTemporalMetadata = {
    captureTime: scene.capturedAt,
    retrievedAt: scene.retrievedAt,
    imageryAgeDays,
    freshness,
  };

  const qualityClassification = context.qualitySummary.overallClassification;
  const quality: SatelliteQualityMetadata = {
    cloudCoveragePercent: scene.cloudCoveragePercent,
    noDataCoveragePercent: scene.noDataCoveragePercent,
    spatialResolutionMeters: scene.spatialResolutionMeters,
    sourceConfidence: context.qualitySummary.overallScore,
    qualityClassification,
    usable: qualityClassification !== "insufficient",
  };

  const limitations: string[] = [];
  if (scene.spatialResolutionMeters === null) {
    limitations.push("Spatial resolution not reported by this source.");
  }
  if (scene.cloudCoveragePercent === null) {
    limitations.push("Cloud coverage not reported by this source.");
  }
  if (freshness === "stale") {
    limitations.push("Imagery age exceeds the recent-scene freshness threshold.");
  }
  if (freshness === "unknown") {
    limitations.push("Imagery freshness could not be determined.");
  }

  const observation: SatelliteObservation = {
    observationId: `observation:${context.siteId}:${sourceSceneId}`,
    observationType: "sar_scene_metadata",
    provider,
    spatial,
    temporal,
    quality,
    derivationMethod: `${context.providerCode}:v1`,
    evidenceId: context.deriveEvidenceId(sourceSceneId),
    limitations,
  };
  return observation;
}
