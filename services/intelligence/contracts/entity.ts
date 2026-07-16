import type { IsoDateTime, Identifier, Metadata } from "../types/common";

/**
 * The base contract every canonical entity in the Intelligence Foundation
 * must satisfy.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Before Genesis Phase 1, "an entity" meant whatever a given module decided
 * it meant — some had an `id`, some didn't; some tracked timestamps, some
 * didn't. That is fine for a single module, but it breaks down the moment a
 * second engine needs to reason generically about "any entity" (for
 * example: "attach evidence to this entity" or "this Recommendation affects
 * these three entities of possibly-different kinds"). A single, minimal,
 * mandatory shape is what makes that generic reasoning possible without
 * runtime type-sniffing.
 *
 * The five fields below are the intersection of what every future engine
 * (Risk, Opportunity, Confidence, Priority, Data Trust, Forecast,
 * Simulation, Optimization, Executive AI, ...) needs from *any* entity it
 * touches, and nothing more. Domain-specific fields belong on the entity
 * itself (see entities/*.ts), not here.
 */
export interface BaseEntity<TKind extends string = string> {
  /** Discriminant identifying which canonical entity this is. Enables
   * exhaustive narrowing (`switch (entity.kind)`) without a separate type
   * tag or runtime class check. */
  readonly kind: TKind;

  /** Opaque, strongly-typed identifier. See {@link Identifier}. */
  readonly id: Identifier<TKind>;

  /** When this entity was first observed/created, from the Intelligence
   * Foundation's point of view. Not necessarily the same as when the
   * underlying real-world thing (a site, a tower) came into existence. */
  readonly createdAt: IsoDateTime;

  /** When this entity's representation was last updated. Used by engines
   * to reason about staleness without needing a separate "last modified"
   * side-channel. */
  readonly updatedAt: IsoDateTime;

  /** Monotonically increasing revision counter for this entity's
   * representation. Distinct from `contractVersion` / `engineVersion`
   * (versioning/version.ts), which version the *shape* of the contract,
   * not a specific record. */
  readonly version: number;

  /** Open, serializable metadata bag. See {@link Metadata} for why this is
   * deliberately not a place to put structurally-relied-upon fields. */
  readonly metadata: Metadata;
}

/**
 * Narrows `BaseEntity` to a specific entity kind, and requires the branded
 * identifier to match. Used as the extension point for every canonical
 * entity interface in `entities/*.ts`.
 */
export type EntityOfKind<TKind extends string> = BaseEntity<TKind>;
