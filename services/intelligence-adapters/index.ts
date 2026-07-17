/**
 * Genesis Phase 2 — Increments 3, 4, 5 & 6. Public entry point for adapters that
 * translate legacy repository data into `services/intelligence/**`'s
 * canonical entities. Currently exports the Site Entity Adapter
 * (`08_ADAPTER_STRATEGY.md` adapter #1), the Data Trust Score Adapter's
 * pure translator (adapter #2's inner half only — see
 * `data-trust-score-adapter.ts`'s own header for the DB-touching-outer-layer
 * scope note), the Evidence Adapter (adapter #3), and the Recommendation
 * Adapter (adapter #4). Nothing in this module opens a database, imports
 * Next.js, or executes a legacy engine.
 */

export type {
  LegacySiteRow,
  SiteAdaptationIssue,
  SiteAdaptationIssueCode,
  SiteSourceReference,
  SiteAdaptationResult,
} from "./site-entity-adapter";

export {
  SITE_ADAPTER_UNMAPPED_FIELDS,
  adaptLegacySiteRow,
  toSiteEntityReference,
} from "./site-entity-adapter";

export type {
  LegacyDataTrustResult,
  DataTrustAdapterContext,
  DataTrustAdaptationIssue,
  DataTrustAdaptationIssueCode,
  DataTrustSourceReference,
  DataTrustAdaptationResult,
} from "./data-trust-score-adapter";

export {
  DATA_TRUST_ADAPTER_UNMAPPED_FIELDS,
  adaptLegacyDataTrustResult,
} from "./data-trust-score-adapter";

export type {
  LegacyEvidenceType,
  LegacyEvidenceItem,
  EvidenceAdapterContext,
  EvidenceAdaptationIssue,
  EvidenceAdaptationIssueCode,
  EvidenceSourceReference,
  EvidenceAdaptationResult,
} from "./evidence-adapter";

export {
  LEGACY_EVIDENCE_TYPES,
  EVIDENCE_ADAPTER_UNMAPPED_FIELDS,
  adaptLegacyEvidence,
  adaptLegacyEvidenceList,
} from "./evidence-adapter";

export type {
  LegacyRecommendationType,
  LegacyRecommendationItem,
  RecommendationAdapterContext,
  RecommendationAdaptationIssue,
  RecommendationAdaptationIssueCode,
  RecommendationSourceReference,
  RecommendationAdaptationResult,
} from "./recommendation-adapter";

export {
  LEGACY_RECOMMENDATION_TYPES,
  RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS,
  adaptLegacyRecommendation,
  adaptLegacyRecommendationList,
} from "./recommendation-adapter";

export type {
  SnapshotSourceKind,
  SnapshotSourceField,
  SnapshotProviderInput,
  SnapshotDerivation,
} from "./snapshot-provider";

export { deriveSiteSnapshot } from "./snapshot-provider";

export type { DataTrustEnvelopeIssue, DataTrustCanonicalEnvelope } from "./api-projection-adapter";

export { projectCanonicalDataTrustResponse } from "./api-projection-adapter";

/**
 * `services/intelligence-adapters/data-trust-read-adapter.ts` (Increment 7's DB-touching
 * outer adapter) is deliberately NOT re-exported here. Every existing pure-adapter test
 * in this repository imports from this barrel
 * (`@/services/intelligence-adapters`) expecting zero I/O; re-exporting the outer
 * adapter here would make this barrel transitively import `node:sqlite`
 * (`data-trust-read-adapter.ts` -> `services/data-trust-engine.ts` ->
 * `services/site-service.ts` -> `lib/db.ts`), breaking every one of those tests'
 * Vitest collection. Import it directly from
 * `@/services/intelligence-adapters/data-trust-read-adapter` instead -- exactly what
 * `services/intelligence-runtime/intelligence-orchestrator-instance.ts` (its only
 * intended caller) does.
 */

export { computeEvidenceChecksum } from "./evidence-checksum";

export type { EvidenceEnvelopeIssue, EvidenceCenterCanonicalEnvelope } from "./evidence-projection-adapter";

export { projectCanonicalEvidenceResponse } from "./evidence-projection-adapter";

/**
 * `services/intelligence-adapters/evidence-center-read-adapter.ts` (Increment 8's
 * DB-touching outer adapter) is, for the identical reason as
 * `data-trust-read-adapter.ts` above, deliberately NOT re-exported here. Import it
 * directly from `@/services/intelligence-adapters/evidence-center-read-adapter`
 * instead -- exactly what
 * `services/intelligence-runtime/intelligence-evidence-orchestrator-instance.ts`
 * (its only intended caller) does.
 */

export type {
  SiteIntelligenceCapabilityProjection,
  SiteIntelligenceAggregateEnvelope,
} from "./site-intelligence-projection-adapter";

export { projectSiteIntelligenceResponse } from "./site-intelligence-projection-adapter";
