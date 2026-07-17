/**
 * Genesis Phase 2 — Increments 3, 4 & 5. Public entry point for adapters that
 * translate legacy repository data into `services/intelligence/**`'s
 * canonical entities. Currently exports the Site Entity Adapter
 * (`08_ADAPTER_STRATEGY.md` adapter #1), the Data Trust Score Adapter's
 * pure translator (adapter #2's inner half only — see
 * `data-trust-score-adapter.ts`'s own header for the DB-touching-outer-layer
 * scope note), and the Evidence Adapter (adapter #3). Nothing in this module
 * opens a database, imports Next.js, or executes a legacy engine.
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
