import { createHash } from "node:crypto";
import type { SiteRow } from "@/lib/types";
import type { CalculationContext, Evidence } from "@/services/intelligence";
import { adaptLegacySiteRow, toSiteEntityReference } from "@/services/intelligence-adapters/site-entity-adapter";
import { evaluateCoordinateQuality } from "@/services/geospatial/coordinate-quality-engine";
import { copernicusTruthMetadata } from "@/services/copernicus-truth";
import type {
  SatelliteObservation,
  SatelliteTruthMetadata,
  SatelliteAggregateStatus,
} from "@/services/intelligence-adapters/satellite-observation-model";
import type {
  SatelliteObservationAdapterContext,
  SatelliteObservationAdaptationResult,
  SatelliteOrchestrationIssue,
} from "@/services/intelligence-adapters/satellite-observation-adapter";
import type { SatelliteEvidenceAdapterContext } from "@/services/intelligence-adapters/satellite-evidence-adapter";
import type {
  SatelliteProviderPort,
  SatelliteProviderScene,
  SatelliteProviderQualitySummary,
  SatelliteTemporalWindow,
} from "./satellite-intelligence-provider-port";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 5.
 *
 * Pure, DI-based, `async` orchestrator core, per
 * `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md` Sections
 * 8/10.3.1/17 and `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.10, composing Wave 3's provider port and site read function (both
 * received via injected `deps`, never imported directly), Wave 2's pure
 * observation adapter and Wave 4's pure evidence adapter (also received via
 * `deps`, mirroring the "receives <-" composition Section 10 of the
 * implementation plan documents), and the pure, dependency-free Site Entity
 * Adapter / Coordinate Quality Engine (statically imported directly, since
 * both are reused-verbatim, I/O-free modules — the same treatment Wave 2
 * already gives `coordinate-quality-engine.ts`).
 *
 * No direct database import of any kind; no import of the legacy Copernicus
 * engine; no HTTP framework import; no projection; no persistence.
 *
 * ACA-001-A (Architecture Clarification Amendment): this is the one, sole
 * production file across the entire increment authorized to import
 * `copernicusTruthMetadata` from the Copernicus truth module, narrowly, to
 * construct `SatelliteTruthMetadata` for `SatelliteCapabilityOutcome` — the
 * already-frozen Wave 3 provider adapter does not do this itself, and Wave 5
 * (composing the final outcome) is the correct, and now explicitly owner-
 * authorized, construction point. No other file gains this authorization.
 *
 * ACA-001-B: this file implements its own inline, deterministic
 * `deriveEvidenceId` seed function (`computeSatelliteEvidenceIdSeed`),
 * reproducing the exact frozen `EvidenceId` formula
 * (`satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>`) to
 * satisfy the injection point Wave 2's `satellite-observation-adapter.ts`
 * already requires. This duplicates — intentionally, per explicit owner
 * authorization — the identical formula Wave 4's `satellite-evidence-adapter.ts`
 * computes internally; Wave 4 itself is not modified and exports no new
 * helper. The mandatory cross-consistency safeguard (this wave's own test
 * file asserting `observation.evidenceId === evidence.id` for every included
 * observation) is what keeps the two copies from silently diverging.
 */

const REQUESTED_BY = "api:intelligence/satellite/site";

/** Mirrors `config/copernicus_rules.json`'s own existing `defaultRadiusKm` —
 * a read-only reference to an already-established legacy default, not a new
 * value. No frozen component supplies this to the orchestrator (the
 * legacy-wrapping provider adapter takes `radiusKm` as caller input, per its
 * own contract), so it is reproduced here, once, as the request default. */
const DEFAULT_RADIUS_KM = 2;

/** Mirrors `config/copernicus_rules.json`'s own existing `defaultLookbackDays`. */
const DEFAULT_LOOKBACK_DAYS = 90;

/** Mirrors `config/copernicus_rules.json`'s own existing `scoring.recentSceneDays`
 * — the fixed, canonical freshness threshold (frozen plan Section 12), never a
 * caller-overridable request field. */
const RECENT_SCENE_DAYS = 45;

/**
 * Every dependency this orchestrator needs is supplied by the caller, never
 * imported directly, for the identical reason every other orchestrator core
 * in this codebase stays free of any I/O import of its own: it keeps this
 * module's own logic (call ordering, status derivation, issue aggregation)
 * unit-testable with zero I/O. The real wiring lives in the sibling module
 * `satellite-intelligence-orchestrator-instance.ts`, never imported by a unit
 * test.
 */
export interface SatelliteIntelligenceOrchestratorDeps {
  readonly fetchSiteRow: (siteId: number) => SiteRow | null;
  readonly provider: SatelliteProviderPort;
  /** Provider-identity facts the neutral `SatelliteProviderPort` interface
   * itself does not carry (only `providerCode` is part of that contract) —
   * injected so the orchestrator core never hardcodes a Copernicus/Sentinel-
   * specific fact, keeping it as genuinely provider-neutral as the port it
   * depends on. The real wiring instance supplies the values matching
   * whichever concrete provider it wires in. */
  readonly dataset: string;
  readonly sourceType: "sar" | "optical" | "unknown";
  readonly adaptObservation: (
    scene: SatelliteProviderScene,
    context: SatelliteObservationAdapterContext,
    now: () => string,
  ) => SatelliteObservationAdaptationResult;
  readonly adaptEvidence: (observation: SatelliteObservation, context: SatelliteEvidenceAdapterContext) => Evidence;
  /** Returns the current time as an ISO-8601 string. Injected so tests can
   * supply a fixed clock; production wiring supplies
   * `() => new Date().toISOString()`. Never called as `Date.now()` directly. */
  readonly now: () => string;
  /** Returns the `CalculationContext.environment` value. Injected for the
   * same determinism reason as `now`. */
  readonly environment: () => CalculationContext["environment"];
}

export interface SatelliteOrchestrationContextSummary {
  readonly contextId: string;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly environment: string;
}

export interface SatelliteCapabilityOutcome {
  readonly notFound: boolean;
  readonly status: SatelliteAggregateStatus;
  readonly siteId: string;
  readonly coordinateEligibility: "eligible" | "ineligible" | null;
  readonly observations: readonly SatelliteObservation[];
  readonly evidence: readonly Evidence[];
  readonly truthMetadata: SatelliteTruthMetadata | null;
  readonly context: SatelliteOrchestrationContextSummary | null;
  readonly issues: readonly SatelliteOrchestrationIssue[];
  readonly limitations: readonly Limitation[];
}

/** Mirrors `services/intelligence/contracts/limitation.ts`'s own shape
 * locally, exactly like every other capability-specific type in this file —
 * no frozen source populates this field for Satellite Intelligence today
 * (per-observation disclosure already exists, more granularly, via
 * `SatelliteObservation.limitations`), so it is always the empty array;
 * never invented, never fabricated. */
interface Limitation {
  readonly description: string;
  readonly severity: "informational" | "moderate" | "significant";
}

/**
 * The exact, collision-safe `EvidenceId` formula (frozen plan Section 10.4/F-4),
 * reproduced here per ACA-001-B: `satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>`.
 * `providerCode` is trimmed and lowercased before embedding; `sourceSceneId`
 * is trimmed before hashing. This function's own output must always equal
 * `satellite-evidence-adapter.ts`'s own internal computation for the same
 * three inputs — asserted directly by this wave's own test file.
 */
function computeSatelliteEvidenceIdSeed(providerCode: string, siteId: number, sourceSceneId: string): string {
  const normalizedProviderCode = providerCode.trim().toLowerCase();
  const digest = createHash("sha256").update(sourceSceneId.trim(), "utf8").digest("hex");
  return `satellite:${normalizedProviderCode}:${siteId}:${digest}`;
}

function subtractDays(isoDateTime: string, days: number): string {
  return new Date(Date.parse(isoDateTime) - days * 86_400_000).toISOString();
}

function buildTruthMetadata(): SatelliteTruthMetadata {
  const legacy = copernicusTruthMetadata();
  return {
    dataReality: legacy.isRealSatelliteEvidence ? "provider_sourced" : "simulated",
    realSatelliteEvidence: legacy.isRealSatelliteEvidence,
    simulationReason: legacy.isRealSatelliteEvidence
      ? null
      : `Data source: ${legacy.source} (dataStatus=${legacy.dataStatus}).`,
    sourceDisclosure: `dataStatus=${legacy.dataStatus}; source=${legacy.source}`,
  };
}

function buildContextSummary(
  siteId: number,
  requestedAt: string,
  environment: CalculationContext["environment"],
): SatelliteOrchestrationContextSummary {
  return {
    contextId: `context:satellite-intelligence:${siteId}:${requestedAt}`,
    correlationId: `correlation:satellite-intelligence:${siteId}:${requestedAt}`,
    requestedAt,
    requestedBy: REQUESTED_BY,
    environment,
  };
}

function notFoundOutcome(siteId: number): SatelliteCapabilityOutcome {
  return {
    notFound: true,
    status: "notFound",
    siteId: String(siteId),
    coordinateEligibility: null,
    observations: [],
    evidence: [],
    truthMetadata: null,
    context: null,
    issues: [],
    limitations: [],
  };
}

/**
 * Used both for the (not expected to fire in practice) site-adaptation
 * failure edge case and the outermost defensive catch. `truthMetadata` is
 * still populated here — mandatory whenever `notFound` is `false` (frozen
 * plan Section 9/14, F-1) — since `copernicusTruthMetadata()` is a trivial,
 * always-available, pure computation with nothing left to fail by the time
 * this helper runs. `coordinateEligibility`/`context` are `null`: a defensive
 * fallback reached from an arbitrary point in the pipeline has no reliable
 * eligibility/context state to report honestly.
 */
function failedOutcome(siteId: number): SatelliteCapabilityOutcome {
  return {
    notFound: false,
    status: "failed",
    siteId: String(siteId),
    coordinateEligibility: null,
    observations: [],
    evidence: [],
    truthMetadata: buildTruthMetadata(),
    context: null,
    issues: [],
    limitations: [],
  };
}

/**
 * Builds the minimal, read-only Satellite Intelligence Orchestrator. Returns
 * a single method, `getCanonicalSatelliteIntelligenceForSite`, which never
 * persists, never writes a cache entry, never writes an audit log, and never
 * calls `console.error`/`console.log`/`console.warn` (sanitized diagnostic
 * logging is `handler.ts`'s own exclusive responsibility, a future,
 * separately authorized wave).
 */
export function createSatelliteIntelligenceOrchestrator(deps: SatelliteIntelligenceOrchestratorDeps) {
  async function getCanonicalSatelliteIntelligenceForSite(siteId: number): Promise<SatelliteCapabilityOutcome> {
    try {
      const siteRow = deps.fetchSiteRow(siteId);
      if (!siteRow) {
        return notFoundOutcome(siteId);
      }

      // Raw coordinate eligibility screening — operates directly on the raw
      // SiteRow.latitude/longitude, before any canonical translation (frozen
      // plan Section 8). Reused verbatim, never reimplemented. Not a
      // prerequisite input to the CalculationContext.scope construction
      // below (F-9 hardening) — the two are independent.
      const coordinateQuality = evaluateCoordinateQuality(
        { latitude: siteRow.latitude, longitude: siteRow.longitude },
        deps.now,
      );
      const coordinateEligibility: "eligible" | "ineligible" = coordinateQuality.eligibleForSentinel
        ? "eligible"
        : "ineligible";

      // CalculationContext.scope construction — Site Entity Adapter is the
      // sole sanctioned way to construct an EntityReference<"Site">, per
      // 02_CANONICAL_DOMAIN_MODEL.md's binding rule (frozen plan Section 8).
      // SatelliteCapabilityOutcome has no field of its own for the resulting
      // EntityReference; this call's own return value is otherwise unused —
      // it exists solely to satisfy that binding rule and to surface a
      // genuine site-adaptation failure as a defensive safety net, mirroring
      // intelligence-orchestrator.ts's own identical posture (not expected
      // to fire in practice for a real database row).
      const siteAdaptation = adaptLegacySiteRow(siteRow);
      if (!siteAdaptation.success || !siteAdaptation.site) {
        return failedOutcome(siteId);
      }
      toSiteEntityReference(siteAdaptation.site);

      const requestedAt = deps.now();
      const context = buildContextSummary(siteId, requestedAt, deps.environment());
      const truthMetadata = buildTruthMetadata();

      if (coordinateEligibility === "ineligible") {
        return {
          notFound: false,
          status: "unavailable",
          siteId: String(siteId),
          coordinateEligibility,
          observations: [],
          evidence: [],
          truthMetadata,
          context,
          issues: [],
          limitations: [],
        };
      }

      const temporalWindow: SatelliteTemporalWindow = {
        startAt: subtractDays(requestedAt, DEFAULT_LOOKBACK_DAYS),
        endAt: requestedAt,
        maximumImageryAgeDays: RECENT_SCENE_DAYS,
      };

      // Exactly one provider call per request (frozen plan Section 10.3.1) —
      // no Promise.all, no concurrency machinery for a single awaited call.
      const providerOutcome = await deps.provider.fetch({
        siteId,
        latitude: siteRow.latitude,
        longitude: siteRow.longitude,
        radiusKm: DEFAULT_RADIUS_KM,
        temporalWindow,
      });

      if (providerOutcome.kind === "unavailable") {
        return {
          notFound: false,
          status: "unavailable",
          siteId: String(siteId),
          coordinateEligibility,
          observations: [],
          evidence: [],
          truthMetadata,
          context,
          issues: [],
          limitations: [],
        };
      }

      if (providerOutcome.kind === "no_coverage") {
        return {
          notFound: false,
          status: "complete",
          siteId: String(siteId),
          coordinateEligibility,
          observations: [],
          evidence: [],
          truthMetadata,
          context,
          issues: [],
          limitations: [],
        };
      }

      // providerOutcome.kind === "success"
      const observations: SatelliteObservation[] = [];
      const evidence: Evidence[] = [];
      const issues: SatelliteOrchestrationIssue[] = [];
      const qualitySummary: SatelliteProviderQualitySummary = providerOutcome.qualitySummary;

      for (const scene of providerOutcome.scenes) {
        const adaptation = deps.adaptObservation(
          scene,
          {
            siteId,
            latitude: siteRow.latitude,
            longitude: siteRow.longitude,
            radiusKm: DEFAULT_RADIUS_KM,
            providerCode: deps.provider.providerCode,
            dataset: deps.dataset,
            sourceType: deps.sourceType,
            maximumImageryAgeDays: RECENT_SCENE_DAYS,
            qualitySummary,
            deriveEvidenceId: (sourceSceneId: string) =>
              computeSatelliteEvidenceIdSeed(deps.provider.providerCode, siteId, sourceSceneId),
          },
          deps.now,
        );

        if ("excluded" in adaptation) {
          issues.push(adaptation.issue);
          continue;
        }

        observations.push(adaptation);
        // Wave 2 excludes every scene with sourceSceneId: null before this
        // point is ever reached, so this is always non-null here — matching
        // satellite-evidence-adapter.ts's own identical caller contract.
        if (scene.sourceSceneId !== null) {
          evidence.push(
            deps.adaptEvidence(adaptation, {
              siteId,
              sourceSceneId: scene.sourceSceneId,
              // Increment 10 introduces no Snapshot mechanism of its own
              // (frozen plan Section 15); the empty string here deliberately
              // invokes satellite-evidence-adapter.ts's own already-frozen,
              // already-tested deterministic fallback (W4R-1 correction)
              // rather than this file inventing a second, parallel snapshot
              // scheme.
              snapshot: "",
            }),
          );
        }
      }

      // Five-value aggregate status derivation, evaluated in the frozen
      // Section 17.1 order (notFound/failed already resolved above):
      let status: SatelliteAggregateStatus;
      if (providerOutcome.scenes.length === 0) {
        status = "complete";
      } else if (observations.length === 0) {
        status = "unavailable"; // Rule 3c: every scene rejected
      } else if (issues.length > 0) {
        status = "partial"; // Rule 4: mixed usable/rejected
      } else {
        status = "complete"; // Rule 5: every scene usable
      }

      return {
        notFound: false,
        status,
        siteId: String(siteId),
        coordinateEligibility,
        observations,
        evidence,
        truthMetadata,
        context,
        issues,
        limitations: [],
      };
    } catch {
      return failedOutcome(siteId);
    }
  }

  return { getCanonicalSatelliteIntelligenceForSite };
}
