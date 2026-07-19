import type { DatabaseSync } from "node:sqlite";
import { getWritableDb } from "@/lib/db";
import { copernicusForSite } from "@/services/copernicus-engine";
import type {
  SatelliteProviderPort,
  SatelliteProviderRequest,
  SatelliteProviderOutcome,
  SatelliteProviderScene,
  SatelliteProviderQualitySummary,
  SatelliteTemporalWindow,
} from "@/services/intelligence-runtime/satellite-intelligence-provider-port";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 3.
 *
 * DB-touching. The only file in this increment permitted to import
 * `copernicus-engine.ts`/`copernicus-truth.ts`, per
 * `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
 * Section 23 and `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.5. A thin outer adapter over the existing legacy Copernicus
 * behavior — it reshapes the legacy engine's own output into the
 * provider-neutral port types; it never reproduces, forks, or reinterprets
 * the legacy calculation logic itself.
 */

const PROVIDER_CODE = "copernicus-legacy-simulated";

const EVIDENCE_LEVEL_TO_CLASSIFICATION: Record<
  string,
  SatelliteProviderQualitySummary["overallClassification"]
> = {
  Alta: "high",
  Media: "medium",
  Baixa: "low",
  Insuficiente: "insufficient",
};

/**
 * Neutral `[startAt, endAt]` window → the legacy engine's own
 * `lookbackDays` day-count parameter. Not present verbatim in the frozen
 * plan (which names this helper but does not spell out its formula) — a
 * mechanical, deterministic day-count derivation using `Date.parse` (pure
 * string parsing, never `Date.now()`/`new Date()`), consistent with the
 * temporal window model already fixed by Section 10.5.
 */
function lookbackDaysFromWindow(window: SatelliteTemporalWindow): number {
  return Math.max(
    1,
    Math.ceil((Date.parse(window.endAt) - Date.parse(window.startAt)) / 86_400_000),
  );
}

/**
 * Implements `SatelliteProviderPort`. `fetch()` never rejects (single-owner
 * exception model, hardening correction F-1): any exception thrown by
 * `copernicusForSite` — or a `null` return, which would mean this file's
 * own site lookup disagrees with an orchestrator-level lookup that already
 * confirmed the site exists, an internal inconsistency rather than a
 * normal outcome — is caught locally and resolved as
 * `{ kind: "unavailable", reason: "unexpected_error" }`, never rethrown.
 * Only the caught exception's `.name` may ever be inspected; `.message`/
 * `.stack` are never attached to the resolved outcome, logged, or
 * otherwise leaked — and since exactly one `unavailable` reason is ever
 * produced by this simulated-only provider, no inspection is needed at
 * all.
 */
export function createLegacyCopernicusProvider(
  db: DatabaseSync = getWritableDb(),
): SatelliteProviderPort {
  return {
    providerCode: PROVIDER_CODE,
    async fetch(request: SatelliteProviderRequest): Promise<SatelliteProviderOutcome> {
      try {
        const lookbackDays = lookbackDaysFromWindow(request.temporalWindow);
        // The literal `false` — never omitted, never a variable — is the
        // binding persist=false requirement (frozen plan Section 3.2's
        // `satelliteValidationForSite` trap). `copernicusForSite`, never
        // `satelliteValidationForSite`, is the only legacy entry point this
        // file ever calls.
        const result = copernicusForSite(db, request.siteId, request.radiusKm, lookbackDays, false);
        if (!result) {
          return Promise.resolve({ kind: "unavailable", reason: "unexpected_error" });
        }
        if (result.scenes.length === 0) {
          return Promise.resolve({ kind: "no_coverage" });
        }
        const retrievedAt = request.temporalWindow.endAt;
        const scenes: SatelliteProviderScene[] = result.scenes.map((scene) => ({
          sourceSceneId: scene.sceneId ?? null,
          capturedAt: scene.acquisitionDate ?? null,
          publishedAt: null,
          retrievedAt,
          spatialResolutionMeters: null,
          cloudCoveragePercent: null,
          noDataCoveragePercent: null,
          coverage: { footprintDescription: null, radiusKm: request.radiusKm },
          sourceAttributes: {
            provider: scene.provider,
            mission: scene.mission,
            productType: scene.productType,
            orbitDirection: scene.orbitDirection,
            polarization: scene.polarization,
            relativeOrbit: scene.relativeOrbit,
            cloudNote: scene.cloudNote,
            sourceUrl: scene.sourceUrl,
          },
        }));
        const qualitySummary: SatelliteProviderQualitySummary = {
          overallScore: Math.min(1, Math.max(0, result.validation.validationScore / 100)),
          overallClassification:
            EVIDENCE_LEVEL_TO_CLASSIFICATION[result.validation.evidenceLevel] ?? "insufficient",
        };
        return Promise.resolve({ kind: "success", scenes, qualitySummary });
      } catch {
        return Promise.resolve({ kind: "unavailable", reason: "unexpected_error" });
      }
    },
  };
}
