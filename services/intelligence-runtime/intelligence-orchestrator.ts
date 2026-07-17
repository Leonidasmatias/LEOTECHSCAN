import type { SiteRow } from "@/lib/types";
import type { Score, Recommendation, EntityReference, Limitation, Site, CalculationContext } from "@/services/intelligence";
import { validateCalculationContextShape } from "@/services/intelligence";
import type { LegacyDataTrustReadResult } from "@/services/intelligence-adapters/data-trust-read-adapter";
import type { SiteAdaptationResult } from "@/services/intelligence-adapters/site-entity-adapter";
import type {
  LegacyDataTrustResult,
  DataTrustAdapterContext,
  DataTrustAdaptationResult,
} from "@/services/intelligence-adapters/data-trust-score-adapter";
import type {
  LegacyRecommendationItem,
  RecommendationAdapterContext,
  RecommendationAdaptationResult,
} from "@/services/intelligence-adapters/recommendation-adapter";
import type { SnapshotProviderInput, SnapshotDerivation } from "@/services/intelligence-adapters/snapshot-provider";

/**
 * Genesis Phase 2 — Increment 7 (Minimal read-only IntelligenceOrchestrator).
 *
 * Per `docs/genesis-phase-2/23_INCREMENT_6_5_ARCHITECTURAL_DECISIONS.md` Decision A
 * (ADR-016): a minimal Orchestrator scoped only to "get canonical Data Trust
 * assessment for one Site, read-only". It receives the request, calls the Data Trust
 * outer adapter to obtain legacy data, derives the Snapshot, constructs the minimal
 * `CalculationContext`, calls the existing pure Data Trust Score / Recommendation
 * adapters, and returns a canonical result for projection. It performs no
 * persistence, no cache writes, no audit-log writes, no mutation, and no engine
 * lifecycle transition -- none of those operations are even reachable here, since no
 * dependency capable of performing them is ever injected (see `DataTrustOrchestratorDeps`
 * below: every dependency is a pure function or a narrowly-scoped read).
 *
 * This is deliberately NOT the full generic `IntelligenceOrchestrator` described in
 * `05_ORCHESTRATION_MODEL.md` (execution-plan construction across many engines,
 * parallel-safe stages, cancellation, replay mode) -- it is the minimum slice of that
 * responsibility list needed for this one use case. See ADR-016's revisit trigger for
 * when to generalize it.
 *
 * WHY THIS FILE HAS NO DATABASE IMPORT
 * ---------------------------------------------------------------------------
 * Every dependency this Orchestrator needs -- including the DB-touching outer
 * adapter -- is supplied by the caller via `DataTrustOrchestratorDeps`, never
 * imported directly. This keeps this module's own logic (call ordering, context
 * construction, issue/limitation aggregation) unit-testable with zero I/O, matching
 * every other pure module in this codebase and this mission's own "Dependency
 * injection is preferred where it improves deterministic testing" instruction. The
 * real, DB-touching wiring lives in the sibling module
 * `intelligence-orchestrator-instance.ts`, which is never imported by a unit test.
 * All value-level imports above are of already-pure, already-unmodified adapters
 * (Increments 3, 4, 6, and this increment's own Snapshot Provider) -- type-only
 * imports (`import type`) are used for anything originating in a DB-touching module
 * (`data-trust-read-adapter.ts`), since a type-only import is fully erased at compile
 * time and never loads `node:sqlite`.
 */

export interface DataTrustOrchestratorDeps {
  readonly fetchLegacyDataTrustForSite: (siteId: number) => LegacyDataTrustReadResult | null;
  readonly deriveSiteSnapshot: (input: SnapshotProviderInput) => SnapshotDerivation;
  readonly adaptLegacySiteRow: (input: SiteRow) => SiteAdaptationResult;
  readonly toSiteEntityReference: (site: Site) => EntityReference<"Site">;
  readonly adaptLegacyDataTrustResult: (
    input: LegacyDataTrustResult,
    context: DataTrustAdapterContext,
  ) => DataTrustAdaptationResult;
  readonly adaptLegacyRecommendation: (
    item: LegacyRecommendationItem,
    context: RecommendationAdapterContext,
  ) => RecommendationAdaptationResult;
  /** Returns the current time as an ISO-8601 string. Injected so tests can supply a
   * fixed clock; production wiring supplies `() => new Date().toISOString()`. Never
   * called internally as `Date.now()` -- this Orchestrator legitimately needs a
   * real-time value (it stamps `ExecutionMetadata`/`CalculationContext` timestamps
   * for a live, on-demand request, per `05_ORCHESTRATION_MODEL.md`'s own responsibility
   * #9), but the value always arrives through this injected seam, never a direct
   * global-clock call, so behavior stays fully deterministic under test. */
  readonly now: () => string;
  /** Returns the `CalculationContext.environment` value. Injected for the same
   * determinism reason as `now` -- production wiring reads `process.env.NODE_ENV`;
   * tests supply a fixed literal. */
  readonly environment: () => CalculationContext["environment"];
}

export type OrchestrationIssueStage = "site" | "snapshot" | "score" | "recommendation" | "context";

export interface OrchestrationIssue {
  readonly stage: OrchestrationIssueStage;
  readonly code: string;
  readonly field: string;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
  readonly canContinue: boolean;
}

export interface OrchestrationContextSummary {
  readonly contextId: string;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly environment: string;
}

export interface CanonicalDataTrustOrchestrationResult {
  readonly notFound: boolean;
  readonly success: boolean;
  readonly siteId: string;
  readonly snapshot: SnapshotDerivation | null;
  readonly context: OrchestrationContextSummary | null;
  readonly score: Score | null;
  readonly recommendations: readonly Recommendation[];
  readonly issues: readonly OrchestrationIssue[];
  readonly limitations: readonly Limitation[];
}

const REQUESTED_BY = "api:intelligence/data-trust/site";

function emptyResult(siteId: number, notFound: boolean, snapshot: SnapshotDerivation | null = null): CanonicalDataTrustOrchestrationResult {
  return {
    notFound,
    success: false,
    siteId: String(siteId),
    snapshot,
    context: null,
    score: null,
    recommendations: [],
    issues: [],
    limitations: [],
  };
}

/**
 * Builds the minimal, read-only Data Trust Orchestrator. Returns a single method,
 * `getCanonicalDataTrustForSite`, which never persists, never writes a cache entry,
 * never writes an audit log, never mutates the Runtime Registry, and never changes
 * any engine manifest's status -- it only calls the injected dependencies (all of
 * which are themselves either pure functions or the one narrowly-scoped legacy read)
 * and returns data.
 */
export function createDataTrustOrchestrator(deps: DataTrustOrchestratorDeps) {
  function getCanonicalDataTrustForSite(siteId: number): CanonicalDataTrustOrchestrationResult {
    const legacy = deps.fetchLegacyDataTrustForSite(siteId);
    if (!legacy) {
      return emptyResult(siteId, true);
    }

    const issues: OrchestrationIssue[] = [];
    const limitations: Limitation[] = [];

    const snapshot = deps.deriveSiteSnapshot({
      dataImportacao: legacy.site.dataImportacao,
      arquivoOrigem: legacy.site.arquivoOrigem,
    });
    if (snapshot.limitation) limitations.push(snapshot.limitation);

    const siteAdaptation = deps.adaptLegacySiteRow(legacy.site);
    for (const siteIssue of siteAdaptation.issues) {
      issues.push({
        stage: "site",
        code: siteIssue.code,
        field: siteIssue.field,
        severity: siteIssue.severity,
        message: siteIssue.message,
        canContinue: siteIssue.canContinue,
      });
    }

    if (!siteAdaptation.success || !siteAdaptation.site) {
      return {
        notFound: false,
        success: false,
        siteId: String(siteId),
        snapshot,
        context: null,
        score: null,
        recommendations: [],
        issues,
        limitations,
      };
    }

    const entityReference = deps.toSiteEntityReference(siteAdaptation.site);
    const requestedAt = deps.now();
    const contextId = `context:data-trust:${siteId}:${requestedAt}`;
    const correlationId = `correlation:data-trust:${siteId}:${requestedAt}`;
    const environment = deps.environment();

    const calculationContext: CalculationContext = {
      contextId,
      scope: entityReference,
      snapshot: snapshot.snapshotId,
      requestedAt: requestedAt as CalculationContext["requestedAt"],
      requestedBy: REQUESTED_BY,
      correlationId,
      environment,
      extensions: {},
    };
    const contextStructural = validateCalculationContextShape(calculationContext);
    if (!contextStructural.valid) {
      // Not expected to fire in practice -- every field above is already individually
      // validated/derived by the pieces that produced it. Kept as a genuine, tested
      // safety net (Principle 7) rather than an unreachable comment, since unlike the
      // Recommendation Adapter's tuple-narrowing guard, no upstream check has already
      // literally proven this exact combination valid.
      for (const structuralIssue of contextStructural.issues) {
        issues.push({
          stage: "context",
          code: "invalid_canonical_shape",
          field: structuralIssue.path,
          severity: "significant",
          message: structuralIssue.message,
          canContinue: false,
        });
      }
      return {
        notFound: false,
        success: false,
        siteId: String(siteId),
        snapshot,
        context: null,
        score: null,
        recommendations: [],
        issues,
        limitations,
      };
    }

    const context: OrchestrationContextSummary = {
      contextId,
      correlationId,
      requestedAt,
      requestedBy: REQUESTED_BY,
      environment,
    };

    const scoreResult = deps.adaptLegacyDataTrustResult(legacy.trust, {
      entityReference,
      calculatedAt: requestedAt,
      contextId,
    });
    for (const scoreIssue of scoreResult.issues) {
      issues.push({
        stage: "score",
        code: scoreIssue.code,
        field: scoreIssue.field,
        severity: scoreIssue.severity,
        message: scoreIssue.message,
        canContinue: scoreIssue.canContinue,
      });
    }
    if (scoreResult.score) limitations.push(...scoreResult.score.limitations);

    const recommendationResult = deps.adaptLegacyRecommendation(
      {
        type: "DATA_TRUST_TEXT",
        text: legacy.trust.recommendation,
        priority: null,
        evidenceContext: null,
      },
      {
        idSeed: entityReference.id,
        affectedEntities: [entityReference],
        timestamp: requestedAt,
      },
    );
    for (const recommendationIssue of recommendationResult.issues) {
      issues.push({
        stage: "recommendation",
        code: recommendationIssue.code,
        field: recommendationIssue.field,
        severity: recommendationIssue.severity,
        message: recommendationIssue.message,
        canContinue: recommendationIssue.canContinue,
      });
    }
    const recommendations: Recommendation[] = [];
    if (recommendationResult.recommendation) {
      recommendations.push(recommendationResult.recommendation);
      limitations.push(...recommendationResult.recommendation.limitations);
    }

    return {
      notFound: false,
      success: scoreResult.success && Boolean(scoreResult.score),
      siteId: String(siteId),
      snapshot,
      context,
      score: scoreResult.score,
      recommendations,
      issues,
      limitations,
    };
  }

  return { getCanonicalDataTrustForSite };
}
