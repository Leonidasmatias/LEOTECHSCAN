import type { Score, Evidence, Recommendation, Limitation } from "@/services/intelligence";
import type { CanonicalDataTrustOrchestrationResult } from "@/services/intelligence-runtime/intelligence-orchestrator";

/**
 * Genesis Phase 2 — Increment 7 (Pure API Projection Adapter).
 *
 * Per `docs/genesis-phase-2/08_ADAPTER_STRATEGY.md`'s adapter #5: translates the
 * canonical Orchestrator result into the JSON shape served by the first new canonical
 * route (`GET /api/intelligence/data-trust/site`). This is the only adapter category
 * that is allowed to know about HTTP response shapes -- and even this module knows
 * nothing about `next/server`/HTTP status codes/request parsing, only the plain data
 * shape (Section 12 of `24_INCREMENT_7_CANONICAL_DATA_TRUST_PATH.md` -- status-code
 * mapping is the route's own job).
 *
 * Pure: no database access, no call to `dataTrustForSite`, no import of route code, no
 * authentication, no environment-variable reads, no `Date.now()`, no random values, no
 * mutation of its input, no fabricated field. Every field below is a direct,
 * stable rename/reshape of a field the Orchestrator already produced.
 *
 * `evidence` is always `[]` in this increment -- the Orchestrator never invokes the
 * Evidence Adapter (Section 6/17 of the design doc: the satellite/Copernicus
 * sub-data nested in the legacy Data Trust result does not match the existing
 * Evidence Adapter's required input shape, and is already summarized into the
 * Score's own `satelliteConfidence` driver), so there is nothing to project here.
 *
 * NO `notFound` FIELD (post-audit fix, Increment 7 required-fix pass)
 * ---------------------------------------------------------------------------
 * An earlier version of this envelope declared a `notFound: boolean` field, but the
 * route (`app/api/intelligence/data-trust/site/handler.ts`) always maps a not-found
 * Orchestrator result straight to an HTTP 404 *before* this function is ever called
 * -- so that field could never actually be `true` in any envelope a real client
 * would see. This function is therefore only ever called for an Orchestrator result
 * where `notFound` is `false`; the envelope carries no field for a state it can
 * never represent.
 */

export type DataTrustEnvelopeIssue = CanonicalDataTrustOrchestrationResult["issues"][number];

export interface DataTrustCanonicalEnvelope {
  readonly schemaVersion: "1.0";
  readonly capability: "data-trust";
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
    readonly score: Score | null;
    readonly evidence: readonly Evidence[];
    readonly recommendations: readonly Recommendation[];
  };
  readonly adaptation: {
    readonly success: boolean;
    readonly issues: readonly DataTrustEnvelopeIssue[];
    readonly limitations: readonly Limitation[];
  };
}

/**
 * Projects one `CanonicalDataTrustOrchestrationResult` into the versioned HTTP
 * response envelope. Never throws; never mutates `result`. The caller (the route
 * handler) must never call this for a `notFound: true` result -- that state is
 * mapped to an HTTP 404 before projection, per this module's own header comment.
 */
export function projectCanonicalDataTrustResponse(
  result: CanonicalDataTrustOrchestrationResult,
): DataTrustCanonicalEnvelope {
  return {
    schemaVersion: "1.0",
    capability: "data-trust",
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
      score: result.score,
      evidence: [],
      recommendations: result.recommendations,
    },
    adaptation: {
      success: result.success,
      issues: result.issues,
      limitations: result.limitations,
    },
  };
}
