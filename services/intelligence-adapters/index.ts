/**
 * Genesis Phase 2 — Increment 3. Public entry point for adapters that
 * translate legacy repository data into `services/intelligence/**`'s
 * canonical entities. Currently exports only the Site Entity Adapter
 * (`08_ADAPTER_STRATEGY.md` adapter #1). Nothing in this module opens a
 * database, imports Next.js, or executes a legacy engine.
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
