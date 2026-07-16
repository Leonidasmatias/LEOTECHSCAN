import type { Identifier } from "./common";

/**
 * One branded identifier alias per canonical entity kind.
 *
 * WHY THIS IS ITS OWN FILE
 * ---------------------------------------------------------------------------
 * Every entity file and every contract that references an entity by id
 * (Score.entity, Recommendation.affectedEntities, Observation.subjectId,
 * ...) needs the same id aliases. Declaring them once here — instead of
 * inline in each entity file — is what "no duplicated interfaces" means in
 * practice: there is exactly one place that says "a Site's id is branded
 * `Site`", and every other file imports it.
 */
export type SiteId = Identifier<"Site">;
export type MunicipalityId = Identifier<"Municipality">;
export type StateId = Identifier<"State">;
export type OperatorId = Identifier<"Operator">;
export type TechnologyId = Identifier<"Technology">;
export type TowerCompanyId = Identifier<"TowerCompany">;
export type StructureId = Identifier<"Structure">;
export type EquipmentId = Identifier<"Equipment">;
export type ObservationId = Identifier<"Observation">;
export type DataSourceId = Identifier<"DataSource">;
export type SnapshotId = Identifier<"Snapshot">;
export type IndicatorId = Identifier<"Indicator">;
export type ScenarioId = Identifier<"Scenario">;
export type ScoreId = Identifier<"Score">;
export type EvidenceId = Identifier<"Evidence">;
export type RecommendationId = Identifier<"Recommendation">;
