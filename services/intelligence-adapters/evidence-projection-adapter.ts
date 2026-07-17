import type { Evidence, Limitation } from "@/services/intelligence";
import type { CanonicalEvidenceOrchestrationResult } from "@/services/intelligence-runtime/intelligence-evidence-orchestrator";

/**
 * Genesis Phase 2 — Increment 8 (Pure Evidence Projection Adapter).
 *
 * Per `docs/genesis-phase-2/08_ADAPTER_STRATEGY.md`'s adapter #5 and
 * ADR-020's "response independence" decision (Section 12): a new,
 * independent envelope for the Evidence capability, with its own
 * `schemaVersion` and `capability` identifier -- **not** a modification of
 * Increment 7's frozen `DataTrustCanonicalEnvelope`
 * (`services/intelligence-adapters/api-projection-adapter.ts`, untouched
 * by this increment).
 *
 * Pure: no database access, no call to `evidenceCenterForSite`, no import
 * of route code, no authentication, no environment-variable reads, no
 * `Date.now()`, no random values, no mutation of its input, no fabricated
 * field. Every field below is a direct, stable rename/reshape of a field
 * the Orchestrator already produced.
 *
 * NO `notFound` FIELD (applying Increment 7's own post-audit lesson from
 * the start): a not-found Site is mapped straight to an HTTP 404 by the
 * route/handler *before* this function is ever called -- so a `notFound`
 * field could never actually be `true` in any envelope a real client would
 * see, and is therefore not declared here at all.
 */

export type EvidenceEnvelopeIssue = CanonicalEvidenceOrchestrationResult["issues"][number];

export interface EvidenceCenterCanonicalEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "evidence-center";
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
    readonly evidence: readonly Evidence[];
  };
  readonly adaptation: {
    readonly success: boolean;
    readonly issues: readonly EvidenceEnvelopeIssue[];
    readonly limitations: readonly Limitation[];
  };
}

/**
 * Projects one `CanonicalEvidenceOrchestrationResult` into the versioned
 * HTTP response envelope. Never throws; never mutates `result`. The caller
 * (the route handler) must never call this for a `notFound: true` result --
 * that state is mapped to an HTTP 404 before projection is ever attempted.
 */
export function projectCanonicalEvidenceResponse(
  result: CanonicalEvidenceOrchestrationResult,
): EvidenceCenterCanonicalEnvelope {
  return {
    schemaVersion: "1.0",
    capability: "evidence-center",
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
      evidence: result.evidence,
    },
    adaptation: {
      success: result.success,
      issues: result.issues,
      limitations: result.limitations,
    },
  };
}
