import type { BaseEntity } from "../contracts/entity";
import type {
  SiteId,
  MunicipalityId,
  StateId,
  OperatorId,
  TechnologyId,
  TowerCompanyId,
} from "../types/identifiers";

/**
 * Canonical reference shape for a telecom site.
 *
 * This is intentionally a *reference* contract (ids pointing at related
 * entities), not a re-declaration of the rich, column-level site schema
 * that already exists in `core/site.ts` and `sentinel-core/entities/`.
 * Those model the imported/raw data; this models "a site" as something
 * every intelligence engine can reason about generically — a Risk Engine
 * and a Forecast Engine both need to say "this score is about SiteId X",
 * without either one needing to know about import columns, file origins,
 * or any other implementation detail of how the site got into the system.
 */
export interface Site extends BaseEntity<"Site"> {
  readonly kind: "Site";
  readonly id: SiteId;
  readonly municipalityId: MunicipalityId;
  readonly stateId: StateId;
  readonly operatorId: OperatorId | null;
  readonly towerCompanyId: TowerCompanyId | null;
  readonly technologyIds: readonly TechnologyId[];
}
