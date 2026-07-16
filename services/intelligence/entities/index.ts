/**
 * The canonical entity catalog.
 *
 * WHY THIS FILE IS THE SINGLE ENTRY POINT
 * ---------------------------------------------------------------------------
 * The mission requires a minimum canonical entity set of: Site,
 * Municipality, State, Operator, Technology, TowerCompany, Structure,
 * Equipment, Observation, DataSource, Snapshot, Indicator, Score, Evidence,
 * Recommendation, Scenario. Three of those — Score, Evidence, and
 * Recommendation — have rich, dedicated contracts elsewhere
 * (scoring/score.ts, evidence/evidence.ts, recommendations/recommendation.ts)
 * because they carry substantially more structure than a reference entity.
 * Re-exporting them here, alongside the reference entities that live in
 * this directory, means every canonical entity is reachable from one
 * import — `@/services/intelligence/entities` — without this file
 * re-declaring (and risking drifting from) their real definitions.
 */

export type { Site } from "./site";
export type { Municipality } from "./municipality";
export type { State } from "./state";
export type { Operator } from "./operator";
export type { Technology } from "./technology";
export type { TowerCompany } from "./tower-company";
export type { Structure } from "./structure";
export type { Equipment } from "./equipment";
export type { Observation } from "./observation";
export type { DataSource } from "./data-source";
export type { Snapshot } from "./snapshot";
export type { Indicator } from "./indicator";
export type { Scenario } from "./scenario";
export type { Score } from "../scoring/score";
export type { Evidence } from "../evidence/evidence";
export type { Recommendation } from "../recommendations/recommendation";

/**
 * The closed set of canonical entity kind discriminants. Used by
 * `validation/validators.ts` to check that an `EntityReference.kind` is
 * recognized, and by tests to assert the catalog stays complete.
 */
export const CANONICAL_ENTITY_KINDS = [
  "Site",
  "Municipality",
  "State",
  "Operator",
  "Technology",
  "TowerCompany",
  "Structure",
  "Equipment",
  "Observation",
  "DataSource",
  "Snapshot",
  "Indicator",
  "Score",
  "Evidence",
  "Recommendation",
  "Scenario",
] as const;

export type CanonicalEntityKind = (typeof CANONICAL_ENTITY_KINDS)[number];
