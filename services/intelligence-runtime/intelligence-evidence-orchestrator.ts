import type { SiteRow } from "@/lib/types";
import type { Evidence, EntityReference, Limitation, Site, CalculationContext } from "@/services/intelligence";
import { validateCalculationContextShape } from "@/services/intelligence";
import type { LegacyEvidenceCenterReadResult } from "@/services/intelligence-adapters/evidence-center-read-adapter";
import type { SiteAdaptationResult } from "@/services/intelligence-adapters/site-entity-adapter";
import type {
  LegacyEvidenceItem,
  EvidenceAdapterContext,
  EvidenceAdaptationResult,
} from "@/services/intelligence-adapters/evidence-adapter";
import type { SnapshotProviderInput, SnapshotDerivation } from "@/services/intelligence-adapters/snapshot-provider";

/**
 * Genesis Phase 2 — Increment 8 (Minimal read-only Evidence Orchestrator).
 *
 * Per `docs/genesis-phase-2/26_INCREMENT_8_IMPLEMENTATION_PLAN.md` Section 5.5
 * and ADR-020's reconciliation note (Section 11): a second, independent,
 * minimal, single-use-case Orchestrator, mirroring
 * `services/intelligence-runtime/intelligence-orchestrator.ts`'s exact
 * shape and rationale for Data Trust -- not a generalization of that module,
 * and not a new generic multi-capability aggregator. It receives the
 * request, calls the Evidence Center outer adapter to obtain legacy data,
 * derives the Snapshot, resolves a canonical Site reference (needed only to
 * populate `CalculationContext.scope`, per `02_CANONICAL_DOMAIN_MODEL.md`'s
 * binding rule that the Site Entity Adapter is the only sanctioned way to
 * obtain one -- Evidence's own canonical contract carries no site
 * back-reference field), computes a per-item checksum, calls the existing
 * pure Evidence Adapter once per item, and returns a canonical result for
 * projection. It performs no persistence, no cache writes, no audit-log
 * writes, no mutation, and no engine lifecycle transition -- none of those
 * operations are even reachable here, since no dependency capable of
 * performing them is ever injected.
 *
 * WHY THIS FILE HAS NO DATABASE IMPORT
 * ---------------------------------------------------------------------------
 * Every dependency this Orchestrator needs -- including the DB-touching
 * outer adapter -- is supplied by the caller via `EvidenceOrchestratorDeps`,
 * never imported directly, for the identical, already-proven reason
 * Increment 7's own orchestrator core stays DB-free: it keeps this module's
 * own logic (call ordering, context construction, issue/limitation
 * aggregation) unit-testable with zero I/O, matching this repository's
 * established convention that a Vitest file transitively importing
 * `node:sqlite` cannot be safely collected. The real, DB-touching wiring
 * lives in the sibling module `intelligence-evidence-orchestrator-instance.ts`,
 * never imported by a unit test. Type-only imports (`import type`) are used
 * for anything originating in a DB-touching module
 * (`evidence-center-read-adapter.ts`), since a type-only import is fully
 * erased at compile time and never loads `node:sqlite`.
 */

export interface EvidenceOrchestratorDeps {
  readonly fetchLegacyEvidenceCenterForSite: (siteId: number) => LegacyEvidenceCenterReadResult | null;
  readonly deriveSiteSnapshot: (input: SnapshotProviderInput) => SnapshotDerivation;
  readonly adaptLegacySiteRow: (input: SiteRow) => SiteAdaptationResult;
  readonly toSiteEntityReference: (site: Site) => EntityReference<"Site">;
  readonly computeEvidenceChecksum: (item: LegacyEvidenceItem) => string;
  readonly adaptLegacyEvidence: (
    item: LegacyEvidenceItem,
    context: EvidenceAdapterContext,
  ) => EvidenceAdaptationResult;
  /** Returns the current time as an ISO-8601 string. Injected so tests can
   * supply a fixed clock; production wiring supplies
   * `() => new Date().toISOString()`. Called exactly once per request --
   * every evidence item shares the same `timestamp`, matching the fact
   * that they all describe the same Site at the same request instant. */
  readonly now: () => string;
  /** Returns the `CalculationContext.environment` value. Injected for the
   * same determinism reason as `now`. */
  readonly environment: () => CalculationContext["environment"];
}

export type EvidenceOrchestrationIssueStage = "site" | "snapshot" | "evidence" | "context";

export interface EvidenceOrchestrationIssue {
  readonly stage: EvidenceOrchestrationIssueStage;
  readonly code: string;
  readonly field: string;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
  readonly canContinue: boolean;
}

export interface EvidenceOrchestrationContextSummary {
  readonly contextId: string;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly environment: string;
}

export interface CanonicalEvidenceOrchestrationResult {
  readonly notFound: boolean;
  readonly success: boolean;
  readonly siteId: string;
  readonly snapshot: SnapshotDerivation | null;
  readonly context: EvidenceOrchestrationContextSummary | null;
  readonly evidence: readonly Evidence[];
  readonly issues: readonly EvidenceOrchestrationIssue[];
  readonly limitations: readonly Limitation[];
}

const REQUESTED_BY = "api:intelligence/evidence-center/site";
/** Uniform across every item in one batch -- the Evidence Center legacy
 * subsystem genuinely is the data source for all five items, regardless of
 * each item's own, already-distinct `origin.origin` value (which the
 * Evidence Adapter independently sets to each item's own legacy `source`
 * string). Not a per-item value: `EvidenceAdapterContext` has exactly one
 * `source` slot per call, and every call in one request shares it. */
const DATA_SOURCE_IDENTIFIER = "evidence-center";

function emptyResult(siteId: number, notFound: boolean, snapshot: SnapshotDerivation | null = null): CanonicalEvidenceOrchestrationResult {
  return {
    notFound,
    success: false,
    siteId: String(siteId),
    snapshot,
    context: null,
    evidence: [],
    issues: [],
    limitations: [],
  };
}

/**
 * Builds the minimal, read-only Evidence Orchestrator. Returns a single
 * method, `getCanonicalEvidenceForSite`, which never persists, never writes
 * a cache entry, never writes an audit log, never mutates the Runtime
 * Registry, and never changes any engine manifest's status.
 */
export function createEvidenceOrchestrator(deps: EvidenceOrchestratorDeps) {
  function getCanonicalEvidenceForSite(siteId: number): CanonicalEvidenceOrchestrationResult {
    const legacy = deps.fetchLegacyEvidenceCenterForSite(siteId);
    if (!legacy) {
      return emptyResult(siteId, true);
    }

    const issues: EvidenceOrchestrationIssue[] = [];
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
        evidence: [],
        issues,
        limitations,
      };
    }

    const entityReference = deps.toSiteEntityReference(siteAdaptation.site);
    const requestedAt = deps.now();
    const contextId = `context:evidence:${siteId}:${requestedAt}`;
    const correlationId = `correlation:evidence:${siteId}:${requestedAt}`;
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
      // Not expected to fire in practice -- every field above is already
      // individually validated/derived by the pieces that produced it. Kept
      // as a genuine, tested safety net (Principle 7), mirroring Increment
      // 7's own identical guard.
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
        evidence: [],
        issues,
        limitations,
      };
    }

    const context: EvidenceOrchestrationContextSummary = {
      contextId,
      correlationId,
      requestedAt,
      requestedBy: REQUESTED_BY,
      environment,
    };

    const evidence: Evidence[] = [];
    let allEvidenceSucceeded = true;

    // Preserve evidenceCenterForSite()'s own fixed array order
    // (CADASTRO, COORDENADAS, COPERNICUS, QUALIDADE, OBSERVACOES) --
    // never re-sorted. Each item gets its own checksum and is adapted
    // individually via adaptLegacyEvidence -- never via the batch
    // convenience wrapper adaptLegacyEvidenceList, which shares one
    // context (including one checksum) across the whole list and therefore
    // cannot express a distinct checksum per item.
    for (const item of legacy.evidences) {
      const checksum = deps.computeEvidenceChecksum(item);
      const itemContext: EvidenceAdapterContext = {
        idSeed: String(siteId),
        snapshot: snapshot.snapshotId,
        source: DATA_SOURCE_IDENTIFIER,
        checksum,
        timestamp: requestedAt,
      };
      const result = deps.adaptLegacyEvidence(item, itemContext);
      for (const evidenceIssue of result.issues) {
        issues.push({
          stage: "evidence",
          code: evidenceIssue.code,
          field: `${item.type}.${evidenceIssue.field}`,
          severity: evidenceIssue.severity,
          message: evidenceIssue.message,
          canContinue: evidenceIssue.canContinue,
        });
      }
      if (result.success && result.evidence) {
        // Evidence itself carries no `limitations` field (unlike Score/
        // Recommendation) -- its own disclosure mechanism is `issues` plus
        // `metadata`/`origin.processingMetadata`, already aggregated above
        // and preserved verbatim on the Evidence record itself.
        evidence.push(result.evidence);
      } else {
        allEvidenceSucceeded = false;
      }
    }

    return {
      notFound: false,
      success: allEvidenceSucceeded,
      siteId: String(siteId),
      snapshot,
      context,
      evidence,
      issues,
      limitations,
    };
  }

  return { getCanonicalEvidenceForSite };
}
