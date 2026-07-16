/**
 * The canonical set of intelligence engine identifiers named in the
 * Genesis Phase 1 mission brief.
 *
 * WHY THIS IS A CONST LIST, NOT A UNION TYPE
 * ---------------------------------------------------------------------------
 * `EngineId` is deliberately `string`, not a closed union of these
 * literals: the whole point of the registry (engine-registry.ts) is that
 * *future* engines — ones this phase cannot name — declare themselves
 * through the same mechanism. A closed union would need editing (a
 * contract change) every time a new engine is declared, which defeats the
 * "no business logic changes required to add an engine" goal. This list
 * exists so the engines the mission brief *does* name have one canonical
 * spelling that every reference to them (docs, tests, future declarations)
 * can share.
 */
export const CANONICAL_ENGINE_IDS = [
  "risk",
  "opportunity",
  "confidence",
  "priority",
  "data-trust",
  "recommendation",
  "machine-learning",
  "simulation",
  "forecast",
  "optimization",
  "executive-ai",
] as const;

export type CanonicalEngineId = (typeof CANONICAL_ENGINE_IDS)[number];

/** An engine identifier. See {@link CANONICAL_ENGINE_IDS} for why this is
 * open-ended rather than a closed union. */
export type EngineId = CanonicalEngineId | (string & {});

/**
 * The lifecycle state of an engine declaration.
 *
 * `"planned"` covers every engine Genesis Phase 1 declares but does not
 * implement (all of them — this phase is architecture only). `"active"` is
 * reserved for a future phase that actually ships an engine's logic.
 */
export const ENGINE_DECLARATION_STATUSES = [
  "planned",
  "active",
  "deprecated",
] as const;

export type EngineDeclarationStatus =
  (typeof ENGINE_DECLARATION_STATUSES)[number];
