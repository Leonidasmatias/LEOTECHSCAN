import { projectCanonicalDataTrustResponse, type DataTrustCanonicalEnvelope } from "./api-projection-adapter";
import { projectCanonicalEvidenceResponse, type EvidenceCenterCanonicalEnvelope } from "./evidence-projection-adapter";
import type {
  SiteIntelligenceOrchestrationResult,
  SiteIntelligenceStatus,
  SiteIntelligenceCapabilityState,
  SiteIntelligenceIssue,
} from "@/services/intelligence-runtime/site-intelligence-aggregator";

/**
 * Genesis Phase 2 — Increment 9 (Pure Site Intelligence Projection
 * Adapter).
 *
 * Per `docs/genesis-phase-2/27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md`
 * Section 7/10 and ADR-020's "response independence" decision (Section
 * 12): a new, independent envelope for the aggregate capability, with its
 * own `schemaVersion` and `capability` identifier -- built by reusing,
 * not duplicating, the two existing frozen capability projection
 * functions (`projectCanonicalDataTrustResponse`,
 * `projectCanonicalEvidenceResponse`) to construct each nested embedded
 * envelope. Imports both directly from their own sibling files, never
 * via the barrel (`./index`), to avoid any barrel self-import risk.
 *
 * Pure: no database access, no call to either capability's legacy
 * engine, no import of route code, no authentication, no
 * environment-variable reads, no `Date.now()`, no random values, no
 * mutation of its input, no fabricated field, and no orchestration
 * decision of its own -- `status`/`state`/issue classification all
 * arrive already-decided from the Aggregate Orchestrator; this module
 * only reshapes them into the public HTTP envelope.
 *
 * NO `notFound` FIELD (applying both frozen capabilities' own lesson
 * from the start): a not-found Site is mapped straight to an HTTP 404 by
 * the route/handler *before* this function is ever called -- so a
 * `notFound` field could never actually be `true` in any envelope a real
 * client would see, and is therefore not declared here at all.
 *
 * NESTED-ENVELOPE VERSIONING COUPLING (intentional, disclosed -- see the
 * planning document Section 7)
 * ---------------------------------------------------------------------------
 * Each nested capability's envelope is embedded *whole*, including that
 * capability's own `schemaVersion` and `capability` label. This
 * intentionally couples the aggregate's own public contract to each
 * nested capability's future contract evolution -- the accepted cost of
 * reusing rather than duplicating each capability's own projection logic.
 * Consumers must inspect each nested envelope's own `schemaVersion`
 * independently of the aggregate's own top-level `schemaVersion`.
 */

export type SiteIntelligenceCapabilityProjection<TEnvelope> = {
  readonly state: SiteIntelligenceCapabilityState;
  readonly envelope: TEnvelope | null;
};

export interface SiteIntelligenceAggregateEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "site-intelligence";
  readonly siteId: string;
  readonly snapshot: {
    readonly id: string;
    readonly kind: "derived" | "synthetic";
    readonly source: "data_importacao" | "arquivo_origem" | "fallback";
  } | null;
  readonly context: {
    readonly contextId: string;
    readonly correlationId: string;
    readonly requestedAt: string;
    readonly requestedBy: string;
    readonly environment: string;
  } | null;
  readonly result: {
    readonly status: SiteIntelligenceStatus;
    readonly dataTrust: SiteIntelligenceCapabilityProjection<DataTrustCanonicalEnvelope>;
    readonly evidenceCenter: SiteIntelligenceCapabilityProjection<EvidenceCenterCanonicalEnvelope>;
  };
  readonly adaptation: {
    readonly issues: readonly SiteIntelligenceIssue[];
  };
}

function projectDataTrustOutcome(
  outcome: SiteIntelligenceOrchestrationResult["dataTrust"],
): SiteIntelligenceCapabilityProjection<DataTrustCanonicalEnvelope> {
  if (outcome.state === "available" && outcome.result) {
    return { state: outcome.state, envelope: projectCanonicalDataTrustResponse(outcome.result) };
  }
  return { state: outcome.state, envelope: null };
}

function projectEvidenceCenterOutcome(
  outcome: SiteIntelligenceOrchestrationResult["evidenceCenter"],
): SiteIntelligenceCapabilityProjection<EvidenceCenterCanonicalEnvelope> {
  if (outcome.state === "available" && outcome.result) {
    return { state: outcome.state, envelope: projectCanonicalEvidenceResponse(outcome.result) };
  }
  return { state: outcome.state, envelope: null };
}

/**
 * Projects one `SiteIntelligenceOrchestrationResult` into the versioned
 * HTTP response envelope. Never throws; never mutates `result`. The
 * caller (the route handler) must never call this for a `notFound: true`
 * result -- that state is mapped to an HTTP 404 before projection is ever
 * attempted.
 */
export function projectSiteIntelligenceResponse(
  result: SiteIntelligenceOrchestrationResult,
): SiteIntelligenceAggregateEnvelope {
  return {
    schemaVersion: "1.0",
    capability: "site-intelligence",
    siteId: result.siteId,
    snapshot: result.snapshot
      ? {
          id: String(result.snapshot.snapshotId),
          kind: result.snapshot.kind,
          source: result.snapshot.source,
        }
      : null,
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
      dataTrust: projectDataTrustOutcome(result.dataTrust),
      evidenceCenter: projectEvidenceCenterOutcome(result.evidenceCenter),
    },
    adaptation: {
      issues: result.issues,
    },
  };
}
