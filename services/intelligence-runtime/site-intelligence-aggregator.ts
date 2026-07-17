import type { CalculationContext } from "@/services/intelligence";
import type { CanonicalDataTrustOrchestrationResult } from "./intelligence-orchestrator";
import type { CanonicalEvidenceOrchestrationResult } from "./intelligence-evidence-orchestrator";
import type { SnapshotDerivation } from "@/services/intelligence-adapters/snapshot-provider";

/**
 * Genesis Phase 2 — Increment 9 (Site Intelligence Aggregator, pure core).
 *
 * Per `docs/genesis-phase-2/27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md`
 * (Option C — Orchestrator composition, ADR-020 Section 11's own
 * aggregation-flow diagram): a minimal, DI-based Aggregate Orchestrator
 * that composes the two frozen capability orchestrators' already-public
 * entry points -- never a legacy engine, never a route/handler, never an
 * already-projected envelope. It receives each capability's *raw* result
 * (`CanonicalDataTrustOrchestrationResult`/`CanonicalEvidenceOrchestrationResult`)
 * via injected functions, classifies each capability's outcome, resolves
 * not-found consistency before ever comparing snapshots, derives one
 * aggregate `status`, and returns a canonical result for projection. It
 * performs no persistence, no cache write, no audit-log write, no
 * mutation, and no engine lifecycle transition -- none of those
 * operations are even reachable here, since no dependency capable of
 * performing them is ever injected.
 *
 * WHY THIS FILE HAS NO DATABASE IMPORT
 * ---------------------------------------------------------------------------
 * Every dependency this Orchestrator needs -- including the two capability
 * entry points -- is supplied by the caller via `SiteIntelligenceAggregatorDeps`,
 * never imported directly, for the identical, already-proven reason both
 * existing orchestrator cores stay database-free: it keeps this module's
 * own logic (call ordering, outcome classification, status derivation,
 * issue aggregation) unit-testable with zero I/O. The real, wiring lives
 * in the sibling module `site-intelligence-aggregator-instance.ts`, never
 * imported by a unit test. Type-only imports are used for both capability
 * result shapes and the Snapshot type, since a type-only import is fully
 * erased at compile time and never loads a database driver.
 */

export interface SiteIntelligenceAggregatorDeps {
  readonly getCanonicalDataTrustForSite: (siteId: number) => CanonicalDataTrustOrchestrationResult;
  readonly getCanonicalEvidenceForSite: (siteId: number) => CanonicalEvidenceOrchestrationResult;
  /** Returns the current time as an ISO-8601 string. Injected so tests can
   * supply a fixed clock; production wiring supplies
   * `() => new Date().toISOString()`. Called exactly once per request --
   * only to stamp the aggregate's own context, never the two nested
   * capability contexts, which each capability's own, unmodified
   * orchestrator instance already stamps independently. */
  readonly now: () => string;
  /** Returns the `CalculationContext.environment` value. Injected for the
   * same determinism reason as `now`. */
  readonly environment: () => CalculationContext["environment"];
}

export type SiteIntelligenceCapabilityState = "available" | "unavailable" | "notFound";

export interface SiteIntelligenceCapabilityOutcome<TResult> {
  readonly state: SiteIntelligenceCapabilityState;
  readonly result: TResult | null;
  /** Populated only when `state === "unavailable"` -- the caught error's
   * `.name` only (never `.message`/`.stack`), matching this project's
   * established sanitized-disclosure convention. */
  readonly errorName: string | null;
}

/**
 * `"notFound"` (post-audit hardening, F-2) is a distinct value from
 * `"failed"`, used exclusively, internally, for the both-capabilities-
 * agree-not-found case (`bothNotFoundResult`, below) -- never for an
 * unexpected-runtime-failure condition. It is structurally guaranteed,
 * by construction, to co-occur only with `notFound: true` on the same
 * result object (both fields are set together, in the same return
 * statement, in the one function that produces this value), and
 * `app/api/intelligence/site/handler.ts` always checks `result.notFound`
 * strictly before ever inspecting `result.status` -- so this value can
 * never actually reach `projectSiteIntelligenceResponse` or any real
 * HTTP response. It exists so the internal representation itself is
 * honest (a not-found Site is not a runtime failure) rather than relying
 * solely on caller discipline to avoid a misleading label.
 */
export type SiteIntelligenceStatus = "complete" | "partial" | "failed" | "notFound";

/**
 * `"failed"` is defined precisely as: neither capability produced a
 * usable canonical result. This is reached both when both capabilities
 * are `state === "unavailable"` (the ordinary double-crash case) and
 * when one capability is `unavailable` and the other is independently
 * `notFound` (post-audit hardening, F-1 -- formally documented here and
 * in `docs/genesis-phase-2/27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md`
 * Section 8: neither combination produces a usable envelope for either
 * capability, so both are honestly reported as `failed`, never
 * fabricated as `partial`. This is a deliberate extension of the
 * original plan text -- approved and recorded, not an undocumented
 * deviation -- covering the two of nine possible capability-state
 * combinations the original partial-failure matrix did not enumerate.
 * Both-`notFound` is excluded from this by the earlier short-circuit
 * (see `bothNotFoundResult`) and never reaches this derivation at all.
 */

export type SiteIntelligenceIssueStage = "snapshot-consistency" | "capability-failure" | "notfound-inconsistency";

export interface SiteIntelligenceIssue {
  readonly stage: SiteIntelligenceIssueStage;
  readonly code: string;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
}

export interface SiteIntelligenceOrchestrationContextSummary {
  readonly contextId: string;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly environment: string;
}

export interface SiteIntelligenceOrchestrationResult {
  readonly notFound: boolean;
  readonly status: SiteIntelligenceStatus;
  readonly siteId: string;
  readonly snapshot: SnapshotDerivation | null;
  readonly context: SiteIntelligenceOrchestrationContextSummary | null;
  readonly dataTrust: SiteIntelligenceCapabilityOutcome<CanonicalDataTrustOrchestrationResult>;
  readonly evidenceCenter: SiteIntelligenceCapabilityOutcome<CanonicalEvidenceOrchestrationResult>;
  readonly issues: readonly SiteIntelligenceIssue[];
}

const REQUESTED_BY = "api:intelligence/site";

function unavailableOutcome<TResult>(errorName: string): SiteIntelligenceCapabilityOutcome<TResult> {
  return { state: "unavailable", result: null, errorName };
}

function availableOutcome<TResult extends { notFound: boolean }>(
  result: TResult,
): SiteIntelligenceCapabilityOutcome<TResult> {
  return { state: result.notFound ? "notFound" : "available", result, errorName: null };
}

/**
 * Invokes one capability call, isolated in its own try/catch, so a thrown
 * exception from one capability can never suppress a successfully-obtained
 * result from the other (the mandatory isolation requirement, plan
 * Section 8).
 */
function invokeCapability<TResult extends { notFound: boolean }>(
  call: () => TResult,
): SiteIntelligenceCapabilityOutcome<TResult> {
  try {
    return availableOutcome(call());
  } catch (error) {
    return unavailableOutcome(error instanceof Error ? error.name : "unknown");
  }
}

/**
 * Post-audit hardening, F-2: `status` is `"notFound"` here, never
 * `"failed"` -- a not-found Site is not a runtime failure, and the two
 * concepts must not share an internal label even though this value is
 * structurally unreachable from any real HTTP response (the caller,
 * `handleSiteIntelligenceRequest`, always checks `notFound` first).
 */
function bothNotFoundResult(
  siteId: number,
  dataTrust: SiteIntelligenceCapabilityOutcome<CanonicalDataTrustOrchestrationResult>,
  evidenceCenter: SiteIntelligenceCapabilityOutcome<CanonicalEvidenceOrchestrationResult>,
): SiteIntelligenceOrchestrationResult {
  return {
    notFound: true,
    status: "notFound",
    siteId: String(siteId),
    snapshot: null,
    context: null,
    dataTrust,
    evidenceCenter,
    issues: [],
  };
}

/**
 * Builds the minimal, read-only Site Intelligence Aggregator. Returns a
 * single method, `getCanonicalSiteIntelligence`, which never persists,
 * never writes a cache entry, never writes an audit log, never mutates
 * the Runtime Registry, and never changes any engine manifest's status.
 */
export function createSiteIntelligenceAggregator(deps: SiteIntelligenceAggregatorDeps) {
  function getCanonicalSiteIntelligence(siteId: number): SiteIntelligenceOrchestrationResult {
    // Step 1-2: execute both capability calls independently, deterministic
    // order (Data Trust before Evidence Center), each isolated in its own
    // try/catch (Step 3: classify thrown exceptions).
    const dataTrust = invokeCapability(() => deps.getCanonicalDataTrustForSite(siteId));
    const evidenceCenter = invokeCapability(() => deps.getCanonicalEvidenceForSite(siteId));

    const issues: SiteIntelligenceIssue[] = [];

    // Step 4-5: evaluate capability-level notFound states before anything
    // that depends on the two results' content. Both notFound -> aggregate
    // notFound, short-circuit before any snapshot comparison is attempted.
    const dataTrustNotFound = dataTrust.state === "notFound";
    const evidenceNotFound = evidenceCenter.state === "notFound";

    if (dataTrustNotFound && evidenceNotFound) {
      return bothNotFoundResult(siteId, dataTrust, evidenceCenter);
    }

    // Step 6: notFound states disagree -> exactly one aggregate issue,
    // never a snapshot-mismatch issue for the same anomaly (a capability's
    // snapshot is null iff that capability reports notFound: true, so
    // comparing snapshots for this pair would only ever re-describe the
    // same anomaly under a different issue code).
    const notFoundInconsistent = dataTrustNotFound !== evidenceNotFound;
    if (notFoundInconsistent) {
      issues.push({
        stage: "notfound-inconsistency",
        code: "notfound_inconsistency",
        severity: "significant",
        message: `Data Trust reports notFound=${dataTrustNotFound}, Evidence Center reports notFound=${evidenceNotFound} for the same Site.`,
      });
    }

    // Step 7-8: only when both capabilities agree the Site exists (neither
    // is notFound) and both are available (non-null snapshot) is a
    // snapshotId equality check performed.
    let snapshot: SnapshotDerivation | null = null;
    let snapshotMismatch = false;
    if (!notFoundInconsistent) {
      const dataTrustSnapshot = dataTrust.result?.snapshot ?? null;
      const evidenceSnapshot = evidenceCenter.result?.snapshot ?? null;
      if (dataTrustSnapshot && evidenceSnapshot) {
        if (dataTrustSnapshot.snapshotId === evidenceSnapshot.snapshotId) {
          snapshot = dataTrustSnapshot;
        } else {
          snapshotMismatch = true;
          issues.push({
            stage: "snapshot-consistency",
            code: "snapshot_mismatch",
            severity: "significant",
            message: `Data Trust snapshot "${dataTrustSnapshot.snapshotId}" does not match Evidence Center snapshot "${evidenceSnapshot.snapshotId}" for the same Site.`,
          });
        }
      } else if (dataTrustSnapshot) {
        snapshot = dataTrustSnapshot;
      } else if (evidenceSnapshot) {
        snapshot = evidenceSnapshot;
      }
    }

    if (dataTrust.state === "unavailable") {
      issues.push({
        stage: "capability-failure",
        code: "data_trust_unavailable",
        severity: "significant",
        message: "Data Trust capability call did not complete due to an unexpected runtime failure.",
      });
    }
    if (evidenceCenter.state === "unavailable") {
      issues.push({
        stage: "capability-failure",
        code: "evidence_center_unavailable",
        severity: "significant",
        message: "Evidence Center capability call did not complete due to an unexpected runtime failure.",
      });
    }

    // Status derivation. "failed" is defined precisely as: neither
    // capability produced a usable envelope. This covers both capabilities
    // unavailable (the ordinary double-crash case) and the rarer hybrid
    // edge case where one capability is unavailable and the other is
    // notFound (neither side has real content to report) -- both are
    // "no usable canonical result anywhere," never fabricated as partial
    // success. Post-audit hardening, F-1: this hybrid combination (and its
    // mirror) is now formally documented as "failed" in
    // docs/genesis-phase-2/27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md
    // Section 8 -- an approved, recorded plan extension, not an
    // undocumented deviation. The both-notFound combination never reaches
    // this derivation at all (see bothNotFoundResult's earlier
    // short-circuit and its own "notFound" status, F-2).
    const anyUsable = dataTrust.state === "available" || evidenceCenter.state === "available";

    let status: SiteIntelligenceStatus;
    if (!anyUsable) {
      status = "failed";
    } else if (
      dataTrust.state === "available" &&
      evidenceCenter.state === "available" &&
      Boolean(dataTrust.result?.success) &&
      Boolean(evidenceCenter.result?.success) &&
      !snapshotMismatch &&
      !notFoundInconsistent
    ) {
      status = "complete";
    } else {
      status = "partial";
    }

    const requestedAt = deps.now();
    const contextId = `context:site-intelligence:${siteId}:${requestedAt}`;
    const correlationId = `correlation:site-intelligence:${siteId}:${requestedAt}`;
    const context: SiteIntelligenceOrchestrationContextSummary = {
      contextId,
      correlationId,
      requestedAt,
      requestedBy: REQUESTED_BY,
      environment: deps.environment(),
    };

    return {
      notFound: false,
      status,
      siteId: String(siteId),
      snapshot,
      context,
      dataTrust,
      evidenceCenter,
      issues,
    };
  }

  return { getCanonicalSiteIntelligence };
}
