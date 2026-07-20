import type { Limitation } from "@/services/intelligence";
import type {
  SatelliteObservation,
  SatelliteTruthMetadata,
  SatelliteAggregateStatus,
} from "./satellite-observation-model";
import type { SatelliteOrchestrationIssue } from "./satellite-observation-adapter";
import type { SatelliteCapabilityOutcome } from "@/services/intelligence-runtime/satellite-intelligence-orchestrator";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 6.
 *
 * Pure, synchronous: orchestration result -> public envelope, per
 * `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md`
 * Section 15 and `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.9, mirroring `site-intelligence-projection-adapter.ts`'s and
 * `evidence-projection-adapter.ts`'s own established projection pattern:
 * arrays are passed through by reference (never mapped or cloned), the
 * "never mutates" guarantee rests entirely on this function's own purity
 * plus the input's own `readonly` typing.
 *
 * `Limitation` is imported from the canonical `@/services/intelligence`
 * barrel, not from the orchestrator core -- `satellite-intelligence-orchestrator.ts`
 * declares its own local `Limitation` interface without exporting it, so it
 * cannot be imported by name; the canonical type is structurally identical
 * and is the same source `evidence-projection-adapter.ts` already uses.
 *
 * No `evidence` field: `SatelliteCapabilityOutcome.evidence` is
 * deliberately not projected into the public envelope -- Evidence records
 * are referenced only via each observation's own `evidenceId`, never
 * embedded in the HTTP-facing response (frozen plan Section 15). No
 * `snapshot` field (this capability derives no Snapshot). No top-level
 * `adaptation.success: boolean` (the richer `result.status` five-value enum
 * already carries strictly more information than a boolean could).
 *
 * No database access, no call to the legacy Copernicus engine, no import of
 * route code, no authentication, no environment-variable reads, no
 * `Date.now()`, no random values, no mutation of its input, no fabricated
 * field, and no orchestration decision of its own -- `status`/
 * `coordinateEligibility`/`truthMetadata`/issue classification all arrive
 * already-decided from the orchestrator (Wave 5); this module only reshapes
 * them into the public envelope.
 *
 * NO `notFound` FIELD: a not-found Site is mapped straight to an HTTP 404 by
 * a future route/handler (Wave 7, not yet authorized) *before* this
 * function is ever called -- so a `notFound` field could never actually be
 * `true` in any envelope a real client would see, and is therefore not
 * declared here at all. This function performs no internal `notFound`
 * check of its own; the caller must never invoke it for a `notFound: true`
 * result.
 */

export interface SatelliteIntelligenceEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "satellite-intelligence";
  readonly siteId: string;
  readonly context: {
    readonly contextId: string;
    readonly correlationId: string;
    readonly requestedAt: string;
    readonly requestedBy: string;
    readonly environment: string;
  } | null;
  readonly result: {
    readonly status: SatelliteAggregateStatus;
    readonly observations: readonly SatelliteObservation[];
    readonly coordinateEligibility: "eligible" | "ineligible" | null;
    readonly truthMetadata: SatelliteTruthMetadata;
  };
  readonly adaptation: {
    readonly issues: readonly SatelliteOrchestrationIssue[];
    readonly limitations: readonly Limitation[];
  };
}

/**
 * Projects one `SatelliteCapabilityOutcome` into the versioned HTTP response
 * envelope. Never throws; never mutates `result`. The caller must never call
 * this for a `notFound: true` result -- that state is mapped to an HTTP 404
 * before projection is ever attempted, so `result.truthMetadata` is
 * trusted, per that same caller contract, to be non-null here.
 */
export function projectSatelliteIntelligenceResponse(result: SatelliteCapabilityOutcome): SatelliteIntelligenceEnvelope {
  return {
    schemaVersion: "1.0",
    capability: "satellite-intelligence",
    siteId: result.siteId,
    context: result.context
      ? {
          contextId: result.context.contextId,
          correlationId: result.context.correlationId,
          requestedAt: result.context.requestedAt,
          requestedBy: result.context.requestedBy,
          environment: result.context.environment,
        }
      : null,
    result: {
      status: result.status,
      observations: result.observations,
      coordinateEligibility: result.coordinateEligibility,
      truthMetadata: result.truthMetadata as SatelliteTruthMetadata,
    },
    adaptation: {
      issues: result.issues,
      limitations: result.limitations,
    },
  };
}
